# 集群方式部署

Apache Druid 被设计部署为可扩展和容错的集群部署方式。

在本文档中，我们将会设置一个示例集群，并且进行一些讨论，你可以进行那些修改来满足你的需求。

这个简单的集群包括有下面的特性：

 - 主服务器（Master Server）将会运行 Coordinator 和 Overlord 进程
 - 2 个可扩展和容错的数据服务器将会运行 Historical 和 MiddleManager 进程
 - 一个查询服务器（Query Server）将会运行 Broker 和 Router 进程

在生产环境中，我们建议你部署多个 Master 服务器和多个 Query 服务器，服务器的高可用性（fault-tolerant）配置与你的数据特性和容错性要求息息相关。
但是你可以使用一个主服务器（Master Server） 和 一个查询服务器（Query Server）来启动服务，随着需求的增加你可以随时增加更多的服务器节点。

## 选择硬件

### 全新部署

如果你没有已经存在的 Druid 集群，但是你希望开始在你的环境中使用集群方式部署 Druid，本文档将会使用预配置（pre-made configurations）内容来帮助你开始部署 Druid 的集群。

#### 主服务器（Master Server）

Coordinator 和 Overlord 进程将会负责处理 metadata 数据和在你集群中进行协调。这 2 个进程可以合并在同一个服务器上。

在本示例中，我们将会在 AWS [m5.2xlarge](https://aws.amazon.com/ec2/instance-types/m5/) 部署一个评估的服务器和实例。

AWS 上面硬件的配置为：

- 8 vCPUs
- 31 GB RAM

有关本服务器的配置信息和有关硬件大小的建议，可以在文件 `conf/druid/cluster/master` 中找到。

#### 数据服务器（Data server）

Historicals 和 MiddleManagers 可以合并到同一个服务器上，这个 2 个进程在你的集群中用于处理实际的数据。通常来说越大 CPU, RAM, SSDs硬盘越好。

在本示例中，我们将会在  [i3.4xlarge](https://aws.amazon.com/ec2/instance-types/i3/) 部署一个评估的服务器和实例。

AWS 上面硬件的配置为：

- 16 vCPUs
- 122 GB RAM
- 2 * 1.9TB SSD storage

有关本服务器的配置信息和有关硬件大小的建议，可以在文件 `conf/druid/cluster/data` 中找到。

#### 查询服务器（Query server）

Druid Brokers 可以接受查询，并且将接受的查询发送到集群中处理。同时他们也负责维护内存中的查询缓存， 常来说越大的 CPU, RAM 越好。

在本示例中，我们将会在  [m5.2xlarge](https://aws.amazon.com/ec2/instance-types/m5/) 部署一个评估的服务器和实例。

AWS 上面硬件的配置为：

- 8 vCPUs
- 31 GB RAM

你也可以考虑在运行 Broker 进程的查询服务器上部署任何开源的 UI 或者查询库。

有关本服务器的配置信息和有关硬件大小的建议，可以在文件，可以在文件 `conf/druid/cluster/query` 中找到。

#### 其他硬件大小
上面的示例集群配置是从多种确定 Druid 集群可能的配置方式中选择的一个示例。

您可以根据自己的特定需求和要求来选择 较小/较大的硬件配置或 较少/更多的服务器数量。
如果你的使用实例有比较复杂的可扩展性要求，你也可以选择不将进程合并到服务器上的配置方案，而针对每一个进程配置一台服务器（例如，你可以配置一个独立的 Historical 服务器）。

有关更多的配置信息，请参考页面 [basic cluster tuning guide](../operations/basic-cluster-tuning.md) 中的内容，能够帮助你如何对你的配置进行配置和扩展。

### 从独立服务器部署上合并到集群

如果你已经有一个已经存在并且独立运行的独立服务器部署的话，例如在页面 [single-server deployment examples](../operations/single-server.md) 中部署的服务器，
现在你希望将这个独立部署的服务器合并到集群的部署方式中的话，下面的这部分内容将会帮助你完成这个切换和合并的过程。
这个过程包括有如何对硬件进行的选择和针对 Master/Data/Query 服务器应该如何进行组织。

#### 主服务器（Master Server）
针对主服务器主要需要考虑的就是 Coordinator 和 Overlord 进程的 CPU 使用和 RAM 内存的 heaps。

从单独服务器部署的实例中找到 Coordinator 和 Overlord 进程的总计 heap 内存使用大小，然后在新的集群服务上选择硬件时候的 RAM 内存选择，需要有这 2 个进程合并 heap 的大小。
同时还需要准备为这台服务器留够足够的内存供其他进程使用。

针对服务器使用的 CPU 内核，你可以只选择在单独部署情况下的 1/4 即可。

#### 数据服务器（Data server）
当对数据服务器进行选择的时候，主要考虑的是 CPU 数量和 RAM 内存数量，同时如果能够使用 SSD 固态硬盘就更好了。

在针对集群的部署中，如果能够使用多台服务器来部署数据服务器就更好了，因为这样能够让集群拥有更多的冗余来保障持续运行。

当针对数据服务器选择硬件的时候，你可以选择分裂因子 'N'，针对原始独立服务器部署的时候的 CPU/RAM 的数量除以 N， 然后按照除以 'N' 后的结果来确定集群服务器的硬件要求。

针对 Historical/MiddleManager 的配置调整和分离将会在本页面后部分的指南中进行说明。

#### 查询服务器（Query server）
当对数据服务器进行选择的时候，主要考虑的是 CPU 数量，RAM 内存数量和 Broker 进程的的 heap 内存加上直接内存（direct memory），以及 Router 进程的 heap 内存。

将 Broker 和 Router 进程在独立服务器上使用的内存数量相加，然后选择的查询服务器的内存需要足够大的内存来覆盖 Broker/Router 进程使用内存相加的结果。
同时还需要准备为这台服务器留够足够的内存供其他进程使用。

针对服务器使用的 CPU 内核，你可以只选择在单独部署情况下的 1/4 即可。

请参考 [basic cluster tuning guide](../operations/basic-cluster-tuning.md) 页面中的内容，来确定如何计算 Broker/Router 进程使用的内存。

## 选择操作系统

我们推荐你使用任何你喜欢的 Linux 操作系统。同时你需要安装：

  * **Java 8 或者更新的版本**

> **警告：** Druid 目前只能官方的支持 Java 8。如果你使用其他的 JDK 版本，那么很多功能可能是实践性的的。
>
> 如果需要的话，你可以在你的系统环境中定义环境变量 `DRUID_JAVA_HOME` 或 `JAVA_HOME`，来告诉 Druid 到哪里可以找到需要的 JDK 版本。
> 可以运行 Druid 程序中的 `bin/verify-java` 脚本来查看当前运行的 Java 版本。

你的操作系统包管理工具应该能够帮助你在操作系统中安装 Java。
如果你使用的是基于 Ubuntu 的操作系统，但是这个操作系统没有提供的最新版本的 Java 的话，请尝试访问 WebUpd8 页面中的内容： [packages for those
OSes](http://www.webupd8.org/2012/09/install-oracle-java-8-in-ubuntu-via-ppa.html) 。

## 下载发行版本
首先，需要下载并且解压缩相关的归档文件。
最好先在单台计算机上进行相关操作。因为随后你需要在解压缩的包内对配置进行修改，然后将修改后的配置发布到所有的其他服务器上。

[apache-druid-0.21.1 下载地址](https://www.apache.org/dyn/closer.cgi?path=/druid/apache-druid-0.21.1/apache-druid-apache-druid-0.21.1-bin.tar.gz)

在控制台中使用下面的命令来进行解压：

```bash
tar -xzf apache-druid-apache-druid-0.21.1-bin.tar.gz 
cd apache-druid-apache-druid-0.21.1
```

在解压后的包中，你应该能够看到：

* `LICENSE` 和 `NOTICE` 文件
* `bin/*` - 启动或停止的脚本，这是针对独立服务器进行部署的，请参考页面： [独立服务器部署快速指南](../tutorials/index.md)
* `conf/druid/cluster/*` - 针对集群部署的配置和设置文件
* `extensions/*` - Druid 核心扩展
* `hadoop-dependencies/*` - Druid Hadoop 依赖
* `lib/*` - Druid 核心库和依赖
* `quickstart/*` - 独立服务器配置的相关文件，这是针对独立服务器进行部署的，请参考页面： [独立服务器部署快速指南](../tutorials/index.md)

如果你需要让你的集群能够启动的话，我们将会对 `conf/druid/cluster/` 中的内容进行编辑。

### 从独立服务器部署上进行合并
如果需要完成后续页面的部署和配置的话，你需要对 `conf/druid/cluster/` 中的内容进行编辑。

如果你已经有一个正在运行的独立服务器部署的话，请拷贝你已经存在的配置文件到 `conf/druid/cluster` 文件夹中，以保证你已有的配置文件不丢失。

## 配置 metadata 存储和深度存储（deep storage） 

### 从独立服务器部署上合并到集群
如果您已经有一个独立服务器的部署实例，并且希望在整个迁移过程中保留数据，请在对元数据进行迁移之前先阅读：
* [metadata migration](../operations/metadata-migration.md) 
* [deep storage migration](../operations/deep-storage-migration.md)

本指南中的元数据迁移是针对你将原数据存储在 Derby 数据库中，同时你的深度存储也是使用的 Derby 数据库。
如果你在单实例部署的服务器上已经使用了非 Derby 的数据库存储元数据或者分布式深度存储的那，那么你可以在新的集群环境中使用已经存在并且使用的存储方案。

本指南还提供了从本地深度存储中进行段合并的信息。
集群环境的部署是需要配置深度存储的，例如 S3 或 HDFS。 
如果单实例部署已在使用分布式深度存储，则可以在新集群中继续使用当前的深度存储。

### 元数据存储

在 `conf/druid/cluster/_common/common.runtime.properties` 配置文件中，替换 "metadata.storage.*" 的的属性来确定元数据存储的服务器地址。
元数据通常是存储在数据库中的，因此你可以在这里配置你的数据库服务器地址。

- `druid.metadata.storage.connector.connectURI`
- `druid.metadata.storage.connector.host`

在实际的生产环境中，我们推荐你使用独立的元数据存储数据库例如 MySQL 或者 PostgreSQL 来增加冗余性。
这个配置将会在 Druid 服务器外部配置一个数据库连接来保留一套元数据的配置信息，以增加数据冗余性。

[MySQL extension](../development/extensions-core/mysql.md) 和 [PostgreSQL extension](../development/extensions-core/postgresql.md) 
页面中有如何对扩展进行配置和对数据库如何进行初始化的说明，请参考上面页面中的内容。

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


