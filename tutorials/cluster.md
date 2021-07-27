---
id: cluster
title: "Clustered deployment"
---

<!--
  ~ Licensed to the Apache Software Foundation (ASF) under one
  ~ or more contributor license agreements.  See the NOTICE file
  ~ distributed with this work for additional information
  ~ regarding copyright ownership.  The ASF licenses this file
  ~ to you under the Apache License, Version 2.0 (the
  ~ "License"); you may not use this file except in compliance
  ~ with the License.  You may obtain a copy of the License at
  ~
  ~   http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~ Unless required by applicable law or agreed to in writing,
  ~ software distributed under the License is distributed on an
  ~ "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  ~ KIND, either express or implied.  See the License for the
  ~ specific language governing permissions and limitations
  ~ under the License.
  -->


Apache Druid is designed to be deployed as a scalable, fault-tolerant cluster.

In this document, we'll set up a simple cluster and discuss how it can be further configured to meet
your needs.

This simple cluster will feature:

 - A Master server to host the Coordinator and Overlord processes
 - Two scalable, fault-tolerant Data servers running Historical and MiddleManager processes
 - A query server, hosting the Druid Broker and Router processes

In production, we recommend deploying multiple Master servers and multiple Query servers in a fault-tolerant configuration based on your specific fault-tolerance needs, but you can get started quickly with one Master and one Query server and add more servers later.

## Select hardware

### Fresh Deployment

If you do not have an existing Druid cluster, and wish to start running Druid in a clustered deployment, this guide provides an example clustered deployment with pre-made configurations.

#### Master server

The Coordinator and Overlord processes are responsible for handling the metadata and coordination needs of your cluster. They can be colocated together on the same server.

In this example, we will be deploying the equivalent of one AWS [m5.2xlarge](https://aws.amazon.com/ec2/instance-types/m5/) instance.

This hardware offers:

- 8 vCPUs
- 31 GB RAM

Example Master server configurations that have been sized for this hardware can be found under `conf/druid/cluster/master`.

#### Data server

Historicals and MiddleManagers can be colocated on the same server to handle the actual data in your cluster. These servers benefit greatly from CPU, RAM,
and SSDs.

In this example, we will be deploying the equivalent of two AWS [i3.4xlarge](https://aws.amazon.com/ec2/instance-types/i3/) instances.

This hardware offers:

- 16 vCPUs
- 122 GB RAM
- 2 * 1.9TB SSD storage

Example Data server configurations that have been sized for this hardware can be found under `conf/druid/cluster/data`.

#### Query server

Druid Brokers accept queries and farm them out to the rest of the cluster. They also optionally maintain an
in-memory query cache. These servers benefit greatly from CPU and RAM.

In this example, we will be deploying the equivalent of one AWS [m5.2xlarge](https://aws.amazon.com/ec2/instance-types/m5/) instance.

This hardware offers:

- 8 vCPUs
- 31 GB RAM

You can consider co-locating any open source UIs or query libraries on the same server that the Broker is running on.

Example Query server configurations that have been sized for this hardware can be found under `conf/druid/cluster/query`.

#### Other Hardware Sizes

The example cluster above is chosen as a single example out of many possible ways to size a Druid cluster.

You can choose smaller/larger hardware or less/more servers for your specific needs and constraints.

If your use case has complex scaling requirements, you can also choose to not co-locate Druid processes (e.g., standalone Historical servers).

The information in the [basic cluster tuning guide](../operations/basic-cluster-tuning.md) can help with your decision-making process and with sizing your configurations.

### Migrating from a single-server deployment

If you have an existing single-server deployment, such as the ones from the [single-server deployment examples](../operations/single-server.md), and you wish to migrate to a clustered deployment of similar scale, the following section contains guidelines for choosing equivalent hardware using the Master/Data/Query server organization.

#### Master server

The main considerations for the Master server are available CPUs and RAM for the Coordinator and Overlord heaps.

Sum up the allocated heap sizes for your Coordinator and Overlord from the single-server deployment, and choose Master server hardware with enough RAM for the combined heaps, with some extra RAM for other processes on the machine.

For CPU cores, you can choose hardware with approximately 1/4th of the cores of the single-server deployment.

#### Data server

When choosing Data server hardware for the cluster, the main considerations are available CPUs and RAM, and using SSD storage if feasible.

In a clustered deployment, having multiple Data servers is a good idea for fault-tolerance purposes.

When choosing the Data server hardware, you can choose a split factor `N`, divide the original CPU/RAM of the single-server deployment by `N`, and deploy `N` Data servers of reduced size in the new cluster.

Instructions for adjusting the Historical/MiddleManager configs for the split are described in a later section in this guide.

#### Query server

The main considerations for the Query server are available CPUs and RAM for the Broker heap + direct memory, and Router heap.

Sum up the allocated memory sizes for your Broker and Router from the single-server deployment, and choose Query server hardware with enough RAM to cover the Broker/Router, with some extra RAM for other processes on the machine.

For CPU cores, you can choose hardware with approximately 1/4th of the cores of the single-server deployment.

The [basic cluster tuning guide](../operations/basic-cluster-tuning.md) has information on how to calculate Broker/Router memory usage.

## Select OS

We recommend running your favorite Linux distribution. You will also need:

  * **Java 8 or later**

> **Warning:** Druid only officially supports Java 8. Any Java version later than 8 is still experimental.
>
> If needed, you can specify where to find Java using the environment variables `DRUID_JAVA_HOME` or `JAVA_HOME`. For more details run the verify-java script.

Your OS package manager should be able to help for both Java. If your Ubuntu-based OS
does not have a recent enough version of Java, WebUpd8 offers [packages for those
OSes](http://www.webupd8.org/2012/09/install-oracle-java-8-in-ubuntu-via-ppa.html).

## Download the distribution

First, download and unpack the release archive. It's best to do this on a single machine at first,
since you will be editing the configurations and then copying the modified distribution out to all
of your servers.

[Download](https://www.apache.org/dyn/closer.cgi?path=/druid/apache-druid-0.21.1/apache-druid-apache-druid-0.21.1-bin.tar.gz)
the apache-druid-0.21.1 release.

Extract Druid by running the following commands in your terminal:

```bash
tar -xzf apache-druid-apache-druid-0.21.1-bin.tar.gz
cd apache-druid-apache-druid-0.21.1
```

In the package, you should find:

* `LICENSE` and `NOTICE` files
* `bin/*` - scripts related to the [single-machine quickstart](index.html)
* `conf/druid/cluster/*` - template configurations for a clustered setup
* `extensions/*` - core Druid extensions
* `hadoop-dependencies/*` - Druid Hadoop dependencies
* `lib/*` - libraries and dependencies for core Druid
* `quickstart/*` - files related to the [single-machine quickstart](index.html)

We'll be editing the files in `conf/druid/cluster/` in order to get things running.

### Migrating from Single-Server Deployments

In the following sections we will be editing the configs under `conf/druid/cluster`.

If you have an existing single-server deployment, please copy your existing configs to `conf/druid/cluster` to preserve any config changes you have made.

## Configure metadata storage and deep storage

### Migrating from Single-Server Deployments

If you have an existing single-server deployment and you wish to preserve your data across the migration, please follow the instructions at [metadata migration](../operations/metadata-migration.md) and [deep storage migration](../operations/deep-storage-migration.md) before updating your metadata/deep storage configs.

These guides are targeted at single-server deployments that use the Derby metadata store and local deep storage. If you are already using a non-Derby metadata store in your single-server cluster, you can reuse the existing metadata store for the new cluster.

These guides also provide information on migrating segments from local deep storage. A clustered deployment requires distributed deep storage like S3 or HDFS. If your single-server deployment was already using distributed deep storage, you can reuse the existing deep storage for the new cluster.

### Metadata storage

In `conf/druid/cluster/_common/common.runtime.properties`, replace
"metadata.storage.*" with the address of the machine that you will use as your metadata store:

- `druid.metadata.storage.connector.connectURI`
- `druid.metadata.storage.connector.host`

In a production deployment, we recommend running a dedicated metadata store such as MySQL or PostgreSQL with replication, deployed separately from the Druid servers.

The [MySQL extension](../development/extensions-core/mysql.md) and [PostgreSQL extension](../development/extensions-core/postgresql.md) docs have instructions for extension configuration and initial database setup.

### Deep storage

Druid relies on a distributed filesystem or large object (blob) store for data storage. The most
commonly used deep storage implementations are S3 (popular for those on AWS) and HDFS (popular if
you already have a Hadoop deployment).

#### S3

In `conf/druid/cluster/_common/common.runtime.properties`,

- Add "druid-s3-extensions" to `druid.extensions.loadList`.

- Comment out the configurations for local storage under "Deep Storage" and "Indexing service logs".

- Uncomment and configure appropriate values in the "For S3" sections of "Deep Storage" and
"Indexing service logs".

After this, you should have made the following changes:

```
druid.extensions.loadList=["druid-s3-extensions"]

#druid.storage.type=local
#druid.storage.storageDirectory=var/druid/segments

druid.storage.type=s3
druid.storage.bucket=your-bucket
druid.storage.baseKey=druid/segments
druid.s3.accessKey=...
druid.s3.secretKey=...

#druid.indexer.logs.type=file
#druid.indexer.logs.directory=var/druid/indexing-logs

druid.indexer.logs.type=s3
druid.indexer.logs.s3Bucket=your-bucket
druid.indexer.logs.s3Prefix=druid/indexing-logs
```

Please see the [S3 extension](../development/extensions-core/s3.md) documentation for more info.

#### HDFS

In `conf/druid/cluster/_common/common.runtime.properties`,

- Add "druid-hdfs-storage" to `druid.extensions.loadList`.

- Comment out the configurations for local storage under "Deep Storage" and "Indexing service logs".

- Uncomment and configure appropriate values in the "For HDFS" sections of "Deep Storage" and
"Indexing service logs".

After this, you should have made the following changes:

```
druid.extensions.loadList=["druid-hdfs-storage"]

#druid.storage.type=local
#druid.storage.storageDirectory=var/druid/segments

druid.storage.type=hdfs
druid.storage.storageDirectory=/druid/segments

#druid.indexer.logs.type=file
#druid.indexer.logs.directory=var/druid/indexing-logs

druid.indexer.logs.type=hdfs
druid.indexer.logs.directory=/druid/indexing-logs
```

Also,

- Place your Hadoop configuration XMLs (core-site.xml, hdfs-site.xml, yarn-site.xml,
mapred-site.xml) on the classpath of your Druid processes. You can do this by copying them into
`conf/druid/cluster/_common/`.

Please see the [HDFS extension](../development/extensions-core/hdfs.md) documentation for more info.

<a name="hadoop"></a>

## Configure for connecting to Hadoop (optional)

If you will be loading data from a Hadoop cluster, then at this point you should configure Druid to be aware
of your cluster:

- Update `druid.indexer.task.hadoopWorkingPath` in `conf/druid/cluster/middleManager/runtime.properties` to
a path on HDFS that you'd like to use for temporary files required during the indexing process.
`druid.indexer.task.hadoopWorkingPath=/tmp/druid-indexing` is a common choice.

- Place your Hadoop configuration XMLs (core-site.xml, hdfs-site.xml, yarn-site.xml,
mapred-site.xml) on the classpath of your Druid processes. You can do this by copying them into
`conf/druid/cluster/_common/core-site.xml`, `conf/druid/cluster/_common/hdfs-site.xml`, and so on.

Note that you don't need to use HDFS deep storage in order to load data from Hadoop. For example, if
your cluster is running on Amazon Web Services, we recommend using S3 for deep storage even if you
are loading data using Hadoop or Elastic MapReduce.

For more info, please see the [Hadoop-based ingestion](../ingestion/hadoop.md) page.

## Configure Zookeeper connection

In a production cluster, we recommend using a dedicated ZK cluster in a quorum, deployed separately from the Druid servers.

In `conf/druid/cluster/_common/common.runtime.properties`, set
`druid.zk.service.host` to a [connection string](https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html)
containing a comma separated list of host:port pairs, each corresponding to a ZooKeeper server in your ZK quorum.
(e.g. "127.0.0.1:4545" or "127.0.0.1:3000,127.0.0.1:3001,127.0.0.1:3002")

You can also choose to run ZK on the Master servers instead of having a dedicated ZK cluster. If doing so, we recommend deploying 3 Master servers so that you have a ZK quorum.

## Configuration Tuning

### Migrating from a Single-Server Deployment

#### Master

If you are using an example configuration from [single-server deployment examples](../operations/single-server.md), these examples combine the Coordinator and Overlord processes into one combined process.

The example configs under `conf/druid/cluster/master/coordinator-overlord` also combine the Coordinator and Overlord processes.

You can copy your existing `coordinator-overlord` configs from the single-server deployment to `conf/druid/cluster/master/coordinator-overlord`.

#### Data

Suppose we are migrating from a single-server deployment that had 32 CPU and 256GB RAM. In the old deployment, the following configurations for Historicals and MiddleManagers were applied:

Historical (Single-server)

```
druid.processing.buffer.sizeBytes=500000000
druid.processing.numMergeBuffers=8
druid.processing.numThreads=31
```

MiddleManager (Single-server)

```
druid.worker.capacity=8
druid.indexer.fork.property.druid.processing.numMergeBuffers=2
druid.indexer.fork.property.druid.processing.buffer.sizeBytes=100000000
druid.indexer.fork.property.druid.processing.numThreads=1
```

In the clustered deployment, we can choose a split factor (2 in this example), and deploy 2 Data servers with 16CPU and 128GB RAM each. The areas to scale are the following:

Historical

- `druid.processing.numThreads`: Set to `(num_cores - 1)` based on the new hardware
- `druid.processing.numMergeBuffers`: Divide the old value from the single-server deployment by the split factor
- `druid.processing.buffer.sizeBytes`: Keep this unchanged

MiddleManager:

- `druid.worker.capacity`: Divide the old value from the single-server deployment by the split factor
- `druid.indexer.fork.property.druid.processing.numMergeBuffers`: Keep this unchanged
- `druid.indexer.fork.property.druid.processing.buffer.sizeBytes`: Keep this unchanged
- `druid.indexer.fork.property.druid.processing.numThreads`: Keep this unchanged

The resulting configs after the split:

New Historical (on 2 Data servers)

```
 druid.processing.buffer.sizeBytes=500000000
 druid.processing.numMergeBuffers=8
 druid.processing.numThreads=31
```

New MiddleManager (on 2 Data servers)

```
druid.worker.capacity=4
druid.indexer.fork.property.druid.processing.numMergeBuffers=2
druid.indexer.fork.property.druid.processing.buffer.sizeBytes=100000000
druid.indexer.fork.property.druid.processing.numThreads=1
```

#### Query

You can copy your existing Broker and Router configs to the directories under `conf/druid/cluster/query`, no modifications are needed, as long as the new hardware is sized accordingly.

### Fresh deployment

If you are using the example cluster described above:
- 1 Master server (m5.2xlarge)
- 2 Data servers (i3.4xlarge)
- 1 Query server (m5.2xlarge)

The configurations under `conf/druid/cluster` have already been sized for this hardware and you do not need to make further modifications for general use cases.

If you have chosen different hardware, the [basic cluster tuning guide](../operations/basic-cluster-tuning.md) can help you size your configurations.

## Open ports (if using a firewall)

If you're using a firewall or some other system that only allows traffic on specific ports, allow
inbound connections on the following:

### Master Server
- 1527 (Derby metadata store; not needed if you are using a separate metadata store like MySQL or PostgreSQL)
- 2181 (ZooKeeper; not needed if you are using a separate ZooKeeper cluster)
- 8081 (Coordinator)
- 8090 (Overlord)

### Data Server
- 8083 (Historical)
- 8091, 8100&ndash;8199 (Druid Middle Manager; you may need higher than port 8199 if you have a very high `druid.worker.capacity`)

### Query Server
- 8082 (Broker)
- 8088 (Router, if used)

> In production, we recommend deploying ZooKeeper and your metadata store on their own dedicated hardware,
> rather than on the Master server.

## Start Master Server

Copy the Druid distribution and your edited configurations to your Master server.

If you have been editing the configurations on your local machine, you can use *rsync* to copy them:

```bash
rsync -az apache-druid-apache-druid-0.21.1/ MASTER_SERVER:apache-druid-apache-druid-0.21.1/
```

### No Zookeeper on Master

From the distribution root, run the following command to start the Master server:

```
bin/start-cluster-master-no-zk-server
```

### With Zookeeper on Master

If you plan to run ZK on Master servers, first update `conf/zoo.cfg` to reflect how you plan to run ZK. Then, you
can start the Master server processes together with ZK using:

```
bin/start-cluster-master-with-zk-server
```

> In production, we also recommend running a ZooKeeper cluster on its own dedicated hardware.

## Start Data Server

Copy the Druid distribution and your edited configurations to your Data servers.

From the distribution root, run the following command to start the Data server:

```
bin/start-cluster-data-server
```

You can add more Data servers as needed.

> For clusters with complex resource allocation needs, you can break apart Historicals and MiddleManagers and scale the components individually.
> This also allows you take advantage of Druid's built-in MiddleManager autoscaling facility.

## Start Query Server

Copy the Druid distribution and your edited configurations to your Query servers.

From the distribution root, run the following command to start the Query server:

```
bin/start-cluster-query-server
```

You can add more Query servers as needed based on query load. If you increase the number of Query servers, be sure to adjust the connection pools on your Historicals and Tasks as described in the [basic cluster tuning guide](../operations/basic-cluster-tuning.md).

## Loading data

Congratulations, you now have a Druid cluster! The next step is to learn about recommended ways to load data into
Druid based on your use case. Read more about [loading data](../ingestion/index.md).

## 集群部署

Apache Druid旨在作为可伸缩的容错集群进行部署。

在本文档中，我们将安装一个简单的集群，并讨论如何对其进行进一步配置以满足您的需求。

这个简单的集群将具有以下特点：
* 一个Master服务同时起Coordinator和Overlord进程
* 两个可伸缩、容错的Data服务来运行Historical和MiddleManager进程
* 一个Query服务，运行Druid Broker和Router进程

在生产中，我们建议根据您的特定容错需求部署多个Master服务器和多个Query服务器，但是您可以使用一台Master服务器和一台Query服务器将服务快速运行起来，然后再添加更多服务器。
### 选择硬件
#### 首次部署

如果您现在没有Druid集群，并打算首次以集群模式部署运行Druid，则本指南提供了一个包含预先配置的集群部署示例。

##### Master服务

Coordinator进程和Overlord进程负责处理集群的元数据和协调需求，它们可以运行在同一台服务器上。

在本示例中，我们将在等效于AWS[m5.2xlarge](https://aws.amazon.com/ec2/instance-types/m5/)实例的硬件环境上部署。

硬件规格为：

* 8核CPU
* 31GB内存

可以在`conf/druid/cluster/master`下找到适用于此硬件规格的Master示例服务配置。

##### Data服务

Historical和MiddleManager可以分配在同一台服务器上运行，以处理集群中的实际数据，这两个服务受益于CPU、内存和固态硬盘。

在本示例中，我们将在等效于AWS[i3.4xlarge](https://aws.amazon.com/cn/ec2/instance-types/i3/)实例的硬件环境上部署。

硬件规格为：
* 16核CPU
* 122GB内存
* 2 * 1.9TB 固态硬盘

可以在`conf/druid/cluster/data`下找到适用于此硬件规格的Data示例服务配置。

##### Query服务

Druid Broker服务接收查询请求，并将其转发到集群中的其他部分，同时其可以可选的配置内存缓存。 Broker服务受益于CPU和内存。

在本示例中，我们将在等效于AWS[m5.2xlarge](https://aws.amazon.com/ec2/instance-types/m5/)实例的硬件环境上部署。

硬件规格为：

* 8核CPU
* 31GB内存

您可以考虑将所有的其他开源UI工具或者查询依赖等与Broker服务部署在同一台服务器上。

可以在`conf/druid/cluster/query`下找到适用于此硬件规格的Query示例服务配置。

##### 其他硬件配置

上面的示例集群是从多种确定Druid集群大小的可能方式中选择的一个示例。

您可以根据自己的特定需求和限制选择较小/较大的硬件或较少/更多的服务器。

如果您的使用场景具有复杂的扩展要求，则还可以选择不将Druid服务混合部署（例如，独立的Historical Server）。

[基本集群调整指南](../../operations/basicClusterTuning.md)中的信息可以帮助您进行决策，并可以调整配置大小。

#### 从单服务器环境迁移部署

如果您现在已有单服务器部署的环境，例如[单服务器部署示例](chapter-3.md)中的部署，并且希望迁移到类似规模的集群部署，则以下部分包含一些选择Master/Data/Query服务等效硬件的准则。

##### Master服务

Master服务的主要考虑点是可用CPU以及用于Coordinator和Overlord进程的堆内存。

首先计算出来在单服务器环境下Coordinator和Overlord已分配堆内存之和，然后选择具有足够内存的Master服务硬件，同时还需要考虑到为服务器上其他进程预留一些额外的内存。

对于CPU，可以选择接近于单服务器环境核数1/4的硬件。

##### Data服务

在为集群Data服务选择硬件时，主要考虑可用的CPU和内存，可行时使用SSD存储。

在集群化部署时，出于容错的考虑，最好是部署多个Data服务。

在选择Data服务的硬件时，可以假定一个分裂因子`N`，将原来的单服务器环境的CPU和内存除以`N`,然后在新集群中部署`N`个硬件规格缩小的Data服务。

##### Query服务

Query服务的硬件选择主要考虑可用的CPU、Broker服务的堆内和堆外内存、Router服务的堆内存。

首先计算出来在单服务器环境下Broker和Router已分配堆内存之和，然后选择可以覆盖Broker和Router内存的Query服务硬件，同时还需要考虑到为服务器上其他进程预留一些额外的内存。

对于CPU，可以选择接近于单服务器环境核数1/4的硬件。

[基本集群调优指南](../../operations/basicClusterTuning.md)包含有关如何计算Broker和Router服务内存使用量的信息。

### 选择操作系统

我们建议运行您喜欢的Linux发行版，同时还需要：

* **Java 8**

> [!WARNING]
> Druid服务运行依赖Java 8，可以使用环境变量`DRUID_JAVA_HOME`或`JAVA_HOME`指定在何处查找Java,有关更多详细信息，请运行`verify-java`脚本。

### 下载发行版

首先，下载并解压缩发布安装包。最好首先在单台计算机上执行此操作，因为您将编辑配置，然后将修改后的配置分发到所有服务器上。

[下载](https://www.apache.org/dyn/closer.cgi?path=/druid/0.17.0/apache-druid-0.17.0-bin.tar.gz)Druid最新0.17.0release安装包

在终端中运行以下命令来提取Druid

```
tar -xzf apache-druid-0.17.0-bin.tar.gz
cd apache-druid-0.17.0
```

在安装包中有以下文件：

* `LICENSE`和`NOTICE`文件
* `bin/*` - 启停等脚本
* `conf/druid/cluster/*` - 用于集群部署的模板配置
* `extensions/*` - Druid核心扩展
* `hadoop-dependencies/*` - Druid Hadoop依赖
* `lib/*` - Druid核心库和依赖
* `quickstart/*` - 与[快速入门](chapter-2.md)相关的文件

我们主要是编辑`conf/druid/cluster/`中的文件。

#### 从单服务器环境迁移部署

在以下各节中，我们将在`conf/druid/cluster`下编辑配置。

如果您已经有一个单服务器部署，请将您的现有配置复制到`conf/druid /cluster`以保留您所做的所有配置更改。

### 配置元数据存储和深度存储
#### 从单服务器环境迁移部署

如果您已经有一个单服务器部署，并且希望在整个迁移过程中保留数据，请在更新元数据/深层存储配置之前，按照[元数据迁移](../../operations/metadataMigration.md)和[深层存储迁移](../../operations/DeepstorageMigration.md)中的说明进行操作。

这些指南针对使用Derby元数据存储和本地深度存储的单服务器部署。 如果您已经在单服务器集群中使用了非Derby元数据存储，则可以在新集群中可以继续使用当前的元数据存储。

这些指南还提供了有关从本地深度存储迁移段的信息。集群部署需要分布式深度存储，例如S3或HDFS。 如果单服务器部署已在使用分布式深度存储，则可以在新集群中继续使用当前的深度存储。

#### 元数据存储

在`conf/druid/cluster/_common/common.runtime.properties`中，使用您将用作元数据存储的服务器地址来替换"metadata.storage.*":

* `druid.metadata.storage.connector.connectURI`
* `druid.metadata.storage.connector.host`

在生产部署中，我们建议运行专用的元数据存储，例如具有复制功能的MySQL或PostgreSQL，与Druid服务器分开部署。

[MySQL扩展](../../Configuration/core-ext/mysql.md)和[PostgreSQL](../../Configuration/core-ext/postgresql.md)扩展文档包含有关扩展配置和初始数据库安装的说明。

#### 深度存储

Druid依赖于分布式文件系统或大对象（blob）存储来存储数据，最常用的深度存储实现是S3（适合于在AWS上）和HDFS（适合于已有Hadoop集群）。

##### S3

在`conf/druid/cluster/_common/common.runtime.properties`中，

* 在`druid.extension.loadList`配置项中增加"druid-s3-extensions"扩展
* 注释掉配置文件中用于本地存储的"Deep Storage"和"Indexing service logs"
* 打开配置文件中关于"For S3"部分中"Deep Storage"和"Indexing service logs"的配置

上述操作之后，您将看到以下的变化：

```json
druid.extensions.loadList=["druid-s3-extensions"]

#druid.storage.type=local
#druid.storage.storageDirectory=var/druid/segments

druid.storage.type=s3
druid.storage.bucket=your-bucket
druid.storage.baseKey=druid/segments
druid.s3.accessKey=...
druid.s3.secretKey=...

#druid.indexer.logs.type=file
#druid.indexer.logs.directory=var/druid/indexing-logs

druid.indexer.logs.type=s3
druid.indexer.logs.s3Bucket=your-bucket
druid.indexer.logs.s3Prefix=druid/indexing-logs
```
更多信息可以看[S3扩展](../../Configuration/core-ext/s3.md)部分的文档。

##### HDFS

在`conf/druid/cluster/_common/common.runtime.properties`中，

* 在`druid.extension.loadList`配置项中增加"druid-hdfs-storage"扩展
* 注释掉配置文件中用于本地存储的"Deep Storage"和"Indexing service logs"
* 打开配置文件中关于"For HDFS"部分中"Deep Storage"和"Indexing service logs"的配置

上述操作之后，您将看到以下的变化：

```json
druid.extensions.loadList=["druid-hdfs-storage"]

#druid.storage.type=local
#druid.storage.storageDirectory=var/druid/segments

druid.storage.type=hdfs
druid.storage.storageDirectory=/druid/segments

#druid.indexer.logs.type=file
#druid.indexer.logs.directory=var/druid/indexing-logs

druid.indexer.logs.type=hdfs
druid.indexer.logs.directory=/druid/indexing-logs
```

同时：

* 需要将Hadoop的配置文件（core-site.xml, hdfs-site.xml, yarn-site.xml, mapred-site.xml）放置在Druid进程的classpath中，可以将他们拷贝到`conf/druid/cluster/_common`目录中

更多信息可以看[HDFS扩展](../../Configuration/core-ext/hdfs.md)部分的文档。

### Hadoop连接配置

如果要从Hadoop集群加载数据，那么此时应对Druid做如下配置：

* 在`conf/druid/cluster/_common/common.runtime.properties`文件中更新`druid.indexer.task.hadoopWorkingPath`配置项，将其更新为您期望的一个用于临时文件存储的HDFS路径。 通常会配置为`druid.indexer.task.hadoopWorkingPath=/tmp/druid-indexing`
* 需要将Hadoop的配置文件（core-site.xml, hdfs-site.xml, yarn-site.xml, mapred-site.xml）放置在Druid进程的classpath中，可以将他们拷贝到`conf/druid/cluster/_common`目录中

请注意，您无需为了可以从Hadoop加载数据而使用HDFS深度存储。例如，如果您的集群在Amazon Web Services上运行，即使您使用Hadoop或Elastic MapReduce加载数据，我们也建议使用S3进行深度存储。

更多信息可以看[基于Hadoop的数据摄取](../../DataIngestion/hadoopbased.md)部分的文档。

### Zookeeper连接配置

在生产集群中，我们建议使用专用的ZK集群，该集群与Druid服务器分开部署。

在 `conf/druid/cluster/_common/common.runtime.properties` 中，将 `druid.zk.service.host` 设置为包含用逗号分隔的host：port对列表的连接字符串，每个对与ZK中的ZooKeeper服务器相对应。（例如" 127.0.0.1:4545"或"127.0.0.1:3000,127.0.0.1:3001、127.0.0.1:3002"）

您也可以选择在Master服务上运行ZK，而不使用专用的ZK集群。如果这样做，我们建议部署3个Master服务，以便您具有ZK仲裁。

### 配置调整
#### 从单服务器环境迁移部署
##### Master服务

如果您使用的是[单服务器部署示例](chapter-3.md)中的示例配置，则这些示例中将Coordinator和Overlord进程合并为一个合并的进程。

`conf/druid/cluster/master/coordinator-overlord` 下的示例配置同样合并了Coordinator和Overlord进程。

您可以将现有的 `coordinator-overlord` 配置从单服务器部署复制到`conf/druid/cluster/master/coordinator-overlord`

##### Data服务

假设我们正在从一个32CPU和256GB内存的单服务器部署环境进行迁移，在老的环境中，Historical和MiddleManager使用了如下的配置：

Historical（单服务器）

```json
druid.processing.buffer.sizeBytes=500000000
druid.processing.numMergeBuffers=8
druid.processing.numThreads=31
```

MiddleManager（单服务器）

```json
druid.worker.capacity=8
druid.indexer.fork.property.druid.processing.numMergeBuffers=2
druid.indexer.fork.property.druid.processing.buffer.sizeBytes=100000000
druid.indexer.fork.property.druid.processing.numThreads=1
```

在集群部署中，我们选择一个分裂因子（假设为2），则部署2个16CPU和128GB内存的Data服务，各项的调整如下：

Historical

* `druid.processing.numThreads`设置为新硬件的（`CPU核数 - 1`）
* `druid.processing.numMergeBuffers` 使用分裂因子去除单服务部署环境的值
* `druid.processing.buffer.sizeBytes` 该值保持不变

MiddleManager:

* `druid.worker.capacity`: 使用分裂因子去除单服务部署环境的值
* `druid.indexer.fork.property.druid.processing.numMergeBuffers`: 该值保持不变
* `druid.indexer.fork.property.druid.processing.buffer.sizeBytes`: 该值保持不变
* `druid.indexer.fork.property.druid.processing.numThreads`: 该值保持不变

调整后的结果配置如下：

新的Historical(2 Data服务器)

```json
 druid.processing.buffer.sizeBytes=500000000
 druid.processing.numMergeBuffers=8
 druid.processing.numThreads=31
 ```

新的MiddleManager（2 Data服务器）

```json
druid.worker.capacity=4
druid.indexer.fork.property.druid.processing.numMergeBuffers=2
druid.indexer.fork.property.druid.processing.buffer.sizeBytes=100000000
druid.indexer.fork.property.druid.processing.numThreads=1
```

##### Query服务

您可以将现有的Broker和Router配置复制到`conf/druid/cluster/query`下的目录中，无需进行任何修改.

#### 首次部署

如果您正在使用如下描述的示例集群规格：

* 1 Master 服务器(m5.2xlarge)
* 2 Data 服务器(i3.4xlarge)
* 1 Query 服务器(m5.2xlarge)

`conf/druid/cluster`下的配置已经为此硬件确定了，一般情况下您无需做进一步的修改。

如果您选择了其他硬件，则[基本的集群调整指南](../../operations/basicClusterTuning.md)可以帮助您调整配置大小。

### 开启端口(如果使用了防火墙)

如果您正在使用防火墙或其他仅允许特定端口上流量准入的系统，请在以下端口上允许入站连接：

#### Master服务

* 1527（Derby元数据存储，如果您正在使用一个像MySQL或者PostgreSQL的分离的元数据存储则不需要）
* 2181（Zookeeper，如果使用了独立的ZK集群则不需要）
* 8081（Coordinator）
* 8090（Overlord）

#### Data服务

* 8083（Historical）
* 8091，8100-8199（Druid MiddleManager，如果`druid.worker.capacity`参数设置较大的话，则需要更多高于8199的端口）

#### Query服务

* 8082（Broker）
* 8088（Router，如果使用了）

> [!WARNING]
> 在生产中，我们建议将ZooKeeper和元数据存储部署在其专用硬件上，而不是在Master服务器上。

### 启动Master服务

将Druid发行版和您编辑的配置文件复制到Master服务器上。

如果您一直在本地计算机上编辑配置，则可以使用rsync复制它们：

```json
rsync -az apache-druid-0.17.0/ MASTER_SERVER:apache-druid-0.17.0/
```

#### 不带Zookeeper启动

在发行版根目录中，运行以下命令以启动Master服务：
```json
bin/start-cluster-master-no-zk-server
```

#### 带Zookeeper启动

如果计划在Master服务器上运行ZK，请首先更新`conf/zoo.cfg`以标识您计划如何运行ZK，然后，您可以使用以下命令与ZK一起启动Master服务进程：
```json
bin/start-cluster-master-with-zk-server
```

> [!WARNING]
> 在生产中，我们建议将ZooKeeper运行在其专用硬件上。

### 启动Data服务

将Druid发行版和您编辑的配置文件复制到您的Data服务器。

在发行版根目录中，运行以下命令以启动Data服务：
```json
bin/start-cluster-data-server
```

您可以在需要的时候增加更多的Data服务器。

> [!WARNING]
> 对于具有复杂资源分配需求的集群，您可以将Historical和MiddleManager分开部署，并分别扩容组件。这也使您能够利用Druid的内置MiddleManager自动伸缩功能。

### 启动Query服务
将Druid发行版和您编辑的配置文件复制到您的Query服务器。

在发行版根目录中，运行以下命令以启动Query服务：

```json
bin/start-cluster-query-server
```

您可以根据查询负载添加更多查询服务器。 如果增加了查询服务器的数量，请确保按照[基本集群调优指南](../../operations/basicClusterTuning.md)中的说明调整Historical和Task上的连接池。

### 加载数据

恭喜，您现在有了Druid集群！下一步是根据使用场景来了解将数据加载到Druid的推荐方法。

了解有关[加载数据](../DataIngestion/index.md)的更多信息。


