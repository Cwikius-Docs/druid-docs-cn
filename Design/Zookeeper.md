<!-- toc -->
## ZooKeeper

Apache Druid使用[Apache ZooKeeper](http://zookeeper.apache.org/) 来管理整个集群状态。通过ZK来进行的操作有：

1. [Coordinator](Coordinator.md) Leader选举
2. [Historical](Historical.md) 段发布协议
3. [Coordinator](Coordinator.md) 和 [Historical](Historical.md) 之间的段加载/删除
4. [Overlord](Overlord.md) Leader选举
5. [Overlord](Overlord.md)和[MiddleManager](MiddleManager.md)任务管理

### Coordinator Leader选举

我们使用 **Curator LeadershipLatch** 进行Leader选举：
```json
${druid.zk.paths.coordinatorPath}/_COORDINATOR
```

### Historical和Realtime之间的段发布

`announcementsPath` 和 `servedSegmentsPath` 这两个参数用于这个功能。

所有的 [Historical](Historical.md) 进程都将它们自身发布到 `announcementsPath`, 具体来说它们将在以下路径创建一个临时的ZNODE：
```json
${druid.zk.paths.announcementsPath}/${druid.host}
```

这意味着Historical节点可用。它们也将随后创建一个ZNODE:
```json
${druid.zk.paths.servedSegmentsPath}/${druid.host}
```

当它们加载段时，它们将在以下路径附着的一个临时的ZNODE：
```json
${druid.zk.paths.servedSegmentsPath}/${druid.host}/_segment_identifier_
```

然后，[Coordinator](Coordinator.md) 和 [Broker](Broker.md) 之类的进程可以监视这些路径，以查看哪些进程当前正在为哪些段提供服务。

### Coordinator和Historical之间的段加载/删除
`loadQueuePath` 参数用于这个功能。

当 [Coordiantor](Coordinator.md) 决定一个 [Historical](Historical.md) 进程应该加载或删除一个段时，它会将一个临时znode写到:

```json
${druid.zk.paths.loadQueuePath}/_host_of_historical_process/_segment_identifier
```

这个znode将包含一个payload，它向Historical进程指示它应该如何处理给定的段。当Historical进程完成任务时，它将删除znode，以便向Coordinator表示它已经完成处理。