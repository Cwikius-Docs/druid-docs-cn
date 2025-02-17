# ZooKeeper

Apache Druid uses [Apache ZooKeeper](http://zookeeper.apache.org/) (ZK) for management of current cluster state.

## Minimum ZooKeeper versions

Apache Druid supports ZooKeeper versions 3.5.x and above.

> Note: Starting with Apache Druid 0.22.0, support for ZooKeeper 3.4.x has been removed

## ZooKeeper Operations

The operations that happen over ZK are

1.  [Coordinator](../design/coordinator.md) leader election
2.  Segment "publishing" protocol from [Historical](../design/historical.md)
3.  Segment load/drop protocol between [Coordinator](../design/coordinator.md) and [Historical](../design/historical.md)
4.  [Overlord](../design/overlord.md) leader election
5.  [Overlord](../design/overlord.md) and [MiddleManager](../design/middlemanager.md) task management

## Coordinator Leader Election

We use the Curator LeadershipLatch recipe to do leader election at path

```
${druid.zk.paths.coordinatorPath}/_COORDINATOR
```

## Segment "publishing" protocol from Historical and Realtime

The `announcementsPath` and `servedSegmentsPath` are used for this.

All [Historical](../design/historical.md) processes publish themselves on the `announcementsPath`, specifically, they will create an ephemeral znode at

```
${druid.zk.paths.announcementsPath}/${druid.host}
```

Which signifies that they exist. They will also subsequently create a permanent znode at

```
${druid.zk.paths.servedSegmentsPath}/${druid.host}
```

And as they load up segments, they will attach ephemeral znodes that look like

```
${druid.zk.paths.servedSegmentsPath}/${druid.host}/_segment_identifier_
```

Processes like the [Coordinator](../design/coordinator.md) and [Broker](../design/broker.md) can then watch these paths to see which processes are currently serving which segments.

## Segment load/drop protocol between Coordinator and Historical

The `loadQueuePath` is used for this.

When the [Coordinator](../design/coordinator.md) decides that a [Historical](../design/historical.md) process should load or drop a segment, it writes an ephemeral znode to

```
${druid.zk.paths.loadQueuePath}/_host_of_historical_process/_segment_identifier
```

This znode will contain a payload that indicates to the Historical process what it should do with the given segment. When the Historical process is done with the work, it will delete the znode in order to signify to the Coordinator that it is complete.
