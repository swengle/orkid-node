export interface RawData {
    data: string;
    dedupKey: string;
    retryCount: number;
}
export declare class Task {
    id: string;
    dataString: string;
    dataObj: unknown;
    dedupKey: string;
    retryCount: number;
    constructor(id: string, rawData: RawData);
    incrRetry(): void;
}
