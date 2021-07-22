# Druid 介绍
本页面对 Druid 的基本情况进行了一些介绍和简要说明。

## 什么是 Druid

Apache Druid is a real-time analytics database designed for fast slice-and-dice analytics
("[OLAP](http://en.wikipedia.org/wiki/Online_analytical_processing)" queries) on large data sets. Druid is most often
used as a database for powering use cases where real-time ingest, fast query performance, and high uptime are important.
As such, Druid is commonly used for powering GUIs of analytical applications, or as a backend for highly-concurrent APIs
that need fast aggregations. Druid works best with event-oriented data.

Common application areas for Druid include:

- Clickstream analytics (web and mobile analytics)
- Network telemetry analytics (network performance monitoring)
- Server metrics storage
- Supply chain analytics (manufacturing metrics)
- Application performance metrics
- Digital marketing/advertising analytics
- Business intelligence / OLAP

Druid's core architecture combines ideas from data warehouses, timeseries databases, and logsearch systems. Some of
Druid's key features are:

1. **Columnar storage format.** Druid uses column-oriented storage, meaning it only needs to load the exact columns
needed for a particular query.  This gives a huge speed boost to queries that only hit a few columns. In addition, each
column is stored optimized for its particular data type, which supports fast scans and aggregations.
2. **Scalable distributed system.** Druid is typically deployed in clusters of tens to hundreds of servers, and can
offer ingest rates of millions of records/sec, retention of trillions of records, and query latencies of sub-second to a
few seconds.
3. **Massively parallel processing.** Druid can process a query in parallel across the entire cluster.
4. **Realtime or batch ingestion.** Druid can ingest data either real-time (ingested data is immediately available for
querying) or in batches.
5. **Self-healing, self-balancing, easy to operate.** As an operator, to scale the cluster out or in, simply add or
remove servers and the cluster will rebalance itself automatically, in the background, without any downtime. If any
Druid servers fail, the system will automatically route around the damage until those servers can be replaced. Druid
is designed to run 24/7 with no need for planned downtimes for any reason, including configuration changes and software
updates.
6. **Cloud-native, fault-tolerant architecture that won't lose data.** Once Druid has ingested your data, a copy is
stored safely in [deep storage](architecture.html#deep-storage) (typically cloud storage, HDFS, or a shared filesystem).
Your data can be recovered from deep storage even if every single Druid server fails. For more limited failures affecting
just a few Druid servers, replication ensures that queries are still possible while the system recovers.
7. **Indexes for quick filtering.** Druid uses [Roaring](https://roaringbitmap.org/) or
[CONCISE](https://arxiv.org/pdf/1004.0403) compressed bitmap indexes to create indexes that power fast filtering and
searching across multiple columns.
8. **Time-based partitioning.** Druid first partitions data by time, and can additionally partition based on other fields.
This means time-based queries will only access the partitions that match the time range of the query. This leads to
significant performance improvements for time-based data.
9. **Approximate algorithms.** Druid includes algorithms for approximate count-distinct, approximate ranking, and
computation of approximate histograms and quantiles. These algorithms offer bounded memory usage and are often
substantially faster than exact computations. For situations where accuracy is more important than speed, Druid also
offers exact count-distinct and exact ranking.
10. **Automatic summarization at ingest time.** Druid optionally supports data summarization at ingestion time. This
summarization partially pre-aggregates your data, and can lead to big costs savings and performance boosts.


Apache Druid是一个实时分析型数据库，旨在对大型数据集进行快速的查询分析（"[OLAP](https://en.wikipedia.org/wiki/Online_analytical_processing)"查询)。Druid最常被当做数据库来用以支持实时摄取、高性能查询和高稳定运行的应用场景，同时，Druid也通常被用来助力分析型应用的图形化界面，或者当做需要快速聚合的高并发后端API，Druid最适合应用于面向事件类型的数据。

Druid通常应用于以下场景：

* 点击流分析（Web端和移动端）
* 网络监测分析（网络性能监控）
* 服务指标存储
* 供应链分析（制造类指标）
* 应用性能指标分析
* 数字广告分析
* 商务智能 / OLAP

Druid的核心架构吸收和结合了[数据仓库](https://en.wikipedia.org/wiki/Data_warehouse)、[时序数据库](https://en.wikipedia.org/wiki/Time_series_database)以及[检索系统](https://en.wikipedia.org/wiki/Search_engine_(computing))的优势，其主要特征如下：

1. **列式存储**，Druid使用列式存储，这意味着在一个特定的数据查询中它只需要查询特定的列，这样极地提高了部分列查询场景的性能。另外，每一列数据都针对特定数据类型做了优化存储，从而支持快速的扫描和聚合。
2. **可扩展的分布式系统**，Druid通常部署在数十到数百台服务器的集群中，并且可以提供每秒数百万条记录的接收速率，数万亿条记录的保留存储以及亚秒级到几秒的查询延迟。
3. **大规模并行处理**，Druid可以在整个集群中并行处理查询。
4. **实时或批量摄取**，Druid可以实时（已经被摄取的数据可立即用于查询）或批量摄取数据。
5. **自修复、自平衡、易于操作**，作为集群运维操作人员，要伸缩集群只需添加或删除服务，集群就会在后台自动重新平衡自身，而不会造成任何停机。如果任何一台Druid服务器发生故障，系统将自动绕过损坏。 Druid设计为7*24全天候运行，无需出于任何原因而导致计划内停机，包括配置更改和软件更新。
6. **不会丢失数据的云原生容错架构**，一旦Druid摄取了数据，副本就安全地存储在[深度存储介质](Design/../chapter-1.md)（通常是云存储，HDFS或共享文件系统）中。即使某个Druid服务发生故障，也可以从深度存储中恢复您的数据。对于仅影响少数Druid服务的有限故障，副本可确保在系统恢复时仍然可以进行查询。
7. **用于快速过滤的索引**，Druid使用[CONCISE](https://arxiv.org/pdf/1004.0403.pdf)或[Roaring](https://roaringbitmap.org/)压缩的位图索引来创建索引，以支持快速过滤和跨多列搜索。
8. **基于时间的分区**，Druid首先按时间对数据进行分区，另外同时可以根据其他字段进行分区。这意味着基于时间的查询将仅访问与查询时间范围匹配的分区，这将大大提高基于时间的数据的性能。
9. **近似算法**，Druid应用了近似count-distinct，近似排序以及近似直方图和分位数计算的算法。这些算法占用有限的内存使用量，通常比精确计算要快得多。对于精度要求比速度更重要的场景，Druid还提供了精确count-distinct和精确排序。
10. **摄取时自动汇总聚合**，Druid支持在数据摄取阶段可选地进行数据汇总，这种汇总会部分预先聚合您的数据，并可以节省大量成本并提高性能。


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