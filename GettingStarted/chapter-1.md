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

### Druid是什么

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

### 什么场景下应该使用Druid

许多公司都已经将Druid应用于多种不同的应用场景，详情可查看[Powered by Apache Druid](https://druid.apache.org/druid-powered)页面。

如果您的使用场景符合以下的几个特征，那么Druid是一个非常不错的选择：

* 数据插入频率比较高，但较少更新数据
* 大多数查询场景为聚合查询和分组查询（GroupBy），同时还有一定得检索与扫描查询
* 将数据查询延迟目标定位100毫秒到几秒钟之间
* 数据具有时间属性（Druid针对时间做了优化和设计）
* 在多表场景下，每次查询仅命中一个大的分布式表，查询又可能命中多个较小的lookup表
* 场景中包含高基维度数据列（例如URL，用户ID等），并且需要对其进行快速计数和排序
* 需要从Kafka、HDFS、对象存储（如Amazon S3）中加载数据

如果您的使用场景符合以下特征，那么使用Druid可能是一个不好的选择：

* 根据主键对现有数据进行低延迟更新操作。Druid支持流式插入，但不支持流式更新（更新操作是通过后台批处理作业完成）
* 延迟不重要的离线数据系统
* 场景中包括大连接（将一个大事实表连接到另一个大事实表），并且可以接受花费很长时间来完成这些查询

---

广告时间：笔者给大家强烈推荐一个羊毛神器，找券打折、美食电影、加油打车、淘宝京东啥都有，扫码下载注册后就会发现相当好用。

![](../img/mgad1.png)

---
