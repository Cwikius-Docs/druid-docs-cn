<!-- toc -->
## SQL

> [!WARNING]
> Apache Druid支持两种查询语言： Druid SQL和 [原生查询](makeNativeQueries.md)。本文档讲述SQL查询。

Druid SQL是一个内置的SQL层，是Druid基于JSON的本地查询语言的替代品，它由基于 [Apache Calcite](https://calcite.apache.org/) 的解析器和规划器提供支持。Druid SQL将SQL转换为查询Broker(查询的第一个进程)上的原生Druid查询，然后作为原生Druid查询传递给数据进程。除了在Broker上 [转换SQL](查询翻译) 的（轻微）开销之外，与原生查询相比，没有额外的性能损失。

### 查询符号

Druid SQL支持如下结构的SELECT查询：

```
[ EXPLAIN PLAN FOR ]
[ WITH tableName [ ( column1, column2, ... ) ] AS ( query ) ]
SELECT [ ALL | DISTINCT ] { * | exprs }
FROM { <table> | (<subquery>) | <o1> [ INNER | LEFT ] JOIN <o2> ON condition }
[ WHERE expr ]
[ GROUP BY [ exprs | GROUPING SETS ( (exprs), ... ) | ROLLUP (exprs) | CUBE (exprs) ] ]
[ HAVING expr ]
[ ORDER BY expr [ ASC | DESC ], expr [ ASC | DESC ], ... ]
[ LIMIT limit ]
[ UNION ALL <another query> ]
```

#### FROM

FROM子句可以引用下列任何一个：

* 来自 `druid` schema中的 [表数据源](datasource.md#table)。 这是默认schema，因此可以将Druid表数据源引用为 `druid.dataSourceName` 或者简单的 `dataSourceName`。
* 来自 `lookup` schema的 [lookups](datasource.md#lookup), 例如 `lookup.countries`。 注意：lookups还可以使用 [Lookup函数](#字符串函数) 来查询。
* [子查询](#子查询)
* 列表中任何内容之间的 [joins](datasource.md#join)，本地数据源（table、lookup、query）和系统表之间的联接除外。连接条件必须是连接左侧和右侧的表达式之间的相等。
* 来自于 `INFORMATION_SCHEMA` 或者 `sys` schema的 [元数据表](#元数据表)

有关table、lookup、query和join数据源的更多信息，请参阅 [数据源文档](datasource.md)。

#### WHERE

WHERE子句引用FROM表中的列，并将转换为 [原生过滤器](filters.md)。WHERE子句还可以引用子查询，比如 `WHERE col1 IN（SELECT foo FROM ...）`。像这样的查询作为子查询的连接执行，如下在 [查询转换](#查询转换) 部分所述。

#### GROUP BY

**GROUP BY**子句引用FROM表中的列。使用 **GROUP BY**、**DISTINCT** 或任何聚合函数都将使用Druid的 [三种原生聚合查询类型](#查询类型)之一触发聚合查询。**GROUP BY**可以引用表达式或者select子句的序号位置（如 `GROUP BY 2`以按第二个选定列分组）。

**GROUP BY**子句还可以通过三种方式引用多个分组集。 最灵活的是 **GROUP BY GROUPING SETS**，例如 `GROUP BY GROUPING SETS ( (country, city), () )`, 该实例等价于一个 `GROUP BY country, city` 然后 `GROUP BY ()`。 对于**GROUPING SETS**，底层数据只扫描一次，从而提高了效率。其次，**GROUP BY ROLLUP**为每个级别的分组表达式计算一个分组集，例如 `GROUP BY ROLLUP (country, city)` 等价于 `GROUP BY GROUPING SETS ( (country, city), (country), () )` ，将为每个country/city对生成分组行，以及每个country的小计和总计。最后，**GROUP BY CUBE**为每个分组表达式组合计算分组集，例如 `GROUP BY CUBE (country, city)` 等价于 `GROUP BY GROUPING SETS ( (country, city), (country), (city), () )`。对不适用于特定行的列进行分组将包含 `NULL`, 例如，当计算 `GROUP BY GROUPING SETS ( (country, city), () )`, 与`（）`对应的总计行对于"country"和"city"列将为 `NULL`。

使用 **GROUP BY GROUPING SETS**, **GROUP BY ROLLUP**, 或者 **GROUP BY CUBE**时，请注意，可能不会按照在查询中指定分组集的顺序生成结果。如果需要按特定顺序生成结果，请使用**ORDER BY**子句。

#### HAVING

**HAVING**子句引用在执行**GROUP BY**之后出现的列，它可用于对分组表达式或聚合值进行筛选，它只能与**GROUP BY**一起使用。

#### ORDER BY

**ORDER BY**子句引用执行**GROUP BY**后出现的列。它可用于根据分组表达式或聚合值对结果进行排序。**ORDER BY**可以引用表达式或者select子句序号位置（例如 `ORDER BY 2` 根据第二个选定列进行排序）。对于非聚合查询，**ORDER BY**只能按 `__time` 排序。对于聚合查询，**ORDER BY**可以按任何列排序。

#### LIMIT

**LIMIT**子句可用于限制返回的行数。它可以用于任何查询类型。对于使用原生TopN查询类型（而不是原生GroupBy查询类型）运行的查询，它被下推到数据进程。未来的Druid版本也将支持使用原生GroupBy查询类型来降低限制。如果您注意到添加一个限制并不会对性能产生很大的影响，那么很可能Druid并没有降低查询的限制。

#### UNION ALL

**UNION ALL**操作符可用于将多个查询融合在一起。它们的结果将被连接起来，每个查询将单独运行，背对背（不并行）。Druid现在不支持没有"All"的"UNION"。**UNION ALL**必须出现在SQL查询的最外层（它不能出现在子查询或FROM子句中）。

请注意，尽管名称相似，UNION ALL与 [union datasource](datasource.md#union) 并不是一回事。**UNION ALL**允许联合查询结果，而UNION数据源允许联合表。

#### EXPLAIN PLAN

在任何查询的开头添加"EXPLAIN PLAN FOR"，以获取有关如何转换的信息。在这种情况下，查询实际上不会执行。有关解释**EXPLAIN PLAN**输出的帮助，请参阅 [查询转换文档](#查询转换)。

#### 标识符和字面量

可以选择使用双引号引用数据源和列名等标识符。要在标识符中转义双引号，请使用另一个双引号，如 `"My ""very own"" identifier"`。所有标识符都区分大小写，不执行隐式大小写转换。

字面量字符串应该用单引号引起来，如 `'foo'`。带Unicode转义符的文本字符串可以像 `U&'fo\00F6'` 一样写入，其中十六进制字符代码的前缀是反斜杠。字面量数字可以写成 `100`（表示整数）、`100.0`（表示浮点值）或 `1.0e5`（科学表示法）等形式。字面量时间戳可以像 `TIMESTAMP '2000-01-01 00:00:00'` 一样写入, 用于时间算术的字面量间隔可以写成 `INTERVAL '1' HOUR`、`INTERVAL '1 02:03' DAY TO MINUTE, INTERVAL '1-2' YEAR TO MONTH` 等等。

#### 动态参数

Druid SQL支持使用问号 `(?)` 的动态参数语法，动态参数在执行时绑定到占位符 `?` 中。若要使用动态参数，请将查询中的任何文本替换为 `？`字符，并在执行查询时提供相应的参数值, 参数按传递顺序绑定到占位符。[HTTP POST](#HTTP)和[JDBC APIs](#jdbc) 都支持参数。

### 数据类型
#### 标准类型
#### 多值字符串
#### NULL
### 聚合函数
### 扩展函数
#### 数值函数
#### 字符串函数
#### 时间函数
#### 约化函数
#### IP地址函数
#### 比较操作符
#### Sketch函数
#### 其他扩展函数
### 多值字符串函数
### 查询转换
#### 最佳实践
#### 解释EXPLAIN PLAN输出
#### 查询类型
#### 时间过滤器
#### 连接
#### 子查询
#### 近似
#### 不支持的特征
### 客户端API
#### HTTP
#### JDBC
#### 动态参数
#### 连接上下文
### 元数据表
#### 信息Schema
#### 系统Schema
### 服务配置
### 安全性