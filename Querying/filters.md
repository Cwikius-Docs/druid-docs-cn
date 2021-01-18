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

## 查询过滤器（Query Filters）

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

Filter是一个JSON对象，指示查询的计算中应该包含哪些数据行。它本质上相当于SQL中的WHERE子句。Apache Druid支持以下类型的过滤器。

**注意**

过滤器通常情况下应用于维度列，但是也可以使用在聚合后的指标上，例如，参见 [filtered-aggregator](Aggregations.md#过滤聚合器) 和 [having-filter](having.md)

### **选择过滤器(Selector Filter)**

最简单的过滤器就是选择过滤器。 选择过滤器使用一个特定的值来匹配一个特定的维度。 选择过滤器可以被用来当做更复杂的布尔表示式过滤器的基础过滤器。

选择过滤器的语法如下：

```json
"filter": { "type": "selector", "dimension": <dimension_string>, "value": <dimension_value_string> }
```

该表达式等价于 `WHERE <dimension_string> = '<dimension_value_string>'` 

选择过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

### **列比较过滤器(Column Comparison Filter)**

列比较过滤器与选择过滤器很相似，不同的是比较的不同的维度。例如：

```json
"filter": { "type": "columnComparison", "dimensions": [<dimension_a>, <dimension_b>] }
```
该表达式等价于 `WHERE <dimension_a> = <dimension_b>` 

`dimensions` 为 [DimensionSpecs](dimensionspec.md)中的list， 需要的话还可以使用提取函数。

### **正则表达式过滤器(Regular expression Filter)**

正则表达式过滤器与选择过滤器相似，不同的是使用正则表达式。 它使用一个给定的模式来匹配特性的维度。 模式可以是任意的标准 [Java正则表达式](https://docs.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html)

```json
"filter": { "type": "regex", "dimension": <dimension_string>, "pattern": <pattern_string> }
```

正则表达式支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

### **逻辑表达式过滤器(Logical expression Filter)**

**AND**

AND过滤器的语法如下：

```json
"filter": { "type": "and", "fields": [<filter>, <filter>, ...] }
```

该过滤器的fields字段中可以是本页中的任何一个过滤器

**OR**

OR过滤器的语法如下：

```json
"filter": { "type": "or", "fields": [<filter>, <filter>, ...] }
```

该过滤器的fields字段中可以是本页中的任何一个过滤器

**NOT**

NOT过滤器的语法如下：

```json
"filter": { "type": "not", "field": <filter> }
```

该过滤器的field字段中可以是本页中的任何一个过滤器

### **JavaScript过滤器**

JavaScript过滤器使用一个特定的js函数来匹配维度。 该过滤器匹配到函数返回为true的值。

JavaScript函数需要一个维度值的参数，返回值要么是true或者false

```json
{
  "type" : "javascript",
  "dimension" : <dimension_string>,
  "function" : "function(value) { <...> }"
}
```

例如， 下边的表达式将匹配维度 `name` 在 `bar` 和 `foo` 之间的维度值。

```json
{
  "type" : "javascript",
  "dimension" : "name",
  "function" : "function(x) { return(x >= 'bar' && x <= 'foo') }"
}
```

JavaScript过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

> [!WARNING]
> 基于JavaScript的功能默认是禁用的。 如何启用它以及如何使用Druid JavaScript功能，参考 [JavaScript编程指南](../Development/JavaScript.md)。

### **提取过滤器(Extraction Filter)**

> [!WARNING]
> 提取过滤器当前已经废弃。 指定了提取函数的选择器过滤器提供了相同的功能，应该改用它。

提取过滤器使用一个特定的 [提取函数](dimensionspec.md) 来匹配维度。 以下筛选器匹配提取函数具有转换条目`input_key=output_value`的值，其中`output_value`等于过滤器`value`，`input_key`作为维度显示。

例如， 下列例子匹配 `product` 列中维度值为 `[product_1, product_3, product_5]`的数据：

```json
{
    "filter": {
        "type": "extraction",
        "dimension": "product",
        "value": "bar_1",
        "extractionFn": {
            "type": "lookup",
            "lookup": {
                "type": "map",
                "map": {
                    "product_1": "bar_1",
                    "product_5": "bar_1",
                    "product_3": "bar_1"
                }
            }
        }
    }
}
```

### **搜索过滤器(Search Filter)**

搜索过滤器可以使用在部分字符串上进行过滤匹配

```json
{
    "filter": {
        "type": "search",
        "dimension": "product",
        "query": {
          "type": "insensitive_contains",
          "value": "foo"
        }
    }
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 该值始终为`search` | 是 |
| `dimension` | 要执行搜索的维度 | 是 |
| `query` | 搜索类型的详细JSON对象。 详情可看下边 | 是 |
| `extractionFn` | 对维度使用的 [提取函数](dimensionspec.md) | 否 |

搜索过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

**搜索查询规格**

*Contains*

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 该值始终为`contains` | 是 |
| `value` | 要执行搜索的字符串值 | 是 |
| `caseSensitive` | 两个字符串比较时是否忽略大小写 | 否（默认为false） |

*Insensitive Contains*

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 该值始终为`insensitive_contains` | 是 |
| `value` | 要执行搜索的字符串值 | 是 |

注意：一个"insensitive_contains"搜索等价于一个具有值为false或者未提供的"caseSensitive"的"contains"搜索

*Fragment*

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 该值始终为`fragment` | 是 |
| `values` | 要执行搜索的字符串值数组 | 是 |
| `caseSensitive` | 两个字符串比较时是否忽略大小写 | 否（默认为false） |

### **In过滤器**

In过滤器可以用来表达以下SQL查询：

```sql
 SELECT COUNT(*) AS 'Count' FROM `table` WHERE `outlaw` IN ('Good', 'Bad', 'Ugly')
 ```

 In过滤器的语法如下：

 ```json
 {
    "type": "in",
    "dimension": "outlaw",
    "values": ["Good", "Bad", "Ugly"]
}
```

In过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

如果一个空的`values`传给了In过滤器，则简单的返回一个空的结果。 如果 `dimension`为多值维度，则当维度中的一个值在 `values`数组中时In过滤器将返回true

### **Like过滤器**

Like过滤器被用于基本的通配符搜索，等价于SQL中的LIKE语句。 特定的符号支持"%"(匹配任意数量的字符)和"_"(匹配任意单个字符)

| 属性 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 该值始终为`fragment` | 是 |
| `dimension` | String | 需要过滤的维度 | 是 |
| `pattern` | String | LIKE模式， 例如"foo%"或者"__bar" | 是 |
| `escape` | String | 可以用来转义特殊字符的转义符号 | 否 |
| `extractionFn` | [提取函数](dimensionspec.md) | 对维度使用的 [提取函数](dimensionspec.md)  | 否 |

Like过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

下边的Like过滤器表达了条件 `last_name LIKE "D%"`, 即： last_name以D开头

```json
{
    "type": "like",
    "dimension": "last_name",
    "pattern": "D%"
}
```

### **边界过滤器(Bound Filter)**

边界过滤器可以过滤一定范围内的维度值， 它可以用来比较大于、小于、大于等于、小于等于等

| 属性 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 该值始终为`fragment` | 是 |
| `dimension` | String | 需要过滤的维度 | 是 |
| `lower` | String | 边界过滤的下边界 | 是 |
| `upper` | String | 边界过滤的上边界 | 是 |
| `lowerStrict` | Boolean | 下边界严格比较， 是">"而非">=" | 否，默认为false |
| `upperStrict` | Boolean | 上边界严格比较，是"<"而非"<=" | 否，默认为false |
| `ordering` | String | 指定将值与边界进行比较时要使用的排序顺序。值可以为以下值之一："lexicographic", "alphanumeric", "numeric", "strlen", "version"。 详情可以查看 [Sorting-Orders](sorting-orders.md) | 否，默认为"lexicographic" |
| `extractionFn` | [提取函数](dimensionspec.md) | 对维度使用的 [提取函数](dimensionspec.md)  | 否 |

边界过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

以下边界过滤器表达式指的是 `21 <= age <= 31`:

```json
{
    "type": "bound",
    "dimension": "age",
    "lower": "21",
    "upper": "31" ,
    "ordering": "numeric"
}
```

以下表达式表达的是 `foo <= name <= hoo`, 使用默认的排序方式:

```json
{
    "type": "bound",
    "dimension": "name",
    "lower": "foo",
    "upper": "hoo"
}
```

使用严格边界，以下表达式表示  `21 < age < 31`:

```json
{
    "type": "bound",
    "dimension": "age",
    "lower": "21",
    "lowerStrict": true,
    "upper": "31" ,
    "upperStrict": true,
    "ordering": "numeric"
}
```

以下表达式表示了一个单一边界，表示  `age < 31`:

```json
{
    "type": "bound",
    "dimension": "age",
    "upper": "31" ,
    "upperStrict": true,
    "ordering": "numeric"
}
```

相反，以下表达式表示 `age >= 18`:

```json
{
    "type": "bound",
    "dimension": "age",
    "lower": "18" ,
    "ordering": "numeric"
}
```

### **间隔过滤器(Interval Filter)**

间隔过滤器针对包含长毫秒值的列启用范围过滤，边界指定为ISO-8601时间间隔。 它适用于 `__time`列， Long类型的指标列，和值可以解析为长毫秒的维度列。

该过滤器将ISO-8601的时间间隔转换为开始/结束范围，同时将这些毫秒范围转换为边界过滤器的OR操作。 边界过滤器为左闭右开匹配，（例如，start  <= time < end）

| 属性 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 该值始终为`interval` | 是 |
| `dimension` | String | 需要过滤的维度 | 是 |
| `interval` | Array | 包含了ISO-8601间隔字符串的JSON数组，该字段定义了要过滤的时间范围 | 是 |
| `extractionFn` | [提取函数](dimensionspec.md) | 对维度使用的 [提取函数](dimensionspec.md)  | 否 |

间隔过滤器支持使用提取函数，详情可见 [带提取函数的过滤器](#带提取函数的过滤器)

如果在该过滤器中使用提取函数，则提取函数的输出值应该是可以解析成长毫秒类型的。

下列实例展示了过滤时间范围在2014年10月1日到7日、2014年11月15日-16日的数据：

```json
{
    "type" : "interval",
    "dimension" : "__time",
    "intervals" : [
      "2014-10-01T00:00:00.000Z/2014-10-07T00:00:00.000Z",
      "2014-11-15T00:00:00.000Z/2014-11-16T00:00:00.000Z"
    ]
}
```

上述过滤器等价于下边的OR连接的边界过滤器：

```json
{
    "type": "or",
    "fields": [
      {
        "type": "bound",
        "dimension": "__time",
        "lower": "1412121600000",
        "lowerStrict": false,
        "upper": "1412640000000" ,
        "upperStrict": true,
        "ordering": "numeric"
      },
      {
         "type": "bound",
         "dimension": "__time",
         "lower": "1416009600000",
         "lowerStrict": false,
         "upper": "1416096000000" ,
         "upperStrict": true,
         "ordering": "numeric"
      }
    ]
}
```
#### **带提取函数的过滤**

除了"spatial"之外的所有的过滤器都支持提取函数，提取函数通过在过滤器的 `extractionFn` 字段中设置。 关于提取函数更多的信息可以参见[提取函数](dimensionspec.md)

如果指定了，提取函数将在过滤器之前对输入数据进行转换。 下边的实例展示了一个带有提取函数的选择过滤器，该过滤器首先根据预定义的lookup值来转换输入值，然后转换后的值匹配到了 `bar_1`。

实例： 下边的例子对于 `product`列来进行匹配 `[product_1, product_3, product_5]` 中的维度值。

```json
{
    "filter": {
        "type": "selector",
        "dimension": "product",
        "value": "bar_1",
        "extractionFn": {
            "type": "lookup",
            "lookup": {
                "type": "map",
                "map": {
                    "product_1": "bar_1",
                    "product_5": "bar_1",
                    "product_3": "bar_1"
                }
            }
        }
    }
}
```

### 列类型

Druid支持在时间戳、字符串、长整型和浮点数列上进行过滤。

注意：仅仅是字符串类型的列有位图索引。 因此，在其他类型的列上进行过滤将需要扫描列数据。

**在数值列上进行过滤**

在对数值列进行过滤时，可以将过滤器当作字符串来编写。在大多数情况下，筛选器将转换为数值，并将直接应用于数值列值。在某些情况下（如正则过滤器），数字列值将在扫描期间转换为字符串。

例如，在一个特定值过滤，`myFloatColumn = 10.1`:

```json
"filter": {
  "type": "selector",
  "dimension": "myFloatColumn",
  "value": "10.1"
}
```
在一个范围值进行过滤， `10 <= myFloatColumn < 20`:

```json
"filter": {
  "type": "bound",
  "dimension": "myFloatColumn",
  "ordering": "numeric",
  "lower": "10",
  "lowerStrict": false,
  "upper": "20",
  "upperStrict": true
}
```

**在时间戳列上进行过滤**

查询过滤器同时也可以应用于时间戳列。 时间戳列有长毫秒值。 时间戳列的使用是通过字符串 `__time` 来当做维度名称的。 和数值型维度类似， 当时间戳的值为字符串时，时间戳过滤器需要被指定。

如果我们希望以一个特定的格式（时区等）来解释时间戳，[时间格式转换函数](dimensionspec.md) 是非常有用的。

例如，对一个长时间戳值进行过滤：

```json
"filter": {
  "type": "selector",
  "dimension": "__time",
  "value": "124457387532"
}
```

对一周的一天进行过滤：

```json
"filter": {
  "type": "selector",
  "dimension": "__time",
  "value": "Friday",
  "extractionFn": {
    "type": "timeFormat",
    "format": "EEEE",
    "timeZone": "America/New_York",
    "locale": "en"
  }
}
```

对一个ISO-8601时间间隔集合进行过滤：

```json
{
    "type" : "interval",
    "dimension" : "__time",
    "intervals" : [
      "2014-10-01T00:00:00.000Z/2014-10-07T00:00:00.000Z",
      "2014-11-15T00:00:00.000Z/2014-11-16T00:00:00.000Z"
    ]
}
```

### True过滤器

true过滤器是匹配所有值的过滤器。它可以用来暂时禁用其他过滤器而不删除过滤器。

```json
{ "type" : "true" }
```
