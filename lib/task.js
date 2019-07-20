'use strict';

const extend = require('gextend');

const defaults = {
    runs: 0,
    logger: console,
    reschedule: true,
    /**
     * We use the queue to partition
     * our jobs.
     */
    queue: 'default',
    _fields: [
        'id',
        'key',
        'queue',
        'data',
        'runs',
        'repeat',
        'expire',
        'pattern',
        'reschedule'
    ],
    _parser: {
        serialize: JSON.stringify,
        deserialize: JSON.parse
    }
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
         * task we hidrate ourselfs...
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
     * @param {String} data 
     * @returns {Task}
     */
    deserialize(data) {
        let obj = this._parser.deserialize(data);
        this.fromJSON(obj);
        return this;
    }

    /**
     * This is an upsert method that we
     * call when we boot our program. 
     *  
     * @returns {Promise}
     */
    createIfNew() {
        return new Promise((resolve, reject) => {

            const _responder = (err, res) => {
                if (err) reject(err);
                else resolve(this);
            };

            const { key, id, client, ttl } = this;
            console.log('key "%s" id "%s" ttl "%s"', key, id, ttl);

            const ttlKey = `${key}:ttl`;

            client.exists(ttlKey, (err, exists) => {
                if (err) return reject(err);

                if (exists) {
                    this.logger.info('† SET TTL %s %s', ttlKey, ttl);
                    this.exists = exists;
                    client.pexpire(ttlKey, ttl, _responder);
                } else {
                    this.logger.info('+ SET TTL %s %s', ttlKey, ttl);
                    client.multi()
                        .set(key, this.serialize())
                        .set(ttlKey, key, 'PX', ttl)
                        .exec(_responder);
                }
            });
        });
    }

    /**
     * We call this function when we are done
     * processing a task.
     * 
     * @param {Date} ttl Time to live
     * @param {Integer} ttl Time to live
     * @returns {Promise}
     */
    commit(ttl) {
        if (!isNaN(ttl)) {
            this.logger.info('TTL: %s', ttl);
            this.ttl = ttl;
        }
        /**
         * Keep track of how many time we ran
         */
        this.runs++;

        //TODO: check if we have threshold for maxRuns
        //TODO: we should store result somewhere and keep a run id

        return new Promise((resolve, reject) => {

            const _responder = (err, res) => {
                if (err) reject(err);
                else resolve(this);
            };

            const { key, id, client, ttl } = this;
            const ttlKey = `${key}:ttl`;

            this.logger.info('+ SET TTL %s %s', ttlKey, ttl);

            client.multi()
                .set(key, this.serialize())
                .set(ttlKey, key, 'PX', ttl)
                .exec(_responder);
        });
    }

    set id(value) {
        this._id = value;
        this.key = `scheduler:tasks:${value}`;
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

    _toJSON(obj = {}) {
        let out = {};
        this._fields.map(field => out[field] = obj[field]);
        return out;
    }
}

Task.defaults = defaults;

module.exports = Task;