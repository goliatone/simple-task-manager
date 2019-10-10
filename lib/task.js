'use strict';

const extend = require('gextend');

const defaults = {
    runs: 0,
    //What should be the default expire time?
    expire: 0,

    maxRuns: 1, //Infinity is not JSON serializable
    maxTries: 4, //Infinity is not JSON serializable

    errorCount: 0,
    totalErrors: 0,

    /**
     * How many errors do we want 
     * to keep around? It will save on
     * size.
     */
    maxErrorsLength: 20,

    logger: console,
    backoff: require('./backoff'),
    /**
     * We use the queue to partition
     * our jobs.
     */
    queue: 'tasks',
    _fields: [
        'id',
        'key',
        'queue',
        'data',
        'runs',
        'executionTime',
        'expire',
        'errors',
        'errorCount',
        'totalErrors',
        'maxRuns',
        'maxTries',
        'firstRun',
        'lastRun',
    ],
    _parser: require('./parsers/json')
};

/**
 * Task class holds information about 
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
            const serializedTask = config.serializedTask;
            this.deserialize(serializedTask);
            delete this.serializedTask;
        }
    }

    /**
     * This function should determine if this
     * task should run in a given scenario.
     * 
     * @param {String} step State identifier
     * @param {Object} options Options for handler
     * @returns {Object} 
     */
    shouldRun(step, options = {}) {
        const handlers = {};

        // if(Date.now() < task.runBefore){}
        /**
         * options could provide an error
         * object which we could use to 
         * determine if the error should
         * be retried.
         * 
         * If we return `true` we should
         * enqueue the task again.
         */
        handlers.error = (options = {}) => {
            let state = {};

            //if options.error.fatal state.action = fail
            if (this.errorCount < this.maxTries) {
                // state.action = 'enqueue';
                state.action = 'delay';
                /**
                 * exponential backoff
                 */
                state.ttl = this.backoff.compute(this.errorCount, options);
                // state.ttl = 2000;
            } else state.action = 'fail';

            return state;
        };

        handlers.commit = (options = {}) => {
            let state = {};

            /**
             * If we are over our allocated runs or if 
             * we don
             */
            if (this.runs >= this.maxRuns) {
                state.action = 'complete';
            } else if (this.ttl > 0) {
                state.action = 'delay';
                state.ttl = this.ttl;
            } else {
                state.action = 'enqueue';
            }

            return state;
        };

        return handlers[step](options);
    }

    fail(error) {

        this.errorCount++;
        this.totalErrors++;

        if (error.toJSON) {
            this.errors.push(error.toJSON());
        } else {
            this.errors.push({
                code: error.code,
                message: error.message
            });
        }

        while (this.maxErrorsLength && this.errors.length > this.maxErrorsLength) {
            this.errors.shift();
        }
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
        return out;
    }

    /**
     * Returns a string representation
     * of this Task
     * @returns {String}
     */
    serialize() {
        let out = this.toJSON();
        return this._parser.serialize(out);
    }

    /**
     * Given a string result a serialize
     * operation we can then hidrate a 
     * task from it.
     * 
     * ! This swallows errors. Check how to handle
     * 
     * @param {String} data 
     * @returns {Task}
     */
    deserialize(data) {
        let [err, obj] = this._parser.deserialize(data);

        if (err) {
            this.errors.push(err);
            return this;
        }

        this.fromJSON(obj);
        return this;
    }

    set id(value) {
        this._id = value;
        this.key = `tasks:${value}`;
    }

    get id() {
        return this._id;
    }

    set ttl(value) {
        this.expire = value;
    }

    get ttl() {
        if (this.expire instanceof Date) {
            //This is destructive, we could just return 
            // return this.expire.getTime() - Date.now();
            this.expire = this.expire.getTime() - Date.now();
        }

        return this.expire;
    }

    get ttlKey() {
        return `${this.key}:ttl`;
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

Task.defaults = defaults;

module.exports = Task;