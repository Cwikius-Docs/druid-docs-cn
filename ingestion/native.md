
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

* [`static-cloudfiles`](../development/rackspacecloudfiles.md)

您可能需要考虑以下事项：
* 您可能希望控制每个worker进程的输入数据量。这可以使用不同的配置进行控制，具体取决于并行摄取的阶段（有关更多详细信息，请参阅 [`partitionsSpec`](#partitionsspec)。对于从 `inputSource` 读取数据的任务，可以在 `tuningConfig` 中设置 [分割提示规范](#分割提示规范)。对于合并无序段的任务，可以在 `tuningConfig` 中设置`totalNumMergeTasks`。
* 并行摄取中并发worker的数量由 `tuningConfig` 中的`maxNumConcurrentSubTasks` 确定。supervisor检查当前正在运行的worker的数量，如果小于 `maxNumConcurrentSubTasks`，则无论当前有多少任务槽可用，都会创建更多的worker。这可能会影响其他摄取性能。有关更多详细信息，请参阅下面的 [容量规划部分](#容量规划)。
* 默认情况下，批量摄取将替换它写入的任何段中的所有数据（在`granularitySpec` 的间隔中）。如果您想添加到段中，请在 `ioConfig` 中设置 `appendToExisting` 标志。请注意，它只替换主动添加数据的段中的数据：如果 `granularitySpec` 的间隔中有段没有此任务写入的数据，则它们将被单独保留。如果任何现有段与 `granularitySpec` 的间隔部分重叠，则新段间隔之外的那些段的部分仍将可见。

#### 任务符号

一个简易的任务如下所示：

```json
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

分割提示规范用于在supervisor创建输入分割时给出提示。请注意，每个worker处理一个输入拆分。您可以控制每个worker在第一阶段读取的数据量。

**基于大小的分割提示规范**
除HTTP输入源外，所有可拆分输入源都遵循基于大小的拆分提示规范。

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应当总是 `maxSize` | none | 是 |
| `maxSplitSize` | 单个任务中要处理的输入文件的最大字节数。如果单个文件大于此数字，则它将在单个任务中自行处理（文件永远不会跨任务拆分）。 | 500MB | 否 |

**段分割提示规范**

段分割提示规范仅仅用在 [`DruidInputSource`](#Druid输入源)(和过时的 [`IngestSegmentFirehose`](#IngestSegmentFirehose))

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应当总是 `segments` | none | 是 |
| `maxInputSegmentBytesPerTask` | 单个任务中要处理的输入段的最大字节数。如果单个段大于此数字，则它将在单个任务中自行处理（输入段永远不会跨任务拆分）。 | 500MB | 否 |

##### `partitionsSpec`

PartitionsSpec用于描述辅助分区方法。您应该根据需要的rollup模式使用不同的partitionsSpec。为了实现 [最佳rollup](ingestion.md#rollup)，您应该使用 `hashed`（基于每行中维度的哈希进行分区）或 `single_dim`（基于单个维度的范围）。对于"尽可能rollup"模式，应使用 `dynamic`。

三种 `partitionsSpec` 类型有着不同的特征。

| PartitionsSpec | 摄入速度 | 分区方式 | 支持的rollup模式 | 查询时的段修剪 |
|-|-|-|-|-|
| `dynamic` | 最快 | 基于段中的行数来进行分区 | 尽可能rollup | N/A |
| `hashed` | 中等 | 基于分区维度的哈希值进行分区。此分区可以通过改进数据位置性来减少数据源大小和查询延迟。有关详细信息，请参见 [分区](ingestion.md#分区)。 | 最佳rollup | N/A |
| `single_dim` | 最慢 | 基于分区维度值的范围分区。段大小可能会根据分区键分布而倾斜。这可能通过改善数据位置性来减少数据源大小和查询延迟。有关详细信息，请参见 [分区](ingestion.md#分区)。 | 最佳rollup | Broker可以使用分区信息提前修剪段以加快查询速度。由于Broker知道每个段中 `partitionDimension` 值的范围，因此，给定一个包含`partitionDimension` 上的筛选器的查询，Broker只选取包含满足 `partitionDimension` 上的筛选器的行的段进行查询处理。|

对于每一种partitionSpec，推荐的使用场景是：

* 如果数据有一个在查询中经常使用的均匀分布列，请考虑使用 `single_dim` partitionsSpec来最大限度地提高大多数查询的性能。
* 如果您的数据不是均匀分布的列，但在使用某些维度进行rollup时，需要具有较高的rollup汇总率，请考虑使用 `hashed` partitionsSpec。通过改善数据的局部性，可以减小数据源的大小和查询延迟。
* 如果以上两个场景不是这样，或者您不需要rollup数据源，请考虑使用 `dynamic` partitionsSpec。

**Dynamic分区**

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `dynamic` | none | 是 |
| `maxRowsPerSegment` | 用来分片。决定在每一个段中有多少行 | 5000000 | 否 |
| `maxTotalRows` | 等待推送的所有段的总行数。用于确定中间段推送的发生时间。 | 20000000 | 否 |

使用Dynamic分区，并行索引任务在一个阶段中运行：它将生成多个worker(`single_phase_sub_task` 类型)，每个worker都创建段。worker创建段的方式是：

* 每当当前段中的行数超过 `maxRowsPerSegment` 时，任务将创建一个新段。
* 一旦所有时间块中所有段中的行总数达到 `maxTotalRows`，任务就会将迄今为止创建的所有段推送到深层存储并创建新段。

**基于哈希的分区**

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `hashed` | none | 是 |
| `numShards` | 直接指定要创建的分片数。如果该值被指定了，同时在 `granularitySpec` 中指定了 `intervals`，那么索引任务可以跳过确定通过数据的间隔/分区 | null | 是 |
| `partitionDimensions` | 要分区的维度。留空可选择所有维度。| null | 否 |

基于哈希分区的并行任务类似于 [MapReduce](https://en.wikipedia.org/wiki/MapReduce)。任务分为两个阶段运行，即 `部分段生成` 和 `部分段合并`。

* 在 `部分段生成` 阶段，与MapReduce中的Map阶段一样，并行任务根据分割提示规范分割输入数据，并将每个分割分配给一个worker。每个worker（`partial_index_generate` 类型）从 `granularitySpec` 中的`segmentGranularity（主分区键）` 读取分配的分割，然后按`partitionsSpec` 中 `partitionDimensions（辅助分区键）`的哈希值对行进行分区。分区数据存储在 [MiddleManager](../design/MiddleManager.md) 或 [Indexer](../design/Indexer.md) 的本地存储中。
* `部分段合并` 阶段类似于MapReduce中的Reduce阶段。并行任务生成一组新的worker（`partial_index_merge` 类型）来合并在前一阶段创建的分区数据。这里，分区数据根据要合并的时间块和分区维度的散列值进行洗牌；每个worker从多个MiddleManager/Indexer进程中读取落在同一时间块和同一散列值中的数据，并将其合并以创建最终段。最后，它们将最后的段一次推送到深层存储。

**基于单一维度范围分区**

> [!WARNING]
> 在并行任务的顺序模式下，当前不支持单一维度范围分区。尝试将`maxNumConcurrentSubTasks` 设置为大于1以使用此分区方式。

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `single_dim` | none | 是 |
| `partitionDimension` | 要分区的维度。 仅仅允许具有单一维度值的行 | none | 是 |
| `targetRowsPerSegment` | 在一个分区中包含的目标行数，应当是一个500MB ~ 1GB目标段的数值。 | none | 要么该值被设置，或者 `maxRowsPerSegment`被设置。 |
| `maxRowsPerSegment` | 分区中要包含的行数的软最大值。| none | 要么该值被设置，或者 `targetRowsPerSegment`被设置。|
| `assumeGrouped` | 假设输入数据已经按时间和维度分组。摄取将运行得更快，但如果违反此假设，则可能会选择次优分区 | false | 否 |

在 `single-dim` 分区下，并行任务分为3个阶段进行，即 `部分维分布`、`部分段生成` 和 `部分段合并`。第一个阶段是收集一些统计数据以找到最佳分区，另外两个阶段是创建部分段并分别合并它们，就像在基于哈希的分区中那样。

* 在 `部分维度分布` 阶段，并行任务分割输入数据，并根据分割提示规范将其分配给worker。每个worker任务（`partial_dimension_distribution` 类型）读取分配的分割并为 `partitionDimension` 构建直方图。并行任务从worker任务收集这些直方图，并根据 `partitionDimension` 找到最佳范围分区，以便在分区之间均匀分布行。请注意，`targetRowsPerSegment` 或 `maxRowsPerSegment` 将用于查找最佳分区。
* 在 `部分段生成` 阶段，并行任务生成新的worker任务（`partial_range_index_generate` 类型）以创建分区数据。每个worker任务都读取在前一阶段中创建的分割，根据 `granularitySpec` 中的`segmentGranularity（主分区键）`的时间块对行进行分区，然后根据在前一阶段中找到的范围分区对行进行分区。分区数据存储在 [MiddleManager](../design/MiddleManager.md) 或 [Indexer](../design/Indexer.md)的本地存储中。
* 在 `部分段合并` 阶段，并行索引任务生成一组新的worker任务（`partial_index_generic_merge`类型）来合并在上一阶段创建的分区数据。这里，分区数据根据时间块和 `partitionDimension` 的值进行洗牌；每个工作任务从多个MiddleManager/Indexer进程中读取属于同一范围的同一分区中的段，并将它们合并以创建最后的段。最后，它们将最后的段推到深层存储。

> [!WARNING]
> 由于单一维度范围分区的任务在 `部分维度分布` 和 `部分段生成` 阶段对输入进行两次传递，因此如果输入在两次传递之间发生变化，任务可能会失败

#### HTTP状态接口

supervisor任务提供了一些HTTP接口来获取任务状态。

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/mode`

如果索引任务以并行的方式运行，则返回 "parallel", 否则返回 "sequential"

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/phase`

如果任务以并行的方式运行，则返回当前阶段的名称

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/progress`

如果supervisor任务以并行的方式运行，则返回当前阶段的预估进度

一个示例结果如下：
```json
{
  "running":10,
  "succeeded":0,
  "failed":0,
  "complete":0,
  "total":10,
  "estimatedExpectedSucceeded":10
}
```

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtasks/running`

返回正在运行的worker任务的任务IDs，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs`

返回所有的worker任务规范，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs/running`

返回正在运行的worker任务规范，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs/complete`

返回已经完成的worker任务规范，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}`

返回指定ID的worker任务规范，如果该supervisor任务以序列模式运行则返回一个HTTP 404

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}/state`

返回指定ID的worker任务规范的状态，如果该supervisor任务以序列模式运行则返回一个HTTP 404。 返回的结果集中包括worker任务规范，当前任务状态(如果存在的话) 以及任务尝试历史记录。

一个示例结果如下：
```json
{
  "spec": {
    "id": "index_parallel_lineitem_2018-04-20T22:12:43.610Z_2",
    "groupId": "index_parallel_lineitem_2018-04-20T22:12:43.610Z",
    "supervisorTaskId": "index_parallel_lineitem_2018-04-20T22:12:43.610Z",
    "context": null,
    "inputSplit": {
      "split": "/path/to/data/lineitem.tbl.5"
    },
    "ingestionSpec": {
      "dataSchema": {
        "dataSource": "lineitem",
        "timestampSpec": {
          "column": "l_shipdate",
          "format": "yyyy-MM-dd"
        },
        "dimensionsSpec": {
          "dimensions": [
            "l_orderkey",
            "l_partkey",
            "l_suppkey",
            "l_linenumber",
            "l_returnflag",
            "l_linestatus",
            "l_shipdate",
            "l_commitdate",
            "l_receiptdate",
            "l_shipinstruct",
            "l_shipmode",
            "l_comment"
          ]
        },
        "metricsSpec": [
          {
            "type": "count",
            "name": "count"
          },
          {
            "type": "longSum",
            "name": "l_quantity",
            "fieldName": "l_quantity",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_extendedprice",
            "fieldName": "l_extendedprice",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_discount",
            "fieldName": "l_discount",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_tax",
            "fieldName": "l_tax",
            "expression": null
          }
        ],
        "granularitySpec": {
          "type": "uniform",
          "segmentGranularity": "YEAR",
          "queryGranularity": {
            "type": "none"
          },
          "rollup": true,
          "intervals": [
            "1980-01-01T00:00:00.000Z/2020-01-01T00:00:00.000Z"
          ]
        },
        "transformSpec": {
          "filter": null,
          "transforms": []
        }
      },
      "ioConfig": {
        "type": "index_parallel",
        "inputSource": {
          "type": "local",
          "baseDir": "/path/to/data/",
          "filter": "lineitem.tbl.5"
        },
        "inputFormat": {
          "format": "tsv",
          "delimiter": "|",
          "columns": [
            "l_orderkey",
            "l_partkey",
            "l_suppkey",
            "l_linenumber",
            "l_quantity",
            "l_extendedprice",
            "l_discount",
            "l_tax",
            "l_returnflag",
            "l_linestatus",
            "l_shipdate",
            "l_commitdate",
            "l_receiptdate",
            "l_shipinstruct",
            "l_shipmode",
            "l_comment"
          ]
        },
        "appendToExisting": false
      },
      "tuningConfig": {
        "type": "index_parallel",
        "maxRowsPerSegment": 5000000,
        "maxRowsInMemory": 1000000,
        "maxTotalRows": 20000000,
        "numShards": null,
        "indexSpec": {
          "bitmap": {
            "type": "roaring"
          },
          "dimensionCompression": "lz4",
          "metricCompression": "lz4",
          "longEncoding": "longs"
        },
        "indexSpecForIntermediatePersists": {
          "bitmap": {
            "type": "roaring"
          },
          "dimensionCompression": "lz4",
          "metricCompression": "lz4",
          "longEncoding": "longs"
        },
        "maxPendingPersists": 0,
        "reportParseExceptions": false,
        "pushTimeout": 0,
        "segmentWriteOutMediumFactory": null,
        "maxNumConcurrentSubTasks": 4,
        "maxRetry": 3,
        "taskStatusCheckPeriodMs": 1000,
        "chatHandlerTimeout": "PT10S",
        "chatHandlerNumRetries": 5,
        "logParseExceptions": false,
        "maxParseExceptions": 2147483647,
        "maxSavedParseExceptions": 0,
        "forceGuaranteedRollup": false,
        "buildV9Directly": true
      }
    }
  },
  "currentStatus": {
    "id": "index_sub_lineitem_2018-04-20T22:16:29.922Z",
    "type": "index_sub",
    "createdTime": "2018-04-20T22:16:29.925Z",
    "queueInsertionTime": "2018-04-20T22:16:29.929Z",
    "statusCode": "RUNNING",
    "duration": -1,
    "location": {
      "host": null,
      "port": -1,
      "tlsPort": -1
    },
    "dataSource": "lineitem",
    "errorMsg": null
  },
  "taskHistory": []
}
```

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}/history
`

返回被指定ID的worker任务规范的任务尝试历史记录，如果该supervisor任务以序列模式运行则返回一个HTTP 404

#### 容量规划

不管当前有多少任务槽可用，supervisor任务最多可以创建 `maxNumConcurrentSubTasks` worker任务, 因此，可以同时运行的任务总数为 `(maxNumConcurrentSubTasks+1)(包括supervisor任务)`。请注意，这甚至可以大于任务槽的总数（所有worker的容量之和）。如果`maxNumConcurrentSubTasks` 大于 `n（可用任务槽）`，则`maxNumConcurrentSubTasks` 任务由supervisor任务创建，但只有 `n` 个任务将启动, 其他人将在挂起状态下等待，直到任何正在运行的任务完成。

如果将并行索引任务与流摄取一起使用，我们建议**限制批摄取的最大容量**，以防止流摄取被批摄取阻止。假设您同时有 `t` 个并行索引任务要运行， 但是想将批摄取的最大任务数限制在 `b`。 那么， 所有并行索引任务的 `maxNumConcurrentSubTasks` 之和 + `t`(supervisor任务数) 必须小于 `b`。

如果某些任务的优先级高于其他任务，则可以将其`maxNumConcurrentSubTasks` 设置为高于低优先级任务的值。这可能有助于高优先级任务比低优先级任务提前完成，方法是为它们分配更多的任务槽。

### 简单任务

简单任务（`index`类型）设计用于较小的数据集。任务在索引服务中执行。

#### 任务符号

一个示例任务如下：

```json
{
  "type" : "index",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "timestampSpec" : {
        "column" : "timestamp",
        "format" : "auto"
      },
      "dimensionsSpec" : {
        "dimensions": ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"],
        "dimensionExclusions" : []
      },
      "metricsSpec" : [
        {
          "type" : "count",
          "name" : "count"
        },
        {
          "type" : "doubleSum",
          "name" : "added",
          "fieldName" : "added"
        },
        {
          "type" : "doubleSum",
          "name" : "deleted",
          "fieldName" : "deleted"
        },
        {
          "type" : "doubleSum",
          "name" : "delta",
          "fieldName" : "delta"
        }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "DAY",
        "queryGranularity" : "NONE",
        "intervals" : [ "2013-08-31/2013-09-01" ]
      }
    },
    "ioConfig" : {
      "type" : "index",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "examples/indexing/",
        "filter" : "wikipedia_data.json"
       },
       "inputFormat": {
         "type": "json"
       }
    },
    "tuningConfig" : {
      "type" : "index",
      "maxRowsPerSegment" : 5000000,
      "maxRowsInMemory" : 1000000
    }
  }
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 任务类型， 应该总是 `index` | 是 |
| `id` | 任务ID。如果该值为显式的指定，Druid将会使用任务类型、数据源名称、时间间隔以及日期时间戳生成一个任务ID | 否 |
| `spec` | 摄入规范，包括dataSchema、IOConfig 和 TuningConfig。 详情见下边的描述 | 是 |
| `context` | 包含多个任务配置参数的上下文。 详情见下边的描述 | 否 |

##### `dataSchema`

**该字段为必须字段。**

详情可以见摄取文档中的 [`dataSchema`](ingestion.md#dataSchema) 部分。

如果没有在 `dataSchema` 的 `granularitySpec` 中显式指定 `intervals`，本地索引任务将对数据执行额外的传递，以确定启动时要锁定的范围。如果显式指定 `intervals`，则指定间隔之外的任何行都将被丢弃。如果您知道数据的时间范围，我们建议显式设置 `intervals`，因为它允许任务跳过额外的过程，并且如果有一些带有意外时间戳的杂散数据，您不会意外地替换该范围之外的数据。

##### `ioConfig`

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型，应该总是 `index` | none | 是 |
| `inputFormat` | [`inputFormat`](dataformats.md#InputFormat) 指定如何解析输入数据 | none | 是 |
| `appendToExisting` | 创建段作为最新版本的附加分片，有效地附加到段集而不是替换它。仅当现有段集具有可扩展类型 `shardSpec`时，此操作才有效。 | false | 否 |

##### `tuningConfig`

tuningConfig是一个可选项，如果未指定则使用默认的参数。 详情如下：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型，应当总是 `index` | none | 是 |
| `maxRowsPerSegment` | 已废弃。使用 `partitionsSpec` 替代，被用来分片。 决定在每个段中有多少行。 | 5000000 | 否 |
| `maxRowsInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常用户不需要设置此值，但根据数据的性质，如果行的字节数较短，则用户可能不希望在内存中存储一百万行，应设置此值。 | 1000000 | 否 |
| `maxBytesInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常这是在内部计算的，用户不需要设置它。此值表示在持久化之前要在堆内存中聚合的字节数。这是基于对内存使用量的粗略估计，而不是实际使用量。用于索引的最大堆内存使用量为 `maxBytesInMemory *（2 + maxPendingResistent）` | 最大JVM内存的1/6 | 否 |
| `maxTotalRows` | 已废弃。使用 `partitionsSpec` 替代。等待推送的段中的总行数。用于确定何时应进行中间推送。| 20000000 | 否 |
| `numShards` | 已废弃。使用 `partitionsSpec` 替代。当使用 `hashed` `partitionsSpec`时直接指定要创建的分片数。如果该值被指定了且在 `granularitySpec`中指定了 `intervals`，那么索引任务可以跳过确定间隔/分区传递数据。如果设置了 `maxRowsPerSegment`，则无法指定 `numShards`。 | null | 否 |
| `partitionsSpec` | 定义在每个时间块中如何分区数据。 参见 [partitionsSpec](#partitionsspec) | 如果 `forceGuaranteedRollup` = false, 则为 `dynamic`; 如果 `forceGuaranteedRollup` = true, 则为 `hashed` 或者 `single_dim` | 否 |
| `indexSpec` | 定义段在索引阶段的存储格式相关选项，参见 [IndexSpec](ingestion.md#tuningConfig) | null | 否 |
| `indexSpecForIntermediatePersists` | 定义要在索引时用于中间持久化临时段的段存储格式选项。这可用于禁用中间段上的维度/度量压缩，以减少最终合并所需的内存。但是，在中间段上禁用压缩可能会增加页缓存的使用，而在它们被合并到发布的最终段之前使用它们，有关可能的值，请参阅 [IndexSpec](ingestion.md#tuningConfig)。 | 与 `indexSpec` 相同 | 否 |
| `maxPendingPersists` | 可挂起但未启动的最大持久化任务数。如果新的中间持久化将超过此限制，则在当前运行的持久化完成之前，摄取将被阻止。使用`maxRowsInMemory * (2 + maxPendingResistents)` 索引扩展的最大堆内存使用量。 | 0 (这意味着一个持久化任务只可以与摄取同时运行，而没有一个可以排队) | 否 |
| `forceGuaranteedRollup` | 强制保证 [最佳Rollup](ingestion.md#Rollup)。最佳rollup优化了生成的段的总大小和查询时间，同时索引时间将增加。如果设置为true，则必须设置 `granularitySpec` 中的 `intervals` ，同时必须对 `partitionsSpec` 使用 `single_dim` 或者 `hashed` 。此标志不能与 `IOConfig` 的 `appendToExisting` 一起使用。有关更多详细信息，请参见下面的 ["分段推送模式"](#分段推送模式) 部分。 | false | 否 |
| `reportParseExceptions` | 已废弃。如果为true，则将引发解析期间遇到的异常并停止摄取；如果为false，则将跳过不可解析的行和字段。将 `reportParseExceptions` 设置为true将覆盖`maxParseExceptions` 和 `maxSavedParseExceptions` 的现有配置，将 `maxParseExceptions` 设置为0并将 `maxSavedParseExceptions` 限制为不超过1。 | false | 否 |
| `pushTimeout` | 段推送的超时毫秒时间。 该值必须设置为 >= 0, 0意味着永不超时 | 0 | 否 |
| `segmentWriteOutMediumFactory` | 创建段时使用的段写入介质。 参见 [segmentWriteOutMediumFactory](#segmentWriteOutMediumFactory) | 未指定， 值来源于 `druid.peon.defaultSegmentWriteOutMediumFactory.type` | 否 |
| `logParseExceptions` | 如果为true，则在发生解析异常时记录错误消息，其中包含有关发生错误的行的信息。 | false | 否 |
| `maxParseExceptions` | 任务停止接收并失败之前可能发生的最大分析异常数。如果设置了`reportParseExceptions`，则该配置被覆盖。 | unlimited | 否 |
| `maxSavedParseExceptions` | 当出现解析异常时，Druid可以跟踪最新的解析异常。"maxSavedParseExceptions" 限制将保存多少个异常实例。这些保存的异常将在任务完成报告中的任务完成后可用。如果设置了 `reportParseExceptions` ，则该配置被覆盖。 | 0 | 否 |


##### `partitionsSpec`

PartitionsSpec用于描述辅助分区方法。您应该根据需要的rollup模式使用不同的partitionsSpec。为了实现 [最佳rollup](ingestion.md#rollup)，您应该使用 `hashed`（基于每行中维度的哈希进行分区）

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `hashed` | none | 是 |
| `maxRowsPerSegment` | 用在分片中，决定在每个段中有多少行 | 5000000 | 否 |
| `numShards` | 直接指定要创建的分片数。如果该值被指定了，同时在 `granularitySpec` 中指定了 `intervals`，那么索引任务可以跳过确定通过数据的间隔/分区 | null | 是 |
| `partitionDimensions` | 要分区的维度。留空可选择所有维度。| null | 否 |

对于尽可能rollup模式，您应该使用 `dynamic` 

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `dynamic` | none | 是 |
| `maxRowsPerSegment` | 用来分片。决定在每一个段中有多少行 | 5000000 | 否 |
| `maxTotalRows` | 等待推送的所有段的总行数。用于确定中间段推送的发生时间。 | 20000000 | 否 |

##### `segmentWriteOutMediumFactory`

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 配置解释和可选项可以参见 [额外的Peon配置：SegmentWriteOutMediumFactory](../configuration/human-readable-byte.md#SegmentWriteOutMediumFactory) | 是 |

#### 分段推送模式

当使用简单任务摄取数据时，它从输入数据创建段并推送它们。对于分段推送，索引任务支持两种分段推送模式，分别是*批量推送模式*和*增量推送模式*，以实现 [最佳rollup和尽可能rollup](ingestion.md#rollup)。

在批量推送模式下，在索引任务的最末端推送每个段。在此之前，创建的段存储在运行索引任务的进程的内存和本地存储中。因此，此模式可能由于存储容量有限而导致问题，建议不要在生产中使用。

相反，在增量推送模式下，分段是增量推送的，即可以在索引任务的中间推送。更准确地说，索引任务收集数据并将创建的段存储在运行该任务的进程的内存和磁盘中，直到收集的行总数超过 `maxTotalRows`。一旦超过，索引任务将立即推送创建的所有段，直到此时为止，清除所有推送的段，并继续接收剩余的数据。

要启用批量推送模式，应在 `TuningConfig` 中设置`forceGuaranteedRollup`。请注意，此选项不能与 `IOConfig` 的`appendToExisting`一起使用。

### 输入源

输入源是定义索引任务读取数据的位置。只有本地并行任务和简单任务支持输入源。

#### S3输入源

> [!WARNING]
> 您需要添加 [`druid-s3-extensions`](../development/S3-compatible.md) 扩展以便使用S3输入源。

S3输入源支持直接从S3读取对象。可以通过S3 URI字符串列表或S3位置前缀列表指定对象，该列表将尝试列出内容并摄取位置中包含的所有对象。S3输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个对象。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "uris": ["s3://foo/bar/file.json", "s3://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "prefixes": ["s3://foo/bar", "s3://bar/foo"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "objects": [
          { "bucket": "foo", "path": "bar/file1.json"},
          { "bucket": "bar", "path": "foo/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `s3` | None | 是 |
| `uris` | 指定被摄取的S3对象位置的URI JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `prefixes` | 指定被摄取的S3对象所在的路径前缀的URI JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。 |
| `objects` | 指定被摄取的S3对象的JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `properties` | 指定用来覆盖默认S3配置的对象属性，详情见下边 | None | 否（未指定则使用默认）|

注意：只有当 `prefixes` 被指定时，S3输入源将略过空的对象。

S3对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `bucket` | S3 Bucket的名称 | None | 是 |
| `path` | 数据路径 | None | 是 |

属性对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `accessKeyId` | S3输入源访问密钥的 [Password Provider](../operations/passwordproviders.md) 或纯文本字符串 | None | 如果 `secretAccessKey` 被提供的话，则为必须 |
| `secretAccessKey` | S3输入源访问密钥的 [Password Provider](../operations/passwordproviders.md) 或纯文本字符串 | None | 如果 `accessKeyId` 被提供的话，则为必须 |

**注意**： *如果 `accessKeyId` 和 `secretAccessKey` 未被指定的话， 则将使用默认的 [S3认证](../development/S3-compatible.md#S3认证方式)*

#### 谷歌云存储输入源

> [!WARNING]
> 您需要添加 [`druid-google-extensions`](../configuration/core-ext/google-cloud-storage.md) 扩展以便使用谷歌云存储输入源。

谷歌云存储输入源支持直接从谷歌云存储读取对象，可以通过谷歌云存储URI字符串列表指定对象。谷歌云存储输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个对象。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "uris": ["gs://foo/bar/file.json", "gs://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "prefixes": ["gs://foo/bar", "gs://bar/foo"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "objects": [
          { "bucket": "foo", "path": "bar/file1.json"},
          { "bucket": "bar", "path": "foo/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `google` | None | 是 |
| `uris` | 指定被摄取的谷歌云存储对象位置的URI JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `prefixes` | 指定被摄取的谷歌云存储对象所在的路径前缀的URI JSON数组。 以被给定的前缀开头的空对象将被略过 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。 |
| `objects` | 指定被摄取的谷歌云存储对象的JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|

注意：只有当 `prefixes` 被指定时，谷歌云存储输入源将略过空的对象。

谷歌云存储对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `bucket` | 谷歌云存储 Bucket的名称 | None | 是 |
| `path` | 数据路径 | None | 是 |

#### Azure输入源

> [!WARNING]
> 您需要添加 [`druid-azure-extensions`](../configuration/core-ext/microsoft-azure.md) 扩展以便使用Azure输入源。

Azure输入源支持直接从Azure读取对象，可以通过Azure URI字符串列表指定对象。Azure输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个对象。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "uris": ["azure://container/prefix1/file.json", "azure://container/prefix2/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "prefixes": ["azure://container/prefix1", "azure://container/prefix2"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "objects": [
          { "bucket": "container", "path": "prefix1/file1.json"},
          { "bucket": "container", "path": "prefix2/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `azure` | None | 是 |
| `uris` | 指定被摄取的azure对象位置的URI JSON数组, 格式必须为 `azure://<container>/<path-to-file>` | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `prefixes` | 指定被摄取的azure对象所在的路径前缀的URI JSON数组, 格式必须为 `azure://<container>/<prefix>`, 以被给定的前缀开头的空对象将被略过 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。 |
| `objects` | 指定被摄取的azure对象的JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|

注意：只有当 `prefixes` 被指定时，azure输入源将略过空的对象。

azure对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `bucket` | azure Bucket的名称 | None | 是 |
| `path` | 数据路径 | None | 是 |

#### HDFS输入源

> [!WARNING]
> 您需要添加 [`druid-hdfs-extensions`](../configuration/core-ext/hdfs.md) 扩展以便使用HDFS输入源。

HDFS输入源支持直接从HDFS存储中读取文件，文件路径可以指定为HDFS URI字符串或者HDFS URI字符串列表。HDFS输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个文件。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://foo/bar/", "hdfs://bar/foo"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": ["hdfs://foo/bar", "hdfs://bar/foo"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://foo/bar/file.json", "hdfs://bar/foo/file2.json"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": ["hdfs://foo/bar/file.json", "hdfs://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `hdfs` | None | 是 |
| `paths` | HDFS路径。可以是JSON数组或逗号分隔的路径字符串，这些路径支持类似*的通配符。给定路径之下的空文件将会被跳过。 | None | 是 |

您还可以使用HDFS输入源从云存储摄取数据。但是，如果您想从AWS S3或谷歌云存储读取数据，可以考虑使用 [S3输入源](../configuration/core-ext/s3.md) 或 [谷歌云存储输入源](../configuration/core-ext/google-cloud-storage.md)。

#### HTTP输入源

HTTP输入源支持直接通过HTTP从远程站点直接读取文件。 HTTP输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务只能读取一个文件。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

使用DefaultPassword Provider的身份验证字段示例（这要求密码位于摄取规范中）：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
        "httpAuthenticationUsername": "username",
        "httpAuthenticationPassword": "password123"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

您还可以使用其他现有的Druid PasswordProvider。下面是使用EnvironmentVariablePasswordProvider的示例：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
        "httpAuthenticationUsername": "username",
        "httpAuthenticationPassword": {
          "type": "environment",
          "variable": "HTTP_INPUT_SOURCE_PW"
        }
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
}
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `http` | None | 是 |
| `uris` | 输入文件的uris | None | 是 |
| `httpAuthenticationUsername` | 用于指定uri的身份验证的用户名。如果规范中指定的uri需要基本身份验证头，则改属性是可选的。 | None | 否 |
| `httpAuthenticationPassword` | 用于指定uri的身份验证的密码。如果规范中指定的uri需要基本身份验证头，则改属性是可选的。 | None | 否 |

#### Inline输入源

Inline输入源可用于读取其规范内联的数据。它可用于演示或用于快速测试数据解析和schema。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "inline",
        "data": "0,values,formatted\n1,as,CSV"
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```
| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 应该是 `inline` | 是 |
| `data` | 要摄入的内联数据 | 是


#### Local输入源

Local输入源支持直接从本地存储中读取文件，主要目的用于PoC测试。 Local输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务读取一个或者多个文件。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "local",
        "filter" : "*.csv",
        "baseDir": "/data/directory",
        "files": ["/bar/foo", "/foo/bar"]
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 应该是 `local` | 是 |
| `filter` | 文件的通配符筛选器, 详细信息 [点击此处](http://commons.apache.org/proper/commons-io/apidocs/org/apache/commons/io/filefilter/WildcardFileFilter.html) 查看 | 如果 `baseDir` 指定了，则为必须 |
| `baseDir` | 递归搜索要接收的文件的目录, 将跳过 `baseDir` 下的空文件。 | `baseDir` 或者 `files` 至少需要被指定一个 |
| `files` | 要摄取的文件路径。如果某些文件位于指定的 `baseDir` 下，则可以忽略它们以避免摄取重复文件。该选项会跳过空文件。| `baseDir` 或者 `files` 至少需要被指定一个 |

#### Druid输入源

Druid输入源支持直接从现有的Druid段读取数据，可能使用新的模式，并更改段的名称、维度、Metrics、Rollup等。Druid输入源是可拆分的，可以由 [并行任务](#并行任务) 使用。这个输入源有一个固定的从Druid段读取的输入格式；当使用这个输入源时，不需要在摄取规范中指定输入格式字段。

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 应该是 `druid` | 是 |
| `dataSource` | 定义要从中获取行的Druid数据源 | 是 |
| `interval` | ISO-8601时间间隔的字符串，它定义了获取数据的时间范围。 | 是 |
| `dimensions` | 包含要从Druid数据源中选择的维度列名称的字符串列表。如果列表为空，则不返回维度。如果为空，则返回所有维度。 | 否 |
| `metrics` | 包含要选择的Metric列名称的字符串列表。如果列表为空，则不返回任何度量。如果为空，则返回所有Metric。 | 否 |
| `filter` | 详情请查看 [filters](../querying/filters.html) 如果指定，则只返回与筛选器匹配的行。 | 否 |

DruidInputSource规范的最小示例如下所示：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "druid",
        "dataSource": "wikipedia",
        "interval": "2013-01-01/2013-01-02"
      }
      ...
    },
...
```

上面的规范将从 `wikipedia` 数据源中读取所有现有dimension和metric列，包括 `2013-01-01/2013-01-02` 时间间隔内带有时间戳（ `__time` 列）的所有行。

以下规范使用了筛选器并读取原始数据源列子集：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "druid",
        "dataSource": "wikipedia",
        "interval": "2013-01-01/2013-01-02",
        "dimensions": [
          "page",
          "user"
        ],
        "metrics": [
          "added"
        ],
        "filter": {
          "type": "selector",
          "dimension": "page",
          "value": "Druid"
        }
      }
      ...
    },
...
```

上面的规范只返回 `page`、`user` 维度和 `added` 的Metric。只返回`page` = `Druid` 的行。

### Firehoses(已废弃)
#### StaticS3Firehose
#### HDFSFirehose
#### LocalFirehose
#### HttpFirehose
#### IngestSegmentFirehose
#### SqlFirehose
#### InlineFirehose
#### CombiningFirehose