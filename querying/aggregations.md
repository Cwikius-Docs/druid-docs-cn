# 聚合

> Apache Druid 支持两种查询语言: [Druid SQL](sql.md) 和 [原生查询（native queries）](querying.md)。
> 该文档描述了原生查询中的一种查询方式。
> 有关更多 Druid 在 SQL 中使用 aggregators（聚合）查询的方式，请参考
> [SQL 文档](sql.md#aggregation-functions)。

聚合可以在数据导入的时候（ingestion）作为数据导入规范的一部分来进行提供，作为在数据进入 Apache Druid 之前汇总数据的一种方式。聚合也可以在查询时指定为许多查询中的一部分。

可用聚合包括：

### Count aggregator

`count` computes the count of Druid rows that match the filters.

```json
{ "type" : "count", "name" : <output_name> }
```

Please note the count aggregator counts the number of Druid rows, which does not always reflect the number of raw events ingested.
This is because Druid can be configured to roll up data at ingestion time. To
count the number of ingested rows of data, include a count aggregator at ingestion time, and a longSum aggregator at
query time.

### Sum aggregators

#### `longSum` aggregator

computes the sum of values as a 64-bit, signed integer

```json
{ "type" : "longSum", "name" : <output_name>, "fieldName" : <metric_name> }
```

`name` – output name for the summed value
`fieldName` – name of the metric column to sum over

#### `doubleSum` aggregator

Computes and stores the sum of values as 64-bit floating point value. Similar to `longSum`

```json
{ "type" : "doubleSum", "name" : <output_name>, "fieldName" : <metric_name> }
```

#### `floatSum` aggregator

Computes and stores the sum of values as 32-bit floating point value. Similar to `longSum` and `doubleSum`

```json
{ "type" : "floatSum", "name" : <output_name>, "fieldName" : <metric_name> }
```

### Min / Max aggregators

#### `doubleMin` aggregator

`doubleMin` computes the minimum of all metric values and Double.POSITIVE_INFINITY

```json
{ "type" : "doubleMin", "name" : <output_name>, "fieldName" : <metric_name> }
```

#### `doubleMax` aggregator

`doubleMax` computes the maximum of all metric values and Double.NEGATIVE_INFINITY

```json
{ "type" : "doubleMax", "name" : <output_name>, "fieldName" : <metric_name> }
```

#### `floatMin` aggregator

`floatMin` computes the minimum of all metric values and Float.POSITIVE_INFINITY

```json
{ "type" : "floatMin", "name" : <output_name>, "fieldName" : <metric_name> }
```

#### `floatMax` aggregator

`floatMax` computes the maximum of all metric values and Float.NEGATIVE_INFINITY

```json
{ "type" : "floatMax", "name" : <output_name>, "fieldName" : <metric_name> }
```

#### `longMin` aggregator

`longMin` computes the minimum of all metric values and Long.MAX_VALUE

```json
{ "type" : "longMin", "name" : <output_name>, "fieldName" : <metric_name> }
```

#### `longMax` aggregator

`longMax` computes the maximum of all metric values and Long.MIN_VALUE

```json
{ "type" : "longMax", "name" : <output_name>, "fieldName" : <metric_name> }
```

### `doubleMean` aggregator

Computes and returns the arithmetic mean of a column's values as a 64-bit floating point value. `doubleMean` is a query time aggregator only. It is not available for indexing.

To accomplish mean aggregation on ingestion, refer to the [Quantiles aggregator](../development/extensions-core/datasketches-quantiles.md#aggregator) from the DataSketches extension.

```json
{ "type" : "doubleMean", "name" : <output_name>, "fieldName" : <metric_name> }
```

### First / Last aggregator

(Double/Float/Long) First and Last aggregator cannot be used in ingestion spec, and should only be specified as part of queries.

Note that queries with first/last aggregators on a segment created with rollup enabled will return the rolled up value, and not the last value within the raw ingested data.

#### `doubleFirst` aggregator

`doubleFirst` computes the metric value with the minimum timestamp or 0 in default mode or `null` in SQL compatible mode if no row exist

```json
{
  "type" : "doubleFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `doubleLast` aggregator

`doubleLast` computes the metric value with the maximum timestamp or 0 in default mode or `null` in SQL compatible mode if no row exist

```json
{
  "type" : "doubleLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `floatFirst` aggregator

`floatFirst` computes the metric value with the minimum timestamp or 0 in default mode or `null` in SQL compatible mode if no row exist

```json
{
  "type" : "floatFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `floatLast` aggregator

`floatLast` computes the metric value with the maximum timestamp or 0 in default mode or `null` in SQL compatible mode if no row exist

```json
{
  "type" : "floatLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `longFirst` aggregator

`longFirst` computes the metric value with the minimum timestamp or 0 in default mode or `null` in SQL compatible mode if no row exist

```json
{
  "type" : "longFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `longLast` aggregator

`longLast` computes the metric value with the maximum timestamp or 0 in default mode or `null` in SQL compatible mode if no row exist

```json
{
  "type" : "longLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
}
```

#### `stringFirst` aggregator

`stringFirst` computes the metric value with the minimum timestamp or `null` if no row exist

```json
{
  "type" : "stringFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
  "maxStringBytes" : <integer> # (optional, defaults to 1024)
}
```



#### `stringLast` aggregator

`stringLast` computes the metric value with the maximum timestamp or `null` if no row exist

```json
{
  "type" : "stringLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
  "maxStringBytes" : <integer> # (optional, defaults to 1024)
}
```

### ANY aggregator

(Double/Float/Long/String) ANY aggregator cannot be used in ingestion spec, and should only be specified as part of queries.

Returns any value including null. This aggregator can simplify and optimize the performance by returning the first encountered value (including null)

#### `doubleAny` aggregator

`doubleAny` returns any double metric value

```json
{
  "type" : "doubleAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `floatAny` aggregator

`floatAny` returns any float metric value

```json
{
  "type" : "floatAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

#### `longAny` aggregator

`longAny` returns any long metric value

```json
{
  "type" : "longAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
}
```

#### `stringAny` aggregator

`stringAny` returns any string metric value

```json
{
  "type" : "stringAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
  "maxStringBytes" : <integer> # (optional, defaults to 1024),
}
```

### JavaScript aggregator

Computes an arbitrary JavaScript function over a set of columns (both metrics and dimensions are allowed). Your
JavaScript functions are expected to return floating-point values.

```json
{ "type": "javascript",
  "name": "<output_name>",
  "fieldNames"  : [ <column1>, <column2>, ... ],
  "fnAggregate" : "function(current, column1, column2, ...) {
                     <updates partial aggregate (current) based on the current row values>
                     return <updated partial aggregate>
                   }",
  "fnCombine"   : "function(partialA, partialB) { return <combined partial results>; }",
  "fnReset"     : "function()                   { return <initial value>; }"
}
```

**Example**

```json
{
  "type": "javascript",
  "name": "sum(log(x)*y) + 10",
  "fieldNames": ["x", "y"],
  "fnAggregate" : "function(current, a, b)      { return current + (Math.log(a) * b); }",
  "fnCombine"   : "function(partialA, partialB) { return partialA + partialB; }",
  "fnReset"     : "function()                   { return 10; }"
}
```

> JavaScript-based functionality is disabled by default. Please refer to the Druid [JavaScript programming guide](../development/javascript.md) for guidelines about using Druid's JavaScript functionality, including instructions on how to enable it.

<a name="approx"></a>

## Approximate Aggregations

### Count distinct

#### Apache DataSketches Theta Sketch

The [DataSketches Theta Sketch](../development/extensions-core/datasketches-theta.md) extension-provided aggregator gives distinct count estimates with support for set union, intersection, and difference post-aggregators, using Theta sketches from the [Apache DataSketches](https://datasketches.apache.org/) library.

#### Apache DataSketches HLL Sketch

The [DataSketches HLL Sketch](../development/extensions-core/datasketches-hll.md) extension-provided aggregator gives distinct count estimates using the HyperLogLog algorithm.

Compared to the Theta sketch, the HLL sketch does not support set operations and has slightly slower update and merge speed, but requires significantly less space.

#### Cardinality, hyperUnique

> For new use cases, we recommend evaluating [DataSketches Theta Sketch](../development/extensions-core/datasketches-theta.md) or [DataSketches HLL Sketch](../development/extensions-core/datasketches-hll.md) instead.
> The DataSketches aggregators are generally able to offer more flexibility and better accuracy than the classic Druid `cardinality` and `hyperUnique` aggregators.

The [Cardinality and HyperUnique](../querying/hll-old.md) aggregators are older aggregator implementations available by default in Druid that also provide distinct count estimates using the HyperLogLog algorithm. The newer DataSketches Theta and HLL extension-provided aggregators described above have superior accuracy and performance and are recommended instead.

The DataSketches team has published a [comparison study](https://datasketches.apache.org/docs/HLL/HllSketchVsDruidHyperLogLogCollector.html) between Druid's original HLL algorithm and the DataSketches HLL algorithm. Based on the demonstrated advantages of the DataSketches implementation, we are recommending using them in preference to Druid's original HLL-based aggregators.
However, to ensure backwards compatibility, we will continue to support the classic aggregators.

Please note that `hyperUnique` aggregators are not mutually compatible with Datasketches HLL or Theta sketches.

##### Multi-column handling

Note the DataSketches Theta and HLL aggregators currently only support single-column inputs. If you were previously using the Cardinality aggregator with multiple-column inputs, equivalent operations using Theta or HLL sketches are described below:

* Multi-column `byValue` Cardinality can be replaced with a union of Theta sketches on the individual input columns
* Multi-column `byRow` Cardinality can be replaced with a Theta or HLL sketch on a single [virtual column](../querying/virtual-columns.md) that combines the individual input columns.

### Histograms and quantiles

#### DataSketches Quantiles Sketch

The [DataSketches Quantiles Sketch](../development/extensions-core/datasketches-quantiles.md) extension-provided aggregator provides quantile estimates and histogram approximations using the numeric quantiles DoublesSketch from the [datasketches](https://datasketches.apache.org/) library.

We recommend this aggregator in general for quantiles/histogram use cases, as it provides formal error bounds and has distribution-independent accuracy.

#### Moments Sketch (Experimental)

The [Moments Sketch](../development/extensions-contrib/momentsketch-quantiles.md) extension-provided aggregator is an experimental aggregator that provides quantile estimates using the [Moments Sketch](https://github.com/stanford-futuredata/momentsketch).

The Moments Sketch aggregator is provided as an experimental option. It is optimized for merging speed and it can have higher aggregation performance compared to the DataSketches quantiles aggregator. However, the accuracy of the Moments Sketch is distribution-dependent, so users will need to empirically verify that the aggregator is suitable for their input data.

As a general guideline for experimentation, the [Moments Sketch paper](https://arxiv.org/pdf/1803.01969.pdf) points out that this algorithm works better on inputs with high entropy. In particular, the algorithm is not a good fit when the input data consists of a small number of clustered discrete values.

#### Fixed Buckets Histogram

Druid also provides a [simple histogram implementation](../development/extensions-core/approximate-histograms.md#fixed-buckets-histogram) that uses a fixed range and fixed number of buckets with support for quantile estimation, backed by an array of bucket count values.

The fixed buckets histogram can perform well when the distribution of the input data allows a small number of buckets to be used.

We do not recommend the fixed buckets histogram for general use, as its usefulness is extremely data dependent. However, it is made available for users that have already identified use cases where a fixed buckets histogram is suitable.

#### Approximate Histogram (deprecated)

> The Approximate Histogram aggregator is deprecated.
> There are a number of other quantile estimation algorithms that offer better performance, accuracy, and memory footprint.
> We recommend using [DataSketches Quantiles](../development/extensions-core/datasketches-quantiles.md) instead.

The [Approximate Histogram](../development/extensions-core/approximate-histograms.md) extension-provided aggregator also provides quantile estimates and histogram approximations, based on [http://jmlr.org/papers/volume11/ben-haim10a/ben-haim10a.pdf](http://jmlr.org/papers/volume11/ben-haim10a/ben-haim10a.pdf).

The algorithm used by this deprecated aggregator is highly distribution-dependent and its output is subject to serious distortions when the input does not fit within the algorithm's limitations.

A [study published by the DataSketches team](https://datasketches.apache.org/docs/QuantilesStudies/DruidApproxHistogramStudy.html) demonstrates some of the known failure modes of this algorithm:

- The algorithm's quantile calculations can fail to provide results for a large range of rank values (all ranks less than 0.89 in the example used in the study), returning all zeroes instead.
- The algorithm can completely fail to record spikes in the tail ends of the distribution
- In general, the histogram produced by the algorithm can deviate significantly from the true histogram, with no bounds on the errors.

It is not possible to determine a priori how well this aggregator will behave for a given input stream, nor does the aggregator provide any indication that serious distortions are present in the output.

For these reasons, we have deprecated this aggregator and recommend using the DataSketches Quantiles aggregator instead for new and existing use cases, although we will continue to support Approximate Histogram for backwards compatibility.

## Miscellaneous Aggregations

### Filtered Aggregator

A filtered aggregator wraps any given aggregator, but only aggregates the values for which the given dimension filter matches.

This makes it possible to compute the results of a filtered and an unfiltered aggregation simultaneously, without having to issue multiple queries, and use both results as part of post-aggregations.

*Note:* If only the filtered results are required, consider putting the filter on the query itself, which will be much faster since it does not require scanning all the data.

```json
{
  "type" : "filtered",
  "filter" : {
    "type" : "selector",
    "dimension" : <dimension>,
    "value" : <dimension value>
  },
  "aggregator" : <aggregation>
}
```

### Grouping Aggregator

A grouping aggregator can only be used as part of GroupBy queries which have a subtotal spec. It returns a number for
each output row that lets you infer whether a particular dimension is included in the sub-grouping used for that row. You can pass
a *non-empty* list of dimensions to this aggregator which *must* be a subset of dimensions that you are grouping on.
E.g if the aggregator has `["dim1", "dim2"]` as input dimensions and `[["dim1", "dim2"], ["dim1"], ["dim2"], []]` as subtotals,
following can be the possible output of the aggregator

| subtotal used in query | Output | (bits representation) |
|------------------------|--------|-----------------------|
| `["dim1", "dim2"]`       | 0      | (00)                  |
| `["dim1"]`               | 1      | (01)                  |
| `["dim2"]`               | 2      | (10)                  |
| `[]`                     | 3      | (11)                  |  

As illustrated in above example, output number can be thought of as an unsigned n bit number where n is the number of dimensions passed to the aggregator.
The bit at position X is set in this number to 0 if a dimension at position X in input to aggregators is included in the sub-grouping. Otherwise, this bit
is set to 1.

```json
{ "type" : "grouping", "name" : <output_name>, "groupings" : [<dimension>] }
```




## 聚合(Aggregations)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

聚合可以在摄取时作为摄取规范的一部分提供，作为在数据进入Apache Druid之前汇总数据的一种方式。聚合也可以在查询时指定为许多查询的一部分。

可用聚合包括：

### Count聚合器

`count`计算了过滤器匹配到行的总数：

```json
{ "type" : "count", "name" : <output_name> }
```

请注意计数聚合器计算Druid的行数，这并不总是反映摄取的原始事件数。这是因为Druid可以配置为在摄取时汇总数据。要计算摄取的数据行数，请在摄取时包括`count`聚合器，在查询时包括`longSum`聚合器。

### Sum聚合器

**`longSum`**

计算64位有符号整数的和

```json
{ "type" : "longSum", "name" : <output_name>, "fieldName" : <metric_name> }
```
`name` 为求和后值的输出名

`fieldName` 为需要求和的指标列

**`doubleSum`**

计算64位浮点数的和，与`longSum`相似

```json
{ "type" : "doubleSum", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`floatSum`**

计算32位浮点数的和，与`longSum`和`doubleSum`相似

```json
{ "type" : "floatSum", "name" : <output_name>, "fieldName" : <metric_name> }
```
### Min/Max聚合器

**`doubleMin`**

`doubleMin`计算所有指标值与Double.POSITIVE_INFINITY相比的较小者

```json
{ "type" : "doubleMin", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`doubleMax`**

`doubleMax`计算所有指标值与Double.NEGATIVE_INFINITY相比的较大者

```json
{ "type" : "doubleMax", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`floatMin`**

`floatMin`计算所有指标值与Float.POSITIVE_INFINITY相比的较小者

```json
{ "type" : "floatMin", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`floatMax`**

`floatMax`计算所有指标值与Float.NEGATIVE_INFINITY相比的较大者

```json
{ "type" : "floatMax", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`longMin`**

`longMin`计算所有指标值与Long.MAX_VALUE的较小者

```json
{ "type" : "longMin", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`longMax`**

`longMax`计算所有指标值与Long.MIN_VALUE的较大者

```json
{ "type" : "longMax", "name" : <output_name>, "fieldName" : <metric_name> }
```

**`doubleMean`**

计算并返回列值的算术平均值作为64位浮点值。这只是一个查询时聚合器，不应在摄入期间使用。

```json
{ "type" : "doubleMean", "name" : <output_name>, "fieldName" : <metric_name> }
```

### First/Last聚合器

Double/Float/Long的First/Last聚合器不能够使用在摄入规范中，只能指定为查询时的一部分。

需要注意，在启用了rollup的段上进行带有first/last聚合器查询将返回汇总后的值，并不是返回原始数据的最后一个值。

**`doubleFirst`**

`doubleFirst`计算最小时间戳的指标值，如果不存在行的话，默认为0或者SQL兼容下是`null`

```json
{
  "type" : "doubleFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`doubleLast`**

`doubleLast`计算最大时间戳的指标值，如果不存在行的话，默认为0或者SQL兼容下是`null`

```json
{
  "type" : "doubleLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`floatFirst`**

`floatFirst`计算最小时间戳的指标值，如果不存在行的话，默认为0或者SQL兼容下是`null`

```json
{
  "type" : "floatFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`floatLast`**

`floatLast`计算最大时间戳的指标值，如果不存在行的话，默认为0或者SQL兼容下是`null`

```json
{
  "type" : "floatLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`longFirst`**

`longFirst`计算最小时间戳的指标值，如果不存在行的话，默认为0或者SQL兼容下是`null`

```json
{
  "type" : "longFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`longLast`**

`longLast`计算最大时间戳的指标值，如果不存在行的话，默认为0或者SQL兼容下是`null`

```json
{
  "type" : "longLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
}
```

**`stringFirst`**

`stringFirst` 计算最小时间戳的维度值，行不存在的话为`null`

```json
{
  "type" : "stringFirst",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
  "maxStringBytes" : <integer> # (optional, defaults to 1024)
}
```

**`stringLast`**

`stringLast` 计算最大时间戳的维度值，行不存在的话为`null`

```json
{
  "type" : "stringLast",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
  "maxStringBytes" : <integer> # (optional, defaults to 1024)
}
```

### ANY聚合器

Double/Float/Long/String的ANY聚合器不能够使用在摄入规范中，只能指定为查询时的一部分。

返回包括null在内的任何值。此聚合器可以通过返回第一个遇到的值（包括null）来简化和优化性能

**`doubleAny`**

`doubleAny`返回所有double类型的指标值

```json
{
  "type" : "doubleAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`floatAny`**

`floatAny`返回所有float类型的指标值

```json
{
  "type" : "floatAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>
}
```

**`longAny`**

`longAny`返回所有long类型的指标值

```json
{
  "type" : "longAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
}
```

**`stringAny`**

`stringAny`返回所有string类型的指标值

```json
{
  "type" : "stringAny",
  "name" : <output_name>,
  "fieldName" : <metric_name>,
  "maxStringBytes" : <integer> # (optional, defaults to 1024),
}
```

### JavaScript聚合器

计算一组列上的任意JavaScript函数（同时允许指标和维度）。JavaScript函数应该返回浮点值。

```json
{ "type": "javascript",
  "name": "<output_name>",
  "fieldNames"  : [ <column1>, <column2>, ... ],
  "fnAggregate" : "function(current, column1, column2, ...) {
                     <updates partial aggregate (current) based on the current row values>
                     return <updated partial aggregate>
                   }",
  "fnCombine"   : "function(partialA, partialB) { return <combined partial results>; }",
  "fnReset"     : "function()                   { return <initial value>; }"
}
```

实例：

```json
{
  "type": "javascript",
  "name": "sum(log(x)*y) + 10",
  "fieldNames": ["x", "y"],
  "fnAggregate" : "function(current, a, b)      { return current + (Math.log(a) * b); }",
  "fnCombine"   : "function(partialA, partialB) { return partialA + partialB; }",
  "fnReset"     : "function()                   { return 10; }"
}
```

> [!WARNING]
> 基于JavaScript的功能默认是禁用的。 如何启用它以及如何使用Druid JavaScript功能，参考 [JavaScript编程指南](../development/JavaScript.md)。

### 近似聚合(Approximate Aggregations)
#### 唯一计数(Count distinct)

**Apache DataSketches Theta Sketch**

聚合器提供的[DataSketches Theta Sketch扩展](../configuration/core-ext/datasketches-theta.md) 使用[Apache Datasketches库](https://datasketches.apache.org/) 中的Theta Sketch提供不同的计数估计，并支持集合并集、交集和差分后置聚合器。

**Apache DataSketches HLL Sketch**

聚合器提供的[DataSketches HLL Sketch扩展](../configuration/core-ext/datasketches-hll.md)使用HyperLogLog算法给出不同的计数估计。

与Theta草图相比，HLL草图不支持set操作，更新和合并速度稍慢，但需要的空间要少得多

**Cardinality, hyperUnique**

> [!WARNING]
> 对于新的场景，我们推荐评估使用 [DataSketches Theta Sketch扩展](../configuration/core-ext/datasketches-theta.md) 和 [DataSketches HLL Sketch扩展](../configuration/core-ext/datasketches-hll.md) 来替代。 DataSketch聚合器通常情况下比经典的Druid `cardinality` 和 `hyperUnique` 聚合器提供更弹性的和更好的精确度。

Cardinality和HyperUnique聚合器是在Druid中默认提供的较旧的聚合器实现，它们还使用HyperLogLog算法提供不同的计数估计。较新的数据集Theta和HLL扩展提供了上述聚合器，具有更高的精度和性能，因此建议改为使用。

DataSketches团队已经发表了一篇关于Druid原始HLL算法和DataSketches HLL算法的比较研究。基于数据集实现已证明的优势，我们建议优先使用它们，而不是使用Druid最初基于HLL的聚合器。但是，为了确保向后兼容性，我们将继续支持经典聚合器。

请注意，`hyperUnique`聚合器与Detasketches HLL或Theta sketches不相互兼容。

**多列操作(multi-column handling)**

#### 直方图与中位数
### 其他聚合
#### 过滤聚合器