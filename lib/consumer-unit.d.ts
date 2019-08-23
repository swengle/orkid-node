import IORedis from 'ioredis';
import { Redis } from './commands';
import { Task } from './task';
import { LoggingOptions, ConsumerOptions } from './defaults';
export interface ConsumerUnitOptions {
    redisOptions?: IORedis.RedisOptions;
    redisClient?: IORedis.Redis;
    loggingOptions?: LoggingOptions;
    consumerOptions?: ConsumerOptions;
}
export interface Metadata {
    id: string;
    qname: string;
    retryCount: number;
    consumerName: string;
}
export declare class ConsumerUnit {
    _paused: boolean;
    _QNAME: string;
    _DEDUPSET: string;
    qname: string;
    _GRPNAME: string;
    workerFn: Function;
    _pendingTasks: Task[];
    _totalTasks: number;
    consumerOptions: ConsumerOptions;
    loggingOptions: LoggingOptions;
    _redis: Redis;
    redisOptions: IORedis.RedisOptions;
    _name: string;
    _isInitialized: boolean;
    _loopStarted: boolean;
    constructor(qname: string, workerFn: Function, { consumerOptions, redisOptions, redisClient, loggingOptions }?: ConsumerUnitOptions);
    start(): void;
    pause(): void;
    resume(): void;
    _log(msg: string, ...optionalParams: any[]): void;
    _ensureConsumerGroupExists(): Promise<void>;
    _initialize(): Promise<void>;
    _getPendingTasks(): Promise<number>;
    _waitForTask(): Promise<void>;
    _cleanUp(): Promise<{
        consumerNames: string[];
        pendingConsumerNames: string[];
        emptyConsumerNames: string[];
        activeWorkers: string[];
        orphanWorkers: string[];
        orphanEmptyWorkers: string[];
        claimInfo: Record<string, number>;
        deleteInfo: string[];
    }>;
    _processLoop(): Promise<void>;
    _processTask(): Promise<void>;
    _processSuccess(task: Task, result: any): Promise<void>;
    _processFailure(task: Task, error: Error): Promise<void>;
    _wrapWorkerFn(data: any, metadata: Metadata): Promise<any>;
    _disconnect(): Promise<void>;
}
