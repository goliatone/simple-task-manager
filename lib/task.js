'use strict';

const extend = require('gextend');

const STATE = {
    delayed: 'delayed',
    completed: 'completed',
    enqueued: 'enqueued',
    failed: 'failed'
};

const defaults = {
    /**
     * Number of times the task has run successfully
     */
    runs: 0,

    /**
     * 
     */
    schedule: 0,

    /**
     * valid attributes are:
     * startDate
     * endDate
     * utc: true
     */
    scheduleOptions: { utc: true },

    /**
     * What should be the default
     * expire time?
     */
    expire: 0,
    /**
     * Number of times the task should run.
     * Note: Infinity is not JSON serializable
     */
    maxRuns: 1,
    /**
     * Number of times we will try to
     * execute a failed task. After `maxTries`
     * we give up and store the task in failed
     * queue.
     * 
     * Note: Infinity is not JSON serializable
     */
    maxTries: 4,
    /**
     * How many consecutive errors
     * has this task had?
     * Reset after a successful run.
     * TODO: rename maybe to consecutiveErrors
     */
    errorCount: 0,
    /**
     * Total times the task has failed.
     */
    totalErrors: 0,

    /**
     * How many errors do we want 
     * to keep around? It will save on
     * size.
     */
    maxErrorsLength: 20,

    logger: extend.shim(console),
    /**
     * Function to handle back off
     * between retries.
     */
    backOff: require('./backoff'),
    /**
     * We use the queue to partition
     * our jobs.
     */
    queue: 'tasks',
    /**
     * Prefix added to build the 
     * `task.key` attribute which 
     * is a composition of the `keyPrefix`
     * and the `id` value:
     * `${keyPrefix}:${id}`
     */
    keyPrefix: 'tasks',

    /**
     * List of serializable fields.
     */
    _fields: [
        'id',
        'key',
        'queue',
        'data',
        'runs',
        'status',
        'schedule',
        'scheduleOptions',
        'expire',
        'errors',
        'errorCount',
        'totalErrors',
        'maxRuns',
        'maxTries',
        'firstRun',
        'lastRun',
        'executionTime',
        'executionAverage',
    ],
    /**
     * Serialize/deserializer for our tasks.
     */
    _parserJSON: require('./parsers/json'),
    _errorSerializer: function(error) {
        if (error.toJSON) return error.toJSON();
        return {
            code: error.code || 599,
            message: error.message || 'Unknown Error'
        };
    },
    _parserSchedule: require('./parsers/schedule'),
};

/**
 * Task class holds information about 
 * our execution plan.
 * 
 * When a Task instance is stored in 
 * two data structures in redis:
 * 
 * - id: Holds a serialized task
 * - expiration key: We set a key with 
 * an TTL that holds a reference to the
 * serialized task. 
 * 
 * The expiration key works as a trigger
 * event, meaning that our task executes
 * on each expiration.
 */
class Task {
    constructor(config = {}) {

        config = extend({}, this.constructor.defaults, config);

        this.init(config);
    }

    init(config = {}) {
        if (this.initialized) return;
        this.initialized = true;

        extend(this, config);

        /**
         * If we were initialized with a serialized
         * task we hydrate ourselves...
         */
        if (config.serializedTask) {
            this.deserialize(config.serializedTask);
            delete this.serializedTask;
        }
    }

    /**
     * This function should determine if this
     * task should run in a given scenario.
     * 
     * @param {String} stage State identifier
     * @param {Object} options Options for handler
     * @returns {Object} 
     */
    updateState(stage, options = {}) {
        //TODO: We should check stage is one of error|commit.

        const handlers = {};

        /**
         * options could provide an error
         * object which we could use to 
         * determine if the error should
         * be retried.
         * 
         * If we return `true` we should
         * enqueue the task again.
         */
        handlers.error = (task, options = { error: {} }) => {
            //if options.error.fatal task.status = fail
            if (task.errorCount < task.maxTries) {
                task.status = STATE.delayed;

                /**
                 * TODO: Check back off ttl is lower than next ttl if we have one
                 */
                task.ttl = task.backOff.compute(task.errorCount, options);

            } else task.status = STATE.failed;

            return task;
        };

        handlers.join = (task, options = {}) => {

        };

        handlers.commit = (task, options = {}) => {
            task.status = STATE.enqueued;

            /**
             * If we are over our allocated runs or if 
             * we don
             */
            if (task.runs >= task.maxRuns) {
                task.status = STATE.completed;
            } else if (task.ttl > 0) {
                task.status = STATE.delayed;
            } else if (options.jitter) {
                // task.ttl = getJitter(options)
            }

            return task;
        };

        return handlers[stage](this, options);
    }

    complete(successful = true) {
        /**
         * Keep track of:
         * - First time it ran
         * - Last time it ran
         * - Start time used  to compute execution time.
         */
        if (!this.executionStart) this.executionStart = Date.now();

        if (!this.firstRun) this.firstRun = this.executionStart;


        this.executionTime = Date.now() - this.executionStart;

        if (successful) {
            this.runs++;
            this.errorCount = 0;
            //TODO: Should executionAverage take in account errors?
            this.executionAverage = ((this.executionAverage || 0) + this.executionTime) / this.runs;
        }

        return this;
    }

    fail(error) {

        this.errorCount++;
        this.totalErrors++;

        this.errors.push(this._errorSerializer(error));

        while (this.maxErrorsLength && this.errors.length > this.maxErrorsLength) {
            this.errors.shift();
        }

        return this;
    }

    /**
     * Populate task values from JSON
     * object.
     * 
     * @param {Object} data Task JSON object
     */
    fromJSON(data) {
        data = this._toJSON(data);

        if (data.maxRuns === -1) data.maxRuns = Infinity;
        if (data.maxTries === -1) data.maxTries = Infinity;

        extend(this, data);

        return this;
    }

    /**
     * 
     * @returns {Object} JSON representation
     */
    toJSON() {
        let out = this._toJSON(this);
        if (this.maxRuns === Infinity) out.maxRuns = -1;
        if (this.maxTries === Infinity) out.maxTries = -1;

        if (this.scheduleOptions) {
            this.scheduleOptions = this._parserSchedule.serializeOptions(this.scheduleOptions);
        }

        return out;
    }

    /**
     * Returns a string representation
     * of this Task
     * TODO: This should also handle errors like deserialize
     * @returns {String}
     */
    serialize() {
        let out = this.toJSON();
        return this._parserJSON.serialize(out);
    }

    /**
     * Given a string result a serialize
     * operation we can then hydrate a 
     * task from it.
     * 
     * ! This swallows errors. Check how to handle
     * 
     * @param {String} data 
     * @returns {Task}
     */
    deserialize(data) {
        let [err, obj] = this._parserJSON.deserialize(data);

        if (err) {
            this.errors.push(err);
            return this;
        }

        this.fromJSON(obj);
        return this;
    }

    set id(value) {
        this._id = value;
    }

    get id() {
        return this._id;
    }

    set ttl(value) {
        //TODO: how to handle case where we explicitly set backOff value?
        this._explicitTtl = true;
        this.expire = value;
    }

    //TODO: maybe we should add a computeTTL method to make it explicit
    get ttl() {
        if (this._explicitTtl) return this.expire;

        if (this.schedule) {
            let schedule = this._parserSchedule.computeNextExecution(this);
            console.log('\t\t\t\t Next RUN', schedule.time, schedule.ttl);
            return schedule.ttl || 0;
        }

        return this.expire || 0;
    }

    /**
     * Value used to index an entry with 
     * a TTL set. 
     * @see Task.ttl
     */
    get ttlKey() {
        return `${this.key}:ttl`;
    }

    /**
     * This enable use to do some logic around
     * what operation we want to perform, in theory
     * we could change units (EX vs PX) or use a different
     * operation like EXAT/PXAT etc.
     * 
     * @return {String}
     */
    get ttlOp() {
        return 'PX';
    }

    /**
     * Value used to index the serialized task
     * in our backend.
     */
    get key() {
        return `${this.keyPrefix}:${this._id}`;
    }

    get errors() {
        if (!this._errors) this._errors = [];
        return this._errors;
    }

    set errors(value) {
        //TODO: We might want to have a max number of errors...
        if (!this._errors) this._errors = [];
        if (Array.isArray(value)) this._errors = this._errors.concat(value);
        else this._errors = [value];
    }

    _toJSON(obj = {}) {
        let out = {};
        this._fields.map(field => out[field] = obj[field]);
        return out;
    }
}

Task.STATE = STATE;

Task.defaults = defaults;

module.exports = Task;