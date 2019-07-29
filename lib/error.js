'use strict';

class TaskRunError extends Error {

    constructor(message, code) {
        super(message);
        this.code = code;
        this.ts = Date.now();
        this.message = message;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            ts: this.ts
        };
    }
}

/**
 * We can use this error to signal we can try
 * our task again. We can specify a time period
 * in milliseconds to wait
 */
class RetryableTaskError extends TaskRunError {
    constructor(message, wait = 5000) {
        super(message, 3);
        this.wait = wait;
    }
}
RetryableTaskError.CODE = 3;

module.exports.TaskRunError = TaskRunError;
module.exports.RetryableTaskError = TaskRunError;