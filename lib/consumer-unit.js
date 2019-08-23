"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const lodash_1 = __importDefault(require("lodash"));
const shortid = __importStar(require("shortid"));
const redis_errors_1 = require("redis-errors");
const commands_1 = require("./commands");
const common_1 = require("./common");
const redis_transformers_1 = require("./redis-transformers");
const task_1 = require("./task");
const errors_1 = require("./errors");
const defaults_1 = require("./defaults");
class ConsumerUnit {
    constructor(qname, workerFn, { consumerOptions, redisOptions, redisClient, loggingOptions } = {}) {
        this.redisOptions = defaults_1.defaultOptions.redisOptions;
        this._name = '';
        this._isInitialized = false;
        this._loopStarted = false;
        this._paused = true;
        this._QNAME = `${defaults_1.defaultOptions.NAMESPACE}:queue:${qname}`;
        this._DEDUPSET = `${defaults_1.defaultOptions.NAMESPACE}:queue:${qname}:dedupset`;
        this.qname = qname;
        // dealing with special characters, need to think about how to deal with this abstractly
        this._GRPNAME = `${defaults_1.defaultOptions.NAMESPACE}:queue:${qname.split(":")[1]}:cg`;
        this.workerFn = workerFn;
        this._pendingTasks = [];
        this._totalTasks = 0;
        this.consumerOptions = lodash_1.default.merge({}, defaults_1.defaultOptions.consumerOptions, consumerOptions);
        this.loggingOptions = lodash_1.default.merge({}, defaults_1.defaultOptions.loggingOptions, loggingOptions);
        if (redisClient) {
            this._redis = redisClient.duplicate();
        }
        else {
            this.redisOptions = lodash_1.default.merge({}, defaults_1.defaultOptions.redisOptions, redisOptions);
            this._redis = new ioredis_1.default(this.redisOptions);
        }
        this._initialize();
    }
    start() {
        common_1.waitUntilInitialized(this, '_isInitialized').then(() => {
            this._paused = false;
            this._processLoop();
        });
    }
    pause() {
        // TODO: Update globally `${orkidDefaults.NAMESPACE}:queue:${this.qname}:settings`
        // Also inform other queues via pub/sub
        this._paused = true;
    }
    resume() {
        this.start();
    }
    _log(msg, ...optionalParams) {
        if (this.loggingOptions.enabled && this.loggingOptions.loggerFn) {
            this.loggingOptions.loggerFn(`Orkid :: ${this._name}`, msg, ...optionalParams);
        }
    }
    async _ensureConsumerGroupExists() {
        try {
            // XGROUP CREATE mystream mygroup 0 MKSTREAM
            this._log('Ensuring consumer group exists', { QNAME: this._QNAME, GRPNAME: this._GRPNAME });
            // xgroup: https://redis.io/commands/xgroup
            await this._redis.xgroup('CREATE', this._QNAME, this._GRPNAME, 0, 'MKSTREAM');
        }
        catch (e) {
            // BUSYGROUP -> the consumer group is already present, ignore
            if (!(e instanceof redis_errors_1.ReplyError && e.message.includes('BUSYGROUP'))) {
                throw e;
            }
        }
    }
    async _initialize() {
        if (this._name) {
            // We already have a name? Reconnecting in this case
            // https://redis.io/commands/client-setname
            await this._redis.client('SETNAME', this._name);
            return;
        }
        await commands_1.initScripts(this._redis);
        const id = await this._redis.client('id');
        this._name = `${this._GRPNAME}:c:${id}-${shortid.generate()}`;
        await this._redis.client('SETNAME', this._name);
        await this._ensureConsumerGroupExists();
        this._isInitialized = true;
    }
    async _getPendingTasks() {
        this._log('Checking pending tasks');
        // xreadgroup: https://redis.io/commands/xreadgroup
        const redisReply = await this._redis.xreadgroup('GROUP', this._GRPNAME, this._name, 'COUNT', this.consumerOptions.taskBufferSize, 'STREAMS', this._QNAME, '0');
        const taskObj = redis_transformers_1.parseStreamResponse(redisReply);
        // @ts-ignore
        const tasks = [].concat(...Object.values(taskObj));
        for (const t of tasks) {
            const task = new task_1.Task(t.id, t.data);
            this._pendingTasks.push(task);
        }
        // Used for testing
        return tasks.length;
    }
    async _waitForTask() {
        this._log(`Waiting for tasks. Processed so far: ${this._totalTasks}`);
        // xreadgroup: https://redis.io/commands/xreadgroup
        await this._redis.xreadgroup('GROUP', this._GRPNAME, this._name, 'BLOCK', 0, 'COUNT', 1, 'STREAMS', this._QNAME, '>');
        this._log('Got new task');
    }
    /*
      Cleanup does the following things:
      - Get list of all consumers in current group
      - Find out which consumers are not active anymore in redis but have tasks
      - Find out which consumers are not active anymore in redis and empty
      - Claim ownership of tasks from inactive and non-empty consumers to process
      - Delete inactive and empty consumers to keep things tidy
    */
    async _cleanUp() {
        /* Returns items that are present in setA but not in setB */
        function difference(setA, setB) {
            const _difference = new Set(setA);
            for (const elem of setB) {
                _difference.delete(elem);
            }
            return _difference;
        }
        // xinfo: https://redis.io/commands/xinfo
        // Get the list of every consumer in a specific consumer group
        const info = await this._redis.xinfo('CONSUMERS', this._QNAME, this._GRPNAME);
        const consumerInfo = {};
        for (const inf of info) {
            const data = {};
            for (let i = 0; i < inf.length; i += 2) {
                data[inf[i]] = inf[i + 1];
            }
            consumerInfo[inf[1]] = data;
        }
        const consumerNames = Object.keys(consumerInfo);
        const pendingConsumerNames = new Set();
        const emptyConsumerNames = new Set();
        // Separate consumers with some pending tasks and no pending tasks
        for (const con of consumerNames) {
            if (consumerInfo[con].pending) {
                pendingConsumerNames.add(con);
            }
            else if (consumerInfo[con].idle > this.consumerOptions.workerFnTimeoutMs * 5) {
                // Just to be safe, only delete really old consumers
                emptyConsumerNames.add(con);
            }
        }
        // https://redis.io/commands/client-list
        const clients = (await this._redis.client('LIST')).split('\n');
        const activeWorkers = new Set();
        // Orkid consumers always set a name to redis connection
        // Filter active connections those have names
        for (const cli of clients) {
            const values = cli.split(' ');
            for (const v of values) {
                if (v.startsWith('name=')) {
                    const namePair = v.split('=');
                    if (namePair.length > 1 && namePair[1].length) {
                        activeWorkers.add(namePair[1]);
                    }
                }
            }
        }
        // Workers that have pending tasks but are not active anymore in redis
        const orphanWorkers = difference(pendingConsumerNames, activeWorkers);
        // Workers that have not pending tasks and also  are not active anymore in redis
        const orphanEmptyWorkers = difference(emptyConsumerNames, activeWorkers);
        const claimInfo = {};
        for (const w of orphanWorkers) {
            // xpending: https://redis.io/commands/xpending
            const redisXPendingReply = await this._redis.xpending(this._QNAME, this._GRPNAME, '-', '+', 1000, w);
            const pendingTasks = redis_transformers_1.parseXPendingResponse(redisXPendingReply);
            let ids = [];
            if (Array.isArray(pendingTasks)) {
                ids = pendingTasks.map(t => t.id);
            }
            // xclaim: https://redis.io/commands/xclaim
            const claim = (await this._redis.xclaim(this._QNAME, this._GRPNAME, this._name, this.consumerOptions.workerFnTimeoutMs * 2, ...ids, 'JUSTID'));
            claimInfo[w] = claim.length;
            this._log(`Claimed ${claim.length} pending tasks from worker ${w}`);
        }
        // Housecleaning. Remove empty and inactive consumers since redis doesn't do that itself
        const deleteInfo = [];
        for (const w of orphanEmptyWorkers) {
            // Our custom lua script to recheck and delete consumer atomically and safely
            await this._redis.delconsumer(this._QNAME, this._GRPNAME, w);
            deleteInfo.push(w);
            this._log(`Deleted old consumer ${w}`);
        }
        // Return value used for testing
        const retval = {
            consumerNames,
            pendingConsumerNames: Array.from(pendingConsumerNames),
            emptyConsumerNames: Array.from(emptyConsumerNames),
            activeWorkers: Array.from(activeWorkers),
            orphanWorkers: Array.from(orphanWorkers),
            orphanEmptyWorkers: Array.from(orphanEmptyWorkers),
            claimInfo,
            deleteInfo
        };
        this._log(`Cleanup result:`, retval);
        return retval;
    }
    async _processLoop() {
        if (this._loopStarted) {
            return;
        }
        this._loopStarted = true;
        while (!this._paused) {
            await this._cleanUp();
            await this._getPendingTasks();
            if (!this._pendingTasks.length) {
                await this._waitForTask();
            }
            while (this._pendingTasks.length && !this._paused) {
                await this._processTask();
            }
        }
        this._loopStarted = false;
    }
    async _processTask() {
        if (!this._pendingTasks.length) {
            return;
        }
        const task = this._pendingTasks.shift();
        this._log('Starting to process task', task);
        this._totalTasks++;
        // TODO: Update queue specific total processed stat
        await this._redis.hincrby(defaults_1.defaultOptions.STAT, 'processed', 1);
        const metadata = { id: task.id, qname: this.qname, retryCount: task.retryCount, consumerName: this._name };
        try {
            const result = await this._wrapWorkerFn(task.dataObj, metadata);
            await this._processSuccess(task, result);
        }
        catch (e) {
            if (e instanceof errors_1.TimeoutError) {
                this._log(`Worker ${task.id} timed out`, e);
            }
            else {
                this._log(`Worker ${task.id} crashed`, e);
            }
            await this._processFailure(task, e);
        }
    }
    async _processSuccess(task, result) {
        this._log(`Worker ${task.id} returned`, result);
        const resultVal = JSON.stringify({
            id: task.id,
            qname: this.qname,
            data: task.dataObj,
            dedupKey: task.dedupKey,
            retryCount: task.retryCount,
            result,
            at: new Date().toISOString()
        });
        // Add to success list
        await this._redis
            .pipeline()
            .dequeue(this._QNAME, this._DEDUPSET, this._GRPNAME, task.id, task.dedupKey) // Remove from queue
            .lpush(defaults_1.defaultOptions.RESULTLIST, resultVal)
            .ltrim(defaults_1.defaultOptions.RESULTLIST, 0, defaults_1.defaultOptions.queueOptions.maxResultListSize - 1)
            .exec();
    }
    async _processFailure(task, error) {
        const info = JSON.stringify({
            id: task.id,
            qname: this.qname,
            data: task.dataObj,
            dedupKey: task.dedupKey,
            retryCount: task.retryCount,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            at: new Date().toISOString()
        });
        if (task.retryCount < this.consumerOptions.maxRetry) {
            task.incrRetry();
            // Send again to the queue
            await this._redis
                .pipeline()
                .requeue(this._QNAME, this._DEDUPSET, this._GRPNAME, task.id, task.dataString, task.dedupKey, task.retryCount)
                .hincrby(defaults_1.defaultOptions.STAT, 'retries', 1)
                .exec();
            // TODO: Update queue specific total retries stat
        }
        else {
            // Move to deadlist
            await this._redis
                .pipeline()
                .dequeue(this._QNAME, this._DEDUPSET, this._GRPNAME, task.id, task.dedupKey) // Remove from queue
                .lpush(defaults_1.defaultOptions.DEADLIST, info)
                .ltrim(defaults_1.defaultOptions.DEADLIST, 0, defaults_1.defaultOptions.queueOptions.maxDeadListSize - 1)
                .hincrby(defaults_1.defaultOptions.STAT, 'dead', 1)
                .exec();
            // TODO: Update queue specific total dead stat
        }
        // Add to failed list in all cases
        await this._redis
            .pipeline()
            .lpush(defaults_1.defaultOptions.FAILEDLIST, info)
            .ltrim(defaults_1.defaultOptions.FAILEDLIST, 0, defaults_1.defaultOptions.queueOptions.maxFailedListSize - 1)
            .hincrby(defaults_1.defaultOptions.STAT, 'failed', 1)
            .exec();
        // TODO: Update queue specific total failed stat
    }
    _wrapWorkerFn(data, metadata) {
        const timeoutMs = this.consumerOptions.workerFnTimeoutMs;
        const timeoutP = new Promise((_, reject) => {
            const to = setTimeout(() => {
                clearTimeout(to);
                reject(new errors_1.TimeoutError(`Task timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        const workerP = this.workerFn(data, metadata);
        return Promise.race([timeoutP, workerP]);
    }
    async _disconnect() {
        this._paused = true;
        await common_1.waitUntilInitialized(this, '_isInitialized');
        await this._redis.disconnect();
    }
}
exports.ConsumerUnit = ConsumerUnit;
