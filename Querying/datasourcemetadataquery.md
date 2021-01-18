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

## DatasourceMetaData查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了仅仅在原生查询中的一种查询方式。

数据源元信息查询返回一个数据源的元数据信息。这些查询返回如下信息：
* 数据源的最新摄取事件的时间戳。这是不考虑Rollup的摄取事件。

这些查询的语法为：

```json
{
    "queryType" : "dataSourceMetadata",
    "dataSource": "sample_datasource"
}
```

对于一个数据源元数据查询主要有以下几个主要部分：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `queryType` | 该字符串始终为"dataSourceMetadata", Druid根据该字段来确定如何执行该查询 | 是 |
| `dataSource` | 要查询的数据源， 类似于关系型数据库的表。 可以通过 [数据源](datasource.md) 来查看更多信息| 是 |
| `context` | 详情参见 [Context](query-context.md) | 否 |

结果的格式为：

```json
[ {
  "timestamp" : "2013-05-09T18:24:00.000Z",
  "result" : {
    "maxIngestedEventTime" : "2013-05-09T18:24:09.007Z"
  }
} ]
```