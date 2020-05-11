<!-- toc -->
## 本地批摄入

Apache Druid当前支持两种类型的本地批量索引任务， `index_parallel` 可以并行的运行多个任务， `index`运行单个索引任务。 详情可以查看 [基于Hadoop的摄取vs基于本地批摄取的对比](ingestion.md#批量摄取) 来了解基于Hadoop的摄取、本地简单批摄取、本地并行摄取三者的比较。

要运行这两种类型的本地批索引任务，请按以下指定编写摄取规范。然后将其发布到Overlord的 `/druid/indexer/v1/task` 接口，或者使用druid附带的 `bin/post-index-task`。

### 教程

此页包含本地批处理摄取的参考文档。相反，如果要进行演示，请查看 [加载文件教程](../GettingStarted/chapter-1.md)，该教程演示了"简单"（单任务）模式

### 并行任务

并行任务（`index_parallel`类型）是用于并行批索引的任务。此任务只使用Druid的资源，不依赖于其他外部系统，如Hadoop。`index_parallel` 任务是一个supervisor任务，它协调整个索引过程。supervisor分割输入数据并创建辅助任务来处理这些分割, 创建的worker将发布给Overlord，以便在MiddleManager或Indexer上安排和运行。一旦worker成功处理分配的输入拆分，它就会将生成的段列表报告给supervisor任务。supervisor定期检查工作任务的状态。如果其中一个失败，它将重试失败的任务，直到重试次数达到配置的限制。如果所有工作任务都成功，它将立即发布报告的段并完成摄取。

并行任务的详细行为是不同的，取决于 [`partitionsSpec`](#partitionsspec)，详情可以查看 `partitionsSpec` 

要使用此任务，`ioConfig` 中的 [`inputSource`](#输入源) 应为*splittable(可拆分的)*，`tuningConfig` 中的 `maxNumConcurrentSubTasks` 应设置为大于1。否则，此任务将按顺序运行；`index_parallel` 任务将逐个读取每个输入文件并自行创建段。目前支持的可拆分输入格式有：

* [`s3`](#s3%e8%be%93%e5%85%a5%e6%ba%90) 从AWS S3存储读取数据
* [`gs`](#谷歌云存储输入源) 从谷歌云存储读取数据
* [`azure`](#azure%e8%be%93%e5%85%a5%e6%ba%90) 从Azure Blob存储读取数据
* [`hdfs`](#hdfs%e8%be%93%e5%85%a5%e6%ba%90) 从HDFS存储中读取数据
* [`http`](#HTTP输入源) 从HTTP服务中读取数据
* [`local`](#local%e8%be%93%e5%85%a5%e6%ba%90) 从本地存储中读取数据
* [`druid`](#druid%e8%be%93%e5%85%a5%e6%ba%90) 从Druid数据源中读取数据

传统的 [`firehose`](#firehoses%e5%b7%b2%e5%ba%9f%e5%bc%83) 支持其他一些云存储类型。下面的 `firehose` 类型也是可拆分的。请注意，`firehose` 只支持文本格式。

* [`static-cloudfiles`](../Development/rackspacecloudfiles.md)

您可能需要考虑以下事项：
* 您可能希望控制每个worker进程的输入数据量。这可以使用不同的配置进行控制，具体取决于并行摄取的阶段（有关更多详细信息，请参阅 [`partitionsSpec`](#partitionsspec)。对于从 `inputSource` 读取数据的任务，可以在 `tuningConfig` 中设置 [分割提示规范](#分割提示规范)。对于合并无序段的任务，可以在 `tuningConfig` 中设置`totalNumMergeTasks`。
* 并行摄取中并发worker的数量由 `tuningConfig` 中的`maxNumConcurrentSubTasks` 确定。supervisor检查当前正在运行的worker的数量，如果小于 `maxNumConcurrentSubTasks`，则无论当前有多少任务槽可用，都会创建更多的worker。这可能会影响其他摄取性能。有关更多详细信息，请参阅下面的 [容量规划部分](#容量规划)。
* 默认情况下，批量摄取将替换它写入的任何段中的所有数据（在`granularitySpec` 的间隔中）。如果您想添加到段中，请在 `ioConfig` 中设置 `appendToExisting` 标志。请注意，它只替换主动添加数据的段中的数据：如果 `granularitySpec` 的间隔中有段没有此任务写入的数据，则它们将被单独保留。如果任何现有段与 `granularitySpec` 的间隔部分重叠，则新段间隔之外的那些段的部分仍将可见。

#### 任务符号

一个简易的任务如下所示：

```
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia_parallel_index_test",
      "timestampSpec": {
        "column": "timestamp"
      },
      "dimensionsSpec": {
        "dimensions": [
          "page",
          "language",
          "user",
          "unpatrolled",
          "newPage",
          "robot",
          "anonymous",
          "namespace",
          "continent",
          "country",
          "region",
          "city"
        ]
      },
      "metricsSpec": [
        {
          "type": "count",
              "name": "count"
            },
            {
              "type": "doubleSum",
              "name": "added",
              "fieldName": "added"
            },
            {
              "type": "doubleSum",
              "name": "deleted",
              "fieldName": "deleted"
            },
            {
              "type": "doubleSum",
              "name": "delta",
              "fieldName": "delta"
            }
        ],
        "granularitySpec": {
          "segmentGranularity": "DAY",
          "queryGranularity": "second",
          "intervals" : [ "2013-08-31/2013-09-02" ]
        }
    },
    "ioConfig": {
        "type": "index_parallel",
        "inputSource": {
          "type": "local",
          "baseDir": "examples/indexing/",
          "filter": "wikipedia_index_data*"
        },
        "inputFormat": {
          "type": "json"
        }
    },
    "tuningconfig": {
        "type": "index_parallel",
        "maxNumConcurrentSubTasks": 2
    }
  }
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 任务类型，应当总是 `index_parallel` | 是 |
| `id` | 任务ID。 如果该项没有显式的指定，Druid将使用任务类型、数据源名称、时间间隔、日期时间戳生成一个任务ID | 否 |
| `spec` | 摄取规范包括数据schema、IOConfig 和 TuningConfig。详情见下边详细描述 | 是 |
| `context` | Context包括了多个任务配置参数。详情见下边详细描述 | 否 |

##### `dataSchema`

该字段为必须字段。

可以参见 [摄取规范中的dataSchema](ingestion.md#dataSchema)

如果在dataSchema的 `granularitySpec` 中显式地指定了 `intervals`，则批处理摄取将锁定启动时指定的完整间隔，并且您将快速了解指定间隔是否与其他任务（例如Kafka摄取）持有的锁重叠。否则，在发现每个间隔时，批处理摄取将锁定该间隔，因此您可能只会在摄取过程中了解到该任务与较高优先级的任务重叠。如果显式指定 `intervals`，则指定间隔之外的任何行都将被丢弃。如果您知道数据的时间范围，我们建议显式地设置`intervals`，以便锁定失败发生得更快，并且如果有一些带有意外时间戳的杂散数据，您不会意外地替换该范围之外的数据。

##### `ioConfig`

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型， 应当总是  `index_parallel` | none | 是 |
| `inputFormat` | [`inputFormat`](dataformats.md#InputFormat) 用来指定如何解析输入数据 | none | 是 |
| `appendToExisting` | 创建段作为最新版本的附加分片，有效地附加到段集而不是替换它。仅当现有段集具有可扩展类型 `shardSpec`时，此操作才有效。 | false | 否 |

##### `tuningConfig`

tuningConfig是一个可选项，如果未指定则使用默认的参数。 详情如下：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型，应当总是 `index_parallel` | none | 是 |
| `maxRowsPerSegment` | 已废弃。使用 `partitionsSpec` 替代，被用来分片。 决定在每个段中有多少行。 | 5000000 | 否 |
| `maxRowsInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常用户不需要设置此值，但根据数据的性质，如果行的字节数较短，则用户可能不希望在内存中存储一百万行，应设置此值。 | 1000000 | 否 |
| `maxBytesInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常这是在内部计算的，用户不需要设置它。此值表示在持久化之前要在堆内存中聚合的字节数。这是基于对内存使用量的粗略估计，而不是实际使用量。用于索引的最大堆内存使用量为 `maxBytesInMemory *（2 + maxPendingResistent）` | 最大JVM内存的1/6 | 否 |
| `maxTotalRows` | 已废弃。使用 `partitionsSpec` 替代。等待推送的段中的总行数。用于确定何时应进行中间推送。| 20000000 | 否 |
| `numShards` | 已废弃。使用 `partitionsSpec` 替代。当使用 `hashed` `partitionsSpec`时直接指定要创建的分片数。如果该值被指定了且在 `granularitySpec`中指定了 `intervals`，那么索引任务可以跳过确定间隔/分区传递数据。如果设置了 `maxRowsPerSegment`，则无法指定 `numShards`。 | null | 否 |
| `splitHintSpec` | 用于提供提示以控制每个第一阶段任务读取的数据量。根据输入源的实现，可以忽略此提示。有关更多详细信息，请参见 [分割提示规范](#分割提示规范)。 | 基于大小的分割提示规范 | 否 |
| `partitionsSpec` | 定义在每个时间块中如何分区数据。 参见 [partitionsSpec](#partitionsspec) | 如果 `forceGuaranteedRollup` = false, 则为 `dynamic`; 如果 `forceGuaranteedRollup` = true, 则为 `hashed` 或者 `single_dim` | 否 |
| `indexSpec` | 定义段在索引阶段的存储格式相关选项，参见 [IndexSpec](ingestion.md#tuningConfig) | null | 否 |
| `indexSpecForIntermediatePersists` | 定义要在索引时用于中间持久化临时段的段存储格式选项。这可用于禁用中间段上的维度/度量压缩，以减少最终合并所需的内存。但是，在中间段上禁用压缩可能会增加页缓存的使用，而在它们被合并到发布的最终段之前使用它们，有关可能的值，请参阅 [IndexSpec](ingestion.md#tuningConfig)。 | 与 `indexSpec` 相同 | 否 |
| `maxPendingPersists` | 可挂起但未启动的最大持久化任务数。如果新的中间持久化将超过此限制，则在当前运行的持久化完成之前，摄取将被阻止。使用`maxRowsInMemory * (2 + maxPendingResistents)` 索引扩展的最大堆内存使用量。 | 0 (这意味着一个持久化任务只可以与摄取同时运行，而没有一个可以排队) | 否 |
| `forceGuaranteedRollup` | 强制保证 [最佳Rollup](ingestion.md#Rollup)。最佳rollup优化了生成的段的总大小和查询时间，同时索引时间将增加。如果设置为true，则必须设置 `granularitySpec` 中的 `intervals` ，同时必须对 `partitionsSpec` 使用 `single_dim` 或者 `hashed` 。此标志不能与 `IOConfig` 的 `appendToExisting` 一起使用。有关更多详细信息，请参见下面的 ["分段推送模式"](#分段推送模式) 部分。 | false | 否 |
| `reportParseExceptions` | 如果为true，则将引发解析期间遇到的异常并停止摄取；如果为false，则将跳过不可解析的行和字段。 | false | 否 |
| `pushTimeout` | 段推送的超时毫秒时间。 该值必须设置为 >= 0, 0意味着永不超时 | 0 | 否 |
| `segmentWriteOutMediumFactory` | 创建段时使用的段写入介质。 参见 [segmentWriteOutMediumFactory](#segmentWriteOutMediumFactory) | 未指定， 值来源于 `druid.peon.defaultSegmentWriteOutMediumFactory.type` | 否 |
| `maxNumConcurrentSubTasks` | 可同时并行运行的最大worker数。无论当前可用的任务槽如何，supervisor都将生成最多为 `maxNumConcurrentSubTasks` 的worker。如果此值设置为1，supervisor将自行处理数据摄取，而不是生成worker。如果将此值设置为太大，则可能会创建太多的worker，这可能会阻止其他摄取。查看 [容量规划](#容量规划) 以了解更多详细信息。 | 1 | 否 |
| `maxRetry` | 任务失败后最大重试次数 | 3 | 否 |
| `maxNumSegmentsToMerge` | 单个任务在第二阶段可同时合并的段数的最大限制。仅在 `forceGuaranteedRollup` 被设置的时候使用。 | 100 | 否 |
| `totalNumMergeTasks` | 当 `partitionsSpec` 被设置为 `hashed` 或者 `single_dim`时， 在合并阶段用来合并段的最大任务数。 | 10 | 否 |
| `taskStatusCheckPeriodMs` | 检查运行任务状态的轮询周期（毫秒）。| 1000 | 否 |
| `chatHandlerTimeout` | 报告worker中的推送段超时。| PT10S | 否 |
| `chatHandlerNumRetries` | 重试报告worker中的推送段 | 5 | 否 |

#### 分割提示规范
##### `partitionsSpec`
#### HTTP状态接口
#### 容量规划
### 简单任务
#### 任务符号
##### `dataSchema`
##### `ioConfig`
##### `tuningConfig`
##### `partitionsSpec`
##### `segmentWriteOutMediumFactory`
#### 分段推送模式
### 输入源
#### S3输入源
#### 谷歌云存储输入源
#### Azure输入源
#### HDFS输入源
#### HTTP输入源
#### Inline输入源
#### Local输入源
#### Druid输入源
### Firehoses(已废弃)
#### StaticS3Firehose
#### HDFSFirehose
#### LocalFirehose
#### HttpFirehose
#### IngestSegmentFirehose
#### SqlFirehose
#### InlineFirehose
#### CombiningFirehose