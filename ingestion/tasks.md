---
id: tasks
title: "Task reference"
---

<!--
  ~ Licensed to the Apache Software Foundation (ASF) under one
  ~ or more contributor license agreements.  See the NOTICE file
  ~ distributed with this work for additional information
  ~ regarding copyright ownership.  The ASF licenses this file
  ~ to you under the Apache License, Version 2.0 (the
  ~ "License"); you may not use this file except in compliance
  ~ with the License.  You may obtain a copy of the License at
  ~
  ~   http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~ Unless required by applicable law or agreed to in writing,
  ~ software distributed under the License is distributed on an
  ~ "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  ~ KIND, either express or implied.  See the License for the
  ~ specific language governing permissions and limitations
  ~ under the License.
  -->

Tasks do all [ingestion](index.md)-related work in Druid.

For batch ingestion, you will generally submit tasks directly to Druid using the
[Task APIs](../operations/api-reference.md#tasks). For streaming ingestion, tasks are generally submitted for you by a
supervisor.

## Task API

Task APIs are available in two main places:

- The [Overlord](../design/overlord.md) process offers HTTP APIs to submit tasks, cancel tasks, check their status,
review logs and reports, and more. Refer to the [Tasks API reference page](../operations/api-reference.md#tasks) for a
full list.
- Druid SQL includes a [`sys.tasks`](../querying/sql.md#tasks-table) table that provides information about currently
running tasks. This table is read-only, and has a limited (but useful!) subset of the full information available through
the Overlord APIs.

<a name="reports"></a>

## Task reports

A report containing information about the number of rows ingested, and any parse exceptions that occurred is available for both completed tasks and running tasks.

The reporting feature is supported by the [simple native batch task](../ingestion/native-batch.md#simple-task), the Hadoop batch task, and Kafka and Kinesis ingestion tasks.

### Completion report

After a task completes, a completion report can be retrieved at:

```
http://<OVERLORD-HOST>:<OVERLORD-PORT>/druid/indexer/v1/task/<task-id>/reports
```

An example output is shown below:

```json
{
  "ingestionStatsAndErrors": {
    "taskId": "compact_twitter_2018-09-24T18:24:23.920Z",
    "payload": {
      "ingestionState": "COMPLETED",
      "unparseableEvents": {},
      "rowStats": {
        "determinePartitions": {
          "processed": 0,
          "processedWithError": 0,
          "thrownAway": 0,
          "unparseable": 0
        },
        "buildSegments": {
          "processed": 5390324,
          "processedWithError": 0,
          "thrownAway": 0,
          "unparseable": 0
        }
      },
      "errorMsg": null
    },
    "type": "ingestionStatsAndErrors"
  }
}
```

### Live report

When a task is running, a live report containing ingestion state, unparseable events and moving average for number of events processed for 1 min, 5 min, 15 min time window can be retrieved at:

```
http://<OVERLORD-HOST>:<OVERLORD-PORT>/druid/indexer/v1/task/<task-id>/reports
```

and 

```
http://<middlemanager-host>:<worker-port>/druid/worker/v1/chat/<task-id>/liveReports
```

An example output is shown below:

```json
{
  "ingestionStatsAndErrors": {
    "taskId": "compact_twitter_2018-09-24T18:24:23.920Z",
    "payload": {
      "ingestionState": "RUNNING",
      "unparseableEvents": {},
      "rowStats": {
        "movingAverages": {
          "buildSegments": {
            "5m": {
              "processed": 3.392158326408501,
              "unparseable": 0,
              "thrownAway": 0,
              "processedWithError": 0
            },
            "15m": {
              "processed": 1.736165476881023,
              "unparseable": 0,
              "thrownAway": 0,
              "processedWithError": 0
            },
            "1m": {
              "processed": 4.206417693750045,
              "unparseable": 0,
              "thrownAway": 0,
              "processedWithError": 0
            }
          }
        },
        "totals": {
          "buildSegments": {
            "processed": 1994,
            "processedWithError": 0,
            "thrownAway": 0,
            "unparseable": 0
          }
        }
      },
      "errorMsg": null
    },
    "type": "ingestionStatsAndErrors"
  }
}
```

A description of the fields:

The `ingestionStatsAndErrors` report provides information about row counts and errors.

The `ingestionState` shows what step of ingestion the task reached. Possible states include:
* `NOT_STARTED`: The task has not begun reading any rows
* `DETERMINE_PARTITIONS`: The task is processing rows to determine partitioning
* `BUILD_SEGMENTS`: The task is processing rows to construct segments
* `COMPLETED`: The task has finished its work.

Only batch tasks have the DETERMINE_PARTITIONS phase. Realtime tasks such as those created by the Kafka Indexing Service do not have a DETERMINE_PARTITIONS phase.

`unparseableEvents` contains lists of exception messages that were caused by unparseable inputs. This can help with identifying problematic input rows. There will be one list each for the DETERMINE_PARTITIONS and BUILD_SEGMENTS phases. Note that the Hadoop batch task does not support saving of unparseable events.

the `rowStats` map contains information about row counts. There is one entry for each ingestion phase. The definitions of the different row counts are shown below:
* `processed`: Number of rows successfully ingested without parsing errors
* `processedWithError`: Number of rows that were ingested, but contained a parsing error within one or more columns. This typically occurs where input rows have a parseable structure but invalid types for columns, such as passing in a non-numeric String value for a numeric column.
* `thrownAway`: Number of rows skipped. This includes rows with timestamps that were outside of the ingestion task's defined time interval and rows that were filtered out with a [`transformSpec`](index.md#transformspec), but doesn't include the rows skipped by explicit user configurations. For example, the rows skipped by `skipHeaderRows` or `hasHeaderRow` in the CSV format are not counted.
* `unparseable`: Number of rows that could not be parsed at all and were discarded. This tracks input rows without a parseable structure, such as passing in non-JSON data when using a JSON parser.

The `errorMsg` field shows a message describing the error that caused a task to fail. It will be null if the task was successful.

## Live reports

### Row stats

The non-parallel [simple native batch task](../ingestion/native-batch.md#simple-task), the Hadoop batch task, and Kafka and Kinesis ingestion tasks support retrieval of row stats while the task is running.

The live report can be accessed with a GET to the following URL on a Peon running a task:

```
http://<middlemanager-host>:<worker-port>/druid/worker/v1/chat/<task-id>/rowStats
```

An example report is shown below. The `movingAverages` section contains 1 minute, 5 minute, and 15 minute moving averages of increases to the four row counters, which have the same definitions as those in the completion report. The `totals` section shows the current totals.

```
{
  "movingAverages": {
    "buildSegments": {
      "5m": {
        "processed": 3.392158326408501,
        "unparseable": 0,
        "thrownAway": 0,
        "processedWithError": 0
      },
      "15m": {
        "processed": 1.736165476881023,
        "unparseable": 0,
        "thrownAway": 0,
        "processedWithError": 0
      },
      "1m": {
        "processed": 4.206417693750045,
        "unparseable": 0,
        "thrownAway": 0,
        "processedWithError": 0
      }
    }
  },
  "totals": {
    "buildSegments": {
      "processed": 1994,
      "processedWithError": 0,
      "thrownAway": 0,
      "unparseable": 0
    }
  }
}
```

For the Kafka Indexing Service, a GET to the following Overlord API will retrieve live row stat reports from each task being managed by the supervisor and provide a combined report.

```
http://<OVERLORD-HOST>:<OVERLORD-PORT>/druid/indexer/v1/supervisor/<supervisor-id>/stats
```

### Unparseable events

Lists of recently-encountered unparseable events can be retrieved from a running task with a GET to the following Peon API:

```
http://<middlemanager-host>:<worker-port>/druid/worker/v1/chat/<task-id>/unparseableEvents
```

Note that this functionality is not supported by all task types. Currently, it is only supported by the
non-parallel [native batch task](../ingestion/native-batch.md) (type `index`) and the tasks created by the Kafka
and Kinesis indexing services.

<a name="locks"></a>

## Task lock system

This section explains the task locking system in Druid. Druid's locking system
and versioning system are tightly coupled with each other to guarantee the correctness of ingested data.

## "Overshadowing" between segments

You can run a task to overwrite existing data. The segments created by an overwriting task _overshadows_ existing segments.
Note that the overshadow relation holds only for the same time chunk and the same data source.
These overshadowed segments are not considered in query processing to filter out stale data.

Each segment has a _major_ version and a _minor_ version. The major version is
represented as a timestamp in the format of [`"yyyy-MM-dd'T'hh:mm:ss"`](https://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat)
while the minor version is an integer number. These major and minor versions
are used to determine the overshadow relation between segments as seen below. 

A segment `s1` overshadows another `s2` if

- `s1` has a higher major version than `s2`, or
- `s1` has the same major version and a higher minor version than `s2`.

Here are some examples.

- A segment of the major version of `2019-01-01T00:00:00.000Z` and the minor version of `0` overshadows
 another of the major version of `2018-01-01T00:00:00.000Z` and the minor version of `1`.
- A segment of the major version of `2019-01-01T00:00:00.000Z` and the minor version of `1` overshadows
 another of the major version of `2019-01-01T00:00:00.000Z` and the minor version of `0`.

## Locking

If you are running two or more [druid tasks](./tasks.md) which generate segments for the same data source and the same time chunk,
the generated segments could potentially overshadow each other, which could lead to incorrect query results.

To avoid this problem, tasks will attempt to get locks prior to creating any segment in Druid.
There are two types of locks, i.e., _time chunk lock_ and _segment lock_.

When the time chunk lock is used, a task locks the entire time chunk of a data source where generated segments will be written.
For example, suppose we have a task ingesting data into the time chunk of `2019-01-01T00:00:00.000Z/2019-01-02T00:00:00.000Z` of the `wikipedia` data source.
With the time chunk locking, this task will lock the entire time chunk of `2019-01-01T00:00:00.000Z/2019-01-02T00:00:00.000Z` of the `wikipedia` data source
before it creates any segments. As long as it holds the lock, any other tasks will be unable to create segments for the same time chunk of the same data source.
The segments created with the time chunk locking have a _higher_ major version than existing segments. Their minor version is always `0`.

When the segment lock is used, a task locks individual segments instead of the entire time chunk.
As a result, two or more tasks can create segments for the same time chunk of the same data source simultaneously
if they are reading different segments.
For example, a Kafka indexing task and a compaction task can always write segments into the same time chunk of the same data source simultaneously.
The reason for this is because a Kafka indexing task always appends new segments, while a compaction task always overwrites existing segments.
The segments created with the segment locking have the _same_ major version and a _higher_ minor version.

> The segment locking is still experimental. It could have unknown bugs which potentially lead to incorrect query results.

To enable segment locking, you may need to set `forceTimeChunkLock` to `false` in the [task context](#context).
Once `forceTimeChunkLock` is unset, the task will choose a proper lock type to use automatically.
Please note that segment lock is not always available. The most common use case where time chunk lock is enforced is
when an overwriting task changes the segment granularity.
Also, the segment locking is supported by only native indexing tasks and Kafka/Kinesis indexing tasks.
Hadoop indexing tasks don't support it.

`forceTimeChunkLock` in the task context is only applied to individual tasks.
If you want to unset it for all tasks, you would want to set `druid.indexer.tasklock.forceTimeChunkLock` to false in the [overlord configuration](../configuration/index.md#overlord-operations).

Lock requests can conflict with each other if two or more tasks try to get locks for the overlapped time chunks of the same data source.
Note that the lock conflict can happen between different locks types.

The behavior on lock conflicts depends on the [task priority](#lock-priority).
If all tasks of conflicting lock requests have the same priority, then the task who requested first will get the lock.
Other tasks will wait for the task to release the lock.

If a task of a lower priority asks a lock later than another of a higher priority,
this task will also wait for the task of a higher priority to release the lock.
If a task of a higher priority asks a lock later than another of a lower priority,
then this task will _preempt_ the other task of a lower priority. The lock
of the lower-prioritized task will be revoked and the higher-prioritized task will acquire a new lock.

This lock preemption can happen at any time while a task is running except
when it is _publishing segments_ in a critical section. Its locks become preemptible again once publishing segments is finished.

Note that locks are shared by the tasks of the same groupId.
For example, Kafka indexing tasks of the same supervisor have the same groupId and share all locks with each other.

<a name="priority"></a>

## Lock priority

Each task type has a different default lock priority. The below table shows the default priorities of different task types. Higher the number, higher the priority.

|task type|default priority|
|---------|----------------|
|Realtime index task|75|
|Batch index task|50|
|Merge/Append/Compaction task|25|
|Other tasks|0|

You can override the task priority by setting your priority in the task context as below.

```json
"context" : {
  "priority" : 100
}
```

<a name="context"></a>

## Context parameters

The task context is used for various individual task configuration. The following parameters apply to all task types.

|property|default|description|
|--------|-------|-----------|
|`taskLockTimeout`|300000|task lock timeout in millisecond. For more details, see [Locking](#locking).|
|`forceTimeChunkLock`|true|_Setting this to false is still experimental_<br/> Force to always use time chunk lock. If not set, each task automatically chooses a lock type to use. If this set, it will overwrite the `druid.indexer.tasklock.forceTimeChunkLock` [configuration for the overlord](../configuration/index.md#overlord-operations). See [Locking](#locking) for more details.|
|`priority`|Different based on task types. See [Priority](#priority).|Task priority|
|`useLineageBasedSegmentAllocation`|false in 0.21 or earlier, true in 0.22 or later|Enable the new lineage-based segment allocation protocol for the native Parallel task with dynamic partitioning. This option should be off during the replacing rolling upgrade from one of the Druid versions between 0.19 and 0.21 to Druid 0.22 or higher. Once the upgrade is done, it must be set to true to ensure data correctness.|

> When a task acquires a lock, it sends a request via HTTP and awaits until it receives a response containing the lock acquisition result.
> As a result, an HTTP timeout error can occur if `taskLockTimeout` is greater than `druid.server.http.maxIdleTime` of Overlords.

## All task types

### `index`

See [Native batch ingestion (simple task)](native-batch.md#simple-task).

### `index_parallel`

See [Native batch ingestion (parallel task)](native-batch.md#parallel-task).

### `index_sub`

Submitted automatically, on your behalf, by an [`index_parallel`](#index_parallel) task.

### `index_hadoop`

See [Hadoop-based ingestion](hadoop.md).

### `index_kafka`

Submitted automatically, on your behalf, by a
[Kafka-based ingestion supervisor](../development/extensions-core/kafka-ingestion.md).

### `index_kinesis`

Submitted automatically, on your behalf, by a
[Kinesis-based ingestion supervisor](../development/extensions-core/kinesis-ingestion.md).

### `index_realtime`

Submitted automatically, on your behalf, by [Tranquility](tranquility.md). 

### `compact`

Compaction tasks merge all segments of the given interval. See the documentation on
[compaction](compaction.md) for details.

### `kill`

Kill tasks delete all metadata about certain segments and removes them from deep storage.
See the documentation on [deleting data](../ingestion/data-management.md#delete) for details.





## 任务参考文档

任务在Druid中完成所有与 [摄取](ingestion.md) 相关的工作。

对于批量摄取，通常使用 [任务api](../operations/api-reference.md#Overlord) 直接将任务提交给Druid。对于流式接收，任务通常被提交给supervisor。

### 任务API

任务API主要在两个地方是可用的：

* [Overlord](../design/Overlord.md) 进程提供HTTP API接口来进行提交任务、取消任务、检查任务状态、查看任务日志与报告等。 查看 [任务API文档](../operations/api-reference.md) 可以看到完整列表
* Druid SQL包括了一个 [`sys.tasks`](../querying/druidsql.md#系统Schema) ，保存了当前任务运行的信息。 此表是只读的，并且可以通过Overlord API查询完整信息的有限制的子集。

### 任务报告

报告包含已完成的任务和正在运行的任务中有关接收的行数和发生的任何分析异常的信息的报表。

报告功能支持 [简单的本地批处理任务](native.md#简单任务)、Hadoop批处理任务以及Kafka和Kinesis摄取任务支持报告功能。

#### 任务结束报告

任务运行完成后，一个完整的报告可以在以下接口获取：

```json
http://<OVERLORD-HOST>:<OVERLORD-PORT>/druid/indexer/v1/task/<task-id>/reports
```

一个示例输出如下：

```json
{
  "ingestionStatsAndErrors": {
    "taskId": "compact_twitter_2018-09-24T18:24:23.920Z",
    "payload": {
      "ingestionState": "COMPLETED",
      "unparseableEvents": {},
      "rowStats": {
        "determinePartitions": {
          "processed": 0,
          "processedWithError": 0,
          "thrownAway": 0,
          "unparseable": 0
        },
        "buildSegments": {
          "processed": 5390324,
          "processedWithError": 0,
          "thrownAway": 0,
          "unparseable": 0
        }
      },
      "errorMsg": null
    },
    "type": "ingestionStatsAndErrors"
  }
}
```

#### 任务运行报告

当一个任务正在运行时， 任务运行报告可以通过以下接口获得，包括摄取状态、未解析事件和过去1分钟、5分钟、15分钟内处理的平均事件数。

```json
http://<OVERLORD-HOST>:<OVERLORD-PORT>/druid/indexer/v1/task/<task-id>/reports
``` 
和
```json
http://<middlemanager-host>:<worker-port>/druid/worker/v1/chat/<task-id>/liveReports
```

一个示例输出如下：

```json
{
  "ingestionStatsAndErrors": {
    "taskId": "compact_twitter_2018-09-24T18:24:23.920Z",
    "payload": {
      "ingestionState": "RUNNING",
      "unparseableEvents": {},
      "rowStats": {
        "movingAverages": {
          "buildSegments": {
            "5m": {
              "processed": 3.392158326408501,
              "unparseable": 0,
              "thrownAway": 0,
              "processedWithError": 0
            },
            "15m": {
              "processed": 1.736165476881023,
              "unparseable": 0,
              "thrownAway": 0,
              "processedWithError": 0
            },
            "1m": {
              "processed": 4.206417693750045,
              "unparseable": 0,
              "thrownAway": 0,
              "processedWithError": 0
            }
          }
        },
        "totals": {
          "buildSegments": {
            "processed": 1994,
            "processedWithError": 0,
            "thrownAway": 0,
            "unparseable": 0
          }
        }
      },
      "errorMsg": null
    },
    "type": "ingestionStatsAndErrors"
  }
}
```
字段的描述信息如下：

`ingestionStatsAndErrors` 提供了行数和错误数的信息

`ingestionState` 标识了摄取任务当前达到了哪一步，可能的取值包括：
* `NOT_STARTED`: 任务还没有读取任何行
* `DETERMINE_PARTITIONS`: 任务正在处理行来决定分区信息
* `BUILD_SEGMENTS`: 任务正在处理行来构建段
* `COMPLETED`: 任务已经完成

只有批处理任务具有 `DETERMINE_PARTITIONS` 阶段。实时任务（如由Kafka索引服务创建的任务）没有 `DETERMINE_PARTITIONS` 阶段。

`unparseableEvents` 包含由不可解析输入引起的异常消息列表。这有助于识别有问题的输入行。对于 `DETERMINE_PARTITIONS` 和 `BUILD_SEGMENTS` 阶段，每个阶段都有一个列表。请注意，Hadoop批处理任务不支持保存不可解析事件。

`rowStats` map包含有关行计数的信息。每个摄取阶段有一个条目。不同行计数的定义如下所示：

* `processed`: 成功摄入且没有报错的行数
* `processedWithErro`: 摄取但在一列或多列中包含解析错误的行数。这通常发生在输入行具有可解析的结构但列的类型无效的情况下，例如为数值列传入非数值字符串值
* `thrownAway`: 跳过的行数。 这包括时间戳在摄取任务定义的时间间隔之外的行，以及使用 [`transformSpec`](ingestion.md#transformspec) 过滤掉的行，但不包括显式用户配置跳过的行。例如，CSV格式的 `skipHeaderRows` 或 `hasHeaderRow` 跳过的行不计算在内
* `unparseable`: 完全无法分析并被丢弃的行数。这将跟踪没有可解析结构的输入行，例如在使用JSON解析器时传入非JSON数据。

`errorMsg` 字段显示一条消息，描述导致任务失败的错误。如果任务成功，则为空

### 实时报告
#### 行画像

非并行的 [简单本地批处理任务](native.md#简单任务)、Hadoop批处理任务以及Kafka和kinesis摄取任务支持在任务运行时检索行统计信息。

可以通过运行任务的Peon上的以下URL访问实时报告：

```json
http://<middlemanager-host>:<worker-port>/druid/worker/v1/chat/<task-id>/rowStats
```

示例报告如下所示。`movingAverages` 部分包含四行计数器的1分钟、5分钟和15分钟移动平均增量，其定义与结束报告中的定义相同。`totals` 部分显示当前总计。

```json
{
  "movingAverages": {
    "buildSegments": {
      "5m": {
        "processed": 3.392158326408501,
        "unparseable": 0,
        "thrownAway": 0,
        "processedWithError": 0
      },
      "15m": {
        "processed": 1.736165476881023,
        "unparseable": 0,
        "thrownAway": 0,
        "processedWithError": 0
      },
      "1m": {
        "processed": 4.206417693750045,
        "unparseable": 0,
        "thrownAway": 0,
        "processedWithError": 0
      }
    }
  },
  "totals": {
    "buildSegments": {
      "processed": 1994,
      "processedWithError": 0,
      "thrownAway": 0,
      "unparseable": 0
    }
  }
}
```
对于Kafka索引服务，向Overlord API发送一个GET请求，将从supervisor管理的每个任务中检索实时行统计报告，并提供一个组合报告。

```json
http://<OVERLORD-HOST>:<OVERLORD-PORT>/druid/indexer/v1/supervisor/<supervisor-id>/stats
```

#### 未解析的事件

可以对Peon API发起一次Get请求，从正在运行的任务中检索最近遇到的不可解析事件的列表：

```json
http://<middlemanager-host>:<worker-port>/druid/worker/v1/chat/<task-id>/unparseableEvents
```
注意：并不是所有的任务类型支持该功能。 当前，该功能只支持非并行的 [本地批任务](native.md) (`index`类型) 和由Kafka、Kinesis索引服务创建的任务。

### 任务锁系统

本节介绍Druid中的任务锁定系统。Druid的锁定系统和版本控制系统是紧密耦合的，以保证接收数据的正确性。

### 段与段之间的"阴影"

可以运行任务覆盖现有数据。覆盖任务创建的段将*覆盖*现有段。请注意，覆盖关系只适用于**同一时间块和同一数据源**。在过滤过时数据的查询处理中，不考虑这些被遮盖的段。

每个段都有一个*主*版本和一个*次*版本。主版本表示为时间戳，格式为["yyyy-MM-dd'T'hh:MM:ss"](https://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html)，次版本表示为整数。这些主版本和次版本用于确定段之间的阴影关系，如下所示。

在以下条件下，段 `s1` 将会覆盖另一个段 `s2`:
* `s1` 比 `s2` 有一个更高的主版本
* `s1` 和 `s2` 有相同的主版本，但是有更高的次版本

以下是一些示例：
* 一个主版本为 `2019-01-01T00:00:00.000Z` 且次版本为 `0` 的段将覆盖另一个主版本为 `2018-01-01T00:00:00.000Z` 且次版本为 `1` 的段
* 一个主版本为 `2019-01-01T00:00:00.000Z` 且次版本为 `1` 的段将覆盖另一个主版本为 `2019-01-01T00:00:00.000Z` 且次版本为 `0` 的段

### 锁

如果您正在运行两个或多个 [Druid任务](taskrefer.md)，这些任务为同一数据源和同一时间块生成段，那么生成的段可能会相互覆盖，从而导致错误的查询结果。

为了避免这个问题，任务将在Druid中创建任何段之前尝试获取锁, 有两种类型的锁，即 *时间块锁* 和 *段锁*。

使用时间块锁时，任务将锁定生成的段将写入数据源的整个时间块。例如，假设我们有一个任务将数据摄取到 `wikipedia` 数据源的时间块 `2019-01-01T00:00:00.000Z/2019-01-02T00:00:00.000Z` 中。使用时间块锁，此任务将在创建段之前锁定wikipedia数据源的 `2019-01-01T00:00.000Z/2019-01-02T00:00:00.000Z` 整个时间块。只要它持有锁，任何其他任务都将无法为同一数据源的同一时间块创建段。使用时间块锁创建的段的主版本*高于*现有段, 它们的次版本总是 `0`。

使用段锁时，任务锁定单个段而不是整个时间块。因此，如果两个或多个任务正在读取不同的段，则它们可以同时为同一时间创建同一数据源的块。例如，Kafka索引任务和压缩合并任务总是可以同时将段写入同一数据源的同一时间块中。原因是，Kafka索引任务总是附加新段，而压缩合并任务总是覆盖现有段。使用段锁创建的段具有*相同的*主版本和较高的次版本。

> [!WARNING]
> 段锁仍然是实验性的。它可能有未知的错误，这可能会导致错误的查询结果。

要启用段锁定，可能需要在 [task context(任务上下文)](#上下文参数) 中将 `forceTimeChunkLock` 设置为 `false`。一旦 `forceTimeChunkLock` 被取消设置，任务将自动选择正确的锁类型。**请注意**，段锁并不总是可用的。使用时间块锁的最常见场景是当覆盖任务更改段粒度时。此外，只有本地索引任务和Kafka/kinesis索引任务支持段锁。Hadoop索引任务和索引实时(`index_realtime`)任务（被 [Tranquility](tranquility.md)使用）还不支持它。

任务上下文中的 `forceTimeChunkLock` 仅应用于单个任务。如果要为所有任务取消设置，则需要在 [Overlord配置](../configuration/human-readable-byte.md#overlord) 中设置 `druid.indexer.tasklock.forceTimeChunkLock` 为false。

如果两个或多个任务尝试为同一数据源的重叠时间块获取锁，则锁请求可能会相互冲突。**请注意，**锁冲突可能发生在不同的锁类型之间。

锁冲突的行为取决于 [任务优先级](#锁优先级)。如果冲突锁请求的所有任务具有相同的优先级，则首先请求的任务将获得锁, 其他任务将等待任务释放锁。

如果优先级较低的任务请求锁的时间晚于优先级较高的任务，则此任务还将等待优先级较高的任务释放锁。如果优先级较高的任务比优先级较低的任务请求锁的时间晚，则此任务将*抢占*优先级较低的另一个任务。优先级较低的任务的锁将被撤销，优先级较高的任务将获得一个新锁。

锁抢占可以在任务运行时随时发生，除非它在关键的*段发布阶段*。一旦发布段完成，它的锁将再次成为可抢占的。

**请注意**，锁由同一groupId的任务共享。例如，同一supervisor的Kafka索引任务具有相同的groupId，并且彼此共享所有锁。

### 锁优先级

每个任务类型都有不同的默认锁优先级。下表显示了不同任务类型的默认优先级。数字越高，优先级越高。

| 任务类型 | 默认优先级 |
|-|-|
| 实时索引任务 | 75 |
| 批量索引任务 | 50 |
| 合并/追加/压缩任务 | 25 |
| 其他任务 | 0 |

通过在任务上下文中设置优先级，可以覆盖任务优先级，如下所示。

```json
"context" : {
  "priority" : 100
}
```

### 上下文参数

任务上下文用于各种单独的任务配置。以下参数适用于所有任务类型。

| 属性 | 默认值 | 描述 |
|-|-|-|
| `taskLockTimeout` | 300000 | 任务锁定超时（毫秒）。更多详细信息，可以查看 [锁](#锁) 部分 |
| `forceTimeChunkLock` | true | *将此设置为false仍然是实验性的* 。强制始终使用时间块锁。如果未设置，则每个任务都会自动选择要使用的锁类型。如果设置了，它将覆盖 [Overlord配置](../Configuration/configuration.md#overlord] 的 `druid.indexer.tasklock.forceTimeChunkLock` 配置。有关详细信息，可以查看 [锁](#锁) 部分。|
| `priority` | 不同任务类型是不同的。 参见 [锁优先级](#锁优先级) | 任务优先级 |

> [!WARNING]
> 当任务获取锁时，它通过HTTP发送请求并等待，直到它收到包含锁获取结果的响应为止。因此，如果 `taskLockTimeout` 大于 Overlord的`druid.server.http.maxIdleTime` 将会产生HTTP超时错误。

### 所有任务类型
#### `index`

参见 [本地批量摄取(简单任务)](native.md#简单任务)

#### `index_parallel`

参见 [本地批量社区(并行任务)](native.md#并行任务)

#### `index_sub`

由 [`index_parallel`](#index_parallel) 代表您自动提交的任务。

#### `index_hadoop`

参见 [基于Hadoop的摄取](hadoop.md)

#### `index_kafka`

由 [`Kafka摄取supervisor`](kafka.md) 代表您自动提交的任务。

#### `index_kinesis`

由 [`Kinesis摄取supervisor`](kinesis.md) 代表您自动提交的任务。

#### `index_realtime`

由 [`Tranquility`](tranquility.md) 代表您自动提交的任务。

#### `compact`

压缩任务合并给定间隔的所有段。有关详细信息，请参见有关 [压缩](data-management.md#压缩与重新索引) 的文档。

#### `kill`

Kill tasks删除有关某些段的所有元数据，并将其从深层存储中删除。有关详细信息，请参阅有关 [删除数据](data-management.md#删除数据) 的文档。

#### `append`

附加任务将段列表附加到单个段中（一个接一个）。语法是：

```json
{
    "type": "append",
    "id": <task_id>,
    "dataSource": <task_datasource>,
    "segments": <JSON list of DataSegment objects to append>,
    "aggregations": <optional list of aggregators>,
    "context": <task context>
}
```

#### `merge`

合并任务将段列表合并在一起。合并任何公共时间戳。如果在接收过程中禁用了rollup，则不会合并公共时间戳，并按其时间戳对行重新排序。

> [!WARNING]
> [`compact`](#compact) 任务通常是比 `merge` 任务更好的选择。

语法是：

```json
{
    "type": "merge",
    "id": <task_id>,
    "dataSource": <task_datasource>,
    "aggregations": <list of aggregators>,
    "rollup": <whether or not to rollup data during a merge>,
    "segments": <JSON list of DataSegment objects to merge>,
    "context": <task context>
}
```

#### `same_interval_merge`

同一间隔合并任务是合并任务的快捷方式，间隔中的所有段都将被合并。

> [!WARNING]
> [`compact`](#compact) 任务通常是比 `same_interval_merge` 任务更好的选择。

语法是:

```json
{
    "type": "same_interval_merge",
    "id": <task_id>,
    "dataSource": <task_datasource>,
    "aggregations": <list of aggregators>,
    "rollup": <whether or not to rollup data during a merge>,
    "interval": <DataSegment objects in this interval are going to be merged>,
    "context": <task context>
}
```
