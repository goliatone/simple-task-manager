## Simple Task Manager

This is a sample project. To get started:

```
$ npm i simple-task-manager
```

* Task
* Scheduler
* Manager
* Worker

How to handle multiple workers for a single queue in distributed machines/processes?
Claim a task


We schedule a task to run.
Execute task, increase run count when done.

- [ ] A task can be scheduled to be run immediately 
    - `ttl === 0`
- [ ] A task can be scheduled to be run at a later date
    - `ttl > 0`
- [ ] A task can be run once
    - `maxRuns === 0`
- [ ] A task can be run multiple times
    - [ ] `maxRuns > 0`

- [ ] After an error a task can be retried if:
    - [ ] We have not gone over our tries `maxTries < errorCount`
- [ ] A task can be assigned a timeout period to run
    - `timeout`

- [ ] A task should have a timeout for execution time

- [ ] If we start queue and worker exits the task will not be picked up by worker. We need to be able to pick up timedout tasks and requeue them, using scheduler.

## TODO

Merge with [simple-session-manager](https://github.com/goliatone/simple-session-manage) as it has many of the same components.


Use [ioredis](https://github.com/luin/ioredis) client.

## License
® License MIT by goliatone


a) Store ID in-memory
b) Register IDs off tasks in set: `scheduler:tasks`
c) Listen to events on `__keyspace@__:scheduler:tasks,set`
    * If we have the ID in memory we ignore
    * If we don't have it, do we need to add it?

Test a simple queue