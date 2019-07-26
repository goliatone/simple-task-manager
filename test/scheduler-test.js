'use strict';

const test = require('tape');
const sinon = require('sinon');
const redis = require('redis-mock');

const clientFactory = _ => {
    return redis.createClient();
}

const Scheduler = require('../lib').Scheduler;

test('Scheduler has defaults', t => {
    t.ok(Scheduler.defaults, 'Has defaults');
    t.end();
});

test('Scheduler _isTaskId can match the right id format', t => {
    const scheduler = new Scheduler({
        autoinitialize: false
    });
    t.ok(scheduler._isTaskId('scheduler:tasks:task01'));
    t.ok(scheduler._isTaskId('scheduler:tasks:ac8c7416-4144-40d3-a8d2-b3f1b454c10c'));
    t.notOk(scheduler._isTaskId('scheduler:tasks:ac8c7416-4144-40d3-a8d2-b3f1b454c10c:ttl'));
    t.notOk(scheduler._isTaskId('scheduler:tasks:task01:ttl'));
    t.end();
});

test('Scheduler _getTaskIdFromExpireKey can get a task id from an expired key', t => {
    const scheduler = new Scheduler({
        autoinitialize: false
    });
    const key = 'scheduler:tasks:ac8c7416-4144-40d3-a8d2-b3f1b454c10c:ttl';
    const expected = 'scheduler:tasks:ac8c7416-4144-40d3-a8d2-b3f1b454c10c';
    t.equals(scheduler._getTaskIdFromExpireKey(key), expected);
    t.end();
});

test('Scheduler can add new tasks', t => {
    const scheduler = new Scheduler({
        autoinitialize: true,
        clientFactory,
    });

    scheduler.add({

    });
    t.end();
});

test('Scheduler can add remove tasks', t => {
    const scheduler = new Scheduler({
        autoinitialize: true,
        clientFactory,
    });

    scheduler.remove({
        id: 'a'
    });

    t.end();
});