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

[基本集群调整指南](../../Operations/basicClusterTuning.md)中的信息可以帮助您进行决策，并可以调整配置大小。

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

[基本集群调优指南](../../Operations/basicClusterTuning.md)包含有关如何计算Broker和Router服务内存使用量的信息。

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

如果您已经有一个单服务器部署，并且希望在整个迁移过程中保留数据，请在更新元数据/深层存储配置之前，按照[元数据迁移](../../Operations/metadataMigration.md)和[深层存储迁移](../../Operations/DeepstorageMigration.md)中的说明进行操作。

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

如果您选择了其他硬件，则[基本的集群调整指南](../../Operations/basicClusterTuning.md)可以帮助您调整配置大小。

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

您可以根据查询负载添加更多查询服务器。 如果增加了查询服务器的数量，请确保按照[基本集群调优指南](../../Operations/basicClusterTuning.md)中的说明调整Historical和Task上的连接池。

### 加载数据

恭喜，您现在有了Druid集群！下一步是根据使用场景来了解将数据加载到Druid的推荐方法。

了解有关[加载数据](../DataIngestion/index.md)的更多信息。


