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

## SegmentMetaData查询

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了仅仅在原生查询中的一种查询方式。同时，Druid SQL在元数据表部分包括了相似的功能。

段的元数据查询返回每个段的如下信息：

* 段中存储的行数
* 段包含的时间间隔
* 如果存储的平铺格式的数据（如：csv文件）估计一个段的大小
* 段id
* 段是否上卷
* 每一列的详细信息，比如：
  * 类型
  * 基数
  * 最大最小值
  * 存在空值
  * 估计的“平面格式”字节大小

```json
{
  "queryType":"segmentMetadata",
  "dataSource":"sample_datasource",
  "intervals":["2013-01-01/2014-01-01"]
}
```
对于一个段元数据查询主要有以下几个主要部分：

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `queryType` | 该字符串始终为"segmentMetadata", Druid根据该字段来确定如何执行该查询 | 是 |
| `dataSource` | 要查询的数据源， 类似于关系型数据库的表。 可以通过 [数据源](datasource.md) 来查看更多信息| 是 |
| `intervals` | 表示ISO-8601间隔的JSON对象。这定义了运行查询的时间范围。| 是 |
| `toInclude` | 标识哪些列该被包含在结果中的JSON对象，默认为 `all` | 否 |
| `merge` | 合并所有独立的段元数据结果到一个单一的结果中 | 否 |
| `context` | 详情参见 [Context](query-context.md) | 否 |
| `analysisTypes` | 字符串列表，指定应计算哪些列属性（例如基数、大小）并在结果中返回。默认为["cardinality"，"interval"，"minmax"]，但可以使用段元数据查询配置进行覆盖。有关详细信息，请参见[analysisTypes](#segmentmetadata查询)部分 | 否 |
| `lenientAggregatorMerge` | 如果为true，并且启用了"聚合器" `analysisType`，则聚合器将轻松合并。详见下文。 | 否 |

结果集的格式为：

```json
[ {
  "id" : "some_id",
  "intervals" : [ "2013-05-13T00:00:00.000Z/2013-05-14T00:00:00.000Z" ],
  "columns" : {
    "__time" : { "type" : "LONG", "hasMultipleValues" : false, "hasNulls": false, "size" : 407240380, "cardinality" : null, "errorMessage" : null },
    "dim1" : { "type" : "STRING", "hasMultipleValues" : false, "hasNulls": false, "size" : 100000, "cardinality" : 1944, "errorMessage" : null },
    "dim2" : { "type" : "STRING", "hasMultipleValues" : true, "hasNulls": true, "size" : 100000, "cardinality" : 1504, "errorMessage" : null },
    "metric1" : { "type" : "FLOAT", "hasMultipleValues" : false, "hasNulls": false, "size" : 100000, "cardinality" : null, "errorMessage" : null }
  },
  "aggregators" : {
    "metric1" : { "type" : "longSum", "name" : "metric1", "fieldName" : "metric1" }
  },
  "queryGranularity" : {
    "type": "none"
  },
  "size" : 300000,
  "numRows" : 5000000
} ]
```

维度列有以下类型 `STRING`, `FLOAT`, `DOUBLE` 或者 `LONG`。指标列有以下类型 `FLOAT`, `DOUBLE`, 或者 `LONG`, 或者如 `hyperUnique` 复杂类型的名字。时间戳列的类型为 `LONG`。

如果 `errorMessage` 字段为非null，则不应信任响应中的其他字段。它们的内容没有定义。

仅仅只有字典编码的列才有基数（如 `STRING` 类型），其余类型的列（时间戳和指标列）的基数字段都是 `null`。

### **intervals**

如果未指定间隔，查询将使用默认间隔，该间隔跨越最近段结束时间之前的可配置时段。

默认时间周期的长度可以在Broker配置中的 `druid.query.segmentMetadata.defaultHistory` 来设置。

### **toInclude**

有三个类型的toInclude对象。

#### **All**

语法如下：

```json
"toInclude": { "type": "all"}
```

#### **None**

语法如下：

```json
"toInclude": { "type": "none"}
```

#### **List**

语法如下：

```json
"toInclude": { "type": "list", "columns": [<string list of column names>]}
```

### **analysisTypes**

这是一个属性列表，用于确定返回的有关列的信息量，即对列执行的分析。

默认情况下，"cardinality", "interval" 和 "minmax" 类型被使用。 

如果不需要某个属性，则从该列表中省略该属性将导致更高效的查询。

默认的分析类型可以通过Broker配置中的 `druid.query.segmentMetadata.defaultAnalysisTypes` 来设置。

列分析的类型如下描述：

#### **cardinality**

* 结果中的`cardinality`将返回每列基数的估计下限。仅与维度列相关。

#### **minmax**

* 预估每一列的最大最小值，仅与维度列相关

#### **size**

* 如果以文本格式存储数据，结果中的`size`包括段的字节大小

#### **interval**

* 结果中的 `intervals` 包括查询段相关的时间间隔

#### **timestampSpec**

* 结果中的 `timestampSpec` 包括段中存储数据的时间说明。 如果段的时间说明为未知或者未合并，该值可以为null

#### **queryGranularity**

* 结果中的 `queryGranularity` 包括段中存储的数据的查询粒度。 如果段的查询粒度为未知或者未合并，该值可以为null

#### **aggregators**

* 结果中的 `aggregators` 包括用于查询指标列使用的聚合器。 如果段的聚合器为未知或者未合并，该值可以为null
* 合并可以是严格的，也可以是宽松的。 详情可以看下边的 [lenientAggregatorMerge](#lenientaggregatormerge)
* 结果的格式为一个列名到聚合器的map

#### **rollup**

* 结果中的 `rollup` 为true/false/null
* 当合并开启的时候，如果某些有rollup，某些没有，则结果是null

### **lenientAggregatorMerge**

如果某些段具有未知的聚合器，或者两个段对同一列使用不兼容的聚合器（例如，longSum更改为doubleSum），则会发生跨段聚合器元数据之间的冲突。

聚合器可以严格合并（默认）或轻松合并。在严格合并中，如果存在具有未知聚合器的任何段，或任何类型的冲突，则合并的聚合器列表将为空。通过宽松合并，具有未知聚合器的段将被忽略，聚合器之间的冲突只会使该特定列的聚合器失效。

特别是，通过宽松合并，单个列的聚合器可能为空。严格合并不会发生这种情况