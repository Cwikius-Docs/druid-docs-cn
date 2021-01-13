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

## 编写一个摄取规范

本教程将指导读者定义摄取规范的过程，指出关键的注意事项和指导原则

本教程我们假设您已经按照[单服务器部署](../GettingStarted/chapter-3.md)中描述下载了Druid，并运行在本地机器上。

完成[加载本地文件](./chapter-1.md)、[数据查询](./chapter-4.md)和[roll-up](./chapter-5.md)部分内容也是非常有帮助的

### 示例数据

假设我们有如下的网络流数据：
* `srcIP`: 发送端的IP地址
* `srcPort`: 发送端的端口
* `dstIP`: 接收端的IP地址
* `dstPort`: 接收端的端口
* `protocol`: IP协议号码
* `packets`: 传输的数据包数
* `bytes`: 传输的字节数
* `cost`: 发送流量的成本

```json
{"ts":"2018-01-01T01:01:35Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":2000, "dstPort":3000, "protocol": 6, "packets":10, "bytes":1000, "cost": 1.4}
{"ts":"2018-01-01T01:01:51Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":2000, "dstPort":3000, "protocol": 6, "packets":20, "bytes":2000, "cost": 3.1}
{"ts":"2018-01-01T01:01:59Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":2000, "dstPort":3000, "protocol": 6, "packets":30, "bytes":3000, "cost": 0.4}
{"ts":"2018-01-01T01:02:14Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":5000, "dstPort":7000, "protocol": 6, "packets":40, "bytes":4000, "cost": 7.9}
{"ts":"2018-01-01T01:02:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":5000, "dstPort":7000, "protocol": 6, "packets":50, "bytes":5000, "cost": 10.2}
{"ts":"2018-01-01T01:03:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":5000, "dstPort":7000, "protocol": 6, "packets":60, "bytes":6000, "cost": 4.3}
{"ts":"2018-01-01T02:33:14Z","srcIP":"7.7.7.7", "dstIP":"8.8.8.8", "srcPort":4000, "dstPort":5000, "protocol": 17, "packets":100, "bytes":10000, "cost": 22.4}
{"ts":"2018-01-01T02:33:45Z","srcIP":"7.7.7.7", "dstIP":"8.8.8.8", "srcPort":4000, "dstPort":5000, "protocol": 17, "packets":200, "bytes":20000, "cost": 34.5}
{"ts":"2018-01-01T02:35:45Z","srcIP":"7.7.7.7", "dstIP":"8.8.8.8", "srcPort":4000, "dstPort":5000, "protocol": 17, "packets":300, "bytes":30000, "cost": 46.3}
```

将上面的JSON内容保存到 `quickstart/` 中名为`insertion-tutorial-data.json` 的文件中。

让我们来了解一下定义可加载此数据的摄取规范的过程。

对于本教程，我们将使用本地批索引任务。使用其他任务类型时，摄取规范的某些方面会有所不同，本教程将指出这些方面。

### 定义schema

Druid摄取规范中最核心的元素是 `dataSchema`。 `dataSchema` 定义了如何将输入数据解析为一组列，这些列将存储在Druid中。

让我们从一个空的 `dataSchema` 开始，并在完成教程的过程中向它添加字段。

在 `quickstart/` 中创建一个名为 `insertion-tutorial-index.json` 的新文件，其中包含以下内容：

```json
"dataSchema" : {}
```

随着教程的深入，我们将对这个摄取规范进行连续的编辑。

#### 数据源名称

数据源的名称通过 `dataSource` 字段来在 `dataSchema` 中被指定：
```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
}
```

我们将该教程数据源命名为 `ingestion-tutorial`

#### 时间列

`dataSchema` 需要知道如何从输入数据中提取主时间戳字段。

输入数据中的timestamp列名为"ts"，包含ISO 8601时间戳，因此让我们将包含该信息的 `timestampSpec` 添加到 `dataSchema`：
```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  }
}
```

#### 列类型

现在我们已经定义了时间列，让我们看看其他列的定义。

Druid支持以下列类型：String、Long、Float和Double。我们将在下面的部分中了解如何使用它们。

在讨论如何定义其他非时间列之前，我们先讨论一下 `rollup`。

#### Rollup

在接收数据时，我们必须考虑是否要使用rollup

* 如果启用了rollup，我们需要将输入列分为两类，"dimensions"和"metrics"。"dimensions" 是用于rollup的分组列，"metrics"是将要聚合的列。
* 如果禁用了rollup，则所有列都被视为"dimensions"，并且不会发生预聚合。
  
对于本教程，让我们启用rollup。这是用 `dataSchema` 上`granularitySpec` 指定的。

```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  },
  "granularitySpec" : {
    "rollup" : true
  }
}
```

**选择dimension和Metrics**

对于这个示例数据集，以下是对"dimensions"和"metrics"的合理划分：
* Dimensions: srcIP, srcPort, dstIP, dstPort, protocol
* Metrics: packets, bytes, cost

这里的维度是一组属性，用于标识IP流量的单向流，而度量则表示由维度分组指定的IP流量的事实。

让我们看看如何在摄取规范中定义这些维度和度量。

**Dimensions**

在 `dataSchema` 中使用 `dimensionSpec` 指定维度。

```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  },
  "dimensionsSpec" : {
    "dimensions": [
      "srcIP",
      { "name" : "srcPort", "type" : "long" },
      { "name" : "dstIP", "type" : "string" },
      { "name" : "dstPort", "type" : "long" },
      { "name" : "protocol", "type" : "string" }
    ]
  },
  "granularitySpec" : {
    "rollup" : true
  }
}
```

每个维度都有一个 `名称` 和一个 `类型`，其中 `类型` 可以是"long"、"float"、"double"或"string"。

注意，`srcIP` 是一个"string"维度；对于string维度，只需指定一个维度名称就足够了，因为"string"是默认的维度类型。

还要注意，`protocol` 是输入数据中的一个数值，但我们将其作为"string"列摄取；Druid将在摄取期间将输入long强制为string。

**Strings vs. Numerics**

数字输入应该作为数字维度还是字符串维度接收？

相对于字符串维度，数字维度有以下优点/缺点：

* 优点：数值表示可以减少磁盘上的列大小，并在从列中读取值时降低处理开销
* 缺点：数字维度没有索引，因此对其进行筛选通常比对等效字符串维度（具有位图索引）进行筛选慢

**Metrics**

在 `dataSchema` 中使用 `metricsSpec` 来指定metrics

```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  },
  "dimensionsSpec" : {
    "dimensions": [
      "srcIP",
      { "name" : "srcPort", "type" : "long" },
      { "name" : "dstIP", "type" : "string" },
      { "name" : "dstPort", "type" : "long" },
      { "name" : "protocol", "type" : "string" }
    ]
  },
  "metricsSpec" : [
    { "type" : "count", "name" : "count" },
    { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
    { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
    { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
  ],
  "granularitySpec" : {
    "rollup" : true
  }
}
```
定义Metrics时，需要指定在rollup期间对该列执行何种类型的聚合

在这里，我们在两个Long类型的Metrics列（`数据包`和`字节`）上定义了longSum聚合，并为`cost`列定义了一个doubleSum聚合

注意，`metricsSpec` 与 `dimensionSpec` 或 `parseSpec` 位于不同的嵌套级别；它与 `dataSchema` 中的 `parser` 属于相同的嵌套级别

注意，我们还定义了一个 `count` 聚合器。计数聚合器将跟踪原始输入数据中有多少行贡献给最终接收数据中的"roll up"行。

#### No Rollup

如果我们没使用rollup，所有的列都将在 `dimensionsSpec` 中指定：
```json
      "dimensionsSpec" : {
        "dimensions": [
          "srcIP",
          { "name" : "srcPort", "type" : "long" },
          { "name" : "dstIP", "type" : "string" },
          { "name" : "dstPort", "type" : "long" },
          { "name" : "protocol", "type" : "string" },
          { "name" : "packets", "type" : "long" },
          { "name" : "bytes", "type" : "long" },
          { "name" : "srcPort", "type" : "double" }
        ]
      },
```

#### 定义粒度

在这一点上，我们已经在 `dataSchema` 中定义了 `parser` 和`metricsSpec`，并且我们几乎已经完成了摄取规范的编写

我们需要在 `granularitySpec` 中设置一些属性：
* `granularitySpec`类型：`uniform` 和 `arbitrary` 是两种支持的类型。在本教程中，我们将使用 `uniform` 粒度规范，其中所有段都具有统一的间隔（例如：所有段都包含一小时的数据）
* 段粒度：单个段中包含的数据的时间间隔大小？例如：`DAY`, `WEEK`
* 时间列中时间戳的bucketing粒度（称为queryGranularity)

**段粒度**

段粒度由 `granularitySpec` 中的 `SegmentGranularity` 属性配置。对于本教程，我们将创建小时段：
```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  },
  "dimensionsSpec" : {
    "dimensions": [
      "srcIP",
      { "name" : "srcPort", "type" : "long" },
      { "name" : "dstIP", "type" : "string" },
      { "name" : "dstPort", "type" : "long" },
      { "name" : "protocol", "type" : "string" }
    ]
  },
  "metricsSpec" : [
    { "type" : "count", "name" : "count" },
    { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
    { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
    { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
  ],
  "granularitySpec" : {
    "type" : "uniform",
    "segmentGranularity" : "HOUR",
    "rollup" : true
  }
}
```
我们的输入数据有两个独立小时的事件，因此此任务将生成两个段。

**查询粒度**
查询粒度由 `granularitySpec` 中的 `queryGranularity` 属性配置。对于本教程，我们使用分钟粒度：
```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  },
  "dimensionsSpec" : {
    "dimensions": [
      "srcIP",
      { "name" : "srcPort", "type" : "long" },
      { "name" : "dstIP", "type" : "string" },
      { "name" : "dstPort", "type" : "long" },
      { "name" : "protocol", "type" : "string" }
    ]
  },
  "metricsSpec" : [
    { "type" : "count", "name" : "count" },
    { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
    { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
    { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
  ],
  "granularitySpec" : {
    "type" : "uniform",
    "segmentGranularity" : "HOUR",
    "queryGranularity" : "MINUTE",
    "rollup" : true
  }
}
```
要查看查询粒度的影响，让我们从原始输入数据中查看这一行
```json
{"ts":"2018-01-01T01:03:29Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":5000, "dstPort":7000, "protocol": 6, "packets":60, "bytes":6000, "cost": 4.3}
```
当这一行以分钟查询粒度摄取时，Druid会将该行的时间戳设置为分钟桶：
```json
{"ts":"2018-01-01T01:03:00Z","srcIP":"1.1.1.1", "dstIP":"2.2.2.2", "srcPort":5000, "dstPort":7000, "protocol": 6, "packets":60, "bytes":6000, "cost": 4.3}
```

**定义时间间隔（batch only）**

对于批处理任务，需要定义时间间隔。时间戳超出时间间隔的输入行将不会被接收。

时间间隔指定在 `granularitySpec` 配置项中：
```json
"dataSchema" : {
  "dataSource" : "ingestion-tutorial",
  "timestampSpec" : {
    "format" : "iso",
    "column" : "ts"
  },
  "dimensionsSpec" : {
    "dimensions": [
      "srcIP",
      { "name" : "srcPort", "type" : "long" },
      { "name" : "dstIP", "type" : "string" },
      { "name" : "dstPort", "type" : "long" },
      { "name" : "protocol", "type" : "string" }
    ]
  },
  "metricsSpec" : [
    { "type" : "count", "name" : "count" },
    { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
    { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
    { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
  ],
  "granularitySpec" : {
    "type" : "uniform",
    "segmentGranularity" : "HOUR",
    "queryGranularity" : "MINUTE",
    "intervals" : ["2018-01-01/2018-01-02"],
    "rollup" : true
  }
}
```

### 定义任务类型

我们现在已经完成了 `dataSchema` 的定义。剩下的步骤是将我们创建的数据模式放入一个摄取任务规范中，并指定输入源。

`dataSchema` 在所有任务类型之间共享，但每个任务类型都有自己的规范格式。对于本教程，我们将使用本机批处理摄取任务：
```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "ingestion-tutorial",
      "timestampSpec" : {
        "format" : "iso",
        "column" : "ts"
      },
      "dimensionsSpec" : {
        "dimensions": [
          "srcIP",
          { "name" : "srcPort", "type" : "long" },
          { "name" : "dstIP", "type" : "string" },
          { "name" : "dstPort", "type" : "long" },
          { "name" : "protocol", "type" : "string" }
        ]
      },
      "metricsSpec" : [
        { "type" : "count", "name" : "count" },
        { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
        { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
        { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "HOUR",
        "queryGranularity" : "MINUTE",
        "intervals" : ["2018-01-01/2018-01-02"],
        "rollup" : true
      }
    }
  }
}
```
### 定义输入源

现在让我们定义输入源，它在 `ioConfig` 对象中指定。每个任务类型都有自己的 `ioConfig` 类型。要读取输入数据，我们需要指定一个`inputSource`。我们前面保存的示例网络流数据需要从本地文件中读取，该文件配置如下：

```json
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/",
        "filter" : "ingestion-tutorial-data.json"
      }
    }
```

#### 定义数据格式
因为我们的输入数据为JSON字符串，我们使用json的 `inputFormat`:
```json
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/",
        "filter" : "ingestion-tutorial-data.json"
      },
      "inputFormat" : {
        "type" : "json"
      }
    }
```
```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "ingestion-tutorial",
      "timestampSpec" : {
        "format" : "iso",
        "column" : "ts"
      },
      "dimensionsSpec" : {
        "dimensions": [
          "srcIP",
          { "name" : "srcPort", "type" : "long" },
          { "name" : "dstIP", "type" : "string" },
          { "name" : "dstPort", "type" : "long" },
          { "name" : "protocol", "type" : "string" }
        ]
      },
      "metricsSpec" : [
        { "type" : "count", "name" : "count" },
        { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
        { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
        { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "HOUR",
        "queryGranularity" : "MINUTE",
        "intervals" : ["2018-01-01/2018-01-02"],
        "rollup" : true
      }
    },
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/",
        "filter" : "ingestion-tutorial-data.json"
      },
      "inputFormat" : {
        "type" : "json"
      }
    }
  }
}
```

### 额外的调整
每一个摄入任务都有一个 `tuningConfig` 部分，该部分允许用户可以调整不同的摄入参数

例如，我们添加一个 `tuningConfig`，它为本地批处理摄取任务设置目标段大小：
```json
    "tuningConfig" : {
      "type" : "index_parallel",
      "maxRowsPerSegment" : 5000000
    }
```
注意：每一类摄入任务都有自己的 `tuningConfig` 类型

### 最终形成的规范
我们已经定义了摄取规范，现在应该如下所示：
```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "ingestion-tutorial",
      "timestampSpec" : {
        "format" : "iso",
        "column" : "ts"
      },
      "dimensionsSpec" : {
        "dimensions": [
          "srcIP",
          { "name" : "srcPort", "type" : "long" },
          { "name" : "dstIP", "type" : "string" },
          { "name" : "dstPort", "type" : "long" },
          { "name" : "protocol", "type" : "string" }
        ]
      },
      "metricsSpec" : [
        { "type" : "count", "name" : "count" },
        { "type" : "longSum", "name" : "packets", "fieldName" : "packets" },
        { "type" : "longSum", "name" : "bytes", "fieldName" : "bytes" },
        { "type" : "doubleSum", "name" : "cost", "fieldName" : "cost" }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "HOUR",
        "queryGranularity" : "MINUTE",
        "intervals" : ["2018-01-01/2018-01-02"],
        "rollup" : true
      }
    },
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/",
        "filter" : "ingestion-tutorial-data.json"
      },
      "inputFormat" : {
        "type" : "json"
      }
    },
    "tuningConfig" : {
      "type" : "index_parallel",
      "maxRowsPerSegment" : 5000000
    }
  }
}
```

### 提交任务和查询数据
在根目录运行以下命令：
```json
bin/post-index-task --file quickstart/ingestion-tutorial-index.json --url http://localhost:8081
```

脚本运行完成后我们可以查询数据。

运行 `bin/dsql` 中运行 `select * from "ingestion-tutorial"` 查询我们摄入什么样的数据

```json
$ bin/dsql
Welcome to dsql, the command-line client for Druid SQL.
Type "\h" for help.
dsql> select * from "ingestion-tutorial";

┌──────────────────────────┬───────┬──────┬───────┬─────────┬─────────┬─────────┬──────────┬─────────┬─────────┐
│ __time                   │ bytes │ cost │ count │ dstIP   │ dstPort │ packets │ protocol │ srcIP   │ srcPort │
├──────────────────────────┼───────┼──────┼───────┼─────────┼─────────┼─────────┼──────────┼─────────┼─────────┤
│ 2018-01-01T01:01:00.000Z │  6000 │  4.9 │     3 │ 2.2.2.2 │    3000 │      60 │ 6        │ 1.1.1.1 │    2000 │
│ 2018-01-01T01:02:00.000Z │  9000 │ 18.1 │     2 │ 2.2.2.2 │    7000 │      90 │ 6        │ 1.1.1.1 │    5000 │
│ 2018-01-01T01:03:00.000Z │  6000 │  4.3 │     1 │ 2.2.2.2 │    7000 │      60 │ 6        │ 1.1.1.1 │    5000 │
│ 2018-01-01T02:33:00.000Z │ 30000 │ 56.9 │     2 │ 8.8.8.8 │    5000 │     300 │ 17       │ 7.7.7.7 │    4000 │
│ 2018-01-01T02:35:00.000Z │ 30000 │ 46.3 │     1 │ 8.8.8.8 │    5000 │     300 │ 17       │ 7.7.7.7 │    4000 │
└──────────────────────────┴───────┴──────┴───────┴─────────┴─────────┴─────────┴──────────┴─────────┴─────────┘
Retrieved 5 rows in 0.12s.

dsql>
```
