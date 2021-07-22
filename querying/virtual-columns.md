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

## 虚拟列(Virtual Columns)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

虚拟列是在查询期间从一组列创建的可查询列“视图”。

一个虚拟列可能会从多个底层列中提取数据，尽管虚拟列总是以单个列的形式出现。

虚拟列可以用作维度，也可以用作聚合器的输入。

每个Apache Druid查询都可以接受一个虚拟列列表作为参数。提供以下扫描查询作为示例：

```json
{
 "queryType": "scan",
 "dataSource": "page_data",
 "columns":[],
 "virtualColumns": [
    {
      "type": "expression",
      "name": "fooPage",
      "expression": "concat('foo' + page)",
      "outputType": "STRING"
    },
    {
      "type": "expression",
      "name": "tripleWordCount",
      "expression": "wordCount * 3",
      "outputType": "LONG"
    }
  ],
 "intervals": [
   "2013-01-01/2019-01-02"
 ]
}
```

### 虚拟列类型

#### 表达式虚拟列

表达式虚拟列语法如下：

```json
{
  "type": "expression",
  "name": <name of the virtual column>,
  "expression": <row expression>,
  "outputType": <output value type of expression>
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `name` | 虚拟列的名称 | 是 |
| `expression` | 通过[表达式](expression.md)输入一些行，输出一个虚拟列的值 | 是 | 
| `outputType` | 表达式输出的类型，可能是 LONG、FLOAT、DOUBLE、STRING | 否（默认是FLOAT） |