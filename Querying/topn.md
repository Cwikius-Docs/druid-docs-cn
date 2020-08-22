<!-- toc -->
## TopN查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

Apache Druid TopN查询根据某些条件返回给定维度中值的排序结果集。从概念上讲，可以将它们看作是一个具有[排序](limitspec.md)的、在单个维度上的近似[GroupByQuery](groupby.md), 在该场景下TopN查询比GroupBy查询更加的效率。 这些类型的查询获取一个topN查询对象并返回一个JSON对象数组，其中每个对象代表topN查询所请求的值。

TopN是近似查询，因为每个数据进程将对其前K个结果进行排序，并且只将那些前K个结果返回给Broker。在Druid中K的默认值是 `max(1000, threshold)`。在实践中，这意味着，如果你要求查询前1000个数据，前900个数据的正确性将为100%，之后的结果排序将无法保证。通过增加阈值可以使TopNs更加精确。

TopN的查询对象如下所示：

```json
{
  "queryType": "topN",
  "dataSource": "sample_data",
  "dimension": "sample_dim",
  "threshold": 5,
  "metric": "count",
  "granularity": "all",
  "filter": {
    "type": "and",
    "fields": [
      {
        "type": "selector",
        "dimension": "dim1",
        "value": "some_value"
      },
      {
        "type": "selector",
        "dimension": "dim2",
        "value": "some_other_val"
      }
    ]
  },
  "aggregations": [
    {
      "type": "longSum",
      "name": "count",
      "fieldName": "count"
    },
    {
      "type": "doubleSum",
      "name": "some_metric",
      "fieldName": "some_metric"
    }
  ],
  "postAggregations": [
    {
      "type": "arithmetic",
      "name": "average",
      "fn": "/",
      "fields": [
        {
          "type": "fieldAccess",
          "name": "some_metric",
          "fieldName": "some_metric"
        },
        {
          "type": "fieldAccess",
          "name": "count",
          "fieldName": "count"
        }
      ]
    }
  ],
  "intervals": [
    "2013-08-31T00:00:00.000/2013-09-03T00:00:00.000"
  ]
}
```

对于TopN查询，有11个部分，如下：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| queryType | 该字符串总是"TopN"，Druid根据该值来确定如何解析查询 | 是 |
| dataSource | 定义将要查询的字符串或者对象，与关系型数据库中的表类似。 详情可以查看 [数据源](datasource.md) 部分。 | 是 |
| intervals | ISO-8601格式的时间间隔，定义了查询的时间范围 | 是 |
| granularity | 定义查询粒度， 参见 [Granularities](granularity.md) | 是 |
| filter | 参见 [Filters](filters.md) | 否 |
| aggregations | 参见[Aggregations](Aggregations.md) | 对于数值类型的metricSpec， aggregations或者postAggregations必须指定，否则非必须 |

