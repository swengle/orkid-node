"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TimeoutError extends Error {
    constructor(...args) {
        super(...args);
        Error.captureStackTrace(this, TimeoutError);
    }
}
exports.TimeoutError = TimeoutError;
class InvalidConfigError extends Error {
    constructor(...args) {
        super(...args);
        Error.captureStackTrace(this, InvalidConfigError);
    }
}
exports.InvalidConfigError = InvalidConfigError;
