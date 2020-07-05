<!-- toc -->
## Joins

Druid有两个与数据连接相关的特性：

1. [join](datasource.md#join) 运算符。可以在原生查询中使用 [join数据源](datasource.md#join) ，或者在Druid SQL中使用 [join操作符](druidsql.md) 。有关join在Druid中如何工作的信息，请参阅 [join数据源](datasource.md#join)文档。
2. [查询时Lookup](lookups.md)，简单的键到值映射。所有涉及查询的服务器上都预加载了这些查询，可以使用或不使用显式join运算符进行访问。有关更多详细信息，请参阅 [Lookup](lookups.md) 文档。
   
只要可能，为了获得最佳性能，最好在查询时避免使用Join，通常可以在数据加载到Druid之前通过数据处理阶段来完成。但是，在某些情况下，尽管存在性能开销，但joins或lookups是可用的最佳解决方案，包括：

* fact-to-dimension的情况：您需要在初始摄取之后更改维度值，并且无法重新导入来执行此操作。在这种情况下，可以使用维度表的Lookup。
* 查询需要对子查询进行join或filter。