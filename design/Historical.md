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

## Historical
### 配置
对于Apache Druid Historical的配置，请参见 [Historical配置](../Configuration/configuration.md#Historical)

### HTTP
Historical的API列表，请参见 [Historical API](../Operations/api.md#Historical)

### 运行
```json
org.apache.druid.cli.Main server historical
```

### 加载和服务段

每个Historical都保持与Zookeeper的持续连接，并监视一组可配置的Zookeeper路径以获取新的段信息。Historical不直接与Coordinator通信，而是依赖Zookeeper进行协调。

[Coordinator](./Coordinator.md) 负责通过在与Historical关联的加载队列路径下创建一个短暂的Zookeeper条目来将新的段分配给Historical。有关Coordinator如何将段分配给Historical的更多信息，请参阅 [Coordinator](./Coordinator.md)。

当Historical在其加载队列路径中注意到新的加载队列条目时，它将首先检查本地磁盘目录（缓存）以获取有关段的信息。如果缓存中不存在有关段的信息，Historical将从Zookeeper下载有关新段的元数据，此元数据包括段在深层存储中的位置以及如何解压缩和处理段的规范。有关段的元数据和一般的Druid段的更多信息，请参见 [段](./Segments.md)。一旦一个Historical完成了对一个段的处理，这个段就会在Zookeeper中与该进程相关联的服务段路径下被宣布，同时，该段可供查询。

### 从缓存加载和服务段

回想一下，当Historical在其加载队列路径中注意到一个新的段条目时，Historical首先检查其本地磁盘上的一个可配置的缓存目录以查看该段以前是否下载过。如果本地缓存项已经存在，Historical将直接从磁盘读取段二进制文件并加载段。

当Historical首次启动时也会利用段缓存。Historical启动时，将搜索其缓存目录，并立即加载和服务找到的所有段。此功能允许Historical启动后皆可以对这些段进行查询。

### 查询段

有关查询Historical的详细信息，请参阅 [数据查询](../querying/makeNativeQueries.md)。

Historical可以被配置记录和报告每个服务查询的指标。