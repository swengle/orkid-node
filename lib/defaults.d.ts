import * as IORedis from 'ioredis';
export interface QueueOptions {
    maxResultListSize?: number;
    maxFailedListSize?: number;
    maxDeadListSize?: number;
}
export interface ConsumerOptions {
    workerFnTimeoutMs?: number;
    taskBufferSize?: number;
    maxRetry?: number;
    concurrencyPerInstance?: number;
}
export interface LoggingOptions {
    enabled?: boolean;
    loggerFn?(message?: any, ...optionalParams: any[]): void;
}
export declare const defaultOptions: {
    NAMESPACE: string;
    RESULTLIST: string;
    FAILEDLIST: string;
    DEADLIST: string;
    STAT: string;
    QUENAMES: string;
    redisOptions: IORedis.RedisOptions;
    queueOptions: QueueOptions;
    consumerOptions: ConsumerOptions;
    loggingOptions: LoggingOptions;
};
