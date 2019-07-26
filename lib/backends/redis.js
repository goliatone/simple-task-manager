'use strict';

const extend = require('gextend');
const EventEmitter = require('events');
const Task = require('../task');

const defaults = {
    autoinitialize: true,
    expiredKeyEvents: '__keyevent@0__:expired',
    createClient(options = {}) {
        const redis = require('ioredis');
        return redis.createClient(options);
    }
};

class RedisBackend extends EventEmitter {
    constructor(config = {}) {
        super();

        config = extend({}, this.constructor.defaults, config);

        if (config.autoinitialize) {
            this.init(config);
        }
    }

    init(config = {}) {
        if (this.initialized) return;
        this.initialized = true;

        extend(this, config);

        /**
         * We can pass a redis connection
         */
        if (!config.client) {
            this.client = this.createClient(config.clientOptions);
        }

        this.pubsub = this.createClient(config.clientOptions);
        this._createPubSub(this.expiredKeyEvents);
    }

    _createPubSub(expiredKeyEvents) {
        this.pubsub.subscribe(expiredKeyEvents);
        this.pubsub.on('message', (_, message) => {
            this._onTaskExpirationTrigger(message);
        });
    }

    async _onTaskExpirationTrigger(message) {
        const match = message.match(/^(tasks:.+):ttl$/);
        if (!match) return;
        const serializedTask = await this.client.get(match[1]);
        const task = new Task({ serializedTask });
        this.emit('task.created', task);
    }

    /**
     * Adds a new task to our Redis backend.
     * 
     * Scheduled queue
     * Processing queue
     * Dead letter queue
     * 
     * RPUSH: Insert element at the tail of the specified list
     * LPUSH: Inset element at the head of the specified list
     * BRPOPLPUSH: 
     * 
     * @param {Task} task Task instance
     * @returns {Promise}
     */
    addTask(task) {
        return this.client.multi()
            .set(task.key, task.serialize())
            .rpush(task.queue, task.id)
            .exec();
    }
}

RedisBackend.defaults = defaults;

module.exports = RedisBackend;