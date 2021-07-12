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

## 输入数据变换

本教程将演示如何使用转换规范在接收期间过滤和转换输入数据

本教程我们假设您已经按照[单服务器部署](../GettingStarted/chapter-3.md)中描述下载了Druid，并运行在本地机器上。

完成[加载本地文件](tutorial-batch.md)、[数据查询](./chapter-4.md)和[roll-up](./chapter-5.md)部分内容也是非常有帮助的

### 样例数据

我们在 `quickstart/tutorial/transform-data.json` 中包括了样例数据，为了方便我们展示一下：

```json
{"timestamp":"2018-01-01T07:01:35Z","animal":"octopus",  "location":1, "number":100}
{"timestamp":"2018-01-01T05:01:35Z","animal":"mongoose", "location":2,"number":200}
{"timestamp":"2018-01-01T06:01:35Z","animal":"snake", "location":3, "number":300}
{"timestamp":"2018-01-01T01:01:35Z","animal":"lion", "location":4, "number":300}
```

### 使用转换规范加载数据
我们将使用以下规范摄取示例数据，该规范演示了转换规范的使用：
```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "transform-tutorial",
      "timestampSpec": {
        "column": "timestamp",
        "format": "iso"
      },
      "dimensionsSpec" : {
        "dimensions" : [
          "animal",
          { "name": "location", "type": "long" }
        ]
      },
      "metricsSpec" : [
        { "type" : "count", "name" : "count" },
        { "type" : "longSum", "name" : "number", "fieldName" : "number" },
        { "type" : "longSum", "name" : "triple-number", "fieldName" : "triple-number" }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "week",
        "queryGranularity" : "minute",
        "intervals" : ["2018-01-01/2018-01-03"],
        "rollup" : true
      },
      "transformSpec": {
        "transforms": [
          {
            "type": "expression",
            "name": "animal",
            "expression": "concat('super-', animal)"
          },
          {
            "type": "expression",
            "name": "triple-number",
            "expression": "number * 3"
          }
        ],
        "filter": {
          "type":"or",
          "fields": [
            { "type": "selector", "dimension": "animal", "value": "super-mongoose" },
            { "type": "selector", "dimension": "triple-number", "value": "300" },
            { "type": "selector", "dimension": "location", "value": "3" }
          ]
        }
      }
    },
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/tutorial",
        "filter" : "transform-data.json"
      },
      "inputFormat" : {
        "type" :"json"
      },
      "appendToExisting" : false
    },
    "tuningConfig" : {
      "type" : "index_parallel",
      "maxRowsPerSegment" : 5000000,
      "maxRowsInMemory" : 25000
    }
  }
}
```
在转换规范中，我们有两个表达式转换：
* `super-animal`: 在 `"animal"` 列的值前加上"super-"。这将用转换后的版本覆盖 `animal` 列，因为转换的名称是 `animal`
* `triple-number`: 将数字列乘以3, 这将创建一个新的三位数列。注意，我们同时接收原始列和转换列

另外，我们有一个包含三个子句的OR过滤器：
* `super-animal` 值匹配"super-mongoose"
* `triple-number` 值匹配300
* `location`值匹配3

这个过滤器选择前3行，它将排除输入数据中的最后一个"lion"行。请注意，过滤器是在转换之后应用的。

现在提交位于 `quickstart/tutorial/transform-index.json` 的任务：
```json
bin/post-index-task --file quickstart/tutorial/transform-index.json --url http://localhost:8081
```

### 查询已转换的数据

运行 `bin/dsql` 提交 `select * from "transform-tutorial"` 查询来看摄入的数据：
```json
dsql> select * from "transform-tutorial";
┌──────────────────────────┬────────────────┬───────┬──────────┬────────┬───────────────┐
│ __time                   │ animal         │ count │ location │ number │ triple-number │
├──────────────────────────┼────────────────┼───────┼──────────┼────────┼───────────────┤
│ 2018-01-01T05:01:00.000Z │ super-mongoose │     1 │        2 │    200 │           600 │
│ 2018-01-01T06:01:00.000Z │ super-snake    │     1 │        3 │    300 │           900 │
│ 2018-01-01T07:01:00.000Z │ super-octopus  │     1 │        1 │    100 │           300 │
└──────────────────────────┴────────────────┴───────┴──────────┴────────┴───────────────┘
Retrieved 3 rows in 0.03s.
```

"Lion"列被丢弃，`animal`列被转换，我们既有原始列，也有转换后的数字列。