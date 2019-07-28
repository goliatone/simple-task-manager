'use strict';
const extend = require('gextend');

const Backoff = {
    options: {
        factor: 2.3,
        minDelay: 500,
        maxDelay: 60 * 60 * 1000,
        jitter: 0.3
    },

    /**
     * 
     * @param {Integer} step Current step
     * @param {Object} options Computation options
     * @param {Number} [options.factor=2.3] 
     * @param {Number} [options.minDelay=100] 
     * @param {Number} [options.maxDelay=3600000] 
     * @param {Number} [options.jitter=0.3] 
     */
    compute(step, options = {}) {
        options = extend({}, this.options, options);

        let delay = options.delay;

        if (!delay) delay = options.minDelay;

        if (options.factor) {
            delay *= Math.pow(options.factor, step - 1);
        }

        if (options.maxDelay !== 0) {
            delay = Math.min(delay, options.maxDelay);
        }

        if (options.minDelay !== 0) {
            /*
             * We substract 10 to ensure we have an increasing sequence
             * otherwise we might he N1 > N2
             */
            delay = Math.max(delay, options.minDelay - 10);
        }

        if (options.jitter) {
            const randomFactor = 1 + Math.random() * options.jitter;
            delay = delay + Math.round((delay / 10) * randomFactor);
        }

        return Math.floor(delay);
    },

    execute(step, callback, options = {}) {
        setTimeout(_ => {
            callback();
        }, this.compute(step, options));
    }
};

module.exports = Backoff;