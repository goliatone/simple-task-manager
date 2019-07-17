'use strict';
const extend = require('gextend');

const redisDefaults = {
    db: 0,
    port: 6379,
    host: 'localhost',
    redis: require('redis')
};

function createRedisClient(options = {}, defaults = {}) {
    let client;

    options = extend({}, defaults, options);

    let {
        db,
        port,
        host,
        path,
        password,
        redisOptions,
        redis
    } = options;

    if (path) {
        client = redis.createClient(path, redisOptions);
    } else {
        client = redis.createClient(port, host, redisOptions);
    }

    if (password) {
        client.auth(password);
    }

    if (db) {
        client.select(db);
    }

    return client;
}

const memoryDefaults = {};

function createMemoryClient(options = {}) {}


function createClient(options = {}) {
    const { transport = 'redis' } = options;

    const impl = module.exports[transport] || module.exports.memory;

    return impl.createClient(options, impl.defaults);
}

module.exports = createClient;

module.exports.redis = {
    defaults: redisDefaults,
    createClient: createRedisClient
};

module.exports.memory = {
    defaults: memoryDefaults,
    createClient: createMemoryClient
};