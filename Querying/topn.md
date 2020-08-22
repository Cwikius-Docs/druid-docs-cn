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
| postAggregations | 参见[postAggregations](postaggregation.md) | 对于数值类型的metricSpec， aggregations或者postAggregations必须指定，否则非必须 |
| dimension | 一个string或者json对象，用来定义topN查询的维度列，详情参见[DimensionSpec](dimensionspec.md) | 是 |
| threshold | 在topN中定义N的一个整型数字，例如：在top列表中返回多少个结果 | 是 |
| metric | 一个string或者json对象，用来指定top列表的排序。更多信息可以参见[TopNMetricSpec](topnsorting.md) | 是 |
| context | 参见[Context](query-context.md) | 否 |

请注意，context JSON对象也可用于topN查询，应该像timeseries一样谨慎使用。结果的格式如下：

```json
[
  {
    "timestamp": "2013-08-31T00:00:00.000Z",
    "result": [
      {
        "dim1": "dim1_val",
        "count": 111,
        "some_metrics": 10669,
        "average": 96.11711711711712
      },
      {
        "dim1": "another_dim1_val",
        "count": 88,
        "some_metrics": 28344,
        "average": 322.09090909090907
      },
      {
        "dim1": "dim1_val3",
        "count": 70,
        "some_metrics": 871,
        "average": 12.442857142857143
      },
      {
        "dim1": "dim1_val4",
        "count": 62,
        "some_metrics": 815,
        "average": 13.14516129032258
      },
      {
        "dim1": "dim1_val5",
        "count": 60,
        "some_metrics": 2787,
        "average": 46.45
      }
    ]
  }
]
```

### 多值维度上的TopN

topN查询可以按多值维度分组。在多值维度上分组时，来自匹配行的所有值将为每个值生成一个组。查询返回的组可能多于行数。例如，在维度`tags`上带有过滤器`"t1" AND "t3"`的topN将只匹配row1，并生成包含三个组的结果：`t1`、`t2`和`t3`。如果只需要包含与过滤器匹配的值，则可以使用 [filtered dimensionSpec](dimensionspec.md), 这也可以提高性能。

更过详细信息还可以参见[多值维度](multi-value-dimensions.md)

### 混淆之处

目前的TopN算法是一种近似算法，返回每个段的前1000个局部结果以进行合并，以确定全局topN。因此，topN算法在秩和结果上都是近似的。近似结果*仅适用于维度值超过1000的情况*， 唯一维度值小于1000的维度上的topN在秩和聚合上都可以被认为是精确的。

阈值可以通过服务参数`druid.query.topN.minTopNThreshold`从默认值1000修改，它需要重新启动服务才能生效，或者在查询上下文中设置`minTopNThreshold`，该查询上下文对每个查询生效。

如果您想要一个高基数、均匀分布维度的前100个维度按某个低基数、均匀分布的维度排序，那么您可能会得到丢失数据的聚合。

换言之，topN的最佳用例是当您能够确信总体结果一致地位于顶层时。例如，如果某个特定站点的ID在某个指标中每天每小时都在前10位，那么它可能会在多天内精确到topN。但是，如果一个站点在任何给定的小时内几乎不在前1000名之内，但在整个查询粒度上却在前500名（例如：一个站点在数据集中获得高度一致的流量，并且站点具有高度周期性的数据），则top500查询可能没有该特定站点的确切排名，对于那个特定站点的聚合可能并不准确。

在继续本节之前，请考虑是否确实需要确切的结果。获得准确的结果是一个非常耗费资源的过程。对于绝大多数"有用"的数据结果，近似topN算法提供了足够的精度。

如果用户希望在一个维度上获得精确的排名和精确的topN聚合，那么应该发出groupBy查询并自行对结果进行排序。对于高基数维，这在计算上非常昂贵。

如果用户能够容忍超过1000个唯一值的维度上的近似秩topN，但需要精确的聚合，则可以发出两个查询。一个用于获取近似的topN维度值，另一个具有维度选择过滤器的topN只使用第一个的topN结果。

#### 首次查询的示例

```json
{
    "aggregations": [
         {
             "fieldName": "L_QUANTITY_longSum",
             "name": "L_QUANTITY_",
             "type": "longSum"
         }
    ],
    "dataSource": "tpch_year",
    "dimension":"l_orderkey",
    "granularity": "all",
    "intervals": [
        "1900-01-09T00:00:00.000Z/2992-01-10T00:00:00.000Z"
    ],
    "metric": "L_QUANTITY_",
    "queryType": "topN",
    "threshold": 2
}
```

#### 第二次查询的示例

```json
{
    "aggregations": [
         {
             "fieldName": "L_TAX_doubleSum",
             "name": "L_TAX_",
             "type": "doubleSum"
         },
         {
             "fieldName": "L_DISCOUNT_doubleSum",
             "name": "L_DISCOUNT_",
             "type": "doubleSum"
         },
         {
             "fieldName": "L_EXTENDEDPRICE_doubleSum",
             "name": "L_EXTENDEDPRICE_",
             "type": "doubleSum"
         },
         {
             "fieldName": "L_QUANTITY_longSum",
             "name": "L_QUANTITY_",
             "type": "longSum"
         },
         {
             "name": "count",
             "type": "count"
         }
    ],
    "dataSource": "tpch_year",
    "dimension":"l_orderkey",
    "filter": {
        "fields": [
            {
                "dimension": "l_orderkey",
                "type": "selector",
                "value": "103136"
            },
            {
                "dimension": "l_orderkey",
                "type": "selector",
                "value": "1648672"
            }
        ],
        "type": "or"
    },
    "granularity": "all",
    "intervals": [
        "1900-01-09T00:00:00.000Z/2992-01-10T00:00:00.000Z"
    ],
    "metric": "L_QUANTITY_",
    "queryType": "topN",
    "threshold": 2
}
```