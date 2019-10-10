'use strict';

// const client = require('..').createClient({ type: 'redis' });

// const expiredKeyEvents = '__keyevent@0__:expired';
// client.subscribe(expiredKeyEvents);
// client.on('message', (channel, message) => {
//     console.log('- Expired notification:', channel, message);
// });

const Scheduler = require('..').Scheduler;
const createClient = require('..').createClient;

process.on('uncaughtException', function(err) {
    console.error(err.stack);
    console.log("Node NOT Exiting...");
});

const scheduler = new Scheduler({
    logger: console
});


/**
 * We can use this to notify over MQTT about
 * the task and externalize how we handle
 * multiple workers per task.
 */
scheduler.on('task.execute', event => {
    const { task } = event;

    console.log('------------------------------');
    console.log('Execute task: %s', task.id);
    console.log('It has run %s times', task.runs);

    // ...do work

    /**
     * We commit out task.
     * Here we have the chance to update the TTL
     * for this task, in case the probe failed and
     * we might want to do some sort of TTL engineering.
     */
    task.commit();
    console.log('------------------------------\n');
});