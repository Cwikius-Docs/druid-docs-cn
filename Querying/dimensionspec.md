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

## 查询维度(Query dimensions)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

下边的JSON字段可以被用于查询中来对维度值进行操作

### DimensionSpec

`DimensionSpecs`定义在聚合之前如何转换维度值。

#### 默认的DimensionSpec

按原样返回维度值，并可选地重命名维度

```json
{
  "type" : "default",
  "dimension" : <dimension>,
  "outputName": <output_name>,
  "outputType": <"STRING"|"LONG"|"FLOAT">
}
```

当在一个数值列上指定了DimensionSpec，用户需要在 `outputType`字段中包括列的类型。 如果未指定，则 `outputType` 默认为STRING。

详情可以参见 [输出类型](#输出类型)

#### 带提取函数的DimensionSpec

返回被给定的[提取函数](#提取函数)转换后的维度值。

```json
{
  "type" : "extraction",
  "dimension" : <dimension>,
  "outputName" :  <output_name>,
  "outputType": <"STRING"|"LONG"|"FLOAT">,
  "extractionFn" : <extraction_function>
}
```

也可以在`ExtractionDimensionSpec`中指定`outputType`，以便在合并之前对结果应用类型转换。 如果未指定，`outputType` 默认为STRING。

详情可以参见 [输出类型](#输出类型)
#### 带过滤的DimensionSpec

该项功能仅仅对多值维度是比较有用的。如果你在Apache Druid中有一个值为 ["v1","v2","v3"] 的行，当发送一个带有对维度值为"v1"进行[查询过滤](filters.md)的GroupBy/TopN查询, 在响应中，将会得到包含"v1","v2","v3"的三行数据。这个行为在大多数场景是不适合的。

之所以会发生这种情况，是因为"查询过滤器"是在位图上内部使用的，并且只用于匹配要包含在查询结果处理中的行。对于多值维度，"查询过滤器"的行为类似于包含检查，它将匹配维度值为["v1"、"v2"、"v3"]的行。有关更多详细信息，请参阅[段](../Design/Segments.md)中"多值列"一节, 然后groupBy/topN处理管道"分解"所有多值维度，得到3行"v1"、"v2"和"v3"。

除了有效地选择要处理的行的"查询过滤器"之外，还可以使用带过滤的DimensionSpec来筛选多值维度值中的特定值。这些维度规范采用代理维度规范和筛选条件。从"分解"行中，查询结果中只返回与给定筛选条件匹配的行。

以下带过滤的DimensionSpec充当"isWhitelist"属性值的值的白名单或黑名单。

```json
{ "type" : "listFiltered", "delegate" : <dimensionSpec>, "values": <array of strings>, "isWhitelist": <optional attribute for true/false, default is true> }
```

以下带过滤的DimensionSpec仅保留与正则匹配的值。请注意，`listFiltered`比这个更快，对于白名单或黑名单用例应该使用它。

```json
{ "type" : "regexFiltered", "delegate" : <dimensionSpec>, "pattern": <java regex pattern> }
```

以下带过滤的DimensionSpec仅保留以相同前缀开头的值。

```json
{ "type" : "prefixFiltered", "delegate" : <dimensionSpec>, "prefix": <prefix string> }
```

更多详细信息和实例，可以参见 [多值维度](multi-value-dimensions.md)

#### 带Lookup的DimensionSpec

> [!WARNING]
> Lookups是一个[实验性的特性](../Development/experimental.md)

带Lookup的DimensionSpec可用于将lookup实现直接定义为维度规范。一般来说，有两种不同类型的查找实现。第一种是在查询时像map实现一样传递的。

```json
{
  "type":"lookup",
  "dimension":"dimensionName",
  "outputName":"dimensionOutputName",
  "replaceMissingValueWith":"missing_value",
  "retainMissingValue":false,
  "lookup":{"type": "map", "map":{"key":"value"}, "isOneToOne":false}
}
```

`retainMissingValue` 和 `replaceMissingValueWith` 属性可以在查询时候被指定来显示的标识如何操作缺失值。 将 `replaceMissingValueWith` 设置为 `""` 与设置为 `null`具有同等作用。 将 `retainMissingValue` 设置为true的话，如果未在Lookup中找到则使用维度的原始值。 默认下，`retainMissingValue = false` 和 `replaceMissingValueWith = null`, 即缺失值当做丢失来处理。

将`retainMissingValue`设置为true且同时指定了`replaceMissingValueWith`，这是不合法的。

可以提供属性`optimize`以允许优化基于Lookup的提取过滤器（默认情况下 `optimize=true` ）。

第二种类型由于其大小原因而无法在查询时传递，它将基于已经通过配置文件 或/和 Coordinator注册的外部Lookup表或资源。

```json
{
  "type":"lookup",
  "dimension":"dimensionName",
  "outputName":"dimensionOutputName",
  "name":"lookupName"
}
```

### 输出类型

DimensionSpec提供了一个选项来指定列值的输出类型。这是必要的，因为具有给定名称的列可能在不同的段中具有不同的值类型；结果将在合并之前转换为`outputType`指定的类型。

请注意，并非所有DimensionSpec用例当前都支持`outputType`，下表显示了哪些用例支持此选项：

| 查询类型 | 是否支持 |
|-|-|
| GroupBy(v1) | 不支持 |
| GroupBy(v2) | 支持 |
| TopN | 支持 |
| Search | 不支持 |
| Select | 不支持 |
| Cardinality Aggregator | 不支持 |

### 提取函数

提取函数定义了应用于每一个维度值的转换。这种转换可以适用于一般的维度，也同时适用于特殊的 `__time` 维度，时间维度标识了根据[查询粒度](AggregationGranularity.md)返回的当前时间bucket

**请注意**，对于那些需要传字符串值的函数，`__time`维度值在进入提取函数前首先格式化为 [ISO-8610格式](https://en.wikipedia.org/wiki/ISO_8601)

#### 正则表达式提取函数

返回给定正则表达式的第一个匹配组。如果不匹配，则按原样返回维度值。

```json
{
  "type" : "regex",
  "expr" : <regular_expression>,
  "index" : <group to extract, default 1>
  "replaceMissingValue" : true,
  "replaceMissingValueWith" : "foobar"
}
```

例如，使用 `"expr" : "(\\w\\w\\w).*"` 会将 `'Monday'`, `'Tuesday'`, `'Wednesday'` 转换为 `'Mon'`, `'Tue'`, `'Wed'`.

如果 `index` 被设置，将控制提取哪个匹配组。 index为0表示提取整个模式配置的字符串。

如果 `replaceMissingValue` 属性设置为true，提取函数将与正则模式不匹配的维度值转换为用户指定的字符串。 默认是 `false`。

如果 `replaceMissingValueWith` 属性用来设置当 `replaceMissingValue = true` 时不匹配的维度值被替换的目标值。 如果 `replaceMissingValueWith` 未指定，不匹配的维度值将被替换为null。

例如， 如果在上边的JSON中 `expr` 为 `"(a\w+)"` , 这是一个匹配以字母 `a` 开头的单次， 提取函数将会把 `banana` 转化为 `foobar`. 

#### Partial提取函数

如果正则表达式匹配了则返回原值，否则返回null

```json
{ "type" : "partial", "expr" : <regular_expression> }
```

#### SearchQuery提取函数

如果给定的 [SearchQuerySpec](searchquery.md) 匹配到值则原值返回，否则返回null

```json
{ "type" : "searchQuery", "query" : <search_query_spec> }
```

#### Substring提取函数

返回从提供的索引开始的维度值和所需长度的子字符串。索引和长度都是以字符串中存在的Unicode代码单元的数量来度量的，就好像它是用UTF-16编码的一样。请注意，某些Unicode字符可能由两个代码单元表示。这与Java String类的"substring"方法的行为相同。

如果所需的长度超过维度值的长度，则返回从索引开始的字符串的其余部分。如果索引大于维度值的长度，则返回null。

```json
{ "type" : "substring", "index" : 1, "length" : 4 }
```

对于返回从索引开始的维度值的剩余部分的子字符串，可以省略长度；如果索引大于维度值的长度，则可以为null。

```json
{ "type" : "substring", "index" : 3 }
```
#### Strlen提取函数

返回维度值的长度，以字符串中存在的Unicode代码单位的数量度量，就好像它是用UTF-16编码的一样。请注意，某些Unicode字符可能由两个代码单元表示。这与Java String类的"length"方法的行为相同。

null字符串被认定为长度为0

```json
{ "type" : "strlen" }
```
#### TimeFormat提取函数

返回根据给定格式字符串、时区和区域设置格式化的维度值。

对于 `__time` 维度值，这将格式化由 [聚合粒度](granularity.md) 限定的时间值

对于一般的维度，它假设字符串已经被格式化为 [ISO-8601的日期与时间格式](https://en.wikipedia.org/wiki/ISO_8601)
* `format`: 用于结果维度值的日期时间格式， 格式为 [Joda时间格式](https://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html) , 或者为null则使用默认的ISO8601格式
* `locale`: 使用由 [IETF BCP 47语言标签](http://www.oracle.com/technetwork/java/javase/java8locales-2095355.html#util-text) 给定的地区（语言和国家），例如 `en-US`, `en-GB`, `fr-FR`, `fr-CA`
* `timeZone`: 使用 [IANA tz数据库格式](http://en.wikipedia.org/wiki/List_of_tz_database_time_zones) 的时区，例如： `Europe/Berlin`(这可能与聚合时区不同)
* `granularity`: 格式化之前的粒度， 或者不使用粒度
* `asMillis`: 布尔值，设置为true以将输入字符串视为毫秒而不是ISO8601字符串。此外，如果 `format` 为null或未指定，输出将以毫秒而不是ISO8601为单位。

```json
{ "type" : "timeFormat",
  "format" : <output_format> (optional),
  "timeZone" : <time_zone> (optional, default UTC),
  "locale" : <locale> (optional, default current locale),
  "granularity" : <granularity> (optional, default none) ,
  "asMillis" : <true or false> (optional) }
```

例如，以下维度规范以法语返回Montréal的星期几：

```json
{
  "type" : "extraction",
  "dimension" : "__time",
  "outputName" :  "dayOfWeek",
  "extractionFn" : {
    "type" : "timeFormat",
    "format" : "EEEE",
    "timeZone" : "America/Montreal",
    "locale" : "fr"
  }
}
```

#### TimeParsing提取函数

#### JavaScript提取函数

#### 已注册的Lookup提取函数

#### Cascade提取函数

#### StringFormat提取函数

#### 大小写提取函数

#### Bucket提取函数