'use strict';
const extend = require('gextend');
const EventEmitter = require('events');
const Task = require('../task');

const debug = require('util').debuglog('scheduler');

const defaults = {
    logger: extend.shim(console),
    autoinitialize: true,
    getId: require('../getid'),
    expiredKeyEvents: '__keyevent@0__:expired',
    expiredKeyEventMatcher: /^(tasks:.+):ttl$/,

    createClient(options = {}) {
        const redis = require('ioredis');
        return redis.createClient(options);
    }
};

/**
 * Redis SET history
 * 
 * >= 2.6.12: Added the EX, PX, NX and XX options.
 * >= 6.0: Added the KEEPTTL option.
 * >= 6.2: Added the GET, EXAT and PXAT option.
 * 
 */
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
         * We can pass a redis connection.
         * Client is for the normal interaction
         * with redis.
         */
        if (!config.client) {
            this.client = this.createClient(config.clientOptions);
        }

        /**
         * Since we are using the same backend for workers
         * and schedules we might overreact to these events.
         * pubsub is a blocking client that can only be used
         * for, well... pubsub.
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
        const match = message.match(this.expiredKeyEventMatcher);
        if (!match) return;

        //TODO: We need to harden this! We might not have a valid task, etc
        const serializedTask = await this.client.get(match[1]);

        const task = new Task({ serializedTask });

        debug('expiration trigger for %s', task.id);

        return this.addTask(task, true);
    }

    queueLength(queue) {
        return this.client.llen(queue);
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
    async addTask(task, fromExpiredEvent = false) {

        if (!task.id) task.id = this.getUid();

        debug('adding task: %s queue: %s', task.id, task.queue);

        if (fromExpiredEvent === false) {
            let serialized = await this.client.get(task.key);
            if (typeof serialized === 'string') {
                //TODO: should we check if they are different and update?
                // Task.compare(task, serialized);
                debug('Task already present!');
                return new Task({ serializedTask: serialized });
            }
        }

        let tx = this.client.multi();

        /**
         * store serialized task as `task:<id>`.
         */
        tx.set(task.key, task.serialize());

        /**
         * If we have a TTL then set expire.
         * Else add directly to the queue.
         */
        if (task.status !== Task.STATE.scheduled && task.ttl > 0) {
            tx.set(task.ttlKey, task.key, task.ttlOp, task.ttl);
        } else {
            tx.rpush(task.queue, task.id);
        }

        await tx.exec();

        this.dispatcher.emit('task.created', task);

        return task;
    }

    async getTask(id) {

        let task = new Task({ id });
        let serializedTask = await this.client.get(task.key);

        return new Task({ serializedTask });
    }

    /**
     * 
     * @param {Array<String>} ids Array of tasks ids
     * @returns {Array<Task>} An array of hydrated tasks
     */
    async getTasks(ids = []) {
        /**
         * Create a task for each id so we can 
         * build the task key.
         */
        let tasks = ids.map(id => {
            return new Task({ id });
        });

        /**
         * collect all task keys
         */
        let keys = tasks.map(task => {
            return task.key;
        });

        if (keys.length > 0) {
            tasks = await this.client.mget(keys);
        }

        /**
         * Remove any undefined tasks...
         */
        tasks = (tasks || []).filter(Boolean);

        return tasks.map(task => {
            return new Task({ serializedTask: task });
        });
    }

    /**
     * 
     * @param {String} id Task id
     */
    async deactivateTaskById(id, hard = false) {
        let task = await this.getTask(id);

        if (!task.id) {
            return this.client.lrem('tasks:active', -1, id);
        }

        return this.deactivateTask(task, hard);
    }

    /**
     * TODO: take in a multi tx and execute options
     * @param {Task} task Task instance
     * @param {Boolean} [hard=false] If true will also remove task definition
     * @returns {Promise}
     */
    async deactivateTask(task, hard = false) {
        debug('::::::::: DELETE TASK %s :::::::', task.id);

        let tx = this.client.multi();

        tx.del(task.ttlKey);

        tx.lrem('tasks:active', -1, task.id);

        this.logger.info('rem tasks %s del ttl %s', task.id, task.ttlKey);

        if (hard) tx.del(task.key);

        await tx.exec();

        return task;
    }

    /**
     * Waits on **queue** until a task is 
     * available
     * @param {String} [queue=task] Queue name 
     */
    async waitForTask(queue = 'tasks') {

        debug(':: waiting for task');

        /**
         * Our tasks queue holds task ids.
         * We pop from `queue` and push id to tasks:active
         */
        const taskId = await this.client.brpoplpush(queue, 'tasks:active', 0);
        debug('>>> task: %s from %s', taskId, queue);

        /**
         * Get a task object from the id 
         * so we can generate the task key
         */
        let task = new Task({ id: taskId, executionStart: Date.now() });

        /**
         * We store the serialized task under 
         * a key of form: `tasks:knznmuby-vefhyyi3jx5`
         */
        let serializedTask = await this.client.get(task.key);

        return task.deserialize(serializedTask);
    }

    /**
     * After a job unit executes a task the Worker
     * manager will commit the task.
     * 
     * @param {Task} task Task instance
     * @param {String} queue Queue name
     * @returns {Promise}
     */
    commit(task, queue = 'tasks') {
        /**
         * Update task metrics like run count etc
         */
        task.complete(true);

        const tx = this.client.multi();

        debug('remove task ttl %s', task.ttlKey);

        /**
         * Once we commit a task we remove any dangling ttls
         * we might have since now those are useless.
         */
        tx.del(task.ttlKey);

        /**
         * Remove task id from active task list
         */
        tx.lrem('tasks:active', -1, task.id);

        /** 
         * If the task is done we remove it and
         * add it to the completed set...
         */
        debug('task.maxRuns %s task.runs %s task.ttl %s', task.maxRuns, task.runs, task.ttl);
        debug('runs >= maxRuns %s', task.runs >= task.maxRuns);

        //TODO: Review this condition, if task.ttl > 0 this breaks
        //even it we already ran over our limit...

        task.updateState('commit');

        debug('COMMIT state', task.status);

        switch (task.status) {
            case Task.STATE.enqueued:
                debug('enqueue task %s to %s', task.id, queue);

                tx.rpush(queue, task.id);
                tx.set('tasks:ids', task.id, 'NX');
                tx.set(task.key, task.serialize());

                break;
            case Task.STATE.completed:
                debug('::::::::: R3MOVE TASK %s :::::::', task.id);
                /**
                 * Remove our task definition from task:<key> list
                 * and add to completed list
                 */
                tx.rpush('tasks:completed', task.serialize());
                tx.del(task.key);
                tx.del('tasks:ids', task.id);

                break;

            case Task.STATE.delayed:

                /**
                 * We had a ttl on our task, so we schedule it
                 * again after our TTL.
                 */
                debug('delay next task: %s', task.ttl);
                debug('update task %s', task.key);

                //TODO: tx.set.call(tx, this.scheduleToRedis(task.scheduleKeysFor('delay)));
                tx.set(task.ttlKey, task.key, task.ttlOp, task.ttl);
                tx.set(task.key, task.serialize());
                tx.set('tasks:ids', task.id, 'NX');

                break;
        }

        tx.exec();

        return tx;
    }

    async handleError(task, error, queue = 'tasks') {

        debug('handling error...');

        /**
         * Update task with error info
         */
        this.fail(task, error);

        debug('update task %s with latest state', task.id);
        debug('set %s', task.key);
        debug('remove task %s from active queue', task.id);
        debug('remove task ttl %s', task.ttlKey);

        /**
         * Update our serialized task (new error count, 
         * new run dates etc).
         */
        let tx = this.client.multi();

        /**
         * Once we commit a task we remove any dangling ttls
         * we might have since now those are useless.
         */
        tx.del(task.ttlKey);

        /**
         * Remove task id from active task list
         */
        tx.lrem('tasks:active', -1, task.id);


        /**
         * Figure out if we need to run it again.
         * This should return an object with a
         * mode with one of three values:
         * - enqueue: Retry immediately
         * - delay: Retry with a delay
         * - fail: Archive task in failed list
         */
        task.updateState('error', { error });

        debug('Handle ERROR state: "%s"', task.status);
        debug('errorCount <= maxTries %s', task.errorCount <= task.maxTries);
        debug('Error %s/%s', task.errorCount, task.maxTries);

        switch (task.status) {
            case Task.STATE.enqueued:
                debug('enqueue task: %s to queue %s', task.id, queue);
                /**
                 * This will push the task back in the 
                 * queue and it will be executed asap.
                 */
                tx.rpush(queue, task.id);
                tx.set(task.key, task.serialize());
                tx.set('tasks:ids', task.id, 'NX');

                break;
            case Task.STATE.delayed:
                debug('delay error task: %s - %s', task.ttl, task.ttlKey);

                tx.set(task.ttlKey, task.key, task.ttlOp, task.ttl);
                tx.set(task.key, task.serialize());
                tx.set('tasks:ids', task.id, 'NX');

                break;
            case Task.STATE.failed:
                this.dispatcher.emit('task.failed', task);

                tx.rpush('tasks:failed', task.serialize());
                tx.del(task.key);
                tx.del('tasks:ids', task.id);

                break;
        }

        await tx.exec();

        return task;
    }

    /**
     * Update a task with a new error.
     * @param {Task} task Task instance
     * @param {Error} error Error instance
     */
    fail(task, error) {

        if (error.code !== 504) this.logger.error('Task error', error);

        task.complete(false).fail(error);
        this.dispatcher.emit('task.error', task);

        return this;
    }
}

RedisBackend.defaults = defaults;

module.exports = RedisBackend;