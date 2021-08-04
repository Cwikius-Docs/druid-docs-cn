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

## MiddleManager进程
### 配置
对于Apache Druid MiddleManager配置，可以参见[索引服务配置](../configuration/human-readable-byte.md#MiddleManager)

### HTTP
对于MiddleManager的API接口，详见 [MiddleManager API](../operations/api.md#MiddleManager)

### 综述
MiddleManager进程是执行提交的任务的工作进程。MiddleManager将任务转发给运行在不同jvm中的Peon。我们为每个任务设置单独的jvm的原因是为了隔离资源和日志。每个Peon一次只能运行一个任务，但是，一个MiddleManager可能有多个Peon。

### 运行
```json
org.apache.druid.cli.Main server middleManager
```