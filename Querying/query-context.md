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

### 查询类型特定的参数
#### TopN
#### Timeseries
#### GroupBy
### 矢量化参数