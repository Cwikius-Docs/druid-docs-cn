# Summary

* [Druid概述](README.md)

### 新手入门
  * [Druid介绍](GettingStarted/chapter-1.md)
  * [快速开始](GettingStarted/chapter-2.md)
  * [Docker](GettingStarted/Docker.md)
  * [单服务器部署](GettingStarted/chapter-3.md)
  * [集群部署](GettingStarted/chapter-4.md)

### 使用指导
  * [加载本地文件](Tutorials/chapter-1.md)
  * [从Kafka加载数据](Tutorials/chapter-2.md)
  * [从Hadoop加载数据](Tutorials/chapter-3.md)
  * [查询数据](Tutorials/chapter-4.md)
  * [Rollup操作](Tutorials/chapter-5.md)
  * [配置数据保留规则](Tutorials/chapter-6.md)
  * [数据更新](Tutorials/chapter-7.md)
  * [合并段文件](Tutorials/chapter-8.md)
  * [删除数据](Tutorials/chapter-9.md)
  * [摄入配置规范](Tutorials/chapter-10.md)
  * [转换输入数据](Tutorials/chapter-11.md)
  * [Kerberized HDFS存储](Tutorials/chapter-12.md)

### 架构设计
  * [整体设计](Design/Design.md)
  * [段设计](Design/Segments.md)
  * [进程与服务](Design/Processes.md)
    * [Coordinator](Design/Coordinator.md)
    * [Overlord](Design/Overlord.md)
    * [Historical](Design/Historical.md)
    * [MiddleManager](Design/MiddleManager.md)
    * [Broker](Design/Broker.md)
    * [Router](Design/Router.md)
    * [Indexer](Design/Indexer.md)
    * [Peon](Design/Peons.md)
  * [深度存储](Design/Deepstorage.md)
  * [元数据存储](Design/Metadata.md)
  * [Zookeeper](Design/Zookeeper.md)

### 数据摄取
  * [摄取概述](DataIngestion/ingestion.md)
  * [数据格式](DataIngestion/dataformats.md)
  * [schema设计](DataIngestion/schemadesign.md)
  * [数据管理](DataIngestion/datamanage.md)
  * [流式摄取](DataIngestion/kafka.md)
    * [Apache Kafka](DataIngestion/kafka.md)
    * [Apache Kinesis](DataIngestion/kinesis.md)
    * [Tranquility](DataIngestion/tranquility.md)
  * [批量摄取](DataIngestion/native.md)
    * [本地批](DataIngestion/native.md)
    * [Hadoop批](DataIngestion/hadoopbased.md)
  * [任务参考](DataIngestion/taskrefer.md)
  * [问题FAQ](DataIngestion/faq.md)

### 数据查询

* [Druid SQL](Querying/druidsql.md)
* [原生查询](Querying/makeNativeQueries.md)
* [查询执行](Querying/queryexecution.md)
* [一些概念](Querying/datasource.md)
  * [数据源](Querying/datasource.md)
  * [多值维度](Querying/multi-value-dimensions.md)
  * [上下文参数](Querying/query-context.md)
* [原生查询类型](Querying/timeseriesquery.md)
  * [Timeseries](Querying/timeseriesquery.md)
  * [TopN](Querying/topn.md)
  * [GroupBy](Querying/groupby.md)
  * [Scan](Querying/scan.md)
  * [Search](Querying/searchquery.md)
  * [TimeBoundary](Querying/timeboundaryquery.md)
  * [SegmentMetadata](Querying/segmentMetadata.md)
  * [DatasourceMetadata](Querying/datasourcemetadataquery.md)
* [原生查询组件](Querying/filters.md)
  * [过滤](Querying/filters.md)
  * [聚合](Querying/Aggregations.md)

### 配置列表

* [配置列表](Configuration/index.md)

### 操作指南

* [操作指南](Operations/index.md)

### 开发指南

* [开发指南](Development/index.md)

### 其他相关

* [其他相关](Misc/index.md)
