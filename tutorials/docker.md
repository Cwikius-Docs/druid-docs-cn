# Docker
在本 Docker 的快速指南中，我们将从 [Docker Hub](https://hub.docker.com/r/apache/druid) 下载 Apache Druid 镜像，在一台机器上安装并使用
[Docker](https://www.docker.com/get-started) 和 [Docker Compose](https://docs.docker.com/compose/) 。 

在完成初始设置后，集群将准备好加载数据。

同时，如果你已经完成了下面内容的阅读的话将会更好的帮助你理解 Docker 安装配置的相关内容。

* [Druid 基本概述](../design/index.md)
* [数据导入概述](../ingestion/index.md)

如果你还能对 Docker 使用的相关知识有所了解的，也能够更好的帮助你在 Docker 上使用 Druid。

## 安装前提

* Docker

## 开始安装

Druid 的源代码中包含一个用于示例的 [docker-compose.yml](https://github.com/apache/druid/blob/master/distribution/docker/docker-compose.yml) 文件。
这个文件可以从 Docker Hub中获取一个镜像，并可以使用这个镜像进行 Docker 的 Druid 配置和部署。

### Compose 文件
`docker-compose.yml` 示例文件将会为每一个 Druid 服务创建一个容器，包括 Zookeeper 和作为元数据存储 PostgreSQL 容器。

同时还会创建一个 `druid_shared` 的卷，并且这个卷将会在容器的挂载点为 `opt/shared`。这个挂载点将会被用在深度存储来保证在段和任务日志之间进行共享。

Druid 容器是通过 [environment file](https://github.com/apache/druid/blob/master/distribution/docker/environment) 进行配置的。

### 配置
Druid Docker 容器的配置是通过环境变量完成的。环境变量的路径指定请参考文档：[标准 Druid 配置文件](../configuration/human-readable-byte.md) 中的内容。

特殊的环境变量：

* `JAVA_OPTS` -- 设置 java options
* `DRUID_LOG4J` -- 设置完成的 `log4j.xml`
* `DRUID_LOG_LEVEL` -- 覆盖在 log4j 中的默认日志级别
* `DRUID_XMX` -- 设置 Java `Xmx`
* `DRUID_XMS` -- 设置 Java `Xms`
* `DRUID_MAXNEWSIZE` -- 设置 Java 最大 new 的大小
* `DRUID_NEWSIZE` -- 设置 Java new 的大小
* `DRUID_MAXDIRECTMEMORYSIZE` -- 设置 Java 最大直接内存大小
* `DRUID_CONFIG_COMMON` -- druid "common" 属性文件的完整路径
* `DRUID_CONFIG_${service}` -- druid "service" 属性文件的完整路径
* 


除了上面的特殊的环境变量外，在容器启动的时候 Druid 的脚本还将尝试使用以 `druid_` 为前缀的环境变量来对变量进行配置。

例如，针对 Druid 在容器中的进程使用的环境变量：

`druid_metadata_storage_type=postgresql` 

将被转换为

Druid 的 `docker-compose.yml` 文件，展示了如何使用一个环境配置文件来完成所有 Druid 的配置。

但是，在生产环境中，建议使用 `DRUID_COMMON_CONFIG` 和`DRUID_CONFIG_${service}` 来为服务相关的环境指派专门的配置参数。

## 启动集群

 `docker-compose up` 命令来在 shell 中直接启动集群。
 
如果你希望在后台环境中启动集群，请运行 `docker-compose up -d` 命令。

如果你使用的是示例文件目录，那么你需要从 `distribution/docker/` 目录来启动 Docker 的集群。

当你的集群完成所有的启动后，你可以通过浏览器访问  [http://localhost:8888](http://localhost:8888) 控制台页面。

[Druid router 进程](../design/router.md) 提供了 [Druid 控制台（Druid console）](../operations/druid-console.md) 显示的界面。

![Druid console](../assets/tutorial-quickstart-01.png "Druid console")

所有的 Druid 进程完全启动需要几秒钟的时间。如果在 Druid 进程启动的时候，立即打开控制台的话，你可能会看到一些可安全错误，这些安全错误是可以忽略的，直接刷新页面即可。

至此，你可以继续 [快速使用（Quickstart）](../tutorials/index.md) 页面第 4 步导入数据的内容。
如果你还希望加载一些其他的依赖的话，你可以直接对 `docker-compose.yml` 文件进行编辑后重启 Docker。

## Docker 内存的需求
如果你在 Docker 启动的时候发现存在进程崩溃，并且错误代码为 137 的话，表明你的 Docker 的内存不够。

在测试阶段，你可以为你的 Docker 指派 6G 左右的内存。
