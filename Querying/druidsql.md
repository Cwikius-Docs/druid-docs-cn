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

对于数学运算，如果表达式中涉及的所有操作数都是整数，Druid SQL将使用整数数学。否则，Druid将切换到浮点数学，通过将一个操作数转换为浮点，可以强制执行此操作。在运行时，对于大多数表达式，Druid将把32位浮点扩展到64位。

| 函数 | 描述 |
|-|-|
| `ABS(expr)` | 绝对值 |
| `CEIL(expr)` | 向上取整 |
| `EXP(expr)` | 次方 |
| `FLOOR(expr)` | 向下取整 |
| `LN(expr)` | 对数（以e为底）|
| `LOG10(expr)` | 对数（以10为底） |
| `POWER(expr,power)` | 次方 |
| `SQRT(expr)` | 开方 |
| `TRUNCATE(expr[, digits])` | 将`expr`截断为指定的小数位数。如果数字为负数，则此操作会截断小数点左侧的许多位置。如果未指定，则数字默认为零。|
| `ROUND(expr[, digits])` | `ROUND（x，y）` 将返回x的值，并四舍五入到y小数位。虽然x可以是整数或浮点数，但y必须是整数。返回值的类型由x的类型指定。如果省略，则默认为0。当y为负时，x在y小数点的左侧四舍五入。|
| `x + y` | 加 |
| `x - y` | 减 |
| `x * y` | 乘 |
| `x / y` | 除 |
| `MOD(x, y)` | 模除 |
| `SIN(expr)` | 正弦 |
| `COS(expr)` | 余弦 |
| `TAN(expr)` | 正切 |
| `COT(expr)` | 余切 |
| `ASIN(expr)` | 反正弦 |
| `ACOS(expr)` | 反余弦 |
| `ATAN(expr)` | 反正切 |
| `ATAN2(y, x)` | 从直角坐标（x，y）到极坐标（r，θ）的转换角度θ。|
| `DEGREES(expr)` | 将以弧度测量的角度转换为以度测量的近似等效角度 |
| `RADIANS(expr)` | 将以度为单位测量的角度转换为以弧度为单位测量的近似等效角度 |

#### 字符串函数

字符串函数接受字符串，并返回与该函数相应的类型。

| 函数 | 描述 |
|-|-|
| `x || y` | 拼接字符串 |
| `CONCAT(expr, expr, ...)` | 拼接一系列表达式 |
| `TEXTCAT(expr, expr)` | 两个参数版本的CONCAT |
| `STRING_FORMAT(pattern[, args...])` | 返回以Java的 [方式格式化](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html#format-java.lang.String-java.lang.Object...-) 的字符串字符串格式 | 
| `LENGTH(expr)` | UTF-16代码单位的长度或表达式 |
| `CHAR_LENGTH(expr)` | `LENGTH` 的同义词 |
| `CHARACTER_LENGTH(expr)` | `LENGTH` 的同义词 |
| `STRLEN(expr)` | `LENGTH` 的同义词 | 
| `LOOKUP(expr, lookupName)` | 已注册的 [查询时Lookup表](lookups.md)的Lookup表达式。 注意：lookups也可以直接使用 [`lookup schema`](#from)来查询 |
| `LOWER(expr)` | 返回的expr的全小写 |
| `PARSE_LONG(string[, radix])` | 将字符串解析为具有给定基数的长字符串（BIGINT），如果未提供基数，则解析为10（十进制）。|
| `POSITION(needle IN haystack [FROM fromIndex])` | 返回haystack中指针的索引，索引从1开始。搜索将从fromIndex开始，如果未指定fromIndex，则从1开始。如果找不到针，则返回0。 |
| `REGEXP_EXTRACT(expr, pattern, [index])` | 应用正则表达式模式并提取捕获组，如果没有匹配，则为空。如果index未指定或为零，则返回与模式匹配的子字符串。|
| `REPLACE(expr, pattern, replacement)` | 在expr中用replacement替换pattern，并返回结果。|
| `STRPOS(haystack, needle)` | 返回haystack中指针的索引，索引从1开始。如果找不到针，则返回0。|
| `SUBSTRING(expr, index, [length])` | 返回从索引开始的expr子字符串，最大长度均以UTF-16代码单位度量。|
| `RIGHT(expr, [length])` | 从expr返回最右边的长度字符。|
| `LEFT(expr, [length])` | 返回expr中最左边的长度字符。|
| `SUBSTR(expr, index, [length])` | SUBSTRING的同义词 |
| `TRIM([BOTH | LEADING | TRAILING] [ FROM] expr)` | 返回expr, 如果字符在"chars"中，则从"expr"的开头、结尾或两端删除字符。如果未提供"chars"，则默认为""（空格）。如果未提供方向参数，则默认为"BOTH"。 |
| `BTRIM(expr[, chars])` | `TRIM(BOTH <chars> FROM <expr>)`的替代格式 |
| `LTRIM(expr[, chars])` | `TRIM(LEADING <chars> FROM <expr>)`的替代格式 |
| `RTRIM(expr[, chars])` | `TRIM(TRAILING <chars> FROM <expr>)`的替代格式 |
| `UPPER(expr)` | 返回全大写的expr |
| `REVERSE(expr)` | 反转expr |
| `REPEAT(expr, [N])` | 将expr重复N次 |
| `LPAD(expr, length[, chars])` | 从"expr"中返回一个用"chars"填充的"length"字符串。如果"length"小于"expr"的长度，则结果为"expr"，并被截断为"length"。如果"expr"或"chars"为空，则结果为空。 |
| `RPAD(expr, length[, chars])` | 从"expr"返回一个用"chars"填充的"length"字符串。如果"length"小于"expr"的长度，则结果为"expr"，并被截断为"length"。如果"expr"或"chars"为空，则结果为空。 |

#### 时间函数

时间函数可以与Druid的时 `__time` 一起使用，任何存储为毫秒时间戳的列都可以使用 `MILLIS_TO_TIMESTAMP` 函数，或者任何存储为字符串时间戳的列都可以使用 `TIME_PARSE` 函数。默认情况下，时间操作使用UTC时区。您可以通过将连接上下文参数"sqlTimeZone"设置为另一个时区的名称（如"America/Los_Angeles"）或设置为偏移量（如"-08:00"）来更改时区。如果需要在同一查询中混合多个时区，或者需要使用连接时区以外的时区，则某些函数还接受时区作为参数。这些参数始终优先于连接时区。

连接时区中的字面量时间戳可以使用 `TIMESTAMP '2000-01-01 00:00:00'` 语法编写。在其他时区写入字面量时间戳的最简单方法是使用TIME_PARSE，比如 `TIME_PARSE（'2000-02-01 00:00:00'，NULL，'America/Los_Angeles'）`。

| 函数 | 描述 |
|-|-|
| `CURRENT_TIMESTAMP` | 在连接时区的当前时间戳 |
| `CURRENT_DATE` | 在连接时区的当期日期 |
| `DATE_TRUNC(<unit>, <timestamp_expr>)` | 截断时间戳，将其作为新时间戳返回。单位可以是"毫秒"、"秒"、"分"、"时"、"日"、"周"、"月"、"季"、"年"、"十年"、"世纪"或"千年"。 |
| `TIME_CEIL(<timestamp_expr>, <period>, [<origin>, [<timezone>]])` | 对时间戳进行向上取整，并将其作为新的时间戳返回。周期可以是任何ISO8601周期，如P3M（季度）或PT12H（半天）。时区（如果提供）应为时区名称，如"America/Los_Angeles"或偏移量，如"-08:00"。此函数类似于 `CEIL`，但更灵活。|
| `TIME_FLOOR(<timestamp_expr>, <period>, [<origin>, [<timezone>]])` | 对时间戳进行向下取整，将其作为新时间戳返回。周期可以是任何ISO8601周期，如P3M（季度）或PT12H（半天）。时区（如果提供）应为时区名称，如"America/Los_Angeles"或偏移量，如"-08:00"。此功能类似于 `FLOOR`，但更灵活。 |
| `TIME_SHIFT(<timestamp_expr>, <period>, <step>, [<timezone>])` | 将时间戳移动一个周期（步进时间），将其作为新的时间戳返回。 `period` 可以是任何ISO8601周期，`step` 可能为负。时区（如果提供）应为时区名称，如"America/Los_Angeles"或偏移量，如"-08:00"。|
| `TIME_EXTRACT(<timestamp_expr>, [<unit>, [<timezone>]])` | 从expr中提取时间部分，并将其作为数字返回。单位可以是EPOCH、SECOND、MINUTE、HOUR、DAY（月的日）、DOW（周的日）、DOY（年的日）、WEEK（年周）、MONTH（1到12）、QUARTER（1到4）或YEAR。时区（如果提供）应为时区名称，如"America/Los_Angeles"或偏移量，如"-08:00"。此函数类似于 `EXTRACT`，但更灵活。单位和时区必须是字面量，并且必须提供引号，如时间提取 `TIME_EXTRACT(__time, 'HOUR')` 或 `TIME_EXTRACT(__time, 'HOUR', 'America/Los_Angeles')`。|
| `TIME_PARSE(<string_expr>, [<pattern>, [<timezone>]])` | 如果未提供该 `pattern`, 使用给定的 [Joda DateTimeFormat模式](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html) 或ISO8601（例如`2000-01-02T03:04:05Z`）将字符串解析为时间戳。时区（如果提供）应为时区名称，如"America/Los_Angeles"或偏移量，如"-08:00"，并将用作不包括时区偏移量的字符串的时区。模式和时区必须是字面量。无法解析为时间戳的字符串将返回空值。|
| `TIME_FORMAT(<timestamp_expr>, [<pattern>, [<timezone>]])` | 如果 `pattern` 未提供，使用给定的 [Joda DateTimeFormat模式](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html) 或ISO8601（例如`2000-01-02T03:04:05Z`）将时间戳格式化为字符串。时区（如果提供）应为时区名称，如"America/Los_Angeles"或偏移量，如"-08:00"，并将用作不包括时区偏移量的字符串的时区。模式和时区必须是字面量。无法解析为时间戳的字符串将返回空值。|
| `MILLIS_TO_TIMESTAMP(millis_expr)` | 将纪元后的毫秒数转换为时间戳。|
| `TIMESTAMP_TO_MILLIS(timestamp_expr)` | 将时间戳转换为自纪元以来的毫秒数 |
| `EXTRACT(<unit> FROM timestamp_expr)` | 从expr中提取时间部分，并将其作为数字返回。单位可以是EPOCH, MICROSECOND, MILLISECOND, SECOND, MINUTE, HOUR, DAY (day of month), DOW (day of week), ISODOW (ISO day of week), DOY (day of year), WEEK (week of year), MONTH, QUARTER, YEAR, ISOYEAR, DECADE, CENTURY or MILLENNIUM。必须提供未加引号的单位，如 `EXTRACT(HOUR FROM __time)`。|
| `FLOOR(timestamp_expr TO <unit>)` | 向下取整时间戳，将其作为新时间戳返回。`unit`可以是SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, 或者YEAR |
| `CEIL(timestamp_expr TO <unit>)` | 向上取整时间戳，将其作为新时间戳返回。`unit`可以是SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, 或者YEAR |
| `TIMESTAMPADD(<unit>, <count>, <timestamp>)` | 等价于 `timestamp + count * INTERVAL '1' UNIT` |
| `TIMESTAMPDIFF(<unit>, <timestamp1>, <timestamp2>)` | 返回`timestamp1` 和 `timestamp2` 之间的（有符号）`unit` |
| `timestamp_expr { +/- } <interval_expr>` | 从时间戳中加上或减去时间量。`interval_expr` 可以包括 `INTERVAL '2' HOUR` 之类的区间字面量，也可以包括区间算法。该操作将天数统一视为86400秒，并且不考虑夏令时。要计算夏时制时间，请使用 `TIME_SHIFT`。 |

#### 归约函数

归约函数对零个或多个表达式进行操作，并返回单个表达式。如果没有表达式作为参数传递，则结果为 `NULL`。表达式必须全部转换为公共数据类型，即结果的类型：

* 如果所有的参数都是 `NULL`, 结果是 `NULL`, 否则，`NULL` 参数被忽略
* 如果所有的参数包含了数字和字符串的混合，参数都被解释为字符串
* 如果所有的参数是整型数字，参数都被解释为长整型
* 如果所有的参数是数值且至少一个参数是double，则参数都被解释为double

| 函数 | 描述 |
|-|-|
| `GREATEST([expr1, ...])` | 计算零个或多个表达式，并根据上述比较返回最大值。 |
| `LEAST([expr1, ...])` | 计算零个或多个表达式，并根据上述比较返回最小值。 |

#### IP地址函数

对于IPv4地址函数，地址参数可以是IPv4点分十进制字符串（例如"192.168.0.1"）或表示为整数的IP地址（例如3232235521）。`subnet` 参数应该是一个字符串，格式为CIDR表示法中的IPv4地址子网（例如"192.168.0.0/16"）。

| 函数 | 描述 |
|-|-|
| `IPV4_MATCH(address, subnet)` | 如果 `address` 属于 `subnet`文本，则返回true，否则返回false。如果 `address` 不是有效的IPv4地址，则返回false。如果 `address` 是整数而不是字符串，则此函数更效率。 |
| `IPV4_PARSE(address)` | 将 `address` 解析为存储为整数的IPv4地址。如果 `address` 是有效的IPv4地址的整数，则它将被可以解析。如果 `address` 不能表示为IPv4地址，则返回null。 |
| `IPV4_STRINGIFY(address)` | 将 `address` 转换为以点分隔的IPv4地址十进制字符串。如果 `address` 是有效的IPv4地址的字符串，则它将解析。如果 `address` 不能表示为IPv4地址，则返回null。 |

#### 比较操作符

| 函数 | 描述 |
|-|-|
| `x = y` | 等于 |
| `x <> y` | 不等于 |
| `x > y` | 大于 |
| `x >= y` | 大于等于 |
| `x < y` | 小于 |
| `x <= y` | 小于等于 |
| `x BETWEEN y AND z` | 等价于 `x >= y AND x <= z` |
| `x NOT BETWEEN y AND z` | 等价于 `x >= y OR x <= z` |
| `x LIKE pattern [ESCAPE esc]` | 如果x匹配上了一个SQL LIKE模式则返回true |
| `x NOT LIKE pattern [ESCAPE esc]` | 如果x没有匹配上了一个SQL LIKE模式则返回true |
| `x IS NULL` | 如果x是NULL或者空串，返回true |
| `x IS NOT NULL ` | 如果x不是NULL也不是空串，返回true |
| `x IS TRUE ` | 如果x是true，返回true |
| `x IS NOT TRUE` | 如果x不是true，返回true |
| `x IS FALSE` | 如果x是false，返回true | 
| `x IS NOT FALSE` | 如果x不是false，返回true |
| `x IN (values)` | 如果x是列出的值之一，则为True |
| `x NOT IN (values)` | 如果x不是列出的值之一，则为True |
| `x IN (subquery)` | 如果子查询返回x，则为True。这将转换为联接；有关详细信息，请参阅 [查询转换](#查询转换) |
| `x NOT IN (subquery)` | 如果子查询没有返回x，则为True。这将转换为联接；有关详细信息，请参阅 [查询转换](#查询转换) |
| `x AND y` | 与 |
| `x OR y` | 或 |
| `NOT x` | 非 |

#### Sketch函数

这些函数对返回sketch对象的表达式或列进行操作。

**HLL Sketch函数**

以下函数操作在 [DataSketches HLL sketches](../Configuration/core-ext/datasketches-hll.md) 之上，使用这些函数之前需要加载 [DataSketches扩展](../Development/datasketches-extension.md)

| 函数 | 描述 |
|-|-|
| `HLL_SKETCH_ESTIMATE(expr, [round])` | 从HLL草图返回非重复计数估计值。`expr`必须返回HLL草图。可选的`round`布尔参数如果设置为 `true` 将舍入估计值，默认值为 `false`。 |
| `HLL_SKETCH_ESTIMATE_WITH_ERROR_BOUNDS(expr, [numStdDev])` | 从HLL草图返回不同的计数估计值和错误边界。`expr` 必须返回HLL草图。可以提供可选的 `numStdDev` 参数。 |
| `HLL_SKETCH_UNION([lgK, tgtHllType], expr0, expr1, ...)` | 返回HLL草图的并集，其中每个输入表达式必须返回HLL草图。可以选择将 `lgK` 和 `tgtHllType` 指定为第一个参数；如果提供了，则必须同时指定这两个可选参数。|
| `HLL_SKETCH_TO_STRING(expr)` | 返回用于调试的HLL草图的可读字符串表示形式。`expr` 必须返回HLL草图。|

**Theta Sketch函数**

以下函数操作在 [theta sketches](../Configuration/core-ext/datasketches-theta.md) 之上，使用这些函数之前需要加载 [DataSketches扩展](../Development/datasketches-extension.md)

| 函数 | 描述 |
|-|-|
| `THETA_SKETCH_ESTIMATE(expr)` | 从theta草图返回不同的计数估计值。`expr` 必须返回theta草图。|
| `THETA_SKETCH_ESTIMATE_WITH_ERROR_BOUNDS(expr, errorBoundsStdDev)` | 从theta草图返回不同的计数估计值和错误边界。`expr` 必须返回theta草图。|
| `THETA_SKETCH_UNION([size], expr0, expr1, ...)` | 返回theta草图的并集，其中每个输入表达式必须返回theta草图。可以选择将 `size` 指定为第一个参数。 |
| `THETA_SKETCH_INTERSECT([size], expr0, expr1, ...)` | 返回theta草图的交集，其中每个输入表达式必须返回theta草图。可以选择将 `size` 指定为第一个参数。 |
| `THETA_SKETCH_NOT([size], expr0, expr1, ...)` | 返回theta草图的集合差，其中每个输入表达式必须返回theta草图。可以选择将 `size` 指定为第一个参数。 |

**Quantiles Sketch函数**

以下函数操作在 [quantiles sketches](../Configuration/core-ext/datasketches-quantiles.md) 之上，使用这些函数之前需要加载 [DataSketches扩展](../Development/datasketches-extension.md)

| 函数 | 描述 |
|-|-|
| `DS_GET_QUANTILE(expr, fraction)` | 返回与来自分位数草图的 `fraction` 相对应的分位数估计。`expr` 必须返回分位数草图。 |
| `DS_GET_QUANTILES(expr, fraction0, fraction1, ...)` | 返回一个字符串，该字符串表示与分位数草图的分数列表相对应的分位数估计数组。`expr` 必须返回分位数草图 |
| `DS_HISTOGRAM(expr, splitPoint0, splitPoint1, ...)` | 返回一个字符串，该字符串表示给定一个分割点列表的直方图近似值，该列表定义了分位数草图中的直方图箱。`expr` 必须返回分位数草图。 |
| `DS_CDF(expr, splitPoint0, splitPoint1, ...)` | 返回一个字符串，该字符串表示给定的分割点列表（该列表定义了来自分位数草图的容器边缘）的累积分布函数的近似值。`expr` 必须返回分位数草图。 |
| `DS_RANK(expr, value)` | 返回对给定值的秩的近似值，该值是分布的分数，小于来自分位数草图的该值。`expr` 必须返回分位数草图。 |
| `DS_QUANTILE_SUMMARY(expr)` | 返回分位数草图的字符串摘要，用于调试。`expr` 必须返回分位数草图。 |

#### 其他扩展函数

| 函数 | 描述 |
|-|-|
| `CAST(value AS TYPE)` | 将值转换为其他类型。 可以查看 [数据类型](#数据类型) 来了解在Druid SQL中如何传利CAST |
| `CASE expr WHEN value1 THEN result1 \[ WHEN value2 THEN result2 ... \] \[ ELSE resultN \] END` | 简单CASE |
| `CASE WHEN boolean_expr1 THEN result1 \[ WHEN boolean_expr2 THEN result2 ... \] \[ ELSE resultN \] END` | 搜索CASE |
| `NULLIF(value1, value2)` | 如果value1和value2匹配，则返回NULL，否则返回value1 |
| `COALESCE(value1, value2, ...)` | 返回第一个既不是NULL也不是空字符串的值。 |
| `NVL(expr,expr-for-null)` | 如果'expr'为空（或字符串类型为空字符串），则返回 `expr for null` |
| `BLOOM_FILTER_TEST(<expr>, <serialized-filter>)` | 如果值包含在Base64序列化bloom筛选器中，则返回true。 详情查看 [Bloom Filter扩展](../Configuration/core-ext/bloom-filter.md) |

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