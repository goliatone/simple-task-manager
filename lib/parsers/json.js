'use strict';

module.exports = {
    serialize: JSON.stringify,
    /**
     * We might want to deserialize using go
     * format in return [err, result]
     */
    deserialize(str) {
        try {
            return [null, JSON.parse(str)];
        } catch (err) {
            return [err];
        }
    },
    isSerialized(str) {
        if (typeof str !== 'string') return false;
        try {
            const result = JSON.parse(str);
            return Object.prototype.toString.call(result) === '[object Object]' ||
                Array.isArray(result);
        } catch (err) {
            return false;
        }
    }
};