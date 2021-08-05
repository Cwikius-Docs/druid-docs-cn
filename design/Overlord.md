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

## Overload进程
### 配置
对于Apache Druid的Overlord进程配置，详见 [Overlord配置](../configuration/human-readable-byte.md#Overlord)

### HTTP
对于Overlord的API接口，详见 [Overlord API](../operations/api-reference.md#Overlord)

### 综述
Overlord进程负责接收任务、协调任务分配、创建任务锁并将状态返回给调用方。Overlord可以配置为本地模式运行或者远程模式运行（默认为本地）。在本地模式下，Overlord还负责创建执行任务的Peon， 在本地模式下运行Overlord时，还必须提供所有MiddleManager和Peon配置。本地模式通常用于简单的工作流。在远程模式下，Overlord和MiddleManager在不同的进程中运行，您可以在不同的服务器上运行每一个进程。如果要将索引服务用作所有Druid索引的单个端点，建议使用此模式。

### Overlord控制台
Druid Overlord公开了一个web GUI，用于管理任务和worker。有关详细信息，请参阅[Overlord控制台](../operations/manageui.md)。

### worker黑名单
如果一个MiddleManager的任务失败超过阈值，Overlord会将这些MiddleManager列入黑名单。不超过20%的MiddleManager可以被列入黑名单，被列入黑名单的MiddleManager将定期被列入白名单。

以下变量可用于设置阈值和黑名单超时：
```json
druid.indexer.runner.maxRetriesBeforeBlacklist
druid.indexer.runner.workerBlackListBackoffTime
druid.indexer.runner.workerBlackListCleanupPeriod
druid.indexer.runner.maxPercentageBlacklistWorkers
```

### 自动缩放
目前采用的自动缩放机制与我们的部署基础设施紧密耦合，但框架应该适用于其他实现。我们对现有机制的新实现或扩展高度开放。在我们自己的部署中，MiddleManager进程是Amazon AWS EC2节点，它们被设置为在galaxy环境中注册自己。

如果启用了自动缩放，则当任务处于挂起状态太长时间时，可能会添加新的MiddleManagers。如果MiddleManager在一段时间内没有运行任何任务，则可能会被终止。

