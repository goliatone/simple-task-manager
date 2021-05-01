'use strict';

const logger = require('./log');
const Worker = require('../lib/workers');

const log = logger('worker');

const worker = new Worker({
    queue: 'link.archive',
    logger: logger('manager'),
    backend: {
        host: 'localhost',
        port: 6379
    }
});


worker
    .on('task.added', task => {
        log.info('------------------------------');
        log.info('----- TASK ADDED ----');
        log.info('* Task has been ran %s before.', task.runs);
        log.info('* It should run %s times.', task.maxRuns);
        log.info('* Pulled queue: "%s" task id "%s"', 'tasks:active', task.id);
        console.log('');
    })
    .on('task.ran', task => {
        log.info('------------------------------');
        log.info('----- TASK RAN ----');
        log.info('Job complete...\n');
        log.info('- Task has run "%s/%s" times with "%s" errors', task.runs, task.maxRuns, task.errorCount);
        log.info('- "job" ran "%s" times with %s errors and %s failures', worker.runs - worker.errors, worker.errors, worker.failed);
        log.info('------------------------------');
        log.info('------------------------------');
        console.info('');
    }).on('task.error', task => {
        log.info('------------------------------');
        log.info('----- TASK ERROR ----');
        log.info('* Task "%s" failed...', task.id);
        log.info('* Errors: %s/%s', task.errorCount, task.maxTries);
        log.info('-------------------\n');
    })
    .run(taskHandler);

async function taskHandler(task) {
    log.info('-------- WORKER --------');
    if (!task.data) {
        log.info('No task data!!');
        log.info('%j', task);
        process.exit(1);
    }

    log.info('Start job with id: %s...', task.id);
    log.info('Prepare to summarize url %s...', task.data.url);

    const timeout = randomInt(100, 2000);

    if (timeout > 1400) {
        log.error('Timed out error...');
        throw new Error(`${task.id}`, 504);
    }

    return new Promise((resolve, reject) => {
        setTimeout(_ => {
            log.info('Download done!');
            resolve();
        }, timeout);
    });
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}