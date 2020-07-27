<!-- toc -->
## 查询上下文
### 通用参数

查询上下文用于各种查询配置参数。可以通过以下方式指定查询上下文参数：

* 对于[Druid SQL](druidsql.md), 上下文参数要么是通过命名为 `context`的JSON对象来调HTTP POST接口提供，要么是作为JDBC连接的属性。
* 对于[原生查询](makeNativeQueries.md), 上下文参数通过命名为`context`的JSON对象来提供。

以下参数可以使用在所有的查询类型中：

| 属性 | 默认值 | 描述 |
|-|-|-|
| timeout | `druid.server.http.defaultQueryTimeout` | 以毫秒为单位的查询超时，超过该时间未完成的查询将被取消。 0意味着`no timeout`。 可以在 [Broker配置中](../Configuration/configuration.md#broker)设置默认的超时时间 |
| priority | `0` | 查询优先级。 具有更高优先级的查询将会优先获得计算资源 |
| lane | `null` | 查询通道，用于控制查询类的使用限制。 详情查看[Broker配置](../Configuration/configuration.md#broker)|
| queryId | 自动生成 | 对于本次查询的一个唯一标识符。 如果一个查询ID被设置或者显式指定，该ID可以用来取消一个查询 |
| useCache | `true` | 标识是否为此查询利用查询缓存。当设置为false时，它将禁止从此查询缓存中读取。当设置为true时，Apache Druid使用`druid.broker.cache.useCache`或`druid.historical.cache.useCache`确定是否从查询缓存中读取 |
| populateCache | `true` | 标识是否将查询结果保存到查询缓存。主要用于调试。当设置为false时，它禁止将此查询的结果保存到查询缓存中。当设置为true时，Druid使用`druid.broker.cache.populateCache`或`druid.historical.cache.populateCache` 来确定是否将此查询的结果保存到查询缓存 |
| useResultLevelCache | `true` | 标识是否为此查询利用结果级缓存的。当设置为false时，它将禁止从此查询缓存中读取。当设置为true时，Druid使用`druid.broker.cache.useResultLevelCache`来确定是否从结果级查询缓存中读取 |
| populateResultLevelCache | `true` | 标识是否将查询结果保存到结果级缓存。主要用于调试。当设置为false时，它禁止将此查询的结果保存到查询缓存中。当设置为true时，Druid使用`druid.broker.cache.populateResultLevelCache`来确定是否将此查询的结果保存到结果级查询缓存 |
| bySegment | `false` | 返回"by segment"结果。主要用于调试，将其设置为true将返回与它们来自的数据段关联的结果 |
| finalize | `true` | 标识是否"finalize"聚合结果。主要用于调试。例如，当该标志设置为false时，`hyperUnique`聚合器将返回完整的HyperLogLog草图，而不是估计的基数 |
| maxScatterGatherBytes | `druid.server.http.maxScatterGatherBytes` | 从数据进程（如Historical和Realtime进程）收集的用于执行查询的最大字节数。此参数可用于进一步减少查询时的`maxScatterGatherBytes`限制。有关更多详细信息，请参阅[Broker配置](../Configuration/configuration.md#broker)。 |
| maxQueuedBytes | `druid.broker.http.maxQueuedBytes` | 在对数据服务器的通道施加反压力之前，每个查询排队的最大字节数。与`maxScatterGatherBytes`类似，但与该配置不同，此配置将触发反压力而不是查询失败。0表示禁用 |
| serializeDateTimeAsLong | `false` | 如果为true，则在Broker返回的结果和Broker与计算进程之间的数据传输中序列化DateTime |
| serializeDateTimeAsLongInner | `false` | 如果为true，则在Broker和计算进程之间的数据传输中，DateTime被序列化 |
| enableParallelMerge | `false` | 启用在Broker上进行并行结果合并。注意：该配置设置为`true`时`druid.processing.merge.useParallelMergePool`参数必须启用。有关更多详细信息，请参阅[Broker配置](../Configuration/configuration.md#broker) |
| parallelMergeParallelism | `druid.processing.merge.pool.parallelism` | 在Broker上用于并行结果合并的最大并行线程数。有关更多详细信息，请参阅[Broker配置](../Configuration/configuration.md#broker) |
| parallelMergeInitialYieldRows | `druid.processing.merge.task.initialYieldNumRows` | 有关更多详细信息，请参阅[Broker配置](../Configuration/configuration.md#broker) |
| parallelMergeSmallBatchRows | `druid.processing.merge.task.smallBatchNumRows` | 有关更多详细信息，请参阅[Broker配置](../Configuration/configuration.md#broker) |
| useFilterCNF | `false` | 如果为true，Druid将尝试将查询过滤器转换为合取范式（CNF）。在查询处理期间，可以通过与符合条件的过滤器匹配的所有值的位图索引相交来预过滤列，这通常会大大减少需要扫描的原始行数。但是这种效果只发生在顶层过滤器，或者顶层“and”过滤器的单个子句中。因此，在预过滤期间，CNF中的过滤器可能更有可能在字符串列上使用大量位图索引。但是，使用此设置时应格外小心，因为它有时会对性能产生负面影响，并且在某些情况下，计算过滤器的CNF的操作可能会非常昂贵。如果可能的话，我们建议手动调整过滤器以生成一个最佳的表单，或者至少通过实验验证使用此参数实际上可以提高查询性能而不会产生不良影响 |

### 查询类型特定的参数

另外，一些特定的查询类型提供了特定的上下文参数。

#### TopN

| 属性 | 默认值 | 描述 |
|-|-|-|
| minTopNThreshold | `1000` | 返回每个段的 `minTopNThreshold` 局部结果，以便合并以确定全局topN。 |

#### Timeseries

| 属性 | 默认值 | 描述 |
|-|-|-|
| skipEmptyBuckets | `false` | 禁用Timeseries查询中零填充行为，因此只返回包含结果的bucket。|

#### GroupBy

GroupBy的[查询上下文参数](groupby.md)可以专门查看GroupBy查询页

### 矢量化参数

GroupBy和Timeseries查询类型可以在*矢量化*模式下运行，通过一次处理多个行来加快查询执行。并非所有查询都可以矢量化。特别是矢量化目前有以下要求：
* 所有查询级筛选器必须能够在位图索引上运行，或者必须提供矢量化的行匹配器。其中包括"selector"、"bound"、"in"、"like"、"regex"、"search"、"and"、"or"和"not"
* 筛选聚合器中的所有筛选器都必须提供矢量化的行匹配器
* 所有聚合器必须提供矢量化实现。其中包括"count"、"doubleSum"、"floatSum"、"longSum"、"hyperUnique"和"filtered"
* 没有虚拟列
* 对于GroupBy：所有维度spec都必须是"default"（没有提取函数或过滤的维度spec）
* 对于GroupBy：没有多值维度
* 对于时间序列：没有"降序"顺序
* 只有不可变的片段（不是实时的）
* 仅[表数据源](datasource.md)（不包括联接、子查询、查找或内联数据源）

其他查询类型（如TopN、Scan、Select和Search）忽略"vectorize"参数，将在不进行矢量化的情况下执行。这些查询类型将忽略"vectorize"参数，即使它被设置为"force"。

| 属性 | 默认值 | 描述 |
|-|-|-|
| vectorize | `true` | 启用或者禁用矢量化查询执行。 可能的值有 `false`(禁用), `true`（如果可能则启用，否则禁用）和 `force`(已启用，无法矢量化的groupBy和Timeseries查询将会失败)。"force"设置的目的是帮助测试，在生产中通常不起作用（因为实时段永远不能通过矢量化执行进行处理，因此对实时数据的任何查询都将失败）。设置该值将覆盖 `druid.query.vectorize` |
| vectorSize | `512` | 设置一个特定查询的行数批量大小，设置该值将覆盖 `druid.query.vectorSize` 的值 |
