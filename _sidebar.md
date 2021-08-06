- DRUID.OSSEZ.COM 概述
  - [项目概述](README.md)
  - [联系我们](CONTACT.md)

- 开始使用
  - [Druid 介绍](design/index.md)
  - [快速开始](tutorials/index.md)
  - [Docker 容器](tutorials/docker.md)
  - [独立服务器方式部署](operations/single-server.md)
  - [集群方式部署](tutorials/cluster.md)
  
- 教程（Tutorials）
  - [原生文件载入数据](tutorials/tutorial-batch.md)
  - [从 Apache Kafka 载入数据](tutorials/tutorial-kafka.md)
  - [从 Apache Hadoop 载入数据](tutorials/tutorial-batch-hadoop.md)
  - [查询数据](tutorials/tutorial-query.md)
  - [Roll-up](tutorials/tutorial-rollup.md)
  - [配置数据保存时间](tutorials/tutorial-retention.md)
  - [更新已经存在的数据](tutorials/tutorial-update-data.md)
  - [压缩段](tutorials/tutorial-compaction.md)
  - [删除数据](tutorials/tutorial-delete-data.md)
  - [写入数据导入属性](tutorials/tutorial-ingestion-spec.md)
  - [转换导入数据](tutorials/tutorial-transform-spec.md)
  - [Kerberized HDFS 深度存储](tutorials/tutorial-kerberos-hadoop.md)
  
- 设计（Design）
  - [设计](design/architecture.md)
  - [段（Segments）](design/segments.md)
  - [进程和服务](design/processes.md)
  - [深度存储](dependencies/deep-storage.md)
  - [元数据存储](dependencies/metadata-storage.md)
  - [ZooKeeper](dependencies/zookeeper.md)

- 载入（Ingestion）
  - [载入数据](ingestion/index.md)
  - [数据格式](ingestion/data-formats.md)
  - [Schema 设计技巧](ingestion/schema-design.md)
  - [数据管理](ingestion/data-management.md)
  - 流（Stream）数据载入
    - [Apache Kafka](development/extensions-core/kafka-ingestion.md)
    - [Amazon Kinesis](development/extensions-core/kinesis-ingestion.md)
    - [Tranquility](ingestion/tranquility.md)
  - 批量数据载入
    - [原生批量](ingestion/native-batch.md)
    - [Hadoop 数据载入](ingestion/hadoop.md)
  - [任务参考](ingestion/tasks.md)
  - [FAQ 常见问题](ingestion/faq.md)
  
- 查询（Querying）
  - [Druid SQL](querying/sql.md)
  - [原生查询](querying/querying.md)
  - [查询执行](querying/query-execution.md)
  - 概念
    - [数据源](querying/datasource.md)
    - [连接（joins）](querying/joins.md)
  - 原生查询类型
    - [Timeseries 查询](querying/timeseriesquery.md)
    - [TopN 查询](querying/topnquery.md)
    - [GroupBy 查询](querying/groupbyquery.md)
  
- 开发（Development）
  - [在 Druid 中进行开发](development/index.md)
  - [创建扩展（extensions）](development/modules.md)
  
- 其他杂项（Misc）
  - [Druid 资源快速导航](misc/index.md)

- [Changelog](changelog.md)