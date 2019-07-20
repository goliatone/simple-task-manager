'use strict';

const test = require('tape');
const sinon = require('sinon');

const createClient = require('../lib/createClient');

test('Lib exports createClient', t => {
    t.ok(createClient, 'Exports create client');
    t.end();
});

test('createClient offers a redis and a memory backend', t => {
    t.ok(createClient.redis, 'has redis backend');
    t.ok(createClient.memory, 'has memory backend');
    t.end();
});

test('createClient, redis: we can use path', t => {
    const options = {
        transport: 'redis',
        path: 'redis://localhost',
        redisOptions: { _a_: 1 }
    };

    const client = {};
    const redis = {
        createClient: function(path, redisOptions) {
            t.equals(path, options.path, 'createClient should be called with path');
            t.deepEqual(redisOptions, options.redisOptions, 'createClient should be called with options');
            return client;
        }
    };

    options.redis = redis;

    let response = createClient(options);
    t.equals(response, client, 'createClient should return client');
    t.end();
});

test('createClient, redis: we can use host and port', t => {
    const options = {
        transport: 'redis',
        port: 333,
        host: 'localhost',
        redisOptions: { _a_: 1 }
    };

    const client = {};
    const redis = {
        createClient: function(port, host, redisOptions) {
            t.equals(port, options.port, 'createClient should be called with port');
            t.equals(host, options.host, 'createClient should be called with host');
            t.deepEqual(redisOptions, options.redisOptions, 'createClient should be called with options');
            return client;
        }
    };

    options.redis = redis;

    let response = createClient(options);
    t.equals(response, client, 'createClient should return client');
    t.end();
});

test('createClient, redis: should call auth if password present', t => {
    const options = {
        transport: 'redis',
        port: 333,
        host: 'localhost',
        password: 'password',
        redisOptions: { _a_: 1 }
    };

    const client = {
        auth: function(password) {
            t.equals(password, options.password, 'should be called with password');
        }
    };

    const redis = {
        createClient: function() {
            return client;
        }
    };

    options.redis = redis;

    let response = createClient(options);
    t.equals(response, client, 'createClient should return client');
    t.end();
});

test('createClient, redis: should call select if db present', t => {
    const options = {
        transport: 'redis',
        port: 333,
        host: 'localhost',
        db: 0,
        redisOptions: { _a_: 1 }
    };

    const client = {
        db: function(db) {
            t.equals(db, options.db, 'should be called with db');
        }
    };

    const redis = {
        createClient: function() {
            return client;
        }
    };

    options.redis = redis;

    let response = createClient(options);
    t.equals(response, client, 'createClient should return client');
    t.end();
});