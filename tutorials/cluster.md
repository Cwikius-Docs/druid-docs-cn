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

### 深度存储
Druid 依赖分布式文件系统或者一个大对象（blob）存储来对数据进行存储。
最常用的深度存储的实现通常使用的是 S3 (如果你使用的是 AWS 的话)或者 HDFS（如果你使用的是 Hadoop 部署的话）。

#### S3

在文件 `conf/druid/cluster/_common/common.runtime.properties`，

- 添加 "druid-s3-extensions" 到 `druid.extensions.loadList`。

- 在 "Deep Storage" 和 "Indexing service logs" 部分的配置中，注释掉本地存储的配置。

- 在 "Deep Storage" 和 "Indexing service logs" 部分的配置中，取消注释 "For S3" 部分有关的配置。

在完成上面的操作后，你的配置文件应该看起来和下面的内容相似：

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

请参考 [S3 extension](../development/extensions-core/s3.md) 页面中的内容来获得更多的信息。

#### HDFS

在文件 `conf/druid/cluster/_common/common.runtime.properties`，

- 添加 "druid-hdfs-storage" 到 `druid.extensions.loadList`。

- 在 "Deep Storage" 和 "Indexing service logs" 部分的配置中，注释掉本地存储的配置。

- 在 "Deep Storage" 和 "Indexing service logs" 部分的配置中，取消注释 "For HDFS" 部分有关的配置。 

在完成上面的操作后，你的配置文件应该看起来和下面的内容相似：

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

同时,

- 在你 Druid 启动进程的的 classpath 中，请替换掉你的 Hadoop 配置 XMLs 文件(core-site.xml, hdfs-site.xml, yarn-site.xml,
  mapred-site.xml)，或者你可以直接拷贝上面的文件到 `conf/druid/cluster/_common/` 中。

请参考  [HDFS extension](../development/extensions-core/hdfs.md) 页面中的内容来获得更多的信息。



## Hadoop连接配置

如果要从Hadoop集群加载数据，那么此时应对Druid做如下配置：

* 在`conf/druid/cluster/_common/common.runtime.properties`文件中更新`druid.indexer.task.hadoopWorkingPath`配置项，将其更新为您期望的一个用于临时文件存储的HDFS路径。 通常会配置为`druid.indexer.task.hadoopWorkingPath=/tmp/druid-indexing`
* 需要将Hadoop的配置文件（core-site.xml, hdfs-site.xml, yarn-site.xml, mapred-site.xml）放置在Druid进程的classpath中，可以将他们拷贝到`conf/druid/cluster/_common`目录中

请注意，您无需为了可以从Hadoop加载数据而使用HDFS深度存储。

更多信息可以看[基于Hadoop的数据摄取](../ingestion/hadoop.md)部分的文档。


## Hadoop 的连接配置（可选）
如果你希望懂 Hadoop 集群中加载数据，那么你需要对你的 Druid 集群进行下面的一些配置：

- 更新 `conf/druid/cluster/middleManager/runtime.properties` 文件中的 `druid.indexer.task.hadoopWorkingPath` 配置选项。
将 HDFS 配置路径文件更新到一个你期望使用的临时文件存储路径。`druid.indexer.task.hadoopWorkingPath=/tmp/druid-indexing` 为通常的配置。

- 将你的 Hadoop XMLs配置文件（core-site.xml, hdfs-site.xml, yarn-site.xml, mapred-site.xml）放到你的 Druid 进程中。
你可以将 `conf/druid/cluster/_common/core-site.xml`, `conf/druid/cluster/_common/hdfs-site.xml` 拷贝到 `conf/druid/cluster/_common` 目录中。

请注意，你不需要为了从 Hadoop 中载入数据而使用 HDFS 深度存储。

例如，如果您的集群在 Amazon Web Services 上运行，即使已经使用 Hadoop 或 Elastic MapReduce 加载数据，我们也建议使用 S3 进行深度存储。

有关更多的信息，请参考  [Hadoop-based ingestion](../ingestion/hadoop.md) 页面中的内容。

## 配置 Zookeeper 连接
在实际的生产环境中，我们建议你使用专用的 ZK 集群来进行部署。ZK 的集群与 Druid 的集群部署是分离的。

在 `conf/druid/cluster/_common/common.runtime.properties` 配置文件中，设置
`druid.zk.service.host` 为 [connection string](https://zookeeper.apache.org/doc/current/zookeeperProgrammers.html)。
在连接配置中使用的是逗号分隔符（host:port 对），每一个对应的是一个 ZK 的服务器，（例如, "127.0.0.1:4545" or "127.0.0.1:3000,127.0.0.1:3001,127.0.0.1:3002"）。

你也可以选择在 Master 服务器上运行 ZK，而不使用专用的 ZK 集群。
如果这样做的话，我们建议部署 3 个 Master 服务服务器，以便具有 ZK 仲裁（因为 Zookeeper 的部署至少需要 3 个服务器，并且服务器的总数量为奇数）。

## 配置调整

### 从一个单独部署服务器上进行合并

#### Master 服务

如果你已经有一个已经存在并且独立运行的独立服务器部署的话，例如在页面 [single-server deployment examples](../operations/single-server.md) 中部署的服务器，
下面的这个示例将会帮助你将 Coordinator 和 Overlord 合并到一个进程上面

`conf/druid/cluster/master/coordinator-overlord` 下面的示例，显示例如如何同时合并 Coordinator 和 Overlord 进程。

你可以从已经部署的独立服务器上拷贝已经存在 `coordinator-overlord` 配置文件，并部署到 `conf/druid/cluster/master/coordinator-overlord`。

#### Data 服务
假设我们将要从一个 32 CPU 和 256GB 内存的独立服务器上进行合并。
在老的部署中，下面的配置是针对 Historicals 和  MiddleManagers 进程的：

Historical（独立服务器部署）

```
druid.processing.buffer.sizeBytes=500000000
druid.processing.numMergeBuffers=8
druid.processing.numThreads=31
```

MiddleManager（独立服务器部署）

```
druid.worker.capacity=8
druid.indexer.fork.property.druid.processing.numMergeBuffers=2
druid.indexer.fork.property.druid.processing.buffer.sizeBytes=100000000
druid.indexer.fork.property.druid.processing.numThreads=1
```

在集群部署环境中，我们可以选择使用 2 个服务器来运行上面的 2 个服务，这 2 个服务器的配置为 16CPU 和 128GB RAM 。
我们将会按照下面的配置方式进行配置：

Historical

- `druid.processing.numThreads`: 基于配置的新硬件环境，设置为 `(num_cores - 1)` 
- `druid.processing.numMergeBuffers`: 针对独立服务器使用的数量使用分裂因子相除
- `druid.processing.buffer.sizeBytes`: 保持不变

MiddleManager:

- `druid.worker.capacity`: 针对独立服务器使用的数量使用分裂因子相除
- `druid.indexer.fork.property.druid.processing.numMergeBuffers`: 保持不变
- `druid.indexer.fork.property.druid.processing.buffer.sizeBytes`: 保持不变
- `druid.indexer.fork.property.druid.processing.numThreads`: 保持不变

在完成上面配置后的结果如下：

集群 Historical (使用 2 个数据服务器)

```
 druid.processing.buffer.sizeBytes=500000000
 druid.processing.numMergeBuffers=8
 druid.processing.numThreads=31
```

集群 MiddleManager (使用 2 个数据服务器)

```
druid.worker.capacity=4
druid.indexer.fork.property.druid.processing.numMergeBuffers=2
druid.indexer.fork.property.druid.processing.buffer.sizeBytes=100000000
druid.indexer.fork.property.druid.processing.numThreads=1
```

#### Query 服务
你可以将已经在独立服务器部署中存在的配置文件拷贝到 `conf/druid/cluster/query` 目录中完成部署。
如果新的服务器的硬件配置和独立服务器的配置是相对的话，新的部署不需要做修改。

### 刷新部署 deployment

如果你使用下面的服务器配置环境为示例的话：
- 1 Master server (m5.2xlarge)
- 2 Data servers (i3.4xlarge)
- 1 Query server (m5.2xlarge)

在 `conf/druid/cluster` 文件夹中的配置文件已经针对上面的硬件环境进行了优化，针对基本情况的使用来说，你不需要针对上面的配置进行修改。

如果你选择使用不同的硬件的话，页面 [basic cluster tuning guide](../operations/basic-cluster-tuning.md) 中的内容能够帮助你对你的硬件配置做一些选择。

## 打开端口（如果你使用了防火墙的话）

如果你的服务使用了防火墙，或者一些网络配置中限制了端口的访问的话。那么你需要在你的服务器上开放下面的端口，并运行数据进行访问：

### Master 服务器
- 1527 （Derby 原数据存储；如果你使用的是其他的数据库，例如 MySQL 或 PostgreSQL 的话就不需要）
- 2181 （ZooKeeper；如果你使用的是分布式 ZooKeeper 集群部署的话就不需要）
- 8081 （Coordinator 服务）
- 8090 （Overlord 服务）

### Data 服务器
- 8083 （Historical 服务）
- 8091, 8100&ndash;8199 （Druid Middle Manager 服务，如果你使用了比较高的 `druid.worker.capacity` 配置的话，那么你需要的端口可能会高于 8199）

### Query 服务器
- 8082 （Broker 服务）
- 8088 （Router 服务，如果使用的话）

> 在生产环境中，我们推荐你部署 ZooKeeper 和你的元数据存储到他们自己的硬件上（独立部署）。不要和 Master server 混合部署在一起。

## 启动 Master 服务器
拷贝 Druid 的分发包和你修改过的配置到 Master 服务器上。

如果你已经在你的本地计算机上修改了配置，你可以使用 *rsync* 来进行拷贝。

```bash
rsync -az apache-druid-apache-druid-0.21.1/ MASTER_SERVER:apache-druid-apache-druid-0.21.1/
```

### Master 没有 Zookeeper 的启动 

从分发包的 root 节点中，运行下面的命令来启动 Master 服务器：

```
bin/start-cluster-master-no-zk-server
```

### Master 有 Zookeeper 的启动
如果你计划在 Master 服务器上还同时运行 ZK 的话，首先需要更新 `conf/zoo.cfg` 中的配置来确定你如何运行 ZK。
然后你可以选择在启动 ZK 的同时启动 Master 服务器。

使用下面的命令行来进行启动：

```
bin/start-cluster-master-with-zk-server
```

> 在生产环境中，我们推荐你部署 ZooKeeper 在独立的集群上面。

## 启动 Data 服务器
拷贝 Druid 的分发包和你修改过的配置到 Data 服务器上。

从分发包的 root 节点中，运行下面的命令来启动 Data 服务器：

```
bin/start-cluster-data-server
```

如果需要的话，你还可以为你的数据服务器添加更多的节点。

> 针对集群环境中更加复杂的应用环境和需求，你可以将 Historicals 和 MiddleManagers 服务分开部署，然后分别进行扩容。
> 上面的这种分开部署方式，能够给代理 Druid 已经构建并且实现的 MiddleManager 自动扩容功能。

## 启动 Query 服务器
拷贝 Druid 的分发包和你修改过的配置到 Query 服务器上。

从分发包的 root 节点中，运行下面的命令来启动 Query 服务器：

```
bin/start-cluster-query-server
```
针对你查询的负载情况，你可以为你的查询服务器增加更多的节点。

如果为你的查询服务器增加了更多的节点的话，请确定同时为你的 Historicals 服务增加更多的连接池。

请参考页面  [basic cluster tuning guide](../operations/basic-cluster-tuning.md) 中描述的内容。

## 载入数据
恭喜你，我们现在有了配置成功并且运行的 Druid 集群了！

下一步就是根据根据你的使用情况来用推荐的方法将数据载入到 Druid 集群中了。

请参考页面 [loading data](../ingestion/index.md) 中的内容。
