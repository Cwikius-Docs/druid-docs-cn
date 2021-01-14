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

对于非传统模式，Scan查询当前是支持基于时间戳的排序。请注意，使用时间戳进行排序将产生并不标识来源于哪个段中的行的结果(`segmentId`将展示为`null`)。 此外，仅当结果集限制小于`druid.query.scan.maxRowsQueuedForOrdering`行或者所有被扫描的段小于`druid.query.scan.maxSegmentPartitionsOrderedInMemory`时，才支持时间排序。 另外，除非指定了段列表，否则直接向Historical发出的查询不支持时间排序。这些限制背后的原因是，时间排序的实现使用了两种策略，如果不受限制，这两种策略可能会消耗太多堆内存。这些策略（如下所列）是根据查询结果集限制和扫描的段数在每个Historical进行选择的。

1. 优先级队列：按顺序打开Historical上的每个段。每一行都被添加到一个按时间戳排序的有界优先级队列中。对于超过结果集限制的每一行，时间戳最早（如果降序）或最晚（如果升序）的行将被取消排队。在处理完每一行之后，优先级队列的排序内容将以批处理的方式流回Broker。试图将太多的行加载到内存中会有Historical内存不足的风险。这个`druid.query.scan.maxRowsQueuedForOrdering`属性通过在使用时间排序时限制查询结果集中的行数来防止此问题。
2. N路合并：对于每个段，并行打开每个分区。由于每个分区的行已经按时间顺序排列，因此可以对每个分区的结果执行n路合并。这种方法不会将整个结果集持久化到内存中（像优先级队列那样），因为它会在批处理从merge函数返回时将它们流式返回。但是，由于需要为每个分区打开解压缩和解码缓冲区，尝试查询太多分区也可能导致内存使用率高。这个`druid.query.scan.maxSegmentPartitionsOrderedInMemory`通过在使用时间排序的任何时候限制打开的分区数来防止出现这种情况。

无论是 `druid.query.scan.maxRowsQueuedForOrdering` 还是 `druid.query.scan.maxSegmentPartitionsOrderedInMemory`，都可以根据硬件规格和查询的维度数量来进行优化调整，这些属性也可以在查询上下文中通过 `maxRowsQueuedForOrdering` 和 `maxSegmentPartitionsOrderedInMemory` 进行覆盖，可以查看 [查询上下文属性](#查询上下文属性) 部分来查看。

### 传统模式

Scan查询支持一个传统模式，该模式是为与以前的Scan查询contrib扩展的协议兼容性而设计的。在传统模式下，您可以预期以下行为更改：

* `__time` 列返回为 `timestamp` 而不是 `__time`。 它将优先于任何其他名称为 `timestamp` 的列
* `__time` 列包含在列的列表中，即使没有特别的指定
* 时间戳以ISO8601时间字符串而不是整数的形式返回（自1970-01-01 00:00:00 UTC以来的毫秒）。

传统模式可以通过两种方式来进行触发： 在查询的JSON中传入 `"legacy":true` ，在Druid进程中设置 `druid.query.scan.legacy = true` 配置。 如果以前使用的是scan查询contrib扩展，迁移的最佳方法是在滚动升级期间激活传统模式，然后在升级完成后将其关闭。

### 配置属性

| 属性 | 描述 | 值 | 默认值 |
|-|-|-|-|
| `druid.query.scan.maxRowsQueuedForOrdering` | 当使用时间排序时，返回的最大行数 | 1到2147483647之间的一个整数 | 100000 |
| `druid.query.scan.maxSegmentPartitionsOrderedInMemory` | 当使用时间排序时， 每个Historical上被扫描的最大的段数 | 1到2147483647之间的一个整数 | 50 |
| `druid.query.scan.legacy` | 在scan查询中是否打开传统模式 | true或者false | false |

### 查询上下文属性

| 属性 | 描述 | 值 | 默认值 |
|-|-|-|-|
| `maxRowsQueuedForOrdering` | 当使用时间排序时，返回的最大行数, 覆盖同名配置 | 1到2147483647之间的一个整数 | `druid.query.scan.maxRowsQueuedForOrdering` |
| `maxSegmentPartitionsOrderedInMemory` | 当使用时间排序时， 每个Historical上被扫描的最大的段数 | 1到2147483647之间的一个整数 | `druid.query.scan.maxSegmentPartitionsOrderedInMemory` |

示例查询上下文的JSON对象：

```json
{
  "maxRowsQueuedForOrdering": 100001,
  "maxSegmentPartitionsOrderedInMemory": 100
}
```