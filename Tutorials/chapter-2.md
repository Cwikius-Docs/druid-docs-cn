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

## 教程：从Kafka中加载流式数据
### 入门

本教程演示了如何使用Druid的Kafka索引服务将数据从Kafka流加载到Apache Druid中。

在本教程中，我们假设您已经按照快速入门中的说明下载了Druid并使用 `micro-quickstart`单机配置使其在本地计算机上运行。您不需要加载任何数据。

### 下载并启动Kafka

[Apache Kafka](http://kafka.apache.org/)是一种高吞吐量消息总线，可与Druid很好地配合使用。在本教程中，我们将使用Kafka2.1.0。要下载Kafka，请在终端中执行以下命令：

```json
curl -O https://archive.apache.org/dist/kafka/2.1.0/kafka_2.12-2.1.0.tgz
tar -xzf kafka_2.12-2.1.0.tgz
cd kafka_2.12-2.1.0
```
通过在终端中运行以下命令来启动一个Kafka Broker：

```json
./bin/kafka-server-start.sh config/server.properties
```

执行以下命令来创建一个我们用来发送数据的Kafka主题，称为"*wikipedia*":

```json
./bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic wikipedia
```

### 发送数据到Kafka

让我们为该主题启动一个生产者并发送一些数据

在Druid目录下，运行下边的命令：
```json
cd quickstart/tutorial
gunzip -c wikiticker-2015-09-12-sampled.json.gz > wikiticker-2015-09-12-sampled.json
```

在Kafka目录下，运行以下命令，{PATH_TO_DRUID}替换为Druid目录的路径：
```json
export KAFKA_OPTS="-Dfile.encoding=UTF-8"
./bin/kafka-console-producer.sh --broker-list localhost:9092 --topic wikipedia < {PATH_TO_DRUID}/quickstart/tutorial/wikiticker-2015-09-12-sampled.json
```

上一个命令将示例事件发布到名称为*wikipedia*的Kafka主题。现在，我们将使用Druid的Kafka索引服务从新创建的主题中提取消息。

### 使用数据加载器（Data Loader）

浏览器访问 [localhost:8888](http://localhost:8888) 然后点击控制台中的 `Load data`

![](img-2/tutorial-kafka-data-loader-01.png)

选择 `Apache Kafka` 然后点击 `Connect data`

![](img-2/tutorial-kafka-data-loader-02.png)

在 `Bootstrap servers` 输入 `localhost:9092`, 在 `Topic` 输入 `wikipedia`

点击 `Preview` 后确保您看到的数据是正确的

数据定位后，您可以点击"Next: Parse data"来进入下一步。

![](img-2/tutorial-kafka-data-loader-03.png)

数据加载器将尝试自动为数据确定正确的解析器。在这种情况下，它将成功确定`json`。可以随意使用不同的解析器选项来预览Druid如何解析您的数据。

`json` 选择器被选中后，点击 `Next：Parse time` 进入下一步来决定您的主时间列。

![](img-2/tutorial-kafka-data-loader-04.png)

Druid的体系结构需要一个主时间列（内部存储为名为__time的列）。如果您的数据中没有时间戳，请选择 `固定值（Constant Value）` 。在我们的示例中，数据加载器将确定原始数据中的时间列是唯一可用作主时间列的候选者。

点击"Next:..."两次完成 `Transform` 和 `Filter` 步骤。您无需在这些步骤中输入任何内容，因为使用摄取时间变换和过滤器不在本教程范围内。

![](img-2/tutorial-kafka-data-loader-05.png)

在 `Configure schema` 步骤中，您可以配置将哪些维度和指标摄入到Druid中，这些正是数据在被Druid中摄取后出现的样子。 由于我们的数据集非常小，关掉rollup、确认更改。

一旦对schema满意后，点击 `Next` 后进入 `Partition` 步骤，该步骤中可以调整数据如何划分为段文件的方式。

![](img-2/tutorial-kafka-data-loader-06.png)

在这里，您可以调整如何在Druid中将数据拆分为多个段。 由于这是一个很小的数据集，因此在此步骤中无需进行任何调整。

点击完成 `Tune` 步骤。

![](img-2/tutorial-kafka-data-loader-07.png)

在 `Tune` 步骤中，将 `Use earliest offset` 设置为 `True` *非常重要*，因为我们需要从流的开始位置消费数据。 其他没有任何需要更改的地方，进入到 `Publish` 步

![](img-2/tutorial-kafka-data-loader-08.png)

我们将该数据源命名为 `wikipedia-kafka`

最后点击 `Next` 预览摄入规范：

![](img-2/tutorial-kafka-data-loader-09.png)

这就是您构建的规范，为了查看更改将如何更新规范是可以随意返回之前的步骤中进行更改，同样，您也可以直接编辑规范，并在前面的步骤中看到它。

对摄取规范感到满意后，请单击 `Submit`，然后将创建一个数据摄取任务

![](img-2/tutorial-kafka-data-loader-10.png)

您可以进入任务视图，重点关注新创建的supervisor。任务视图设置为自动刷新，请等待直到Supervisor启动了一个任务。

当一项任务开始运行时，它将开始处理其摄入的数据。

从标题导航到 `Datasources` 视图。

![](img-2/tutorial-kafka-data-loader-11.png)

当 `wikipedia-kafka` 数据源出现在这儿的时候就可以被查询了。

> ![TIPS]
> 如果过了几分钟之后数据源还是没有出现在这里，可能是在 `Tune` 步骤中没有设置为从流的开始进行消费数据

此时，就可以在 `Query` 视图中运行SQL查询了，因为这是一个小的数据集，你可以简单的运行 `SELECT * FROM "wikipedia-kafka"` 来查询结果。

![](img-2/tutorial-kafka-data-loader-12.png)

查看[查询教程](../Querying/makeNativeQueries.md)以对新加载的数据运行一些示例查询。

#### 通过控制台提交supervisor

在控制台中点击 `Submit supervisor` 打开提交supervisor对话框：

![](img-2/tutorial-kafka-submit-supervisor-01.png)

粘贴以下规范后点击 `Submit`

```json
{
  "type": "kafka",
  "spec" : {
    "dataSchema": {
      "dataSource": "wikipedia",
      "timestampSpec": {
        "column": "time",
        "format": "auto"
      },
      "dimensionsSpec": {
        "dimensions": [
          "channel",
          "cityName",
          "comment",
          "countryIsoCode",
          "countryName",
          "isAnonymous",
          "isMinor",
          "isNew",
          "isRobot",
          "isUnpatrolled",
          "metroCode",
          "namespace",
          "page",
          "regionIsoCode",
          "regionName",
          "user",
          { "name": "added", "type": "long" },
          { "name": "deleted", "type": "long" },
          { "name": "delta", "type": "long" }
        ]
      },
      "metricsSpec" : [],
      "granularitySpec": {
        "type": "uniform",
        "segmentGranularity": "DAY",
        "queryGranularity": "NONE",
        "rollup": false
      }
    },
    "tuningConfig": {
      "type": "kafka",
      "reportParseExceptions": false
    },
    "ioConfig": {
      "topic": "wikipedia",
      "inputFormat": {
        "type": "json"
      },
      "replicas": 2,
      "taskDuration": "PT10M",
      "completionTimeout": "PT20M",
      "consumerProperties": {
        "bootstrap.servers": "localhost:9092"
      }
    }
  }
}
```

这将启动supervisor，该supervisor继而产生一些任务，这些任务将开始监听传入的数据。

#### 直接提交supervisor

为了直接启动服务，我们可以在Druid的根目录下运行以下命令来提交一个supervisor规范到Druid Overlord中

```json
curl -XPOST -H'Content-Type: application/json' -d @quickstart/tutorial/wikipedia-kafka-supervisor.json http://localhost:8081/druid/indexer/v1/supervisor
```
如果supervisor被成功创建后，将会返回一个supervisor的ID，在本例中看到的是 `{"id":"wikipedia"}`

更详细的信息可以查看[Druid Kafka索引服务文档](../DataIngestion/kafka.md)

您可以在[Druid控制台]( http://localhost:8888/unified-console.html#tasks)中查看现有的supervisors和tasks

### 数据查询
数据被发送到Kafka流之后，立刻就可以被查询了。

按照[查询教程](./chapter-4.md)的操作，对新加载的数据执行一些示例查询
### 清理数据
如果您希望阅读其他任何入门教程，则需要关闭集群并通过删除druid软件包下的`var`目录的内容来重置集群状态，因为其他教程将写入相同的"wikipedia"数据源。
### 进一步阅读
更多关于从Kafka流加载数据的信息，可以查看[Druid Kafka索引服务文档](../DataIngestion/kafka.md)