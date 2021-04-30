'use strict';

const logger = require('./log');
const log = logger('queue');

const Scheduler = require('../lib/scheduler');

let counter = 0;

const scheduler = new Scheduler({
    backend: {
        host: 'localhost',
        port: 6379
    }
});

const urls = [
    'http://www.goliatone.com',
    // 'https://www.splitbrain.org',
    // 'https://github.com/mozilla',
    // 'https://www.elastic.co',
    // 'https://github.com',
    // 'https://docs.droplit.io',
    // 'http://wiki.psuter.ch',
    // 'https://github.com',
    // 'https://github.com',
    // 'https://github.com',
    // 'https://github.com',
    // 'https://github.com',
    // 'https://itnext.io',
    // 'http://www.bloomberg.com',
];

// (async _ => {
//     console.log('get active tasks');
//     let ids = await scheduler.getActiveTasks();
//     let tasks = await scheduler.getTasks(ids);
//     console.log(ids)
//     console.log(tasks)
//     for (let task of tasks) {
//         console.log(task.id);
//         console.log(task.key);
//         console.log(task.ttlKey);
//     }
// })();

addTaskWorker();

function addTaskWorker() {
    if (urls.length === 0) return log('Done!');

    counter++;

    const index = scheduler.backend.getUid();
    log('Create task %s, ID: "%s"', counter, index);

    let task = {
        id: index,
        queue: 'link.archive',
        maxRuns: randomInt(1, 4),
        maxTries: 5,
        // expire: 2000,
        data: {
            url: urls.pop()
        }
    };

    log('Task has a max run of: %s', task.maxRuns);

    scheduler.addTask(task).then(_ => {
        setTimeout(addTaskWorker, randomInt(200, 1000));
    });
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}