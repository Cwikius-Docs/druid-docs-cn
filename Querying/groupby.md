<!-- toc -->
## GroupBy查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

这些类型的Apache Druid查询获取一个GroupBy查询对象，并返回一个JSON对象数组，其中每个对象表示查询所请求的分组。

> [!WARNING]
> 如果您正在使用时间作为唯一的分组进行聚合，或者在单个维度上使用有序的GroupBy，请考虑 [Timeseries](timeseriesquery.md) 和 [TopN](topn.md) 查询以及GroupBy。在某些情况下，他们的表现可能会更好。更多详细信息，请参阅下面的[备选方案](#备选方案)。

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
#### 备选方案
#### 嵌套的GroupBy查询
#### 配置
#### 高级配置