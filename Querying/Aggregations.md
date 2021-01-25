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
**`doubleSum`**
**`floatSum`**

### Min/Max聚合器

**`doubleMin`**
**`doubleMax`**
**`floatMin`**
**`floatMax`**
**`longMin`**
**`longMax`**
**`doubleMean`**

### First/Last聚合器

**`doubleFirst`**
**`doubleLast`**
**`floatFirst`**
**`floatLast`**
**`longFirst`**
**`longLast`**
**`stringFirst`**
**`stringLast`**

### ANY聚合器

**`doubleAny`**
**`floatAny`**
**`longAny`**
**`stringAny`**
### JavaScript聚合器

### 近似聚合
#### 唯一计数
#### 直方图与中位数
### 其他聚合
#### 过滤聚合器