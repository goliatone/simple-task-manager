'use strict';

const extend = require('gextend');

const defaults = {
    runs: 0,
    //What should be the default expire time?
    expire: 0,

    errorCount: 0,
    totalErrors: 0,

    maxRuns: Infinity,
    maxTries: Infinity,

    logger: console,
    reschedule: true,
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
        'repeat',
        'expire',
        'errors',
        'pattern',
        'errorCount',
        'totalErrors',
        'maxRuns',
        'maxTries',
        'reschedule'
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
     * Populate task values from JSON
     * object.
     * 
     * @param {Object} data Task JSON object
     */
    fromJSON(data) {
        data = this._toJSON(data);
        extend(this, data);
        return this;
    }

    /**
     * 
     * @returns {Object} JSON representation
     */
    toJSON() {
        return this._toJSON(this);
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