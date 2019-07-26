'use strict';

const noconsole = require('noop-console');
const extend = require('gextend');
const Task = require('../task');
const EventEmitter = require('events');

const defaults = {
    runs: 0,
    errors: 0,
    failed: 0,
    queue: 'tasks',
    autoinitialize: true,
    logger: noconsole.logger(),
    createBackend(config) {
        const RedisBackend = require('../backends/redis');
        return new RedisBackend(config);
    }
};

const client = require('ioredis').createClient();

class Worker extends EventEmitter {
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

        this.client = this.createBackend(config.backend);
    }

    commit(task) {
        return this.client.commit(task);
    }

    async run(job) {
        let task;
        try {
            /**
             * Get the current jobId and move it to the active jobs 
             * queue.
             */
            task = await this.client.waitForTask(this.queue);

            this.emit('task.added', task);

        } catch (error) {
            this.logger.error(error);
            process.exit(1);
        }

        /**
         * Once the library is polished this should be the 
         * most likely point of failure, executing a job.
         * Probably want to:
         * - setup timeout before execute
         * - increase runs
         */
        try {
            this.runs++;

            await job(task);

            await this.commit(task);

            this.emit('task.ran', task);

        } catch (error) {
            this.errors++;

            this.fail(task, error);

            console.log('\truns: %s', task.runs);
            console.log('\tserialized: %s', task.serialize());
            console.log('-------------------\n');

            await client.multi()
                .set(`tasks:${task.id}`, task.serialize())
                .lrem('tasks:active', -1, task.id)
                .exec();

            // if(Date.now() < task.runBefore){}
            if (task.maxTries > task.runs) {
                this.failed++;
                console.log('==== TASK %s FAILED =====', task.id);
                await client.rpush('tasks:failed', task.id);
            } else {
                /**
                 * This will pick it up right away. However, what
                 * if our task/job is wonked and we keep rescheduling?
                 * We want to control this, so we should add some more 
                 * logic:
                 * `if run < maxTries = try again`
                 * `if now() < runBefore = try again`
                 */
                await client.rpush(this.queue, task.id).catch(process.exit);
            }
        }

        this.run(job);
    }

    fail(task, error) {
        this.logger.error('Task error', error);
        this.client.fail(task, error);
    }
}

Worker.defaults = defaults;

module.exports = Worker;