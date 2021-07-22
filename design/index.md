# Druid 介绍
本页面对 Druid 的基本情况进行了一些介绍和简要说明。

## 什么是 Druid

Apache Druid 是一个实时分析型数据库，旨在对大型数据集进行快速查询和分析（"[OLAP](https://en.wikipedia.org/wiki/Online_analytical_processing)" 查询)。

Druid 最常被当做数据库，用以支持实时摄取、高查询性能和高稳定运行的应用场景。
例如，Druid 通常被用来作为图形分析工具的数据源来提供数据，或当有需要高聚和高并发的后端 API。
同时 Druid 也非常适合针对面向事件类型的数据。

通常可以使用 Druid 作为数据源的系统包括有：
- 点击流量分析（Web 或者移动分析）
- 网络监测分析（网络性能监控）
- 服务器存储指标
- 供应链分析（生产数据指标）
- 应用性能指标
- 数字广告分析
- 商业整合 / OLAP

Druid 的核心架构集合了数据仓库（data warehouses），时序数据库（timeseries databases），日志分析系统（logsearch systems）的概念。

如果你对上面的各种数据类型，数据库不是非常了解的话，那么我们建议你进行一些搜索来了解相关的一些定义和提供的功能。

Druid 的一些关键特性包括有：
1. **列示存储格式（Columnar storage format）** Druid 使用列式存储，这意味着在一个特定的数据查询中它只需要查询特定的列。
   这样的设计极大的提高了部分列查询场景性能。另外，每一列数据都针对特定数据类型做了优化存储，从而能够支持快速扫描和聚合。

2. **可扩展的分布式系统(Scalable distributed system)** Druid通常部署在数十到数百台服务器的集群中，
   并且可以提供每秒数百万级的数据导入，并且保存有万亿级的数据，同时提供 100ms 到 几秒钟之间的查询延迟。
   
3. **高性能并发处理（Massively parallel processing）** Druid 可以在整个集群中并行处理查询。

4. **实时或者批量数据处理（Realtime or batch ingestion）** Druid 可以实时（已经被导入和摄取的数据可立即用于查询）导入摄取数据库或批量导入摄取数据。 
   
5. **自我修复、自我平衡、易于操作（Self-healing, self-balancing, easy to operate）** 为集群运维操作人员，要伸缩集群只需添加或删除服务，集群就会在后台自动重新平衡自身，而不会造成任何停机。
   如果任何一台 Druid 服务器发生故障，系统将自动绕过损坏的节点而保持无间断运行。
   Druid 被设计为 7*24 运行，无需设计任何原因的计划内停机（例如需要更改配置或者进行软件更新）。
   
6. **原生结合云的容错架构，不丢失数据（Cloud-native, fault-tolerant architecture that won't lose data）** 一旦 Druid 获得了数据，那么获得的数据将会安全的保存在 [深度存储](architecture.md#deep-storage) (通常是云存储，HDFS 或共享文件系统)中。
   即使单个个 Druid 服务发生故障，你的数据也可以从深度存储中进行恢复。对于仅影响少数 Druid 服务的有限故障，保存的副本可确保在系统恢复期间仍然可以进行查询。
   
7. **针对快速过滤的索引（Indexes for quick filtering）** Druid 使用 [Roaring](https://roaringbitmap.org/) 或
[CONCISE](https://arxiv.org/pdf/1004.0403) 来压缩 bitmap indexes 后来创建索引，以支持快速过滤和跨多列搜索。
   
8. **基于时间的分区（Time-based partitioning）** Druid 首先按时间对数据进行分区，同时也可以根据其他字段进行分区。
   这意味着基于时间的查询将仅访问与查询时间范围匹配的分区，这将大大提高基于时间的数据处理性能。
   
9. **近似算法(Approximate algorithms)** Druid应用了近似 `count-distinct`，近似排序以及近似直方图和分位数计算的算法。
   这些算法占用有限的内存使用量，通常比精确计算要快得多。对于精度要求比速度更重要的场景，Druid 还提供了exact count-distinct 和 exact ranking。
   
10. **在数据摄取的时候自动进行汇总(Automatic summarization at ingest time)** Druid 支持在数据摄取阶段可选地进行数据汇总，这种汇总会部分预先聚合您的数据，并可以节省大量成本并提高性能。


## 我应该在什么时候使用 Druid

许多公司都已经将 Druid 应用于多种不同的应用场景。请访问 [使用 Apache Druid 的公司](https://druid.apache.org/druid-powered) 页面来了解都有哪些公司使用了 Druid。

如果您的使用场景符合下面的一些特性，那么Druid 将会是一个非常不错的选择：

- 数据的插入频率非常高，但是更新频率非常低。
- 大部分的查询为聚合查询（aggregation）和报表查询（reporting queries），例如我们常使用的 "group by" 查询。同时还有一些检索和扫描查询。
- 查询的延迟被限制在 100ms 到 几秒钟之间。
- 你的数据具有时间组件（属性）。针对时间相关的属性，Druid 进行特殊的设计和优化。
- 你可能具有多个数据表，但是查询通常只针对一个大型的分布数据表，但是，查询又可能需要查询多个较小的 `lookup` 表。
- 如果你的数据中具有高基数（high cardinality）数据字段，例如 URLs、用户 IDs，但是你需要对这些字段进行快速计数和排序。
- 你需要从 Kafka，HDFS，文本文件，或者对象存储（例如，AWS S3）中载入数据。


如果你的使用场景是下面的一些情况的话，Druid **不是**一个较好的选择：

- 针对一个已经存在的记录，使用主键（primary key）进行低延迟的更新操作。Druid 支持流式插入（streaming inserts）数据，但是并不很好的支持流式更新（streaming updates）数据。
  Druid 的更新操作是通过后台批处理完成的。
- 你的系统类似的是一个离线的报表系统，查询的延迟不是系统设计的重要考虑。
- 使用场景中需要对表（Fact Table）进行连接查询，并且针对这个查询你可以介绍比较高的延迟来等待查询的完成。


### 高基数
在 SQL 中，基数（cardinality）的定义为一个数据列中独一无二数据的数量。

高基数（High-Cardinality）的定义为在一个数据列中的数据基本上不重复，或者说重复率非常低。

例如我们常见的识别号，邮件地址，用户名等都可以被认为是高基数数据。
例如我们常定义的 USERS 数据表中的 USER_ID 字段，这个字段中的数据通常被定义为 1 到 n。每一次一个新的用户被作为记录插入到 USERS 表中，一个新的记录将会被创建，
字段 USER_ID 将会使用一个新的数据来标识这个被插入的数据。因为 USER_ID 中插入的数据是独一无二的，因此这个字段的数据技术就可以被考虑认为是 高基数（High-Cardinality） 数据。


### Fact Table
与 Fact Table 对应的表是 Dimension Table。

这 2 个表是数据仓库的两个概念，为数据仓库的两种类型表。 从保存数据的角度来说，本质上没区别，都是表。
区别主要在数据和用途上，Fact Table 用来存 fact 数据，就是一些可以计量的数据和可加性数据，数据数量，金额等。
Dimension Table 用来存描述性的数据，比如说用来描述 Fact 表中的数据，如区域，销售代表，产品等。