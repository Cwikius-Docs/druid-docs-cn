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

### Router

> [!WARNING]
> Router是一个可选的和实验性的特性，因为它在Druid集群架构中的推荐位置仍在不断发展。然而，它已经在生产中经过了测试，并且承载了强大的Druid控制台，所以您应该放心地部署它。

Apache Druid Router用于将查询路由到不同的Broker。默认情况下，Broker根据 [规则](../Operations/retainingOrDropData.md) 设置路由查询。例如，如果将最近1个月的数据加载到一个 `热集群` 中，则可以将最近一个月内的查询路由到一组专用的Broker,超出此范围的查询将路由到另一组Broker。该设置的主要功能是为了提供查询隔离，以便对较重要数据的查询不会受到对较不重要数据的查询的影响。

出于查询路由的目的，如果您有一个TB数据规模的Druid集群，您应该只使用Router进程。

除了查询路由，Router还运行 [Druid控制台](../Operations/manageui.md), 一个用于数据源、段、任务、数据进程（Historical和MiddleManager）和Coordinator动态配置的管理UI。用户还可以在控制台中运行SQL和本地Druid查询。

### 配置

对于Apache Druid Router的配置，请参见 [Router 配置](../Configuration/configuration.md#Router)

### HTTP

对于Router的API列表，请参见 [Router API](../Operations/api.md#Router)

### 运行

```json
org.apache.druid.cli.Main server router
```

### 作为管理代理的Router

Router可以配置为将转发请求到活跃的Coordinator和Overlord。 该功能在非活跃 -> 活跃的Coordinator和Overlord的HTTP重定向机制无法正常工作时的情况下(服务器位于负载平衡器后面，重定向中使用的主机名只能在内部解析等)设置高可用集群很有帮助。

**开启管理代理**

要启用此功能，请在Router的 `runtime.properties` 中设置以下内容：

```json
druid.router.managementProxy.enabled=true
```

**管理代理路由**

管理代理支持隐式和显式路由。隐式路由是根据Druid API路径从原始请求路径来确定目标的路由。对于Coordinator，约定是 `/druid/Coordinator/*`。 对于Overlord，约定是 `/druid/indexer/*`。由于使用管理代理不需要修改API请求，只需要向Router而不是Coordinator或Overlord发出请求，所以是非常方便的。大多数Druid API请求都可以隐式路由。

显式路由是指到Router的请求包含路径前缀的路由，该前缀指示请求应路由到哪个进程。对于Coordinator，这个前缀是 `/proxy/coordinator`；对于Overlord，这个前缀是 `/proxy/overlord`。这对于目标不明确的API调用是必需的, 例如，所有Druid进程上都存在 `/status` API，因此需要使用显式路由来指示代理目标。

汇总如下：

| 请求路由 | 目标 | 重写路由 | 示例 |
| - | - | - | - |
| `/druid/coordinator/*` | Coordinator | `/druid/coordinator/*` | `router:8888/druid/coordinator/v1/datasources` -> `coordinator:8081/druid/coordinator/v1/datasources` |
| `/druid/indexer/*` | Overlord | `/druid/indexer/*` | `router:8888/druid/indexer/v1/task` -> `overlord:8090/druid/indexer/v1/task`|
| `/proxy/coordinator/*` | Coordinator | `/*` | `router:8888/proxy/coordinator/status` -> `coordinator:8081/status` |
| `/proxy/overlord/*` | Overlord | `/*` | `router:8888/proxy/overlord/druid/indexer/v1/isLeader` -> `overlord:8090/druid/indexer/v1/isLeader` |

### Router策略
Router有一个可配置的策略列表，用于选择将查询路由到哪个Broker。策略的顺序很重要，因为一旦策略条件匹配，就会选择一个Broker。

**timeBoundary**
```json
{
  "type":"timeBoundary"
}
```

包含这个策略的话意味着所有的 **timeRange** 查询将全部路由到高优先级的Broker

**priority**
```json
{
  "type":"priority",
  "minPriority":0,
  "maxPriority":1
}
```

优先级设置为小于 `minPriority` 的查询将路由到最低优先级Broker, 优先级设置为大于 `maxPriority` 的查询将路由到最高优先级Broker。默认情况下，`minPriority` 为0，`maxPriority` 为1。使用这些默认值的时候，如果发送优先级为0（默认查询优先级为0）的查询，则查询将跳过优先级选择逻辑。

**JavaScript**
允许使用JavaScript函数定义任意路由规则。将配置和要执行的查询传递给函数，并返回它应该路由到的层（tier），或者对于默认层返回null。

示例：将包含三个以上聚合器的查询发送到最低优先级Broker的函数：
```json
{
  "type" : "javascript",
  "function" : "function (config, query) { if (query.getAggregatorSpecs && query.getAggregatorSpecs().size() >= 3) { var size = config.getTierToBrokerMap().values().size(); if (size > 0) { return config.getTierToBrokerMap().values().toArray()[size-1] } else { return config.getDefaultBrokerServiceName() } } else { return null } }"
}
```

> [!WARNING]
> 默认情况下禁用基于JavaScript的功能。有关使用Druid的JavaScript功能的指南，包括如何启用它的说明，请参阅[Druid JavaScript编程指南](../Development/JavaScript.md)。

### Avatica查询平衡

具有给定连接ID的所有Avatica JDBC请求都必须路由到同一个Broker，因为Druid Broker之间不共享连接状态。

为了实现这一点，Druid提供了两个内置的平衡器，它们分别使用请求的连接ID的集合哈希和一致性哈希来将请求分配给Broker。

请注意，当使用多个Router时，所有Router应具有相同的平衡器配置，以确保它们做出相同的路由决策。

**集合哈希平衡器**

这个平衡器使用Avatica请求的连接ID上的 [集合哈希](https://en.wikipedia.org/wiki/Rendezvous_hashing) 来将请求分配给Broker。

要使用此平衡器，请指定以下属性：
```
druid.router.avatica.balancer.type=consistentHash
```
如果 `druid.router.avatica.balancer` 配置项没有被设置，Router将同样默认使用集合哈希平衡器。

**一致性哈希平衡器**

这个平衡器使用Avatica请求的连接ID上的 [集合哈希](https://en.wikipedia.org/wiki/Consistent_hashing) 来将请求分配给Broker。

要使用此平衡器，请指定以下属性：
```
druid.router.avatica.balancer.type=consistentHash
```
这是为实验目的而提供的非默认实现。一致哈希器在初始化和Brokers更改时的设置时间较长，但在使用5个Broker进行测试时，它的Broker分配时间比集合哈希器快。这两种实现的基准已经在 `ConsistentHasherBenchmark` 和 `RendezvousHasherBenchmark` 中提供。一致哈希器还需要锁定，而集合哈希器不需要。

### 生产环境配置示例

在本例中，我们的生产集群中有两个层：`hot`层和 `默认层(_default_tier)`。对 `hot` 层的查询通过 `broker-hot` 路由，对 `默认层` 的查询通过 `broker-cold` 路由。如果发生任何异常或网络问题，查询将被路由到 `broker-cold`。在我们的示例中，我们运行的是一个c3.2xlarge EC2实例。我们假设 `common.runtime.properties` 已经存在。

JVM设置：

```json
-server
-Xmx13g
-Xms13g
-XX:NewSize=256m
-XX:MaxNewSize=256m
-XX:+UseConcMarkSweepGC
-XX:+PrintGCDetails
-XX:+PrintGCTimeStamps
-XX:+UseLargePages
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/mnt/galaxy/deploy/current/
-Duser.timezone=UTC
-Dfile.encoding=UTF-8
-Djava.io.tmpdir=/mnt/tmp

-Dcom.sun.management.jmxremote.port=17071
-Dcom.sun.management.jmxremote.authenticate=false
-Dcom.sun.management.jmxremote.ssl=false
```

Runtime.properties:
```json
druid.host=#{IP_ADDR}:8080
druid.plaintextPort=8080
druid.service=druid/router

druid.router.defaultBrokerServiceName=druid:broker-cold
druid.router.coordinatorServiceName=druid:coordinator
druid.router.tierToBrokerMap={"hot":"druid:broker-hot","_default_tier":"druid:broker-cold"}
druid.router.http.numConnections=50
druid.router.http.readTimeout=PT5M

# Number of threads used by the Router proxy http client
druid.router.http.numMaxThreads=100

druid.server.http.numThreads=100
```