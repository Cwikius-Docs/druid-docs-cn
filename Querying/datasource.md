<!-- toc -->
## 数据源

在Apache Druid中，数据源是被查询的对象。 最常见的数据源类型是一个表数据源，本文档在很多场景中"dataSource"就是指代表数据源，尤其是在 [数据摄取](../DataIngestion/ingestion.md) 部分中，在数据摄取中，总是创建一个表数据源或者往表数据源中写入数据。但是在查询时，有许多种类型的数据源可用。

出现在API请求和响应中的"datasource"一般拼写为 `dataSource` ，注意是大写的S。

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

### 数据源类型
#### `table`

**SQL**

```sql
SELECT column1, column2 FROM "druid"."dataSourceName"
```

**原生**

```json
{
  "queryType": "scan",
  "dataSource": "dataSourceName",
  "columns": ["column1", "column2"],
  "intervals": ["0000/3000"]
}
```

表数据源是最常见的类型，该类数据源可以在 [数据摄取](../DataIngestion/ingestion.md) 后获得。它们被分成若干段，分布在集群中，并且并行地进行查询。

在 [Druid SQL](druidsql.md) 中，表数据源位于 `druid` schema中。 这是默认schema，表数据源可以被指定为 `druid.dataSourceName` 或者简单的 `dataSourceName` 

在原生查询中，可以使用表数据源的名称作为字符串（如上面的示例中所示）或使用以下形式的JSON对象来引用表数据源：

```json
"dataSource": {
  "type": "table",
  "name": "dataSourceName"
}
```

为了看到所有的表数据源列表，可以通过SQL查询 `SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'druid'`

#### `lookup`

**SQL**
```sql
SELECT k, v FROM lookup.countries
```

**原生**
```json
{
  "queryType": "scan",
  "dataSource": {
    "type": "lookup",
    "lookup": "countries"
  },
  "columns": ["k", "v"],
  "intervals": ["0000/3000"]
}
```
Lookup数据源对应于Druid的键值 [lookup](lookups.md) 对象。在[Druid SQL](druidsql.md) 中，它们驻留在 `lookup` schema中。它们会被预加载到所有服务器的内存中，因此可以快速访问它们。可以使用 [join运算符](#join) 将它们连接到常规表上。

Lookup数据源是面向键值的，总是正好有两列：`k`（键）和 `v`（值），而且这两列始终是字符串。

要查看所有的Lookup数据源的列表，请使用SQL查询 `SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='lookup'`。

> [!WARNING]
> 性能提示：Lookup可以通过显式联接或使用SQL [LOOKUP函数](druidsql.md#字符串函数) 与基表联接。但是，join运算符必须对每一行计算条件，而`LOOKUP` 函数可以将计算推迟到聚合阶段之后。这意味着 `LOOKUP` 函数通常比联接到lookup数据源要快

有关使用表数据源时如何执行查询的更多详细信息，请参阅 [查询执行](queryexecution.md) 页面。

#### `union`

**原生**

```json
{
  "queryType": "scan",
  "dataSource": {
    "type": "union",
    "dataSources": ["<tableDataSourceName1>", "<tableDataSourceName2>", "<tableDataSourceName3>"]
  },
  "columns": ["column1", "column2"],
  "intervals": ["0000/3000"]
}
```

Union数据源允许您将两个或多个表数据源视为单个数据源。联合的数据源不需要具有相同的结构。如果它们不完全匹配，那么存在于一个表中而不是另一个表中的列将被视为在**它们不存在的表中包含所有空值**。

union数据源在Druid SQL中不可用。

有关使用union数据源时如何执行查询的更多详细信息，请参阅 [查询执行](queryexecution.md) 页面。

#### `inline`

**原生**

```json
{
  "queryType": "scan",
  "dataSource": {
    "type": "inline",
    "columnNames": ["country", "city"],
    "rows": [
      ["United States", "San Francisco"],
      ["Canada", "Calgary"]
    ]
  },
  "columns": ["country", "city"],
  "intervals": ["0000/3000"]
}
```

Inline数据源允许可以查询嵌入在查询体本身中的一小波数据。 当想要查询一小部分数据但是还没有摄取加载时，这是非常有用的，而且可以很有效的用在 [join](#join) 的输入。 Druid也允许在内部使用它们来操作需要在Broker嵌入的子查询。 详情可以查看 [`query`数据源](#query) 的文档。

在Inline数据源中有两个字段，名为`columnNames`的数组和名为`rows`的二维数组，每一行必须是一个长度与 `columnNames` 同长度的数组。每行中的第一个元素对应于`columnNames` 中的第一列，依此类推。

Inline数据源目前在Druid SQL中是不可用的。

有关使用Inline数据源时如何执行查询的更多详细信息，请参阅 [查询执行](queryexecution.md) 页面。

#### `query`

**SQL**

```sql
-- Uses a subquery to count hits per page, then takes the average.
SELECT
  AVG(cnt) AS average_hits_per_page
FROM
  (SELECT page, COUNT(*) AS hits FROM site_traffic GROUP BY page)
```

**原生**

```json
{
  "queryType": "timeseries",
  "dataSource": {
    "type": "query",
    "query": {
      "queryType": "groupBy",
      "dataSource": "site_traffic",
      "intervals": ["0000/3000"],
      "granularity": "all",
      "dimensions": ["page"],
      "aggregations": [
        { "type": "count", "name": "hits" }
      ]
    }
  },
  "intervals": ["0000/3000"],
  "granularity": "all",
  "aggregations": [
    { "type": "longSum", "name": "hits", "fieldName": "hits" },
    { "type": "count", "name": "pages" }
  ],
  "postAggregations": [
    { "type": "expression", "name": "average_hits_per_page", "expression": "hits / pages" }
  ]
}
```

Query数据源允许您发出子查询。在原生查询中，它们可以出现在接受 `dataSource` 的任何地方。在SQL中，它们可以出现在以下位置，始终用括号括起来：

* FROM子句：`FROM (<subquery>)`
* 作为JOIN的输入： `<table-or-subquery-1> t1 INNER JOIN <table-or-subquery-2> t2 ON t1.<col1> = t2.<col2>`
* 在WHERE子句中：`WHERE <column> {IN | NOT IN} (<subquery>)`。在SQL计划器中这些都被转换为joins

> [!WARNING]
> 性能提示：在大多数情况下，子查询结果在Broker的内存中完全缓冲，然后在Broker本身上进行进一步的处理。这意味着具有大型结果集的子查询可能会导致性能瓶颈或在Broker上遇到内存使用限制。有关使用Query数据源时如何执行查询的更多详细信息，请参阅 [查询执行](queryexecution.md) 页面。

#### `join`

**SQL**

```sql
-- Joins "sales" with "countries" (using "store" as the join key) to get sales by country.
SELECT
  store_to_country.v AS country,
  SUM(sales.revenue) AS country_revenue
FROM
  sales
  INNER JOIN lookup.store_to_country ON sales.store = store_to_country.k
GROUP BY
  countries.v
```

**原生**

```json
{
  "queryType": "groupBy",
  "dataSource": {
    "type": "join",
    "left": "sales",
    "right": {
      "type": "lookup",
      "lookup": "store_to_country"
    },
    "rightPrefix": "r.",
    "condition": "store == \"r.k\"",
    "joinType": "INNER"
  },
  "intervals": ["0000/3000"],
  "granularity": "all",
  "dimensions": [
    { "type": "default", "outputName": "country", "dimension": "r.v" }
  ],
  "aggregations": [
    { "type": "longSum", "name": "country_revenue", "fieldName": "revenue" }
  ]
}
```

Join数据源允许您对两个数据源执行SQL样式的联接。相互堆叠连接允许您任意连接多个数据源。

在Druid 0.18.1版本中，joins使用**broadcast hash-join algorithm**来实现，这意味着除了左边的"base"表之外的表都需要在内存中，同时也意味着连接条件必须是等于。 此特性主要用于将常规Druid表与 [lookup](#lookup)、[inline](#inline) 和 [query](#query) 数据源连接起来。

有关使用Join数据源时如何执行查询的更多详细信息，请参阅 [查询执行](queryexecution.md) 页面。

**SQL中的Joins**

SQL中的join格式如下：

```sql
<o1> [ INNER | LEFT [OUTER] ] JOIN <o2> ON <condition>
```

条件必须是等于，但是函数是可以使用的，而且可以使用多个AND。 像`t1.x = t2.x` 或者 `LOWER(t1.x) = t2.x` 或者 ` t1.x = t2.x AND t1.y = t2.y` 这些都可以被处理。 像 `t1.x <> t2.x` 这样的条件是不可以被处理的。

注意，Druid SQL没有原生join数据源所能处理的严格。在SQL查询执行与原生join数据源不允许的操作的情况下，Druid SQL将生成一个子查询。这可能会对性能和可伸缩性产生重大影响，因此需要注意。SQL层何时生成子查询的示例包括：

* 将一个普通的Druid表连接到自己，或者另一个普通的Druid表。原生Join数据源可以接受左侧的表，但不能接受右侧的表，因此需要子查询。
* 联接条件的两边的表达式属于不同类型。
* 联接条件的右表达式不是可直接访问的列。

对于Druid如何将SQL转化为原生查询的更多信息，可以参考 [Druid SQL](druidsql.md) 文档

**原生中的Joins**

原生的Join查询需要以下属性，且都是必须的。

| 字段 | 描述 |
|-|-|
| `left` | 左侧数据源。 类型必须是 `table`, `join`, `lookup`, `query`或者`inline`。将另一个join作为左数据源放置允许您任意连接多个数据源。|
| `right` | 右侧数据源。 类型必须是 `lookup`, `query` 或者 `inline`。注意：这一点比Druid SQL更加严格 |
| `rightPrefix` | 字符串前缀，将应用于右侧数据源中的所有列，以防止它们与左侧数据源中的列发生冲突。可以是任何字符串，只要它不是空的并且不是 `__time` 字符串的前缀。左侧以 `rightPrefix` 开头的任何列都将被隐藏。您需要提供一个前缀，它不会从左侧隐藏任何重要的列。 |
| `condition` | [表达式](../misc/expression.md)，该表达式必须是相等的，其中一侧是左侧的表达式，另一侧是对右侧的简单列引用。注意，这比Druid SQL所要求的更严格：这里，右边的引用必须是一个简单的列引用；在SQL中，它可以是一个表达式。 |
| `joinType` | `INNER` 或者 `LEFT` |

**Join的性能**

Join是一个可以显著影响查询性能的功能。一些性能提示和注意事项：

1. Joins与[lookup数据源](#lookup)一起使用是非常有用的，但是在大多数场景下，[LOOKUP函数](druidsql.md#字符串函数) 的性能比Join更优。 如果使用场景非常近似的话，可以考虑使用 `LOOKUP` 
2. 当在Druid SQL中使用join的时候，它可以生成未在查询中显式指定的子查询。关于何时发生以及何时探测到它可以在 [Druid SQL](druidsql.md) 查看详细信息
3. 一个生成显式子查询的常见原因是：等号两边的类型不一致。 例如：因为lookup的key总是字符串，当 `d.field` 是字符串的时候 `druid.d JOIN lookup.l ON d.field = l.field` 的性能最佳
4. 从druid0.18.1开始，join操作符必须为每一行计算条件。在未来，我们希望实现早期和延迟的条件评估，这将大大提高常见用例的性能。

**Join的下一步工作**

Join是Druid开发中比较活跃发展的一个领域。目前缺少以下功能，但可能会在将来的版本中出现：
* 比Lookup更宽的预加载维度表（例如支持单个键和多个值）
* RIGHT OUTER和FULL OUTER连接。目前，它们已部分实施, 查询会运行，但结果并不总是正确的
* [上一节](#Join的性能)中提到的与性能相关的优化
* broadcast hash-join以外的连接算法