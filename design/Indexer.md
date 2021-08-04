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

## Indexer

> [!WARNING]
> 索引器是一个可选的和[实验性](../development/experimental.md)的功能, 其内存管理系统仍在开发中，并将在以后的版本中得到显著增强。

Apache Druid索引器进程是MiddleManager + Peon任务执行系统的另一种可替代选择。索引器在单个JVM进程中作为单独的线程运行任务，而不是为每个任务派生单独的JVM进程。

与MiddleManager + Peon系统相比，Indexer的设计更易于配置和部署，并且能够更好地实现跨任务的资源共享。

### 配置
对于Apache Druid Indexer进程的配置，请参见 [Indexer配置](../configuration/human-readable-byte.md#Indexer)

### HTTP
Indexer进程与[MiddleManager](../operations/api.md#MiddleManager)共用API

### 运行
```json
org.apache.druid.cli.Main server indexer
```

### 任务资源共享

以下资源在索引器进程内运行的所有任务中共享。

**查询资源**
查询处理线程和缓冲区在所有任务中共享。索引器将为来自所有任务共享的单个端点的查询提供服务。

如果启用了[查询缓存](../configuration/human-readable-byte.md)，则查询缓存也将在所有任务中共享。

**服务端HTTP线程**
索引器维护两个大小相等的HTTP线程池。

一个池专门用于Overlord和Indexer之间的任务控制消息（"会话处理程序线程"）, 另一个池用于处理所有其他HTTP请求。

池的大小由 `druid.server.http.numThreads` 配置配置（例如，如果设置为10，则将有10个会话处理程序线程和10个非会话处理程序线程）。

除了这两个池之外，还为查找处理分配了两个单独的线程。如果不使用查找，则不会使用这些线程。

**内存共享**
索引器使用 `druid.worker.globalIngestionHeapLimitBytes` 配置对其运行的所有任务施加全局堆限制。

此全局限制平均分配给 `druid.worker.capacity` 配置的任务槽数。

要应用每个任务堆的限制，索引器将覆盖任务优化配置(task tuning)中的 `maxBytesInMemory`（即忽略默认值或任何用户配置的值）。`maxRowsInMemory` 也将被重写为本质上不受限制的值：索引器不支持行限制。

默认情况下，`druid.worker.globalIngestionHeapLimitBytes` 设置为可用JVM堆的1/6。选择此默认值是为了在使用MiddleManager/Peon系统时与任务优化配置中 `maxBytesInMemory` 的默认值对齐，该系统也是JVM堆的1/6。

堆内存中保留的行的峰值使用量与任务优化配置中的 `maxBytesInMemory` 和 `maxPendingPersistent` 属性之间的交互有关。当任务在堆中保留的行数据量达到 `maxBytesInMemory` 指定的限制时，任务将持久化堆中的行数据。在持久化任务启动后，任务可以在持久化任务运行时再次摄取行数据的`maxBytesInMemory`字节。

这意味着行数据的堆使用峰值可以达到 `maxBytesInMemory *（2 + maxPendingResistent）`。 `maxPendingPersistent` 的默认值为0，允许1一个持久化任务与摄取工作同时运行。

堆的其余部分保留用于查询处理、段持久/合并操作以及其他堆使用。

**并发段持久/合并限制**
为了帮助减少峰值内存使用，索引器对所有正在运行的任务中并发的段持久/合并操作的数量进行了限制。

默认情况下，并发持久性/合并操作的数量限制为 `(druid.worker.capacity/2)`，四舍五入。可以使用 `druid.worker.numConcurrentMerges` 属性配置此限制。

### 当前限制
使用索引器时，当前不支持单独的任务日志；所有任务日志消息都将记录在索引器进程日志中。

索引器当前对每个任务施加相同的内存限制。在以后的版本中，将删除每个任务的内存限制，并且只应用全局限制。同时合并的限制也将被删除。

在以后的版本中，将动态管理每个任务的内存使用情况。请参阅 [https://github.com/apache/druid/issues/7900](https://github.com/apache/druid/issues/7900) 以了解有关索引器未来增强功能的详细信息。

