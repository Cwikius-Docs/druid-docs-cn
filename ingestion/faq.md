---
id: faq
title: "Ingestion troubleshooting FAQ"
sidebar_label: "Troubleshooting FAQ"
---

<!--
  ~ Licensed to the Apache Software Foundation (ASF) under one
  ~ or more contributor license agreements.  See the NOTICE file
  ~ distributed with this work for additional information
  ~ regarding copyright ownership.  The ASF licenses this file
  ~ to you under the Apache License, Version 2.0 (the
  ~ "License"); you may not use this file except in compliance
  ~ with the License.  You may obtain a copy of the License at
  ~
  ~   http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~ Unless required by applicable law or agreed to in writing,
  ~ software distributed under the License is distributed on an
  ~ "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  ~ KIND, either express or implied.  See the License for the
  ~ specific language governing permissions and limitations
  ~ under the License.
  -->

## Batch Ingestion

If you are trying to batch load historical data but no events are being loaded, make sure the interval of your ingestion spec actually encapsulates the interval of your data. Events outside this interval are dropped.

## Druid ingested my events but I they are not in my query results

If the number of ingested events seem correct, make sure your query is correctly formed. If you included a `count` aggregator in your ingestion spec, you will need to query for the results of this aggregate with a `longSum` aggregator. Issuing a query with a count aggregator will count the number of Druid rows, which includes [roll-up](../design/index.md).

## What types of data does Druid support?

Druid can ingest JSON, CSV, TSV and other delimited data out of the box. Druid supports single dimension values, or multiple dimension values (an array of strings). Druid supports long, float, and double numeric columns.

## Where do my Druid segments end up after ingestion?

Depending on what `druid.storage.type` is set to, Druid will upload segments to some [Deep Storage](../dependencies/deep-storage.md). Local disk is used as the default deep storage.

## My stream ingest is not handing segments off

First, make sure there are no exceptions in the logs of the ingestion process. Also make sure that `druid.storage.type` is set to a deep storage that isn't `local` if you are running a distributed cluster.

Other common reasons that hand-off fails are as follows:

1) Druid is unable to write to the metadata storage. Make sure your configurations are correct.

2) Historical processes are out of capacity and cannot download any more segments. You'll see exceptions in the Coordinator logs if this occurs and the Coordinator console will show the Historicals are near capacity.

3) Segments are corrupt and cannot be downloaded. You'll see exceptions in your Historical processes if this occurs.

4) Deep storage is improperly configured. Make sure that your segment actually exists in deep storage and that the Coordinator logs have no errors.

## How do I get HDFS to work?

Make sure to include the `druid-hdfs-storage` and all the hadoop configuration, dependencies (that can be obtained by running command `hadoop classpath` on a machine where hadoop has been setup) in the classpath. And, provide necessary HDFS settings as described in [deep storage](../dependencies/deep-storage.md) .

## How do I know when I can make query to Druid after submitting batch ingestion task?

You can verify if segments created by a recent ingestion task are loaded onto historicals and available for querying using the following workflow.
1. Submit your ingestion task.
2. Repeatedly poll the [Overlord's tasks API](../operations/api-reference.md#tasks) ( `/druid/indexer/v1/task/{taskId}/status`) until your task is shown to be successfully completed.
3. Poll the [Segment Loading by Datasource API](../operations/api-reference.md#segment-loading-by-datasource) (`/druid/coordinator/v1/datasources/{dataSourceName}/loadstatus`) with
   `forceMetadataRefresh=true` and `interval=<INTERVAL_OF_INGESTED_DATA>` once.
   (Note: `forceMetadataRefresh=true` refreshes Coordinator's metadata cache of all datasources. This can be a heavy operation in terms of the load on the metadata store but is necessary to make sure that we verify all the latest segments' load status)
   If there are segments not yet loaded, continue to step 4, otherwise you can now query the data.
4. Repeatedly poll the [Segment Loading by Datasource API](../operations/api-reference.md#segment-loading-by-datasource) (`/druid/coordinator/v1/datasources/{dataSourceName}/loadstatus`) with
   `forceMetadataRefresh=false` and `interval=<INTERVAL_OF_INGESTED_DATA>`.
   Continue polling until all segments are loaded. Once all segments are loaded you can now query the data.
   Note that this workflow only guarantees that the segments are available at the time of the [Segment Loading by Datasource API](../operations/api-reference.md#segment-loading-by-datasource) call. Segments can still become missing because of historical process failures or any other reasons afterward.

## I don't see my Druid segments on my Historical processes

You can check the Coordinator console located at `<COORDINATOR_IP>:<PORT>`. Make sure that your segments have actually loaded on [Historical processes](../design/historical.md). If your segments are not present, check the Coordinator logs for messages about capacity of replication errors. One reason that segments are not downloaded is because Historical processes have maxSizes that are too small, making them incapable of downloading more data. You can change that with (for example):

```
-Ddruid.segmentCache.locations=[{"path":"/tmp/druid/storageLocation","maxSize":"500000000000"}]
 ```

## My queries are returning empty results

You can use a [segment metadata query](../querying/segmentmetadataquery.md) for the dimensions and metrics that have been created for your datasource. Make sure that the name of the aggregators you use in your query match one of these metrics. Also make sure that the query interval you specify match a valid time range where data exists.

## How can I Reindex existing data in Druid with schema changes?

You can use DruidInputSource with the [Parallel task](../ingestion/native-batch.md) to ingest existing druid segments using a new schema and change the name, dimensions, metrics, rollup, etc. of the segment.
See [DruidInputSource](../ingestion/native-batch.md#druid-input-source) for more details.
Or, if you use hadoop based ingestion, then you can use "dataSource" input spec to do reindexing.

See the [Update existing data](../ingestion/data-management.md#update) section of the data management page for more details.

## How can I change the query granularity of existing data in Druid?

In a lot of situations you may want coarser granularity for older data. Example, any data older than 1 month has only hour level granularity but newer data has minute level granularity. This use case is same as re-indexing.

To do this use the [DruidInputSource](../ingestion/native-batch.md#druid-input-source) and run a [Parallel task](../ingestion/native-batch.md). The DruidInputSource will allow you to take in existing segments from Druid and aggregate them and feed them back into Druid. It will also allow you to filter the data in those segments while feeding it back in. This means if there are rows you want to delete, you can just filter them away during re-ingestion.
Typically the above will be run as a batch job to say everyday feed in a chunk of data and aggregate it.
Or, if you use hadoop based ingestion, then you can use "dataSource" input spec to do reindexing.

See the [Update existing data](../ingestion/data-management.md#update) section of the data management page for more details.

You can also change the query granularity using compaction. See [Query granularity handling](../ingestion/compaction.md#query-granularity-handling).

## Real-time ingestion seems to be stuck

There are a few ways this can occur. Druid will throttle ingestion to prevent out of memory problems if the intermediate persists are taking too long or if hand-off is taking too long. If your process logs indicate certain columns are taking a very long time to build (for example, if your segment granularity is hourly, but creating a single column takes 30 minutes), you should re-evaluate your configuration or scale up your real-time ingestion.

## More information

Data ingestion for Druid can be difficult for first time users. Please don't hesitate to ask questions in the [Druid Forum](https://www.druidforum.org/).




## 数据摄取相关问题FAQ
### 实时摄取

最常见的原因是事件被摄取是在Druid的窗口时段 `windowPeriod` 范围之外。Druid实时摄取只接受当前时间的可配置窗口时段内的事件。您可以通过查看包含 `ingest/events/*` 日志行的实时进程日志来验证这是什么情况。这些z指标将标识接收、拒绝的事件等。

我们建议对生产中的历史数据使用批量摄取方法。

### 批量摄取

如果尝试批量加载历史数据，但没有事件被加载到，请确保摄取规范的时间间隔实际上包含了数据的间隔。此间隔之外的事件将被删除。

### Druid支持什么样的数据类型

Druid可以摄取JSON、CSV、TSV和其他分隔数据。Druid支持一维值或多维值（字符串数组）。Druid支持long、float和double数值列。

### 并非所有的事件都被摄取了

Druid会拒绝时间窗口之外的事件， 确认事件是否被拒绝了的最佳方式是查看 [Druid摄取指标](../operations/metrics.md)

如果摄取的事件数似乎正确，请确保查询的格式正确。如果在摄取规范中包含 `count` 聚合器，则需要使用 `longSum` 聚合器查询此聚合的结果。使用count聚合器发出查询将计算Druid行的数量，包括 [rollup](ingestion.md#rollup)。

### 摄取之后段存储在哪里

段的存储位置由 `druid.storage.type` 配置决定的，Druid会将段上传到 [深度存储](../design/Deepstorage.md)。 本地磁盘是默认的深度存储位置。

### 流摄取任务没有发生段切换递交

首先，确保摄取过程的日志中没有异常，如果运行的是分布式集群，还要确保 `druid.storage.type` 被设置为非本地的深度存储。

移交失败的其他常见原因如下：

1. Druid无法写入元数据存储，确保您的配置正确
2. Historical进程容量不足，无法再下载任何段。如果发生这种情况，您将在Coordinator日志中看到异常，Coordinator控制台将显示历史记录接近容量
3. 段已损坏，无法下载。如果发生这种情况，您将在Historical进程中看到异常
4. 深度存储配置不正确。确保您的段实际存在于深度存储中，并且Coordinator日志没有错误

### 如何让HDFS工作

确保在类路径中包含 `druid-hdfs-storage` 和所有的hadoop配置、依赖项（可以通过在安装了hadoop的计算机上运行 `hadoop classpath`命令获得）。并且，提供必要的HDFS设置，如 [深度存储](../design/Deepstorage.md) 中所述。

### 没有在Historical进程中看到Druid段

您可以查看位于 `<Coordinator_IP>:<PORT>` 的Coordinator控制台, 确保您的段实际上已加载到 [Historical进程](../design/Historical.md)中。如果段不存在，请检查Coordinator日志中有关复制错误容量的消息。不下载段的一个原因是，Historical进程的 `maxSize` 太小，使它们无法下载更多数据。您可以使用（例如）更改它：

```json
-Ddruid.segmentCache.locations=[{"path":"/tmp/druid/storageLocation","maxSize":"500000000000"}]
-Ddruid.server.maxSize=500000000000
```

### 查询返回来了空结果

您可以对为数据源创建的dimension和metric使用段 [元数据查询](../querying/segmentMetadata.md)。确保您在查询中使用的聚合器的名称与这些metric之一匹配，还要确保指定的查询间隔与存在数据的有效时间范围匹配。

### schema变化时如何在Druid中重新索引现有数据

您可以将 [DruidInputSource](native.md#Druid输入源) 与 [并行任务](native.md#并行任务) 一起使用，以使用新schema摄取现有的druid段，并更改该段的name、dimensions、metrics、rollup等。有关详细信息，请参阅 [DruidInputSource](native.md#Druid输入源)。或者，如果使用基于hadoop的摄取，那么可以使用"dataSource"输入规范来重新编制索引。

有关详细信息，请参阅 [数据管理](datamanage.md) 页的 [更新现有数据](datamanage.md#更新现有的数据) 部分。

### 如果更改Druid中现有数据的段粒度

在很多情况下，您可能希望降低旧数据的粒度。例如，任何超过1个月的数据都只有小时级别的粒度，而较新的数据只有分钟级别的粒度。此场景与重新索引相同。

为此，使用 [DruidInputSource](native.md#Druid输入源) 并运行一个 [并行任务](native.md#并行任务)。[DruidInputSource](native.md#Druid输入源) 将允许你从Druid中获取现有的段并将它们聚合并反馈给Druid。它还允许您在反馈数据时过滤这些段中的数据，这意味着，如果有要删除的行，可以在重新摄取期间将它们过滤掉。通常，上面的操作将作为一个批处理作业运行，即每天输入一大块数据并对其进行聚合。或者，如果使用基于hadoop的摄取，那么可以使用"dataSource"输入规范来重新编制索引。

有关详细信息，请参阅 [数据管理](datamanage.md) 页的 [更新现有数据](datamanage.md#更新现有的数据) 部分。

### 实时摄取似乎被卡住了

有几种方法可以做到这一点。如果中间持久化消耗太长时间或如果移交消耗太长事件，Druid将限制摄入，以防止内存不足的问题。如果您的流程日志表明某些列的生成时间非常长（例如，如果您的段粒度是每小时一次，但是创建一个列需要30分钟），那么您应该重新评估您的配置或扩展您的实时接收

### 更多信息

对于第一次使用Druid的用户来说，将数据输入Druid是非常困难的。请不要犹豫，在我们的IRC频道或在我们的 [google群组](https://groups.google.com/forum/#!forum/druid-user) 页面上提问。