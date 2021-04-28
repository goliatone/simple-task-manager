'use strict';

const extend = require('gextend');
const Task = require('../task');
const EventEmitter = require('events');

const defaults = {
    runs: 0,
    errors: 0,
    failed: 0,
    queue: 'tasks',
    autoinitialize: true,
    logger: extend.shim(console),
    createBackend(config) {
        const RedisBackend = require('../backends/redis');
        return new RedisBackend(config);
    },
};

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
        this.client.dispatcher = this;
        this.client.on('task.failed', task => {
            this.failed++;
        });
    }

    async run(job) {
        let task;

        try {
            /**
             * Get the current jobId and move it to the active jobs 
             * queue.
             */
            task = await this.client.waitForTask(this.queue);

            //NOTE: some events are dispatched from backend client using worker as dispatcher
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

            /**
             * `job` is a function that handles all tasks
             * for this queue.
             */
            await job(task);

            //* NOTE: We are not using `task.queue`
            await this.client.commit(task, this.queue);

            this.logger.info('task %s finalized running', task.id);

            this.emit('task.ran', task);

        } catch (error) {
            await this.fail(task, error);
        }

        /**
         * We enter the loop again to catch 
         * the next task
         */
        this.run(job);
    }

    fail(task, error) {
        this.errors++;

        this.logger.error('Task error', error);
        // NOTE: some events are dispatched from backend client using worker as dispatcher
        // this.emit('task.error', task);

        return this.client
            .handleError(task, error, this.queue)
            .catch(error => {
                //TODO: We should actually try to do something here
                // this.logger.error(error);
                process.exit(1);
            });
    }
}

Worker.defaults = defaults;

module.exports = Worker;