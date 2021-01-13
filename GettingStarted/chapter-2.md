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

### 快速开始

在本快速入门教程中，我们将下载Druid并将其安装在一台服务器上，完成初始安装后，向集群中加载数据。

在开始快速入门之前，阅读[Druid概述](./chapter-1.md)和[数据摄取概述](../DataIngestion/index.md)会很有帮助，因为当前教程会引用这些页面上讨论的概念。

#### 预备条件
##### 软件
* **Java 8(8u92+)**
* Linux, Mac OS X, 或者其他类UNIX系统（Windows不支持）

> [!WARNING]
> Druid服务运行依赖Java 8，可以使用环境变量`DRUID_JAVA_HOME`或`JAVA_HOME`指定在何处查找Java,有关更多详细信息，请运行`verify-java`脚本。

##### 硬件

Druid安装包提供了几个[单服务器配置](./chapter-3.md)的示例，以及使用这些配置启动Druid进程的脚本。

如果您正在使用便携式等小型计算机上运行服务，则配置为4CPU/16GB RAM环境的`micro-quickstart`配置是一个不错的选择。

如果您打算在本教程之外使用单机部署进行进一步试验评估，则建议使用比`micro-quickstart`更大的配置。

#### 入门开始

[下载](https://www.apache.org/dyn/closer.cgi?path=/druid/0.17.0/apache-druid-0.17.0-bin.tar.gz)Druid最新0.17.0release安装包

在终端中运行以下命令来提取Druid

```json
tar -xzf apache-druid-0.17.0-bin.tar.gz
cd apache-druid-0.17.0
```

在安装包中有以下文件：

* `LICENSE`和`NOTICE`文件
* `bin/*` - 启停等脚本
* `conf/*` - 用于单节点部署和集群部署的示例配置
* `extensions/*` - Druid核心扩展
* `hadoop-dependencies/*` - Druid Hadoop依赖
* `lib/*` - Druid核心库和依赖
* `quickstart/*` - 配置文件，样例数据，以及快速入门教材的其他文件

#### 启动服务

以下命令假定您使用的是`micro-quickstart`单机配置，如果使用的是其他配置，在`bin`目录下有每一种配置对应的脚本，如`bin/start-single-server-small`

在`apache-druid-0.17.0`安装包的根目录下执行命令：

```json
./bin/start-micro-quickstart
```
然后将在本地计算机上启动Zookeeper和Druid服务实例，例如：

```json
$ ./bin/start-micro-quickstart
[Fri May  3 11:40:50 2019] Running command[zk], logging to[/apache-druid-0.17.0/var/sv/zk.log]: bin/run-zk conf
[Fri May  3 11:40:50 2019] Running command[coordinator-overlord], logging to[/apache-druid-0.17.0/var/sv/coordinator-overlord.log]: bin/run-druid coordinator-overlord conf/druid/single-server/micro-quickstart
[Fri May  3 11:40:50 2019] Running command[broker], logging to[/apache-druid-0.17.0/var/sv/broker.log]: bin/run-druid broker conf/druid/single-server/micro-quickstart
[Fri May  3 11:40:50 2019] Running command[router], logging to[/apache-druid-0.17.0/var/sv/router.log]: bin/run-druid router conf/druid/single-server/micro-quickstart
[Fri May  3 11:40:50 2019] Running command[historical], logging to[/apache-druid-0.17.0/var/sv/historical.log]: bin/run-druid historical conf/druid/single-server/micro-quickstart
[Fri May  3 11:40:50 2019] Running command[middleManager], logging to[/apache-druid-0.17.0/var/sv/middleManager.log]: bin/run-druid middleManager conf/druid/single-server/micro-quickstart
```

所有的状态（例如集群元数据存储和服务的segment文件）将保留在`apache-druid-0.17.0`软件包根目录下的`var`目录中, 服务的日志位于 `var/sv`。

稍后，如果您想停止服务，请按`CTRL-C`退出`bin/start-micro-quickstart`脚本，该脚本将终止Druid进程。

集群启动后，可以访问[http://localhost:8888](http://localhost:8888)来Druid控制台，控制台由Druid Router进程启动。

![tutorial-quickstart](img/tutorial-quickstart-01.png)

所有Druid进程完全启动需要花费几秒钟。 如果在启动服务后立即打开控制台，则可能会看到一些可以安全忽略的错误。

（以下为广告，请见谅）
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

#### 加载数据
##### 教程使用的数据集

对于以下数据加载教程，我们提供了一个示例数据文件，其中包含2015年9月12日发生的Wikipedia页面编辑事件。

该样本数据位于Druid包根目录的`quickstart/tutorial/wikiticker-2015-09-12-sampled.json.gz`中,页面编辑事件作为JSON对象存储在文本文件中。

示例数据包含以下几列，示例事件如下所示：

* added
* channel
* cityName
* comment
* countryIsoCode
* countryName
* deleted
* delta
* isAnonymous
* isMinor
* isNew
* isRobot
* isUnpatrolled
* metroCode
* namespace
* page
* regionIsoCode
* regionName
* user

```json
{
  "timestamp":"2015-09-12T20:03:45.018Z",
  "channel":"#en.wikipedia",
  "namespace":"Main",
  "page":"Spider-Man's powers and equipment",
  "user":"foobar",
  "comment":"/* Artificial web-shooters */",
  "cityName":"New York",
  "regionName":"New York",
  "regionIsoCode":"NY",
  "countryName":"United States",
  "countryIsoCode":"US",
  "isAnonymous":false,
  "isNew":false,
  "isMinor":false,
  "isRobot":false,
  "isUnpatrolled":false,
  "added":99,
  "delta":99,
  "deleted":0,
}
```

##### 数据加载

以下教程演示了将数据加载到Druid的各种方法，包括批处理和流处理用例。 所有教程均假定您使用的是上面提到的`micro-quickstart`单机配置。

* [加载本地文件](../Tutorials/chapter-1.md) - 本教程演示了如何使用Druid的本地批处理摄取来执行批文件加载
* [从Kafka加载流数据](../Tutorials/chapter-2.md) - 本教程演示了如何从Kafka主题加载流数据
* [从Hadoop加载数据](../Tutorials/chapter-3.md) - 本教程演示了如何使用远程Hadoop集群执行批处理文件加载
* [编写一个自己的数据摄取规范](../Tutorials/chapter-10.md) - 本教程演示了如何编写新的数据摄取规范并使用它来加载数据

##### 重置集群状态

如果要在清理服务后重新启动，请删除`var`目录，然后再次运行`bin/start-micro-quickstart`脚本。

一旦每个服务都启动，您就可以加载数据了。

##### 重置Kafka

如果您完成了[教程：从Kafka加载流数据](../Tutorials/chapter-2.md)并希望重置集群状态，则还应该清除所有Kafka状态。

在停止ZooKeeper和Druid服务之前，使用`CTRL-C`关闭`Kafka Broker`，然后删除`/tmp/kafka-logs`中的Kafka日志目录：

```
rm -rf /tmp/kafka-logs
```