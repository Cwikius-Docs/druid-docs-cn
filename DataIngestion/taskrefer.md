<!-- toc -->

<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
<ins class="adsbygoogle"
     style="display:block; text-align:center;"
     data-ad-layout="in-article"
     data-ad-format="fluid"
     data-ad-client="ca-pub-8828078415045620"
     data-ad-slot="7586680510"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>

## 任务参考文档

任务在Druid中完成所有与 [摄取](ingestion.md) 相关的工作。

对于批量摄取，通常使用 [任务api](../operations/api.md#Overlord) 直接将任务提交给Druid。对于流式接收，任务通常被提交给supervisor。

### 任务API

任务API主要在两个地方是可用的：

* [Overlord](../design/Overlord.md) 进程提供HTTP API接口来进行提交任务、取消任务、检查任务状态、查看任务日志与报告等。 查看 [任务API文档](../operations/api.md) 可以看到完整列表
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

参见 [基于Hadoop的摄取](hadoopbased.md)

#### `index_kafka`

由 [`Kafka摄取supervisor`](kafka.md) 代表您自动提交的任务。

#### `index_kinesis`

由 [`Kinesis摄取supervisor`](kinesis.md) 代表您自动提交的任务。

#### `index_realtime`

由 [`Tranquility`](tranquility.md) 代表您自动提交的任务。

#### `compact`

压缩任务合并给定间隔的所有段。有关详细信息，请参见有关 [压缩](datamanage.md#压缩与重新索引) 的文档。

#### `kill`

Kill tasks删除有关某些段的所有元数据，并将其从深层存储中删除。有关详细信息，请参阅有关 [删除数据](datamanage.md#删除数据) 的文档。

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
