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

## Scan查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

Scan查询以流模式返回原始Apache Druid行。

除了向Broker发出扫描查询的简单用法之外，还可以直接向Historical或流式摄取任务发出扫描查询。如果您希望并行地检索大量数据，这将非常有用。

扫描查询对象示例如下所示：

```json
 {
   "queryType": "scan",
   "dataSource": "wikipedia",
   "resultFormat": "list",
   "columns":[],
   "intervals": [
     "2013-01-01/2013-01-02"
   ],
   "batchSize":20480,
   "limit":3
 }
 ```

 以下为Scan查询的主要参数：

 | 属性 | 描述 | 是否必须 |
 |-|-|-|
 | `queryType` | 该字符串始终为"scan", Druid根据该字段来确定如何执行该查询 | 是 |
 | `dataSource` | 要查询的数据源， 类似于关系型数据库的表。 可以通过 [数据源](datasource.md) 来查看更多信息| 是 |
 | `intervals` | 表示ISO-8601间隔的JSON对象。这定义了运行查询的时间范围。| 是 |
 | `resultFormat` | 结果集如何呈现：当前仅支持 `list`和`compactedList`，默认为 `list` | 否 |
 | `filter` | 参考 [Filters](filters.md) | 否 |
 | `columns` | 要扫描的维度和指标的字符串数组。如果留空，则返回所有维度和指标。 | 否 |
 | `batchSize` | 返回到客户端之前缓冲的最大行数。默认值为`20480` | 否 |
 | `limit` | 返回多少行。如果未指定，则返回所有行。 | 否 |
 | `offset` | 返回结果时跳过这么多行。跳过的行仍然需要在内部生成，然后丢弃，这意味着将偏移量提高到较高的值可能会导致查询使用额外的资源。"limit"和"offset"一起可以用来实现分页。但是，请注意，如果在页面获取之间修改基础数据源的方式会影响整个查询结果，那么不同的页面不一定会彼此对齐。 | 否 |
 | `order` | 基于时间戳对返回行的排序。支持升序、降序和无（默认）。目前，"升序"和"降序"仅支持在`columns`字段中包含 `__time` 列并且满足[时间顺序](#时间排序)部分中列出的要求的查询。 | NONE |
 | `legacy` | 返回与旧版scan-query扩展一致的结果。默认为由设置的值`druid.query.scan.legacy`，然后默认为false。有关详细信息，请参见[传统模式](#传统模式)。 | 否 |
 | `context` | 一个附加的JSON对象，可用于指定某些标志（请参阅下面的[查询上下文属性](#查询上下文属性)部分）。 | 否 |

 ### 示例结果

当resultFormat为 `list`时，结果格式如下：

 ```json
  [{
    "segmentId" : "wikipedia_editstream_2012-12-29T00:00:00.000Z_2013-01-10T08:00:00.000Z_2013-01-10T08:13:47.830Z_v9",
    "columns" : [
      "timestamp",
      "robot",
      "namespace",
      "anonymous",
      "unpatrolled",
      "page",
      "language",
      "newpage",
      "user",
      "count",
      "added",
      "delta",
      "variation",
      "deleted"
    ],
    "events" : [ {
        "timestamp" : "2013-01-01T00:00:00.000Z",
        "robot" : "1",
        "namespace" : "article",
        "anonymous" : "0",
        "unpatrolled" : "0",
        "page" : "11._korpus_(NOVJ)",
        "language" : "sl",
        "newpage" : "0",
        "user" : "EmausBot",
        "count" : 1.0,
        "added" : 39.0,
        "delta" : 39.0,
        "variation" : 39.0,
        "deleted" : 0.0
    }, {
        "timestamp" : "2013-01-01T00:00:00.000Z",
        "robot" : "0",
        "namespace" : "article",
        "anonymous" : "0",
        "unpatrolled" : "0",
        "page" : "112_U.S._580",
        "language" : "en",
        "newpage" : "1",
        "user" : "MZMcBride",
        "count" : 1.0,
        "added" : 70.0,
        "delta" : 70.0,
        "variation" : 70.0,
        "deleted" : 0.0
    }, {
        "timestamp" : "2013-01-01T00:00:00.000Z",
        "robot" : "0",
        "namespace" : "article",
        "anonymous" : "0",
        "unpatrolled" : "0",
        "page" : "113_U.S._243",
        "language" : "en",
        "newpage" : "1",
        "user" : "MZMcBride",
        "count" : 1.0,
        "added" : 77.0,
        "delta" : 77.0,
        "variation" : 77.0,
        "deleted" : 0.0
    } ]
} ]
```

当resultFormat为 `compactedList`时，结果格式如下：

```json
 [{
    "segmentId" : "wikipedia_editstream_2012-12-29T00:00:00.000Z_2013-01-10T08:00:00.000Z_2013-01-10T08:13:47.830Z_v9",
    "columns" : [
      "timestamp", "robot", "namespace", "anonymous", "unpatrolled", "page", "language", "newpage", "user", "count", "added", "delta", "variation", "deleted"
    ],
    "events" : [
     ["2013-01-01T00:00:00.000Z", "1", "article", "0", "0", "11._korpus_(NOVJ)", "sl", "0", "EmausBot", 1.0, 39.0, 39.0, 39.0, 0.0],
     ["2013-01-01T00:00:00.000Z", "0", "article", "0", "0", "112_U.S._580", "en", "1", "MZMcBride", 1.0, 70.0, 70.0, 70.0, 0.0],
     ["2013-01-01T00:00:00.000Z", "0", "article", "0", "0", "113_U.S._243", "en", "1", "MZMcBride", 1.0, 77.0, 77.0, 77.0, 0.0]
    ]
} ]
```

### 时间排序
### 传统模式
### 配置属性
### 查询上下文属性