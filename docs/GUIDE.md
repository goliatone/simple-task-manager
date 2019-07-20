

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