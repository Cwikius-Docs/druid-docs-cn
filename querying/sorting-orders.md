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

## 字符串比较器(String comparators)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

本节中的排序顺序都被使用于[TopNMetricSpec](topnsorting.md), [SearchQuery](searchquery.md), GroupBy查询的[LimitSpec](limitspec.md) 和 [BoundFilter](filters.md) 中

### Lexicographic

通过将字符串转换为其UTF-8字节数组表示形式并逐字节按字典进行比较，对值进行排序

### Alphanumeric

适用于包含数字和非数字内容的字符串，例如"file12排在file2之后"

可以通过查看[https://github.com/amjjd/java-alphanum](https://github.com/amjjd/java-alphanum)来获取更多该类型如何排序值

此顺序不适用于带小数点或负数的数字。
* 例如，在这个顺序中，"1.3"先于"1.15"，因为"15"的有效数字比"3"的数字要大
* 负数在正数之后排序（因为负数中数字字符在"-"之前）

### Numeric

将值排序为数字，支持整数和浮点值。支持负值。

此排序顺序将尝试将所有字符串值解析为数字。不可解析的值被视为空值，并且空值先于数字。

当比较两个不可解析的值（例如，“hello”和“world”）时，这种排序将通过按字典顺序比较未解析的字符串来排序。

### Strlen

按字符串长度对值排序。当出现平局时，这个比较器返回到使用StringCompareTo方法。

### Version

根据版本号来排序值，例如"10.0排在9.0之后"， "1.0.0-SNAPSHOT排在1.0.0之后"

可以在[https://maven.apache.org/ref/3.6.0/maven-artifact/apidocs/org/apache/maven/artifact/versioning/ComparableVersion.html](https://maven.apache.org/ref/3.6.0/maven-artifact/apidocs/org/apache/maven/artifact/versioning/ComparableVersion.html)中查看更多关于版本值排序的详情