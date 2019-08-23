import IORedis from 'ioredis';
import { Redis } from './commands';
export interface ProducerOptions {
    redisClient?: IORedis.Redis;
    redisOptions?: IORedis.RedisOptions;
}
export declare class Producer {
    _redis: Redis;
    _QNAME: string;
    _DEDUPSET: string;
    _isInitialized: boolean;
    _redisOptions: IORedis.RedisOptions;
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
    constructor(qname: string, { redisOptions, redisClient }?: ProducerOptions);
    _initialize(): Promise<void>;
    addTask(data?: null, dedupKey?: string | null): Promise<string | null>;
    _disconnect(): Promise<void>;
}
