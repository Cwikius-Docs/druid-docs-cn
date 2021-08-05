---
id: tutorial-batch-hadoop
title: "Tutorial: Load batch data using Apache Hadoop"
sidebar_label: "Load from Apache Hadoop"
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


This tutorial shows you how to load data files into Apache Druid using a remote Hadoop cluster.

For this tutorial, we'll assume that you've already completed the previous
[batch ingestion tutorial](tutorial-batch.html) using Druid's native batch ingestion system and are using the
`micro-quickstart` single-machine configuration as described in the [quickstart](index.html).

## Install Docker

This tutorial requires [Docker](https://docs.docker.com/install/) to be installed on the tutorial machine.

Once the Docker install is complete, please proceed to the next steps in the tutorial.

## Build the Hadoop docker image

For this tutorial, we've provided a Dockerfile for a Hadoop 2.8.5 cluster, which we'll use to run the batch indexing task.

This Dockerfile and related files are located at `quickstart/tutorial/hadoop/docker`.

From the apache-druid-apache-druid-0.21.1 package root, run the following commands to build a Docker image named "druid-hadoop-demo" with version tag "2.8.5":

```bash
cd quickstart/tutorial/hadoop/docker
docker build -t druid-hadoop-demo:2.8.5 .
```

This will start building the Hadoop image. Once the image build is done, you should see the message `Successfully tagged druid-hadoop-demo:2.8.5` printed to the console.

## Setup the Hadoop docker cluster

### Create temporary shared directory

We'll need a shared folder between the host and the Hadoop container for transferring some files.

Let's create some folders under `/tmp`, we will use these later when starting the Hadoop container:

```bash
mkdir -p /tmp/shared
mkdir -p /tmp/shared/hadoop_xml
```

### Configure /etc/hosts

On the host machine, add the following entry to `/etc/hosts`:

```
127.0.0.1 druid-hadoop-demo
```

### Start the Hadoop container

Once the `/tmp/shared` folder has been created and the `etc/hosts` entry has been added, run the following command to start the Hadoop container.

```bash
docker run -it  -h druid-hadoop-demo --name druid-hadoop-demo -p 2049:2049 -p 2122:2122 -p 8020:8020 -p 8021:8021 -p 8030:8030 -p 8031:8031 -p 8032:8032 -p 8033:8033 -p 8040:8040 -p 8042:8042 -p 8088:8088 -p 8443:8443 -p 9000:9000 -p 10020:10020 -p 19888:19888 -p 34455:34455 -p 49707:49707 -p 50010:50010 -p 50020:50020 -p 50030:50030 -p 50060:50060 -p 50070:50070 -p 50075:50075 -p 50090:50090 -p 51111:51111 -v /tmp/shared:/shared druid-hadoop-demo:2.8.5 /etc/bootstrap.sh -bash
```

Once the container is started, your terminal will attach to a bash shell running inside the container:

```bash
Starting sshd:                                             [  OK  ]
18/07/26 17:27:15 WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Starting namenodes on [druid-hadoop-demo]
druid-hadoop-demo: starting namenode, logging to /usr/local/hadoop/logs/hadoop-root-namenode-druid-hadoop-demo.out
localhost: starting datanode, logging to /usr/local/hadoop/logs/hadoop-root-datanode-druid-hadoop-demo.out
Starting secondary namenodes [0.0.0.0]
0.0.0.0: starting secondarynamenode, logging to /usr/local/hadoop/logs/hadoop-root-secondarynamenode-druid-hadoop-demo.out
18/07/26 17:27:31 WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
starting yarn daemons
starting resourcemanager, logging to /usr/local/hadoop/logs/yarn--resourcemanager-druid-hadoop-demo.out
localhost: starting nodemanager, logging to /usr/local/hadoop/logs/yarn-root-nodemanager-druid-hadoop-demo.out
starting historyserver, logging to /usr/local/hadoop/logs/mapred--historyserver-druid-hadoop-demo.out
bash-4.1#
```

The `Unable to load native-hadoop library for your platform... using builtin-java classes where applicable` warning messages can be safely ignored.

#### Accessing the Hadoop container shell

To open another shell to the Hadoop container, run the following command:

```
docker exec -it druid-hadoop-demo bash
```

### Copy input data to the Hadoop container

From the apache-druid-apache-druid-0.21.1 package root on the host, copy the `quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz` sample data to the shared folder:

```bash
cp quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz /tmp/shared/wikiticker-2015-09-12-sampled.json.gz
```

### Setup HDFS directories

In the Hadoop container's shell, run the following commands to setup the HDFS directories needed by this tutorial and copy the input data to HDFS.

```bash
cd /usr/local/hadoop/bin
./hdfs dfs -mkdir /druid
./hdfs dfs -mkdir /druid/segments
./hdfs dfs -mkdir /quickstart
./hdfs dfs -chmod 777 /druid
./hdfs dfs -chmod 777 /druid/segments
./hdfs dfs -chmod 777 /quickstart
./hdfs dfs -chmod -R 777 /tmp
./hdfs dfs -chmod -R 777 /user
./hdfs dfs -put /shared/wikiticker-2015-09-12-sampled.json.gz /quickstart/wikiticker-2015-09-12-sampled.json.gz
```

If you encounter namenode errors when running this command, the Hadoop container may not be finished initializing. When this occurs, wait a couple of minutes and retry the commands.

## Configure Druid to use Hadoop

Some additional steps are needed to configure the Druid cluster for Hadoop batch indexing.

### Copy Hadoop configuration to Druid classpath

From the Hadoop container's shell, run the following command to copy the Hadoop .xml configuration files to the shared folder:

```bash
cp /usr/local/hadoop/etc/hadoop/*.xml /shared/hadoop_xml
```

From the host machine, run the following, where {PATH_TO_DRUID} is replaced by the path to the Druid package.

```bash
mkdir -p {PATH_TO_DRUID}/conf/druid/single-server/micro-quickstart/_common/hadoop-xml
cp /tmp/shared/hadoop_xml/*.xml {PATH_TO_DRUID}/conf/druid/single-server/micro-quickstart/_common/hadoop-xml/
```

### Update Druid segment and log storage

In your favorite text editor, open `conf/druid/single-server/micro-quickstart/_common/common.runtime.properties`, and make the following edits:

#### Disable local deep storage and enable HDFS deep storage

```
#
# Deep storage
#

# For local disk (only viable in a cluster if this is a network mount):
#druid.storage.type=local
#druid.storage.storageDirectory=var/druid/segments

# For HDFS:
druid.storage.type=hdfs
druid.storage.storageDirectory=/druid/segments
```


#### Disable local log storage and enable HDFS log storage

```
#
# Indexing service logs
#

# For local disk (only viable in a cluster if this is a network mount):
#druid.indexer.logs.type=file
#druid.indexer.logs.directory=var/druid/indexing-logs

# For HDFS:
druid.indexer.logs.type=hdfs
druid.indexer.logs.directory=/druid/indexing-logs

```

### Restart Druid cluster

Once the Hadoop .xml files have been copied to the Druid cluster and the segment/log storage configuration has been updated to use HDFS, the Druid cluster needs to be restarted for the new configurations to take effect.

If the cluster is still running, CTRL-C to terminate the `bin/start-micro-quickstart` script, and re-run it to bring the Druid services back up.

## Load batch data

We've included a sample of Wikipedia edits from September 12, 2015 to get you started.

To load this data into Druid, you can submit an *ingestion task* pointing to the file. We've included
a task that loads the `wikiticker-2015-09-12-sampled.json.gz` file included in the archive.

Let's submit the `wikipedia-index-hadoop-.json` task:

```bash
bin/post-index-task --file quickstart/tutorial/wikipedia-index-hadoop.json --url http://localhost:8081
```

## Querying your data

After the data load is complete, please follow the [query tutorial](../tutorials/tutorial-query.md) to run some example queries on the newly loaded data.

## Cleanup

This tutorial is only meant to be used together with the [query tutorial](../tutorials/tutorial-query.md).

If you wish to go through any of the other tutorials, you will need to:
* Shut down the cluster and reset the cluster state by removing the contents of the `var` directory under the druid package.
* Revert the deep storage and task storage config back to local types in `conf/druid/single-server/micro-quickstart/_common/common.runtime.properties`
* Restart the cluster

This is necessary because the other ingestion tutorials will write to the same "wikipedia" datasource, and later tutorials expect the cluster to use local deep storage.

Example reverted config:

```
#
# Deep storage
#

# For local disk (only viable in a cluster if this is a network mount):
druid.storage.type=local
druid.storage.storageDirectory=var/druid/segments

# For HDFS:
#druid.storage.type=hdfs
#druid.storage.storageDirectory=/druid/segments

#
# Indexing service logs
#

# For local disk (only viable in a cluster if this is a network mount):
druid.indexer.logs.type=file
druid.indexer.logs.directory=var/druid/indexing-logs

# For HDFS:
#druid.indexer.logs.type=hdfs
#druid.indexer.logs.directory=/druid/indexing-logs

```

## Further reading

For more information on loading batch data with Hadoop, please see [the Hadoop batch ingestion documentation](../ingestion/hadoop.md).

## 使用Apache Hadoop加载批数据

本教程向您展示如何使用远程Hadoop集群将数据文件加载到Apache Druid中。

对于本教程，我们假设您已经使用[快速入门](../GettingStarted/chapter-2.md)中所述的 `micro-quickstart` 单机配置完成了前边的[批处理摄取指南](tutorial-batch.md)。

### 安装Docker

本教程要求将[Docker](https://docs.docker.com/install/)安装在教程计算机上。

Docker安装完成后，请继续执行本教程中的后续步骤

### 构建Hadoop Docker镜像
在本教程中，我们为Hadoop 2.8.5集群提供了一个Dockerfile，我们将使用它运行批处理索引任务。

该Dockerfile和相关文件位于 `quickstart/tutorial/hadoop/docker`。

从apache-druid-0.17.0软件包根目录中，运行以下命令以构建名为"druid-hadoop-demo"的Docker镜像，其版本标签为"2.8.5"：

```json
cd quickstart/tutorial/hadoop/docker
docker build -t druid-hadoop-demo:2.8.5 .
```
该命令运行后开始构建Hadoop镜像。镜像构建完成后，可以在控制台中看到 `Successfully tagged druid-hadoop-demo:2.8.5` 的信息。

### 安装Hadoop Docker集群
#### 创建临时共享目录

我们需要一个共享目录以便于主机和Hadoop容器之间进行传输文件

我们在 `/tmp` 下创建一些文件夹，稍后我们在启动Hadoop容器时会使用到它们：

```json
mkdir -p /tmp/shared
mkdir -p /tmp/shared/hadoop_xml
```

#### 配置 /etc/hosts

在主机的 `/etc/hosts` 中增加以下入口：
```json
127.0.0.1 druid-hadoop-demo
```
#### 启动Hadoop容器
在 `/tmp/shared` 文件夹被创建和 `/etc/hosts` 入口被添加后，运行以下命令来启动Hadoop容器：

```json
docker run -it  -h druid-hadoop-demo --name druid-hadoop-demo -p 2049:2049 -p 2122:2122 -p 8020:8020 -p 8021:8021 -p 8030:8030 -p 8031:8031 -p 8032:8032 -p 8033:8033 -p 8040:8040 -p 8042:8042 -p 8088:8088 -p 8443:8443 -p 9000:9000 -p 10020:10020 -p 19888:19888 -p 34455:34455 -p 49707:49707 -p 50010:50010 -p 50020:50020 -p 50030:50030 -p 50060:50060 -p 50070:50070 -p 50075:50075 -p 50090:50090 -p 51111:51111 -v /tmp/shared:/shared druid-hadoop-demo:2.8.5 /etc/bootstrap.sh -bash
```

容器启动后，您的终端将连接到容器内运行的bash shell：

```json
Starting sshd:                                             [  OK  ]
18/07/26 17:27:15 WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
Starting namenodes on [druid-hadoop-demo]
druid-hadoop-demo: starting namenode, logging to /usr/local/hadoop/logs/hadoop-root-namenode-druid-hadoop-demo.out
localhost: starting datanode, logging to /usr/local/hadoop/logs/hadoop-root-datanode-druid-hadoop-demo.out
Starting secondary namenodes [0.0.0.0]
0.0.0.0: starting secondarynamenode, logging to /usr/local/hadoop/logs/hadoop-root-secondarynamenode-druid-hadoop-demo.out
18/07/26 17:27:31 WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable
starting yarn daemons
starting resourcemanager, logging to /usr/local/hadoop/logs/yarn--resourcemanager-druid-hadoop-demo.out
localhost: starting nodemanager, logging to /usr/local/hadoop/logs/yarn-root-nodemanager-druid-hadoop-demo.out
starting historyserver, logging to /usr/local/hadoop/logs/mapred--historyserver-druid-hadoop-demo.out
bash-4.1#
```
`Unable to load native-hadoop library for your platform... using builtin-java classes where applicable` 这个信息可以安全地忽略掉。

##### 进入Hadoop容器shell

运行下边命令打开Hadoop容器的另一个shell：
```json
docker exec -it druid-hadoop-demo bash
```

#### 拷贝数据到Hadoop容器

从apache-druid-0.17.0安装包的根目录拷贝 `quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz` 样例数据到共享文件夹

```json
cp quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz /tmp/shared/wikiticker-2015-09-12-sampled.json.gz
```

#### 设置Hadoop目录

在Hadoop容器shell中，运行以下命令来设置本次教程需要的HDFS目录，同时拷贝输入数据到HDFS上：

```json
cd /usr/local/hadoop/bin
./hdfs dfs -mkdir /druid
./hdfs dfs -mkdir /druid/segments
./hdfs dfs -mkdir /quickstart
./hdfs dfs -chmod 777 /druid
./hdfs dfs -chmod 777 /druid/segments
./hdfs dfs -chmod 777 /quickstart
./hdfs dfs -chmod -R 777 /tmp
./hdfs dfs -chmod -R 777 /user
./hdfs dfs -put /shared/wikiticker-2015-09-12-sampled.json.gz /quickstart/wikiticker-2015-09-12-sampled.json.gz
```
如果在命令执行中遇到了namenode相关的错误，可能是因为Hadoop容器没有完成初始化，等一会儿后重新执行命令。

### 配置使用Hadoop的Druid

配置用于Hadoop批加载的Druid集群还需要额外的一些步骤。

#### 拷贝Hadoop配置到Druid classpath

从Hadoop容器shell中，运行以下命令将Hadoop.xml配置文件拷贝到共享文件夹中：
```json
cp /usr/local/hadoop/etc/hadoop/*.xml /shared/hadoop_xml
```

在宿主机上运行下边命令，其中{PATH_TO_DRUID}替换为Druid软件包的路径：

```json
mkdir -p {PATH_TO_DRUID}/conf/druid/single-server/micro-quickstart/_common/hadoop-xml
cp /tmp/shared/hadoop_xml/*.xml {PATH_TO_DRUID}/conf/druid/single-server/micro-quickstart/_common/hadoop-xml/
```

#### 更新Druid段与日志的存储
在常用的文本编辑器中，打开 `conf/druid/single-server/micro-quickstart/_common/common.runtime.properties` 文件做如下修改：

**禁用本地深度存储，启用HDFS深度存储**
```json
#
# Deep storage
#

# For local disk (only viable in a cluster if this is a network mount):
#druid.storage.type=local
#druid.storage.storageDirectory=var/druid/segments

# For HDFS:
druid.storage.type=hdfs
druid.storage.storageDirectory=/druid/segments
```
**禁用本地日志存储，启动HDFS日志存储**
```json
#
# Indexing service logs
#

# For local disk (only viable in a cluster if this is a network mount):
#druid.indexer.logs.type=file
#druid.indexer.logs.directory=var/druid/indexing-logs

# For HDFS:
druid.indexer.logs.type=hdfs
druid.indexer.logs.directory=/druid/indexing-logs
```
#### 重启Druid集群

Hadoop.xml文件拷贝到Druid集群、段和日志存储配置更新为HDFS后，Druid集群需要重启才可以让配置生效。

如果集群正在运行，`CTRL-C` 终止 `bin/start-micro-quickstart`脚本，重新执行它使得Druid服务恢复。

### 加载批数据

我们提供了2015年9月12日起对Wikipedia编辑的示例数据，以帮助您入门。

要将数据加载到Druid中，可以提交指向该文件的*摄取任务*。我们已经包含了一个任务，该任务会加载存档中包含 `wikiticker-2015-09-12-sampled.json.gz`文件。

通过以下命令进行提交 `wikipedia-index-hadoop.json` 任务：
```json
bin/post-index-task --file quickstart/tutorial/wikipedia-index-hadoop.json --url http://localhost:8081
```

### 查询数据

加载数据后，请按照[查询教程](./chapter-4.md)的操作，对新加载的数据执行一些示例查询.

### 清理数据

本教程只能与[查询教程](./chapter-4.md)一起使用。

如果您打算完成其他任何教程，还需要：
* 关闭集群，通过删除Druid软件包中的 `var` 目录来重置集群状态
* 将 `conf/druid/single-server/micro-quickstart/_common/common.runtime.properties` 恢复深度存储与任务存储配置到本地类型
* 重启集群

这是必需的，因为其他摄取教程将写入相同的"wikipedia"数据源，并且以后的教程希望集群使用本地深度存储。

恢复配置示例：
```json
#
# Deep storage
#

# For local disk (only viable in a cluster if this is a network mount):
druid.storage.type=local
druid.storage.storageDirectory=var/druid/segments

# For HDFS:
#druid.storage.type=hdfs
#druid.storage.storageDirectory=/druid/segments

#
# Indexing service logs
#

# For local disk (only viable in a cluster if this is a network mount):
druid.indexer.logs.type=file
druid.indexer.logs.directory=var/druid/indexing-logs

# For HDFS:
#druid.indexer.logs.type=hdfs
#druid.indexer.logs.directory=/druid/indexing-logs
```

### 进一步阅读

更多关于从Hadoop加载数据的信息，可以查看[Druid Hadoop批量摄取文档](../ingestion/hadoop.md)