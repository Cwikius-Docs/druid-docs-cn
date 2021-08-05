# 从本地文件中加载数据
本指南演示了如何使用 Druid 的原生批量数据导入特性从本地文件中加载数据到 Apache Druid 中。

要想将数据导入到 Druid 中，你需要提交一个 *数据导入任务（ingestion task）* 规范到 Druid Overlord 进程中。
你可以手写这个规范，也可以通过使用 Druid 控制台提供的 _数据加载器（data loader）_ 来完成。

[快速指南](../tutorials/index.md) 页面向你展示了如何使用数据加载器（data loader）来构建一个数据导入的规范。

在生产环境中，你可能需要你的数据加载器能够自动工作完成数据的导入。
本页面中的指南先会向你展示如何通过 Druid 的控制台向 Druid 提交一个数据加载规范，然后再对这个数据加载规范设置自动化处理——从命令行和一个脚本中进行加载数据。


## 加载一个规范（使用控制台）

The Druid package includes the following sample native batch ingestion task spec at `quickstart/tutorial/wikipedia-index.json`, shown here for convenience,
which has been configured to read the `quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz` input file:

```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "dimensionsSpec" : {
        "dimensions" : [
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
      "timestampSpec": {
        "column": "time",
        "format": "iso"
      },
      "metricsSpec" : [],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "day",
        "queryGranularity" : "none",
        "intervals" : ["2015-09-12/2015-09-13"],
        "rollup" : false
      }
    },
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/tutorial/",
        "filter" : "wikiticker-2015-09-12-sampled.json.gz"
      },
      "inputFormat" :  {
        "type": "json"
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

This spec creates a datasource named "wikipedia".

From the Ingestion view, click the ellipses next to Tasks and choose `Submit JSON task`.

![Tasks view add task](../assets/tutorial-batch-submit-task-01.png "Tasks view add task")

This brings up the spec submission dialog where you can paste the spec above.

![Query view](../assets/tutorial-batch-submit-task-02.png "Query view")

Once the spec is submitted, wait a few moments for the data to load, after which you can query it.


## Loading data with a spec (via command line)

For convenience, the Druid package includes a batch ingestion helper script at `bin/post-index-task`.

This script will POST an ingestion task to the Druid Overlord and poll Druid until the data is available for querying.

Run the following command from Druid package root:

```bash
bin/post-index-task --file quickstart/tutorial/wikipedia-index.json --url http://localhost:8081
```

You should see output like the following:

```bash
Beginning indexing data for wikipedia
Task started: index_wikipedia_2018-07-27T06:37:44.323Z
Task log:     http://localhost:8081/druid/indexer/v1/task/index_wikipedia_2018-07-27T06:37:44.323Z/log
Task status:  http://localhost:8081/druid/indexer/v1/task/index_wikipedia_2018-07-27T06:37:44.323Z/status
Task index_wikipedia_2018-07-27T06:37:44.323Z still running...
Task index_wikipedia_2018-07-27T06:37:44.323Z still running...
Task finished with status: SUCCESS
Completed indexing data for wikipedia. Now loading indexed data onto the cluster...
wikipedia loading complete! You may now query your data
```

Once the spec is submitted, you can follow the same instructions as above to wait for the data to load and then query it.


## Loading data without the script

Let's briefly discuss how we would've submitted the ingestion task without using the script. You do not need to run these commands.

To submit the task, POST it to Druid in a new terminal window from the apache-druid-{{DRUIDVERSION}} directory:

```bash
curl -X 'POST' -H 'Content-Type:application/json' -d @quickstart/tutorial/wikipedia-index.json http://localhost:8081/druid/indexer/v1/task
```

Which will print the ID of the task if the submission was successful:

```bash
{"task":"index_wikipedia_2018-06-09T21:30:32.802Z"}
```

You can monitor the status of this task from the console as outlined above.


## Querying your data

Once the data is loaded, please follow the [query tutorial](../tutorials/tutorial-query.md) to run some example queries on the newly loaded data.


## Cleanup

If you wish to go through any of the other ingestion tutorials, you will need to shut down the cluster and reset the cluster state by removing the contents of the `var` directory under the druid package, as the other tutorials will write to the same "wikipedia" datasource.


## Further reading

For more information on loading batch data, please see [the native batch ingestion documentation](../ingestion/native-batch.md).



### 使用Data Loader来加载数据

浏览器访问 [localhost:8888](http://localhost:8888) 然后点击控制台中的 `Load data`

![](img-1/tutorial-batch-data-loader-01.png)

选择 `Local disk` 然后点击 `Connect data`

![](img-1/tutorial-batch-data-loader-02.png)

在 `Base directory` 中输入 `quickstart/tutorial/`, 在 `File filter` 中输入 `wikiticker-2015-09-12-sampled.json.gz`。 `Base directory` 和 `File filter` 分开是因为可能需要同时从多个文件中摄取数据。

点击 `Preview`，确保您看到的数据是正确的。

数据定位后，您可以点击"Next: Parse data"来进入下一步。

![](img-1/tutorial-batch-data-loader-03.png)

数据加载器将尝试自动为数据确定正确的解析器。在这种情况下，它将成功确定`json`。可以随意使用不同的解析器选项来预览Druid如何解析您的数据。

`json` 选择器被选中后，点击 `Next：Parse time` 进入下一步来决定您的主时间列。

![](img-1/tutorial-batch-data-loader-04.png)

Druid的体系结构需要一个主时间列（内部存储为名为__time的列）。如果您的数据中没有时间戳，请选择 `固定值（Constant Value）` 。在我们的示例中，数据加载器将确定原始数据中的时间列是唯一可用作主时间列的候选者。

点击"Next:..."两次完成 `Transform` 和 `Filter` 步骤。您无需在这些步骤中输入任何内容，因为使用摄取时间变换和过滤器不在本教程范围内。

![](img-1/tutorial-batch-data-loader-05.png)

在 `Configure schema` 步骤中，您可以配置将哪些维度和指标摄入到Druid中，这些正是数据在被Druid中摄取后出现的样子。 由于我们的数据集非常小，关掉rollup、确认更改。

一旦对schema满意后，点击 `Next` 后进入 `Partition` 步骤，该步骤中可以调整数据如何划分为段文件的方式。

![](img-1/tutorial-batch-data-loader-06.png)

在这里，您可以调整如何在Druid中将数据拆分为多个段。 由于这是一个很小的数据集，因此在此步骤中无需进行任何调整。

点击完成 `Tune` 步骤，进入到 `Publish` 步。

![](img-1/tutorial-batch-data-loader-07.png)

在 `Publish` 步骤中，我们可以指定Druid中的数据源名称,让我们将此数据源命名为 `Wikipedia`。最后，单击 `Next` 来查看您的摄取规范。

![](img-1/tutorial-batch-data-loader-08.png)

这就是您构建的规范，为了查看更改将如何更新规范是可以随意返回之前的步骤中进行更改，同样，您也可以直接编辑规范，并在前面的步骤中看到它。

对摄取规范感到满意后，请单击 `Submit`，然后将创建一个数据摄取任务。

![](img-1/tutorial-batch-data-loader-09.png)

您可以进入任务视图，重点关注新创建的任务。任务视图设置为自动刷新，请等待任务成功。

当一项任务成功完成时，意味着它建立了一个或多个段，这些段现在将由Data服务器接收。

从标题导航到 `Datasources` 视图。

![](img-1/tutorial-batch-data-loader-10.png)

等待直到您的数据源（Wikipedia）出现,加载段时可能需要几秒钟。

一旦看到绿色（完全可用）圆圈，就可以查询数据源。此时，您可以转到 `Query` 视图以对数据源运行SQL查询。

![](img-1/tutorial-batch-data-loader-11.png)

运行 `SELECT * FROM wikipedia` 查询可以看到详细的结果。

查看[查询教程](../querying/makeNativeQueries.md)以对新加载的数据运行一些示例查询。

### 使用spec加载数据（通过控制台）

Druid的安装包中在 `quickstart/tutorial/wikipedia-index.json` 文件中包含了一个本地批摄入任务规范的示例。 为了方便我们在这里展示出来，该规范已经配置好读取 `quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz` 输入文件。

```json
{
  "type" : "index_parallel",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "dimensionsSpec" : {
        "dimensions" : [
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
      "timestampSpec": {
        "column": "time",
        "format": "iso"
      },
      "metricsSpec" : [],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "day",
        "queryGranularity" : "none",
        "intervals" : ["2015-09-12/2015-09-13"],
        "rollup" : false
      }
    },
    "ioConfig" : {
      "type" : "index_parallel",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "quickstart/tutorial/",
        "filter" : "wikiticker-2015-09-12-sampled.json.gz"
      },
      "inputFormat" :  {
        "type": "json"
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
这份规范将创建一个命名为"wikipedia"的数据源。

在"Tasks"页面，点击 `Submit task` 后选择 `Raw JSON task`,

![](img-1/tutorial-batch-submit-task-01.png)

然后会在页面中弹出任务规范输入框，您可以在上面粘贴规范

![](img-1/tutorial-batch-submit-task-02.png)

提交任务规范后，您可以按照上述相同的规范等待数据加载然后查询。

### 使用spec加载数据（通过命令行）

为了方便，在Druid的软件包中提供了一个批摄取的帮助脚本 `bin/post-index-task`

该脚本会将数据摄取任务发布到Druid Overlord并轮询Druid，直到可以查询数据为止。

在Druid根目录运行以下命令：

```json
bin/post-index-task --file quickstart/tutorial/wikipedia-index.json --url http://localhost:8081
```
可以看到以下的输出：

```json
Beginning indexing data for wikipedia
Task started: index_wikipedia_2018-07-27T06:37:44.323Z
Task log:     http://localhost:8081/druid/indexer/v1/task/index_wikipedia_2018-07-27T06:37:44.323Z/log
Task status:  http://localhost:8081/druid/indexer/v1/task/index_wikipedia_2018-07-27T06:37:44.323Z/status
Task index_wikipedia_2018-07-27T06:37:44.323Z still running...
Task index_wikipedia_2018-07-27T06:37:44.323Z still running...
Task finished with status: SUCCESS
Completed indexing data for wikipedia. Now loading indexed data onto the cluster...
wikipedia loading complete! You may now query your data
```
提交任务规范后，您可以按照上述相同的规范等待数据加载然后查询。

### 不使用脚本来加载数据

我们简短地讨论一下如何在不使用脚本的情况下提交数据摄取任务，您将不需要运行这些命令。

要提交任务，可以在一个新的终端中通过以下方式提交任务到Druid：

```json
curl -X 'POST' -H 'Content-Type:application/json' -d @quickstart/tutorial/wikipedia-index.json http://localhost:8081/druid/indexer/v1/task
```
当任务提交成功后会打印出来任务的ID
```json
{"task":"index_wikipedia_2018-06-09T21:30:32.802Z"}
```
您可以如上所述从控制台监视此任务的状态

### 查询已加载数据

加载数据后，请按照[查询教程](./chapter-4.md)的操作，对新加载的数据执行一些示例查询。

### 数据清理

如果您希望阅读其他任何入门教程，则需要关闭集群并通过删除druid软件包下的`var`目录的内容来重置集群状态，因为其他教程将写入相同的"wikipedia"数据源。

### 更多信息

更多关于加载批数据的信息可以查看[原生批摄取文档](../ingestion/native.md)