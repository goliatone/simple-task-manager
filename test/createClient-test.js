'use strict';

const test = require('tape');
const sinon = require('sinon');

const createClient = require('../lib/createClient');

test('Task has defaults', t => {
    t.ok(createClient, 'Has defaults');
    t.end();
});