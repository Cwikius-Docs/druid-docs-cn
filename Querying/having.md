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

## Having过滤器(groupBy)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。


having语法用来通过对聚合后的值指定特定条件来决定从GroupBy的结果中返回符合条件的行，基本等价于SQL语法中的**HAVING**

Apache Druid支持下列类型的having语法

### 查询过滤器(Query Filters)

所有的[Druid查询过滤器](filters.md)都可以被用来使用在查询体的Having部分中。 一个查询过滤器的HavingSpec如下：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type" : "filter",
            "filter" : <any Druid query filter>
        }
}
```

例如，使用一个选择过滤器(selector filter)：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type" : "filter",
            "filter" : {
              "type": "selector",
              "dimension" : "<dimension>",
              "value" : "<dimension_value>"
            }
        }
}
```

对结果行的时间戳进行使用Having语法的时候也可以生效，如同在 "__time" 字段上使用过滤器。

### 数值过滤器(Numeric Filters)

最简单的having子句是数字过滤器。数字过滤器可以用作过滤器的更复杂布尔表达式的基过滤器。

下面是having子句数字筛选器的示例：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type": "greaterThan",
            "aggregation": "<aggregate_metric>",
            "value": <numeric_value>
        }
}
```

**等于(equalTo)**

`equalTo`过滤器根据指定的聚合后的值进行匹配，返回等于值的行，语法如下：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type": "equalTo",
            "aggregation": "<aggregate_metric>",
            "value": <numeric_value>
        }
}
```

这种方式等价于 `HAVING <aggregate> > <value>`

**大于(Greater Than)**

`greaterThan`过滤器根据指定的聚合后的值进行匹配，返回大于值的行，语法如下：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type": "greaterThan",
            "aggregation": "<aggregate_metric>",
            "value": <numeric_value>
        }
}
```

这种方式等价于 `HAVING <aggregate> > <value>`

**小于(Less Than)**

`lessThan`过滤器根据指定的聚合后的值进行匹配，返回大于值的行，语法如下：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type": "lessThan",
            "aggregation": "<aggregate_metric>",
            "value": <numeric_value>
        }
}
```

这种方式等价于 `HAVING <aggregate> < <value>`

### 维度选择过滤器(Dimension Selector Filter)

**dimSelector**

dimSelector过滤器根据维度值等于特定值来匹配行，语法如下：

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
       {
            "type": "dimSelector",
            "dimension": "<dimension>",
            "value": <dimension_value>
        }
}
```

### 逻辑表达式过滤器(Logical Expression Filters)

**AND**

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type": "and",
            "havingSpecs": [
                {
                    "type": "greaterThan",
                    "aggregation": "<aggregate_metric>",
                    "value": <numeric_value>
                },
                {
                    "type": "lessThan",
                    "aggregation": "<aggregate_metric>",
                    "value": <numeric_value>
                }
            ]
        }
}
```

**OR**

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
            "type": "or",
            "havingSpecs": [
                {
                    "type": "greaterThan",
                    "aggregation": "<aggregate_metric>",
                    "value": <numeric_value>
                },
                {
                    "type": "equalTo",
                    "aggregation": "<aggregate_metric>",
                    "value": <numeric_value>
                }
            ]
        }
}
```

**NOT**

```json
{
    "queryType": "groupBy",
    "dataSource": "sample_datasource",
    ...
    "having":
        {
        "type": "not",
        "havingSpec":
            {
                "type": "equalTo",
                "aggregation": "<aggregate_metric>",
                "value": <numeric_value>
            }
        }
}
```
