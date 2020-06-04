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

Druid原生支持五种列类型："long"(64位有符号整型),"float"(32位浮点型),"double"(64位浮点型),"string"(UTF-8编码的字符串或者字符串数组)和"complex"(获取更多奇异的数据类型，如hyperUnique列和approxHistogram列)

时间戳（包括 `__time` 列）被Druid视为long，其值是1970-01-01T00:00:00 UTC以来的毫秒数，不包括闰秒。因此，Druid中的时间戳不携带任何时区信息，而只携带关于它们所代表的确切时间的信息。有关时间戳处理的更多信息，请参阅 [时间函数部分](#时间函数)。

下表描述了Druid如何在查询运行时将SQL类型映射到原生类型。在具有相同Druid运行时类型的两个SQL类型之间进行强制转换不会产生任何影响，除非表中指出了异常。两个具有不同Druid运行时类型的SQL类型之间的转换将在Druid中生成一个运行时转换。如果一个值不能正确地转换为另一个值，如 `CAST('foo' AS BIGINT)`，则运行时将替换默认值。 NULL转换为不可为空类型时将替换为默认值（例如，NULL转为数字将转换为零）。

| SQL类型 | Druid运行时类型 | 默认值 | 注意事项 |
|-|-|-|-|
| CHAR | STRING | `''` | |
| VARCHAR | STRING | `''` | Druid STRING列报告为VARCHAR，包括 [多值字符串](#多值字符串) |
| DECIMAL | DOUBLE | `0.0` | DECIMAL使用浮点，非定点 |
| FLOAT | FLOAT | `0.0` | Druid FLOAT列报告为FLOAT |
| REAL | DOUBLE | `0.0` | |
| DOUBLE | DOUBLE | `0.0` | Druid DOUBLE列报告为DOUBLE |
| BOOLEAN | LONG | `false` | |
| TINYINT | LONG | `0` | |
| SMALLINT | LONG | `0` | |
| INTEGER | LONG | `0` | |
| BIGINT | LONG | `0` | Druid LONG列(除了 `__time` 报告为BIGINT |
| TIMESTAMP | LONG | `0`, 意思是1970-01-01 00:00:00 UTC | Druid的`__time`列被报告为TIMESTAMP。 string和timestamp类型的转换都是假定为标准格式，例如 `2000-01-02 03:04:05`, 而非ISO8601格式。 有关时间戳处理的更多信息，请参阅 [时间函数部分](#时间函数)。 |
| DATE | LONG | `0`, 意思是1970-01-01 | 转换TIMESTAMP为DATE 时间戳将时间戳舍入到最近的一天。string和date类型的转换都是假定为标准格式，例如 `2000-01-02`。 有关时间戳处理的更多信息，请参阅 [时间函数部分](#时间函数)。|
| OTHER | COMPLEX | none | 可以表示各种Druid列类型，如hyperUnique、approxHistogram等 |

#### 多值字符串

Druid的原生类型系统允许字符串可能有多个值。这些 [多值维度](multi-value-dimensions.md) 将被报告为SQL中的 `VARCHAR` 类型，可以像任何其他VARCHAR一样在语法上使用。引用多值字符串维度的常规字符串函数将分别应用于每行的所有值，多值字符串维度也可以通过特殊的 [多值字符串函数](#多值字符串函数) 作为数组处理，该函数可以执行强大的数组操作。

按多值表达式分组将observe原生Druid多值聚合行为，这与某些其他SQL语法中 `UNNEST` 的功能类似。有关更多详细信息，请参阅有关 [多值字符串维度](multi-value-dimensions.md) 的文档。

#### NULL

[runtime property](../Configuration/configuration.md#SQL兼容的空值处理) 中的 `druid.generic.useDefaultValueForNull` 配置控制着Druid的NULL处理模式。

在默认模式(`true`)下，Druid将NULL和空字符串互换处理，而不是根据SQL标准。在这种模式下，Druid SQL只部分支持NULL。例如，表达式 `col IS NULL` 和 `col = ''` 等效，如果 `col` 包含空字符串，则两者的计算结果都为true。类似地，如果`col1`是空字符串，则表达式 `COALESCE(col1，col2)` 将返回 `col2`。当 `COUNT(*)` 聚合器计算所有行时，`COUNT(expr)` 聚合器将计算expr既不为空也不为空字符串的行数。此模式中的数值列不可为空；任何空值或缺少的值都将被视为零。

在SQL兼容模式(`false`)中，NULL的处理更接近SQL标准，该属性同时影响存储和查询，因此为了获得最佳行为，应该在接收时和查询时同时设置该属性。处理空值的能力会带来一些开销；有关更多详细信息，请参阅 [段文档](../Design/Segments.md#SQL兼容的空值处理)。

### 聚合函数

聚合函数可以出现在任务查询的SELECT子句中，任何聚合器都可以使用 `AGG(expr) FILTER(WHERE whereExpr)` 这样的表达式进行过滤。 被过滤的聚合器仅仅聚合那些匹配了过滤器的行。 同一个SQL查询中的两个聚合器可能有不同的过滤器。

只有COUNT聚合支持使用DISTINCT

| 函数 | 描述 |
|-|-|
| `COUNT(*)` | 计算行数 |
| `COUNT( DISTINCT expr)` | 唯一值的计数，表达式可以是string、numeric或者hyperUnique。默认情况下，这是近似值，使用[HyperLogLog](http://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf) 的变体。若要获取精确计数，请将"useApproximateCountDistinct"设置为"false"。如果这样做，expr必须是字符串或数字，因为使用hyperUnique列不可能精确计数。另请参见 `APPROX_COUNT_DISTINCT(expr)` 。在精确模式下，每个查询只允许一个不同的计数。|
| `SUM(expr)` | 求和 |
| `MIN(expr)` | 取数字的最小值 |
| `MAX(expr)` | 取数字的最大值 |
| `AVG(expr)` | 取平均值 |
| `APPROX_COUNT_DISTINCT(expr)` | 唯一值的计数，该值可以是常规列或hyperUnique。这始终是近似值，而不考虑"useApproximateCountDistinct"的值。该函数使用了Druid内置的"cardinality"或"hyperUnique"聚合器。另请参见 `COUNT(DISTINCT expr)` |
| `APPROX_COUNT_DISTINCT_DS_HLL(expr, [lgK, tgtHllType])` | 唯一值的计数，该值可以是常规列或[HLL sketch](../Configuration/core-ext/datasketches-hll.md)。`lgk` 和 `tgtHllType` 参数在HLL Sketch文档中做了描述。 该值也始终是近似值，而不考虑"useApproximateCountDistinct"的值。另请参见 `COUNT(DISTINCT expr)`, 使用该函数需要加载 [DataSketches扩展](../Development/datasketches-extension.md) |
| `APPROX_COUNT_DISTINCT_DS_THETA(expr, [size])` | 唯一值的计数，该值可以是常规列或[Theta sketch](../Configuration/core-ext/datasketches-theta.md)。`size` 参数在Theta Sketch文档中做了描述。 该值也始终是近似值，而不考虑"useApproximateCountDistinct"的值。另请参见 `COUNT(DISTINCT expr)`, 使用该函数需要加载 [DataSketches扩展](../Development/datasketches-extension.md) |
| `DS_HLL(expr, [lgK, tgtHllType])` | 在表达式的值上创建一个 [`HLL sketch`](../Configuration/core-ext/datasketches-hll.md), 该值可以是常规列或者包括HLL Sketch的列。`lgk` 和 `tgtHllType` 参数在HLL Sketch文档中做了描述。使用该函数需要加载 [DataSketches扩展](../Development/datasketches-extension.md) |
| `DS_THETA(expr, [size])` | 在表达式的值上创建一个[`Theta sketch`](../Configuration/core-ext/datasketches-theta.md)，该值可以是常规列或者包括Theta Sketch的列。`size` 参数在Theta Sketch文档中做了描述。使用该函数需要加载 [DataSketches扩展](../Development/datasketches-extension.md) |
| `APPROX_QUANTILE(expr, probability, [resolution])` | 在数值表达式或者[近似图](../Configuration/core-ext/approximate-histograms.md) 表达式上计算近似分位数，"probability"应该是位于0到1之间（不包括1），"resolution"是用于计算的centroids，更高的resolution将会获得更精确的结果，默认值为50。使用该函数需要加载 [近似直方图扩展](../Configuration/core-ext/approximate-histograms.md) |
| `APPROX_QUANTILE_DS(expr, probability, [k])` | 在数值表达式或者 [Quantiles sketch](../Configuration/core-ext/datasketches-quantiles.md) 表达式上计算近似分位数，"probability"应该是位于0到1之间（不包括1）, `k`参数在Quantiles Sketch文档中做了描述。使用该函数需要加载 [DataSketches扩展](../Development/datasketches-extension.md) |
| `APPROX_QUANTILE_FIXED_BUCKETS(expr, probability, numBuckets, lowerLimit, upperLimit, [outlierHandlingMode])` | 在数值表达式或者[fixed buckets直方图](../Configuration/core-ext/approximate-histograms.md) 表达式上计算近似分位数，"probability"应该是位于0到1之间（不包括1）, `numBuckets`, `lowerLimit`, `upperLimit` 和 `outlierHandlingMode` 参数在fixed buckets直方图文档中做了描述。 使用该函数需要加载 [近似直方图扩展](../Configuration/core-ext/approximate-histograms.md) |
| `DS_QUANTILES_SKETCH(expr, [k])` | 在表达式的值上创建一个[`Quantiles sketch`](../Configuration/core-ext/datasketches-quantiles.md)，该值可以是常规列或者包括Quantiles Sketch的列。`k`参数在Quantiles Sketch文档中做了描述。使用该函数需要加载 [DataSketches扩展](../Development/datasketches-extension.md) |
| `BLOOM_FILTER(expr, numEntries)` | 根据`expr`生成的值计算bloom筛选器，其中`numEntries`在假阳性率增加之前具有最大数量的不同值。详细可以参见 [Bloom过滤器扩展](../Configuration/core-ext/bloom-filter.md) |
| `TDIGEST_QUANTILE(expr, quantileFraction, [compression])` | 根据`expr`生成的值构建一个T-Digest sketch，并返回分位数的值。"compression"（默认值100）确定sketch的精度和大小。更高的compression意味着更高的精度，但更多的空间来存储sketch。有关更多详细信息，请参阅 [t-digest扩展文档](../Configuration/core-ext/tdigestsketch-quantiles.md) |
| `TDIGEST_GENERATE_SKETCH(expr, [compression])` | 根据`expr`生成的值构建一个T-Digest sketch。"compression"（默认值100）确定sketch的精度和大小。更高的compression意味着更高的精度，但更多的空间来存储sketch。有关更多详细信息，请参阅 [t-digest扩展文档](../Configuration/core-ext/tdigestsketch-quantiles.md) |
| `VAR_POP(expr)` | 计算`expr`的总体方差, 额外的信息参见 [stats扩展文档](../Configuration/core-ext/stats.md) |
| `VAR_SAMP(expr)` | 计算表达式的样本方差，额外的信息参见 [stats扩展文档](../Configuration/core-ext/stats.md) |
| `VARIANCE(expr)` | 计算表达式的样本方差，额外的信息参见 [stats扩展文档](../Configuration/core-ext/stats.md) |
| `STDDEV_POP(expr)` | 计算`expr`的总体标准差, 额外的信息参见 [stats扩展文档](../Configuration/core-ext/stats.md) |
| `STDDEV_SAMP(expr)` | 计算表达式的样本标准差，额外的信息参见 [stats扩展文档](../Configuration/core-ext/stats.md) |
| `STDDEV(expr)` | 计算表达式的样本标准差，额外的信息参见 [stats扩展文档](../Configuration/core-ext/stats.md) |
| `EARLIEST(expr)` | 返回`expr`的最早值，该值必须是数字。如果`expr`来自一个与timestamp列（如Druid数据源）的关系，那么"earliest"是所有被聚合值的最小总时间戳最先遇到的值。如果`expr`不是来自带有时间戳的关系，那么它只是遇到的第一个值。 |
| `ARLIEST(expr, maxBytesPerString) ` | 与`EARLIEST(expr)`相似，但是面向string。`maxBytesPerString` 参数确定每个字符串要分配多少聚合空间, 超过此限制的字符串将被截断。这个参数应该设置得尽可能低，因为高值会导致内存浪费。 |
| `LATEST(expr)` | 返回 `expr` 的最新值，该值必须是数字。如果 `expr` 来自一个与timestamp列（如Druid数据源）的关系，那么"latest"是最后一次遇到的值，它是所有被聚合的值的最大总时间戳。如果`expr`不是来自带有时间戳的关系，那么它只是遇到的最后一个值。 |
| `LATEST(expr, maxBytesPerString)` | 与 `LATEST(expr)` 类似，但是面向string。`maxBytesPerString` 参数确定每个字符串要分配多少聚合空间, 超过此限制的字符串将被截断。这个参数应该设置得尽可能低，因为高值会导致内存浪费。 |
| `ANY_VALUE(expr)` | 返回 `expr` 的任何值，包括null。`expr`必须是数字, 此聚合器可以通过返回第一个遇到的值（包括空值）来简化和优化性能 |
| `ANY_VALUE(expr, maxBytesPerString)` | 与 `ANY_VALUE(expr)` 类似，但是面向string。`maxBytesPerString` 参数确定每个字符串要分配多少聚合空间, 超过此限制的字符串将被截断。这个参数应该设置得尽可能低，因为高值会导致内存浪费。|

对于近似聚合函数，请查看 [近似聚合文档](Aggregations.md#近似聚合)

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