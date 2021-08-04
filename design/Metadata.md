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

## 元数据存储

元数据存储是Apache Druid的一个外部依赖。Druid使用它来存储系统的各种元数据，但不存储实际的数据。下面有许多用于各种目的的表。

Derby是Druid的默认元数据存储，但是它不适合生产环境。[MySQL](../configuration/core-ext/mysql.md)和[PostgreSQL](../configuration/core-ext/postgresql.md)是更适合生产的元数据存储。

> [!WARNING]
> 元数据存储存储了Druid集群工作所必需的整个元数据。对于生产集群，考虑使用MySQL或PostgreSQL而不是Derby。此外，强烈建议设置数据库的高可用，因为如果丢失任何元数据，将无法恢复。

### 使用Derby

将以下内容添加到您的Druid配置中：

```json
druid.metadata.storage.type=derby
druid.metadata.storage.connector.connectURI=jdbc:derby://localhost:1527//opt/var/druid_state/derby;create=true
```

### MySQL

参见[mysql-metadata-storage](../configuration/core-ext/mysql.md)扩展文档

### PostgreSQL

参见[postgresql-metadata-storage](../configuration/core-ext/postgresql.md)扩展文档

### 添加自定义的数据库连接池属性

注意：`username`、`password`、`connectURI`、`validationQuery`、`testOnBorrow` 这些属性不能通过 `druid.metadata.storage.connector.dbcp` 属性设置，这些必须通过 `druid.metadata.storage.connector` 属性设置。

支持的属性示例：

```json
druid.metadata.storage.connector.dbcp.maxConnLifetimeMillis=1200000
druid.metadata.storage.connector.dbcp.defaultQueryTimeout=30000
```

全部列表请查看 [基本数据源配置](https://commons.apache.org/proper/commons-dbcp/configuration.html)

### 元数据存储表
#### 段表

这是由 `druid.metadata.storage.tables.segments` 属性决定的。

此表存储了系统中可用段的元数据。[Coordinator](Coordinator.md) 对表进行轮询，以确定可用于在系统中查询的段集。该表有两个主功能列，其他列用于索引。

`used` 列是布尔型标识。1表示集群应"使用"该段(即，应加载该段并可用于请求), 0表示不应将段主动加载到集群中。我们这样做是为了从集群中删除段，而不实际删除它们的元数据（这允许在出现问题时更简单地回滚）。

`payload` 列存储一个JSON blob，该blob包含该段的所有元数据（存储在该payload中的某些数据与表中的某些列是冗余的，这是有意的）, 信息如下：

```json
{
 "dataSource":"wikipedia",
 "interval":"2012-05-23T00:00:00.000Z/2012-05-24T00:00:00.000Z",
 "version":"2012-05-24T00:10:00.046Z",
 "loadSpec":{
    "type":"s3_zip",
    "bucket":"bucket_for_segment",
    "key":"path/to/segment/on/s3"
 },
 "dimensions":"comma-delimited-list-of-dimension-names",
 "metrics":"comma-delimited-list-of-metric-names",
 "shardSpec":{"type":"none"},
 "binaryVersion":9,
 "size":size_of_segment,
 "identifier":"wikipedia_2012-05-23T00:00:00.000Z_2012-05-24T00:00:00.000Z_2012-05-23T00:10:00.046Z"
}
```

请注意，此blob的格式可以而且将不时地更改。

#### 规则表

规则表用于存储有关段应在何处着陆的各种规则。[Coordinator](Coordinator.md) 在对集群进行段（重）分配决策时使用这些规则。

#### 配置表

配置表用于存储运行时的配置对象。我们还没有很多这样的机制，我们也不确定是否会继续使用这种机制，但这是一种在运行时跨集群更改一些配置参数的方法的开始。

#### 任务相关的表

在管理任务时，[Overlord](Overlord.md) 和 [MiddleManager](MiddleManager.md) 还创建和使用了许多表。

#### 审计表

审核表用于存储配置更改的历史记录，例如[Coordinator](Coordinator.md) 所做的规则更改和其他配置更改。

只有以下角色才能访问元数据存储：
1. 索引服务进程（如果有）
2. 实时进程（如果有）
3. 协调程序

因此，您只需要为这些计算机授予访问元数据存储的权限（例如，在AWS安全组中）。