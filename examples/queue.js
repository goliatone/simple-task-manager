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

(async _ => {
    console.info('get active tasks');
    let all, active, failed, completed, tasks;

    try {
        all = await scheduler.getAllTaskIds();
    } catch (error) {
        console.error('error all');
        console.error(error);
        process.exit();
    }

    try {
        active = await scheduler.getActiveTasks();
    } catch (error) {
        console.error('error active');
        console.error(error);
        process.exit();
    }

    try {
        failed = await scheduler.getFailedTasks();
    } catch (error) {
        console.error('error failed');
        console.error(error);
        process.exit();
    }

    try {
        completed = await scheduler.getCompletedTasks();
    } catch (error) {
        console.error('error completed');
        console.error(error);
        process.exit();
    }

    try {
        tasks = await scheduler.getTasks(all);
    } catch (error) {
        console.error('error tasks');
        console.error(error);
        process.exit();
    }

    console.log('all', all.length);
    console.log('active', active.length);
    console.log('failed', failed.length);
    console.log('completed', completed.length);


    if (all.length > 0) {
        console.info(all)
        console.info(tasks)

        for (let task of tasks) {
            console.info(task.id);
            console.info(task.key);
            console.info(task.ttlKey);
        }
    }

    scheduler.backend.client.flushall().then(addTaskWorker);

})();


// addTaskWorker();

function addTaskWorker() {
    if (urls.length === 0) return log.info('Done!');

    counter++;

    const index = scheduler.backend.getUid();
    log.info('Create task %s, ID: "%s"', counter, index);

    let task = {
        id: index,
        queue: 'runner.execute',
        schedule: '*/1 * * * *',
        maxRuns: randomInt(2, 4),
        maxTries: 5,
        // expire: 2000,
        data: {
            url: urls.pop()
        }
    };

    log.info('Task has a max run of: %s', task.maxRuns);

    scheduler.addTask(task).then(_ => {
        setTimeout(addTaskWorker, randomInt(200, 1000));
    }).catch(console.error);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}