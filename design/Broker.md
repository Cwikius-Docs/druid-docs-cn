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

## Broker
### 配置
对于Apache Druid Broker的配置，请参见 [Broker配置](../Configuration/configuration.md#Broker)

### HTTP
对于Broker的API的列表，请参见 [Broker API](../Operations/api.md#Broker)

### 综述

在分布式的Druid集群中，Broker是一个查询的路由进程。Broker了解所有已经发布到ZooKeeper的元数据，了解在哪些进程存在哪些段，然后将查询路由到以便它们可以正确命中的进程。Broker还将来自所有单个进程的结果集合并在一起。在启动时，Historical会在Zookeeper中注册它们自身以及它们所服务的段。

### 运行
```json
org.apache.druid.cli.Main server broker
```

### 转发查询

大多数Druid查询都包含一个interval对象，该对象指示请求数据的时间跨度。同样，Druid[段](./Segments.md)被划分为包含一定时间间隔的数据，并且段分布在集群中。假设有一个具有7个段的简单数据源，其中每个段包含一周中给定一天的数据，对数据源发出的任何查询如果超过一天的数据，都将命中多个段，这些段可能分布在多个进程中，因此，查询可能会命中多个进程。

为了确定将查询转发到哪个进程，Broker首先从Zookeeper中的信息构建一个全局视图。Zookeeper中维护有关 [Historical](./Historical.md) 和流式摄取 [Peon](./Peons.md) 过程及其所服务的段的信息。对于Zookeeper中的每个数据源，Broker都会构建一个段的时间线以及为它们提供服务的进程。当接收到针对特定数据源和间隔的查询时，Broker将对与查询数据源关联的查询间隔时间线执行查找，并检索包含所查询数据的进程。然后，Broker将查询向下转发到所选进程。

### 缓存

Broker使用具有LRU缓存失效策略的缓存，Broker缓存按段存储结果。缓存可以是每个Broker的本地缓存，也可以使用外部分布式缓存（如 [memcached](http://memcached.org/) )跨多个进程共享。每次Broker进程收到查询时，它首先将查询映射到一组段，这些段结果的子集可能已经存在于缓存中，并且可以直接从缓存中提取结果。对于缓存中不存在的任何段结果，Broker将查询转发到Historical。一旦Historical返回其结果，Broker将把这些结果存储在缓存中。实时段从不被缓存，因此对实时数据的请求总是被转发到实时进程。实时数据一直在变化，缓存结果是不可靠的。