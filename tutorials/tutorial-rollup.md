# Roll-up

Apache Druid 可以在数据摄取阶段对原始数据进行汇总，这个过程我们称为 "roll-up"。 
Roll-up 是第一级对选定列集的一级聚合操作，通过这个操作我们能够减少存储数据的大小。

本教程中将讨论在一个示例数据集上进行 roll-up 的示例。

假设你已经完成了 [快速开始](../tutorials/index.md) 页面中的内容或者下面页面中有关的内容，并且你的 Druid 实例已经在你的本地的计算机上运行了。


同时，如果你已经完成了下面内容的阅读的话将会更好的帮助你理解 Roll-up 的相关内容

* [教程：载入一个文件](../tutorials/tutorial-batch.md)
* [教程：查询数据](../tutorials/tutorial-query.md)

## 示例数据

针对对于本教程，我们将使用一个网络事件流数据的小样本。如下面表格中使用的数据，这个数据是在特定时间内从源到目标 IP 地址的流量的数据包和字节的事件。

```json
{"timestamp":"2018-01-01T01:01:35Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":20,"bytes":9024}
{"timestamp":"2018-01-01T01:01:51Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":255,"bytes":21133}
{"timestamp":"2018-01-01T01:01:59Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":11,"bytes":5780}
{"timestamp":"2018-01-01T01:02:14Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":38,"bytes":6289}
{"timestamp":"2018-01-01T01:02:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":377,"bytes":359971}
{"timestamp":"2018-01-01T01:03:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":49,"bytes":10204}
{"timestamp":"2018-01-02T21:33:14Z","srcIP":"7.7.7.7", "dstIP":"8.8.8.8","packets":38,"bytes":6289}
{"timestamp":"2018-01-02T21:33:45Z","srcIP":"7.7.7.7", "dstIP":"8.8.8.8","packets":123,"bytes":93999}
{"timestamp":"2018-01-02T21:35:45Z","srcIP":"7.7.7.7", "dstIP":"8.8.8.8","packets":12,"bytes":2818}
```

包含有这个样本数据的 JSON 文件位于 `quickstart/tutorial/rollup-data.json`。

我们将使用下面描述的数据导入任务描述规范，将上面的 JSON 数据导入到 Druid 中，有关这个任务描述配置位于 `quickstart/tutorial/rollup-index.json` 中。

```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "rollup-tutorial",
      "dimensionsSpec" : {
        "dimensions" : [
          "srcIP",
          "dstIP"
        ]
      },
      "timestampSpec": {
        "column": "timestamp",
        "format": "iso"
      },
      "metricsSpec" : [
        { "type" : "count", "name" : "count" },
        { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
        { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "week",
        "queryGranularity" : "minute",
        "intervals" : ["2018-01-01/2018-01-03"],
        "rollup" : true
      }
    },
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/tutorial",
        "filter" : "rollup-data.json"
      },
      "inputFormat" : {
        "type" : "json"
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

通过在 `granularitySpec` 选项中设置 `rollup : true` 来启用 Roll-up。

请注意，我们将 `srcIP` 和 `dstIP` 定义为 **维度（dimensions）**，将 `packets` 和 `bytes` 列定义为了 longSum 类型的**指标（metric）**，并将 `queryGranularity` 配置定义为 `minute`。

在加载这些数据后，我们将看到如何使用这些定义。

## Load the example data

From the apache-druid-apache-druid-0.21.1 package root, run the following command:

```bash
bin/post-index-task --file quickstart/tutorial/rollup-index.json --url http://localhost:8081
```

After the script completes, we will query the data.

## Query the example data

Let's run `bin/dsql` and issue a `select * from "rollup-tutorial";` query to see what data was ingested.

```bash
$ bin/dsql
Welcome to dsql, the command-line client for Druid SQL.
Type "\h" for help.
dsql> select * from "rollup-tutorial";
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:01:00.000Z │  35937 │     3 │ 2.2.2.2 │     286 │ 1.1.1.1 │
│ 2018-01-01T01:02:00.000Z │ 366260 │     2 │ 2.2.2.2 │     415 │ 1.1.1.1 │
│ 2018-01-01T01:03:00.000Z │  10204 │     1 │ 2.2.2.2 │      49 │ 1.1.1.1 │
│ 2018-01-02T21:33:00.000Z │ 100288 │     2 │ 8.8.8.8 │     161 │ 7.7.7.7 │
│ 2018-01-02T21:35:00.000Z │   2818 │     1 │ 8.8.8.8 │      12 │ 7.7.7.7 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
Retrieved 5 rows in 1.18s.

dsql>
```

Let's look at the three events in the original input data that occurred during `2018-01-01T01:01`:

```json
{"timestamp":"2018-01-01T01:01:35Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":20,"bytes":9024}
{"timestamp":"2018-01-01T01:01:51Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":255,"bytes":21133}
{"timestamp":"2018-01-01T01:01:59Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":11,"bytes":5780}
```

These three rows have been "rolled up" into the following row:

```bash
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:01:00.000Z │  35937 │     3 │ 2.2.2.2 │     286 │ 1.1.1.1 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
```

The input rows have been grouped by the timestamp and dimension columns `{timestamp, srcIP, dstIP}` with sum aggregations on the metric columns `packets` and `bytes`.

Before the grouping occurs, the timestamps of the original input data are bucketed/floored by minute, due to the `"queryGranularity":"minute"` setting in the ingestion spec.

Likewise, these two events that occurred during `2018-01-01T01:02` have been rolled up:

```json
{"timestamp":"2018-01-01T01:02:14Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":38,"bytes":6289}
{"timestamp":"2018-01-01T01:02:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":377,"bytes":359971}
```

```bash
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:02:00.000Z │ 366260 │     2 │ 2.2.2.2 │     415 │ 1.1.1.1 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
```

For the last event recording traffic between 1.1.1.1 and 2.2.2.2, no roll-up took place, because this was the only event that occurred during `2018-01-01T01:03`:

```json
{"timestamp":"2018-01-01T01:03:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":49,"bytes":10204}
```

```bash
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:03:00.000Z │  10204 │     1 │ 2.2.2.2 │      49 │ 1.1.1.1 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
```

Note that the `count` metric shows how many rows in the original input data contributed to the final "rolled up" row.



### 示例数据





### 加载示例数据

在Druid的根目录下运行以下命令：

```json
bin/post-index-task --file quickstart/tutorial/rollup-index.json --url http://localhost:8081
```

脚本运行完成以后，我们将查询数据。

### 查询示例数据

现在运行 `bin/dsql` 然后执行查询 `select * from "rollup-tutorial";` 来查看已经被摄入的数据。

```json
$ bin/dsql
Welcome to dsql, the command-line client for Druid SQL.
Type "\h" for help.
dsql> select * from "rollup-tutorial";
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:01:00.000Z │  35937 │     3 │ 2.2.2.2 │     286 │ 1.1.1.1 │
│ 2018-01-01T01:02:00.000Z │ 366260 │     2 │ 2.2.2.2 │     415 │ 1.1.1.1 │
│ 2018-01-01T01:03:00.000Z │  10204 │     1 │ 2.2.2.2 │      49 │ 1.1.1.1 │
│ 2018-01-02T21:33:00.000Z │ 100288 │     2 │ 8.8.8.8 │     161 │ 7.7.7.7 │
│ 2018-01-02T21:35:00.000Z │   2818 │     1 │ 8.8.8.8 │      12 │ 7.7.7.7 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
Retrieved 5 rows in 1.18s.

dsql>
```

我们来看发生在 `2018-01-01T01:01` 的三条原始数据：

```json
{"timestamp":"2018-01-01T01:01:35Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":20,"bytes":9024}
{"timestamp":"2018-01-01T01:01:51Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":255,"bytes":21133}
{"timestamp":"2018-01-01T01:01:59Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":11,"bytes":5780}
```
这三条数据已经被roll up为以下一行数据：

```json
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:01:00.000Z │  35937 │     3 │ 2.2.2.2 │     286 │ 1.1.1.1 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
```

这输入的数据行已经被按照时间列和维度列 `{timestamp, srcIP, dstIP}` 在指标列 `{packages, bytes}` 上做求和聚合

在进行分组之前，原始输入数据的时间戳按分钟进行标记/布局，这是由于摄取规范中的 `"queryGranularity"："minute"` 设置造成的。
同样，`2018-01-01T01:02` 期间发生的这两起事件也已经汇总。

```json
{"timestamp":"2018-01-01T01:02:14Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":38,"bytes":6289}
{"timestamp":"2018-01-01T01:02:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":377,"bytes":359971}
```
```json
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:02:00.000Z │ 366260 │     2 │ 2.2.2.2 │     415 │ 1.1.1.1 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
```

对于记录1.1.1.1和2.2.2.2之间流量的最后一个事件没有发生汇总，因为这是 `2018-01-01T01:03` 期间发生的唯一事件

```json
{"timestamp":"2018-01-01T01:03:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2","packets":49,"bytes":10204}
```
```json
┌──────────────────────────┬────────┬───────┬─────────┬─────────┬─────────┐
│ __time                   │ bytes  │ count │ dstIP   │ packets │ srcIP   │
├──────────────────────────┼────────┼───────┼─────────┼─────────┼─────────┤
│ 2018-01-01T01:03:00.000Z │  10204 │     1 │ 2.2.2.2 │      49 │ 1.1.1.1 │
└──────────────────────────┴────────┴───────┴─────────┴─────────┴─────────┘
```

请注意，`计数指标 count` 显示原始输入数据中有多少行贡献给最终的"roll up"行。