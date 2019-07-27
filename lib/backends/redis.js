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

        this.dispatcher = this;

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
        return this.addTask(task);
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
    async addTask(task) {

        if (!task.id) task.id = this.getUid();

        await this.client.multi()
            .set(task.key, task.serialize())
            .rpush(task.queue, task.id)
            .exec();

        this.dispatcher.emit('task.created', task);

        return task;
    }

    /**
     * Waits on **queue** until a task is 
     * available
     * @param {String} [queue=task] Queue name 
     */
    async waitForTask(queue = 'tasks') {
        const jobId = await this.client.brpoplpush(queue, 'tasks:active', 0);
        let task = new Task({ id: jobId });
        task = await this.client.get(task.key);
        return new Task({ serializedTask: task });
    }

    commit(task) {
        task.runs++;
        task.errorCount = 0;

        task.executionTime = Date.now() - task.start;

        const tx = this.client.multi();

        /** 
         * If the task is done we remove it and
         * add it to the completed set...
         */
        console.log('task.maxRuns %s task.runs %s ttl %s', task.maxRuns, task.runs, task.ttl);
        console.log('RUN %s', task.maxRuns >= task.runs);

        //TODO: Review this condition, if task.ttl > 0 this breaks
        //even it we already ran over our limit...
        if (task.maxRuns >= task.runs || task.ttl === 0) {
            console.log('::::::::: R3MOVE TAS7!!!!:::::::');
            tx.del(task.key);
            tx.del(task.ttlKey);
            tx.set('tasks:completed', task.serialize());
        } else {
            /**
             * We had a ttl on our task, so we schedule it
             * again after our TTL.
             */
            tx.set(task.ttlKey, task.key, 'PX', task.ttl);
            tx.set(task.key, task.serialize());
        }

        tx.lrem('tasks:active', -1, task.id);

        tx.exec();

        return tx;
    }

    async handleError(task, error, queue = 'tasks') {

        this.fail(task, error);

        /**
         * Remove our task from the active queue.
         */
        await this.client.multi()
            .set(`tasks:${task.id}`, task.serialize())
            .lrem('tasks:active', -1, task.id)
            .exec();

        /**
         * Figure out if we need to run it again.
         */
        if (task.maxTries > task.runs) {
            // if(Date.now() < task.runBefore){}
            this.failed++;
            this.dispatcher.emit('task.failed', task);
            await this.client.rpush('tasks:failed', task.id);
        } else {
            /**
             * This will pick it up right away. However, what
             * if our task/job is wonked and we keep rescheduling?
             * We want to control this, so we should add some more 
             * logic:
             * `if run < maxTries = try again`
             * `if now() < runBefore = try again`
             */
            await this.client.rpush(queue, task.id).catch(process.exit);
        }

        return task;
    }

    fail(task, error) {

        task.runs++;
        task.errorCount++;
        task.totalErrors++;

        if (error.toJSON) {
            task.errors.push(error.toJSON());
        } else {
            task.errors.push({
                code: error.code,
                message: error.message
            });
        }
    }

    getUid(len = 20) {
        const timestamp = (new Date()).getTime().toString(36);
        const randomString = (len) => [...Array(len)].map(_ => Math.random().toString(36)[3]).join('');
        len = len - (timestamp.length + 1);
        return `${timestamp}-${randomString(len)}`;
    }
}

RedisBackend.defaults = defaults;

module.exports = RedisBackend;