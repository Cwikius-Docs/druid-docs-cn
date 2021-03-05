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

## 排序和限制(Sorting and Limiting)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

`limitSpec`字段提供了对GroupBy结果集进行排序和限制的功能。 如果是对一个维度进行聚合且根据一个指标进行排序， 我们强烈建议使用 [TopN查询](topn.md) 来替代， 性能会大大的提高。 可选项有：

**DefaultLimitSpec**

默认的limitSpec的语法如下：

```json
{
    "type"    : "default",
    "limit"   : <optional integer>,
    "offset"  : <optional integer>,
    "columns" : [<optional list of OrderByColumnSpec>],
}
```

`limit`参数为要返回的最大行数

`offset`参数告诉Druid在返回结果的时候略过多少行。 如果 `limit` 和 `offset` 同时被设置了的话， `offset` 参数将首先生效， 紧跟着是 `limit` 。 例如， limit为100且offset为10的话， 将从第十行开始返回100行。 在内部，查询的执行是根据offset来扩展limit， 然后丢弃掉offset数量的行数，这意味着与增加limit相比， 增加offset将增加资源的使用。

`limit`和`offset`可以被用来实现分页。但是，请注意，如果在页面获取之间修改基础数据源的方式会影响整个查询结果，那么不同的页面不一定会彼此对齐。

**OrderByColumnSpec**

OrderbyColumnSpec标明如何去做排序。 每一个排序条件可以是 `jsonString` 或者如下格式的一个map：

```json
{
    "dimension" : "<Any dimension or metric name>",
    "direction" : <"ascending"|"descending">,
    "dimensionOrder" : <"lexicographic"(default)|"alphanumeric"|"strlen"|"numeric">
}
```

如果只提供了维度（作为JSON字符串），那么默认的排序方式是按字典排序的升序。

对于 `dimensionOrder` 指定的排序的更多信息可以查看 [Sorting Orders](sorting-orders.md)
