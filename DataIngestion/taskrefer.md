<!-- toc -->
## 任务参考文档

任务在Druid中完成所有与 [摄取](ingestion.md) 相关的工作。

对于批量摄取，通常使用 [任务api](../Operations/api.md#Overlord) 直接将任务提交给Druid。对于流式接收，任务通常被提交给supervisor。

### 任务API

任务API主要在两个地方是可用的：

* [Overlord](../Design/Overlord.md) 进程提供HTTP API接口来进行提交任务、取消任务、检查任务状态、查看任务日志与报告等。 查看 [任务API文档](../Operations/api.md) 可以看到完整列表
* Druid SQL包括了一个 [`sys.tasks`](../Querying/druidsql.md#系统Schema) ，保存了当前任务运行的信息。 此表是只读的，并且可以通过Overlord API查询完整信息的有限制的子集。
  
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

#### 未解析的事件
### 任务锁系统
### 段与段之间的"阴影"
### 锁
### 锁优先级
### 上下文参数
### 所有任务类型
#### `index`
#### `index_parallel`
#### `index_sub`
#### `index_hadoop`
#### `index_kafka`
#### `index_kinesis`
#### `index_realtime`
#### `compact`
#### `kill`
#### `append`
#### `merge`
#### `same_interval_merge`