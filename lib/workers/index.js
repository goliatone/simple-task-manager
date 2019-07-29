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

            task.start = Date.now();

            //Right now is a single job per queue, is that ok?
            await job(task);

            //* NOTE: We are not using `task.queue`
            await this.client.commit(task, this.queue);

            this.logger.info('task %s finalized running', task.id);

            this.emit('task.ran', task);

        } catch (error) {
            this.errors++;

            await this.client
                .handleError(task, error, this.queue)
                .catch(error => {
                    //TODO: We should actually try to do something here
                    // this.logger.error(error);
                    process.exit(1);
                });
        }

        /**
         * We enter the loop again to catch 
         * the next task
         */
        this.run(job);
    }

    // fail(task, error) {
    //     this.logger.error('Task error', error);
    //     this.emit('task.error', task);
    //     this.client.fail(task, error);
    // }
}

Worker.defaults = defaults;

module.exports = Worker;