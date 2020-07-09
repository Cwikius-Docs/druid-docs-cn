<!-- toc -->
## Lookups

> [!WARNING]
> Lookups是一个 [实验性的特性](../Development/experimental.md)

Lookups是Apache Druid中的一个概念，在Druid中维度值(可选地)被新值替换，从而允许类似join的功能。在Druid中应用Lookup类似于在数据仓库中的联接维度表。有关详细信息，请参见 [维度说明](querydimensions.md)。在这些文档中，"key"是指要匹配的维度值，"value"是指其替换的目标值。所以如果你想把 `appid-12345` 映射到`Super Mega Awesome App`，那么键应该是 `appid-12345`，值就是 `Super Mega Awesome App`。

值得注意的是，Lookups不仅支持键一对一映射到唯一值（如国家代码和国家名称）的场景，还支持多个ID映射到同一个值的场景，例如多个应用程序ID映射到一个客户经理。当Lookup是一对一的时候，Druid能够在查询时应用额外的优化；有关更多详细信息，请参阅下面的 [查询执行](#查询执行)。

Lookups没有历史记录，总是使用当前的数据。这意味着，如果特定应用程序id的首席客户经理发生更改，并且您发出了一个查询，其中存储了应用程序id与客户经理之间的关系，则无论您查询的时间范围如何，它都将返回该应用程序id的当前客户经理。

如果您需要进行对数据时间范围敏感的Lookups，那么目前在查询时不支持这样的场景，并且这些数据属于原始的非规范化数据中，以便在Druid中使用。

在所有服务器上，Lookup通常都预加载在内存中。但是，对于非常小的Lookup（大约几十到几百个条目）也可以使用"map"Lookup类型在原生查询时内联传递。有关详细信息，请参见 [维度说明](querydimensions.md)。

其他的Lookup类型在扩展中是可用的，例如：
* 来自本地文件、远程URI或JDBC的全局缓存Lookup，使用 [lookups-cached-global扩展](../Configuration/core-ext/lookups-cached-global.md)
* 来自Kafka Topic的全局缓存Lookup，使用 [ kafka-extraction-namespace扩展](../Configuration/core-ext/kafka-extraction-namespace.md)

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