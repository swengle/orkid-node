export declare function delay(ms: number): Promise<unknown>;
interface LooseObject {
    [key: string]: any;
}
export declare function waitUntilInitialized(thisObj: LooseObject, initializeVarName: string): Promise<void>;
export {};
