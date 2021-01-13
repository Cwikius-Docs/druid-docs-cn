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

## Schema设计
### Druid数据模型

有关一般信息，请查看摄取概述页面上有关 [Druid数据模型](ingestion.md#Druid数据模型) 的文档。本页的其余部分将讨论来自其他类型系统的用户的提示，以及一般提示和常见做法。

* Druid数据存储在 [数据源](ingestion.md#数据源) 中，与传统RDBMS中的表类似。
* Druid数据源可以在摄取过程中使用或不使用 [rollup](ingestion.md#rollup) 。启用rollup后，Druid会在接收期间部分聚合您的数据，这可能会减少其行数，减少存储空间，并提高查询性能。禁用rollup后，Druid为输入数据中的每一行存储一行，而不进行任何预聚合。
* Druid的每一行都必须有时间戳。数据总是按时间进行分区，每个查询都有一个时间过滤器。查询结果也可以按时间段（如分钟、小时、天等）进行细分。
* 除了timestamp列之外，Druid数据源中的所有列都是dimensions或metrics。这遵循 [OLAP数据的标准命名约定](https://en.wikipedia.org/wiki/Online_analytical_processing#Overview_of_OLAP_systems)。
* 典型的生产数据源有几十到几百列。
* [dimension列](ingestion.md#维度) 按原样存储，因此可以在查询时对其进行筛选、分组或聚合。它们总是单个字符串、字符串数组、单个long、单个double或单个float。
* [Metrics列](ingestion.md#指标) 是 [预聚合](../Querying/Aggregations.md) 存储的，因此它们只能在查询时聚合（不能按筛选或分组）。它们通常存储为数字（整数或浮点数），但也可以存储为复杂对象，如[HyperLogLog草图或近似分位数草图](../Querying/Aggregations.md)。即使禁用了rollup，也可以在接收时配置metrics，但在启用汇总时最有用。

### 与其他设计模式类比
#### 关系模型
（如 Hive 或者 PostgreSQL）

Druid数据源通常相当于关系数据库中的表。Druid的 [lookups特性](../Querying/lookups.md) 可以类似于数据仓库样式的维度表，但是正如您将在下面看到的，如果您能够摆脱它，通常建议您进行非规范化。

关系数据建模的常见实践涉及 [规范化](https://en.wikipedia.org/wiki/Database_normalization) 的思想：将数据拆分为多个表，从而减少或消除数据冗余。例如，在"sales"表中，最佳实践关系建模要求将"product id"列作为外键放入单独的"products"表中，该表依次具有"product id"、"product name"和"product category"列, 这可以防止产品名称和类别需要在"sales"表中引用同一产品的不同行上重复。

另一方面，在Druid中，通常使用在查询时不需要连接的完全平坦的数据源。在"sales"表的例子中，在Druid中，通常直接将"product_id"、"product_name"和"product_category"作为维度存储在Druid "sales"数据源中，而不使用单独的"products"表。完全平坦的模式大大提高了性能，因为查询时不需要连接。作为一个额外的速度提升，这也允许Druid的查询层直接操作压缩字典编码的数据。因为Druid使用字典编码来有效地为字符串列每行存储一个整数, 所以可能与直觉相反，这并*没有*显著增加相对于规范化模式的存储空间。

如果需要的话，可以通过使用 [lookups](../Querying/lookups.md) 规范化Druid数据源，这大致相当于关系数据库中的维度表。在查询时，您将使用Druid的SQL `LOOKUP` 查找函数或者原生 `lookup` 提取函数，而不是像在关系数据库中那样使用JOIN关键字。由于lookup表会增加内存占用并在查询时产生更多的计算开销，因此仅当需要更新lookup表并立即反映主表中已摄取行的更改时，才建议执行此操作。

在Druid中建模关系数据的技巧：
* Druid数据源没有主键或唯一键，所以跳过这些。
* 如果可能的话，去规格化。如果需要定期更新dimensions/lookup并将这些更改反映在已接收的数据中，请考虑使用 [lookups](../Querying/lookups.md) 进行部分规范化。
* 如果需要将两个大型的分布式表连接起来，则必须在将数据加载到Druid之前执行此操作。Druid不支持两个数据源的查询时间连接。lookup在这里没有帮助，因为每个lookup表的完整副本存储在每个Druid服务器上，所以对于大型表来说，它们不是一个好的选择。
* 考虑是否要为预聚合启用[rollup](ingestion.md#rollup)，或者是否要禁用rollup并按原样加载现有数据。Druid中的Rollup类似于在关系模型中创建摘要表。
  
#### 时序模型
（如 OpenTSDB 或者 InfluxDB）

与时间序列数据库类似，Druid的数据模型需要时间戳。Druid不是时序数据库，但它同时也是存储时序数据的自然选择。它灵活的数据模型允许它同时存储时序和非时序数据，甚至在同一个数据源中。

为了在Druid中实现时序数据的最佳压缩和查询性能，像时序数据库经常做的一样，按照metric名称进行分区和排序很重要。有关详细信息，请参见 [分区和排序](ingestion.md#分区)。

在Druid中建模时序数据的技巧：
* Druid并不认为数据点是"时间序列"的一部分。相反，Druid对每一点分别进行摄取和聚合
* 创建一个维度，该维度指示数据点所属系列的名称。这个维度通常被称为"metric"或"name"。不要将名为"metric"的维度与Druid Metrics的概念混淆。将它放在"dimensionsSpec"中维度列表的第一个位置，以获得最佳性能（这有助于提高局部性；有关详细信息，请参阅下面的 [分区和排序](ingestion.md#分区)）
* 为附着到数据点的属性创建其他维度。在时序数据库系统中，这些通常称为"标签"
* 创建与您希望能够查询的聚合类型相对应的 [Druid Metrics](ingestion.md#指标)。通常这包括"sum"、"min"和"max"（在long、float或double中的一种）。如果你想计算百分位数或分位数，可以使用Druid的 [近似聚合器](../Querying/Aggregations.md)
* 考虑启用 [rollup](ingestion.md#rollup)，这将允许Druid潜在地将多个点合并到Druid数据源中的一行中。如果希望以不同于原始发出的时间粒度存储数据，则这可能非常有用。如果要在同一个数据源中组合时序和非时序数据，它也很有用
* 如果您提前不知道要摄取哪些列，请使用空的维度列表来触发 [维度列的自动检测](#无schema的维度列)

#### 日志聚合模型
（如 ElasticSearch 或者 Splunk）

与日志聚合系统类似，Druid提供反向索引，用于快速搜索和筛选。Druid的搜索能力通常不如这些系统发达，其分析能力通常更为发达。Druid和这些系统之间的主要数据建模差异在于，在将数据摄取到Druid中时，必须更加明确。Druid列具有特定的类型，而Druid目前不支持嵌套数据。

在Druid中建模日志数据的技巧：
* 如果您提前不知道要摄取哪些列，请使用空维度列表来触发 [维度列的自动检测](#无schema的维度列)
* 如果有嵌套数据，请使用 [展平规范](ingestion.md#flattenspec) 将其扁平化
* 如果您主要有日志数据的分析场景，请考虑启用 [rollup](ingestion.md#rollup),这意味着您将失去从Druid中检索单个事件的能力，但您可能获得大量的压缩和查询性能提升

### 一般提示以及最佳实践
#### Rollup

Druid可以在接收数据时将其汇总，以最小化需要存储的原始数据量。这是一种汇总或预聚合的形式。有关更多详细信息，请参阅摄取文档的 [汇总部分](ingestion.md#rollup)。

#### 分区与排序

对数据进行最佳分区和排序会对占用空间和性能产生重大影响。有关更多详细信息，请参阅摄取文档的 [分区部分](ingestion.md#分区)。

#### Sketches高基维处理

在处理高基数列（如用户ID或其他唯一ID）时，请考虑使用草图(sketches)进行近似分析，而不是对实际值进行操作。当您使用草图(sketches)摄取数据时，Druid不存储原始原始数据，而是存储它的"草图(sketches)"，它可以在查询时输入到以后的计算中。草图(sketches)的常用场景包括 `count-distinct` 和分位数计算。每个草图都是为一种特定的计算而设计的。

一般来说，使用草图(sketches)有两个主要目的：改进rollup和减少查询时的内存占用。

草图(sketches)可以提高rollup比率，因为它们允许您将多个不同的值折叠到同一个草图(sketches)中。例如，如果有两行除了用户ID之外都是相同的（可能两个用户同时执行了相同的操作），则将它们存储在 `count-distinct sketch` 中而不是按原样，这意味着您可以将数据存储在一行而不是两行中。您将无法检索用户id或计算精确的非重复计数，但您仍将能够计算近似的非重复计数，并且您将减少存储空间。

草图(sketches)减少了查询时的内存占用，因为它们限制了需要在服务器之间洗牌的数据量。例如，在分位数计算中，Druid不需要将所有数据点发送到中心位置，以便对它们进行排序和计算分位数，而只需要发送点的草图。这可以将数据传输需要减少到仅千字节。

有关Druid中可用的草图的详细信息，请参阅 [近似聚合器页面](../Querying/Aggregations.md)。

如果你更喜欢 [视频](https://www.youtube.com/watch?v=Hpd3f_MLdXo)，那就看一看吧！，一个讨论Druid Sketches的会议。

#### 字符串 VS 数值维度

如果用户希望将列摄取为数值类型的维度（Long、Double或Float），则需要在 `dimensionsSpec` 的 `dimensions` 部分中指定列的类型。如果省略了该类型，Druid会将列作为默认的字符串类型。

字符串列和数值列之间存在性能折衷。数值列通常比字符串列更快分组。但与字符串列不同，数值列没有索引，因此可以更慢地进行筛选。您可能想尝试为您的用例找到最佳选择。

有关如何配置数值维度的详细信息，请参阅 [`dimensionsSpec`文档](ingestion.md#dimensionsSpec)

#### 辅助时间戳

Druid schema必须始终包含一个主时间戳, 主时间戳用于对数据进行 [分区和排序](ingestion.md#分区)，因此它应该是您最常筛选的时间戳。Druid能够快速识别和检索与主时间戳列的时间范围相对应的数据。

如果数据有多个时间戳，则可以将其他时间戳作为辅助时间戳摄取。最好的方法是将它们作为 [毫秒格式的Long类型维度](ingestion.md#dimensionsspec) 摄取。如有必要，可以使用 [`transformSpec`](ingestion.md#transformspec) 和 `timestamp_parse` 等 [表达式](../Misc/expression.md) 将它们转换成这种格式，后者返回毫秒时间戳。

在查询时，可以使用诸如 `MILLIS_TO_TIMESTAMP`、`TIME_FLOOR` 等 [SQL时间函数](../Querying/druidsql.md) 查询辅助时间戳。如果您使用的是原生Druid查询，那么可以使用 [表达式](../Misc/expression.md)。

#### 嵌套维度

在编写本文时，Druid不支持嵌套维度。嵌套维度需要展平，例如，如果您有以下数据：
```json
{"foo":{"bar": 3}}
```

然后在编制索引之前，应将其转换为：
```json
{"foo_bar": 3}
```

Druid能够将JSON、Avro或Parquet输入数据展平化。请阅读 [展平规格](ingestion.md#flattenspec) 了解更多细节。

#### 计数接收事件数

启用rollup后，查询时的计数聚合器(count aggregator)实际上不会告诉您已摄取的行数。它们告诉您Druid数据源中的行数，可能小于接收的行数。

在这种情况下，可以使用*摄取时*的计数聚合器来计算事件数。但是，需要注意的是，在查询此Metrics时，应该使用 `longSum` 聚合器。查询时的 `count` 聚合器将返回时间间隔的Druid行数，该行数可用于确定rollup比率。

为了举例说明，如果摄取规范包含：
```json
...
"metricsSpec" : [
      {
        "type" : "count",
        "name" : "count"
      },
...
```

您应该使用查询:
```json
...
"aggregations": [
    { "type": "longSum", "name": "numIngestedEvents", "fieldName": "count" },
...
```

#### 无schema的维度列

如果摄取规范中的 `dimensions` 字段为空，Druid将把不是timestamp列、已排除的维度和metric列之外的每一列都视为维度。

注意，当使用无schema摄取时，所有维度都将被摄取为字符串类型的维度。

##### 包含与Dimension和Metric相同的列

一个具有唯一ID的工作流能够对特定ID进行过滤，同时仍然能够对ID列进行快速的唯一计数。如果不使用无schema维度，则通过将Metric的 `name` 设置为与维度不同的值来支持此场景。如果使用无schema维度，这里的最佳实践是将同一列包含两次，一次作为维度，一次作为 `hyperUnique` Metric。这可能涉及到ETL时的一些工作。

例如，对于无schema维度，请重复同一列：
```json
{"device_id_dim":123, "device_id_met":123}
```
同时在 `metricsSpec` 中包含：
```json
{ "type" : "hyperUnique", "name" : "devices", "fieldName" : "device_id_met" }
```
`device_id_dim` 将自动作为维度来被选取