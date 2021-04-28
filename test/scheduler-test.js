'use strict';

const test = require('tape');
const sinon = require('sinon');
const redis = require('redis-mock');

const createBackend = _ => {
    return redis.createClient();
}

const Scheduler = require('../lib').Scheduler;

test('Scheduler has defaults', t => {
    t.ok(Scheduler.defaults, 'Has defaults');
    t.end();
});

test('Scheduler can add new tasks', async t => {
    const scheduler = new Scheduler({
        autoinitialize: true,
        backend: createBackend(),
    });

    await scheduler.addTask({
        id: 'a'
    });

    t.end();
});

test.skip('Scheduler can add remove tasks', t => {
    const scheduler = new Scheduler({
        autoinitialize: true,
        backend: createBackend(),
    });

    scheduler.remove({
        id: 'a'
    });

    t.end();
});