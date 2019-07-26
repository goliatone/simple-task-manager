'use strict';

const Task = require('..').Task;
const Scheduler = require('..').Scheduler;
const createClient = require('..').createClient;

process.on('uncaughtException', function(err) {
    console.error(err.stack);
    console.log("Node NOT Exiting...");
});

const scheduler = new Scheduler({
    logger: console
});

scheduler.checkClientConfiguration();

scheduler.on('task.created', event => {
    console.log('Task %s was %s', event.task.id, event.action);
});

/**
 * We can use this to notify over MQTT about
 * the task and externalize how we handle
 * multiple workers per task.
 */
// scheduler.on('task.execute', event => {
//     const { task } = event;

//     console.log('------------------------------');
//     console.log('Execute task: %s', task.id);
//     console.log('It has run %s times', task.runs);

//     // ...do work

//     /**
//      * We commit out task.
//      * Here we have the chance to update the TTL
//      * for this task, in case the probe failed and
//      * we might want to do some sort of TTL engineering.
//      */
//     task.commit();
//     console.log('------------------------------\n');
// });

// scheduler.loadAllSources();

//Add a new task
// scheduler.add({
//     id: 'bf404d3e-857b-438d-80f0-52bfa55fc9cc',
//     data: {},
//     repeat: true,
// });

scheduler.remove({
    id: 'bf404d3e-857b-438d-80f0-52bfa55fc9cc'
}).catch(console.error);