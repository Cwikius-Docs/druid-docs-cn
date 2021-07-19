<!-- toc -->
## Lookups

> [!WARNING]
> Lookups是一个 [实验性的特性](../development/experimental.md)

Lookups是Apache Druid中的一个概念，在Druid中维度值(可选地)被新值替换，从而允许类似join的功能。在Druid中应用Lookup类似于在数据仓库中的联接维度表。有关详细信息，请参见 [维度说明](querydimensions.md)。在这些文档中，"key"是指要匹配的维度值，"value"是指其替换的目标值。所以如果你想把 `appid-12345` 映射到`Super Mega Awesome App`，那么键应该是 `appid-12345`，值就是 `Super Mega Awesome App`。

值得注意的是，Lookups不仅支持键一对一映射到唯一值（如国家代码和国家名称）的场景，还支持多个ID映射到同一个值的场景，例如多个应用程序ID映射到一个客户经理。当Lookup是一对一的时候，Druid能够在查询时应用额外的优化；有关更多详细信息，请参阅下面的 [查询执行](#查询执行)。

Lookups没有历史记录，总是使用当前的数据。这意味着，如果特定应用程序id的首席客户经理发生更改，并且您发出了一个查询，其中存储了应用程序id与客户经理之间的关系，则无论您查询的时间范围如何，它都将返回该应用程序id的当前客户经理。

如果您需要进行对数据时间范围敏感的Lookups，那么目前在查询时不支持这样的场景，并且这些数据属于原始的非规范化数据中，以便在Druid中使用。

在所有服务器上，Lookup通常都预加载在内存中。但是，对于非常小的Lookup（大约几十到几百个条目）也可以使用"map"Lookup类型在原生查询时内联传递。有关详细信息，请参见 [维度说明](querydimensions.md)。

其他的Lookup类型在扩展中是可用的，例如：
* 来自本地文件、远程URI或JDBC的全局缓存Lookup，使用 [lookups-cached-global扩展](../Configuration/core-ext/lookups-cached-global.md)
* 来自Kafka Topic的全局缓存Lookup，使用 [ kafka-extraction-namespace扩展](../Configuration/core-ext/kafka-extraction-namespace.md)


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

### 查询符号

在[Druid SQL](druidsql.md) 中，Lookups可以使用 [`LOOKUP`函数](druidsql.md#字符串函数) 来进行查询，例如：

```sql
SELECT
  LOOKUP(store, 'store_to_country') AS country,
  SUM(revenue)
FROM sales
GROUP BY 1
```

也可以使用 [JOIN运算符](datasource.md#join):

```sql
SELECT
  store_to_country.v AS country,
  SUM(sales.revenue) AS country_revenue
FROM
  sales
  INNER JOIN lookup.store_to_country ON sales.store = store_to_country.k
GROUP BY 1
```

在原生查询中，lookups可以使用 [维度规范或者提取函数](querydimensions.md)

### 查询执行

当执行涉及Lookup函数（如SQL中的 `LOOKUP` 函数）的聚合查询时，Druid可以决定在扫描和聚合行时应用它们，或者在聚合完成后应用它们。在聚合完成后应用Lookup更为有效，所以如果可以的话，Druid会这样做。Druid通过检查Lookup是否标记为"injective"来决定这一点。一般来说，您应该为任何自然的一对一的Lookup设置此属性，以使得Druid尽可能快地运行查询。

"injective"(内部映射式)Lookup应该包括*所有*可能出现在数据集中的键，还应该将所有键映射到*唯一值*。这一点很重要，因为非内部映射式Lookup可能将不同的键映射到同一个值，在聚合过程中必须考虑到这一点，以免查询结果包含两个应该聚合为一个的结果值。

以下Lookup为内部映射式（假设它包含了数据中所有可能的键）：
```
1 -> Foo
2 -> Bar
3 -> Billy
```

但是以下的并不是，因为"2"和"3"映射到同一个键：

```
1 -> Foo
2 -> Bar
3 -> Bar
```

可以通过在Druid配置中指定 `"injective" : true` 来告诉Druid该Lookup为内部映射式。Druid并不会自动的检测。

> [!WARNING]
> 目前，当Lookup是 [Join数据源](datasource.md#join) 的输入时，不会触发内射查找优化。它只在直接使用查找函数时使用，而不使用联接运算符。

### 动态配置

> [!WARNING]
> 动态Lookup配置是一个 [实验特性](../development/experimental.md), 不再支持静态配置。下面的文档说明了集群范围的配置，该配置可以通过Coordinator进行访问。配置通过服务器的"tier"概念传播。"tier"被定义为一个应该接收一组Lookup的服务集合。例如，您可以让所有Historical都是 `_default`，而Peon是它们所负责的数据源的各个层的一部分。Lookups的tier完全独立于Historical tiers。

这些配置都可以通过以下URI模板来使用JSON获取到：

```
http://<COORDINATOR_IP>:<PORT>/druid/coordinator/v1/lookups/config/{tier}/{id}
```

假设下面的所有URI都预先被添加到了 `http://<COORDINATOR_IP>:<PORT>`

如果您此前**从未**配置过lookups，**必须**首先通过POST请求发送一个Json Object `{}` 到 `/druid/coordinator/v1/lookups/config` 来进行初始化。

该接口可能返回以下几个结果：

* 资源不存在的时返回404
* 请求格式存在问题时返回400
* 请求(`POST` 和 `DELETE`)被异步接收返回202
* 请求(仅针对 `GET`)成功返回200

### 配置传播行为
配置由Coordinator传播到查询服务进程（Broker / Router / Peon / Historical）。查询服务进程有一个内部API，用于管理进程上的Lookup，这些查询由Coordinator使用。Coordinator定期检查是否有任何进程需要加载/删除Lookup并适当地更新它们。

请注意，一个查询服务进程只能同时处理两个同步的Lookup配置传播请求。该限制是为了防止Lookup处理消耗过多的服务器HTTP连接。

### 配置Lookups的API
#### 批量更新Lookup

Lookups可以通过发送一个POST请求到 `/druid/coordinator/v1/lookups/config` 进行批量更新， 数据格式为：

```json
{
    "<tierName>": {
        "<lookupName>": {
          "version": "<version>",
          "lookupExtractorFactory": {
            "type": "<someExtractorFactoryType>",
            "<someExtractorField>": "<someExtractorValue>"
          }
        }
    }
}
```

请注意，"version"是用户指定的任意字符串，当更新现有Lookup时，用户需要指定一个字典级别更高的版本。

例如，配置可能看起来像：

```json
{
  "__default": {
    "country_code": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "77483": "United States"
        }
      }
    },
    "site_id": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "cachedNamespace",
        "extractionNamespace": {
          "type": "jdbc",
          "connectorConfig": {
            "createTables": true,
            "connectURI": "jdbc:mysql:\/\/localhost:3306\/druid",
            "user": "druid",
            "password": "diurd"
          },
          "table": "lookupTable",
          "keyColumn": "country_id",
          "valueColumn": "country_name",
          "tsColumn": "timeColumn"
        },
        "firstCacheTimeout": 120000,
        "injective": true
      }
    },
    "site_id_customer1": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "847632": "Internal Use Only"
        }
      }
    },
    "site_id_customer2": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "AHF77": "Home"
        }
      }
    }
  },
  "realtime_customer1": {
    "country_code": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "77483": "United States"
        }
      }
    },
    "site_id_customer1": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "847632": "Internal Use Only"
        }
      }
    }
  },
  "realtime_customer2": {
    "country_code": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "77483": "United States"
        }
      }
    },
    "site_id_customer2": {
      "version": "v0",
      "lookupExtractorFactory": {
        "type": "map",
        "map": {
          "AHF77": "Home"
        }
      }
    }
  }
}
```

map中所有的条目都将会更新，没有条目被删除。

#### 更新Lookup

通过发送一个 `POST` 请求到 `/druid/coordinator/v1/lookups/config/{tier}/{id}`，可以根据特定的 `lookupExtractorFactory` 来更新Lookup。

例如，一个POST `/druid/coordinator/v1/lookups/config/realtime_customer1/site_id_customer1` 可能包含以下信息：

```json
{
  "version": "v1",
  "lookupExtractorFactory": {
    "type": "map",
    "map": {
      "847632": "Internal Use Only"
    }
  }
}
```

该操作会使用上边定义的配置来更新 `realtime_customer1` 的 `site_id_customer1` Lookup

#### 获取所有Lookups

对 `/druid/coordinator/v1/lookups/config/all` 的 `GET` 请求会返回所有tier的已知Lookups

#### 获取Lookup

对 `/druid/coordinator/v1/lookups/config/{tier}/{id}` 的 `GET` 请求会返回一个特定的Lookup

针对前边的例子，`GET` 请求 `/druid/coordinator/v1/lookups/config/realtime_customer2/site_id_customer2` 会返回：

```json
{
  "version": "v1",
  "lookupExtractorFactory": {
    "type": "map",
    "map": {
      "AHF77": "Home"
    }
  }
}
```

#### 删除Lookup

对 `/druid/coordinator/v1/lookups/config/{tier}/{id}` 的 `DELETE`  请求会删除掉集群中的Lookup，如果该Lookup是该tier的最有一个，则tier也被删除

#### 删除tier

对 `/druid/coordinator/v1/lookups/config/{tier}` 的 `DELETE` 请求会删除掉集群中的指定tier

#### 列出所有tier名称

对 `/druid/coordinator/v1/lookups/config` 的 `GET`请求将返回动态配置中所有已知的tier名称列表， 在请求中加上 `discover=true`参数（即 `/druid/coordinator/v1/lookups/config?discover=true`）可以查找集群中除动态配置中已知tier之外当前活动的tier列表

#### 列出所有Lookup名称

对 `/druid/coordinator/v1/lookups/config/{tier}` 的 `GET` 请求将返回该tier的所有已知Lookup的名称。

这些接口可用于获取已配置的Lookup的传播状态，以使用Historical之类的查找来处理进程。

### Lookup状态的API
#### 列出所有Lookups的加载状态

`GET /druid/coordinator/v1/lookups/status`,参数 `detailed` 是一个可选的查询参数

#### 列出一个tier中的Lookups的加载状态

`GET /druid/coordinator/v1/lookups/status/{tier}`,参数 `detailed` 是一个可选的查询参数

#### 列出单个Lookup的加载状态

`GET /druid/coordinator/v1/lookups/status/{tier}/{lookup}`,参数 `detailed` 是一个可选的查询参数

#### 列出所有进程的Lookup状态

`GET /druid/coordinator/v1/lookups/nodeStatus`, 参数 `discover`为可选的查询参数，用来发现tiers或者已列出tier的Lookup

#### 列出某个tier中进程的Lookup状态

`GET /druid/coordinator/v1/lookups/nodeStatus/{tier}`

#### 列出单一进程中Lookup的状态

`GET /druid/coordinator/v1/lookups/nodeStatus/{tier}/{host:port}`

### 内部API

在Peon、Router、Broker和Historical进程中都可以消费到Lookup配置。 `/druid/listen/v1/lookups` 是一个内部API，这些进程都使用该API进行 list/load/drop 它们的Lookups。它们遵循与集群范围动态配置相同的返回值约定。以下接口可用于调试目的，但不能用于其他目的。

#### 获取Lookups

在一个进程上对 `/druid/listen/v1/lookups` 的 `GET` 请求将返回当前进程上活跃的lookup的一个json map。

```json
{
  "site_id_customer2": {
    "version": "v1",
    "lookupExtractorFactory": {
      "type": "map",
      "map": {
        "AHF77": "Home"
      }
    }
  }
}
```

#### 获取Lookup

在一个进程上对 `/druid/listen/v1/lookups/some_lookup_name` 的 `GET` 请求将返回由 `some_lookup_name` 标识的LookupExtractorFactory。

```json
{
  "version": "v1",
  "lookupExtractorFactory": {
    "type": "map",
    "map": {
      "AHF77": "Home"
    }
  }
}
```

### 配置

可以查看Coordinator配置中的 [Lookups动态配置](../Configuration/configuration.md#coordinator)

使用以下属性来配置Broker/Router/Historical/Peon来宣告它自身作为一个lookup tier的部分。

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.lookup.lookupTier` | 该进程上lookups的tier。 独立于其他tier | `__default` |
| `druid.lookup.lookupTierIsDatasource` | 对于索引服务任务之类的某些操作，数据源是在任务的运行时属性中传递的。此选项从与任务的数据源相同的值中获取tier名称。建议只将其用作索引服务的Peon可选项（如果有的话）。如果为true，则 `druid.lookup.lookupTier`必须指定。 | `false`|

在Coordinator上使用以下属性来配置动态配置管理器的行为：

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.manager.lookups.hostTimeout` | 每台主机处理请求的超时时间，毫秒单位 | `2000`(2s) |
| `druid.manager.lookups.allHostTimeout` | 在所有进程上完成Lookup管理的超时时间，毫秒单位 | `900000`(15mins) |
| `druid.manager.lookups.period` | 管理周期中可以暂停多久 | `120000`(2mins) |
| `druid.manager.lookups.threadPoolSize` | 可以并行的管理的服务进程数量 | `10` |

### 重启时保存配置

可以在重新启动时保存配置，这样进程就不必等待Coordinator操作来重新填充其Lookup。为此，将设置以下属性：

| 属性 | 描述 | 默认值 |
|-|-|-|
| `druid.lookup.snapshotWorkingDir` | 用于存储当前Lookup配置的快照的工作路径，将此属性留空将禁用快照/引导实用程序 | null |
| `druid.lookup.enableLookupSyncOnStartup` | 启动时使用Coordinator启用Lookup同步进程。可查询进程将从Coordinator获取并加载Lookup，而不是等待Coordinator加载Lookup。如果集群中没有配置Lookup，用户可以选择禁用此选项。 | true |
| `druid.lookup.numLookupLoadingThreads` | 启动时并行加载Lookup的线程数。启动完成后，此线程池将被销毁。它不会在JVM的生命周期内保留 | 可用的处理器/2 |
| `druid.lookup.coordinatorFetchRetries` | 在启动时同步期间，重试从Coordinator获取Lookup bean列表的次数。| 3 |
| `druid.lookup.lookupStartRetries` | 在启动时同步期间或运行时，重试启动每个Lookup的次数。| 3 |
| `druid.lookup.coordinatorRetryDelay` | 启动时同步期间从Coordinator获取Lookups列表的重试之间延迟的时间（毫秒）。 | 60000 |

### Lookup反射

如果lookup类型实现了 `LookupIntrospectHandler`接口，Broker提供了一个Lookup反射的API。

对 `/druid/v1/lookups/introspect/{lookupId}` 发送一个 `GET` 请求将返回完整值的map，例如：`GET /druid/v1/lookups/introspect/nato-phoneti`:

```json
{
    "A": "Alfa",
    "B": "Bravo",
    "C": "Charlie",
    ...
    "Y": "Yankee",
    "Z": "Zulu",
    "-": "Dash"
}
```
key的列表可以通过 `GET /druid/v1/lookups/introspect/{lookupId}/keys` 来获取到，例如：`GET /druid/v1/lookups/introspect/nato-phonetic/keys`

```json
[
    "A",
    "B",
    "C",
    ...
    "Y",
    "Z",
    "-"
]
```

values的列表可以通过 `GET /druid/v1/lookups/introspect/{lookupId}/values` 来获取到。例如： `GET /druid/v1/lookups/introspect/nato-phonetic/values` 

```json
[
    "Alfa",
    "Bravo",
    "Charlie",
    ...
    "Yankee",
    "Zulu",
    "Dash"
]
```