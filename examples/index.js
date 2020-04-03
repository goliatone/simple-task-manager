'use strict';

const Task = require('..').Task;
const Scheduler = require('..').Scheduler;

process.on('uncaughtException', function(err) {
    console.error(err.stack);
    console.log("Node NOT Exiting...");
});

const scheduler = new Scheduler({
    logger: console,
    backend: {
        host: 'localhost',
        port: 6379
    }
});

function createClient(options = {}) {
    const redis = require('ioredis');
    return redis.createClient(options);
}

const client = createClient({
    host: 'localhost',
    port: 6379
});



(async _ => {

    let keys = await client.keys('*');
    //Get all task related keys:
    let map = {
        'tasks:active': [],
        'tasks:failed': [],
        'tasks:completed': [],
        'task:ids': [],
        'tasks:definitions': {},
    };

    /**
     * We reuse the keys that are set in 
     * the redis lists.
     */
    for (let key of keys) {
        if (key.indexOf('tasks:') !== 0) continue;

        if (map.hasOwnProperty(key)) {
            let tasks = await client.lrange(key, 0, -1);

            if (key === 'tasks:completed') {
                //Iterate over tasks. 
                tasks = tasks.map(task => {
                    //Parse as JSON
                    task = JSON.parse(task);
                    //Store task in 'tasks:completed:data'
                    //map['tasks:completed:data'] = task;
                    //Store id in tasks
                    return task.id;
                });
            }
            map[key] = tasks;
        } else {
            let task = await client.get(key);
            map['tasks:definitions'][key] = JSON.parse(task);
            map['task:ids'].push(key);
        }
    }

    //OK: How many of our active tasks are actually completed?
    let completed = intersect(map['tasks:failed'], map['tasks:active']);
    if (completed.length) {
        //We should just remove them from active
        console.log('completed', completed);
    }

    let failed = intersect(map['tasks:failed'], map['tasks:active']);
    if (failed.length) {
        //We should just remove them from active
        console.log('failed', failed);
    }

    //We should iterate over the active tasks
    //check when they were added - Date.now() > stale_threshold
    //Retry that task again...
    if (map['task:ids'].length) {
        console.log('we have tasks hanging around...');
        for (let id in map['tasks:definitions']) {
            let task = map['tasks:definitions'][id];
            console.log(task)
                // scheduler.addTask(task);
        }
    }

    //Check how big our completed tasks list is
    //if completed.length > completed_queue_threshold
    //LTRIM key 1 completed_queue_threshold

    const repl = require('repl');

    const server = repl.start({
        prompt: 'scheduler> ',
        terminal: true, // Set to true to enable command history
        ignoreUndefined: true, // Ignore 'undefined' when running a command that does not return a value
        replMode: 'strict' // 'use strict'
    });

    server.context.map = map;
    server.context.client = client;
    server.context.scheduler = scheduler;
})();


function intersect(a, b) {
    var t;
    if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
    return a.filter(function(e) {
        return b.indexOf(e) > -1;
    });
}