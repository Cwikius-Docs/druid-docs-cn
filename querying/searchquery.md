<!-- toc -->

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

## Search查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了仅仅在原生查询中的一种查询方式。

搜索查询返回与搜索规范匹配的维度值。

```json
{
  "queryType": "search",
  "dataSource": "sample_datasource",
  "granularity": "day",
  "searchDimensions": [
    "dim1",
    "dim2"
  ],
  "query": {
    "type": "insensitive_contains",
    "value": "Ke"
  },
  "sort" : {
    "type": "lexicographic"
  },
  "intervals": [
    "2013-01-01T00:00:00.000/2013-01-03T00:00:00.000"
  ]
}
```

对于一个搜索查询，有以下几个主要部分：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `queryType` | 该字符串始终为"search", Druid根据该字段来确定如何执行该查询 | 是 |
| `dataSource` | 要查询的数据源， 类似于关系型数据库的表。 可以通过 [数据源](datasource.md) 来查看更多信息| 是 |
| `granularity` | 定义查询粒度，参见 [Granularities](granularity.md) | 是 |
| `filter` | 参考 [Filters](filters.md) | 否 |
| `limit` | 定义搜索结果的每个Historical进程返回最大多少行。 | 否（默认为1000） |
| `intervals` | 表示ISO-8601间隔的JSON对象。这定义了运行查询的时间范围。| 是 |
| `searchDimensions` | 运行搜索的维度列，没有设置该字段则意味着在所有的列中搜索 | 否 |
| `query` | 参见 [Search查询说明](#Search查询说明) | 否 |
| `sort` | 标识搜索结果集如何排序的对象， 可能的类型有 `lexicographic` , `alphanumeric` , `strlen` , `numeric`。 详情参见 [字符串比较](sorting-orders.md)部分 | 否 |
| `context` | 参见 [查询上下文](#查询上下文) | 否 |

结果格式如下：

```json
[
  {
    "timestamp": "2013-01-01T00:00:00.000Z",
    "result": [
      {
        "dimension": "dim1",
        "value": "Ke$ha",
        "count": 3
      },
      {
        "dimension": "dim2",
        "value": "Ke$haForPresident",
        "count": 1
      }
    ]
  },
  {
    "timestamp": "2013-01-02T00:00:00.000Z",
    "result": [
      {
        "dimension": "dim1",
        "value": "SomethingThatContainsKe",
        "count": 1
      },
      {
        "dimension": "dim2",
        "value": "SomethingElseThatContainsKe",
        "count": 2
      }
    ]
  }
]
```

**搜索查询的详细实现策略**

搜索查询可以使用两种策略来进行执行，默认策略由Broker的运行时配置 `druid.query.search.searchStrategy` 来决定，该值可以被查询上下文中的 `searchStrategy`值覆盖。 如果查询上下文和运行时配置都有指定，默认使用 `useIndexes`策略。

* 默认的"useIndexes"策略首先根据对位图索引的支持将搜索维度分为两组。然后，它分别对支持位图的维组和其他维组应用`index-only`和`cursor-based`的执行计划。`index-only`仅使用索引进行搜索查询处理。对于每个维度，它读取每个维度值的位图索引，计算搜索，最后检查时间间隔和筛选器。对于`cursor-based`的执行计划，请参考"cursorOnly"策略。对于基数较大(大多数搜索维度的值都是唯一的)的搜索维度, `index-only`的性能较低。
* "cursorOnly"策略生成一个基于cursor的执行计划。这个计划创建一个游标，从**QueryableIndexSegment**中读取一行，然后计算搜索。如果某些过滤器支持位图索引，则光标只能读取满足这些过滤器的行，从而节省I/O成本。然而，对于低选择性的过滤器，它可能是缓慢的。
* "auto"策略使用基于成本的计划来选择最佳搜索策略。它估计了基于索引和游标的执行计划的成本，并选择了最优的执行计划。目前，由于成本估算的开销，默认情况下不启用。

### 服务端配置

下列属性将在运行时生效：

| 属性 | 描述 | 是否必须 |
|-|-|-|
|  `druid.query.search.searchStrategy` | 默认的搜索查询策略 | `useIndexes` |

### 查询上下文

下列属性将在查询时生效：

| 属性 | 描述 |
|-|-|
| `searchStrategy` | 覆盖本次查询中 `druid.query.search.searchStrategy` 的值 |

### Search查询说明

**`insensitive_contains`**

如果维度值的任何部分包含此搜索查询规范中指定的值（无论大小写），则会出现"匹配"。语法是：

```json
{
  "type"  : "insensitive_contains",
  "value" : "some_value"
}
```

**`fragment`**

如果维度值的任何部分包含此搜索查询规范中指定的所有值（默认情况下不区分大小写），则会出现"匹配"。语法是：

```json
{
  "type" : "fragment",
  "case_sensitive" : false,
  "values" : ["fragment1", "fragment2"]
}
```


**`contains`**

如果维度值的任何部分包含此搜索查询规范中指定的值，则会出现“匹配”。语法是：

```json
{
  "type"  : "contains",
  "case_sensitive" : true,
  "value" : "some_value"
}
```

**`regex`**

如果维度值的任何部分包含此搜索查询规范中指定的模式，则会出现"匹配"。语法是：

```json
{
  "type"  : "regex",
  "pattern" : "some_pattern"
}
```
