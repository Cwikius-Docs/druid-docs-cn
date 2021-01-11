<!-- toc -->
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
 | `queryType` | | 是 |
 | `dataSource` || 是 |
 | `intervals` || 是 |
 | `resultFormat` || 否 |
 | `filter` || 否 |
 | `columns` || 否 |
 | `batchSize` || 否 |
 | `limit` || 否 |
 | `offset` || 否 |
 | `order` || NONE |
 | `legacy` || 否 |
 | `context` || 否 |

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