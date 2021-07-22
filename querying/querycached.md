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

## 查询缓存

Apache Druid支持两种级别的结果缓存，分别是：段缓存和整个查询结果的缓存。缓存数据既可以存储在本地JVM堆内存中，也可以存储在一个外部的分布式kv存储中。在所有场景中，Druid的缓存是查询结果的缓存，唯一的差别是特定段的*部分结果*还是全部结果。 在所有情况下，只要数据发生变化，缓存即失效，Druid永远不会返回过期的结果。

段级缓存中即使某些底层段是可变的并且正在进行实时摄取也允许使用缓存。在这种情况下，Druid可能会缓存不可变历史段的查询结果，同时重新计算每个查询的实时段的结果。在这种情况下，连续的缓存是没有用的，因为它的结果是无效的。

段级缓存需要Druid在每次查询时合并每个段的结果，即使每个数据段的缓存结果都是从Druid缓存读取时。因此，如果不存在由于实时摄取而导致的失效的问题，则整个查询结果级缓存可以更高效。

### 使用和填充缓存

所有缓存都有一对参数，用于控制单个查询如何与缓存交互的行为，"use"缓存参数和"populate"缓存参数。必须通过[运行时属性(runtime properties)](../Configuration/configuration.md)在服务级别启用这些设置以利用缓存，但可以通过在[查询上下文(query context)](query-context.md)中设置它们来控制每个查询。"use"参数显然控制查询是否将使用缓存结果, "populate"参数控制查询是否更新缓存的结果。这些是单独的参数，目的是使得不常见数据(例如大型报表或非常旧的数据)的查询不会污染被其他查询重用的缓存结果。

### Brokers上边查询缓存

Broker同时支持段级缓存与全部查询结果级缓存。 段级缓存通过参数`useCache`和`populateCache`来控制。全部结果级缓存通过参数`useResultLevelCache`和`populateResultLevelCache`来控制，这些参数都在[运行时属性(runtime properties)](../Configuration/configuration.md)中的 `druid.broker.cache.*`

对于小集群，在Broker上启用段级缓存比在Historical上启用查询缓存的结果更快。对于较小的生产集群（<5台服务器），建议使用此设置。对于大型生产集群，**不建议**在Broker上填充段级缓存，因为当属性`druid.broker.cache.populateCache`设置为`true`（并且查询上下文参数`populateCache`未设置为`false`），则将会按段返回Historical的结果，Historical将无法进行任何本地结果合并。这会削弱Druid集群的扩展能力。

### Historical上边查询缓存

Historical仅仅支持段级缓存。段级缓存通过上下文参数`useCache`和`populateCache`以及[运行时属性(runtime properties)](../Configuration/configuration.md)中的 `druid.historical.cache.*`来控制。

大型集群应该仅仅在Historical上（非Broker）启用段级缓存填充，这可以避免在Broker上合并所有的查询结果。在Historical上而非Broker上启用缓存填充使得Historical可以在自己本地进行结果合并，然后将较少的数据传递给Broker。

### 摄取任务上的查询缓存

任务执行进程，如Peon进程或者实验性的Indexer进程仅仅支持段级缓存。段级缓存通过上下文参数`useCache`和`populateCache`以及[运行时属性(runtime properties)](../Configuration/configuration.md)中的 `druid.realtime.cache.*`来控制。

大型集群应该仅仅在任务执行进程上（非Broker）启用段级缓存填充，这可以避免在Broker上合并所有的查询结果。在任务执行进程上而非Broker上启用缓存填充使得任务执行进程可以在自己本地进行结果合并，然后将较少的数据传递给Broker。

注意：任务执行进程仅仅支持将段缓存在本地，例如 `caffeine`缓存。 存在此限制是因为这些缓存是在摄取任务生成的中间部分段级别存储结果，这些中间部分段在任务副本中不一定相同，因此任务执行进程将忽略`memcached`等远程缓存类型。