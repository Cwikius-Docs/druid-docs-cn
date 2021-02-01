## Apache Druid是一个高性能的实时分析型数据库

* ### 云原生、流原生的分析型数据库
  
    Druid专为需要快速数据查询与摄入的工作流程而设计，在即时数据可见性、即席查询、运营分析以及高并发等方面表现非常出色。在实际中[众多场景](Misc/usercase.md)下数据仓库解决方案中，可以考虑将Druid当做一种开源的替代解决方案。

* ### 可轻松与现有的数据管道进行集成

    Druid原生支持从[Kafka](http://kafka.apache.org/)、[Amazon Kinesis](https://aws.amazon.com/cn/kinesis/)等消息总线中流式的消费数据，也同时支持从[HDFS](https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsUserGuide.html)、[Amazon S3](https://aws.amazon.com/cn/s3/)等存储服务中批量的加载数据文件。

* ### 较传统方案提升近百倍的效率

    Druid创新地在架构设计上吸收和结合了[数据仓库](https://en.wikipedia.org/wiki/Data_warehouse)、[时序数据库](https://en.wikipedia.org/wiki/Time_series_database)以及[检索系统](https://en.wikipedia.org/wiki/Search_engine_(computing))的优势，在已经完成的[基准测试](https://imply.io/post/performance-benchmark-druid-presto-hive)中展现出来的性能远远超过数据摄入与查询的传统解决方案。

* ### 解锁了一种新型的工作流程

    Druid为点击流、APM、供应链、网络监测、市场营销以及其他事件驱动类型的数据分析解锁了一种[新型的查询与工作流程](Misc/usercase.md)，它专为实时和历史数据高效快速的即席查询而设计。

* ### 可部署在AWS/GCP/Azure,混合云,Kubernetes, 以及裸机上

    无论在云上还是本地，Druid可以轻松的部署在商用硬件上的任何*NIX环境。部署Druid也是非常简单的，包括集群的扩容或者下线都也同样很简单。

> [!TIP]
> 在国内Druid的使用者越来越多，但是并没有一个很好的中文版本的使用文档。 本文档根据Apache Druid官方文档0.20.1版本进行翻译，目前托管在Github上，欢迎更多的Druid使用者以及爱好者加入翻译行列，为国内的使用者提供一个高质量的中文版本使用文档。

