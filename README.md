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