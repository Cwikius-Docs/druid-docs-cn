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