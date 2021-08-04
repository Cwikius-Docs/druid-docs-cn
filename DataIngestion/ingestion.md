

## 数据摄入
### 综述

Druid中的所有数据都被组织成*段*，这些段是数据文件，通常每个段最多有几百万行。在Druid中加载数据称为*摄取或索引*，它包括从源系统读取数据并基于该数据创建段。

在大多数摄取方法中，加载数据的工作由Druid [MiddleManager](../design/MiddleManager.md) 进程（或 [Indexer](../design/Indexer.md) 进程）完成。一个例外是基于Hadoop的摄取，这项工作是使用Hadoop MapReduce作业在YARN上完成的（尽管MiddleManager或Indexer进程仍然参与启动和监视Hadoop作业）。一旦段被生成并存储在 [深层存储](../design/Deepstorage.md) 中，它们将被Historical进程加载。有关如何在引擎下工作的更多细节，请参阅Druid设计文档的[存储设计](../design/Design.md) 部分。

### 如何使用本文档

您**当前正在阅读的这个页面**提供了通用Druid摄取概念的信息，以及 [所有摄取方法](#摄入方式) **通用的配置**信息。

**每个摄取方法的单独页面**提供了有关每个摄取方法**独有的概念和配置**的附加信息。

我们建议您先阅读（或至少略读）这个通用页面，然后参考您选择的一种或多种摄取方法的页面。

### 摄入方式

下表列出了Druid最常用的数据摄取方法，帮助您根据自己的情况选择最佳方法。每个摄取方法都支持自己的一组源系统。有关每个方法如何工作的详细信息以及特定于该方法的配置属性，请查看其文档页。

#### 流式摄取
最推荐、也是最流行的流式摄取方法是直接从Kafka读取数据的 [Kafka索引服务](kafka.md) 。如果你喜欢Kinesis，[Kinesis索引服务](kinesis.md) 也能很好地工作。

下表比较了主要可用选项：

| **Method** | [**Kafka**](kafka.md) | [**Kinesis**](kinesis.md) | [**Tranquility**](tranquility.md) |
| - | - | - | - |
| **Supervisor类型** | `kafka` | `kinesis` | `N/A` |
| 如何工作 | Druid直接从 Apache Kafka读取数据 | Druid直接从Amazon Kinesis中读取数据 | Tranquility, 一个独立于Druid的库，用来将数据推送到Druid |
| 可以摄入迟到的数据 | Yes | Yes | No(迟到的数据将会被基于 `windowPeriod` 的配置丢弃掉) |
| 保证不重不丢（Exactly-once）| Yes | Yes | No

#### 批量摄取

从文件进行批加载时，应使用一次性 [任务](taskrefer.md)，并且有三个选项：`index_parallel`（本地并行批任务）、`index_hadoop`（基于hadoop）或`index`（本地简单批任务）。

一般来说，如果本地批处理能满足您的需要时我们建议使用它，因为设置更简单（它不依赖于外部Hadoop集群）。但是，仍有一些情况下，基于Hadoop的批摄取可能是更好的选择，例如，当您已经有一个正在运行的Hadoop集群，并且希望使用现有集群的集群资源进行批摄取时。

此表比较了三个可用选项：

| **方式** | [**本地批任务(并行)**](native.md#并行任务) | [**基于Hadoop**](hadoopbased.md) | [**本地批任务(简单)**](native.md#简单任务) |
| - | - | - | - |
| **任务类型** | `index_parallel` | `index_hadoop` | `index` |
| **并行?** | 如果 `inputFormat` 是可分割的且 `tuningConfig` 中的 `maxNumConcurrentSubTasks` > 1, 则 **Yes** | Yes | No，每个任务都是单线程的 |
| **支持追加或者覆盖** | 都支持 | 只支持覆盖 | 都支持 |
| **外部依赖** | 无 | Hadoop集群，用来提交Map-Reduce任务 | 无 |
| **输入位置** | 任何 [输入数据源](native.md#输入数据源) | 任何Hadoop文件系统或者Druid数据源 |  任何 [输入数据源](native.md#输入数据源) |
| **文件格式** | 任何 [输入格式](dataformats.md) | 任何Hadoop输入格式 | 任何 [输入格式](dataformats.md) |
| [**Rollup modes**](#Rollup) | 如果 `tuningConfig` 中的 `forceGuaranteedRollup` = true, 则为 **Perfect(最佳rollup)** | 总是Perfect（最佳rollup） | 如果 `tuningConfig` 中的 `forceGuaranteedRollup` = true, 则为 **Perfect(最佳rollup)** |
| **分区选项** | 可选的有`Dynamic`, `hash-based` 和 `range-based` 三种分区方式，详情参见 [分区规范](native.md#partitionsSpec) | 通过 [partitionsSpec](hadoopbased.md#partitionsSpec)中指定 `hash-based` 和 `range-based`分区 | 可选的有`Dynamic`和`hash-based`二种分区方式，详情参见 [分区规范](native.md#partitionsSpec) |

### Druid数据模型
#### 数据源
Druid数据存储在数据源中，与传统RDBMS中的表类似。Druid提供了一个独特的数据建模系统，它与关系模型和时间序列模型都具有相似性。
#### 主时间戳列
Druid Schema必须始终包含一个主时间戳。主时间戳用于对 [数据进行分区和排序](#分区)。Druid查询能够快速识别和检索与主时间戳列的时间范围相对应的数据。Druid还可以将主时间戳列用于基于时间的[数据管理操作](datamanage.md)，例如删除时间块、覆盖时间块和基于时间的保留规则。

主时间戳基于 [`timestampSpec`](#timestampSpec) 进行解析。此外，[`granularitySpec`](#granularitySpec) 控制基于主时间戳的其他重要操作。无论从哪个输入字段读取主时间戳，它都将作为名为 `__time` 的列存储在Druid数据源中。

如果有多个时间戳列，则可以将其他列存储为 [辅助时间戳](schemadesign.md#辅助时间戳)。

#### 维度
维度是按原样存储的列，可以用于任何目的, 可以在查询时以特殊方式对维度进行分组、筛选或应用聚合器。如果在禁用了 [rollup](#Rollup) 的情况下运行，那么该维度集将被简单地视为要摄取的一组列，并且其行为与不支持rollup功能的典型数据库的预期完全相同。

通过 [`dimensionSpec`](#dimensionSpec) 配置维度。

#### 指标
Metrics是以聚合形式存储的列。启用 [rollup](#Rollup) 时，它们最有用。指定一个Metric允许您为Druid选择一个聚合函数，以便在摄取期间应用于每一行。这有两个好处：

1. 如果启用了 [rollup](#Rollup)，即使保留摘要信息，也可以将多行折叠为一行。在 [Rollup教程](../tutorials/chapter-5.md) 中，这用于将netflow数据折叠为每（`minute`，`srcIP`，`dstIP`）元组一行，同时保留有关总数据包和字节计数的聚合信息。
2. 一些聚合器，特别是近似聚合器，即使在非汇总数据上，如果在接收时部分计算，也可以在查询时更快地计算它们。

Metrics是通过 [`metricsSpec`](#metricsSpec) 配置的。

### Rollup
#### 什么是rollup
Druid可以在接收过程中将数据进行汇总，以最小化需要存储的原始数据量。Rollup是一种汇总或预聚合的形式。实际上，Rollup可以极大地减少需要存储的数据的大小，从而潜在地减少行数的数量级。这种存储量的减少是有代价的：当我们汇总数据时，我们就失去了查询单个事件的能力。

禁用rollup时，Druid将按原样加载每一行，而不进行任何形式的预聚合。此模式类似于您对不支持汇总功能的典型数据库的期望。

如果启用了rollup，那么任何具有相同[维度](#维度)和[时间戳](#主时间戳列)的行（在基于 `queryGranularity` 的截断之后）都可以在Druid中折叠或汇总为一行。

rollup默认是启用状态。

#### 启用或者禁用rollup

Rollup由 `granularitySpec` 中的 `rollup` 配置项控制。 默认情况下，值为 `true`(启用状态)。如果你想让Druid按原样存储每条记录，而不需要任何汇总，将该值设置为 `false`。

#### rollup示例
有关如何配置Rollup以及该特性将如何修改数据的示例，请参阅[Rollup教程](../tutorials/chapter-5.md)。

#### 最大化rollup比率
通过比较Druid中的行数和接收的事件数，可以测量数据源的汇总率。这个数字越高，从汇总中获得的好处就越多。一种方法是使用[Druid SQL](../querying/druidsql.md)查询，比如：
```json
SELECT SUM("cnt") / COUNT(*) * 1.0 FROM datasource
```

在这个查询中，`cnt` 应该引用在摄取时指定的"count"类型Metrics。有关启用汇总时计数工作方式的详细信息，请参阅"架构设计"页上的 [计数接收事件数](../DataIngestion/schemadesign.md#计数接收事件数)。

最大化Rollup的提示：
* 一般来说，拥有的维度越少，维度的基数越低，您将获得更好的汇总比率
* 使用 [Sketches](schemadesign.md#Sketches高基维处理) 避免存储高基数维度，因为会损害汇总比率
* 在摄入时调整 `queryGranularity`（例如，使用 `PT5M` 而不是 `PT1M` ）会增加Druid中两行具有匹配时间戳的可能性，并可以提高汇总率
* 将相同的数据加载到多个Druid数据源中是有益的。有些用户选择创建禁用汇总（或启用汇总，但汇总比率最小）的"完整"数据源和具有较少维度和较高汇总比率的"缩写"数据源。当查询只涉及"缩写"集里边的维度时，使用该数据源将导致更快的查询时间，这种方案只需稍微增加存储空间即可完成，因为简化的数据源往往要小得多。
* 如果您使用的 [尽力而为的汇总(best-effort rollup)](#) 摄取配置不能保证[完全汇总(perfect rollup)](#)，则可以通过切换到保证的完全汇总选项，或在初始摄取后在[后台重新编制(reindex)](./datamanage.md#压缩与重新索引)数据索引，潜在地提高汇总比率。

#### 最佳rollup VS 尽可能rollup
一些Druid摄取方法保证了*完美的汇总(perfect rollup)*，这意味着输入数据在摄取时被完美地聚合。另一些则提供了*尽力而为的汇总(best-effort rollup)*，这意味着输入数据可能无法完全聚合，因此可能有多个段保存具有相同时间戳和维度值的行。

一般来说，提供*尽力而为的汇总(best-effort rollup)*的摄取方法之所以这样做，是因为它们要么是在没有清洗步骤（这是*完美的汇总(perfect rollup)*所必需的）的情况下并行摄取，要么是因为它们在接收到某个时间段的所有数据（我们称之为*增量发布(incremental publishing)*）之前完成并发布段。在这两种情况下，理论上可以汇总的记录可能会以不同的段结束。所有类型的流接收都在此模式下运行。

保证*完美的汇总(perfect rollup)*的摄取方法通过额外的预处理步骤来确定实际数据摄取阶段之前的间隔和分区。此预处理步骤扫描整个输入数据集，这通常会增加摄取所需的时间，但提供完美汇总所需的信息。

下表显示了每个方法如何处理汇总：
| **方法** | **如何工作** |
| - | - |
| [本地批](native.md) | 基于配置，`index_parallel` 和 `index` 可以是完美的，也可以是最佳的。 |
| [Hadoop批](hadoopbased.md) | 总是 perfect |
| [Kafka索引服务](kafka.md) | 总是 best-effort | 
| [Kinesis索引服务](kinesis.md) | 总是 best-effort |

### 分区
#### 为什么分区

数据源中段的最佳分区和排序会对占用空间和性能产生重大影响
。
Druid数据源总是按时间划分为*时间块*，每个时间块包含一个或多个段。此分区适用于所有摄取方法，并基于摄取规范的 `dataSchema` 中的 `segmentGranularity`参数。

特定时间块内的段也可以进一步分区，使用的选项根据您选择的摄取类型而不同。一般来说，使用特定维度执行此辅助分区将改善局部性，这意味着具有该维度相同值的行存储在一起，并且可以快速访问。

通常，通过将数据分区到一些常用来做过滤操作的维度（如果存在的话）上，可以获得最佳性能和最小的总体占用空间。而且，这种分区通常会改善压缩性能而且还往往会提高查询性能（用户报告存储容量减少了三倍）。

> [!WARNING]
> 分区和排序是最好的朋友！如果您确实有一个天然的分区维度，那么您还应该考虑将它放在 `dimensionsSpec` 的 `dimension` 列表中的第一个维度，它告诉Druid按照该列对每个段中的行进行排序。除了单独分区所获得的改进之外，这通常还会进一步改进压缩。
> 但是，请注意，目前，Druid总是首先按时间戳对一个段内的行进行排序，甚至在 `dimensionsSpec` 中列出的第一个维度之前，这将使得维度排序达不到最大效率。如果需要，可以通过在 `granularitySpec` 中将 `queryGranularity` 设置为等于 `segmentGranularity` 的值来解决此限制，这将把段内的所有时间戳设置为相同的值，并将"真实"时间戳保存为[辅助时间戳](./schemadesign.md#辅助时间戳)。这个限制可能在Druid的未来版本中被移除。

#### 如何设置分区
并不是所有的摄入方式都支持显式的分区配置，也不是所有的方法都具有同样的灵活性。在当前的Druid版本中，如果您是通过一个不太灵活的方法（如Kafka）进行初始摄取，那么您可以使用 [重新索引的技术(reindex)](./datamanage.md#压缩与重新索引)，在最初摄取数据后对其重新分区。这是一种强大的技术：即使您不断地从流中添加新数据, 也可以使用它来确保任何早于某个阈值的数据都得到最佳分区。

下表显示了每个摄取方法如何处理分区：

| **方法** | **如何工作** |
| - | - |
| [本地批](native.md) | 通过 `tuningConfig` 中的 [`partitionsSpec`](./native.md#partitionsSpec) |
| [Hadoop批](hadoopbased.md) | 通过 `tuningConfig` 中的 [`partitionsSpec`](./native.md#partitionsSpec)  |
| [Kafka索引服务](kafka.md) | Druid中的分区是由Kafka主题的分区方式决定的。您可以在初次摄入后 [重新索引的技术(reindex)](./datamanage.md#压缩与重新索引)以重新分区 | 
| [Kinesis索引服务](kinesis.md) | Druid中的分区是由Kinesis流的分区方式决定的。您可以在初次摄入后 [重新索引的技术(reindex)](./datamanage.md#压缩与重新索引)以重新分区 |

> [!WARNING]
> 
> 注意，当然，划分数据的一种方法是将其加载到分开的数据源中。这是一种完全可行的方法，当数据源的数量不会导致每个数据源的开销过大时，它可以很好地工作。如果使用这种方法，那么可以忽略这一部分，因为这部分描述了如何在单个数据源中设置分区。
> 
> 有关将数据拆分为单独数据源的详细信息以及潜在的操作注意事项，请参阅 [多租户注意事项](../querying/multitenancy.md)。

### 摄入规范

无论使用哪一种摄入方式，数据要么是通过一次性[tasks](taskrefer.md)或者通过持续性的"supervisor"(运行并监控一段时间内的一系列任务)来被加载到Druid中。 在任一种情况下，task或者supervisor的定义都在*摄入规范*中定义。

摄入规范包括以下三个主要的部分：
* [`dataSchema`](#dataschema), 包含了 [`数据源名称`](#datasource), [`主时间戳列`](#timestampspec), [`维度`](#dimensionspec), [`指标`](#metricsspec) 和 [`转换与过滤`](#transformspec)
* [`ioConfig`](#ioconfig), 该部分告诉Druid如何去连接数据源系统以及如何去解析数据。 更多详细信息，可以看[摄入方法](#摄入方式)的文档。
* [`tuningConfig`](#tuningconfig), 该部分控制着每一种[摄入方法](#摄入方式)的不同的特定调整参数

一个 `index_parallel` 类型任务的示例摄入规范如下：
```json
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia",
      "timestampSpec": {
        "column": "timestamp",
        "format": "auto"
      },
      "dimensionsSpec": {
        "dimensions": [
          { "type": "string", "page" },
          { "type": "string", "language" },
          { "type": "long", "name": "userId" }
        ]
      },
      "metricsSpec": [
        { "type": "count", "name": "count" },
        { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
        { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
      ],
      "granularitySpec": {
        "segmentGranularity": "day",
        "queryGranularity": "none",
        "intervals": [
          "2013-08-31/2013-09-01"
        ]
      }
    },
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "local",
        "baseDir": "examples/indexing/",
        "filter": "wikipedia_data.json"
      },
      "inputFormat": {
        "type": "json",
        "flattenSpec": {
          "useFieldDiscovery": true,
          "fields": [
            { "type": "path", "name": "userId", "expr": "$.user.id" }
          ]
        }
      }
    },
    "tuningConfig": {
      "type": "index_parallel"
    }
  }
}
```

该部分中支持的特定选项依赖于选择的[摄入方法](#摄入方式)。 更多的示例，可以参考每一种[摄入方法](#摄入方式)的文档。

您还可以不用编写一个摄入规范，可视化的加载数据，该功能位于 [Druid控制台](../operations/manageui.md) 的 "Load Data" 视图中。 Druid可视化数据加载器目前支持 [Kafka](kafka.md), [Kinesis](kinesis.md) 和 [本地批](native.md) 模式。

#### `dataSchema`
> [!WARNING]
> 
> `dataSchema` 规范在0.17.0版本中做了更改，新的规范支持除*Hadoop摄取方式*外的所有方式。 可以在 [过时的 `dataSchema` 规范]()查看老的规范

`dataSchema` 包含了以下部分：
* [`数据源名称`](#datasource), [`主时间戳列`](#timestampspec), [`维度`](#dimensionspec), [`指标`](#metricsspec) 和 [`转换与过滤`](#transformspec)

一个 `dataSchema` 如下：
```json
"dataSchema": {
  "dataSource": "wikipedia",
  "timestampSpec": {
    "column": "timestamp",
    "format": "auto"
  },
  "dimensionsSpec": {
    "dimensions": [
      { "type": "string", "page" },
      { "type": "string", "language" },
      { "type": "long", "name": "userId" }
    ]
  },
  "metricsSpec": [
    { "type": "count", "name": "count" },
    { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
    { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
  ],
  "granularitySpec": {
    "segmentGranularity": "day",
    "queryGranularity": "none",
    "intervals": [
      "2013-08-31/2013-09-01"
    ]
  }
}
```

##### `dataSource`
`dataSource` 位于 `dataSchema` -> `dataSource` 中，简单的标识了数据将被写入的数据源的名称，示例如下：
```json
"dataSource": "my-first-datasource"
```
##### `timestampSpec`
`timestampSpec` 位于 `dataSchema` -> `timestampSpec` 中，用来配置 [主时间戳](#timestampspec), 示例如下：
```json
"timestampSpec": {
  "column": "timestamp",
  "format": "auto"
}
```
> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

`timestampSpec` 可以包含以下的部分：

<table>
    <thead>
        <th>字段</th>
        <th>描述</th>
        <th>默认值</th>
    </thead>
    <tbody>
        <tr>
            <td>column</td>
            <td>要从中读取主时间戳的输入行字段。<br><br>不管这个输入字段的名称是什么，主时间戳总是作为一个名为"__time"的列存储在您的Druid数据源中</td>
            <td>timestamp</td>
        </tr>
        <tr>
            <td>format</td>
            <td>
                时间戳格式，可选项有：
                <ul>
                    <li><code>iso</code>: 使用"T"分割的ISO8601，像"2000-01-01T01:02:03.456"</li>
                    <li><code>posix</code>: 自纪元以来的秒数</li>
                    <li><code>millis</code>: 自纪元以来的毫秒数</li>
                    <li><code>micro</code>: 自纪元以来的微秒数</li>
                    <li><code>nano</code>: 自纪元以来的纳秒数</li>
                    <li><code>auto</code>: 自动检测ISO或者毫秒格式</li>
                    <li>任何 <a href="http://joda-time.sourceforge.net/apidocs/org/joda/time/format/DateTimeFormat.html">Joda DateTimeFormat字符串</a></li>
                </ul>
            </td>
            <td>auto</td>
        </tr>
        <tr>
            <td>missingValue</td>
            <td>用于具有空或缺少时间戳列的输入记录的时间戳。应该是ISO8601格式，如<code>"2000-01-01T01:02:03.456"</code>。由于Druid需要一个主时间戳，因此此设置对于接收根本没有任何时间戳的数据集非常有用。</td>
            <td>none</td>
        </tr>
    </tbody>
</table>

##### `dimensionSpec`
`dimensionsSpec` 位于 `dataSchema` -> `dimensionsSpec`, 用来配置维度。示例如下：
```json
"dimensionsSpec" : {
  "dimensions": [
    "page",
    "language",
    { "type": "long", "name": "userId" }
  ],
  "dimensionExclusions" : [],
  "spatialDimensions" : []
}
```

> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

`dimensionsSpec` 可以包括以下部分：

| 字段 | 描述 | 默认值 |
|-|-|-|
| dimensions | 维度名称或者对象的列表，在 `dimensions` 和 `dimensionExclusions` 中不能包含相同的列。 <br><br> 如果该配置为一个空数组，Druid将会把所有未出现在 `dimensionExclusions` 中的非时间、非指标列当做字符串类型的维度列，参见[Inclusions and exclusions](#Inclusions-and-exclusions)。 | `[]` |
| dimensionExclusions | 在摄取中需要排除的列名称，在该配置中只支持名称，不支持对象。在 `dimensions` 和 `dimensionExclusions` 中不能包含相同的列。 | `[]` |
| spatialDimensions | 一个[空间维度](../querying/spatialfilter.md)的数组 | `[]` |

###### `Dimension objects`
在 `dimensions` 列的每一个维度可以是一个名称，也可以是一个对象。 提供一个名称等价于提供了一个给定名称的 `string` 类型的维度对象。例如： `page` 等价于 `{"name": "page", "type": "string"}`。

维度对象可以有以下的部分：

| 字段 | 描述 | 默认值 |
|-|-|-|
| type | `string`, `long`, `float` 或者 `double` | `string` |
| name | 维度名称，将用作从输入记录中读取的字段名，以及存储在生成的段中的列名。<br><br> 注意： 如果想在摄取的时候重新命名列，可以使用 [`transformSpec`](#transformspec) | none（必填）|
| createBitmapIndex | 对于字符串类型的维度，是否应为生成的段中的列创建位图索引。创建位图索引需要更多存储空间，但会加快某些类型的筛选（特别是相等和前缀筛选）。仅支持字符串类型的维度。| `true` |

###### `Inclusions and exclusions`
Druid以两种可能的方式来解释 `dimensionsSpec` : *normal* 和 *schemaless*

当 `dimensions` 或者 `spatialDimensions` 为非空时， 将会采用正常的解释方式。 在该情况下， 前边说的两个列表结合起来的集合当做摄入的维度集合。

当 `dimensions` 和 `spatialDimensions` 同时为空或者null时候，将会采用无模式的解释方式。 在该情况下，维度集合由以下方式决定：
1. 首先，从 [`inputFormat`](./dataformats.md) (或者 [`flattenSpec`](./dataformats.md#FlattenSpec), 如果正在使用 )中所有输入字段集合开始 
2. 排除掉任何在 `dimensionExclusions` 中的列
3. 排除掉在 [`timestampSpec`](#timestampspec) 中的时间列
4. 排除掉 [`metricsSpec`](#metricsspec) 中用于聚合器输入的列
5. 排除掉 [`metricsSpec`](#metricsspec) 中任何与聚合器同名的列
6. 所有的其他字段都被按照[默认配置](#dimensionspec)摄入为 `string` 类型的维度

> [!WARNING]
> 注意：在无模式的维度解释方式中，由 [`transformSpec`](#transformspec) 生成的列当前并未考虑。

##### `metricsSpec`

`metricsSpec` 位于 `dataSchema` -> `metricsSpec` 中，是一个在摄入阶段要应用的 [聚合器](../querying/Aggregations.md) 列表。 在启用了 [rollup](#rollup) 时是很有用的，因为它将配置如何在摄入阶段进行聚合。

一个 `metricsSpec` 实例如下：
```json
"metricsSpec": [
  { "type": "count", "name": "count" },
  { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
  { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
]
```
> [!WARNING]
> 通常，当 [rollup](#rollup) 被禁用时，应该有一个空的 `metricsSpec`（因为没有rollup，Druid不会在摄取时进行任何的聚合，所以没有理由包含摄取时聚合器）。但是，在某些情况下，定义Metrics仍然是有意义的：例如，如果要创建一个复杂的列作为 [近似聚合](../querying/Aggregations.md#近似聚合) 的预计算部分，则只能通过在 `metricsSpec` 中定义度量来实现

##### `granularitySpec`

`granularitySpec` 位于 `dataSchema` -> `granularitySpec`, 用来配置以下操作：
1. 通过 `segmentGranularity` 来将数据源分区到 [时间块](../design/Design.md#数据源和段)
2. 如果需要的话，通过 `queryGranularity` 来截断时间戳
3. 通过 `interval` 来指定批摄取中应创建段的时间块
4. 通过 `rollup` 来指定是否在摄取时进行汇总

除了 `rollup`, 这些操作都是基于 [主时间戳列](#主时间戳列)

一个 `granularitySpec` 实例如下：
```json
"granularitySpec": {
  "segmentGranularity": "day",
  "queryGranularity": "none",
  "intervals": [
    "2013-08-31/2013-09-01"
  ],
  "rollup": true
}
```

`granularitySpec` 可以有以下的部分：

| 字段 | 描述 | 默认值 |
|-|-|-|
| type | `uniform` 或者 `arbitrary` ，大多数时候使用 `uniform` | `uniform` |
| segmentGranularity | 数据源的 [时间分块](../design/Design.md#数据源和段) 粒度。每个时间块可以创建多个段, 例如，当设置为 `day` 时，同一天的事件属于同一时间块，该时间块可以根据其他配置和输入大小进一步划分为多个段。这里可以提供任何粒度。请注意，同一时间块中的所有段应具有相同的段粒度。 <br><br> 如果 `type` 字段设置为 `arbitrary` 则忽略 | `day` |
| queryGranularity | 每个段内时间戳存储的分辨率, 必须等于或比 `segmentGranularity` 更细。这将是您可以查询的最细粒度，并且仍然可以查询到合理的结果。但是请注意，您仍然可以在比此粒度更粗的场景进行查询，例如 "`minute`"的值意味着记录将以分钟的粒度存储，并且可以在分钟的任意倍数（包括分钟、5分钟、小时等）进行查询。<br><br> 这里可以提供任何 [粒度](../querying/AggregationGranularity.md) 。使用 `none` 按原样存储时间戳，而不进行任何截断。请注意，即使将 `queryGranularity` 设置为 `none`，也将应用 `rollup`。 | `none` |
| rollup | 是否在摄取时使用 [rollup](#rollup)。 注意：即使 `queryGranularity` 设置为 `none`，rollup也仍然是有效的，当数据具有相同的时间戳时数据将被汇总 | `true` |
| interval | 描述应该创建段的时间块的间隔列表。如果 `type` 设置为`uniform`，则此列表将根据 `segmentGranularity` 进行拆分和舍入。如果 `type` 设置为 `arbitrary` ，则将按原样使用此列表。<br><br> 如果该值不提供或者为空值，则批处理摄取任务通常会根据在输入数据中找到的时间戳来确定要输出的时间块。<br><br> 如果指定，批处理摄取任务可以跳过确定分区阶段，这可能会导致更快的摄取。批量摄取任务也可以预先请求它们的所有锁，而不是逐个请求。批处理摄取任务将丢弃任何时间戳超出指定间隔的记录。<br><br> 在任何形式的流摄取中忽略该配置。 | `null` |

##### `transformSpec`
`transformSpec` 位于 `dataSchema` -> `transformSpec`，用来摄取时转换和过滤输入数据。 一个 `transformSpec` 实例如下：
```json
"transformSpec": {
  "transforms": [
    { "type": "expression", "name": "countryUpper", "expression": "upper(country)" }
  ],
  "filter": {
    "type": "selector",
    "dimension": "country",
    "value": "San Serriffe"
  }
}
```

> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

##### 过时的 `dataSchema` 规范
> [!WARNING]
> 
> `dataSchema` 规范在0.17.0版本中做了更改，新的规范支持除*Hadoop摄取方式*外的所有方式。 可以在 [`dataSchema`](#dataschema)查看老的规范

除了上面 `dataSchema` 一节中列出的组件之外，过时的 `dataSchema` 规范还有以下两个组件。
* [input row parser](), [flatten of nested data]()

**parser**(已废弃)
在过时的 `dataSchema` 中，`parser` 位于 `dataSchema` -> `parser`中，负责配置与解析输入记录相关的各种项。由于 `parser` 已经废弃，不推荐使用，强烈建议改用 `inputFormat`。 对于 `inputFormat` 和支持的 `parser` 类型，可以参见 [数据格式](dataformats.md)。

`parseSpec`主要部分的详细，参见他们的子部分：
* [`timestampSpec`](#timestampspec), 配置 [主时间戳列](#主时间戳列)
* [`dimensionsSpec`](#dimensionspec), 配置 [维度](#维度)
* [`flattenSpec`](./dataformats.md#FlattenSpec) 

一个 `parser` 实例如下：

```json
"parser": {
  "type": "string",
  "parseSpec": {
    "format": "json",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        { "type": "path", "name": "userId", "expr": "$.user.id" }
      ]
    },
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [
        { "type": "string", "page" },
        { "type": "string", "language" },
        { "type": "long", "name": "userId" }
      ]
    }
  }
}
```
**flattenSpec**
在过时的 `dataSchema` 中，`flattenSpec` 位于`dataSchema` -> `parser` -> `parseSpec` -> `flattenSpec`中，负责在潜在的嵌套输入数据（如JSON、Avro等）和Druid的数据模型之间架起桥梁。有关详细信息，请参见 [flattenSpec](./dataformats.md#FlattenSpec) 。

#### `ioConfig`

`ioConfig` 影响从源系统（如Apache Kafka、Amazon S3、挂载的文件系统或任何其他受支持的源系统）读取数据的方式。`inputFormat` 属性适用于除Hadoop摄取之外的[所有摄取方法](#摄入方式)。Hadoop摄取仍然使用过时的 `dataSchema` 中的 [parser]。`ioConfig` 的其余部分特定于每个单独的摄取方法。读取JSON数据的 `ioConfig` 示例如下：
```json
"ioConfig": {
    "type": "<ingestion-method-specific type code>",
    "inputFormat": {
      "type": "json"
    },
    ...
}
```
详情可以参见每个 [摄取方式](#摄入方式) 提供的文档。

#### `tuningConfig`

优化属性在 `tuningConfig` 中指定，`tuningConfig` 位于摄取规范的顶层。有些属性适用于所有摄取方法，但大多数属性特定于每个单独的摄取方法。`tuningConfig` 将所有共享的公共属性设置为默认值的示例如下：
```json
"tuningConfig": {
  "type": "<ingestion-method-specific type code>",
  "maxRowsInMemory": 1000000,
  "maxBytesInMemory": <one-sixth of JVM memory>,
  "indexSpec": {
    "bitmap": { "type": "concise" },
    "dimensionCompression": "lz4",
    "metricCompression": "lz4",
    "longEncoding": "longs"
  },
  <other ingestion-method-specific properties>
}
```

| 字段 | 描述 | 默认值 |
|-|-|-|
| type | 每一种摄入方式都有自己的类型，必须指定为与摄入方式匹配的类型。通常的选项有 `index`, `hadoop`, `kafka` 和 `kinesis` | | 
| maxRowsInMemory | 数据持久化到硬盘前在内存中存储的最大数据条数。 注意，这个数字是汇总后的，所以可能并不等于输入的记录数。 当摄入的数据达到 `maxRowsInMemory` 或者 `maxBytesInMemory` 时数据将被持久化到硬盘。 | `1000000` |
| maxBytesInMemory | 在持久化之前要存储在JVM堆中的数据最大字节数。这是基于对内存使用的粗略估计。当达到 `maxRowsInMemory` 或`maxBytesInMemory` 时（以先发生的为准），摄取的记录将被持久化到磁盘。<br><br>将 `maxBytesInMemory` 设置为-1将禁用此检查，这意味着Druid将完全依赖 `maxRowsInMemory` 来控制内存使用。将其设置为零意味着将使用默认值（JVM堆大小的六分之一）。<br><br> 请注意，内存使用量的估计值被设计为高估值，并且在使用复杂的摄取时聚合器（包括sketches）时可能特别高。如果这导致索引工作负载过于频繁地持久化到磁盘，则可以将 `maxBytesInMemory` 设置为-1并转而依赖 `maxRowsInMemory`。 | JVM堆内存最大值的1/6 |
| indexSpec | 优化数据如何被索引，详情可以看下面的表格 | 看下面的表格 |
| 其他属性 | 每一种摄入方式都有其自己的优化属性。 详情可以查看每一种方法的文档。 [Kafka索引服务](kafka.md), [Kinesis索引服务](kinesis.md), [本地批](native.md) 和 [Hadoop批](hadoopbased.md) | |

**`indexSpec`**

上边表格中的 `indexSpec` 部分可以包含以下属性：

| 字段 | 描述 | 默认值 |
|-|-|-|
| bitmap | 位图索引的压缩格式。 需要一个 `type` 设置为 `concise` 或者 `roaring` 的JSON对象。对于 `roaring`类型，布尔属性`compressRunOnSerialization`（默认为true）控制在确定运行长度编码更节省空间时是否使用该编码。 | `{"type":"concise"}` |
| dimensionCompression | 维度列的压缩格式。 可选项有 `lz4`, `lzf` 或者 `uncompressed` | `lz4` |
| metricCompression | Metrics列的压缩格式。可选项有 `lz4`, `lzf`, `uncompressed` 或者 `none`(`none` 比 `uncompressed` 更有效，但是在老版本的Druid不支持) | `lz4` |
| longEncoding | long类型列的编码格式。无论它们是维度还是Metrics，都适用，选项是 `auto` 或 `long`。`auto` 根据列基数使用偏移量或查找表对值进行编码，并以可变大小存储它们。`longs` 按原样存储值，每个值8字节。 | `longs` |

除了这些属性之外，每个摄取方法都有自己的特定调整属性。有关详细信息，请参阅每个 [摄取方法](#摄入方式) 的文档。