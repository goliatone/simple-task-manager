'use strict';

function logger(name) {
    return function $log(...args) {
        let time = new Date();
        time = '[' +
            ('0' + time.getHours()).slice(-2) + ':' +
            ('0' + time.getMinutes()).slice(-2) + ':' +
            ('0' + time.getSeconds()).slice(-2) + ':' +
            ('00' + time.getMilliseconds()).slice(-3) + ']';

        if (typeof args[0] === 'string') {
            args = ['%s %s |\t' + args.shift(), time, name, ...args];
        }

        console.log.apply(null, args);
    }
}

module.exports = function(name) {
    return logger('name');
};