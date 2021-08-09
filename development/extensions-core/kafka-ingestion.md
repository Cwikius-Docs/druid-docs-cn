# Kafka 数据载入
Kafka 索引服务（Kafka indexing service）将会在 Overlord 上启动并配置 *supervisors*，
supervisors 通过管理 Kafka 索引任务的创建和销毁的生命周期以便于从 Kafka 中载入数据。
这些索引任务使用Kafka自己的分区和偏移机制读取事件，因此能够保证只读取一次（exactly-once）。

supervisor 对索引任务的状态进行监控，以便于对任务进行扩展或切换，故障管理等操作。

这个服务是由 `druid-kafka-indexing-service` 这个 druid 核心扩展（详情请见 [扩展列表](../../development/extensions.md）)提供的。

> [!WARNING]
> Kafka索引服务支持在 Kafka 0.11.x 中开始使用的事务主题。这些更改使 Druid 使用的 Kafka 消费者与旧的 Kafka brokers 不兼容。
> 在使用 Druid 从 Kafka中导入数据之前，请确保你的 Kafka 版本为 0.11.x 或更高版本。
> 如果你使用的是旧版本的 Kafka brokers，请参阅《 [Kafka升级指南](https://kafka.apache.org/documentation/#upgrade) 》中的内容先进行升级。

## 教程
针对使用 Apache Kafka 数据导入中的参考文档，请访问 [Loading from Apache Kafka](../../tutorials/tutorial-kafka.md) 页面中的教程。

## 提交一个 Supervisor 规范

Kafka 的所以服务需要 `druid-kafka-indexing-service` 扩展同时安装在 Overlord 和 MiddleManagers 服务器上。
你可以通过提交一个 supervisor 规范到 Druid 中来完成数据源的设置。你可以采用 HTTP POST 的方法来进行提交，发送的地址为：

`http://<OVERLORD_IP>:<OVERLORD_PORT>/druid/indexer/v1/supervisor`，一个具体的提交示例如下：

```
curl -X POST -H 'Content-Type: application/json' -d @supervisor-spec.json http://localhost:8090/druid/indexer/v1/supervisor
```

一个示例的 supervisor 规范如下：

```json
{
  "type": "kafka",
  "dataSchema": {
    "dataSource": "metrics-kafka",
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [],
      "dimensionExclusions": [
        "timestamp",
        "value"
      ]
    },
    "metricsSpec": [
      {
        "name": "count",
        "type": "count"
      },
      {
        "name": "value_sum",
        "fieldName": "value",
        "type": "doubleSum"
      },
      {
        "name": "value_min",
        "fieldName": "value",
        "type": "doubleMin"
      },
      {
        "name": "value_max",
        "fieldName": "value",
        "type": "doubleMax"
      }
    ],
    "granularitySpec": {
      "type": "uniform",
      "segmentGranularity": "HOUR",
      "queryGranularity": "NONE"
    }
  },
  "ioConfig": {
    "topic": "metrics",
    "inputFormat": {
      "type": "json"
    },
    "consumerProperties": {
      "bootstrap.servers": "localhost:9092"
    },
    "taskCount": 1,
    "replicas": 1,
    "taskDuration": "PT1H"
  },
  "tuningConfig": {
    "type": "kafka",
    "maxRowsPerSegment": 5000000
  }
}
```

## Supervisor 配置

|字段（Field）|描述（Description）|是否必须（Required）|
|--------|-----------|---------|
|`type`|The supervisor type, this should always be `kafka`.|yes|
|`dataSchema`|The schema that will be used by the Kafka indexing task during ingestion. See [`dataSchema`](../../ingestion/index.md#dataschema) for details.|yes|
|`ioConfig`|A KafkaSupervisorIOConfig object for configuring Kafka connection and I/O-related settings for the supervisor and indexing task. See [KafkaSupervisorIOConfig](#kafkasupervisorioconfig) below.|yes|
|`tuningConfig`|A KafkaSupervisorTuningConfig object for configuring performance-related settings for the supervisor and indexing tasks. See [KafkaSupervisorTuningConfig](#kafkasupervisortuningconfig) below.|no|

### KafkaSupervisorIOConfig

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|`topic`|String|The Kafka topic to read from. This must be a specific topic as topic patterns are not supported.|yes|
|`inputFormat`|Object|[`inputFormat`](../../ingestion/data-formats.md#input-format) to specify how to parse input data. See [the below section](#specifying-data-format) for details about specifying the input format.|yes|
|`consumerProperties`|Map<String, Object>|A map of properties to be passed to the Kafka consumer. This must contain a property `bootstrap.servers` with a list of Kafka brokers in the form: `<BROKER_1>:<PORT_1>,<BROKER_2>:<PORT_2>,...`. For SSL connections, the `keystore`, `truststore` and `key` passwords can be provided as a [Password Provider](../../operations/password-provider.md) or String password.|yes|
|`pollTimeout`|Long|The length of time to wait for the Kafka consumer to poll records, in milliseconds|no (default == 100)|
|`replicas`|Integer|The number of replica sets, where 1 means a single set of tasks (no replication). Replica tasks will always be assigned to different workers to provide resiliency against process failure.|no (default == 1)|
|`taskCount`|Integer|The maximum number of *reading* tasks in a *replica set*. This means that the maximum number of reading tasks will be `taskCount * replicas` and the total number of tasks (*reading* + *publishing*) will be higher than this. See [Capacity Planning](#capacity-planning) below for more details. The number of reading tasks will be less than `taskCount` if `taskCount > {numKafkaPartitions}`.|no (default == 1)|
|`taskDuration`|ISO8601 Period|The length of time before tasks stop reading and begin publishing their segment.|no (default == PT1H)|
|`startDelay`|ISO8601 Period|The period to wait before the supervisor starts managing tasks.|no (default == PT5S)|
|`period`|ISO8601 Period|How often the supervisor will execute its management logic. Note that the supervisor will also run in response to certain events (such as tasks succeeding, failing, and reaching their taskDuration) so this value specifies the maximum time between iterations.|no (default == PT30S)|
|`useEarliestOffset`|Boolean|If a supervisor is managing a dataSource for the first time, it will obtain a set of starting offsets from Kafka. This flag determines whether it retrieves the earliest or latest offsets in Kafka. Under normal circumstances, subsequent tasks will start from where the previous segments ended so this flag will only be used on first run.|no (default == false)|
|`completionTimeout`|ISO8601 Period|The length of time to wait before declaring a publishing task as failed and terminating it. If this is set too low, your tasks may never publish. The publishing clock for a task begins roughly after `taskDuration` elapses.|no (default == PT30M)|
|`lateMessageRejectionStartDateTime`|ISO8601 DateTime|Configure tasks to reject messages with timestamps earlier than this date time; for example if this is set to `2016-01-01T11:00Z` and the supervisor creates a task at *2016-01-01T12:00Z*, messages with timestamps earlier than *2016-01-01T11:00Z* will be dropped. This may help prevent concurrency issues if your data stream has late messages and you have multiple pipelines that need to operate on the same segments (e.g. a realtime and a nightly batch ingestion pipeline).|no (default == none)|
|`lateMessageRejectionPeriod`|ISO8601 Period|Configure tasks to reject messages with timestamps earlier than this period before the task was created; for example if this is set to `PT1H` and the supervisor creates a task at *2016-01-01T12:00Z*, messages with timestamps earlier than *2016-01-01T11:00Z* will be dropped. This may help prevent concurrency issues if your data stream has late messages and you have multiple pipelines that need to operate on the same segments (e.g. a realtime and a nightly batch ingestion pipeline). Please note that only one of `lateMessageRejectionPeriod` or `lateMessageRejectionStartDateTime` can be specified.|no (default == none)|
|`earlyMessageRejectionPeriod`|ISO8601 Period|Configure tasks to reject messages with timestamps later than this period after the task reached its taskDuration; for example if this is set to `PT1H`, the taskDuration is set to `PT1H` and the supervisor creates a task at *2016-01-01T12:00Z*, messages with timestamps later than *2016-01-01T14:00Z* will be dropped. **Note:** Tasks sometimes run past their task duration, for example, in cases of supervisor failover. Setting earlyMessageRejectionPeriod too low may cause messages to be dropped unexpectedly whenever a task runs past its originally configured task duration.|no (default == none)|

#### Specifying data format

Kafka indexing service supports both [`inputFormat`](../../ingestion/data-formats.md#input-format) and [`parser`](../../ingestion/data-formats.md#parser) to specify the data format.
The `inputFormat` is a new and recommended way to specify the data format for Kafka indexing service,
but unfortunately, it doesn't support all data formats supported by the legacy `parser`.
(They will be supported in the future.)

The supported `inputFormat`s include [`csv`](../../ingestion/data-formats.md#csv),
[`delimited`](../../ingestion/data-formats.md#tsv-delimited), and [`json`](../../ingestion/data-formats.md#json).
You can also read [`avro_stream`](../../ingestion/data-formats.md#avro-stream-parser),
[`protobuf`](../../ingestion/data-formats.md#protobuf-parser),
and [`thrift`](../extensions-contrib/thrift.md) formats using `parser`.

<a name="tuningconfig"></a>

### KafkaSupervisorTuningConfig

The tuningConfig is optional and default parameters will be used if no tuningConfig is specified.

| Field                             | Type           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Required                                                                                                     |
|-----------------------------------|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `type`                            | String         | The indexing task type, this should always be `kafka`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | yes                                                                                                          |
| `maxRowsInMemory`                 | Integer        | The number of rows to aggregate before persisting. This number is the post-aggregation rows, so it is not equivalent to the number of input events, but the number of aggregated rows that those events result in. This is used to manage the required JVM heap size. Maximum heap memory usage for indexing scales with maxRowsInMemory * (2 + maxPendingPersists). Normally user does not need to set this, but depending on the nature of data, if rows are short in terms of bytes, user may not want to store a million rows in memory and this value should be set.                                                                           | no (default == 1000000)                                                                                      |
| `maxBytesInMemory`                | Long           | The number of bytes to aggregate in heap memory before persisting. This is based on a rough estimate of memory usage and not actual usage. Normally this is computed internally and user does not need to set it. The maximum heap memory usage for indexing is maxBytesInMemory * (2 + maxPendingPersists).                                                                                                                                                                                                                                                                                                                                        | no (default == One-sixth of max JVM memory)                                                                  |
| `maxRowsPerSegment`               | Integer        | The number of rows to aggregate into a segment; this number is post-aggregation rows. Handoff will happen either if `maxRowsPerSegment` or `maxTotalRows` is hit or every `intermediateHandoffPeriod`, whichever happens earlier.                                                                                                                                                                                                                                                                                                                                                                                                                   | no (default == 5000000)                                                                                      |
| `maxTotalRows`                    | Long           | The number of rows to aggregate across all segments; this number is post-aggregation rows. Handoff will happen either if `maxRowsPerSegment` or `maxTotalRows` is hit or every `intermediateHandoffPeriod`, whichever happens earlier.                                                                                                                                                                                                                                                                                                                                                                                                              | no (default == unlimited)                                                                                    |
| `intermediatePersistPeriod`       | ISO8601 Period | The period that determines the rate at which intermediate persists occur.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | no (default == PT10M)                                                                                        |
| `maxPendingPersists`              | Integer        | Maximum number of persists that can be pending but not started. If this limit would be exceeded by a new intermediate persist, ingestion will block until the currently-running persist finishes. Maximum heap memory usage for indexing scales with maxRowsInMemory * (2 + maxPendingPersists).                                                                                                                                                                                                                                                                                                                                                    | no (default == 0, meaning one persist can be running concurrently with ingestion, and none can be queued up) |
| `indexSpec`                       | Object         | Tune how data is indexed. See [IndexSpec](#indexspec) for more information.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | no                                                                                                           |
| `indexSpecForIntermediatePersists`|                | Defines segment storage format options to be used at indexing time for intermediate persisted temporary segments. This can be used to disable dimension/metric compression on intermediate segments to reduce memory required for final merging. However, disabling compression on intermediate segments might increase page cache use while they are used before getting merged into final segment published, see [IndexSpec](#indexspec) for possible values.                                                                                                                                                                                     | no (default = same as indexSpec)                                                                             |
| `reportParseExceptions`           | Boolean        | *DEPRECATED*. If true, exceptions encountered during parsing will be thrown and will halt ingestion; if false, unparseable rows and fields will be skipped. Setting `reportParseExceptions` to true will override existing configurations for `maxParseExceptions` and `maxSavedParseExceptions`, setting `maxParseExceptions` to 0 and limiting `maxSavedParseExceptions` to no more than 1.                                                                                                                                                                                                                                                       | no (default == false)                                                                                        |
| `handoffConditionTimeout`         | Long           | Milliseconds to wait for segment handoff. It must be >= 0, where 0 means to wait forever.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | no (default == 0)                                                                                            |
| `resetOffsetAutomatically`        | Boolean        | Controls behavior when Druid needs to read Kafka messages that are no longer available (i.e. when OffsetOutOfRangeException is encountered).<br/><br/>If false, the exception will bubble up, which will cause your tasks to fail and ingestion to halt. If this occurs, manual intervention is required to correct the situation; potentially using the [Reset Supervisor API](../../operations/api-reference.html#supervisors). This mode is useful for production, since it will make you aware of issues with ingestion.<br/><br/>If true, Druid will automatically reset to the earlier or latest offset available in Kafka, based on the value of the `useEarliestOffset` property (earliest if true, latest if false). Please note that this can lead to data being _DROPPED_ (if `useEarliestOffset` is false) or _DUPLICATED_ (if `useEarliestOffset` is true) without your knowledge. Messages will be logged indicating that a reset has occurred, but ingestion will continue. This mode is useful for non-production situations, since it will make Druid attempt to recover from problems automatically, even if they lead to quiet dropping or duplicating of data.<br/><br/>This feature behaves similarly to the Kafka `auto.offset.reset` consumer property. | no (default == false) |
| `workerThreads`                   | Integer        | The number of threads that the supervisor uses to handle requests/responses for worker tasks, along with any other internal asynchronous operation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | no (default == min(10, taskCount))                                                                           |
| `chatThreads`                     | Integer        | The number of threads that will be used for communicating with indexing tasks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | no (default == min(10, taskCount * replicas))                                                                |
| `chatRetries`                     | Integer        | The number of times HTTP requests to indexing tasks will be retried before considering tasks unresponsive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | no (default == 8)                                                                                            |
| `httpTimeout`                     | ISO8601 Period | How long to wait for a HTTP response from an indexing task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | no (default == PT10S)                                                                                        |
| `shutdownTimeout`                 | ISO8601 Period | How long to wait for the supervisor to attempt a graceful shutdown of tasks before exiting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | no (default == PT80S)                                                                                        |
| `offsetFetchPeriod`               | ISO8601 Period | How often the supervisor queries Kafka and the indexing tasks to fetch current offsets and calculate lag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | no (default == PT30S, min == PT5S)                                                                           |
| `segmentWriteOutMediumFactory`    | Object         | Segment write-out medium to use when creating segments. See below for more information.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | no (not specified by default, the value from `druid.peon.defaultSegmentWriteOutMediumFactory.type` is used)  |
| `intermediateHandoffPeriod`       | ISO8601 Period | How often the tasks should hand off segments. Handoff will happen either if `maxRowsPerSegment` or `maxTotalRows` is hit or every `intermediateHandoffPeriod`, whichever happens earlier.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | no (default == P2147483647D)                                                                                 |
| `logParseExceptions`              | Boolean        | If true, log an error message when a parsing exception occurs, containing information about the row where the error occurred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | no, default == false                                                                                         |
| `maxParseExceptions`              | Integer        | The maximum number of parse exceptions that can occur before the task halts ingestion and fails. Overridden if `reportParseExceptions` is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | no, unlimited default                                                                                        |
| `maxSavedParseExceptions`         | Integer        | When a parse exception occurs, Druid can keep track of the most recent parse exceptions. "maxSavedParseExceptions" limits how many exception instances will be saved. These saved exceptions will be made available after the task finishes in the [task completion report](../../ingestion/tasks.md#reports). Overridden if `reportParseExceptions` is set.                                                                                                                                                                                                                                                                                            | no, default == 0                                                                                             |

#### IndexSpec

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|bitmap|Object|Compression format for bitmap indexes. Should be a JSON object. See [Bitmap types](#bitmap-types) below for options.|no (defaults to Roaring)|
|dimensionCompression|String|Compression format for dimension columns. Choose from `LZ4`, `LZF`, or `uncompressed`.|no (default == `LZ4`)|
|metricCompression|String|Compression format for primitive type metric columns. Choose from `LZ4`, `LZF`, `uncompressed`, or `none`.|no (default == `LZ4`)|
|longEncoding|String|Encoding format for metric and dimension columns with type long. Choose from `auto` or `longs`. `auto` encodes the values using offset or lookup table depending on column cardinality, and store them with variable size. `longs` stores the value as is with 8 bytes each.|no (default == `longs`)|

##### Bitmap types

For Roaring bitmaps:

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|`type`|String|Must be `roaring`.|yes|
|`compressRunOnSerialization`|Boolean|Use a run-length encoding where it is estimated as more space efficient.|no (default == `true`)|

For Concise bitmaps:

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|`type`|String|Must be `concise`.|yes|

#### SegmentWriteOutMediumFactory

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|`type`|String|See [Additional Peon Configuration: SegmentWriteOutMediumFactory](../../configuration/index.html#segmentwriteoutmediumfactory) for explanation and available options.|yes|

## Operations

This section gives descriptions of how some supervisor APIs work specifically in Kafka Indexing Service.
For all supervisor APIs, please check [Supervisor APIs](../../operations/api-reference.html#supervisors).

### Getting Supervisor Status Report

`GET /druid/indexer/v1/supervisor/<supervisorId>/status` returns a snapshot report of the current state of the tasks managed by the given supervisor. This includes the latest
offsets as reported by Kafka, the consumer lag per partition, as well as the aggregate lag of all partitions. The
consumer lag per partition may be reported as negative values if the supervisor has not received a recent latest offset
response from Kafka. The aggregate lag value will always be >= 0.

The status report also contains the supervisor's state and a list of recently thrown exceptions (reported as
`recentErrors`, whose max size can be controlled using the `druid.supervisor.maxStoredExceptionEvents` configuration).
There are two fields related to the supervisor's state - `state` and `detailedState`. The `state` field will always be
one of a small number of generic states that are applicable to any type of supervisor, while the `detailedState` field
will contain a more descriptive, implementation-specific state that may provide more insight into the supervisor's
activities than the generic `state` field.

The list of possible `state` values are: [`PENDING`, `RUNNING`, `SUSPENDED`, `STOPPING`, `UNHEALTHY_SUPERVISOR`, `UNHEALTHY_TASKS`]

The list of `detailedState` values and their corresponding `state` mapping is as follows:

|Detailed State|Corresponding State|Description|
|--------------|-------------------|-----------|
|UNHEALTHY_SUPERVISOR|UNHEALTHY_SUPERVISOR|The supervisor has encountered errors on the past `druid.supervisor.unhealthinessThreshold` iterations|
|UNHEALTHY_TASKS|UNHEALTHY_TASKS|The last `druid.supervisor.taskUnhealthinessThreshold` tasks have all failed|
|UNABLE_TO_CONNECT_TO_STREAM|UNHEALTHY_SUPERVISOR|The supervisor is encountering connectivity issues with Kafka and has not successfully connected in the past|
|LOST_CONTACT_WITH_STREAM|UNHEALTHY_SUPERVISOR|The supervisor is encountering connectivity issues with Kafka but has successfully connected in the past|
|PENDING (first iteration only)|PENDING|The supervisor has been initialized and hasn't started connecting to the stream|
|CONNECTING_TO_STREAM (first iteration only)|RUNNING|The supervisor is trying to connect to the stream and update partition data|
|DISCOVERING_INITIAL_TASKS (first iteration only)|RUNNING|The supervisor is discovering already-running tasks|
|CREATING_TASKS (first iteration only)|RUNNING|The supervisor is creating tasks and discovering state|
|RUNNING|RUNNING|The supervisor has started tasks and is waiting for taskDuration to elapse|
|SUSPENDED|SUSPENDED|The supervisor has been suspended|
|STOPPING|STOPPING|The supervisor is stopping|

On each iteration of the supervisor's run loop, the supervisor completes the following tasks in sequence:
  1) Fetch the list of partitions from Kafka and determine the starting offset for each partition (either based on the
  last processed offset if continuing, or starting from the beginning or ending of the stream if this is a new topic).
  2) Discover any running indexing tasks that are writing to the supervisor's datasource and adopt them if they match
  the supervisor's configuration, else signal them to stop.
  3) Send a status request to each supervised task to update our view of the state of the tasks under our supervision.
  4) Handle tasks that have exceeded `taskDuration` and should transition from the reading to publishing state.
  5) Handle tasks that have finished publishing and signal redundant replica tasks to stop.
  6) Handle tasks that have failed and clean up the supervisor's internal state.
  7) Compare the list of healthy tasks to the requested `taskCount` and `replicas` configurations and create additional tasks if required.

The `detailedState` field will show additional values (those marked with "first iteration only") the first time the
supervisor executes this run loop after startup or after resuming from a suspension. This is intended to surface
initialization-type issues, where the supervisor is unable to reach a stable state (perhaps because it can't connect to
Kafka, it can't read from the Kafka topic, or it can't communicate with existing tasks). Once the supervisor is stable -
that is, once it has completed a full execution without encountering any issues - `detailedState` will show a `RUNNING`
state until it is stopped, suspended, or hits a failure threshold and transitions to an unhealthy state.

### Getting Supervisor Ingestion Stats Report

`GET /druid/indexer/v1/supervisor/<supervisorId>/stats` returns a snapshot of the current ingestion row counters for each task being managed by the supervisor, along with moving averages for the row counters.

See [Task Reports: Row Stats](../../ingestion/tasks.md#row-stats) for more information.

### Supervisor Health Check

`GET /druid/indexer/v1/supervisor/<supervisorId>/health` returns `200 OK` if the supervisor is healthy and
`503 Service Unavailable` if it is unhealthy. Healthiness is determined by the supervisor's `state` (as returned by the
`/status` endpoint) and the `druid.supervisor.*` Overlord configuration thresholds.

### Updating Existing Supervisors

`POST /druid/indexer/v1/supervisor` can be used to update existing supervisor spec.
Calling this endpoint when there is already an existing supervisor for the same dataSource will cause:

- The running supervisor to signal its managed tasks to stop reading and begin publishing.
- The running supervisor to exit.
- A new supervisor to be created using the configuration provided in the request body. This supervisor will retain the
existing publishing tasks and will create new tasks starting at the offsets the publishing tasks ended on.

Seamless schema migrations can thus be achieved by simply submitting the new schema using this endpoint.

### Suspending and Resuming Supervisors

You can suspend and resume a supervisor using `POST /druid/indexer/v1/supervisor/<supervisorId>/suspend` and `POST /druid/indexer/v1/supervisor/<supervisorId>/resume`, respectively.

Note that the supervisor itself will still be operating and emitting logs and metrics,
it will just ensure that no indexing tasks are running until the supervisor is resumed.

### Resetting Supervisors

The `POST /druid/indexer/v1/supervisor/<supervisorId>/reset` operation clears stored 
offsets, causing the supervisor to start reading offsets from either the earliest or latest 
offsets in Kafka (depending on the value of `useEarliestOffset`). After clearing stored 
offsets, the supervisor kills and recreates any active tasks, so that tasks begin reading 
from valid offsets. 

Use care when using this operation! Resetting the supervisor may cause Kafka messages 
to be skipped or read twice, resulting in missing or duplicate data. 

The reason for using this operation is to recover from a state in which the supervisor 
ceases operating due to missing offsets. The indexing service keeps track of the latest 
persisted Kafka offsets in order to provide exactly-once ingestion guarantees across 
tasks. Subsequent tasks must start reading from where the previous task completed in 
order for the generated segments to be accepted. If the messages at the expected 
starting offsets are no longer available in Kafka (typically because the message retention 
period has elapsed or the topic was removed and re-created) the supervisor will refuse 
to start and in flight tasks will fail. This operation enables you to recover from this condition. 

Note that the supervisor must be running for this endpoint to be available.

### Terminating Supervisors

The `POST /druid/indexer/v1/supervisor/<supervisorId>/terminate` operation terminates a supervisor and causes all 
associated indexing tasks managed by this supervisor to immediately stop and begin
publishing their segments. This supervisor will still exist in the metadata store and it's history may be retrieved
with the supervisor history API, but will not be listed in the 'get supervisors' API response nor can it's configuration
or status report be retrieved. The only way this supervisor can start again is by submitting a functioning supervisor
spec to the create API.

### Capacity Planning

Kafka indexing tasks run on MiddleManagers and are thus limited by the resources available in the MiddleManager
cluster. In particular, you should make sure that you have sufficient worker capacity (configured using the
`druid.worker.capacity` property) to handle the configuration in the supervisor spec. Note that worker capacity is
shared across all types of indexing tasks, so you should plan your worker capacity to handle your total indexing load
(e.g. batch processing, realtime tasks, merging tasks, etc.). If your workers run out of capacity, Kafka indexing tasks
will queue and wait for the next available worker. This may cause queries to return partial results but will not result
in data loss (assuming the tasks run before Kafka purges those offsets).

A running task will normally be in one of two states: *reading* or *publishing*. A task will remain in reading state for
`taskDuration`, at which point it will transition to publishing state. A task will remain in publishing state for as long
as it takes to generate segments, push segments to deep storage, and have them be loaded and served by a Historical process
(or until `completionTimeout` elapses).

The number of reading tasks is controlled by `replicas` and `taskCount`. In general, there will be `replicas * taskCount`
reading tasks, the exception being if taskCount > {numKafkaPartitions} in which case {numKafkaPartitions} tasks will
be used instead. When `taskDuration` elapses, these tasks will transition to publishing state and `replicas * taskCount`
new reading tasks will be created. Therefore to allow for reading tasks and publishing tasks to run concurrently, there
should be a minimum capacity of:

```
workerCapacity = 2 * replicas * taskCount
```

This value is for the ideal situation in which there is at most one set of tasks publishing while another set is reading.
In some circumstances, it is possible to have multiple sets of tasks publishing simultaneously. This would happen if the
time-to-publish (generate segment, push to deep storage, loaded on Historical) > `taskDuration`. This is a valid
scenario (correctness-wise) but requires additional worker capacity to support. In general, it is a good idea to have
`taskDuration` be large enough that the previous set of tasks finishes publishing before the current set begins.

### Supervisor Persistence

When a supervisor spec is submitted via the `POST /druid/indexer/v1/supervisor` endpoint, it is persisted in the
configured metadata database. There can only be a single supervisor per dataSource, and submitting a second spec for
the same dataSource will overwrite the previous one.

When an Overlord gains leadership, either by being started or as a result of another Overlord failing, it will spawn
a supervisor for each supervisor spec in the metadata database. The supervisor will then discover running Kafka indexing
tasks and will attempt to adopt them if they are compatible with the supervisor's configuration. If they are not
compatible because they have a different ingestion spec or partition allocation, the tasks will be killed and the
supervisor will create a new set of tasks. In this way, the supervisors are persistent across Overlord restarts and
fail-overs.

A supervisor is stopped via the `POST /druid/indexer/v1/supervisor/<supervisorId>/terminate` endpoint. This places a
tombstone marker in the database (to prevent the supervisor from being reloaded on a restart) and then gracefully
shuts down the currently running supervisor. When a supervisor is shut down in this way, it will instruct its
managed tasks to stop reading and begin publishing their segments immediately. The call to the shutdown endpoint will
return after all tasks have been signaled to stop but before the tasks finish publishing their segments.

### Schema/Configuration Changes

Schema and configuration changes are handled by submitting the new supervisor spec via the same
`POST /druid/indexer/v1/supervisor` endpoint used to initially create the supervisor. The Overlord will initiate a
graceful shutdown of the existing supervisor which will cause the tasks being managed by that supervisor to stop reading
and begin publishing their segments. A new supervisor will then be started which will create a new set of tasks that
will start reading from the offsets where the previous now-publishing tasks left off, but using the updated schema.
In this way, configuration changes can be applied without requiring any pause in ingestion.

### Deployment Notes

#### On the Subject of Segments

Each Kafka Indexing Task puts events consumed from Kafka partitions assigned to it in a single segment for each segment
granular interval until maxRowsPerSegment, maxTotalRows or intermediateHandoffPeriod limit is reached, at this point a new partition
for this segment granularity is created for further events. Kafka Indexing Task also does incremental hand-offs which
means that all the segments created by a task will not be held up till the task duration is over. As soon as maxRowsPerSegment,
maxTotalRows or intermediateHandoffPeriod limit is hit, all the segments held by the task at that point in time will be handed-off
and new set of segments will be created for further events. This means that the task can run for longer durations of time
without accumulating old segments locally on Middle Manager processes and it is encouraged to do so.

Kafka Indexing Service may still produce some small segments. Lets say the task duration is 4 hours, segment granularity
is set to an HOUR and Supervisor was started at 9:10 then after 4 hours at 13:10, new set of tasks will be started and
events for the interval 13:00 - 14:00 may be split across previous and new set of tasks. If you see it becoming a problem then
one can schedule re-indexing tasks be run to merge segments together into new segments of an ideal size (in the range of ~500-700 MB per segment).
Details on how to optimize the segment size can be found on [Segment size optimization](../../operations/segment-optimization.md).
There is also ongoing work to support automatic segment compaction of sharded segments as well as compaction not requiring
Hadoop (see [here](https://github.com/apache/druid/pull/5102)).


## Apache Kafka 摄取数据


### 教程

本页包含基于Apache Kafka的摄取的参考文档。同样，您可以查看 [Apache Kafka教程](../tutorials/chapter-2.md) 中的加载。

### 提交一个supervisor规范

Kafka索引服务需要同时在Overlord和MiddleManagers中加载 `druid-kafka-indexing-service` 扩展。 用于一个数据源的supervisor通过向 `http://<OVERLORD_IP>:<OVERLORD_PORT>/druid/indexer/v1/supervisor` 发送一个HTTP POST请求来启动，例如：

```json
curl -X POST -H 'Content-Type: application/json' -d @supervisor-spec.json http://localhost:8090/druid/indexer/v1/supervisor
```

一个示例supervisor规范如下：
```json
{
  "type": "kafka",
  "dataSchema": {
    "dataSource": "metrics-kafka",
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [],
      "dimensionExclusions": [
        "timestamp",
        "value"
      ]
    },
    "metricsSpec": [
      {
        "name": "count",
        "type": "count"
      },
      {
        "name": "value_sum",
        "fieldName": "value",
        "type": "doubleSum"
      },
      {
        "name": "value_min",
        "fieldName": "value",
        "type": "doubleMin"
      },
      {
        "name": "value_max",
        "fieldName": "value",
        "type": "doubleMax"
      }
    ],
    "granularitySpec": {
      "type": "uniform",
      "segmentGranularity": "HOUR",
      "queryGranularity": "NONE"
    }
  },
  "tuningConfig": {
    "type": "kafka",
    "maxRowsPerSegment": 5000000
  },
  "ioConfig": {
    "topic": "metrics",
    "inputFormat": {
      "type": "json"
    },
    "consumerProperties": {
      "bootstrap.servers": "localhost:9092"
    },
    "taskCount": 1,
    "replicas": 1,
    "taskDuration": "PT1H"
  }
}
```

### supervisor配置

| 字段 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | supervisor类型， 总是 `kafka` | 是 |
| `dataSchema` | Kafka索引服务在摄取时使用的schema。详情见 [dataSchema](ingestion.md#dataschema)  | 是 |
| `ioConfig` | 用于配置supervisor和索引任务的KafkaSupervisorIOConfig，详情见以下 | 是 |
| `tuningConfig` | 用于配置supervisor和索引任务的KafkaSupervisorTuningConfig，详情见以下 | 是 |

#### KafkaSupervisorTuningConfig

`tuningConfig` 是可选的， 如果未被配置的话，则使用默认的参数。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 索引任务类型， 总是 `kafka` | 是 |
| `maxRowsInMemory` | Integer | 在持久化之前在内存中聚合的最大行数。该数值为聚合之后的行数，所以它不等于原始输入事件的行数，而是事件被聚合后的行数。 通常用来管理所需的JVM堆内存。 使用 `maxRowsInMemory * (2 + maxPendingPersists) ` 来当做索引任务的最大堆内存。通常用户不需要设置这个值，但是也需要根据数据的特点来决定，如果行的字节数较短，用户可能不想在内存中存储一百万行，应该设置这个值 | 否（默认为 1000000）|
| `maxBytesInMemory` | Long | 在持久化之前在内存中聚合的最大字节数。这是基于对内存使用量的粗略估计，而不是实际使用量。通常这是在内部计算的，用户不需要设置它。 索引任务的最大内存使用量是 `maxRowsInMemory * (2 + maxPendingPersists) ` | 否（默认为最大JVM内存的 1/6） |
| `maxRowsPerSegment` | Integer | 聚合到一个段中的行数，该数值为聚合后的数值。 当 `maxRowsPerSegment` 或者 `maxTotalRows` 有一个值命中的时候，则触发handoff（数据落盘后传到深度存储）， 该动作也会按照每 `intermediateHandoffPeriod` 时间间隔发生一次。 | 否（默认为5000000） |
| `maxTotalRows` | Long | 所有段的聚合后的行数，该值为聚合后的行数。当 `maxRowsPerSegment` 或者 `maxTotalRows` 有一个值命中的时候，则触发handoff（数据落盘后传到深度存储）， 该动作也会按照每 `intermediateHandoffPeriod` 时间间隔发生一次。 | 否（默认为unlimited）|
| `intermediateHandoffPeriod` | ISO8601 Period | 确定触发持续化存储的周期 | 否（默认为 PT10M）|
| `maxPendingPersists` | Integer | 正在等待但启动的持久化过程的最大数量。 如果新的持久化任务超过了此限制，则在当前运行的持久化完成之前，摄取将被阻止。索引任务的最大内存使用量是 `maxRowsInMemory * (2 + maxPendingPersists) ` | 否（默认为0，意味着一个持久化可以与摄取同时运行，而没有一个可以排队）|
| `indexSpec` | Object | 调整数据被如何索引。详情可以见 [indexSpec](#indexspec) | 否 |
| `indexSpecForIntermediatePersists` | | 定义要在索引时用于中间持久化临时段的段存储格式选项。这可用于禁用中间段上的维度/度量压缩，以减少最终合并所需的内存。但是，在中间段上禁用压缩可能会增加页缓存的使用，而在它们被合并到发布的最终段之前使用它们，有关可能的值，请参阅IndexSpec。 | 否（默认与 `indexSpec` 相同） |
| `reportParseExceptions` | Boolean | *已废弃*。如果为true，则在解析期间遇到的异常即停止摄取；如果为false，则将跳过不可解析的行和字段。将 `reportParseExceptions` 设置为 `true` 将覆盖`maxParseExceptions` 和 `maxSavedParseExceptions` 的现有配置，将`maxParseExceptions` 设置为 `0` 并将 `maxSavedParseExceptions` 限制为不超过1。 | 否（默认为false）|
| `handoffConditionTimeout` | Long | 段切换（持久化）可以等待的毫秒数（超时时间）。 该值要被设置为大于0的数，设置为0意味着将会一直等待不超时 | 否（默认为0）|
| `resetOffsetAutomatically` | Boolean | 控制当Druid需要读取Kafka中不可用的消息时的行为，比如当发生了 `OffsetOutOfRangeException` 异常时。 <br> 如果为false，则异常将抛出，这将导致任务失败并停止接收。如果发生这种情况，则需要手动干预来纠正这种情况；可能使用 [重置 Supervisor API](../operations/api-reference.md#Supervisor)。此模式对于生产非常有用，因为它将使您意识到摄取的问题。 <br> 如果为true，Druid将根据 `useEarliestOffset` 属性的值（`true` 为 `earliest`，`false` 为 `latest`）自动重置为Kafka中可用的较早或最新偏移量。请注意，这可能导致数据在您不知情的情况下*被丢弃*（如果`useEarliestOffset` 为 `false`）或 *重复*（如果 `useEarliestOffset` 为 `true`）。消息将被记录下来，以标识已发生重置，但摄取将继续。这种模式对于非生产环境非常有用，因为它将使Druid尝试自动从问题中恢复，即使这些问题会导致数据被安静删除或重复。 <br> 该特性与Kafka的 `auto.offset.reset` 消费者属性很相似 | 否（默认为false）|
| `workerThreads` | Integer | supervisor用于异步操作的线程数。| 否（默认为: min(10, taskCount)） |
| `chatThreads` | Integer | 与索引任务的会话线程数 | 否（默认为：min(10, taskCount * replicas)）|
| `chatRetries` | Integer | 在任务没有响应之前，将重试对索引任务的HTTP请求的次数 | 否（默认为8）|
| `httpTimeout` | ISO8601 Period | 索引任务的HTTP响应超时 | 否（默认为PT10S）|
| `shutdownTimeout` | ISO8601 Period | supervisor尝试优雅的停掉一个任务的超时时间 | 否（默认为：PT80S）|
| `offsetFetchPeriod` | ISO8601 Period | supervisor查询Kafka和索引任务以获取当前偏移和计算滞后的频率 | 否（默认为PT30S，最小为PT5S）|
| `segmentWriteOutMediumFactory` | Object | 创建段时要使用的段写入介质。更多信息见下文。| 否（默认不指定，使用来源于 `druid.peon.defaultSegmentWriteOutMediumFactory.type` 的值）|
| `intermediateHandoffPeriod` | ISO8601 Period | 段发生切换的频率。当 `maxRowsPerSegment` 或者 `maxTotalRows` 有一个值命中的时候，则触发handoff（数据落盘后传到深度存储）， 该动作也会按照每 `intermediateHandoffPeriod` 时间间隔发生一次。 | 否（默认为：P2147483647D）|
| `logParseExceptions` | Boolean | 如果为true，则在发生解析异常时记录错误消息，其中包含有关发生错误的行的信息。| 否（默认为false）|
| `maxParseExceptions` | Integer | 任务停止接收之前可发生的最大分析异常数。如果设置了 `reportParseExceptions`，则该值会被重写。| 否（默认为unlimited）|
| `maxSavedParseExceptions` | Integer | 当出现解析异常时，Druid可以跟踪最新的解析异常。"maxSavedParseExceptions"决定将保存多少个异常实例。这些保存的异常将在 [任务完成报告](taskrefer.md#任务报告) 中的任务完成后可用。如果设置了`reportParseExceptions`，则该值会被重写。 | 否（默认为0）|

##### IndexSpec

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|-|
| `bitmap` | Object | 位图索引的压缩格式。 应该是一个JSON对象，详情见以下 | 否（默认为 `roaring`）|
| `dimensionCompression` | String | 维度列的压缩格式。 从 `LZ4`, `LZF` 或者 `uncompressed` 选择 | 否（默认为 `LZ4`）|
| `metricCompression` | String | Metrics列的压缩格式。 从 `LZ4`, `LZF`, `uncompressed` 或者 `none` 选择 | 否（默认为 `LZ4`）|
| `longEncoding` | String | 类型为long的Metric列和维度列的编码格式。从 `auto` 或者 `longs` 中选择。`auto`编码是根据列基数使用偏移量或查找表对值进行编码，并以可变大小存储它们。`longs` 按原样存储值，每个值8字节。 | 否（默认为 `longs`）|

**Bitmap类型**

对于Roaring位图：

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 必须为 `roaring` | 是 |
| `compressRunOnSerialization` | Boolean | 使用一个运行长度编码，可以更节省空间 | 否（默认为 `true` ）|

对于Concise位图：

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 必须为 `concise` | 是 |

##### SegmentWriteOutMediumFactory

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 对于可用选项，可以见 [额外的Peon配置：SegmentWriteOutMediumFactory](../configuration/human-readable-byte.md#SegmentWriteOutMediumFactory) | 是 |

#### KafkaSupervisorIOConfig

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `topic` | String | 要读取数据的Kafka主题。这必须是一个特定的主题，因为不支持主题模式 | 是 |
| `inputFormat` | Object | [`inputFormat`](dataformats.md#inputformat) 指定如何解析输入数据。 看 [下边部分](#指定输入数据格式) 查看指定输入格式的详细信息。 | 是 |
| `consumerProperties` | Map<String, Object> | 传给Kafka消费者的一组属性map。必须得包含 `bootstrap.servers` 的属性，其值为Kafka Broker列表，格式为: `<BROKER_1>:<PORT_1>,<BROKER_2>:<PORT_2>,...`。 对于SSL连接，`keystore`, `truststore` 和 `key` 密码可以被以一个字符串密码或者 [密码Provider](../operations/passwordproviders.md) 来提供 | 是 |
| `pollTimeout` | Long | Kafka消费者拉取消息记录的超时等待时间，毫秒单位 | 否（默认为100）|
| `replicas` | Integer | 副本的数量，1意味着一个单一任务（无副本）。副本任务将始终分配给不同的worker，以提供针对流程故障的恢复能力。| 否（默认为1）|
| `taskCount` | Integer | *一个副本集* 中*读取*任务的最大数量。 这意味着读取任务的最大的数量将是 `taskCount * replicas`, 任务总数（*读取 + 发布*）是大于这个数字的。 详情可以看下边的 [容量规划](#容量规划)。 如果 `taskCount > {numKafkaPartitions}`, 读取任务的数量会小于 `taskCount` | 否（默认为1）|
| `taskDuration` | ISO8601 Period | 任务停止读取数据、开始发布段之前的时间长度 | 否（默认为PT1H）|
| `startDelay` | ISO8601 Period | supervisor开始管理任务之前的等待时间 | 否（默认为PT5S）|
| `useEarliestOffset` | Boolean | 如果supervisor是第一次管理数据源，它将从Kafka获得一组起始偏移。此标志确定它是检索Kafka中的最早偏移量还是最新偏移量。在正常情况下，后续任务将从先前段结束的位置开始，因此此标志将仅在首次运行时使用。 | 否（默认false）|
| `completionTimeout` | ISO8601 Period | 声明发布任务为失败并终止它 之前等待的时间长度。如果设置得太低，则任务可能永远不会发布。任务的发布时刻大约在 `taskDuration` (任务持续)时间过后开始。 | 否（默认为PT30M）|
| `lateMessageRejectionStartDateTime` | ISO8601 DateTime | 用来配置一个时间，当消息时间戳早于此日期时间的时候，消息被拒绝。 例如，如果该值设置为 `2016-01-01T11:00Z`, supervisor在 *`2016-01-01T12:00Z`* 创建了一个任务，时间戳早于 *2016-01-01T11:00Z* 的消息将会被丢弃。如果您的数据流有延迟消息，并且您有多个需要在同一段上操作的管道（例如实时和夜间批处理摄取管道），这可能有助于防止并发问题。 | 否（默认为none）|
| `lateMessageRejectionPeriod` | ISO8601 Period | 用来配置一个时间周期，当消息时间戳早于此周期的时候，消息被拒绝。例如，如果该值设置为 `PT1H`, supervisor 在 `2016-01-01T12:00Z` 创建了一个任务，则时间戳早于 `2016-01-01T11:00Z` 的消息将被丢弃。 如果您的数据流有延迟消息，并且您有多个需要在同一段上操作的管道（例如实时和夜间批处理摄取管道），这可能有助于防止并发问题。 **请特别注意**，`lateMessageRejectionPeriod` 和 `lateMessageRejectionStartDateTime` 仅一个可以被指定。 | 否（默认none）|
| `earlyMessageRejectionPeriod` | ISO8601 Period | 用来配置一个时间周期，当消息时间戳晚于此周期的时候，消息被拒绝。 例如，如果该值设置为 `PT1H`,supervisor 在 `2016-01-01T12:00Z` 创建了一个任务，则时间戳晚于 `2016-01-01T14:00Z` 的消息将被丢弃。**注意**，任务有时会超过其任务持续时间，例如，在supervisor故障转移的情况下。如果将 `earlyMessageRejectionPeriod` 设置得太低，则每当任务运行超过其最初配置的任务持续时间时，可能会导致消息意外丢弃。| 否（默认none）|

##### 指定输入数据格式

Kafka索引服务同时支持通过 [`inputFormat`](dataformats.md#inputformat) 和 [`parser`](dataformats.md#parser) 来指定数据格式。 `inputFormat` 是一种新的且推荐的用于Kafka索引服务中指定数据格式的方式，但是很遗憾的是目前它还不支持过时的 `parser` 所有支持的所有格式（未来会支持）。

`inputFormat` 支持的格式包括 [`csv`](dataformats.md#csv), [`delimited`](dataformats.md#TSV(Delimited)), [`json`](dataformats.md#json)。可以使用 `parser` 来读取 [`avro_stream`](dataformats.md#AvroStreamParser), [`protobuf`](dataformats.md#ProtobufParser), [`thrift`](../development/overview.md) 格式的数据。

### 操作

本节描述了一些supervisor API如何在Kafka索引服务中具体工作。对于所有的supervisor API，请查看 [Supervisor APIs](../operations/api-reference.md#Supervisor)

#### 获取supervisor的状态报告

`GET /druid/indexer/v1/supervisor/<supervisorId>/status` 返回由给定supervisor管理的任务当前状态的快照报告。报告中包括Kafka报告的最新偏移量、每个分区的使用者延迟，以及所有分区的聚合延迟。如果supervisor没有收到来自Kafka的最新偏移响应，则每个分区的使用者延迟可以报告为负值。聚合滞后值将始终大于等于0。

状态报告还包含supervisor的状态和最近引发的异常列表（报告为`recentErrors`，其最大大小可以使用 `druid.supervisor.maxStoredExceptionEvents` 配置进行控制）。有两个字段与supervisor的状态相关- `state` 和 `detailedState`。`state` 字段将始终是少数适用于任何类型的supervisor的通用状态之一，而 `detailedState` 字段将包含一个更具描述性的、特定实现的状态，该状态可以比通用状态字段更深入地了解supervisor的活动。

`state` 可能的值列表为：[`PENDING`, `RUNNING`, `SUSPENDED`, `STOPPING`, `UNHEALTHY_SUPERVISOR`, `UNHEALTHY_TASKS`]

`detailedState`值与它们相应的 `state` 映射关系如下：

| Detailed State | 相应的State | 描述 |
|-|-|-|
| UNHEALTHY_SUPERVISOR | UNHEALTHY_SUPERVISOR | supervisor在过去的 `druid.supervisor.unhealthinessThreshold` 内已经发生了错误 |
| UNHEALTHY_TASKS | UNHEALTHY_TASKS | 过去 `druid.supervisor.taskUnhealthinessThreshold` 内的任务全部失败了 |
| UNABLE_TO_CONNECT_TO_STREAM | UNHEALTHY_SUPERVISOR | supervisor遇到与Kafka的连接问题，过去没有成功连接过 |
| LOST_CONTACT_WITH_STREAM | UNHEALTHY_SUPERVISOR | supervisor遇到与Kafka的连接问题，但是在过去成功连接过 |
| PENDING（仅在第一次迭代中）| PENDING | supervisor已初始化，尚未开始连接到流 |
| CONNECTING_TO_STREAM（仅在第一次迭代中） | RUNNING | supervisor正在尝试连接到流并更新分区数据 |
| DISCOVERING_INITIAL_TASKS（仅在第一次迭代中） | RUNNING | supervisor正在发现已在运行的任务 |
| CREATING_TASKS（仅在第一次迭代中） | RUNNING | supervisor正在创建任务并发现状态 |
| RUNNING | RUNNING | supervisor已启动任务，正在等待任务持续时间结束 |
| SUSPENDED | SUSPENDED | supervisor被挂起 |
| STOPPING | STOPPING | supervisor正在停止 |

在supervisor运行循环的每次迭代中，supervisor按顺序完成以下任务：

1. 从Kafka获取分区列表并确定每个分区的起始偏移量（如果继续，则基于最后处理的偏移量，如果这是一个新主题，则从流的开始或结束开始）。
2. 发现正在写入supervisor数据源的任何正在运行的索引任务，如果这些任务与supervisor的配置匹配，则采用这些任务，否则发出停止的信号。
3. 向每个受监视的任务发送状态请求，以更新我们对受监视任务的状态的视图。
4. 处理已超过 `taskDuration(任务持续时间)` 且应从读取状态转换为发布状态的任务。
5. 处理已完成发布的任务，并发出停止冗余副本任务的信号。
6. 处理失败的任务并清理supervisor的内部状态。
7. 将正常任务列表与请求的 `taskCount` 和 `replicas` 进行比较，并根据需要创建其他任务。

`detailedState` 字段将在supervisor启动后或从挂起恢复后第一次执行此运行循环时显示附加值（上述表格中那些标记为"仅限第一次迭代"的值）。这是为了解决初始化类型问题，即supervisor无法达到稳定状态（可能是因为它无法连接到Kafka，无法读取Kafka主题，或者无法与现有任务通信）。一旦supervisor稳定（也就是说，一旦完成完整的执行而没有遇到任何问题），`detailedState` 将显示 `RUNNING` 状态，直到它停止、挂起或达到故障阈值并过渡到不正常状态。

#### 获取supervisor摄取状态报告

`GET /druid/indexer/v1/supervisor/<supervisorId>/stats` 返回由supervisor管理的每个任务的当前摄取行计数器的快照，以及行计数器的移动平均值。

可以在 [任务报告：行画像](taskrefer.md#行画像) 中查看详细信息。

#### supervisor健康检测

如果supervisor是健康的，则 `GET /druid/indexer/v1/supervisor/<supervisorId>/health` 返回 `200 OK`, 如果是不健康的，则返回 `503 Service Unavailable` 。 健康状态是根据supervisor的 `state` （通过 `/status` 接口返回） 和 Overlord配置的阈值 `druid.supervisor.*` 来决定的。

#### 更新现有的supervisor

`POST /druid/indexer/v1/supervisor` 可以被用来更新现有的supervisor规范。如果已存在同一数据源的现有supervisor，则调用此接口将导致：

* 正在运行的supervisor对其管理的任务发出停止读取并开始发布的信号
* 正在运行的supervisor退出
* 使用请求正文中提供的配置创建新的supervisor。该supervisor将保留现有的发布任务，并将从发布任务结束时的偏移开始创建新任务

因此，只需使用这个接口来提交新的schema，就可以实现无缝的schema迁移。

#### 暂停和恢复supervisors

可以通过 `POST /druid/indexer/v1/supervisor/<supervisorId>/suspend` 和 `POST /druid/indexer/v1/supervisor/<supervisorId>/resume` 来暂停挂起和恢复一个supervisor。

注意，supervisor本身仍在运行并发出日志和metrics，它只会确保在supervisor恢复之前没有索引任务正在运行。

#### 重置supervisors

`POST/druid/indexer/v1/supervisor/<supervisorId>/reset` 操作清除存储的偏移量，使supervisor开始从Kafka中最早或最新的偏移量读取偏移量（取决于`useEarliestOffset`的值）。清除存储的偏移量后，supervisor将终止并重新创建任务，以便任务开始从有效偏移量读取数据。

**使用此操作时请小心！** 重置supervisor可能会导致跳过或读取Kafka消息两次，从而导致数据丢失或重复。

使用此操作的原因是：从由于缺少偏移而导致supervisor停止操作的状态中恢复。索引服务跟踪最新的持久化Kafka偏移量，以便跨任务提供准确的一次摄取保证。后续任务必须从上一个任务完成的位置开始读取，以便接受生成的段。如果Kafka中不再提供预期起始偏移量的消息（通常是因为消息保留期已过或主题已被删除并重新创建），supervisor将拒绝启动，在运行状态下的任务将失败。此操作使您能够从此情况中恢复。

**请注意，要使此接口可用，必须运行supervisor。**

#### 终止supervisors

`POST /druid/indexer/v1/supervisor/<supervisorId>/terminate` 操作终止一个supervisor，并导致由该supervisor管理的所有关联的索引任务立即停止并开始发布它们的段。此supervisor仍将存在于元数据存储中，可以使用supervisor的历史API检索其历史记录，但不会在 "Get supervisor" API响应中列出，也无法检索其配置或状态报告。这个supervisor可以重新启动的唯一方法是向 "create" API提交一个正常工作的supervisor规范。

#### 容量规划

Kafka索引任务运行在MiddleManager上，因此，其受限于MiddleManager集群的可用资源。 特别是，您应该确保有足够的worker（使用 `druid.worker.capacity` 属性配置）来处理supervisor规范中的配置。请注意，worker是在所有类型的索引任务之间共享的，因此，您应该计划好worker处理索引总负载的能力（例如批处理、实时任务、合并任务等）。如果您的worker不足，Kafka索引任务将排队并等待下一个可用的worker。这可能会导致查询只返回部分结果，但不会导致数据丢失（假设任务在Kafka清除这些偏移之前运行）。

正在运行的任务通常处于两种状态之一：*读取(reading)*或*发布(publishing)*。任务将在 `taskDuration(任务持续时间)` 内保持读取状态，在这时将转换为发布状态。只要生成段、将段推送到深层存储并由Historical进程加载和服务（或直到 `completionTimeout` 结束），任务将保持发布状态。

读取任务的数量由 `replicas` 和 `taskCount` 控制。 一般， 一共有 `replicas * taskCount` 个读取任务， 存在一个例外是当 taskCount > {numKafkaPartitions}, 在这种情况时 {numKafkaPartitions}个任务将被使用。 当 `taskDuration` 结束时，这些任务将被转换为发布状态并创建 `replicas * taskCount` 个新的读取任务。 因此，为了使得读取任务和发布任务可以并发的运行， 最小的容量应该是：

```json
workerCapacity = 2 * replicas * taskCount
```

此值适用于这样一种理想情况：最多有一组任务正在发布，而另一组任务正在读取。在某些情况下，可以同时发布多组任务。如果发布时间（生成段、推送到深层存储、加载到历史记录中）> `taskDuration`，就会发生这种情况。这是一个有效的场景（正确性方面），但需要额外的worker容量来支持。一般来说，最好将 `taskDuration` 设置得足够大，以便在当前任务集开始之前完成上一个任务集的发布。

#### supervisor持久化

当通过 `POST /druid/indexer/v1/supervisor` 接口提交一个supervisor规范时，它将被持久化在配置的元数据数据库中。每个数据源只能有一个supervisor，为同一数据源提交第二个规范将覆盖前一个规范。

当一个Overlord获得领导地位时，无论是通过启动还是由于另一个Overlord失败，它都将为元数据数据库中的每个supervisor规范生成一个supervisor。然后，supervisor将发现正在运行的Kafka索引任务，如果它们与supervisor的配置兼容，则将尝试采用它们。如果它们不兼容，因为它们具有不同的摄取规范或分区分配，则任务将被终止，supervisor将创建一组新任务。这样，supervisor就可以在Overlord重启和故障转移期间坚持不懈地工作。

supervisor通过 `POST /druid/indexer/v1/supervisor/<supervisorId>/` 终止接口停止。这将在数据库中放置一个逻辑删除标记（以防止重新启动时重新加载supervisor），然后优雅地关闭当前运行的supervisor。当supervisor以这种方式关闭时，它将指示其托管的任务停止读取并立即开始发布其段。对关闭接口的调用将在所有任务发出停止信号后，但在任务完成其段的发布之前返回。

#### schema/配置变更

schema和配置更改是通过最初用于创建supervisor的 `POST /druid/indexer/v1/supervisor` 接口提交新的supervisor规范来处理的。Overlord将当前运行的supervisor优雅地关闭，这将导致由该supervisor管理的任务停止读取并开始发布其段。然后将启动一个新的supervisor，该supervisor将创建一组新的任务，这些任务将从先前发布任务关闭的偏移开始读取，但使用更新的schema。通过这种方式，可以在无需暂停摄取的条件下更新应用配置。

#### 部署注意

每个Kafka索引任务将从分配给它的Kafka分区中消费的事件放在每个段粒度间隔的单个段中，直到达到 `maxRowsPerSegment`、`maxTotalRows` 或 `intermediateHandoffPeriod` 限制，此时将为进一步的事件创建此段粒度的新分区。Kafka索引任务还执行增量移交，这意味着任务创建的所有段在任务持续时间结束之前都不会被延迟。一旦达到 `maxRowsPerSegment`、`maxTotalRows` 或 `intermediateHandoffPeriod` 限制，任务在该时间点持有的所有段都将被传递，并且将为进一步的事件创建新的段集。这意味着任务可以运行更长的时间，而不必在MiddleManager进程的本地累积旧段，因此鼓励这样做。

Kafka索引服务可能仍然会产生一些小片段。假设任务持续时间为4小时，段粒度设置为1小时，supervisor在9:10启动，然后在13:10的4小时后，将启动新的任务集，并且间隔13:00-14:00的事件可以跨以前的和新的任务集拆分。如果您发现这成为一个问题，那么可以调度重新索引任务，以便将段合并到理想大小的新段中（每个段大约500-700 MB）。有关如何优化段大小的详细信息，请参见 ["段大小优化"](../operations/segmentSizeOpt.md)。还有一些工作正在进行，以支持碎片段的自动段压缩，以及不需要Hadoop的压缩(参见[此处](https://github.com/apache/druid/pull/5102))。

