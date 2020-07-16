
## 各个大厂对Druid的优化与实践类文章合集

1. [快手 Druid 精确去重的设计和实现](https://www.infoq.cn/article/YdPlYzWCCQ5sPR_iKtVz)
   
   快手的业务特点包括超大数据规模、毫秒级查询时延、高数据实时性要求、高并发查询、高稳定性以及较高的 Schema 灵活性要求；因此快手选择 Druid 平台作为底层架构。由于 Druid 原生不支持数据精确去重功能，而快手业务中会涉及到例如计费等场景，有精确去重的需求。因此，本文重点讲述如何在 Druid 平台中实现精确去重。另一方面，Druid 对外的接口是 json 形式 ( Druid 0.9 版本之后逐步支持 SQL ) ，对 SQL 并不友好，本文最后部分会简述 Druid 平台与 MySQL 交互方面做的一些改进。

   [原文链接](https://www.infoq.cn/article/YdPlYzWCCQ5sPR_iKtVz)