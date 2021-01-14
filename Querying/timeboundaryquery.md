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

## TimeBoundary查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了仅仅在原生查询中的一种查询方式。

时间边界查询返回数据集的最早和最新数据点。语法是：

```json
{
    "queryType" : "timeBoundary",
    "dataSource": "sample_datasource",
    "bound"     : < "maxTime" | "minTime" > # optional, defaults to returning both timestamps if not set
    "filter"    : { "type": "and", "fields": [<filter>, <filter>, ...] } # optional
}
```

时间边界查询有3个主要部分：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `queryType` | 该字符串始终为"search", Druid根据该字段来确定如何执行该查询 | 是 |
| `dataSource` | 要查询的数据源， 类似于关系型数据库的表。 可以通过 [数据源](datasource.md) 来查看更多信息| 是 |
| `bound` | 可选，设置为 `maxTime` 或 `minTime` 仅返回最新或最早的时间戳。如果未设置，则默认为返回两者 | 否 |
| `filter` | 参考 [Filters](filters.md) | 否 |
| `context` | 参见 [查询上下文](query-context.md) | 否 |

结果的格式为：

```json
[ {
  "timestamp" : "2013-05-09T18:24:00.000Z",
  "result" : {
    "minTime" : "2013-05-09T18:24:00.000Z",
    "maxTime" : "2013-05-09T18:37:00.000Z"
  }
} ]
```