declare function parseMessageResponse(reply: Array<any>): StreamValue[];
export interface StreamValue {
    id: string;
    data: any;
}
declare function parseStreamResponse(reply: Array<any>): Record<string, StreamValue[]>;
declare const parseXPendingResponse: (reply: any[]) => {
    id: string;
    consumerName: string;
    elapsedMilliseconds: number;
    deliveryCount: number;
}[] | {
    count: number;
    minId: any;
    maxId: any;
    consumers: Record<string, any>[];
};
export { parseStreamResponse, parseMessageResponse, parseXPendingResponse };
