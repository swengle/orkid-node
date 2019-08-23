"use strict";
/*
  Source: https://github.com/luin/ioredis/issues/747#issuecomment-500735545
*/
Object.defineProperty(exports, "__esModule", { value: true });
function parseObjectResponse(reply) {
    if (!Array.isArray(reply)) {
        return reply;
    }
    const data = {};
    for (let i = 0; i < reply.length; i += 2) {
        data[reply[i]] = reply[i + 1];
    }
    return data;
}
function parseMessageResponse(reply) {
    if (!Array.isArray(reply)) {
        return [];
    }
    return reply.map(message => {
        return {
            id: message[0],
            data: parseObjectResponse(message[1])
        };
    });
}
exports.parseMessageResponse = parseMessageResponse;
function parseStreamResponse(reply) {
    if (!Array.isArray(reply)) {
        return reply;
    }
    const object = {};
    for (const stream of reply) {
        object[stream[0]] = parseMessageResponse(stream[1]);
    }
    return object;
}
exports.parseStreamResponse = parseStreamResponse;
const parseXPendingResponse = (reply) => {
    if (!reply || reply.length === 0) {
        return [];
    }
    const consumers = (reply[3] || []).map((consumer) => {
        return {
            name: consumer[0],
            count: parseInt(consumer[1])
        };
    });
    if (reply.length === 4 && !Number.isNaN(reply[0])) {
        return {
            count: parseInt(reply[0]),
            minId: reply[1],
            maxId: reply[2],
            consumers
        };
    }
    return reply.map(message => {
        return {
            id: message[0],
            consumerName: message[1],
            elapsedMilliseconds: parseInt(message[2]),
            deliveryCount: parseInt(message[3])
        };
    });
};
exports.parseXPendingResponse = parseXPendingResponse;
