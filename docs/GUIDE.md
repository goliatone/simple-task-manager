

Source entity sample:

* id: `waterline:service:id:9febf4b1-b30a-461a-91a6-248516bf6a80`

```json
{
    "interval": 30000,
    "latencyLimit": 5000,
    "errorAlterThreshold": 1,
    "responseAlertThreshold": 1,
    "active": true,
    "timeoutAfter": 30000,
    "endpoint": "http://localhost:9999/health",
    "application": "6aab4b61-89ea-497f-9f8e-5a35a235f3b4",
    "id": "9febf4b1-b30a-461a-91a6-248516bf6a80",
    "uuid": "a995585f-cb6b-4417-9331-734415656221",
    "createdAt": "2019-07-15T04:35:24.665Z",
    "updatedAt": "2019-07-15T04:40:22.718Z"
}
```

Task entity sample:
* id: `scheduler:tasks:9febf4b1-b30a-461a-91a6-248516bf6a80`

```json
{
    "id": "9febf4b1-b30a-461a-91a6-248516bf6a80",
    "key": "scheduler:tasks:9febf4b1-b30a-461a-91a6-248516bf6a80",
    "data": {
        "interval": 30000,
        "latencyLimit": 5000,
        "errorAlterThreshold": 1,
        "responseAlertThreshold": 1,
        "active": true,
        "timeoutAfter": 30000,
        "endpoint": "http://localhost:9999/health",
        "application": "6aab4b61-89ea-497f-9f8e-5a35a235f3b4",
        "id": "9febf4b1-b30a-461a-91a6-248516bf6a80",
        "uuid": "a995585f-cb6b-4417-9331-734415656221",
        "createdAt": "2019-07-15T04:35:24.665Z",
        "updatedAt": "2019-07-15T04:35:24.665Z"
    },
    "runs": 94,
    "expire": 30000,
    "reschedule": true
}
```


### Redis

Configure redis expire keys:

```
redis-cli config set notify-keyspace-events KEA
```

Listen for events:

```
redis-cli --csv psubscribe '__key*__:*'
```

If you want to use docker:

```
docker exec -ti c19a0f737a29 redis-cli --csv psubscribe '__key*__:*'
```


## Flow

`queue`: Tasks pushed to the list are ready to be picked up and worked on
`task:<key>`: Holds a serialized representation of task with id `<key>`.
`task:<key>:ttl`: Holds the TTL if a repeating task. (cron/periodicity)
`tasks:ids`: List of **all** task ids
`tasks:active`: List of **active** task ids
`tasks:failed`: List of **failed**task ids
`tasks:completed`: List of **completed** serialized tasks

The normal flow of a task would be:

* Passed to scheduler through `addTask`.
    * If we pass object the create Task instance.
    * Add serialized task to `task:<key>` list.
    * If task has immediate execution add `key` to `queue`.
    * Else add `key` to `task:<key>:ttl`.

* Worker is pop-blocking listening to `queue`
    * On a new task we do atomic pop and push to `tasks:active`.


Notes: Can we have an garbage collector agent? 
    - Listen for tasks that are hold in a queue for longer than Xt.
    - 

Notes: Can we keep track of how many schedulers and workers are active?

### Scheduler

We add a Task using `addTask`.

#### Backend 

Scheduler uses the following backend methods:

* `addTask`

### Worker

Runs a blocking call waiting for new tasks to be added. When we have a new id added to the queue we pop from the queue and push to active list. A passed in job handler function will be called with the task instance, we `await` for job to finish.
Then when the task completes
If `job` throws an error then 

#### Client (Backend)

Worker uses the following backend methods:

* `waitForTask`
* `commit`
* `handleError`

## Scheduler Initialization Process

Whenever we start a new scheduler instance we can direct the scheduler to do some clean up by passing the option `cleanTasks=true`. This operation has the potential to be computationally expensive so it's recommended to do in a separate instance.

This will:

A. Get all tasks ids: `GET task:*`
B. Get all tasks with a TTL waiting to be activated: `GET task:*:ttl`
C. 

### Scheduling

We have different ways to set when/how a task is supposed to run.

We control these "run modes" by changing a task's options.

A schedule specifies the interval between runs. We can optionally pass in a `startDate` and/or `endDate`.
We can also limit the maximum number of times a task will run by setting `maxRuns`.

Schedule options:

* `startDate`: Start date of the iteration.
* `endDate`: End date of iteration.
* `utc`: Enable UTC
* `tz`: Timezone string (e.g. **America/NewYork**). Will not be used if `utc` is enabled.

The values of `startDate` and `endDate` can be `string`, `integer` and `Date`.
Input as `integer` should be a JS UNIX timestamp. 
In case of using `string` as input your date has to be formatted as valid **ISO 8601**.
In case of using `Date` it will be encoded as a string and `utc`.

**NOTE** think about ignoring tz! more info [here](https://github.com/moment/luxon/blob/master/docs/zones.md)

## Notes

Need to implement redis check for [OK configuration](https://github.com/goliatone/core.io-registry-service/blob/scheduler_redis/src/modules/scheduler/lib/redis.js#L103):
valid key configs: AKE or xKE


Redis >= 6.2 added `GET`, `EXAT`, `PXAT`, `KEEPTTL` to `SET` command.


Add some methods to work with task time management.

```js
scheduler.addTask(task)
    .withDelay(1000);

scheduler.addTask(task)
    .interval(Date, Date);
```