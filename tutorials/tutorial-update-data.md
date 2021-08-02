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

Let's try another way of appending data.

The `quickstart/tutorial/updates-append-index2.json` task spec reads input from `quickstart/tutorial/updates-data4.json` and will append its data to the `updates-tutorial` datasource. Note that `appendToExisting` is set to `true` in this spec.

Let's submit that task:

```bash
bin/post-index-task --file quickstart/tutorial/updates-append-index2.json --url http://localhost:8081
```

When the new data is loaded, we can see two additional rows after "octopus". Note that the new "bear" row with number 222 has not been rolled up with the existing bear-111 row, because the new data is held in a separate segment.

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

If we run a GroupBy query instead of a `select *`, we can see that the "bear" rows will group together at query time:

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
