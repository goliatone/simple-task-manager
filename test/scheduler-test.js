'use strict';

const test = require('tape');
const sinon = require('sinon');
const redis = require('redis-mock');

const Scheduler = require('../lib').Scheduler;

test('Task has defaults', t => {
    t.ok(Scheduler.defaults, 'Has defaults');
    t.end();
});