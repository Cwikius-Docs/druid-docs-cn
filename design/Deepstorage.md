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

## 深度存储

Apache Druid不提供的存储机制，深度存储是存储段的地方。深度存储基础结构定义了数据的持久性级别，只要Druid进程能够看到这个存储基础结构并获得存储在上面的段，那么无论丢失多少Druid节点，都不会丢失数据。如果段在深度存储层消失了，则这些段中存储的任何数据都将丢失。

### 本地挂载

本地装载也可用于存储段。这使得您可以使用本地文件系统或任何可以在本地挂载的东西，如NFS、Ceph等来存储段。这是默认的深度存储实现。

为了使用本地装载进行深层存储，需要在公共配置中设置以下配置：

|属性|可能的取值|描述|默认值
|-|-|-|-|
|`druid.storage.type`|local||必须设置| 
|`druid.storage.storageDirectory`||存储段的目录|必须设置|

注意，通常应该将 `druid.storage.storageDirectory` 设置为与 `druid.segmentCache.locations` 和 `druid.segmentCache.infoDir` 不同的目录。

如果在本地模式下使用Hadoop Indexer，那么只需给它一个本地目录作为输出目录，它就可以工作了。

### S3适配

请看[druid-s3-extensions](../Configuration/core-ext/s3.md)扩展文档

### HDFS

请看[druid-hdfs-extensions](../Configuration/core-ext/hdfs.md)扩展文档

### 其他深度存储

对于另外的深度存储等，可以参见[扩展列表](../Configuration/extensions.md)