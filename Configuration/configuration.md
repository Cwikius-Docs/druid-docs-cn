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

<!-- toc -->

## 配置文档

本部分内容列出来了每一种Druid服务的所有配置项

### 推荐的配置文件组织方式

对于Druid的配置文件，一种推荐的结构组织方式为将配置文件放置在Druid根目录的`conf`目录下，如以下所示：

```json
$ ls -R conf
druid

conf/druid:
_common       broker        coordinator   historical    middleManager overlord

conf/druid/_common:
common.runtime.properties log4j2.xml

conf/druid/broker:
jvm.config         runtime.properties

conf/druid/coordinator:
jvm.config         runtime.properties

conf/druid/historical:
jvm.config         runtime.properties

conf/druid/middleManager:
jvm.config         runtime.properties

conf/druid/overlord:
jvm.config         runtime.properties
```

每一个目录下都有一个 `runtime.properties` 文件，该文件中包含了特定的Druid进程相关的配置项，例如 `historical` 

`jvm.config` 文件包含了每一个服务的JVM参数，例如堆内存属性等

所有进程共享的通用属性位于 `_common/common.runtime.properties` 中。

### 通用配置

本节下的属性是应该在集群中的所有Druid服务之间共享的公共配置。

#### JVM配置最佳实践

在我们的所有进程中有四个需要配置的JVM参数

1. `-Duser.timezone=UTC` 该参数将JVM的默认时区设置为UTC。我们总是这样设置，不使用其他默认时区进行测试，因此本地时区可能会工作，但它们也可能会发现奇怪和有趣的错误。要在非UTC时区中发出查询，请参阅 [查询粒度](../Querying/granularity.md)
2. `-Dfile.encoding=UTF-8` 这类似于时区，我们假设UTF-8进行测试。本地编码可能有效，但也可能导致奇怪和有趣的错误。
3. `-Djava.io.tmpdir=<a path>` 系统中与文件系统交互的各个部分都是通过临时文件完成的，这些文件可能会变得有些大。许多生产系统都被设置为具有小的（但是很快的）`/tmp`目录，这对于Druid来说可能是个问题，因此我们建议将JVM的tmp目录指向一些有更多内容的目录。此目录不应为volatile tmpfs。这个目录还应该具有良好的读写速度，因此应该强烈避免NFS挂载。
4. `-Djava.util.logging.manager=org.apache.logging.log4j.jul.LogManager` 这允许log4j2处理使用标准java日志的非log4j2组件（如jetty）的日志。

#### 扩展
#### 请求日志
#### SQL兼容的空值处理
### Master
#### Coordinator
#### Overlord
### Data
#### MiddleManager and Peons
##### SegmentWriteOutMediumFactory
#### Indexer
#### Historical
### Query
#### Broker
#### Router