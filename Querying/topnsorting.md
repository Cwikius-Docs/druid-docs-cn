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

## 排序(TopN)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

在Apache Druid中，TopN metric spec来标明topN的值如何被排序

### 数值型TopNMetricSpec

最简单的metric spec是使用一个字符串值来标识topN的结果如何排序，它们被包含在一个topN查询中：

```json
"metric": "<metric_name>"
```

metric字段也可以通过JSON对象来指定。 数值型维度值排序的语法如下：

```json
"metric": {
    "type": "numeric",
    "metric": "<metric_name>"
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 表示数值型排序， 总是 `numeric` | 是 |
| `metric` | 实际中用来排序的字段 | 是 |

### 维度型TopNMetricSpec

该类型的metric spec使用维度值来排序TopN的结果，使用[排序顺序](sorting-orders.md)中列出来的排序。

| 属性 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 标识一个维度值排序 | 是，必须为`dimension` |
| `ordering` | String | 指定一个排序顺序， 可能的值为：`lexicographic`, `alphanumeric`, `numeric`, `strlen` | 否，默认为`lexicographic` |
| `previousStop` | String | 排序的起始点，例如，如果该值设置为b，则b之前的所有值都被丢弃掉。 该值可以被用来对所有维度值进行分页 | 否 |

使用`lexicographic`排序的语法如下：

```json
"metric": {
    "type": "dimension",
    "ordering": "lexicographic",
    "previousStop": "<previousStop_value>"
}
```

注意，在早期版本的Druid中，DimensionTopNMetricSpec提供的功能由两种不同的spec类型处理，即Lexicographic和Alphanumeric（当只支持两种排序顺序时）。这些规范类型已被弃用，但仍然可用。

### 倒排型TopNMetricSpec

以倒排的方式排序维度值， 可以被用来以升序来排列值

```json
"metric": {
    "type": "inverted",
    "metric": <delegate_top_n_metric_spec>
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 表示数值型排序， 总是 `inverted` | 是 |
| `metric` | 实际中用来排序的字段 | 是 |