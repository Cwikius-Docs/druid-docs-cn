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

聚合器提供的[DataSketches Theta Sketch扩展](../Configuration/core-ext/datasketches-theta.md) 使用[Apache Datasketches库](https://datasketches.apache.org/) 中的Theta Sketch提供不同的计数估计，并支持集合并集、交集和差分后置聚合器。

**Apache DataSketches HLL Sketch**

聚合器提供的[DataSketches HLL Sketch扩展](../Configuration/core-ext/datasketches-hll.md)使用HyperLogLog算法给出不同的计数估计。

与Theta草图相比，HLL草图不支持set操作，更新和合并速度稍慢，但需要的空间要少得多

**Cardinality, hyperUnique**

> [!WARNING]
> 对于新的场景，我们推荐评估使用 [DataSketches Theta Sketch扩展](../Configuration/core-ext/datasketches-theta.md) 和 [DataSketches HLL Sketch扩展](../Configuration/core-ext/datasketches-hll.md) 来替代。 DataSketch聚合器通常情况下比经典的Druid `cardinality` 和 `hyperUnique` 聚合器提供更弹性的和更好的精确度。

Cardinality和HyperUnique聚合器是在Druid中默认提供的较旧的聚合器实现，它们还使用HyperLogLog算法提供不同的计数估计。较新的数据集Theta和HLL扩展提供了上述聚合器，具有更高的精度和性能，因此建议改为使用。

DataSketches团队已经发表了一篇关于Druid原始HLL算法和DataSketches HLL算法的比较研究。基于数据集实现已证明的优势，我们建议优先使用它们，而不是使用Druid最初基于HLL的聚合器。但是，为了确保向后兼容性，我们将继续支持经典聚合器。

请注意，`hyperUnique`聚合器与Detasketches HLL或Theta sketches不相互兼容。

**多列操作(multi-column handling)**

#### 直方图与中位数
### 其他聚合
#### 过滤聚合器