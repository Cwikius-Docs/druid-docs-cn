
## 各个大厂对Druid的优化与实践类文章合集

1. [快手 Druid 精确去重的设计和实现](https://www.infoq.cn/article/YdPlYzWCCQ5sPR_iKtVz)
   
   快手的业务特点包括超大数据规模、毫秒级查询时延、高数据实时性要求、高并发查询、高稳定性以及较高的 Schema 灵活性要求；因此快手选择 Druid 平台作为底层架构。由于 Druid 原生不支持数据精确去重功能，而快手业务中会涉及到例如计费等场景，有精确去重的需求。因此，本文重点讲述如何在 Druid 平台中实现精确去重。另一方面，Druid 对外的接口是 json 形式 ( Druid 0.9 版本之后逐步支持 SQL ) ，对 SQL 并不友好，本文最后部分会简述 Druid 平台与 MySQL 交互方面做的一些改进。

   [原文链接](https://www.infoq.cn/article/YdPlYzWCCQ5sPR_iKtVz)

2. [基于ApacheDruid的实时分析平台在爱奇艺的实践](https://www.sohu.com/a/398880575_315839)

   爱奇艺大数据服务团队评估了市面上主流的OLAP引擎，最终选择Apache Druid时序数据库来满足业务的实时分析需求。本文将介绍Druid在爱奇艺的实践情况、优化经验以及平台化建设的一些思考

   [原文链接](https://www.sohu.com/a/398880575_315839)

3. [熵简技术谈 | 实时OLAP引擎之Apache Druid：架构、原理和应用实践](https://zhuanlan.zhihu.com/p/178572172)
   
   本文以实时 OLAP 引擎的优秀代表 Druid 为研究对象，详细介绍 Druid 的架构思想和核心特性。在此基础上，我们介绍了熵简科技在数据智能分析场景下，针对私有化部署与实时响应优化的实践经验。

   [原文链接](https://zhuanlan.zhihu.com/p/178572172)

4. [Apache Druid性能测评-云栖社区-阿里云](https://developer.aliyun.com/article/712725)

    [原文链接](https://developer.aliyun.com/article/712725)
    
5. [Druid在有赞的实践](https://www.cnblogs.com/oldtrafford/p/10301581.html)
   
   有赞作为一家 SaaS 公司，有很多的业务的场景和非常大量的实时数据和离线数据。在没有是使用 Druid 之前，一些 OLAP 场景的场景分析，开发的同学都是使用 SparkStreaming 或者 Storm 做的。用这类方案会除了需要写实时任务之外，还需要为了查询精心设计存储。带来问题是：开发的周期长；初期的存储设计很难满足需求的迭代发展；不可扩展。

   [原文链接](https://www.cnblogs.com/oldtrafford/p/10301581.html)