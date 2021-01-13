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

## 数据更新
本教程演示如何更新现有数据，同时展示覆盖(Overwrite)和追加(append)的两个方式。

本教程我们假设您已经按照[单服务器部署](../GettingStarted/chapter-3.md)中描述下载了Druid，并运行在本地机器上。

完成[加载本地文件](./chapter-1.md)、[数据查询](./chapter-4.md)和[roll-up](./chapter-5.md)部分内容也是非常有帮助的

### 数据覆盖
本节教程将介绍如何覆盖现有的指定间隔的数据

#### 加载初始数据

本节教程使用的任务摄取规范位于 `quickstart/tutorial/updates-init-index.json`, 本规范从 `quickstart/tutorial/updates-data.json` 输入文件创建一个名称为 `updates-tutorial` 的数据源

提交任务：
```json
bin/post-index-task --file quickstart/tutorial/updates-init-index.json --url http://localhost:8081
```

我们有三个包含"动物"维度和"数字"指标的初始行：
```json
dsql> select * from "updates-tutorial";
┌──────────────────────────┬──────────┬───────┬────────┐
│ __time                   │ animal   │ count │ number │
├──────────────────────────┼──────────┼───────┼────────┤
│ 2018-01-01T01:01:00.000Z │ tiger    │     1 │    100 │
│ 2018-01-01T03:01:00.000Z │ aardvark │     1 │     42 │
│ 2018-01-01T03:01:00.000Z │ giraffe  │     1 │  14124 │
└──────────────────────────┴──────────┴───────┴────────┘
Retrieved 3 rows in 1.42s.
```
#### 覆盖初始数据

为了覆盖这些数据，我们可以在相同的时间间隔内提交另一个任务，但是使用不同的输入数据。

`quickstart/tutorial/updates-overwrite-index.json` 规范将会对 `updates-tutorial` 数据进行数据重写

注意，此任务从 `quickstart/tutorial/updates-data2.json` 读取输入，`appendToExisting` 设置为false（表示这是一个覆盖）

提交任务：
```json
bin/post-index-task --file quickstart/tutorial/updates-overwrite-index.json --url http://localhost:8081
```

当Druid从这个覆盖任务加载完新的段时，"tiger"行现在有了值"lion"，"aardvark"行有了不同的编号，"giraffe"行已经被替换。更改可能需要几分钟才能生效：

```json
dsql> select * from "updates-tutorial";
┌──────────────────────────┬──────────┬───────┬────────┐
│ __time                   │ animal   │ count │ number │
├──────────────────────────┼──────────┼───────┼────────┤
│ 2018-01-01T01:01:00.000Z │ lion     │     1 │    100 │
│ 2018-01-01T03:01:00.000Z │ aardvark │     1 │   9999 │
│ 2018-01-01T04:01:00.000Z │ bear     │     1 │    111 │
└──────────────────────────┴──────────┴───────┴────────┘
Retrieved 3 rows in 0.02s.
```

### 将旧数据与新数据合并并覆盖

现在我们尝试在 `updates-tutorial` 数据源追加一些新的数据，我们将从 `quickstart/tutorial/updates-data3.json` 增加新的数据

`quickstart/tutorial/updates-append-index.json` 任务规范配置为从现有的 `updates-tutorial` 数据源和 `quickstart/tutorial/updates-data3.json` 文件读取数据，该任务将组合来自两个输入源的数据，然后用新的组合数据覆盖原始数据。

提交任务：
```json
bin/post-index-task --file quickstart/tutorial/updates-append-index.json --url http://localhost:8081
```

当Druid完成从这个覆盖任务加载新段时，新行将被添加到数据源中。请注意，“Lion”行发生了roll up：
```json
dsql> select * from "updates-tutorial";
┌──────────────────────────┬──────────┬───────┬────────┐
│ __time                   │ animal   │ count │ number │
├──────────────────────────┼──────────┼───────┼────────┤
│ 2018-01-01T01:01:00.000Z │ lion     │     2 │    400 │
│ 2018-01-01T03:01:00.000Z │ aardvark │     1 │   9999 │
│ 2018-01-01T04:01:00.000Z │ bear     │     1 │    111 │
│ 2018-01-01T05:01:00.000Z │ mongoose │     1 │    737 │
│ 2018-01-01T06:01:00.000Z │ snake    │     1 │   1234 │
│ 2018-01-01T07:01:00.000Z │ octopus  │     1 │    115 │
└──────────────────────────┴──────────┴───────┴────────┘
Retrieved 6 rows in 0.02s.
```

### 追加数据

现在尝试另一种追加数据的方式

`quickstart/tutorial/updates-append-index2.json` 任务规范从 `quickstart/tutorial/updates-data4.json` 文件读取数据，然后追加到 `updates-tutorial` 数据源。注意到在规范中 `appendToExisting` 设置为 `true`

提交任务：
```json
bin/post-index-task --file quickstart/tutorial/updates-append-index2.json --url http://localhost:8081
```

加载新数据后，我们可以看到"octopus"后面额外的两行。请注意，编号为222的新"bear"行尚未与现有的bear-111行合并，因为新数据保存在单独的段中。

```json
dsql> select * from "updates-tutorial";
┌──────────────────────────┬──────────┬───────┬────────┐
│ __time                   │ animal   │ count │ number │
├──────────────────────────┼──────────┼───────┼────────┤
│ 2018-01-01T01:01:00.000Z │ lion     │     2 │    400 │
│ 2018-01-01T03:01:00.000Z │ aardvark │     1 │   9999 │
│ 2018-01-01T04:01:00.000Z │ bear     │     1 │    111 │
│ 2018-01-01T05:01:00.000Z │ mongoose │     1 │    737 │
│ 2018-01-01T06:01:00.000Z │ snake    │     1 │   1234 │
│ 2018-01-01T07:01:00.000Z │ octopus  │     1 │    115 │
│ 2018-01-01T04:01:00.000Z │ bear     │     1 │    222 │
│ 2018-01-01T09:01:00.000Z │ falcon   │     1 │   1241 │
└──────────────────────────┴──────────┴───────┴────────┘
Retrieved 8 rows in 0.02s.
```

当我们执行一个GroupBy查询而非 `Select *`, 我们看到"beer"行将在查询时聚合在一起：

```json
dsql> select __time, animal, SUM("count"), SUM("number") from "updates-tutorial" group by __time, animal;
┌──────────────────────────┬──────────┬────────┬────────┐
│ __time                   │ animal   │ EXPR$2 │ EXPR$3 │
├──────────────────────────┼──────────┼────────┼────────┤
│ 2018-01-01T01:01:00.000Z │ lion     │      2 │    400 │
│ 2018-01-01T03:01:00.000Z │ aardvark │      1 │   9999 │
│ 2018-01-01T04:01:00.000Z │ bear     │      2 │    333 │
│ 2018-01-01T05:01:00.000Z │ mongoose │      1 │    737 │
│ 2018-01-01T06:01:00.000Z │ snake    │      1 │   1234 │
│ 2018-01-01T07:01:00.000Z │ octopus  │      1 │    115 │
│ 2018-01-01T09:01:00.000Z │ falcon   │      1 │   1241 │
└──────────────────────────┴──────────┴────────┴────────┘
Retrieved 7 rows in 0.23s.
```
