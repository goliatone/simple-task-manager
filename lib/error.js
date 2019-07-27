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

module.exports.TaskRunError = TaskRunError;