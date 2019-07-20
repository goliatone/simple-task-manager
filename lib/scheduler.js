'use strict';
const EventEmitter = require('events');
const extend = require('gextend');
const noploger = require('noop-console');
const Task = require('./task');

const defaults = {
    logger: noploger.logger(),
    clientFactory: require('./createClient'),
    clientOptions: {
        type: 'redis'
    }
};

/**
 * Scheduler should handle the lifecycle of tasks.
 * - It will create new tasks.
 * - It will listen for expired tasks.
 *   - A task has a timeoutValue
 * - It will listen for completed tasks
 *   - A task can be recurrent
 *   - A task can have a max number of runs
 * 
 * Scheduler should emit a task.complte event
 * Scheduler should emit a task.error event
 * Scheduler should emit a task.timeout event
 */
class Scheduler extends EventEmitter {

    constructor(config = {}) {
        super();
        config = extend({}, this.constructor.defaults, config);
        this.init(config);
    }

    async init(config = {}) {
        if (this.initialized) return;
        this.initialized = true;

        /**
         * This is the redis key we will be watching
         * to see when we have new sources.
         * This is a set of IDs
         */
        this.watchedKey = 'waterline:service:id';

        /**
         * What is the channel for expired events?
         * Note that 0 should match our client db
         * value.
         */
        this.expiredKeyEvents = '__keyevent@0__:expired';

        // this.resourceRegex = /^waterline:service:id:(\w+)$/;
        // this.resourceRegex = new RegExp(`^${this.watchedKey}:(\\w+)$`);

        this.triggerKeys = `${this.watchedKey}:*`;
        this.taskEvents = `__key*__:${this.watchedKey}:*`;

        extend(this, config);

        /**
         * We use the client to execute normal key commands
         */
        this.client = this.clientFactory(this.clientOptions);

        /**
         * We use pubsub to listen to events
         */
        this.pubsub = this.clientFactory(this.clientOptions);

        this.subscribeToKeyEvents();
    }

    add(task) {
        if (!task.client) task.client = this.client;
    }

    /**
     * Register redis event listeners for
     * expired keys and updates on any
     * `watchedKey`
     */
    subscribeToKeyEvents() {

        /**
         * psubscribe uses a regexp key to match
         * any events matching the key.
         * In our case we listen to all events 
         * from our source events.
         */
        this.pubsub.psubscribe(this.taskEvents);
        this.pubsub.subscribe(this.expiredKeyEvents);

        this.pubsub.on('pmessage', (channel, message) => {
            //Service -> our Source entity
            console.log('+ pmessage', channel, message);
            this.onSourceKeyEvent(channel, message);
        });

        this.pubsub.on('message', (channel, message) => {
            console.log('- Expired notification:', channel, message);
            this.onTaskExpired(channel, message);
        });
    }

    /**
     * Redis pub/sub handler.
     * This gets fired every time a task key
     * expires.
     * We use it to filter out keys to handle
     * only TTLs for the right key: scheduler:task 
     * 
     * @param {String} channel Event channel
     * @param {String} message Event message
     * @emits Scheduler#task.execute
     */
    onTaskExpired(channel, message) {
        const taskId = this._getTaskId(message);

        if (!taskId) {
            return this.logger.info('ignoring expiration message', taskId);
        }
        const { client } = this;

        client.get(taskId, (err, serializedTask) => {
            if (err) {
                return this.logger.error('Error getting task: %s', taskId, err);
            }

            const task = new Task({
                serializedTask,
                client
            });

            /**
             * This will notify of a new task.
             * @event Scheduler#task.execute
             * @type {Object}
             * @property {Task} task - Current task to execute
             */
            this.emit('task.execute', { task });
        });
    }

    /**
     * Triggered by redis pattern key events.
     * We relate a entity source key 
     * (e.g. waterline:service:id) to a task
     * id (scheduler:task:id).
     * 
     * If we updated our source entity we update
     * our corresponding task.
     * 
     * If we created a new source entity or the
     * service did not have a task we create a 
     * new task.
     * 
     * @param {String} channel Event channel
     * @param {String} message Event message
     * @emits Scheduler#task.created
     */
    onSourceKeyEvent(channel, message) {
        /**
         * this transforms our key:
         * waterline:service:id to scheduler:task:id
         */
        const id = this._getIdFromMessage(message);

        //TODO: Source -> Entity? Payload?
        this.createTaskFromSource(id).then(task => {
            if (!task || !task.id) return;

            /**
             * This will notify of an updated task.
             * @event Scheduler#task.created
             * @type {Object}
             * @property {Task} task - Current task to execute
             * @property {String} action - Action created|evented
             */
            this.emit('task.created', {
                task,
                action: 'evented'
            });
        });
    }

    /**
     * This method enables us to pick up all 
     * sources defined before our service is
     * run.
     * 
     * A source is a Job description. This is
     * the record we create and persist and
     * tasks will use as data to configure
     * it's execution and to provide context
     * to the worker.
     */
    loadAllSources() {
        this.client.keys(this.triggerKeys, (err, sources = []) => {
            this.startTaskFromSources(sources);
        });
    }

    //TODO: Refactor to load tasks instead of **services**
    startTaskFromSources(sources = []) {
        // sources.map(source => {
        // for (let source of sources) {
        for (let i = 0; i < sources.length; i++) {
            let source = sources[i];
            //     console.log('source', source);

            const taskId = this._makeTaskIdFromRecord(source);
            console.log('taskId', taskId);
            /**
             * Retrieve our serialized task for the given source id:
             * scheduler:task:6
             */
            this.client.get(taskId, async(err, serializedTask) => {
                console.log('got', taskId);
                if (err) return this.logger.error('Error getting task:', err);
                /**
                 * If we don't have a task for the source 
                 * we create a new one.
                 */
                if (!serializedTask) {
                    this.logger.info('This source "%s does not have a task. Create it', id);
                    return this.createTaskFromSource(source).then(task => {

                        if (task && task.id) {
                            /**
                             * This will notify of an updated task.
                             * @event Scheduler#task.created
                             * @type {Object}
                             * @property {Task} task - Current task to execute
                             */
                            this.emit('task.created', {
                                task,
                                action: 'created'
                            });
                        }
                    });
                }

                console.log('we have serialized task');

                let task = new Task({
                    serializedTask,
                    client: this.client
                });

                try {
                    await task.createIfNew();
                } catch (error) {
                    this.logger.error('Error creating task', error);
                }
                console.log('create from serialized task', task.id);
                this.emit('task.created', { task, action: 'deserialized' });
            });
            // });
        }
    }

    //Source -> job? source/service is our definition that will 
    //trigger a task. 
    createTaskFromSource(taskId) {
        console.log('creating task from source....');
        return new Promise((resolve, reject) => {
            this.client.get(taskId, async(err, source) => {
                if (err) return reject(err);
                if (!source) return resolve({ found: false, id: taskId });

                //TODO: This should be externalized!
                source = JSON.parse(source);

                let task = new Task({
                    client: this.client,
                    data: source,
                    id: source.id,
                    ttl: source.interval
                });

                try {
                    await task.createIfNew();
                } catch (err) {
                    return reject(err);
                }

                resolve(task);
            })
        });
    }

    /**
     * Our redis setup needs to be configured
     * with support for notify-keyspace-events.
     * If it's not configured and we don't check
     * our app would not fail but we would not 
     * get any events.
     * 
     * @throws {Error}
     */
    checkClientConfiguration() {
        return new Promise((resolve, reject) => {
            this.client.config('get', 'notify-keyspace-events', (err, res) => {
                if (err) return reject(err);

                const [key, value] = res;

                /**
                 * This are the key values that satisfy
                 * our setup...
                 */
                if (value === 'AKE') return resolve(true);
                if (value === 'g$lshzxe') return resolve(true);
                if (value === 'xKE') return resolve(true);

                reject(new Error(`Redis misconfigured: ${value}`));
            });
        });
    }

    _getIdFromMessage(message) {
        //TODO: make regexp and 0 -> \d
        return message.replace('__keyspace@0__:', '');
    }

    _getTaskId(message) {
        const match = message.match(/^(scheduler:tasks:.+):ttl$/);
        if (!match) return false;
        return match[1];
    }

    _makeTaskIdFromRecord(message) {
        //TODO: replace with service, replace waterline with scheduler
        const match = message.match(/^waterline:service:id:(.+)$/);
        const id = match[1];
        return `scheduler:tasks:${id}`;
    }

    /**
     * Utility method to create and check
     * if redis is configured properly.
     * 
     * @param {Object} config Config object
     * @returns {Scheduler}
     * @static
     * @throws {Error} Will throw if redis not
     * configured properly
     */
    static async create(config) {
        const scheduler = new Scheduler(config);
        await scheduler.checkClientConfiguration();
        return scheduler;
    }
}

Scheduler.defaults = defaults;

module.exports = Scheduler;