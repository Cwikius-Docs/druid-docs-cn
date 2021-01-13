<!-- toc -->
## 多值维度

Apache Druid支持多值字符串维度。当输入字段中包括一个数组值而非单一值（例如，JSON数组，或者包括多个 `listDelimiter` 分割的TSV字段）时即可生成多值维度。

本文档描述了对一个维度进行聚合时，多值维度上的GroupBy查询行为（TopN很类似）。对于多值维度的内部详细信息可以查看 [Segments](../Design/Segments.md) 文档的多值列部分。本文档中的示例都为 [原生Druid查询](makeNativeQueries.md)格式，对于多值维度在SQL中的使用情况请查阅 [Druid SQL 文档](druidsql.md)

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

### 查询多值维度

假设，您已经有一个具有一个段的数据源，该段包含以下几行，其中 `tags`是一个多值维度。

```json
{"timestamp": "2011-01-12T00:00:00.000Z", "tags": ["t1","t2","t3"]}  #row1
{"timestamp": "2011-01-13T00:00:00.000Z", "tags": ["t3","t4","t5"]}  #row2
{"timestamp": "2011-01-14T00:00:00.000Z", "tags": ["t5","t6","t7"]}  #row3
{"timestamp": "2011-01-14T00:00:00.000Z", "tags": []}                #row4
```

#### 过滤(Filtering)

所有的查询类型，包括 [Filtered Aggregator](Aggregations.md#过滤聚合器)，都可以在多值维度上进行过滤。 在多值维度上进行使用Filter遵循以下规则：

* 当多值维度的任何一个值匹配到值过滤器（例如 "selector", "bound" 和 "in"），该行即被匹配上
* 如果维度有重叠，则列比较过滤器会匹配该行
* 值过滤器中的 `null` 或者 `""`(空字符串)将匹配多值维度中的空
* 逻辑表达过滤器在多值维度上的行为方式与它们在单值维度上的行为相同："and"标识所有基础过滤器都匹配该行; "or"表示有任意一个基础过滤器匹配该行; "not"表示基础过滤器与行不匹配。
  
例如，以下"or"过滤器将会匹配上边数据集中的第一行和第二行，但不会匹配第三行：

```json
{
  "type": "or",
  "fields": [
    {
      "type": "selector",
      "dimension": "tags",
      "value": "t1"
    },
    {
      "type": "selector",
      "dimension": "tags",
      "value": "t3"
    }
  ]
}
```

以下"and"过滤器将会仅仅匹配上边数据集中的第一行：

```json
{
  "type": "and",
  "fields": [
    {
      "type": "selector",
      "dimension": "tags",
      "value": "t1"
    },
    {
      "type": "selector",
      "dimension": "tags",
      "value": "t3"
    }
  ]
}
```

以下"selector"过滤器将匹配到上边数据集中的第四行：

```json
{
  "type": "selector",
  "dimension": "tags",
  "value": null
}
```

#### 分组(Grouping)

topN和groupBy查询可以在多值维度上进行分组。当在多值维度上进行分组时，匹配到的行中的*所有*值都会根据单值生成一个分组。可以看作相当于 `UNNEST`运算符，它用于许多SQL支持的数组类型上, 这就意味着一个查询可以返回多于行数的分组。例如，在 `tags`维度上使用过滤器 `"t1" AND "t3"` 将只会匹配到第一行，同时生成一个具有三个分组 `t1`, `t2` 和 `t3`。如果您只需要包括匹配过滤器的值，可以使用 [Filtered DimensionSpec](dimensionspec.md#带过滤的维度说明), 该操作也可以提升性能。

#### 示例：不带过滤的GroupBy

详情可以查看 [GroupBy查询](groupby.md)

```json
{
  "queryType": "groupBy",
  "dataSource": "test",
  "intervals": [
    "1970-01-01T00:00:00.000Z/3000-01-01T00:00:00.000Z"
  ],
  "granularity": {
    "type": "all"
  },
  "dimensions": [
    {
      "type": "default",
      "dimension": "tags",
      "outputName": "tags"
    }
  ],
  "aggregations": [
    {
      "type": "count",
      "name": "count"
    }
  ]
}
```

返回如下结果：

```json
[
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t1"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t2"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 2,
      "tags": "t3"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t4"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 2,
      "tags": "t5"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t6"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t7"
    }
  }
]
```
需要注意原始的行是如何扩散为多行并合并的。

#### 示例：带选择查询过滤的GroupBy

详情可以查看 [query过滤器](filters.md) 中的select查询过滤器。

```json
{
  "queryType": "groupBy",
  "dataSource": "test",
  "intervals": [
    "1970-01-01T00:00:00.000Z/3000-01-01T00:00:00.000Z"
  ],
  "filter": {
    "type": "selector",
    "dimension": "tags",
    "value": "t3"
  },
  "granularity": {
    "type": "all"
  },
  "dimensions": [
    {
      "type": "default",
      "dimension": "tags",
      "outputName": "tags"
    }
  ],
  "aggregations": [
    {
      "type": "count",
      "name": "count"
    }
  ]
}
```
返回以下结果：

```json
[
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t1"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t2"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 2,
      "tags": "t3"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t4"
    }
  },
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 1,
      "tags": "t5"
    }
  }
]
```

您可能惊讶于结果集中包含了 "t1", "t2", "t4" 和 "t5"，这是因为查询过滤器先进行执行。 对于多值维度，在"t3"的selector过滤器会首先匹配到第一行和第二行，然后进行后续。 对于多值维度，如果多个值中的任何单个值与查询过滤器匹配，则查询过滤器将匹配到这一行。

#### 示例：带一个选择查询过滤和另外的维度属性过滤的GroupBy

为了解决上述问题，使得仅仅返回"t3"，可以使用下边所述查询中的"filtered dimension spec"。详情可以查看[Filtered DimensionSpec](dimensionspec.md#带过滤的维度说明)部分。

```json
{
  "queryType": "groupBy",
  "dataSource": "test",
  "intervals": [
    "1970-01-01T00:00:00.000Z/3000-01-01T00:00:00.000Z"
  ],
  "filter": {
    "type": "selector",
    "dimension": "tags",
    "value": "t3"
  },
  "granularity": {
    "type": "all"
  },
  "dimensions": [
    {
      "type": "listFiltered",
      "delegate": {
        "type": "default",
        "dimension": "tags",
        "outputName": "tags"
      },
      "values": ["t3"]
    }
  ],
  "aggregations": [
    {
      "type": "count",
      "name": "count"
    }
  ]
}
```

返回以下结果：

```json
[
  {
    "timestamp": "1970-01-01T00:00:00.000Z",
    "event": {
      "count": 2,
      "tags": "t3"
    }
  }
]
```

注意, 对于具有 [having spec](having.md)的GroupBy查询也是存在类似的结果，使用一个带filtered dimensionSpec是非常高效率的，因为它使用在查询处理管道的最底层，而Having Spec使用在在groupBy查询处理的最外层。