# Druid 资源快速导航

## 入门与基础
* [十分钟了解 Apache Druid](https://www.ossez.com/t/apache-druid/13566) - 
  Apache Druid是一个集时间序列数据库、数据仓库和全文检索系统特点于一体的分析性数据平台。
  本文将带你简单了解Druid的特性，使用场景，技术特点和架构。这将有助于你选型数据存储方案，深入了解Druid存储，深入了解时间序列存储等。

* [Kylin、Druid、ClickHouse 核心技术对比](https://www.ossez.com/t/kylin-druid-clickhouse/13567) - 
  Druid索引结构使用自定义的数据结构，整体上它是一种列式存储结构，每个列独立一个逻辑文件（实际上是一个物理文件，在物理文件内部标记了每个列的 start 和 offset）

* [适用于大数据的开源 OLAP 系统的比较：ClickHouse，Druid 和 Pinot](https://www.ossez.com/t/olap-clickhouse-druid-pinot/13568) - 
  ClickHouse，Druid 和 Pinot 在效率和性能优化上具有约相同的“极限”。
  没有 “魔术药” 可以使这些系统中的任何一个都比其他系统快得多。在当前状态下，这些系统在某些基准测试中的性能有很大不同，这一事实并不会让您感到困惑。

* [有人说下 kudu，kylin，druid，clickhouse 的区别,使用场景么](https://www.ossez.com/t/kudu-kylin-druid-clickhouse/13569) - 
  Kylin 和 ClickHouse 都能通过 SQL 的方式在 PB 数据量级下,亚秒级(绝多数查询 5s内返回)返回 OLAP(在线分析查询) 查询结果。

* [OLAP 演进实战，Druid 对比 ClickHouse 输在哪里](https://www.ossez.com/t/olap-druid-clickhouse/13570) - 
  本文介绍 eBay 广告数据平台的基本情况，并对比分析了 ClickHouse 与 Druid 的使用特点。
  基于 ClickHouse 表现出的良好性能和扩展能力，本文介绍了如何将 eBay 广告系统从 Druid 迁移至 ClickHouse，希望能为同业人员带来一定的启发。

* [clickhouse 和 druid 实时分析性能总结](https://www.ossez.com/t/clickhouse-druid/13571) - 
  clickhouse 是俄罗斯的搜索引擎（Yandex）公司在 2016 年开源的，一款针对大数据实时分析的高性能分布式数据库，与之对应的有 hadoop 生态 hive，Vertica 和 palo。
  
## 源代码与进阶
* [Apache Druid源码导读--Google Guice DI框架](https://blog.csdn.net/yueguanghaidao/article/details/102531570)
   在大数据应用组件中，有两款OLAP引擎应用广泛，一款是偏离线处理的Kylin，另一个是偏实时的Druid。Kylin是一款国人开源的优秀离线OLAP引擎，基本上是Hadoop领域离线OLAP事实标准，在离线报表，指标分析领域应用广泛。而Apache Druid则在实时OLAP领域独领风骚，优异的性能、高可用、易扩展。
  
* [Apache Druid源码解析的一个合集](https://blog.csdn.net/mytobaby00/category_7561069.html)

* [Druid中的Extension在启动时是如何加载的](https://blog.csdn.net/mytobaby00/article/details/79857681)

* [Druid解析之管理用的接口大全](https://blog.csdn.net/mytobaby00/article/details/80088795)

* [Druid原理分析之内存池管理](https://blog.csdn.net/mytobaby00/article/details/80071101)

* [Druid源码解析之Segment](Druid源码解析之Segment)

* [Druid源码解析之Column](https://blog.csdn.net/mytobaby00/article/details/80056826)

* [Druid源码解析之HDFS存储](https://blog.csdn.net/mytobaby00/article/details/80045662)

* [Druid源码解析之Coordinator](https://blog.csdn.net/mytobaby00/article/details/80041970)

* [让Druid实现事件设备数留存数的精准计算](https://blog.csdn.net/mytobaby00/article/details/79804685)

* [在Druid中定制自己的扩展【Extension】](https://blog.csdn.net/mytobaby00/article/details/79803605)

* [Druid原理分析之“批”任务数据流转过程](https://blog.csdn.net/mytobaby00/article/details/79802776)

* [Druid原理分析之“流”任务数据流转过程](https://blog.csdn.net/mytobaby00/article/details/79801614)

* [Druid原理分析之Segment的存储结构](https://blog.csdn.net/mytobaby00/article/details/79801425)

* [Druid索引与查询原理简析](https://blog.csdn.net/mytobaby00/article/details/79800553)

* [Druid中的负载均衡策略分析](https://blog.csdn.net/mytobaby00/article/details/79860836)

* [Druid中的Kafka Indexing Service源码分析](https://blog.csdn.net/mytobaby00/article/details/79858403)

* [Druid源码分析之Query -- Sequence与Yielder](https://blog.csdn.net/mytobaby00/article/details/80103230)

* [Druid原理分析之Segment的存储结构](https://blog.csdn.net/mytobaby00/article/details/79801425)


## 优化与实践
* [快手 Druid 精确去重的设计和实现](https://www.ossez.com/t/druid/13565) - 
  快手的业务特点包括超大数据规模、毫秒级查询时延、高数据实时性要求、高并发查询、高稳定性以及较高的 Schema 灵活性要求；因此快手选择 Druid 平台作为底层架构。
  由于 Druid 原生不支持数据精确去重功能，而快手业务中会涉及到例如计费等场景，有精确去重的需求。因此，本文重点讲述如何在 Druid 平台中实现精确去重。
  另一方面，Druid 对外的接口是 json 形式 ( Druid 0.9 版本之后逐步支持 SQL ) ，对 SQL 并不友好，本文最后部分会简述 Druid 平台与 MySQL 交互方面做的一些改进。

* [基于 Apache Druid 实时分析平台在爱奇艺的实践](https://www.ossez.com/t/apache-druid/13575) - 
  爱奇艺大数据服务团队评估了市面上主流的OLAP引擎，最终选择Apache Druid时序数据库来满足业务的实时分析需求。
  本文将介绍Druid在爱奇艺的实践情况、优化经验以及平台化建设的一些思考。

* [熵简技术谈 | 实时OLAP引擎之Apache Druid：架构、原理和应用实践](https://zhuanlan.zhihu.com/p/178572172)
  本文以实时 OLAP 引擎的优秀代表 Druid 为研究对象，详细介绍 Druid 的架构思想和核心特性。在此基础上，我们介绍了熵简科技在数据智能分析场景下，针对私有化部署与实时响应优化的实践经验。

* [Apache Druid性能测评-云栖社区-阿里云](https://developer.aliyun.com/article/712725)

* [Druid在有赞的实践](https://www.cnblogs.com/oldtrafford/p/10301581.html)
  有赞作为一家 SaaS 公司，有很多的业务的场景和非常大量的实时数据和离线数据。在没有是使用 Druid 之前，一些 OLAP 场景的场景分析，开发的同学都是使用 SparkStreaming 或者 Storm 做的。用这类方案会除了需要写实时任务之外，还需要为了查询精心设计存储。带来问题是：开发的周期长；初期的存储设计很难满足需求的迭代发展；不可扩展。

* [Druid 在小米公司的技术实践](https://zhuanlan.zhihu.com/p/25593670) - 
  Druid 作为一款开源的实时大数据分析软件，自诞生以来，凭借着自己优秀的特质，逐渐在技术圈收获了越来越多的知名度与口碑，
  并陆续成为了很多技术团队解决方案中的关键一环，从而真正在很多公司的技术栈中赢得了一席之地。
  

