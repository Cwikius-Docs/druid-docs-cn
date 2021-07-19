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

## 表达式(Expressions)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

在原生的查询方式中，表达式可以使用在很多地方， 包括 [虚拟列](virtual-columns.md) 和 [Join条件](datasource.md#join) 中。同样，大多数的 [Druid SQL 函数](druidsql.md) 在 [查询转换](druidsql.md) 阶段会转换成表达式。

表达式支持以下操作符（按优先顺序递减列出）：

| 操作符 | 描述 |
|-|-|
| `!`,`-` | 非和减 |
| `^` | 幂运算 |
| `*`,`/`,`%` | 乘法 |
| `+`,`-` | 加法 |
| `<, <=, >, >=, ==, !=` | 比较运算 |
| `&&, ||` | 逻辑与或 |

Long，Double和String类型都是支持的。 如果一个数字包括了小数点， 将被解释为Double，否则解释为Long。 也就是说，如果想解释为Double，则在数字中增加小数点。 String字面量需要使用单引号包起来。

另外，表达式也只是long double string数组。 数组字面量是通过在由逗号或空格分隔的标量文字值列表周围环绕方括号来创建的。数组中的所有值都必须是相同的类型，但是可以接受空值 `null`。类型化空数组可以通过在尖括号中加上类型前缀来定义：`<STRING>[]`, `<DOUBLE>[]` 或者 `<LONG>[]`

表达式可以包含变量，变量名可以包含字母、数字、'_'和'$'，变量名不能以数字开头。 需要转义其他特殊字符的时候， 必须使用双引号来标志。

对于逻辑操作符，当且仅当它是正数的时候一个数字是true， 0和负数都是false。 对于string类型， 由 `Boolean.valueOf(string)`来评估结果。

支持[多值字符串维度](multi-value-dimensions.md)，可以将其视为标量或数组类型的值。当作为标量类型处理时，表达式将自动转换为在多值类型的所有值上应用标量操作，以模仿Druid的原生行为。数组中的值将被强制返回到原生Druid字符串类型中进行聚合。Druid对单个值（而不是“数组”）上的多值字符串维度进行聚合，其行为类似于许多SQL中可用的`UNNEST`运算符。但是，通过使用`array_to_string`函数，可以对完整数组的字符串化版本进行聚合，从而保留完整的行。在表达式后聚合器中使用`string_to_array`，可以将字符串化维度转换回真正的原生数组类型。

提供以下内置功能。

### 一般函数

| 名称 | 描述 |
|-|-|
| `cast` | cast(expr,'LONG' or 'DOUBLE' or 'STRING' or 'LONG_ARRAY', or 'DOUBLE_ARRAY' or 'STRING_ARRAY') 返回特定类型的表达式，可能会抛出异常。 标量类型可以转换为数组类型，并将采用单个元素列表的形式（null仍然是null）。|
| `if` | if(predicate,then,else)，如果 'predicate' 为正数返回 'then'部分， 否则返回'else'部分 |
| `nvl` | nvl(expr,expr-for-null), 如果'expr'为null（或者字符串类型的空串）返回'expr-for-null'部分 |
| `like` | like(expr, pattern[, escape]) 等价于SQL的 `expr LIKE pattern` |
| `case_searched` | case_searched(expr1, result1, [[expr2, result2, ...], else-result]) |
| `case_simple` | case_simple(expr, value1, result1, [[value2, result2, ...], else-result]) |
| `bloom_filter_test` | bloom_filter_test(expr, filter)对'filter'（base64序列化的字符串）测试'expr'的值。 详情可以查看 [布隆过滤器扩展](../Configuration/core-ext/bloom-filter.md) |

### 字符串函数 

| 名称 | 描述 |
|-|-|
| `concat` | concat(expr, expr , ...) 联接一个字符串列表 |
| `format` | format(pattern[, args...]) 返回一个[Java字符串格式](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html#format-java.lang.String-java.lang.Object...-)的格式化的字符串 |
| `like` | like(expr, pattern[, escape]) 等价于SQL的 `expr LIKE pattern` |
| `lookup` | lookup(expr, lookup-name) 注册一个查询时的lookup表达式 |
| `parse_long` | parse_long(string[, radix]) 将字符串解析为具有给定基数的long，如果没有提供基数，则解析为10（十进制）。|
| `regexp_extract` | regexp(expr, pattern[, index]) 应用正则表达式模式并提取捕获组索引，如果不匹配，则为null。如果索引未指定或为零，则返回与模式匹配的子字符串。模式可能匹配 `expr` 任何位置，如果想匹配整个字符串，在pattern的前后使用 `^`和`$` |
| `regexp_like` | regexp(expr, pattern) 返回 `expr` 是否匹配了正则表达式 `pattern` . 模式可能匹配 `expr` 任何位置，如果想匹配整个字符串，在pattern的前后使用 `^`和`$` |
| `contains_string` | contains(expr, string) 返回`expr` 是否包含 `string` 作为一个子串。 该方法对大小写敏感 |
| `icontains_string` | icontains(expr, string) 返回`expr` 是否包含 `string` 作为一个子串。方法对大小写不敏感 |
| `replace` | replace(expr, pattern, replacement) 使用replacement来替换pattern |
| `substring` | substring(expr, index, length) 的行为类似于Java String的substring |
| `right` | right(expr, length) 从一个字符串中返回右侧指定长度的子串 |
| `left` | left(expr, length) 从一个字符串中返回左侧指定长度的子串 |
| `strlen` | strlen(expr) 返回一个UTF-16编码单位的字符串长度 |
| `strpos` | strpos(haystack, needle[, fromIndex]) 返回在haystack中needle的位置（索引位置从0）。 查找位置从fromIndex开始，如果不指定为0. 如果needle没有找到，返回-1 |
| `trim` | trim(expr[, chars]) 如果 `chars` 指定了，将 `expr`中的前后`chars`删除掉。 如果未指定则 `chars` 默认为 `''` |
| `ltrim` | ltrim(expr[, chars]) 如果 `chars` 指定了，将 `expr`中的前`chars`删除掉。 如果未指定则 `chars` 默认为 `''`|
| `rtrim` | rtrim(expr[, chars]) 如果 `chars` 指定了，将 `expr`中的后`chars`删除掉。 如果未指定则 `chars` 默认为 `''`|
| `lower` | lower(expr) 字符串转小写 |
| `upper` | upper(expr) 字符串转大写 | 
| `reverse` | reverse(expr) 逆转一个字符串 |
| `repeat` | repeat(expr, N) 重复字符串N次 |
| `lpad` | lpad(expr, length, chars) 返回使用`chars`对`expr`进行从左补齐到`length`的字符串。 如果 `length` 比 `expr` 长度短， 则返回结果是截断到 `length` 的 `expr`。当 `expr`或者 `chars`为null时， 结果为null。 如果 `chars` 为空字符串， 则不增加填充，虽然必要时对 `expr` 修剪 |
| `rpad` | rpad(expr, length, chars) 返回使用`chars`对`expr`进行从右补齐到`length`的字符串。 如果 `length` 比 `expr` 长度短， 则返回结果是截断到 `length` 的 `expr`。当 `expr`或者 `chars`为null时， 结果为null。 如果 `chars` 为空字符串， 则不增加填充，虽然必要时对 `expr` 修剪 |

### 时间函数

| 名称 | 描述 |
|-|-|
| `timestamp` | timestamp(expr[,format-string])， 将字符串解析为日期然后返回毫秒，没有format-string时则按ISO日期格式来处理 |
| `unix_timestamp` | 与 `timestamp` 相同，但是返回的是秒 |
| `timestamp_ceil` | timestamp_ceil(expr, period, [origin, [timezone]])， 向上舍入一个时间戳， 并将其作为新的时间戳返回。 period可以是任何ISO8601周期， 如 P3M(季度) 或者 PT12H(半天)。 timezone如果提供了，名称必须如"America/Los_Angeles"这样，或者"-08:00" |
| `timestamp_floor` | timestamp_floor(expr, period, [origin, [timezone]])， 向下舍入一个时间戳， 并将其作为新的时间戳返回。 period可以是任何ISO8601周期， 如 P3M(季度) 或者 PT12H(半天)。 timezone如果提供了，名称必须如"America/Los_Angeles"这样，或者"-08:00" |
| `timestamp_shift` | timestamp_shift(expr, period, step, [timezone]) 将时间戳移动一个周期（步长时间），并将其作为新的时间戳返回。|
| `timestamp_extract` | timestamp_extract(expr, unit, [timezone]) 从expr中提取时间部分，返回一个数字，unit可以是EPOCH、SECOND、MINUTE、HOUR、DAY、DOW、DOY、WEEK、MONTH、QUATER、YEAR。timezone如果提供了，名称必须如"America/Los_Angeles"这样，或者"-08:00" |
| `timestamp_parse` | timestamp_parse(string expr, [pattern, [timezone]]) 使用给定的 [Joda DatetimeFormat Pattern](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html) 将字符串转换为时间戳。 如果pattern未提供，则按照ISO8601或者SQL格式来解析。timezone如果提供了，名称必须如"America/Los_Angeles"这样，或者"-08:00"，将用作不包含时区偏移的字符串的时区。pattern和timezone必须是文字。无法解析为时间戳的字符串将作为空值返回。 |
| `timestamp_format` | timestamp_format(expr, [pattern, [timezone]]) 使用给定的 [Joda DatetimeFormat Pattern](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html) 将字符串转换为时间戳。 如果pattern未提供，则按照ISO8601或者SQL格式来解析。timezone如果提供了，名称必须如"America/Los_Angeles"这样，或者"-08:00"，将用作不包含时区偏移的字符串的时区。pattern和timezone必须是文字。|

### 数学函数

每一个函数都可以查看java.lang.Math的javadoc来获的详细信息

| 名称 | 描述 |
|-|-|
| `abs` | 绝对值 |
| `acos` | 反余弦 |
| `asin` | 反正弦|
| `atan` | 反正切 |
| `atan2` | atan2（y，x）将返回直角坐标（x，y）到极坐标（r，θ）转换的角度θ |
| `cbrt` | cbrt（x）将返回x的立方根 |
| `ceil` | 向上取整 |
| `copysign` | copysign（x）将返回第一个浮点参数和第二个浮点参数的符号 |
| `cos` | 余弦 |
| `cosh` | 双曲余弦 |
| `cot` | 余切 |
| `div` | div（x，y）是x除以y的整数 |
| `exp` | 次方运算 |
| `expm1` | e^x-1 |
| `floor` | 向下取整 |
| `getExponent` | getExponent（x）将返回用于表示x的无偏指数 |
| `hypot` | hypop（x，y）将返回sqrt（x^2+y^2），没有中间溢出或下溢 |
| `log` | 自然对数 |
| `log10` | 以10为底的对数 |
| `log1p` | log1p(x) 返回x+1的自然对数 |
| `max` | max(x,y) 返回两者的最大值 |
| `min` | min(x,y) 返回两者的最小值|
| `nextAfter` | nextAfter（x，y）将返回在y方向上与x相邻的浮点数 |
| `nextUp` | nextUp（x）将返回与x相邻的正无穷方向的浮点值 |
| `pi` | 圆周率 |
| `pow` | pow（x，y）将x的y的次幂 |
| `remainder` | 余数（x，y）将返回ieee754标准规定的两个参数的余数运算 |
| `rint` | rint（x）将返回最接近x的值，该值等于一个数学整数 |
| `round` | round（x，y）将返回x的值，四舍五入到y的小数位。虽然x可以是整数或浮点数，但y必须是整数。返回值的类型由x的类型指定。如果省略，则默认为0。当y为负时，x在y小数点的左侧四舍五入。如果x是NaN，x将返回0。如果x为无穷大，则x将转换为最近的有限双精度。 |
| `scalb` | scalb（d，sf）将返回d*2^sf四舍五入，就好像是由一个正确四舍五入的浮点乘法对双值集的一个成员执行一样 |
| `signum` | signum（x）将返回参数x的signum函数 |
| `sin` | 正弦值 |
| `sinh` | 双曲正弦 |
| `sqrt` | 开平方 |
| `tan` | 正切 |
| `tanh` | 双曲正切 |
| `todegrees` | todegrees（x）将以弧度度量的角度转换为以度度量的近似等效角度 |
| `toradians` | toradians（x）将以度为单位的角度转换为以弧度为单位的近似等效角度 |
| `ulp` | ulp（x）将返回参数x的ulp的大小 |


### 数组函数

| 名称 | 描述 |
|-|-|
| `array(expr1, expr ...)` | 使用第一个参数的类型作为输出数组类型，从表达式参数构造数组 |
| `array_length(arr)` | 返回数组长度 |
| `array_offset(arr, long)` | 返回所提供的基于0的索引处的数组元素，如果索引超出范围，则返回null |
| `array_ordinal(arr, long)` | 返回所提供的基于1的索引处的数组元素，如果索引超出范围，则返回null |
| `array_contains(arr, expr)` | 如果数组包含expr指定的元素，或者 如果expr是数组，包含expr指定的所有元素，则返回1；，否则返回0 |
| `array_overlap(arr1, arr2)` | 如果arr1和arr2有任何共同元素，则返回1，否则返回0 |
| `array_offset_of(arr,expr)` | 返回数组中第一次出现的expr的基于0的索引，未匹配到任何元素返回 `-1` 或 `null`（如果`druid.generic.useDefaultValueForNull=false`） |
| `array_ordinal_of(arr,expr)` | 返回数组中第一次出现的expr的基于1的索引，未匹配到任何元素返回 `-1` 或 `null`（如果`druid.generic.useDefaultValueForNull=false`） |
| `array_prepend(expr,arr)` | 将expr添加到arr的开头，结果数组类型由arr的类型决定 |
| `array_append(arr1,expr)` | 将expr追加到arr，结果数组类型由第一个数组的类型确定 |
| `array_concat(arr1,arr2)` | 串联2个数组，结果数组类型由第一个数组的类型决定 |
| `array_slice(arr,start,end)` | 返回基于0的索引的子数组， 从start到end，包括start不包括end。 如果start小于0或者大于数组的长度，则返回`null` |
| `array_to_string(arr,str)` | 以str为连接符将arr的所有元素连接成一个字符串 |
| `string_to_array(str1,str2)` | 以str2位分隔符将字符串str1分割为数组 |

### 应用函数(Apply Functions)

| 名称 | 描述 |
|-|-|
| `map(lambda, arr)` | 将单参数lambda表达式指定的转换应用于arr的所有元素，并返回一个新数组 |
| `cartesian_map(lambda, arr1, arr2, ...)` | 将多参数lambda表达式指定的转换应用于所有输入数组的笛卡尔乘积的所有元素，并返回一个新数组；lambda参数和数组输入的数目必须相同 |
| `filter(lambda, arr)` | 按单个参数lambda筛选arr，返回包含所有匹配元素的新数组，如果没有匹配元素，则返回null |
| `fold(lambda, arr)` | 在arr上折叠一个2参数lambda。lambda的第一个参数是数组元素，第二个参数是累加器，返回单个累计值。 |
| `cartesian_fold(lambda, arr1, arr2, ...)` | 在所有输入数组的笛卡尔积上折叠多参数lambda。lambda的第一个参数是数组元素，最后一个参数是累加器，返回单个累计值。 |
| `any(lambda, arr)` | 如果数组中的任何元素与lambda表达式匹配，则返回1，否则返回0 |
| `all(lambda, err)` | 如果数组中的所有元素与lambda表达式匹配，则返回1，否则返回0 |

### 约化函数(Reduction functions)

约化函数操作零个或者多个表达式，返回一个单一表达式。如果没有表达式传入，结果是 `NULL`， 表达式必须是可以转化为常用的数字类型的。

* 如果所有的参数是 `NULL`, 结果是 `NULL`; 否则， `NULL` 参数将被忽略
* 如果参数由数字和字符串混合， 参数将被解释为字符串
* 如果所有的参数是整型字符串，参数将被解释为long
* 如果所有的参数是数字，且至少一个参数是double，则参数都被解释为double

| 名称 | 描述 |
|-|-|
| `greatest([expr1, ...])` | 计算零个或多个表达式，并根据上述比较返回最大值 |
| `least([expr1, ...])` | 计算零个或多个表达式，并根据上述比较返回最小值。 |

### IP地址函数

对于IPV4地址函数， `address` 参数要么是点号分割的IPv4(例如："192.168.0.1")，或者一个表示为Long的IP地址（例如：3232235521）。 `subnet` 参数应该是一个CIDR表示法中的IPv4地址子网的字符串（例如:"192.168.0.0/16"）

| 名称 | 描述 |
|-|-|
| `ipv4_match(address, subnet)` ||
| `ipv4_parse(address)` ||
| `ipv4_stringify(address)` ||

### 向量化支持(Vectorization Support)

一些表达式支持[向量化查询引擎](query-context.md)

已支持的特性：

* 任何列类型都支持常量和标识符
* 对于数值和字符串类型支持 `cast` 
* 数学操作：数值类型支持 `+`，`-`，`*`，`/`，`%`, `^` 
* 比较操作：数值类型支持 `=`, `!=`, `>`, `>=`, `<`, `<=`
* 数学函数：数值类型支持 `abs`, `acos`, `asin`, `atan`, `cbrt`, `ceil`, `cos`, `cosh`, `cot`, `exp`, `expm1`, `floor`, `getExponent`, `log`, `log10`, `log1p`, `nextUp`, `rint`, `signum`, `sin`, `sinh`, `sqrt`, `tan`, `tanh`, `toDegrees`, `toRadians`, `ulp`, `atan2`, `copySign`, `div`, `hypot`, `max`, `min`, `nextAfter`, `pow`, `remainder`, `scalb`
* 时间函数： 数值类型支持 `timestamp_floor` 
* 其他： 对于数值和字符串类型， `parse_long` 是被支持的

