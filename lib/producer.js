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
const lodash = __importStar(require("lodash"));
const commands_1 = require("./commands");
const common_1 = require("./common");
const defaults_1 = require("./defaults");
class Producer {
    /**
     * Create a new Producer for a queue
     * @param qname name of the queue.
     *
     * @param options.redisClient Optional. redisClient is an instance of `ioredis`
     *    which will be used to duplicate configs to create a new redis connection.
     *
     *    `options.redisClient` is used over `options.redisOptions` if both are present.
     *
     * @param options.redisOptions Optional. Any valid `ioredis` options.
     */
    constructor(qname, { redisOptions, redisClient } = {}) {
        this._isInitialized = false;
        this._redisOptions = defaults_1.defaultOptions.redisOptions;
        if (redisClient) {
            this._redis = redisClient.duplicate();
        }
        else {
            this._redisOptions = lodash.merge({}, defaults_1.defaultOptions.redisOptions, redisOptions);
            this._redis = new ioredis_1.default(this._redisOptions);
        }
        this._QNAME = `${defaults_1.defaultOptions.NAMESPACE}:queue:${qname}`;
        this._DEDUPSET = `${defaults_1.defaultOptions.NAMESPACE}:queue:${qname}:dedupset`;
        this._initialize();
    }
    async _initialize() {
        await commands_1.initScripts(this._redis);
        this._isInitialized = true;
    }
    async addTask(data = null, dedupKey = null) {
        await common_1.waitUntilInitialized(this, '_isInitialized');
        // enqueue is our custom lua script to handle task de-duplication and adding to streams atomically
        const retval = await this._redis.enqueue(this._QNAME, this._DEDUPSET, JSON.stringify(data), dedupKey, 0);
        return retval;
    }
    async _disconnect() {
        await this._redis.disconnect();
    }
}
exports.Producer = Producer;
