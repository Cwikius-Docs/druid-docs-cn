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

## 查询执行

> [!WARNING]
> 本文档描述了Druid如何执行 [原生查询](#)，但是由于 [Druid SQL](druidsql.md) 查询被转换为原生查询，因此本文档也适用于SQL运行时。有关如何将SQL查询转换为原生查询的信息，请参阅 [SQL查询转换](druidsql.md#查询转换) 页面。

Druid的查询执行方法因查询的 [数据源类型](#数据源类型) 而异。

### 数据源类型
#### `table`

直接在 [表数据源](datasource.md#table) 上操作的查询使用由Broker进程引导的**分散-聚集**方法执行。过程如下：

1. Broker根据 `"interval"` 参数确定哪些 [段](../design/segments.md) 与查询相关。段总是按时间划分的，因此任何间隔与查询间隔重叠的段都可能是相关的。
2. 如果输入数据使用 [`single_dim` partitionsSpec](../DataIngestion/native.md#partitionsSpec) 按范围分区，并且过滤器与用于分区的维度匹配，则Broker还可以根据 `"filter"` 进一步修剪段列表。
3. Broker在删除了查询的段列表之后，将查询转发到当前为这些段提供服务的数据服务器（如Historical或者运行在MiddleManagers的任务）。
4. 对于除 [Scan](scan.md) 之外的所有查询类型，数据服务器并行处理每个段，并为每个段生成部分结果。所做的具体处理取决于查询类型。如果启用了 [查询缓存](querycached.md)，则可以缓存这些部分结果。对于Scan查询，段由单个线程按顺序处理，结果不被缓存。
5. Broker从每个数据服务器接收部分结果，将它们合并到最终结果集中，并将它们返回给调用方。对于Timeseries和Scan查询，以及没有排序的GroupBy查询，Broker可以以流式方式执行此操作。否则，Broker将在返回任何内容之前完全计算结果集。

#### `lookup`

直接对 [Lookup数据源(没有联接)](datasource.md#lookup) 进行操作的查询使用查询的本地副本在接收查询的Broker上执行。所有注册的Lookup表都预加载到Broker的内存中。查询运行单线程。

使用Lookup作为联接的右端输入的查询的执行是以依赖于其"base"（最左下角）数据源的方式执行的，如下面的 [join](#join) 部分所述。

#### `union`

直接在 [union数据源](datasource.md#union) 上操作的查询在Broker上被拆分为属于union的每个表的单独查询。这些查询中的每一个都单独运行，Broker将它们的结果合并在一起。

#### `inline`

直接在 [内联数据源](#inline) 上操作的查询在接收查询的Broker上执行。查询运行单线程。

使用内联数据源作为联接的右端输入的查询的执行方式取决于它们的"base"（最左下角）数据源，如下面的 [join](#join) 部分所述。

#### `query`

[query数据源] 是子查询, 每个子查询都被当作它自己的查询来执行, 结果会返回给Broker。然后，Broker继续处理查询的其余部分，就像子查询被内联数据源替换一样。

在大多数情况下，子查询结果在其余查询继续之前在Broker上的内存中完全缓冲，这意味着子查询按顺序执行。以这种方式在给定查询的所有子查询中缓冲的行总数不能超过 [druid.server.http.maxSubQueryRows](../Configuration/configuration.md) 属性。

有一个例外：如果外部查询和所有子查询都是 [groupBy](groupby.md) 类型，则可以以流式方式处理子查询结果，并且 `druid.server.http.maxSubQueryRows` 限制不适用。

#### `join`

使用广播hash-join方法处理 [联接数据源](datasource.md#join)。

1. Broker执行输入join的任何子查询，如 [`query`](#query)部分所述，并用inline数据源替换它们。
2. Broker将连接树（如果存在）展平为"基本"数据源（最左下角的一个）和其他叶数据源（其余部分）。
3. 使用与基本数据源相同结构的查询执行将单独继续执行。如果基数据源是一个表，则像往常一样根据"interval"修剪段，并通过将查询并行地转发到所有相关的数据服务器，在集群上执行查询。如果基数据源是Lookup或Join数据源（包括将内联子查询作为结果的内联数据源），则查询将在Broker本身上执行。基查询不能是Union，因为当前不支持Union作为Join的输入。
4. 在开始处理基数据源之前，将执行查询的服务器首先检查所有非基叶数据源，以确定是否需要为即将到来的哈希联接生成新的哈希表。目前，Lookup不需要构建新的哈希表（因为它们是预加载的），但Inline数据源需要。
5. 使用与基本数据源相同结构的查询执行将单独继续执行, 但有一个附加条件：在处理基本数据源时，Druid服务器将使用从其他连接输入构建的哈希表来逐行生成联接结果，查询引擎将对联接的行而不是基本行进行操作。