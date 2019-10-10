'use strict';
const noconsole = require('noop-console');
const extend = require('gextend');
const EventEmitter = require('events');
const Task = require('../task');

const debug = require('util').debuglog('redis');

const defaults = {
    logger: noconsole.logger(),
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

        /**
         * Since we are using the same backend for workers
         * and schedules we might overreact to these events.
         */
        if (config.isScheduler) {
            this.pubsub = this.createClient(config.clientOptions);
            this._createPubSub(this.expiredKeyEvents);
        }

    }

    _createPubSub(expiredKeyEvents) {
        this.pubsub.subscribe(expiredKeyEvents);
        this.pubsub.on('message', (channel, message) => {
            debug('message: channel %s', channel);
            this._onTaskExpirationTrigger(message);
        });
    }

    async _onTaskExpirationTrigger(message) {
        const match = message.match(/^(tasks:.+):ttl$/);
        if (!match) return;

        const serializedTask = await this.client.get(match[1]);
        const task = new Task({ serializedTask });

        debug('expiration trigger for %s', task.id);

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
     * TODO: Is there a way to make this idempotent?
     * TODO: Here we use task.queue, we should normalize use
     * 
     * @param {Task} task Task instance
     * @returns {Promise}
     */
    async addTask(task) {

        if (!task.id) {
            debug('Missing id, creating one');
            task.id = this.getUid();
            throw new Error('no id');
        }

        debug('adding task: %s queue: %s', task.id, task.queue);

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

        debug('>>> task: %s from %s', jobId, queue);

        let task = new Task({ id: jobId });
        task = await this.client.get(task.key);

        return new Task({ serializedTask: task });
    }

    commit(task, queue = 'tasks') {

        task.runs++;
        task.errorCount = 0;

        task.executionTime = Date.now() - task.start;

        const tx = this.client.multi();
        debug('remove task ttl %s', task.ttlKey);
        /**
         * Once we commit a task we remove any dangling ttls
         * we might have since now are useless.
         */
        tx.del(task.ttlKey);

        /** 
         * If the task is done we remove it and
         * add it to the completed set...
         */
        debug('task.maxRuns %s task.runs %s task.ttl %s', task.maxRuns, task.runs, task.ttl);
        debug('runs >= maxRuns %s', task.runs >= task.maxRuns);

        //TODO: Review this condition, if task.ttl > 0 this breaks
        //even it we already ran over our limit...

        const state = task.shouldRun('commit');
        // this.logger.info('commit state', state.action);
        debug('COMMIT state', state.action);

        switch (state.action) {
            case 'enqueue':
                debug('enqueue task %s to %s', task.id, queue);
                tx.rpush(queue, task.id);
                tx.set(task.key, task.serialize());
                break;
            case 'complete':
                debug('::::::::: R3MOVE TASK %s :::::::', task.id);
                tx.del(task.key);
                /**
                 * How many tasks do we want to keep here?
                 * For how long?
                 */
                tx.rpush('tasks:completed', task.serialize());
                break;
            case 'delay':
                /**
                 * We had a ttl on our task, so we schedule it
                 * again after our TTL.
                 */
                debug('delay next task: %s', state.ttl);
                debug('update task %s', task.key);
                tx.set(task.ttlKey, task.key, 'PX', state.ttl);
                tx.set(task.key, task.serialize());
                break;
        }

        tx.lrem('tasks:active', -1, task.id);

        tx.exec();

        return tx;
    }

    queueLength(queue) {
        return this.client.llen(queue);
    }

    async handleError(task, error, queue = 'tasks') {

        debug('handling error...');

        this.fail(task, error);

        debug('update task %s with latest state', task.id);
        debug('set %s', task.key);
        debug('remove task %s from active queue', task.id);
        debug('remove task ttl %s', task.ttlKey);

        /**
         * Update our serialized task 
         * Remove our task from the active queue.
         * Remove the task's ttl key
         */
        await this.client.multi()
            .set(task.key, task.serialize())
            .del(task.ttlKey)
            .lrem('tasks:active', -1, task.id)
            .exec();

        /**
         * Figure out if we need to run it again.
         * * This should return an object with a mode
         * * with one of three values:
         * * enqueue, delay, fail
         */
        const state = task.shouldRun('error', { error });

        // this.logger.info('handle error state: "%s"', state.action);
        debug('Handle ERROR state: "%s"', state.action);
        debug('errorCount <= maxTries %s', task.errorCount <= task.maxTries);
        debug('Error %s/%s', task.errorCount, task.maxTries);

        switch (state.action) {
            case 'enqueue':
                debug('enqueue task: %s to queue %s', task.id, queue);
                /**
                 * This will push the task back in the 
                 * queue and it will be executed asap.
                 */
                await this.client.rpush(queue, task.id);
                break;
            case 'delay':
                debug('delay errored task: %s - %s', state.ttl, task.ttlKey);
                await this.client.set(task.ttlKey, task.key, 'PX', state.ttl);
                break;
            case 'fail':
                this.dispatcher.emit('task.failed', task);
                await this.client.rpush('tasks:failed', task.id);
                break;
        }

        return task;
    }

    /**
     * Update a task with a new error.
     * @param {Task} task Task instance
     * @param {Error} error Error instance
     */
    fail(task, error) {

        if (error.code !== 504) this.logger.error('Task error', error);

        task.fail(error);

        this.dispatcher.emit('task.error', task);
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