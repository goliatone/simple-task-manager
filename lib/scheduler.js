'use strict';

const Task = require('./task');
const extend = require('gextend');

const defaults = {
    backend: {},
    logger: extend.shim(console),
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

        config.backend.isScheduler = true;
        this.backend = this.createBackend(config.backend);
    }

    /**
     * Adds a new task instance to the 
     * schedule.
     * 
     * @param {Task} task Task instance
     * @param {Object} task Task object
     * @param {String} queue Task queue
     * @returns {Promise}
     */
    addTask(task, queue) {
        if ((task instanceof Task) === false) {

            if (typeof task === 'string') {
                task = { id: task };
            }

            task = new Task(task);
        }
        //TODO: addToQueue(queue, task)
        if (queue) task.queue = queue;

        return this.backend.addTask(task);
    }

    getTask(id) {
        return this.backend.getTask(id);
    }

    getTasks(ids) {
        return this.backend.getTasks(ids);
    }

    /**
     * Removes a task by it's ID.
     * 
     * @param {Task} taskOrId Task
     * @param {String} taskOrId Task id
     * @returns {Promise} Resolves to a Task
     */
    deactivateTask(taskOrId) {
        if (typeof taskOrId === 'string') {
            return this.backend.deactivateTaskById(taskOrId);
        }

        return this.backend.deactivateTask(taskOrId);
    }

    deleteTask(id) {
        this.logger.info('delete task...');
        return this.backend.deactivateTaskById(id, true);
    }

    /**
     * Tasks can be left hanging in a 
     * unknown state, maybe due to a scheduler
     * crashing or some other system failure.
     * 
     * Rescuing a task means that we remove 
     * the task and then we re-issue the 
     * task again.
     * 
     * @param {Task} taskOrId Task
     * @param {String} taskOrId Task id
     */
    async rescueTask(taskOrId) {
        let task = await this.deactivateTask(taskOrId);
        if (!task.id) {
            return task;
        }
        this.logger.info('task', task.toJSON());
        return this.addTask(task);
    }

    async purgeTasks() {
        let ids = await this.getActiveTasks();

        if (!ids || ids.length === 0) {
            return [];
        }

        let tasks = await this.getTasks(ids);
        let purgedTasks = [];

        /**
         * We have task ids but not task definitions
         */
        if (ids.length > 0 && tasks.length === 0) {
            for (let id of ids) {
                this.logger.info('remove id', id);
                await this.backend.client.lrem('tasks:active', -1, id);
            }
        }

        /**
         * We could probably do this using 
         * pipelines instead of JS, but is 
         * good for now...
         */
        for (let task of tasks) {
            this.logger.info('id %s key %s ttl %s', task.id, task.key, task.ttlKey);
            //A) Remove from active queue
            // await this.backend.client.lrem('tasks:active', -1, task.id);
            // //B) Check if we have task definition
            // let definition = await this.backend.client.get(task.key);
            // if (!definition) {
            //     this.logger.info('skip');
            //     continue;
            // }

            task = await this.rescueTask(task);
            purgedTasks.push(task);
        }

        return purgedTasks.length;
    }


    getAllTaskIds(from = 0, to = -1) {
        return this.backend.client.lrange('tasks:ids', from, to);
    }

    /**
     * 
     * @param {Integer} from 
     * @param {*} to 
     */
    getFailedTasks(from = 0, to = -1) {
        return this.backend.client.lrange('tasks:failed', from, to);
    }

    getActiveTasks(from = 0, to = -1) {
        return this.backend.client.lrange('tasks:active', from, to);
    }

    getCompletedTasks(from = 0, to = -1) {
        return this.backend.client.lrange('tasks:completed', from, to);
    }
}

Scheduler.defaults = defaults;

module.exports = Scheduler;