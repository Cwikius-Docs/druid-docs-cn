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

## 后聚合(Post-Aggregations)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

后聚合是一种用来操作已经聚合后的值的处理规范，如果在查询时包括后聚合，需要确保包含后聚合需要的所有的聚合器。

有以下几种可用的后聚合器

### 算术后聚合器(Arithmetic post-aggregator)

算术后聚合器对给定的字段进行从左到右执行提供的函数。 字段可以是聚合器，或者其他后聚合器。

支持的函数有 `+`, `-`, `*`, `/` 和 `quotient`

**注意**：

* 不管分子是什么，`/` 中除以 `0` 总是返回 `0`
*  `quotient` 商除法的行为类似于常规浮点除法

算术后聚合器可能也需要指定一个 `ordering`, 该字段当需要排序结果（对于topN查询非常有用）时定义了结果值的顺序：

* 如果没有`ordering`被指定，或者指定为 `null`, 将会默认使用浮点值排序
* `numericFirst` 排序总是首先返回有限值，然后返回 `NaN`，最后返回无限值

算术后聚合器的语法是：

```json
postAggregation : {
  "type"  : "arithmetic",
  "name"  : <output_name>,
  "fn"    : <arithmetic_function>,
  "fields": [<post_aggregator>, <post_aggregator>, ...],
  "ordering" : <null (default), or "numericFirst">
}
```

### 字段访问后聚合器(Field accessor post-aggregators)

该后聚合器返回由指定的 [聚合器](Aggregations.md) 输出的值。

`fieldName` 引用在查询时 [聚合部分](Aggregations.md) 给定的聚合器的输出名。 对于复杂的聚合器，如 "cardinality" 和 "hyperUnique", 后聚合器的 `type` 决定了后聚合器将返回什么。 使用 `"fieldAccess" type` 将返回原始的聚合对象，或者使用 `"finalizingFieldAccess" type` 返回最终确定的值，例如估计的基数。

```json
{ "type" : "fieldAccess", "name": <output_name>, "fieldName" : <aggregator_name> }
```

或者 

```json
{ "type" : "finalizingFieldAccess", "name": <output_name>, "fieldName" : <aggregator_name> }
```

### 常数后聚合器(Constant post-aggregator)

常数后聚合器总是返回特定的值

```json
{ "type"  : "constant", "name"  : <output_name>, "value" : <numerical_value> }
```

### 最大/最小后聚合器(Greatest / Least post-aggregators)

`doubleGreatest` 和 `longGreatest` 计算所有的值与Double.NEGATIVE_INFINITY的最大值。`doubleLeast` 和 `longLeast` 计算所有的值与Double.POSITIVE_INFINITY的最小值。

`doubleMax` 与 `doubleGreatest` 的不同之处是： `doubleMax` 返回的某个特定列的所有行的最大值，而 `doubleGreatest` 返回的是一个行中多个列的最大值。 这与SQL中的 [MAX](https://dev.mysql.com/doc/refman/5.7/en/group-by-functions.html#function_max) 和 [GREATEST](https://dev.mysql.com/doc/refman/5.7/en/comparison-operators.html#function_greatest) 函数是类似的。

实例：

```json
{
  "type"  : "doubleGreatest",
  "name"  : <output_name>,
  "fields": [<post_aggregator>, <post_aggregator>, ...]
}
```

### JavaScript后聚合器(JavaScript post-aggregator)

对给定的字段使用提供的JavaScript函数。 字段按给定顺序传入到JavaScript函数。

```json
postAggregation : {
  "type": "javascript",
  "name": <output_name>,
  "fieldNames" : [<aggregator_name>, <aggregator_name>, ...],
  "function": <javascript function>
}
```

实例：

```json
{
  "type": "javascript",
  "name": "absPercent",
  "fieldNames": ["delta", "total"],
  "function": "function(delta, total) { return 100 * Math.abs(delta) / total; }"
}
```

> [!WARNING]
> 基于JavaScript的功能默认是禁用的。 如何启用它以及如何使用Druid JavaScript功能，参考 [JavaScript编程指南](../Development/JavaScript.md)。

### 超唯一基数后置聚合器(HyperUnique Cardinality post-aggregator)

hyperUniqueCardinality后聚合器用于包装hyperUnique对象，以便可以在后聚合中使用它

```json
{
  "type"  : "hyperUniqueCardinality",
  "name": <output name>,
  "fieldName"  : <the name field value of the hyperUnique aggregator>
}
```

可以按照以下计算例子来使用：

```json
  "aggregations" : [{
    {"type" : "count", "name" : "rows"},
    {"type" : "hyperUnique", "name" : "unique_users", "fieldName" : "uniques"}
  }],
  "postAggregations" : [{
    "type"   : "arithmetic",
    "name"   : "average_users_per_row",
    "fn"     : "/",
    "fields" : [
      { "type" : "hyperUniqueCardinality", "fieldName" : "unique_users" },
      { "type" : "fieldAccess", "name" : "rows", "fieldName" : "rows" }
    ]
  }]
```

该后聚合器将继承其引用的聚合器的舍入行为。请注意，只有直接引用聚合器时，此继承才有效。例如，通过另一个后聚合器将导致用户指定的舍入行为丢失，并默认为“no rounding”。

### 使用实例

在本例中，让我们使用后聚合器计算一个简单的百分比。假设我们的数据集有一个称为"total"的指标。

查询JSON的格式如下：

```json
{
  ...
  "aggregations" : [
    { "type" : "count", "name" : "rows" },
    { "type" : "doubleSum", "name" : "tot", "fieldName" : "total" }
  ],
  "postAggregations" : [{
    "type"   : "arithmetic",
    "name"   : "average",
    "fn"     : "/",
    "fields" : [
           { "type" : "fieldAccess", "name" : "tot", "fieldName" : "tot" },
           { "type" : "fieldAccess", "name" : "rows", "fieldName" : "rows" }
         ]
  }]
  ...
}
```

```json
{
  ...
  "aggregations" : [
    { "type" : "doubleSum", "name" : "tot", "fieldName" : "total" },
    { "type" : "doubleSum", "name" : "part", "fieldName" : "part" }
  ],
  "postAggregations" : [{
    "type"   : "arithmetic",
    "name"   : "part_percentage",
    "fn"     : "*",
    "fields" : [
       { "type"   : "arithmetic",
         "name"   : "ratio",
         "fn"     : "/",
         "fields" : [
           { "type" : "fieldAccess", "name" : "part", "fieldName" : "part" },
           { "type" : "fieldAccess", "name" : "tot", "fieldName" : "tot" }
         ]
       },
       { "type" : "constant", "name": "const", "value" : 100 }
    ]
  }]
  ...
}
```

