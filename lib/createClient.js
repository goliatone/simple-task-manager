'use strict';
const extend = require('gextend');

const redisDefaults = {
    db: 0,
    port: 6379,
    host: 'localhost',
    redis: require('redis')
};

function createRedisClient(options = {}, defaults = redisDefaults) {
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

function createMemoryClient(options = {}, defaults = memoryDefaults) {}


function createClient(options = {}) {
    const { type = 'redis' } = options;

    const impl = module.exports[type] || module.exports.memory;

    return impl.createClient(options, impl.defaults);
}

module.exports = createClient;
module.exports.createRedisClient = createRedisClient;
module.exports.createMemoryClient = createMemoryClient;

module.exports.redis = {
    defaults: redisDefaults,
    createClient: module.exports.createRedisClient
};

module.exports.memory = {
    defaults: memoryDefaults,
    createClient: module.exports.createMemoryClient
};