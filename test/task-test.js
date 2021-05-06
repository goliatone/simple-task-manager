'use strict';

const test = require('tape');
const Task = require('../lib').Task;

test('Task has defaults', t => {
    t.ok(Task.defaults, 'Has defaults');
    t.end();
});

test('Task is extended with default values', t => {
    const task = new Task();


    function _test(v1, v2, legend) {
        t.equals(v1, v2, legend);
    }
    Object.keys(Task.defaults).map(key => {
        if (key !== '_parser') {
            _test(Task.defaults[key], task[key], `${key} should be set`);
        }
    });
    t.end();
});

test('Task can generate JSON object', t => {
    const expected = {
        id: 1,
        key: 'test',
        runs: 0,
        data: { a: 1 },
        repeat: true,
        expire: Date.now(),
        pattern: 'test',
        reschedule: true,
    };

    const task = new Task(expected);
    t.deepEqual(expected, task.toJSON());
    t.end();
});

test('Task can be hidrated from a JSON object', t => {
    const expected = {
        id: 1,
        key: 'test',
        runs: 0,
        data: { a: 1 },
        repeat: true,
        expire: Date.now(),
        pattern: 'test',
        reschedule: true,
    };

    const task = new Task();
    task.fromJSON(expected);
    t.deepEqual(expected, task.toJSON());
    t.end();
});

test('Task can be serialized', t => {
    const source = {
        id: 1,
        key: 'test',
        runs: 0,
        data: { a: 1 },
        repeat: true,
        expire: Date.now(),
        pattern: 'test',
        reschedule: true,
    };

    const a = new Task(source);
    const b = new Task(source);

    t.deepEqual(a.serialize(), b.serialize());
    t.end();
});

test('Task can be serialized from a serializeTask property', t => {
    const source = {
        id: 1,
        key: 'test',
        runs: 0,
        data: { a: 1 },
        repeat: true,
        expire: Date.now(),
        pattern: 'test',
        reschedule: true,
    };

    const a = new Task(source);
    const b = new Task({ serializeTask: JSON.stringify(source) });

    t.deepEqual(a.serialize(), b.serialize());
    t.end();
});

test('Setting a task id should create its key', t => {
    const task = new Task();

    t.notOk(task.id);
    t.notOk(task.key);

    task.id = 'test';

    t.ok(task.id, 'we should have an id');
    t.ok(task.key, 'we should have a key');

    t.end();
});

test('Infinity will be serialized properly for maxRuns and maxTries', t => {
    const task = new Task({
        maxRuns: Infinity,
        maxTries: Infinity
    });

    const json = task.deserialize(task.serialize());
    t.equals(json.maxRuns, Infinity, 'maxRuns should be Infinity');
    t.equals(json.maxTries, Infinity, 'maxTries should be Infinity');
    t.end();
});

test('updateState: will fail tasks with an errorCount higher than maxTries', t => {
    const task = new Task({
        maxTries: 2,
        errorCount: 3
    });
    const state = task.updateState('error');
    t.equals(state.action, 'fail', 'action should be "fail"');
    t.end();
});

test.only('updateState: will enqueue tasks with an errorCount lower than maxTries', t => {
    const task = new Task({
        maxTries: 3,
        errorCount: 1
    });
    const state = task.updateState('error');
    t.equals(state.action, 'delay', 'action should be "delay"');
    t.end();
});