<!-- toc -->
## 原生查询

> [!WARNING]
> Apache Druid支持两种查询语言，[Druid SQL](druidsql.md) 和 [原生查询](#)，该文档描述原生查询语言。有关Druid SQL如何选择运行SQL查询时要使用的原生查询类型的信息，请查看 [SQL文档](druidsql.md)。

Druid中的原生查询是JSON对象，通常发送给Broker或Router进程。查询可以这样发布：

```bash
curl -X POST '<queryable_host>:<port>/druid/v2/?pretty' -H 'Content-Type:application/json' -H 'Accept:application/json' -d @<query_json_file>
```

Druid的原生查询语言是JSON over HTTP，尽管社区的许多成员已经用其他语言提供了不同的 [客户端库](https://druid.apache.org/libraries.html) 来查询Druid。

Content-Type/Accept Header也可以采用"application/x-jackson-smile":

```bash
curl -X POST '<queryable_host>:<port>/druid/v2/?pretty' -H 'Content-Type:application/json' -H 'Accept:application/x-jackson-smile' -d @<query_json_file>
```

注意：如果未提供Accept header，则默认为"Content Type" header的值。

Druid的原生查询级别相对较低，与内部执行计算的方式密切相关。Druid查询被设计成轻量级的，并且非常快速地完成。这意味着对于更复杂的分析，或者构建更复杂的可视化，可能需要多个Druid查询。

即使查询通常是向Broker或Router发出的，但是它们也可以被 [Historical进程](../Design/Historical.md) 和运行流摄取任务的 [peon(任务jvm)](../Design/Peons.md) 接受。如果您想查询由特定进程提供服务的特定段的结果，这可能很有价值。

### 可用的查询

Druid有许多不同场景的查询类型。查询由各种JSON属性组成，Druid针对不同的场景有不同类型的查询。各种查询类型的文档描述了可以设置的所有JSON属性。

#### 聚合查询

* [Timeseries](timeseriesquery.md)
* [TopN](topn.md)
* [GroupBy](groupby.md)
  
#### 元数据查询

* [TimeBoundary](timeboundaryquery.md)
* [SegmentMetadata](segmentMetadata.md)
* [DatasourceMetadata](datasourcemetadataquery.md)

#### 其他查询

* [Scan](scan.md)
* [Search](searchquery.md)
  
### 应该使用哪种类型的查询

对于聚合查询，如果有多个查询可以满足您的需求，我们通常建议尽可能使用Timeseries或TopN，因为Druid针对它们的场景做了专门优化的。如果两者都不适合，则应该使用GroupBy查询，这是最灵活的。

### 查询取消

可以使用查询的唯一标识符显式地取消查询。如果查询标识符是在查询时设置的，或者是已知的，那么可以在Broker或Router上使用以下接口来取消查询。

```
DELETE /druid/v2/{queryId}
```

例如：如果查询ID是 `abc123`, 查询可以如下取消：

```bash
curl -X DELETE "http://host:port/druid/v2/abc123"
```

### 查询错误

如果查询失败，您将得到一个HTTP 500响应，其中包含具有以下结构的JSON对象：

```json
{
  "error" : "Query timeout",
  "errorMessage" : "Timeout waiting for task.",
  "errorClass" : "java.util.concurrent.TimeoutException",
  "host" : "druid1.example.com:8083"
}
```

如果查询请求由于受到 [query scheduler laning configuration](../Configuration/configuration.md#broker) 的限制而失败，则为HTTP 429响应，该响应具有与错误响应相同的JSON对象架构，但 `errorMessage` 格式为："Total query capacity exceeded"或"query capacity exceeded for lane 'low'"。

响应中的字段是:

| 字段 | 描述 |
|-|-|
| `error` | 定义明确的错误代码（如下表格）|
| `errorMessage` | 包含有关错误的详细信息的自由格式消息。可能为空。 |
| `errorClass` | 导致此错误的异常的类。可能为空。|
| `host` | 发生此错误的主机。可能为空。 |

可能的错误码字段如下：

| 错误码 | 描述 |
|-|-|
| `Query timeout` | 查询超时 |
| `Query interrupted` | 查询被中断，可能是因为JVM关闭 |
| `Query cancelled` | 查询通过"查询取消API"取消 |
| `Resource limit exceeded` | 查询超出了配置的资源限制（例如groupBy maxResults） |
| `Unauthorized request` | 由于安全策略，查询被拒绝。用户已被识别，但未识别出用户的访问权限。 |
| `Unsupported operation` | 查询试图执行不受支持的操作。当使用未记录的功能或使用未完全实现的扩展时，可能会发生这种情况 |
| `Unknown exception` | 发生了其他异常。请检查errorMessage和errorClass以获取详细信息，但请记住，这些字段的内容是自由格式的，并且可能会随着版本的不同而变化 |
