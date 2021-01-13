<!-- toc -->
## GroupBy查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

这些类型的Apache Druid查询获取一个GroupBy查询对象，并返回一个JSON对象数组，其中每个对象表示查询所请求的分组。

> [!WARNING]
> 如果您正在使用时间作为唯一的分组进行聚合，或者在单个维度上使用有序的GroupBy，请考虑 [Timeseries](timeseriesquery.md) 和 [TopN](topn.md) 查询以及GroupBy。在某些情况下，他们的表现可能会更好。更多详细信息，请参阅下面的[备选方案](#备选方案)。


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



GroupBy查询对象的示例如下所示:
```json
{
  "queryType": "groupBy",
  "dataSource": "sample_datasource",
  "granularity": "day",
  "dimensions": ["country", "device"],
  "limitSpec": { "type": "default", "limit": 5000, "columns": ["country", "data_transfer"] },
  "filter": {
    "type": "and",
    "fields": [
      { "type": "selector", "dimension": "carrier", "value": "AT&T" },
      { "type": "or",
        "fields": [
          { "type": "selector", "dimension": "make", "value": "Apple" },
          { "type": "selector", "dimension": "make", "value": "Samsung" }
        ]
      }
    ]
  },
  "aggregations": [
    { "type": "longSum", "name": "total_usage", "fieldName": "user_count" },
    { "type": "doubleSum", "name": "data_transfer", "fieldName": "data_transfer" }
  ],
  "postAggregations": [
    { "type": "arithmetic",
      "name": "avg_usage",
      "fn": "/",
      "fields": [
        { "type": "fieldAccess", "fieldName": "data_transfer" },
        { "type": "fieldAccess", "fieldName": "total_usage" }
      ]
    }
  ],
  "intervals": [ "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000" ],
  "having": {
    "type": "greaterThan",
    "aggregation": "total_usage",
    "value": 100
  }
}
```
下表内容为一个GroupBy查询的主要部分：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| queryType | 该字符串应该总是"groupBy", Druid根据该值来确定如何解析查询 | 是 |
| dataSource | 定义将要查询的字符串或者对象，与关系型数据库中的表类似。 详情可以查看 [数据源](datasource.md) 部分。 | 是 |
| dimension | 一个用来GroupBy的json List，详情参见[DimensionSpec](dimensionspec.md)来了解提取维度的方式 | 是 |
| limitSpec | 参见[limitSpec](limitspec.md) | 否 |
| having | 参见[Having](having.md) | 否 |
| granularity | 定义查询粒度，参见 [Granularities](granularity.md) | 是 |
| filter | 参见[Filters](filters.md) | 否 |
| aggregations | 参见[Aggregations](Aggregations.md) | 否 |
| postAggregations | 参见[Post Aggregations](postaggregation.md) | 否 |
| intervals | ISO-8601格式的时间间隔，定义了查询的时间范围 | 是 |
| subtotalsSpec | 一个JSON数组，返回顶级维度子集分组的附加结果集。稍后将更详细地[描述它](#关于subtotalSpec)。| 否 |
| context | 参见[Context](query-context.md)  | 否 |

把它们放在一起，上面的查询将返回n*m个数据点，最多5000个点，其中n是 `country`维度的基数，m是`device`维度的基数，在2012-01-01和2012-01-03之间的每一天，都会从`sample_datasource`表返回。如果数据点的值大于100，则每个数据点包含`longSum total_usage`，对于特定的`country`和`device`分组，每个数据点都包含`double total_usage`除以`data_transfer`的结果。输出如下：

```json
[
  {
    "version" : "v1",
    "timestamp" : "2012-01-01T00:00:00.000Z",
    "event" : {
      "country" : <some_dim_value_one>,
      "device" : <some_dim_value_two>,
      "total_usage" : <some_value_one>,
      "data_transfer" :<some_value_two>,
      "avg_usage" : <some_avg_usage_value>
    }
  },
  {
    "version" : "v1",
    "timestamp" : "2012-01-01T00:00:12.000Z",
    "event" : {
      "dim1" : <some_other_dim_value_one>,
      "dim2" : <some_other_dim_value_two>,
      "sample_name1" : <some_other_value_one>,
      "sample_name2" :<some_other_value_two>,
      "avg_usage" : <some_other_avg_usage_value>
    }
  },
...
]
```

### 多值维度上的GroupBy

GroupBy查询可以按多值维度分组。在多值维度上分组时，来自匹配行的所有值将用于为每个值生成一个组，查询返回的组可能多于行数。例如，带有过滤器"t1"和"t3"的`tags`维度上的GroupBy将只匹配row1，并生成包含三个组的结果：`t1`、`t2`和`t3`。如果只需要包含与过滤器匹配的值，则可以使用[过滤的dimensionSpec](dimensionspec.md), 这也可以提高性能。

有关详细信息，请参见[多值维度](multi-value-dimensions.md)。

### 关于subtotalSpec

小计功能允许在单个查询中计算多个子分组。要使用此功能，请在查询中添加"subtotalsSpec"，它应该是子组维度集的列表。它应该包含"dimensions"属性中维度的"outputName"，顺序与它们在"dimensions"属性中出现的顺序相同（当然，您可以跳过一些）。例如，考虑这样一个groupBy查询：

```json
{
"type": "groupBy",
 ...
 ...
"dimensions": [
  {
  "type" : "default",
  "dimension" : "d1col",
  "outputName": "D1"
  },
  {
  "type" : "extraction",
  "dimension" : "d2col",
  "outputName" :  "D2",
  "extractionFn" : extraction_func
  },
  {
  "type":"lookup",
  "dimension":"d3col",
  "outputName":"D3",
  "name":"my_lookup"
  }
],
...
...
"subtotalsSpec":[ ["D1", "D2", D3"], ["D1", "D3"], ["D3"]],
..

}
```

返回的响应相当于将"dimensions"字段为["D1"、"D2"、"D3"]、["D1"、"D3"]和["D3"]的3个groupBy查询的结果与上面查询中使用的适当`DimensionSpec`连接起来。上述查询的响应如下所示:

```json
[
  {
    "version" : "v1",
    "timestamp" : "t1",
    "event" : { "D1": "..", "D2": "..", "D3": ".." }
    }
  },
    {
    "version" : "v1",
    "timestamp" : "t2",
    "event" : { "D1": "..", "D2": "..", "D3": ".." }
    }
  },
  ...
  ...

   {
    "version" : "v1",
    "timestamp" : "t1",
    "event" : { "D1": "..", "D3": ".." }
    }
  },
    {
    "version" : "v1",
    "timestamp" : "t2",
    "event" : { "D1": "..", "D3": ".." }
    }
  },
  ...
  ...

  {
    "version" : "v1",
    "timestamp" : "t1",
    "event" : { "D3": ".." }
    }
  },
    {
    "version" : "v1",
    "timestamp" : "t2",
    "event" : { "D3": ".." }
    }
  },
...
]
```

### 详细实现

#### 策略

GroupBy查询可以使用两种不同的策略执行。默认策略由Broker上的"druid.query.groupBy.defaultStrategy"运行时属性来决定，也可以在查询上下文中使用"groupByStrategy"重写。如果上下文字段和属性都未设置，则将使用"v2"策略。

* 默认设置为"v2"，旨在提供更好的性能和内存管理。此策略使用完全堆外映射生成每段结果。数据处理使用完全堆外并发事实映射和堆内字符串字典合并每个段的结果, 这可能包括溢出到磁盘。数据进程将已排序的结果返回给Broker，Broker使用N-way来合并已合并的结果流。Broker在必要时将结果具体化（例如，如果查询对列而不是维度进行排序）。否则，在合并结果时，它会将结果流式返回
* "v1"是一个遗留引擎，它使用一个部分在堆上（维度键和映射本身）和部分在堆外（聚合值）的映射在数据处理（Historical、Realtime、MiddleManager）上生成每段结果。数据处理然后使用Druid的索引机制合并每个片段的结果。默认情况下，此合并是多线程的，但也可以是单线程的。Broker再次使用Druid的索引机制合并最终结果集，Broker合并总是单线程的。因为Broker使用索引机制合并结果，所以它必须在返回任何结果之前具体化完整的结果集。在数据进程和Broker上，默认情况下合并索引完全在堆上，但它可以选择将聚合值存储在堆外。

#### v1和v2之间的差别

两个引擎之间的查询API和结果是兼容的；但是，从集群配置的角度来看，有一些不同：

* groupBy v1使用基于行的限制（maxResults）控制资源使用，而groupBy v2使用基于字节的限制。此外，groupBy v1在堆上合并结果，而groupBy v2在堆外合并结果。这些因素意味着内存调优和资源限制在v1和v2之间表现不同。特别是，由于这一点，一些可以在一个引擎中成功完成的查询可能会超出资源限制，并在另一个引擎中失败。有关详细信息，请参阅[内存调整和资源限制](#内存优化与资源限制)部分。
* groupBy v1对并发运行的查询数量没有限制，而groupBy v2通过使用有限大小的合并缓冲池来控制内存使用。默认情况下，合并缓冲区的数量是处理线程数的1/4。您可以根据需要进行调整，以平衡并发性和内存使用。
* groupBy v1支持在Broker或Historical进程上进行缓存，而groupBy v2只支持对Historical进程进行缓存。
* groupBy v2支持基于数组的聚合和基于哈希的聚合。仅当分组键是单个索引字符串列时，才使用基于数组的聚合。在基于数组的聚合中，使用字典编码的值作为索引，这样就可以直接访问数组中的聚合值，而无需基于哈希查找桶。

#### 内存优化与资源限制

当使用groupBy v2版本时候，通过三个参数来控制资源使用和限制：

* `druid.processing.buffer.sizeBytes`, 每个查询用于聚合的堆外哈希表的大小（以字节为单位）, 一次最多创建`druid.processing.numMergeBuffers`个哈希表，这也是并发运行的groupBy查询数量的上限。
* `druid.query.groupBy.maxMergingDictionarySize`, 对每个查询的字符串进行分组时使用的堆上字典的大小（以字节为单位）。注意，这是基于对字典大小的粗略估计，而不是实际大小。
* `druid.query.groupBy.maxOnDiskStorage`:每个查询用于聚合的磁盘空间量（以字节为单位）。默认情况下，这是0，这意味着聚合将不使用磁盘。


如果`maxOnDiskStorage`为0（默认值），则超出堆内字典限制或堆外聚合表限制的查询将失败，并出现"Resource limit exceeded"错误，说明超出的限制。

如果`maxOnDiskStorage`大于0，则超出内存限制的查询将开始使用磁盘进行聚合。在这种情况下，当堆内字典或堆外哈希表填满时，部分聚合的记录将被排序并刷新到磁盘。然后，两个内存中的结构都将被清除，以便进一步聚合。然后继续超过`maxOnDiskStorage`的查询将失败，并出现"Resource limit exceeded"错误，指示它们的磁盘空间不足。

对于groupBy v2，集群操作符应该确保堆外哈希表和堆内合并字典不会超过最大可能并发查询负载的可用内存（由`druid.processing.numMergeBuffers`控制)。有关直接内存使用（按Druid进程类型组织）的更多详细信息，请参阅[基本集群调优指南](../Operations/basicClusterTuning.md)。

Broker对基础的groupBy查询不需要合并缓冲区。包含子查询的查询（使用`query`数据源）需要一个合并缓冲区（如果有一个子查询），如果有多个嵌套子查询层，则需要两个合并缓冲区。包含[`subtotals`](#关于subtotalSpec)的查询需要一个合并缓冲区。它们可以相互堆叠：一个包含多层嵌套子查询的groupBy查询，也使用小计，将需要三个合并缓冲区。

Historical和摄取任务需要为每个groupBy查询提供一个合并缓冲区，除非启用了并行组合，在这种情况下，每个查询需要两个合并缓冲区。

使用groupBy v1时，所有聚合都在堆上完成，资源限制通过参数`druid.query.groupBy.maxResults`来决定，这是对结果集中最大结果数的限制。超过此限制的查询将失败，并显示"Resource limit exceeded"错误，指示它们超出了行限制。集群操作应该确保堆上聚合不会超过预期并发查询负载的可用JVM堆空间。

#### v2版本的性能优化

**限制下推优化**

Druid将groupBy查询中的`limit`规范推到Historical数据段中，以便尽早删除不必要的中间结果，并将传输给Broker的数据量降到最低。默认情况下，仅当`orderBy`规范中的所有字段都是分组键的子集时，才应用此技术。这是因为如果`orderBy`规范包含任何不在分组键中的字段，`limitPushDown`不能保证准确的结果。但是, 即使在这种情况下, 如果您可以牺牲一些准确性来快速处理topN查询, 您也可以启用此技术。可以在[高级配置](#高级配置)部分中查看`forceLimitPushDown`。

**优化哈希表**

groupBy v2通过寻址打开哈希引擎来用于聚合。哈希表使用给定的初始bucket编号初始化，并在缓冲区满时逐渐增长。在哈希冲突中，使用了线性探测技术。

初始bucket的默认数目是1024个，哈希表的默认最大负载因子是0.7。如果在哈希表中可以看到太多的冲突，可以调整这些数字。可以在[高级配置](#高级配置)部分中查看 `bufferGrouperInitialBuckets`和`bufferGrouperMaxLoadFactor`。

**并行合并**

一旦Historical使用哈希表完成数据聚合，它将对聚合结果进行排序并将其合并，然后再发送到Broker进行N路合并聚合。默认情况下，Historical使用其所有可用的处理线程（由`druid.processing.numThreads`配置)用于聚合，但使用单个线程对聚合结果进行排序和合并，这是一个http线程，用于向代Broker发送数据。

这是为了防止一些繁重的groupBy查询阻塞其他查询。在Druid中，处理线程在所有提交的查询之间共享，它们是*不可中断的*。这意味着，如果一个重查询占用了所有可用的处理线程，那么所有其他查询都可能被阻塞，直到重查询完成。GroupBy查询通常比timeseries或topN查询花费更长的时间，因此它们应该尽快释放处理线程。

但是，您可能会关心一些非常繁重的groupBy查询的性能。通常，重groupBy查询的性能瓶颈是合并排序的聚合。在这种情况下，也可以使用处理线程，这叫做*并行合并*。要启用并行合并，请参阅[高级配置](#高级配置)中的 `numParallelCombineThreads` 参数。

启用并行合并后，groupBy v2引擎可以创建一个合并树来合并排序的聚合。树的每个中间节点都是一个线程，它合并了来自子节点的聚合。叶节点线程从哈希表（包括溢出的哈希表）读取和合并聚合。通常，叶进程比中间节点慢，因为它们需要从磁盘读取数据。因此，默认情况下，中间节点使用的线程较少。可以更改中间节点的阶数。请参阅[高级配置](#高级配置)中的 `intermediateCombineDegree`。

请注意，每个Historical都需要两个合并缓冲区来处理带有并行合并的groupBy v2查询：一个用于计算每个段的中间聚合，另一个用于并行合并中间聚合。

#### 备选方案

在某些情况下，其他查询类型可能比groupBy更好。

* 对于没有"维度"的查询（即仅按时间分组），[Timeseries查询](timeseriesquery.md)通常比groupBy快。主要的区别在于，它是以完全流的方式实现的（利用段已经按时排序的事实），并且不需要使用哈希表进行合并。
* 对于具有单个"维度"元素的查询（即按一个字符串维度分组），[TopN查询](topn.md)通常会比groupBy快。这是特别真实的，如果你是按指标排序，并发现近似结果可以接受。

#### 嵌套的GroupBy查询

嵌套的groupby(类型为"query"的数据源)对"v1"和"v2"的执行方式不同。broker首先以通常的方式运行内部groupBy查询,"v1"策略然后用Druid的索引机制在堆上具体化内部查询的结果，并对这些具体化的结果运行外部查询。"v2"策略在内部查询的结果流上运行外部查询，其中包含堆外事实映射和堆内字符串字典，这些字典可能溢出到磁盘。这两种策略都以单线程方式对Broker执行外部查询。

#### 配置

本节介绍groupBy查询的配置。可以在Broker、Historical和MiddleManager进程上设置运行时属性运行`runtime.properties`, 可以通过查询上下文设置查询上下文参数。

**groupBy v2的一些配置**

支持的运行时属性：

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.query.groupBy.maxMergingDictionarySize` | 合并期间用于字符串字典的最大堆空间量（大约）。当字典超过此大小时，将触发溢出到磁盘。 | 100000000 |
| `druid.query.groupBy.maxOnDiskStorage` | 当合并缓冲区或字典已满时，每个查询用于将结果集溢出到磁盘的最大磁盘空间量。超过此限制的查询将失败。设置为零以禁用磁盘溢出。 | 0(禁用)|

支持的查询上下文：

| key | 描述 |
|-|-|
| `maxMergingDictionarySize` | 在本次查询中取与`druid.query.groupBy.maxMergingDictionarySize`比较小的值 |
| `maxOnDiskStorage` | 在本次查询中取与``druid.query.groupBy.maxOnDiskStorage`比较小的值 |

#### 高级配置

**所有GroupBy策略的通用配置**

支持的运行时属性：

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.query.groupBy.defaultStrategy` | 默认的GroupBy查询策略 | v2 |
| `druid.query.groupBy.singleThreaded` | 使用单线程合并结果 | false |

支持的查询上下文：

| key | 描述 |
|-|-|
| `groupByStrategy` | 覆盖 `druid.query.groupBy.defaultStrategy` 的值 |
| `groupByIsSingleThreaded` | 覆盖 `druid.query.groupBy.singleThreaded` 的值 |

**GroupBy V2配置**

支持的运行时属性：

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.query.groupBy.bufferGrouperInitialBuckets` | 堆外哈希表中用于分组结果的初始存储桶数。设置为0以使用合理的默认值（1024）。 | 0 |
| `druid.query.groupBy.bufferGrouperMaxLoadFactor` | 用于分组结果的堆外哈希表的最大负载因子。当负载因子超过此大小时，表将增长或溢出到磁盘。设置为0以使用合理的默认值（0.7） | 0 |
| `druid.query.groupBy.forceHashAggregation` | 强制使用基于哈希的聚合 | false |
| `druid.query.groupBy.intermediateCombineDegree` | 合并树中合并在一起的中间节点数。如果服务器有足够强大的cpu内核，那么更高的度将需要更少的线程，这可能有助于通过减少过多线程的开销来提高查询性能。 | 8 |
| `druid.query.groupBy.numParallelCombineThreads` | 并行合并线程数的提示。该值应大于1以启用并行合并功能。用于并行合并的实际线程数为`druid.query.groupBy.numParallelCombineThreads`和`druid.processing.numThreads`中较小的数 | 1(禁用) |
| `druid.query.groupBy.applyLimitPushDownToSegment` | 如果Broker将限制向下推到可查询的数据服务器（Historical，Peon），则在段扫描期间限制结果。如果数据服务器上通常有大量段参与查询，则如果启用此设置，可能会违反直觉地降低性能。 | false(禁用) |

支持的查询上下文：

| key | 描述 | 默认值 |
|-|-|-|
| `bufferGrouperInitialBuckets` | 覆盖本次查询`druid.query.groupBy.bufferGrouperInitialBuckets`的值 | None |
| `bufferGrouperMaxLoadFactor` | 覆盖本次查询`druid.query.groupBy.bufferGrouperMaxLoadFactor`的值 | None |
| `forceHashAggregation` | 覆盖本次查询`druid.query.groupBy.forceHashAggregation`的值 | None |
| `intermediateCombineDegree` | 覆盖本次查询`druid.query.groupBy.intermediateCombineDegree`的值 | None |
| `numParallelCombineThreads` | 覆盖本次查询`druid.query.groupBy.numParallelCombineThreads`的值 | None|
| `sortByDimsFirst` | 首先按维度值排序结果，然后按时间戳排序。| false |
| `forceLimitPushDown` | 当orderby中的所有字段都是分组键的一部分时，broker将把limit操作下推到Historical。当排序顺序使用不在分组键中的字段时，使用此优化可能会导致精度未知的近似结果，因此在这种情况下默认情况下禁用此优化。启用此上下文标志将为包含非分组键列的limit/orderbys启用limit下推。 | false |
| `applyLimitPushDownToSegment` | 如果Broker将limit向下推到可查询的节点（Historical，Peon），则在段扫描期间限制结果。这个上下文的值将覆盖 `druid.query.groupBy.applyLimitPushDownToSegment` | true |

**GroupBy V1配置**

支持的运行时属性：

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.query.groupBy.maxIntermediateRows` | 每段分组引擎的最大中间行数。这是一个优化参数，它不会强加硬限制；相反，它可能会将合并工作从每段引擎转移到整个合并索引。超过此限制的查询不会失败。 | 50000 |
| `druid.query.groupBy.maxResults` | 最大结果数。超过此限制的查询将失败。 | 500000 |

支持的查询上下文：

| key | 描述 | 默认值 |
|-|-|-|
| `maxIntermediateRows` | 在本次查询中取与`druid.query.groupBy.maxIntermediateRows`比较小的值 | None |
| `maxResults` | 在本次查询中取与`druid.query.groupBy.maxResults`比较小的值 | None |
| `useOffheap` | 设置为true可在合并结果时将聚合存储在堆外。 | false |

**基于数组的结果行**

在内部，Druid总是使用基于数组的groupBy结果行表示，但在默认情况下，它在broker处被转换为基于map的结果格式。为了减少这种转换的开销，如果在查询上下文中将`resultAsArray`设置为`true`，则还可以直接以基于数组的格式从broker返回结果。

每一行都是位置行，并按顺序包含以下字段：
* 时间戳（可选；仅适用于粒度！=全部）
* 维度（按顺序）
* 聚合器（按顺序）
* 后聚合器（可选；按顺序，如果存在）
  
此架构在响应中不可用，因此必须从发出的查询中计算它才能正确读取结果。