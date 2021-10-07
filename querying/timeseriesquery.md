## Timeseries 查询

> 
> Apache Druid支持两种查询语言： [Druid SQL](sql.md) 和 [原生查询](querying.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](sql.md#query-types)。

该类型的查询将会得到一个时间序列的查询结果，返回的是一个 JSON 对象数组，数组中的每一个对象表示被Timeseries查询所查的值。

一个 Timeseries 查询的实例如下：

```json
{
  "queryType": "timeseries",
  "dataSource": "sample_datasource",
  "granularity": "day",
  "descending": "true",
  "filter": {
    "type": "and",
    "fields": [
      { "type": "selector", "dimension": "sample_dimension1", "value": "sample_value1" },
      { "type": "or",
        "fields": [
          { "type": "selector", "dimension": "sample_dimension2", "value": "sample_value2" },
          { "type": "selector", "dimension": "sample_dimension3", "value": "sample_value3" }
        ]
      }
    ]
  },
  "aggregations": [
    { "type": "longSum", "name": "sample_name1", "fieldName": "sample_fieldName1" },
    { "type": "doubleSum", "name": "sample_name2", "fieldName": "sample_fieldName2" }
  ],
  "postAggregations": [
    { "type": "arithmetic",
      "name": "sample_divide",
      "fn": "/",
      "fields": [
        { "type": "fieldAccess", "name": "postAgg__sample_name1", "fieldName": "sample_name1" },
        { "type": "fieldAccess", "name": "postAgg__sample_name2", "fieldName": "sample_name2" }
      ]
    }
  ],
  "intervals": [ "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000" ]
}
```

时间序列查询主要包括7个主要部分：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `queryType` | 该字符串总是"timeseries"; 该字段告诉Apache Druid如何去解释这个查询 | 是 |
| `dataSource` | 用来标识查询的的字符串或者对象，与关系型数据库中的表类似。查看[数据源](datasource.md)可以获得更多信息  | 是 |
| `descending` | 是否对结果集进行降序排序,默认是`false`, 也就是升序排列 | 否 |
| `intervals` | ISO-8601格式的JSON对象，定义了要查询的时间范围 | 是 |
| `granularity` | 定义了查询结果的粒度，参见 [Granularity](granularity.md) | 是 |
| `filter` | 参见 [Filters](filters.md) | 否 |
| `aggregations` | 参见 [聚合](aggregations.md)| 否 |
| `postAggregations` | 参见[Post Aggregations](postaggregation.md) | 否 |
| `limit` | 限制返回结果数量的整数值，默认是unlimited | 否 |
| `context` | 可以被用来修改查询行为，包括 [Grand Total](#grand-total共计) 和 [Zero-filling](#zero-filling0填充)。详情可以看 [上下文参数](query-context.md)部分中的所有参数类型 | 否 |

为了将所有数据集中起来，上面的查询将从 "sample_datasource" 表返回2个数据点，在 2012-01-01 和 2012-01-03 期间每天一个。

每个数据点将是 sample_fieldName1 的 longSum、sample_fieldName2 的 doubleSum 以及 sample_fieldName1 除以sample_fieldName2 的 double结果。

输出如下：

```json
[
  {
    "timestamp": "2012-01-01T00:00:00.000Z",
    "result": { "sample_name1": <some_value>, "sample_name2": <some_value>, "sample_divide": <some_value> }
  },
  {
    "timestamp": "2012-01-02T00:00:00.000Z",
    "result": { "sample_name1": <some_value>, "sample_name2": <some_value>, "sample_divide": <some_value> }
  }
]
```

### Grand Total(统计)

Druid 可以在时间序列查询的结果集中增加一个额外的 "总计"行，通过在上下文中增加 `"grandTotal":true` 来启用该功能，例如：

```json
{
  "queryType": "timeseries",
  "dataSource": "sample_datasource",
  "intervals": [ "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000" ],
  "granularity": "day",
  "aggregations": [
    { "type": "longSum", "name": "sample_name1", "fieldName": "sample_fieldName1" },
    { "type": "doubleSum", "name": "sample_name2", "fieldName": "sample_fieldName2" }
  ],
  "context": {
    "grandTotal": true
  }
}
```

总计行将显示为结果数组中的最后一行，并且没有时间戳。即使查询以"降序"模式运行，它也将是最后一行。

总计行中的后聚合将基于总计聚合计算。

### Zero-filling(0填充)

Timeseries 查询通常用零填充空的内部时间。例如，如果对间隔2012-01-01/2012-01-04发出"Day"粒度时间序列查询，并且2012-01-02不存在数据，则将收到：

```json
[
  {
    "timestamp": "2012-01-01T00:00:00.000Z",
    "result": { "sample_name1": <some_value> }
  },
  {
   "timestamp": "2012-01-02T00:00:00.000Z",
   "result": { "sample_name1": 0 }
  },
  {
    "timestamp": "2012-01-03T00:00:00.000Z",
    "result": { "sample_name1": <some_value> }
  }
]
```

完全位于数据间隔之外的时间不是零填充的。

可以使用上下文标志"skipEmptyBuckets"禁用所有零填充。在此模式下，将从结果中省略2012-01-02的数据点。

设置了此上下文标志的查询如下所示：

```json
{
  "queryType": "timeseries",
  "dataSource": "sample_datasource",
  "granularity": "day",
  "aggregations": [
    { "type": "longSum", "name": "sample_name1", "fieldName": "sample_fieldName1" }
  ],
  "intervals": [ "2012-01-01T00:00:00.000/2012-01-04T00:00:00.000" ],
  "context" : {
    "skipEmptyBuckets": "true"
  }
}
```