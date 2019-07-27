'use strict';

const Task = require('./task');
const extend = require('gextend');
const noconsole = require('noop-console');

const defaults = {
    backend: {},
    logger: noconsole.logger(),
    createBackend(config) {
        const RedisBackend = require('./backends/redis');
        return new RedisBackend(config);
    }
};

//TODO: We need to detect worker errors and retry tasks...
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

    }

    addTask(task) {
        if (!(task instanceof Task)) {
            task = new Task(task);
        }

        return this.backend.addTask(task);
    }
}

Scheduler.defaults = defaults;

module.exports = Scheduler;