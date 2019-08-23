"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Joi = __importStar(require("@hapi/joi"));
const schema = Joi.object().keys({
    data: Joi.string()
        .required()
        .allow(''),
    dedupKey: Joi.string()
        .required()
        .allow(''),
    retryCount: Joi.number()
        .integer()
        .min(0)
        .required()
});
const validationOptions = {
    abortEarly: true,
    convert: true,
    allowUnknown: false
};
class Task {
    constructor(id, rawData) {
        if (!id) {
            throw new Error('Task requires an ID');
        }
        const { value, error } = Joi.validate(rawData, schema, validationOptions);
        if (error) {
            throw new Error(`Invalid rawData for task: ${error}`);
        }
        this.id = id;
        this.dataString = value.data;
        this.dataObj = JSON.parse(value.data);
        this.dedupKey = value.dedupKey;
        this.retryCount = value.retryCount;
    }
    incrRetry() {
        this.retryCount++;
    }
}
exports.Task = Task;
