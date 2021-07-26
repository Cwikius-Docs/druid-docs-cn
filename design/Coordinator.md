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

## Coordinator进程
### 配置
对于Apache Druid的Coordinator进程配置，详见 [Coordinator配置](../Configuration/configuration.md#Coordinator)

### HTTP
对于Coordinator的API接口，详见 [Coordinator API](../operations/api.md#Coordinator)

### 综述
Druid Coordinator程序主要负责段管理和分发。更具体地说，Druid Coordinator进程与Historical进程通信，根据配置加载或删除段。Druid Coordinator负责加载新段、删除过时段、管理段复制和平衡段负载。

Druid Coordinator定期运行，每次运行之间的时间是一个可配置的参数。每次运行Druid Coordinator时，它都会在决定要采取的适当操作之前评估集群的当前状态。与Broker和Historical进程类似，Druid Coordinator维护了一个用于当前集群信息的Zookeeper集群连接。Coordinator还维护到数据库的连接，该数据库包含有关可用段和规则的信息。可用段存储在段表中，并列出应加载到集群中的所有段。规则存储在规则表中，并指示应如何处理段。

在Historical进程为任何未分配的段提供服务之前，首先按容量对每个层的可用Historical进程进行排序，最小容量的服务器具有最高优先级。未分配的段总是分配给具有最小能力的进程，以保持进程之间的平衡级别。在为Historical进程分配新段时，Coordinator不直接与该进程通信；而是在ZK中的Historical进程加载队列路径下创建有关该新段的一些临时信息。一旦看到此请求，Historical进程将加载段并开始为其提供服务。

### 运行
```json
org.apache.druid.cli.Main server coordinator
```
### 规则
可以根据一组规则自动从集群中加载和删除段。有关规则的详细信息，请参阅[规则配置](../operations/retainingOrDropData.md)。

### 清理段
每次运行时，Druid Coordinator都会将数据库中可用段的列表与集群中的当前段进行比较,不在数据库中但仍在集群中服务的段将被标记并附加到删除列表中,被遮蔽的段（它们的版本太旧，它们的数据被更新的段替换）也会被丢弃。

### 段可用性
如果一个Historical进程由于任何原因重新启动或变得不可用，Druid Coordinator将注意到一个Historical进程已经丢失，并将该进程服务的所有段视为被删除。给定足够的时间后，这些段可以重新分配给集群中的其他Historical进程。然而，每个被删除的片段并不会立即被遗忘，取而代之的是一种过渡数据结构，它存储所有丢弃的具有相关生存期的段。生存期表示Coordinator不会重新分配丢弃的段的一段时间。因此，如果某个Historical进程在短时间内变得不可用并再次可用，则该Historical进程将启动并从其缓存中服务段，而不会在集群中重新分配任何这些段。

### 平衡段负载
为了确保在集群中跨Historical进程均匀分布段，Coordinator进程将在每次进程运行时查找每个Historical进程所服务的所有段的总大小。对于集群中的每个Historical进程层，Coordinator进程将确定利用率最高的Historical进程和利用率最低的Historical进程。计算两个进程之间利用率的百分比差异，如果结果超过某个阈值，则会将多个段从利用率最高的进程移动到利用率最低的进程。每次运行Coordinator时，可以从一个进程移动到另一个进程的段数有一个可配置的限制。要移动的段是随机选择的，只有在计算结果表明最高服务器和最低服务器之间的百分比差异减小时才会移动。

### 合并段

每次运行时，Druid Coordinator都通过合并小段或拆分大片段来压缩段。当您的段没有进行段大小（可能会导致查询性能下降）优化时，该操作非常有用。有关详细信息，请参见[段大小优化](../operations/segmentSizeOpt.md)。

Coordinator首先根据[段搜索策略](#段搜索策略)查找要压缩的段。找到某些段后，它会发出[压缩任务](../DataIngestion/taskrefer.md#compact)来压缩这些段。运行压缩任务的最大数目为 `min(sum of worker capacity * slotRatio, maxSlots)`。请注意，即使 `min(sum of worker capacity * slotRatio, maxSlots)` = 0，如果为数据源启用了压缩，则始终会提交至少一个压缩任务。请参阅[压缩配置API](../operations/api.md#Coordinator)和[压缩配置](../Configuration/configuration.md#Coordinator)以启用压缩。

压缩任务可能由于以下原因而失败:

* 如果压缩任务的输入段在开始前被删除或覆盖，则该压缩任务将立即失败。
* 如果优先级较高的任务获取与压缩任务的时间间隔重叠的[时间块锁](../DataIngestion/taskrefer.md#锁)，则压缩任务失败。

一旦压缩任务失败，Coordinator只需再次检查失败任务间隔中的段，并在下次运行中发出另一个压缩任务。

### 段搜索策略

**新段优先策略**

在每次Coordinator运行时，此策略都会按从最新到最旧的顺序查找时间块，并检查这些时间块中的段是否需要压缩。如果满足以下所有条件，则需要研所一组段：
1. 时间块中段的总大小小于或等于配置的 `inputSegmentSizeBytes`
2. 段尚未被压缩，或者自上次压缩以来压缩规范(Compaction Spec)已更新，特别是 `maxRowsPerSegment`、`maxTotalRows` 和 `indexSpec`

下面是一些细节和一个例子。假设我们有两个数据源（`foo`，`bar`），如下所示：

* `foo`
  * `foo_2017-11-01T00:00:00.000Z_2017-12-01T00:00:00.000Z_VERSION`
  * `foo_2017-11-01T00:00:00.000Z_2017-12-01T00:00:00.000Z_VERSION_1`
  * `foo_2017-09-01T00:00:00.000Z_2017-10-01T00:00:00.000Z_VERSION`
* `bar`
  * `bar_2017-10-01T00:00:00.000Z_2017-11-01T00:00:00.000Z_VERSION`
  * `bar_2017-10-01T00:00:00.000Z_2017-11-01T00:00:00.000Z_VERSION_1`

假设每一个段大小为10MB且从未被压缩过，因为 `2017-11-01T00:00:00.000Z/2017-12-01T00:00:00.000Z` 是最近的时间段，所以该策略首先返回两个即将压缩的段 `foo_2017-11-01T00:00:00.000Z_2017-12-01T00:00:00.000Z_VERSION` 和 `foo_2017-11-01T00:00:00.000Z_2017-12-01T00:00:00.000Z_VERSION_1`。

如果Coordinator还有足够的用于压缩任务的插槽，该策略则继续搜索剩下的段并返回 `bar_2017-10-01T00:00:00.000Z_2017-11-01T00:00:00.000Z_VERSION` 和 `bar_2017-10-01T00:00:00.000Z_2017-11-01T00:00:00.000Z_VERSION_1`。最后，因为在 `2017-09-01T00:00:00.000Z/2017-10-01T00:00:00.000Z` 时间间隔中只有一个段，所以 `foo_2017-09-01T00:00:00.000Z_2017-10-01T00:00:00.000Z_VERSION` 段也会被选择。

搜索的起点可以通过 [skipOffsetFromLatest](../Configuration/configuration.md#Coordinator) 来更改设置。如果设置了此选项，则此策略将忽略范围内的时间段（最新段的结束时间 - `skipOffsetFromLatest`）， 该配置项主要是为了避免压缩任务和实时任务之间的冲突。请注意，默认情况下，实时任务的优先级高于压缩任务。如果两个任务的时间间隔重叠，实时任务将撤消压缩任务的锁，从而终止压缩任务。

> [!WARNING]
> 当有很多相同间隔的小段，并且它们的总大小超过 `inputSegmentSizeBytes` 时，此策略当前无法处理这种情况。如果它找到这样的段，它只会跳过它们。

### Coordinator控制台

Druid Coordinator公开了一个web GUI，用于显示集群信息和规则配置。有关详细信息，请参阅[Coordinator控制台](../operations/manageui.md)。

### FAQ

1. **客户端是否曾和Coordinator进行通信？**
   
   Coordinator进程不参与查询。

   Historical也不会直接与Coordinator进行通信。Coordinator通过Zookeeper来通知Historical来加载或者卸载段，但是Historical完全不知道Coordinator。

   Broker也不会直接与Coordinator进行通信。Broker通过Historical经ZK公开的元数据来理解数据拓扑，并且也完全不知道Coordinator。

2. **Coordinator进程在其他进程之前还是之后启动有关系吗？**

    不。如果Druid Coordinator没有启动，集群中将不会加载新的段，也不会删除过时的段。但是，Coordinator可以随时启动，并且在可配置的延迟之后，将开始运行协调任务。

    这也意味着，如果有一个正在工作的集群，并且所有的Coordinator都死掉了，那么集群将继续工作，只是它的数据拓扑不会发生任何变化。