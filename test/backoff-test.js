'use strict';
const test = require('tape');
const extend = require('gextend');
const BackOff = require('../lib').BackOff;

const defaults = extend({}, BackOff.options);

test('BackOff has defaults', t => {
    t.ok(BackOff.options, 'Has defaults');
    t.end();
});

test('BackOff: will compute the same value for a given step if jitter is false', t => {
    reset();
    BackOff.options.jitter = false;
    t.equals(BackOff.compute(3), BackOff.compute(3), 'Same step');
    t.end();
});

test('BackOff: compute takes an options object that can override defaults', t => {
    reset();
    const options = { jitter: false };
    t.equals(BackOff.compute(3, options), BackOff.compute(3, options), 'Same step');
    t.end();
});

test('BackOff: each step is incremental', t => {
    reset();
    t.ok(BackOff.compute(1) < BackOff.compute(2) < BackOff.compute(3) < BackOff.compute(4) < BackOff.compute(5) < BackOff.compute(6), 'Should be greater');
    t.end();
});

test('BackOff: once we reach the maxDelay all steps return the same value', t => {
    reset();
    BackOff.options.jitter = false;
    BackOff.options.minDelay = 900;
    BackOff.options.maxDelay = 1000;

    t.equals(BackOff.compute(2), 1000, 'Should be maxDelay');
    t.equals(BackOff.compute(7), 1000, 'Should be maxDelay');
    t.equals(BackOff.compute(30), 1000, 'Should be maxDelay');

    t.end();
});

test('BackOff: jitter will return different values for the same step', t => {
    reset();
    t.notEquals(BackOff.compute(2), BackOff.compute(2), 'Should different');
    t.end();
});

test('BackOff: jitter will return N1 < N2', t => {
    reset();
    t.ok(BackOff.compute(1) < BackOff.compute(2), 'Should return N1 < N2');
    t.end();
});

test('BackOff: jitter will return N1 < N2', t => {
    reset();
    BackOff.options.jitter = false;
    BackOff.options.minDelay = 9;
    BackOff.options.maxDelay = 1000;

    t.equals(BackOff.compute(1), 9, 'min === minDelay');
    t.equals(BackOff.compute(100000), 1000, 'max === maxDelay');
    t.end();
});

test('BackOff: execute should call our callback after N delay', t => {
    reset();
    BackOff.options.jitter = false;
    BackOff.options.minDelay = 100;

    const delay = BackOff.compute(1);

    BackOff.setTimeout = function(cb, ttl) {
        t.equals(delay, ttl, 'callback should be called after delay');
        cb();
    };

    BackOff.execute(1, _ => {
        t.ok(true, 'callback called');
        t.end();
    });
});


function reset() {
    BackOff.options = extend({}, defaults);
}