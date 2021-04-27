'use strict';

const logger = require('./log');
const log = logger('queue ');

const Scheduler = require('../lib/scheduler');

let counter = 0;

const scheduler = new Scheduler({
    backend: {
        host: 'localhost',
        port: 6379
    }
});

const urls = [
    // 'https://www.splitbrain.org/services/ots',
    // 'https://github.com/mozilla/readability',
    // 'https://www.elastic.co/products/apm',
    // 'https://github.com/kalliope-project/kalliope/',
    // 'https://docs.droplit.io/docs/containers',

    // 'http://wiki.psuter.ch/doku.php?id=solve_raspbian_sd_card_corruption_issues_with_read-only_mounted_root_partition',
    // 'https://github.com/awnumar/memguard/blob/master/README.md',
    // 'https://github.com/parro-it/libui-node',
    // 'https://github.com/ddollar/forego',
    // 'https://github.com/wpmed92/backpropaganda',
    // 'https://github.com/outline/outline',
    // 'https://itnext.io/going-multithread-with-node-js-492258ba32cf',
    // 'http://www.bloomberg.com/news/articles/2016-05-24/as-zenefits-stumbles-gusto-goes-head-on-by-selling-insurance',
    'http://www.goliatone.com/blog/2015/11/13/raspberry-pi-nodejs-open-zwave/',
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
    counter++;

    const index = scheduler.backend.getUid();
    log('Create task %s, ID: "%s"', counter, index);

    scheduler.addTask({
        id: index,
        // maxRuns: 5,
        maxRuns: 1,
        maxTries: 5,
        // expire: 2000,
        data: {
            url: urls.pop()
        }
    }).then(_ => {
        if (urls.length > 0) addTaskWorker();
        else log('Done!');
        // setTimeout(addTaskWorker, randomInt(200, 1000));
    });
}