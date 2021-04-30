'use strict';

const logger = require('./log');
const Worker = require('../lib/workers');

const log = logger('worker');

const worker = new Worker({
    queue: 'link.archive',
    backend: {
        host: 'localhost',
        port: 6379
    }
});


worker
    .on('task.ran', task => {
        log('----- task ran ----');
        log('Job complete...\n');
        log('- This "task" has run "%s" times', task.runs);
        log('- "job" ran "%s" times with %s errors and %s failures', worker.runs - worker.errors, worker.errors, worker.failed);
        // log('- execution took %sms', timeout);
        log('----------------------\n');
    }).on('task.added', task => {
        log('----- task added ----');
        log('! on task added');
        log('* Task has been ran %s before.', task.runs);
        log('* Pulled queue: "%s" task id "%s"', 'tasks:active', task.id);
    }).on('task.error', task => {
        log('\t----- ERROR ----');
        log('\tTask "%s" failed...', task.id);
        log('\tErrors: %s/%s', task.errorCount, task.maxTries);
        // log('\tserialized: %s', task.serialize());
        log('-------------------\n');
    })
    .run(taskHandler);

async function taskHandler(task) {
    log('-------- WORKER --------');
    if (!task.data) {
        log('No task data!!');
        log('%j', task);
        process.exit(1);
    }

    log('Start job with id: %s...', task.id);
    log('Prepare to summarize url %s...', task.data.url);

    const timeout = randomInt(100, 2000);

    if (timeout > 1400) {
        log('Timed out error...');
        throw new Error(`${task.id}`, 504);
    }

    return new Promise((resolve, reject) => {
        setTimeout(_ => {
            log('Download done!');
            resolve();
        }, timeout);
    });
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}