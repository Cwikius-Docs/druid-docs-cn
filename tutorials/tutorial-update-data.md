# 数据更新
被页面将会对如何对现有数据进行更新进行说明，同时演示覆盖（overwrites）和追加（appends）2 种更新方式。

假设你已经完成了 [快速开始](../tutorials/index.md) 页面中的内容或者下面页面中有关的内容，并且你的 Druid 实例已经在你的本地的计算机上运行了。

同时，如果你已经完成了下面内容的阅读的话将会更好的帮助你理解有关数据更新的内容。

* [教程：载入一个文件](../tutorials/tutorial-batch.md)
* [教程：查询数据](../tutorials/tutorial-query.md)
* [教程：Rollup](../tutorials/tutorial-rollup.md)
 
## 覆盖（Overwrite）
本教程的这部分内容将会展示如何覆盖已经存在的时序间隔数据。

### 载入初始化数据

让我们先载入一部分原始数据来作为初始化的数据，随后我们将会对这些数据进行覆盖和追加。

本指南使用的数据导入规范位于 `quickstart/tutorial/updates-init-index.json` 文件。这个数据导入规范将会从 `quickstart/tutorial/updates-data.json` 中导入数据文件，并且创建一个称为`updates-tutorial` 的数据源。

让我们提交这个任务：

```bash
bin/post-index-task --file quickstart/tutorial/updates-init-index.json --url http://localhost:8081
```

在任务完成后，我将会初始化看到一个 "animal" 的维度（dimension）和 "number" 的指标（metric）：

```bash
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

### 覆盖初始化数据

为了覆盖这些初始化的原始数据，我们可以提交另外一个任务，在这个任务中我们会设置有相同的时间间隔，但是输入数据是不同的。

`quickstart/tutorial/updates-overwrite-index.json` 规范将定义如何覆盖 `updates-tutorial` 数据源。

请注意，上面定义的导入规范是从 `quickstart/tutorial/updates-data2.json` 数据文件中读取数据的，并且规范中的 `appendToExisting` 设置为 `false` 
（在规范中的这个设置决定了数据采取的是覆盖导入方式）。

然后让我们提交这个任务：

```bash
bin/post-index-task --file quickstart/tutorial/updates-overwrite-index.json --url http://localhost:8081
```

当 Druid 从覆盖任务中完成导入新的段后，我们会看到原来的 "tiger" 行中对应当前的值为 "lion"； "aardvark" 行中有了不同的数字； "giraffe" 行被完全替换了。
针对不同的环境，上面的配置需要等几分钟后才能生效：

```bash
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

## 将新数据和老数据合并后进行覆盖

让我们现在将新的数据追加到 `updates-tutorial` 数据源。我们将会使用名为 `quickstart/tutorial/updates-data3.json` 的数据文件。

`quickstart/tutorial/updates-append-index.json` 任务规范将会被配置从已经存在的 `quickstart/tutorial/updates-data3.json` 数据文件
和 `updates-tutorial` 数据源同属兑取数据后更新 `updates-tutorial` 数据源。

这个任务将会对 2 个数据源中读取的数据进行合并，然后将合并后的数据重新写回到数据源。

然后让我们提交这个任务：

```bash
bin/post-index-task --file quickstart/tutorial/updates-append-index.json --url http://localhost:8081
```

当 Druid 完成这个任务并且创建新段后，新的行将会被添加到数据源中。
需要注意的是 "lion" 行进行了合并（roll-up）操作：

```bash
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

## 追加数据

让我们尝试使用另外一种方法来对数据进行追加。

`quickstart/tutorial/updates-append-index2.json` 任务规范将会被配置从已经存在的 `quickstart/tutorial/updates-data4.json` 文件中读取数据，
在数据读取后将数据追加到 `updates-tutorial` 数据源中。

请注意，规范中的 `appendToExisting` 设置为 `true`。

然后让我们提交这个任务：

```bash
bin/post-index-task --file quickstart/tutorial/updates-append-index2.json --url http://localhost:8081
```

当新的数据被载入后，我们会看到 octopus 中添加了 2 条新的行。

请注意，新添加的行 "bear" 中的值为 222， 针对已经存在的 "bear" 行中的数据 111，Druid 并没有针对数据进行了 rolled-up 操作。
这是因为新增加的数据保存在不同的段中。

```bash
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

如果我们运行 GroupBy 查询来替代 `select *` 查询的话，我们会看到 "bear" 这一行将在 group By 查询后再合并在一起的：

```bash
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
