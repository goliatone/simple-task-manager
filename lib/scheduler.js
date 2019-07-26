'use strict';

const Task = require('./task');
const extend = require('gextend');

const defaults = {
    backend: {},
    createBackend(config) {
        const RedisBackend = require('./backends/redis');
        return new RedisBackend(config);
    }
};

class Scheduler {
    constructor(config = {}) {
        config = extend({}, this.constructor.defaults, config);
        this.init(config);
    }

    init(config = {}) {
        if (this.initialized) return;
        this.initialized = true;

        extend(this, config);

        this.backend = this.createBackend(config.backend);

        this.backend.on('task.created', task => {
            this.addTask(task);
        });

    }

    addTask(task) {
        if (!(task instanceof Task)) {
            task = new Task(task);
        }

        if (!task.id) task.id = this.getUid();

        return this.backend.addTask(task);
    }

    getUid(len = 20) {
        const timestamp = (new Date()).getTime().toString(36);
        const randomString = (len) => [...Array(len)].map(_ => Math.random().toString(36)[3]).join('');
        len = len - (timestamp.length + 1);
        return `${timestamp}-${randomString(len)}`;
    }
}

Scheduler.defaults = defaults;

module.exports = Scheduler;