'use strict';
const test = require('tape');
const extend = require('gextend');
const Backoff = require('../lib').Backoff;

const defaults = extend({}, Backoff.options);

test('Backoff has defaults', t => {
    t.ok(Backoff.options, 'Has defaults');
    t.end();
});

test('Backoff: will compute the same value for a given step if jitter is false', t => {
    reset();
    Backoff.options.jitter = false;
    t.equals(Backoff.compute(3), Backoff.compute(3), 'Same step');
    t.end();
});

test('Backoff: compute takes an options object that can override defaults', t => {
    reset();
    const options = { jitter: false };
    t.equals(Backoff.compute(3, options), Backoff.compute(3, options), 'Same step');
    t.end();
});

test('Backoff: each step is incremental', t => {
    reset();
    t.ok(Backoff.compute(1) < Backoff.compute(2) < Backoff.compute(3) < Backoff.compute(4) < Backoff.compute(5) < Backoff.compute(6), 'Should be greater');
    t.end();
});

test('Backoff: once we reach the maxDelay all steps return the same value', t => {
    reset();
    Backoff.options.jitter = false;
    Backoff.options.minDelay = 900;
    Backoff.options.maxDelay = 1000;

    t.equals(Backoff.compute(2), 1000, 'Should be maxDelay');
    t.equals(Backoff.compute(7), 1000, 'Should be maxDelay');
    t.equals(Backoff.compute(30), 1000, 'Should be maxDelay');

    t.end();
});

test('Backoff: jitter will return different values for the same step', t => {
    reset();
    t.notEquals(Backoff.compute(2), Backoff.compute(2), 'Should different');
    t.end();
});

test('Backoff: jitter will return N1 < N2', t => {
    reset();
    t.ok(Backoff.compute(1) < Backoff.compute(2), 'Should return N1 < N2');
    t.end();
});

test('Backoff: jitter will return N1 < N2', t => {
    reset();
    Backoff.options.jitter = false;
    Backoff.options.minDelay = 9;
    Backoff.options.maxDelay = 1000;

    t.equals(Backoff.compute(1), 9, 'min === minDelay');
    t.equals(Backoff.compute(100000), 1000, 'max === maxDelay');
    t.end();
});

test('Backoff: execute should call our callback after N delay', t => {
    reset();
    Backoff.options.jitter = false;
    Backoff.options.minDelay = 100;

    const delay = Backoff.compute(1);

    Backoff.setTimeout = function(cb, ttl) {
        t.equals(delay, ttl, 'callback should be called after delay');
        cb();
    };

    Backoff.execute(1, _ => {
        t.ok(true, 'callback called');
        t.end();
    });
});


function reset() {
    Backoff.options = extend({}, defaults);
}