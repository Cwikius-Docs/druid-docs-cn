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
#### v1和v2之间的差别
#### 内存优化与资源限制
#### v2版本的性能优化
#### 备选方案
#### 嵌套的GroupBy查询
#### 配置
#### 高级配置