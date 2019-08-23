"use strict";
// TODO: Add docs for options and defaults
Object.defineProperty(exports, "__esModule", { value: true });
const redisOptions = {};
const queueOptions = {
    // Currently there is no API to override these defaults
    maxResultListSize: 10000,
    maxFailedListSize: 100000,
    maxDeadListSize: 100000
};
const consumerOptions = {
    workerFnTimeoutMs: 24 * 60 * 60 * 1000,
    taskBufferSize: 10,
    maxRetry: 0,
    concurrencyPerInstance: 1
};
const loggingOptions = {
    enabled: false,
    loggerFn: console.log
};
exports.defaultOptions = {
    NAMESPACE: 'orkid',
    RESULTLIST: 'orkid:internals:results',
    FAILEDLIST: 'orkid:internals:failed',
    DEADLIST: 'orkid:internals:dead',
    STAT: 'orkid:internals:stat',
    QUENAMES: 'orkid:internals:qnames',
    redisOptions,
    queueOptions,
    consumerOptions,
    loggingOptions
};
