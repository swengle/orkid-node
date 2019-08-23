import IORedis from 'ioredis';
interface Pipeline extends IORedis.Pipeline {
    requeue(qname: string, dedupSet: string, groupName: string, taskId: string, taskData: string, dedupKey: string | null, retryCount: number): Pipeline;
    dequeue(qname: string, dedupSet: string, groupName: string, taskId: string, taskDedupkey: string): Pipeline;
}
export interface Redis extends IORedis.Redis {
    enqueue(qname: string, dedupSet: string, data: string, dedupKey: string | null, retryCount: number): Promise<string | null>;
    requeue(qname: string, dedupSet: string, groupName: string, taskId: string, taskData: string, dedupKey: string | null, retryCount: number): Promise<string | null>;
    dequeue(qname: string, dedupSet: string, groupName: string, taskId: string, taskDedupkey: string): Promise<null>;
    delconsumer(qname: string, groupName: string, consumerName: string): Promise<null>;
    pipeline(commands?: string[][]): Pipeline;
}
export declare function initScripts(redis: IORedis.Redis): Promise<any[]>;
export {};
