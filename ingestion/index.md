# 数据导入

All data in Druid is organized into _segments_, which are data files each of which may have up to a few million rows.
Loading data in Druid is called _ingestion_ or _indexing_, and consists of reading data from a source system and creating
segments based on that data.

In most ingestion methods, the Druid [MiddleManager](../design/middlemanager.md) processes
(or the [Indexer](../design/indexer.md) processes) load your source data. One exception is
Hadoop-based ingestion, where this work is instead done using a Hadoop MapReduce job on YARN (although MiddleManager or Indexer
processes are still involved in starting and monitoring the Hadoop jobs).

Once segments have been generated and stored in [deep storage](../dependencies/deep-storage.md), they are loaded by Historical processes.
For more details on how this works, see the [Storage design](../design/architecture.md#storage-design) section
of Druid's design documentation.

## How to use this documentation

This **page you are currently reading** provides information about universal Druid ingestion concepts, and about
configurations that are common to all [ingestion methods](#ingestion-methods).

The **individual pages for each ingestion method** provide additional information about concepts and configurations
that are unique to each ingestion method.

We recommend reading (or at least skimming) this universal page first, and then referring to the page for the
ingestion method or methods that you have chosen.

## Ingestion methods

The table below lists Druid's most common data ingestion methods, along with comparisons to help you choose
the best one for your situation. Each ingestion method supports its own set of source systems to pull from. For details
about how each method works, as well as configuration properties specific to that method, check out its documentation
page.

### Streaming

The most recommended, and most popular, method of streaming ingestion is the
[Kafka indexing service](../development/extensions-core/kafka-ingestion.md) that reads directly from Kafka. Alternatively, the Kinesis
indexing service works with Amazon Kinesis Data Streams.

This table compares the options:

| **Method** | [Kafka](../development/extensions-core/kafka-ingestion.md) | [Kinesis](../development/extensions-core/kinesis-ingestion.md) |
|---|-----|--------------|
| **Supervisor type** | `kafka` | `kinesis`|
| **How it works** | Druid reads directly from Apache Kafka. | Druid reads directly from Amazon Kinesis.|
| **Can ingest late data?** | Yes | Yes |
| **Exactly-once guarantees?** | Yes | Yes |

### Batch

When doing batch loads from files, you should use one-time [tasks](tasks.md), and you have three options: `index_parallel` (native batch; parallel), `index_hadoop` (Hadoop-based),
or `index` (native batch; single-task).

In general, we recommend native batch whenever it meets your needs, since the setup is simpler (it does not depend on
an external Hadoop cluster). However, there are still scenarios where Hadoop-based batch ingestion might be a better choice,
for example when you already have a running Hadoop cluster and want to
use the cluster resource of the existing cluster for batch ingestion.

This table compares the three available options:

| **Method** | [Native batch (parallel)](native-batch.md#parallel-task) | [Hadoop-based](hadoop.md) | [Native batch (simple)](native-batch.md#simple-task) |
|---|-----|--------------|------------|
| **Task type** | `index_parallel` | `index_hadoop` | `index`  |
| **Parallel?** | Yes, if `inputFormat` is splittable and `maxNumConcurrentSubTasks` > 1 in `tuningConfig`. See [data format documentation](./data-formats.md) for details. | Yes, always. | No. Each task is single-threaded. |
| **Can append or overwrite?** | Yes, both. | Overwrite only. | Yes, both. |
| **External dependencies** | None. | Hadoop cluster (Druid submits Map/Reduce jobs). | None. |
| **Input locations** | Any [`inputSource`](./native-batch.md#input-sources). | Any Hadoop FileSystem or Druid datasource. | Any [`inputSource`](./native-batch.md#input-sources). |
| **File formats** | Any [`inputFormat`](./data-formats.md#input-format). | Any Hadoop InputFormat. | Any [`inputFormat`](./data-formats.md#input-format). |
| **[Rollup modes](#rollup)** | Perfect if `forceGuaranteedRollup` = true in the [`tuningConfig`](native-batch.md#tuningconfig).  | Always perfect. | Perfect if `forceGuaranteedRollup` = true in the [`tuningConfig`](native-batch.md#tuningconfig). |
| **Partitioning options** | Dynamic, hash-based, and range-based partitioning methods are available. See [Partitions Spec](./native-batch.md#partitionsspec) for details. | Hash-based or range-based partitioning via [`partitionsSpec`](hadoop.md#partitionsspec). | Dynamic and hash-based partitioning methods are available. See [Partitions Spec](./native-batch.md#partitionsspec-1) for details. |

<a name="data-model"></a>

## Druid's data model

### Datasources

Druid data is stored in datasources, which are similar to tables in a traditional RDBMS. Druid
offers a unique data modeling system that bears similarity to both relational and timeseries models.

### Primary timestamp

Druid schemas must always include a primary timestamp. The primary timestamp is used for
[partitioning and sorting](#partitioning) your data. Druid queries are able to rapidly identify and retrieve data
corresponding to time ranges of the primary timestamp column. Druid is also able to use the primary timestamp column
for time-based [data management operations](data-management.md) such as dropping time chunks, overwriting time chunks,
and time-based retention rules.

The primary timestamp is parsed based on the [`timestampSpec`](#timestampspec). In addition, the
[`granularitySpec`](#granularityspec) controls other important operations that are based on the primary timestamp.
Regardless of which input field the primary timestamp is read from, it will always be stored as a column named `__time`
in your Druid datasource.

If you have more than one timestamp column, you can store the others as
[secondary timestamps](schema-design.md#secondary-timestamps).

### Dimensions

Dimensions are columns that are stored as-is and can be used for any purpose. You can group, filter, or apply
aggregators to dimensions at query time in an ad-hoc manner. If you run with [rollup](#rollup) disabled, then the set of
dimensions is simply treated like a set of columns to ingest, and behaves exactly as you would expect from a typical
database that does not support a rollup feature.

Dimensions are configured through the [`dimensionsSpec`](#dimensionsspec).

### Metrics

Metrics are columns that are stored in an aggregated form. They are most useful when [rollup](#rollup) is enabled.
Specifying a metric allows you to choose an aggregation function for Druid to apply to each row during ingestion. This
has two benefits:

1. If [rollup](#rollup) is enabled, multiple rows can be collapsed into one row even while retaining summary
   information. In the [rollup tutorial](../tutorials/tutorial-rollup.md), this is used to collapse netflow data to a
   single row per `(minute, srcIP, dstIP)` tuple, while retaining aggregate information about total packet and byte counts.
2. Some aggregators, especially approximate ones, can be computed faster at query time even on non-rolled-up data if
   they are partially computed at ingestion time.

Metrics are configured through the [`metricsSpec`](#metricsspec).

## Rollup

### What is rollup?

Druid can roll up data as it is ingested to minimize the amount of raw data that needs to be stored. Rollup is
a form of summarization or pre-aggregation. In practice, rolling up data can dramatically reduce the size of data that
needs to be stored, reducing row counts by potentially orders of magnitude. This storage reduction does come at a cost:
as we roll up data, we lose the ability to query individual events.

When rollup is disabled, Druid loads each row as-is without doing any form of pre-aggregation. This mode is similar
to what you would expect from a typical database that does not support a rollup feature.

When rollup is enabled, then any rows that have identical [dimensions](#dimensions) and [timestamp](#primary-timestamp)
to each other (after [`queryGranularity`-based truncation](#granularityspec)) can be collapsed, or _rolled up_, into a
single row in Druid.

By default, rollup is enabled.

### Enabling or disabling rollup

Rollup is controlled by the `rollup` setting in the [`granularitySpec`](#granularityspec). By default, it is `true`
(enabled). Set this to `false` if you want Druid to store each record as-is, without any rollup summarization.

### Example of rollup

For an example of how to configure rollup, and of how the feature will modify your data, check out the
[rollup tutorial](../tutorials/tutorial-rollup.md).

### Maximizing rollup ratio

You can measure the rollup ratio of a datasource by comparing the number of rows in Druid (`COUNT`) with the number of ingested
events.  One way to do this is with a
[Druid SQL](../querying/sql.md) query such as the following, where "count" refers to a `count`-type metric generated at ingestion time:

```sql
SELECT SUM("count") / (COUNT(*) * 1.0)
FROM datasource
```

The higher this number is, the more benefit you are gaining from rollup.

> See [Counting the number of ingested events](schema-design.md#counting) on the "Schema design" page for more details about
how counting works when rollup is enabled.

Tips for maximizing rollup:

- Generally, the fewer dimensions you have, and the lower the cardinality of your dimensions, the better rollup ratios
  you will achieve.
- Use [sketches](schema-design.md#sketches) to avoid storing high cardinality dimensions, which harm rollup ratios.
- Adjusting `queryGranularity` at ingestion time (for example, using `PT5M` instead of `PT1M`) increases the
  likelihood of two rows in Druid having matching timestamps, and can improve your rollup ratios.
- It can be beneficial to load the same data into more than one Druid datasource. Some users choose to create a "full"
  datasource that has rollup disabled (or enabled, but with a minimal rollup ratio) and an "abbreviated" datasource that
  has fewer dimensions and a higher rollup ratio. When queries only involve dimensions in the "abbreviated" set, using
  that datasource leads to much faster query times. This can often be done with just a small increase in storage
  footprint, since abbreviated datasources tend to be substantially smaller.
- If you are using a [best-effort rollup](#perfect-rollup-vs-best-effort-rollup) ingestion configuration that does not guarantee perfect
  rollup, you can potentially improve your rollup ratio by switching to a guaranteed perfect rollup option, or by
  [reindexing](data-management.md#reingesting-data) or [compacting](compaction.md) your data in the background after initial ingestion.

### Perfect rollup vs Best-effort rollup

Some Druid ingestion methods guarantee _perfect rollup_, meaning that input data are perfectly aggregated at ingestion
time. Others offer _best-effort rollup_, meaning that input data might not be perfectly aggregated and thus there could
be multiple segments holding rows with the same timestamp and dimension values.

In general, ingestion methods that offer best-effort rollup do this because they are either parallelizing ingestion
without a shuffling step (which would be required for perfect rollup), or because they are finalizing and publishing
segments before all data for a time chunk has been received, which we call _incremental publishing_. In both of these
cases, records that could theoretically be rolled up may end up in different segments. All types of streaming ingestion
run in this mode.

Ingestion methods that guarantee perfect rollup do it with an additional preprocessing step to determine intervals
and partitioning before the actual data ingestion stage. This preprocessing step scans the entire input dataset, which
generally increases the time required for ingestion, but provides information necessary for perfect rollup.

The following table shows how each method handles rollup:

|Method|How it works|
|------|------------|
|[Native batch](native-batch.md)|`index_parallel` and `index` type may be either perfect or best-effort, based on configuration.|
|[Hadoop](hadoop.md)|Always perfect.|
|[Kafka indexing service](../development/extensions-core/kafka-ingestion.md)|Always best-effort.|
|[Kinesis indexing service](../development/extensions-core/kinesis-ingestion.md)|Always best-effort.|

## Partitioning

### Why partition?

Optimal partitioning and sorting of segments within your datasources can have substantial impact on footprint and
performance.

Druid datasources are always partitioned by time into _time chunks_, and each time chunk contains one or more segments.
This partitioning happens for all ingestion methods, and is based on the `segmentGranularity` parameter of your
ingestion spec's `dataSchema`.

The segments within a particular time chunk may also be partitioned further, using options that vary based on the
ingestion type you have chosen. In general, doing this secondary partitioning using a particular dimension will
improve locality, meaning that rows with the same value for that dimension are stored together and can be accessed
quickly.

You will usually get the best performance and smallest overall footprint by partitioning your data on some "natural"
dimension that you often filter by, if one exists. This will often improve compression - users have reported threefold
storage size decreases - and it also tends to improve query performance as well.

> Partitioning and sorting are best friends! If you do have a "natural" partitioning dimension, you should also consider
> placing it first in the `dimensions` list of your `dimensionsSpec`, which tells Druid to sort rows within each segment
> by that column. This will often improve compression even more, beyond the improvement gained by partitioning alone.
>
> However, note that currently, Druid always sorts rows within a segment by timestamp first, even before the first
> dimension listed in your `dimensionsSpec`. This can prevent dimension sorting from being maximally effective. If
> necessary, you can work around this limitation by setting `queryGranularity` equal to `segmentGranularity` in your
> [`granularitySpec`](#granularityspec), which will set all timestamps within the segment to the same value, and by saving
> your "real" timestamp as a [secondary timestamp](schema-design.md#secondary-timestamps). This limitation may be removed
> in a future version of Druid.

### How to set up partitioning

Not all ingestion methods support an explicit partitioning configuration, and not all have equivalent levels of
flexibility. As of current Druid versions, If you are doing initial ingestion through a less-flexible method (like
Kafka) then you can use [reindexing](data-management.md#reingesting-data) or [compaction](compaction.md) to repartition your data after it
is initially ingested. This is a powerful technique: you can use it to ensure that any data older than a certain
threshold is optimally partitioned, even as you continuously add new data from a stream.

The following table shows how each ingestion method handles partitioning:

|Method|How it works|
|------|------------|
|[Native batch](native-batch.md)|Configured using [`partitionsSpec`](native-batch.md#partitionsspec) inside the `tuningConfig`.|
|[Hadoop](hadoop.md)|Configured using [`partitionsSpec`](hadoop.md#partitionsspec) inside the `tuningConfig`.|
|[Kafka indexing service](../development/extensions-core/kafka-ingestion.md)|Partitioning in Druid is guided by how your Kafka topic is partitioned. You can also [reindex](data-management.md#reingesting-data) or [compact](compaction.md) to repartition after initial ingestion.|
|[Kinesis indexing service](../development/extensions-core/kinesis-ingestion.md)|Partitioning in Druid is guided by how your Kinesis stream is sharded. You can also [reindex](data-management.md#reingesting-data) or [compact](compaction.md) to repartition after initial ingestion.|

> Note that, of course, one way to partition data is to load it into separate datasources. This is a perfectly viable
> approach and works very well when the number of datasources does not lead to excessive per-datasource overheads. If
> you go with this approach, then you can ignore this section, since it is describing how to set up partitioning
> _within a single datasource_.
>
> For more details on splitting data up into separate datasources, and potential operational considerations, refer
> to the [Multitenancy considerations](../querying/multitenancy.md) page.

<a name="spec"></a>

## Ingestion specs

No matter what ingestion method you use, data is loaded into Druid using either one-time [tasks](tasks.md) or
ongoing "supervisors" (which run and supervise a set of tasks over time). In any case, part of the task or supervisor
definition is an _ingestion spec_.

Ingestion specs consists of three main components:

- [`dataSchema`](#dataschema), which configures the [datasource name](#datasource),
  [primary timestamp](#timestampspec), [dimensions](#dimensionsspec), [metrics](#metricsspec), and [transforms and filters](#transformspec) (if needed).
- [`ioConfig`](#ioconfig), which tells Druid how to connect to the source system and how to parse data. For more information, see the
  documentation for each [ingestion method](#ingestion-methods).
- [`tuningConfig`](#tuningconfig), which controls various tuning parameters specific to each
  [ingestion method](#ingestion-methods).

Example ingestion spec for task type `index_parallel` (native batch):

```
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia",
      "timestampSpec": {
        "column": "timestamp",
        "format": "auto"
      },
      "dimensionsSpec": {
        "dimensions": [
          "page",
          "language",
          { "type": "long", "name": "userId" }
        ]
      },
      "metricsSpec": [
        { "type": "count", "name": "count" },
        { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
        { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
      ],
      "granularitySpec": {
        "segmentGranularity": "day",
        "queryGranularity": "none",
        "intervals": [
          "2013-08-31/2013-09-01"
        ]
      }
    },
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "local",
        "baseDir": "examples/indexing/",
        "filter": "wikipedia_data.json"
      },
      "inputFormat": {
        "type": "json",
        "flattenSpec": {
          "useFieldDiscovery": true,
          "fields": [
            { "type": "path", "name": "userId", "expr": "$.user.id" }
          ]
        }
      }
    },
    "tuningConfig": {
      "type": "index_parallel"
    }
  }
}
```

The specific options supported by these sections will depend on the [ingestion method](#ingestion-methods) you have chosen.
For more examples, refer to the documentation for each ingestion method.

You can also load data visually, without the need to write an ingestion spec, using the "Load data" functionality
available in Druid's [web console](../operations/druid-console.md). Druid's visual data loader supports
[Kafka](../development/extensions-core/kafka-ingestion.md),
[Kinesis](../development/extensions-core/kinesis-ingestion.md), and
[native batch](native-batch.md) mode.

## `dataSchema`

> The `dataSchema` spec has been changed in 0.17.0. The new spec is supported by all ingestion methods
except for _Hadoop_ ingestion. See the [Legacy `dataSchema` spec](#legacy-dataschema-spec) for the old spec.

The `dataSchema` is a holder for the following components:

- [datasource name](#datasource), [primary timestamp](#timestampspec),
  [dimensions](#dimensionsspec), [metrics](#metricsspec), and
  [transforms and filters](#transformspec) (if needed).

An example `dataSchema` is:

```
"dataSchema": {
  "dataSource": "wikipedia",
  "timestampSpec": {
    "column": "timestamp",
    "format": "auto"
  },
  "dimensionsSpec": {
    "dimensions": [
      "page",
      "language",
      { "type": "long", "name": "userId" }
    ]
  },
  "metricsSpec": [
    { "type": "count", "name": "count" },
    { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
    { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
  ],
  "granularitySpec": {
    "segmentGranularity": "day",
    "queryGranularity": "none",
    "intervals": [
      "2013-08-31/2013-09-01"
    ]
  }
}
```

### `dataSource`

The `dataSource` is located in `dataSchema` → `dataSource` and is simply the name of the
[datasource](../design/architecture.md#datasources-and-segments) that data will be written to. An example
`dataSource` is:

```
"dataSource": "my-first-datasource"
```

### `timestampSpec`

The `timestampSpec` is located in `dataSchema` → `timestampSpec` and is responsible for
configuring the [primary timestamp](#primary-timestamp). An example `timestampSpec` is:

```
"timestampSpec": {
  "column": "timestamp",
  "format": "auto"
}
```

> Conceptually, after input data records are read, Druid applies ingestion spec components in a particular order:
> first [`flattenSpec`](data-formats.md#flattenspec) (if any), then [`timestampSpec`](#timestampspec), then [`transformSpec`](#transformspec),
> and finally [`dimensionsSpec`](#dimensionsspec) and [`metricsSpec`](#metricsspec). Keep this in mind when writing
> your ingestion spec.

A `timestampSpec` can have the following components:

|Field|Description|Default|
|-----|-----------|-------|
|column|Input row field to read the primary timestamp from.<br><br>Regardless of the name of this input field, the primary timestamp will always be stored as a column named `__time` in your Druid datasource.|timestamp|
|format|Timestamp format. Options are: <ul><li>`iso`: ISO8601 with 'T' separator, like "2000-01-01T01:02:03.456"</li><li>`posix`: seconds since epoch</li><li>`millis`: milliseconds since epoch</li><li>`micro`: microseconds since epoch</li><li>`nano`: nanoseconds since epoch</li><li>`auto`: automatically detects ISO (either 'T' or space separator) or millis format</li><li>any [Joda DateTimeFormat string](http://joda-time.sourceforge.net/apidocs/org/joda/time/format/DateTimeFormat.html)</li></ul>|auto|
|missingValue|Timestamp to use for input records that have a null or missing timestamp `column`. Should be in ISO8601 format, like `"2000-01-01T01:02:03.456"`, even if you have specified something else for `format`. Since Druid requires a primary timestamp, this setting can be useful for ingesting datasets that do not have any per-record timestamps at all. |none|

### `dimensionsSpec`

The `dimensionsSpec` is located in `dataSchema` → `dimensionsSpec` and is responsible for
configuring [dimensions](#dimensions). An example `dimensionsSpec` is:

```
"dimensionsSpec" : {
  "dimensions": [
    "page",
    "language",
    { "type": "long", "name": "userId" }
  ],
  "dimensionExclusions" : [],
  "spatialDimensions" : []
}
```

> Conceptually, after input data records are read, Druid applies ingestion spec components in a particular order:
> first [`flattenSpec`](data-formats.md#flattenspec) (if any), then [`timestampSpec`](#timestampspec), then [`transformSpec`](#transformspec),
> and finally [`dimensionsSpec`](#dimensionsspec) and [`metricsSpec`](#metricsspec). Keep this in mind when writing
> your ingestion spec.

A `dimensionsSpec` can have the following components:

| Field | Description | Default |
|-------|-------------|---------|
| dimensions | A list of [dimension names or objects](#dimension-objects). Cannot have the same column in both `dimensions` and `dimensionExclusions`.<br><br>If this and `spatialDimensions` are both null or empty arrays, Druid will treat all non-timestamp, non-metric columns that do not appear in `dimensionExclusions` as String-typed dimension columns. See [inclusions and exclusions](#inclusions-and-exclusions) below for details. | `[]` |
| dimensionExclusions | The names of dimensions to exclude from ingestion. Only names are supported here, not objects.<br><br>This list is only used if the `dimensions` and `spatialDimensions` lists are both null or empty arrays; otherwise it is ignored. See [inclusions and exclusions](#inclusions-and-exclusions) below for details. | `[]` |
| spatialDimensions | An array of [spatial dimensions](../development/geo.md). | `[]` |

#### Dimension objects

Each dimension in the `dimensions` list can either be a name or an object. Providing a name is equivalent to providing
a `string` type dimension object with the given name, e.g. `"page"` is equivalent to `{"name": "page", "type": "string"}`.

Dimension objects can have the following components:

| Field | Description | Default |
|-------|-------------|---------|
| type | Either `string`, `long`, `float`, or `double`. | `string` |
| name | The name of the dimension. This will be used as the field name to read from input records, as well as the column name stored in generated segments.<br><br>Note that you can use a [`transformSpec`](#transformspec) if you want to rename columns during ingestion time. | none (required) |
| createBitmapIndex | For `string` typed dimensions, whether or not bitmap indexes should be created for the column in generated segments. Creating a bitmap index requires more storage, but speeds up certain kinds of filtering (especially equality and prefix filtering). Only supported for `string` typed dimensions. | `true` |
| multiValueHandling | Specify the type of handling for [multi-value fields](../querying/multi-value-dimensions.md). Possible values are `sorted_array`, `sorted_set`, and `array`. `sorted_array` and `sorted_set` order the array upon ingestion. `sorted_set` removes duplicates. `array` ingests data as-is | `sorted_array` |

#### Inclusions and exclusions

Druid will interpret a `dimensionsSpec` in two possible ways: _normal_ or _schemaless_.

Normal interpretation occurs when either `dimensions` or `spatialDimensions` is non-empty. In this case, the combination of the two lists will be taken as the set of dimensions to be ingested, and the list of `dimensionExclusions` will be ignored.

Schemaless interpretation occurs when both `dimensions` and `spatialDimensions` are empty or null. In this case, the set of dimensions is determined in the following way:

1. First, start from the set of all root-level fields from the input record, as determined by the [`inputFormat`](./data-formats.md). "Root-level" includes all fields at the top level of a data structure, but does not included fields nested within maps or lists. To extract these, you must use a [`flattenSpec`](./data-formats.md#flattenspec). All fields of non-nested data formats, such as CSV and delimited text, are considered root-level.
2. If a [`flattenSpec`](./data-formats.md#flattenspec) is being used, the set of root-level fields includes any fields generated by the flattenSpec. The useFieldDiscovery parameter determines whether the original root-level fields will be retained or discarded.
3. Any field listed in `dimensionExclusions` is excluded.
4. The field listed as `column` in the [`timestampSpec`](#timestampspec) is excluded.
5. Any field used as an input to an aggregator from the [metricsSpec](#metricsspec) is excluded.
6. Any field with the same name as an aggregator from the [metricsSpec](#metricsspec) is excluded.
7. All other fields are ingested as `string` typed dimensions with the [default settings](#dimension-objects).

> Note: Fields generated by a [`transformSpec`](#transformspec) are not currently considered candidates for
> schemaless dimension interpretation.

### `metricsSpec`

The `metricsSpec` is located in `dataSchema` → `metricsSpec` and is a list of [aggregators](../querying/aggregations.md)
to apply at ingestion time. This is most useful when [rollup](#rollup) is enabled, since it's how you configure
ingestion-time aggregation.

An example `metricsSpec` is:

```
"metricsSpec": [
  { "type": "count", "name": "count" },
  { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
  { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
]
```

> Generally, when [rollup](#rollup) is disabled, you should have an empty `metricsSpec` (because without rollup,
> Druid does not do any ingestion-time aggregation, so there is little reason to include an ingestion-time aggregator). However,
> in some cases, it can still make sense to define metrics: for example, if you want to create a complex column as a way of
> pre-computing part of an [approximate aggregation](../querying/aggregations.md#approximate-aggregations), this can only
> be done by defining a metric in a `metricsSpec`.

### `granularitySpec`

The `granularitySpec` is located in `dataSchema` → `granularitySpec` and is responsible for configuring
the following operations:

1. Partitioning a datasource into [time chunks](../design/architecture.md#datasources-and-segments) (via `segmentGranularity`).
2. Truncating the timestamp, if desired (via `queryGranularity`).
3. Specifying which time chunks of segments should be created, for batch ingestion (via `intervals`).
4. Specifying whether ingestion-time [rollup](#rollup) should be used or not (via `rollup`).

Other than `rollup`, these operations are all based on the [primary timestamp](#primary-timestamp).

An example `granularitySpec` is:

```
"granularitySpec": {
  "segmentGranularity": "day",
  "queryGranularity": "none",
  "intervals": [
    "2013-08-31/2013-09-01"
  ],
  "rollup": true
}
```

A `granularitySpec` can have the following components:

| Field | Description | Default |
|-------|-------------|---------|
| type | Either `uniform` or `arbitrary`. In most cases you want to use `uniform`.| `uniform` |
| segmentGranularity | [Time chunking](../design/architecture.md#datasources-and-segments) granularity for this datasource. Multiple segments can be created per time chunk. For example, when set to `day`, the events of the same day fall into the same time chunk which can be optionally further partitioned into multiple segments based on other configurations and input size. Any [granularity](../querying/granularities.md) can be provided here. Note that all segments in the same time chunk should have the same segment granularity.<br><br>Ignored if `type` is set to `arbitrary`.| `day` |
| queryGranularity | The resolution of timestamp storage within each segment. This must be equal to, or finer, than `segmentGranularity`. This will be the finest granularity that you can query at and still receive sensible results, but note that you can still query at anything coarser than this granularity. E.g., a value of `minute` will mean that records will be stored at minutely granularity, and can be sensibly queried at any multiple of minutes (including minutely, 5-minutely, hourly, etc).<br><br>Any [granularity](../querying/granularities.md) can be provided here. Use `none` to store timestamps as-is, without any truncation. Note that `rollup` will be applied if it is set even when the `queryGranularity` is set to `none`. | `none` |
| rollup | Whether to use ingestion-time [rollup](#rollup) or not. Note that rollup is still effective even when `queryGranularity` is set to `none`. Your data will be rolled up if they have the exactly same timestamp. | `true` |
| intervals | A list of intervals describing what time chunks of segments should be created. If `type` is set to `uniform`, this list will be broken up and rounded-off based on the `segmentGranularity`. If `type` is set to `arbitrary`, this list will be used as-is.<br><br>If `null` or not provided, batch ingestion tasks will generally determine which time chunks to output based on what timestamps are found in the input data.<br><br>If specified, batch ingestion tasks may be able to skip a determining-partitions phase, which can result in faster ingestion. Batch ingestion tasks may also be able to request all their locks up-front instead of one by one. Batch ingestion tasks will throw away any records with timestamps outside of the specified intervals.<br><br>Ignored for any form of streaming ingestion. | `null` |

### `transformSpec`

The `transformSpec` is located in `dataSchema` → `transformSpec` and is responsible for transforming and filtering
records during ingestion time. It is optional. An example `transformSpec` is:

```
"transformSpec": {
  "transforms": [
    { "type": "expression", "name": "countryUpper", "expression": "upper(country)" }
  ],
  "filter": {
    "type": "selector",
    "dimension": "country",
    "value": "San Serriffe"
  }
}
```

> Conceptually, after input data records are read, Druid applies ingestion spec components in a particular order:
> first [`flattenSpec`](data-formats.md#flattenspec) (if any), then [`timestampSpec`](#timestampspec), then [`transformSpec`](#transformspec),
> and finally [`dimensionsSpec`](#dimensionsspec) and [`metricsSpec`](#metricsspec). Keep this in mind when writing
> your ingestion spec.

#### Transforms

The `transforms` list allows you to specify a set of expressions to evaluate on top of input data. Each transform has a
"name" which can be referred to by your `dimensionsSpec`, `metricsSpec`, etc.

If a transform has the same name as a field in an input row, then it will shadow the original field. Transforms that
shadow fields may still refer to the fields they shadow. This can be used to transform a field "in-place".

Transforms do have some limitations. They can only refer to fields present in the actual input rows; in particular,
they cannot refer to other transforms. And they cannot remove fields, only add them. However, they can shadow a field
with another field containing all nulls, which will act similarly to removing the field.

Transforms can refer to the [timestamp](#timestampspec) of an input row by referring to `__time` as part of the expression.
They can also _replace_ the timestamp if you set their "name" to `__time`. In both cases, `__time` should be treated as
a millisecond timestamp (number of milliseconds since Jan 1, 1970 at midnight UTC). Transforms are applied _after_ the
`timestampSpec`.

Druid currently includes one kind of built-in transform, the expression transform. It has the following syntax:

```
{
  "type": "expression",
  "name": "<output name>",
  "expression": "<expr>"
}
```

The `expression` is a [Druid query expression](../misc/math-expr.md).

> Conceptually, after input data records are read, Druid applies ingestion spec components in a particular order:
> first [`flattenSpec`](data-formats.md#flattenspec) (if any), then [`timestampSpec`](#timestampspec), then [`transformSpec`](#transformspec),
> and finally [`dimensionsSpec`](#dimensionsspec) and [`metricsSpec`](#metricsspec). Keep this in mind when writing
> your ingestion spec.

#### Filter

The `filter` conditionally filters input rows during ingestion. Only rows that pass the filter will be
ingested. Any of Druid's standard [query filters](../querying/filters.md) can be used. Note that within a
`transformSpec`, the `transforms` are applied before the `filter`, so the filter can refer to a transform.

### Legacy `dataSchema` spec

> The `dataSchema` spec has been changed in 0.17.0. The new spec is supported by all ingestion methods
except for _Hadoop_ ingestion. See [`dataSchema`](#dataschema) for the new spec.

The legacy `dataSchema` spec has below two more components in addition to the ones listed in the [`dataSchema`](#dataschema) section above.

- [input row parser](#parser-deprecated), [flattening of nested data](#flattenspec) (if needed)

#### `parser` (Deprecated)

In legacy `dataSchema`, the `parser` is located in the `dataSchema` → `parser` and is responsible for configuring a wide variety of
items related to parsing input records. The `parser` is deprecated and it is highly recommended to use `inputFormat` instead.
For details about `inputFormat` and supported `parser` types, see the ["Data formats" page](data-formats.md).

For details about major components of the `parseSpec`, refer to their subsections:

- [`timestampSpec`](#timestampspec), responsible for configuring the [primary timestamp](#primary-timestamp).
- [`dimensionsSpec`](#dimensionsspec), responsible for configuring [dimensions](#dimensions).
- [`flattenSpec`](#flattenspec), responsible for flattening nested data formats.

An example `parser` is:

```
"parser": {
  "type": "string",
  "parseSpec": {
    "format": "json",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        { "type": "path", "name": "userId", "expr": "$.user.id" }
      ]
    },
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [
        "page",
        "language",
        { "type": "long", "name": "userId" }
      ]
    }
  }
}
```

#### `flattenSpec`

In the legacy `dataSchema`, the `flattenSpec` is located in `dataSchema` → `parser` → `parseSpec` → `flattenSpec` and is responsible for
bridging the gap between potentially nested input data (such as JSON, Avro, etc) and Druid's flat data model.
See [Flatten spec](./data-formats.md#flattenspec) for more details.

## `ioConfig`

The `ioConfig` influences how data is read from a source system, such as Apache Kafka, Amazon S3, a mounted
filesystem, or any other supported source system. The `inputFormat` property applies to all
[ingestion method](#ingestion-methods) except for Hadoop ingestion. The Hadoop ingestion still
uses the [`parser`](#parser-deprecated) in the legacy `dataSchema`.
The rest of `ioConfig` is specific to each individual ingestion method.
An example `ioConfig` to read JSON data is:

```json
"ioConfig": {
    "type": "<ingestion-method-specific type code>",
    "inputFormat": {
      "type": "json"
    },
    ...
}
```
For more details, see the documentation provided by each [ingestion method](#ingestion-methods).

## `tuningConfig`

Tuning properties are specified in a `tuningConfig`, which goes at the top level of an ingestion spec. Some
properties apply to all [ingestion methods](#ingestion-methods), but most are specific to each individual
ingestion method. An example `tuningConfig` that sets all of the shared, common properties to their defaults
is:

```plaintext
"tuningConfig": {
  "type": "<ingestion-method-specific type code>",
  "maxRowsInMemory": 1000000,
  "maxBytesInMemory": <one-sixth of JVM memory>,
  "indexSpec": {
    "bitmap": { "type": "roaring" },
    "dimensionCompression": "lz4",
    "metricCompression": "lz4",
    "longEncoding": "longs"
  },
  <other ingestion-method-specific properties>
}
```

|Field|Description|Default|
|-----|-----------|-------|
|type|Each ingestion method has its own tuning type code. You must specify the type code that matches your ingestion method. Common options are `index`, `hadoop`, `kafka`, and `kinesis`.||
|maxRowsInMemory|The maximum number of records to store in memory before persisting to disk. Note that this is the number of rows post-rollup, and so it may not be equal to the number of input records. Ingested records will be persisted to disk when either `maxRowsInMemory` or `maxBytesInMemory` are reached (whichever happens first).|`1000000`|
|maxBytesInMemory|The maximum aggregate size of records, in bytes, to store in the JVM heap before persisting. This is based on a rough estimate of memory usage. Ingested records will be persisted to disk when either `maxRowsInMemory` or `maxBytesInMemory` are reached (whichever happens first). `maxBytesInMemory` also includes heap usage of artifacts created from intermediary persists. This means that after every persist, the amount of `maxBytesInMemory` until next persist will decreases, and task will fail when the sum of bytes of all intermediary persisted artifacts exceeds `maxBytesInMemory`.<br /><br />Setting maxBytesInMemory to -1 disables this check, meaning Druid will rely entirely on maxRowsInMemory to control memory usage. Setting it to zero means the default value will be used (one-sixth of JVM heap size).<br /><br />Note that the estimate of memory usage is designed to be an overestimate, and can be especially high when using complex ingest-time aggregators, including sketches. If this causes your indexing workloads to persist to disk too often, you can set maxBytesInMemory to -1 and rely on maxRowsInMemory instead.|One-sixth of max JVM heap size|
|skipBytesInMemoryOverheadCheck|The calculation of maxBytesInMemory takes into account overhead objects created during ingestion and each intermediate persist. Setting this to true can exclude the bytes of these overhead objects from maxBytesInMemory check.|false|
|indexSpec|Tune how data is indexed. See below for more information.|See table below|
|Other properties|Each ingestion method has its own list of additional tuning properties. See the documentation for each method for a full list: [Kafka indexing service](../development/extensions-core/kafka-ingestion.md#tuningconfig), [Kinesis indexing service](../development/extensions-core/kinesis-ingestion.md#tuningconfig), [Native batch](native-batch.md#tuningconfig), and [Hadoop-based](hadoop.md#tuningconfig).||

#### `indexSpec`

The `indexSpec` object can include the following properties:

|Field|Description|Default|
|-----|-----------|-------|
|bitmap|Compression format for bitmap indexes. Should be a JSON object with `type` set to `roaring` or `concise`. For type `roaring`, the boolean property `compressRunOnSerialization` (defaults to true) controls whether or not run-length encoding will be used when it is determined to be more space-efficient.|`{"type": "concise"}`|
|dimensionCompression|Compression format for dimension columns. Options are `lz4`, `lzf`, or `uncompressed`.|`lz4`|
|metricCompression|Compression format for primitive type metric columns. Options are `lz4`, `lzf`, `uncompressed`, or `none` (which is more efficient than `uncompressed`, but not supported by older versions of Druid).|`lz4`|
|longEncoding|Encoding format for long-typed columns. Applies regardless of whether they are dimensions or metrics. Options are `auto` or `longs`. `auto` encodes the values using offset or lookup table depending on column cardinality, and store them with variable size. `longs` stores the value as-is with 8 bytes each.|`longs`|

Beyond these properties, each ingestion method has its own specific tuning properties. See the documentation for each
[ingestion method](#ingestion-methods) for details.


## 数据摄入
### 综述

Druid中的所有数据都被组织成*段*，这些段是数据文件，通常每个段最多有几百万行。在Druid中加载数据称为*摄取或索引*，它包括从源系统读取数据并基于该数据创建段。

在大多数摄取方法中，加载数据的工作由Druid [MiddleManager](../design/MiddleManager.md) 进程（或 [Indexer](../design/Indexer.md) 进程）完成。一个例外是基于Hadoop的摄取，这项工作是使用Hadoop MapReduce作业在YARN上完成的（尽管MiddleManager或Indexer进程仍然参与启动和监视Hadoop作业）。一旦段被生成并存储在 [深层存储](../design/Deepstorage.md) 中，它们将被Historical进程加载。有关如何在引擎下工作的更多细节，请参阅Druid设计文档的[存储设计](../design/Design.md) 部分。

### 如何使用本文档

您**当前正在阅读的这个页面**提供了通用Druid摄取概念的信息，以及 [所有摄取方法](#摄入方式) **通用的配置**信息。

**每个摄取方法的单独页面**提供了有关每个摄取方法**独有的概念和配置**的附加信息。

我们建议您先阅读（或至少略读）这个通用页面，然后参考您选择的一种或多种摄取方法的页面。

### 摄入方式

下表列出了Druid最常用的数据摄取方法，帮助您根据自己的情况选择最佳方法。每个摄取方法都支持自己的一组源系统。有关每个方法如何工作的详细信息以及特定于该方法的配置属性，请查看其文档页。

#### 流式摄取
最推荐、也是最流行的流式摄取方法是直接从Kafka读取数据的 [Kafka索引服务](kafka.md) 。如果你喜欢Kinesis，[Kinesis索引服务](kinesis.md) 也能很好地工作。

下表比较了主要可用选项：

| **Method** | [**Kafka**](kafka.md) | [**Kinesis**](kinesis.md) | [**Tranquility**](tranquility.md) |
| - | - | - | - |
| **Supervisor类型** | `kafka` | `kinesis` | `N/A` |
| 如何工作 | Druid直接从 Apache Kafka读取数据 | Druid直接从Amazon Kinesis中读取数据 | Tranquility, 一个独立于Druid的库，用来将数据推送到Druid |
| 可以摄入迟到的数据 | Yes | Yes | No(迟到的数据将会被基于 `windowPeriod` 的配置丢弃掉) |
| 保证不重不丢（Exactly-once）| Yes | Yes | No

#### 批量摄取

从文件进行批加载时，应使用一次性 [任务](taskrefer.md)，并且有三个选项：`index_parallel`（本地并行批任务）、`index_hadoop`（基于hadoop）或`index`（本地简单批任务）。

一般来说，如果本地批处理能满足您的需要时我们建议使用它，因为设置更简单（它不依赖于外部Hadoop集群）。但是，仍有一些情况下，基于Hadoop的批摄取可能是更好的选择，例如，当您已经有一个正在运行的Hadoop集群，并且希望使用现有集群的集群资源进行批摄取时。

此表比较了三个可用选项：

| **方式** | [**本地批任务(并行)**](native.md#并行任务) | [**基于Hadoop**](hadoop.md) | [**本地批任务(简单)**](native.md#简单任务) |
| - | - | - | - |
| **任务类型** | `index_parallel` | `index_hadoop` | `index` |
| **并行?** | 如果 `inputFormat` 是可分割的且 `tuningConfig` 中的 `maxNumConcurrentSubTasks` > 1, 则 **Yes** | Yes | No，每个任务都是单线程的 |
| **支持追加或者覆盖** | 都支持 | 只支持覆盖 | 都支持 |
| **外部依赖** | 无 | Hadoop集群，用来提交Map-Reduce任务 | 无 |
| **输入位置** | 任何 [输入数据源](native.md#输入数据源) | 任何Hadoop文件系统或者Druid数据源 |  任何 [输入数据源](native.md#输入数据源) |
| **文件格式** | 任何 [输入格式](dataformats.md) | 任何Hadoop输入格式 | 任何 [输入格式](dataformats.md) |
| [**Rollup modes**](#Rollup) | 如果 `tuningConfig` 中的 `forceGuaranteedRollup` = true, 则为 **Perfect(最佳rollup)** | 总是Perfect（最佳rollup） | 如果 `tuningConfig` 中的 `forceGuaranteedRollup` = true, 则为 **Perfect(最佳rollup)** |
| **分区选项** | 可选的有`Dynamic`, `hash-based` 和 `range-based` 三种分区方式，详情参见 [分区规范](native.md#partitionsSpec) | 通过 [partitionsSpec](hadoop.md#partitionsSpec)中指定 `hash-based` 和 `range-based`分区 | 可选的有`Dynamic`和`hash-based`二种分区方式，详情参见 [分区规范](native.md#partitionsSpec) |

### Druid数据模型
#### 数据源
Druid数据存储在数据源中，与传统RDBMS中的表类似。Druid提供了一个独特的数据建模系统，它与关系模型和时间序列模型都具有相似性。
#### 主时间戳列
Druid Schema必须始终包含一个主时间戳。主时间戳用于对 [数据进行分区和排序](#分区)。Druid查询能够快速识别和检索与主时间戳列的时间范围相对应的数据。Druid还可以将主时间戳列用于基于时间的[数据管理操作](datamanage.md)，例如删除时间块、覆盖时间块和基于时间的保留规则。

主时间戳基于 [`timestampSpec`](#timestampSpec) 进行解析。此外，[`granularitySpec`](#granularitySpec) 控制基于主时间戳的其他重要操作。无论从哪个输入字段读取主时间戳，它都将作为名为 `__time` 的列存储在Druid数据源中。

如果有多个时间戳列，则可以将其他列存储为 [辅助时间戳](schemadesign.md#辅助时间戳)。

#### 维度
维度是按原样存储的列，可以用于任何目的, 可以在查询时以特殊方式对维度进行分组、筛选或应用聚合器。如果在禁用了 [rollup](#Rollup) 的情况下运行，那么该维度集将被简单地视为要摄取的一组列，并且其行为与不支持rollup功能的典型数据库的预期完全相同。

通过 [`dimensionSpec`](#dimensionSpec) 配置维度。

#### 指标
Metrics是以聚合形式存储的列。启用 [rollup](#Rollup) 时，它们最有用。指定一个Metric允许您为Druid选择一个聚合函数，以便在摄取期间应用于每一行。这有两个好处：

1. 如果启用了 [rollup](#Rollup)，即使保留摘要信息，也可以将多行折叠为一行。在 [Rollup教程](../tutorials/chapter-5.md) 中，这用于将netflow数据折叠为每（`minute`，`srcIP`，`dstIP`）元组一行，同时保留有关总数据包和字节计数的聚合信息。
2. 一些聚合器，特别是近似聚合器，即使在非汇总数据上，如果在接收时部分计算，也可以在查询时更快地计算它们。

Metrics是通过 [`metricsSpec`](#metricsSpec) 配置的。

### Rollup
#### 什么是rollup
Druid可以在接收过程中将数据进行汇总，以最小化需要存储的原始数据量。Rollup是一种汇总或预聚合的形式。实际上，Rollup可以极大地减少需要存储的数据的大小，从而潜在地减少行数的数量级。这种存储量的减少是有代价的：当我们汇总数据时，我们就失去了查询单个事件的能力。

禁用rollup时，Druid将按原样加载每一行，而不进行任何形式的预聚合。此模式类似于您对不支持汇总功能的典型数据库的期望。

如果启用了rollup，那么任何具有相同[维度](#维度)和[时间戳](#主时间戳列)的行（在基于 `queryGranularity` 的截断之后）都可以在Druid中折叠或汇总为一行。

rollup默认是启用状态。

#### 启用或者禁用rollup

Rollup由 `granularitySpec` 中的 `rollup` 配置项控制。 默认情况下，值为 `true`(启用状态)。如果你想让Druid按原样存储每条记录，而不需要任何汇总，将该值设置为 `false`。

#### rollup示例
有关如何配置Rollup以及该特性将如何修改数据的示例，请参阅[Rollup教程](../tutorials/chapter-5.md)。

#### 最大化rollup比率
通过比较Druid中的行数和接收的事件数，可以测量数据源的汇总率。这个数字越高，从汇总中获得的好处就越多。一种方法是使用[Druid SQL](../querying/druidsql.md)查询，比如：
```json
SELECT SUM("cnt") / COUNT(*) * 1.0 FROM datasource
```

在这个查询中，`cnt` 应该引用在摄取时指定的"count"类型Metrics。有关启用汇总时计数工作方式的详细信息，请参阅"架构设计"页上的 [计数接收事件数](/schemadesign.md#计数接收事件数)。

最大化Rollup的提示：
* 一般来说，拥有的维度越少，维度的基数越低，您将获得更好的汇总比率
* 使用 [Sketches](schemadesign.md#Sketches高基维处理) 避免存储高基数维度，因为会损害汇总比率
* 在摄入时调整 `queryGranularity`（例如，使用 `PT5M` 而不是 `PT1M` ）会增加Druid中两行具有匹配时间戳的可能性，并可以提高汇总率
* 将相同的数据加载到多个Druid数据源中是有益的。有些用户选择创建禁用汇总（或启用汇总，但汇总比率最小）的"完整"数据源和具有较少维度和较高汇总比率的"缩写"数据源。当查询只涉及"缩写"集里边的维度时，使用该数据源将导致更快的查询时间，这种方案只需稍微增加存储空间即可完成，因为简化的数据源往往要小得多。
* 如果您使用的 [尽力而为的汇总(best-effort rollup)](#) 摄取配置不能保证[完全汇总(perfect rollup)](#)，则可以通过切换到保证的完全汇总选项，或在初始摄取后在[后台重新编制(reindex)](./datamanage.md#压缩与重新索引)数据索引，潜在地提高汇总比率。

#### 最佳rollup VS 尽可能rollup
一些Druid摄取方法保证了*完美的汇总(perfect rollup)*，这意味着输入数据在摄取时被完美地聚合。另一些则提供了*尽力而为的汇总(best-effort rollup)*，这意味着输入数据可能无法完全聚合，因此可能有多个段保存具有相同时间戳和维度值的行。

一般来说，提供*尽力而为的汇总(best-effort rollup)*的摄取方法之所以这样做，是因为它们要么是在没有清洗步骤（这是*完美的汇总(perfect rollup)*所必需的）的情况下并行摄取，要么是因为它们在接收到某个时间段的所有数据（我们称之为*增量发布(incremental publishing)*）之前完成并发布段。在这两种情况下，理论上可以汇总的记录可能会以不同的段结束。所有类型的流接收都在此模式下运行。

保证*完美的汇总(perfect rollup)*的摄取方法通过额外的预处理步骤来确定实际数据摄取阶段之前的间隔和分区。此预处理步骤扫描整个输入数据集，这通常会增加摄取所需的时间，但提供完美汇总所需的信息。

下表显示了每个方法如何处理汇总：
| **方法** | **如何工作** |
| - | - |
| [本地批](native.md) | 基于配置，`index_parallel` 和 `index` 可以是完美的，也可以是最佳的。 |
| [Hadoop批](hadoop.md) | 总是 perfect |
| [Kafka索引服务](kafka.md) | 总是 best-effort |
| [Kinesis索引服务](kinesis.md) | 总是 best-effort |

### 分区
#### 为什么分区

数据源中段的最佳分区和排序会对占用空间和性能产生重大影响
。
Druid数据源总是按时间划分为*时间块*，每个时间块包含一个或多个段。此分区适用于所有摄取方法，并基于摄取规范的 `dataSchema` 中的 `segmentGranularity`参数。

特定时间块内的段也可以进一步分区，使用的选项根据您选择的摄取类型而不同。一般来说，使用特定维度执行此辅助分区将改善局部性，这意味着具有该维度相同值的行存储在一起，并且可以快速访问。

通常，通过将数据分区到一些常用来做过滤操作的维度（如果存在的话）上，可以获得最佳性能和最小的总体占用空间。而且，这种分区通常会改善压缩性能而且还往往会提高查询性能（用户报告存储容量减少了三倍）。

> [!WARNING]
> 分区和排序是最好的朋友！如果您确实有一个天然的分区维度，那么您还应该考虑将它放在 `dimensionsSpec` 的 `dimension` 列表中的第一个维度，它告诉Druid按照该列对每个段中的行进行排序。除了单独分区所获得的改进之外，这通常还会进一步改进压缩。
> 但是，请注意，目前，Druid总是首先按时间戳对一个段内的行进行排序，甚至在 `dimensionsSpec` 中列出的第一个维度之前，这将使得维度排序达不到最大效率。如果需要，可以通过在 `granularitySpec` 中将 `queryGranularity` 设置为等于 `segmentGranularity` 的值来解决此限制，这将把段内的所有时间戳设置为相同的值，并将"真实"时间戳保存为[辅助时间戳](./schemadesign.md#辅助时间戳)。这个限制可能在Druid的未来版本中被移除。

#### 如何设置分区
并不是所有的摄入方式都支持显式的分区配置，也不是所有的方法都具有同样的灵活性。在当前的Druid版本中，如果您是通过一个不太灵活的方法（如Kafka）进行初始摄取，那么您可以使用 [重新索引的技术(reindex)](./datamanage.md#压缩与重新索引)，在最初摄取数据后对其重新分区。这是一种强大的技术：即使您不断地从流中添加新数据, 也可以使用它来确保任何早于某个阈值的数据都得到最佳分区。

下表显示了每个摄取方法如何处理分区：

| **方法** | **如何工作** |
| - | - |
| [本地批](native.md) | 通过 `tuningConfig` 中的 [`partitionsSpec`](./native.md#partitionsSpec) |
| [Hadoop批](hadoop.md) | 通过 `tuningConfig` 中的 [`partitionsSpec`](./native.md#partitionsSpec)  |
| [Kafka索引服务](kafka.md) | Druid中的分区是由Kafka主题的分区方式决定的。您可以在初次摄入后 [重新索引的技术(reindex)](./datamanage.md#压缩与重新索引)以重新分区 |
| [Kinesis索引服务](kinesis.md) | Druid中的分区是由Kinesis流的分区方式决定的。您可以在初次摄入后 [重新索引的技术(reindex)](./datamanage.md#压缩与重新索引)以重新分区 |

> [!WARNING]
>
> 注意，当然，划分数据的一种方法是将其加载到分开的数据源中。这是一种完全可行的方法，当数据源的数量不会导致每个数据源的开销过大时，它可以很好地工作。如果使用这种方法，那么可以忽略这一部分，因为这部分描述了如何在单个数据源中设置分区。
>
> 有关将数据拆分为单独数据源的详细信息以及潜在的操作注意事项，请参阅 [多租户注意事项](../querying/multitenancy.md)。

### 摄入规范

无论使用哪一种摄入方式，数据要么是通过一次性[tasks](taskrefer.md)或者通过持续性的"supervisor"(运行并监控一段时间内的一系列任务)来被加载到Druid中。 在任一种情况下，task或者supervisor的定义都在*摄入规范*中定义。

摄入规范包括以下三个主要的部分：
* [`dataSchema`](#dataschema), 包含了 [`数据源名称`](#datasource), [`主时间戳列`](#timestampspec), [`维度`](#dimensionspec), [`指标`](#metricsspec) 和 [`转换与过滤`](#transformspec)
* [`ioConfig`](#ioconfig), 该部分告诉Druid如何去连接数据源系统以及如何去解析数据。 更多详细信息，可以看[摄入方法](#摄入方式)的文档。
* [`tuningConfig`](#tuningconfig), 该部分控制着每一种[摄入方法](#摄入方式)的不同的特定调整参数

一个 `index_parallel` 类型任务的示例摄入规范如下：
```json
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia",
      "timestampSpec": {
        "column": "timestamp",
        "format": "auto"
      },
      "dimensionsSpec": {
        "dimensions": [
          { "type": "string", "page" },
          { "type": "string", "language" },
          { "type": "long", "name": "userId" }
        ]
      },
      "metricsSpec": [
        { "type": "count", "name": "count" },
        { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
        { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
      ],
      "granularitySpec": {
        "segmentGranularity": "day",
        "queryGranularity": "none",
        "intervals": [
          "2013-08-31/2013-09-01"
        ]
      }
    },
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "local",
        "baseDir": "examples/indexing/",
        "filter": "wikipedia_data.json"
      },
      "inputFormat": {
        "type": "json",
        "flattenSpec": {
          "useFieldDiscovery": true,
          "fields": [
            { "type": "path", "name": "userId", "expr": "$.user.id" }
          ]
        }
      }
    },
    "tuningConfig": {
      "type": "index_parallel"
    }
  }
}
```

该部分中支持的特定选项依赖于选择的[摄入方法](#摄入方式)。 更多的示例，可以参考每一种[摄入方法](#摄入方式)的文档。

您还可以不用编写一个摄入规范，可视化的加载数据，该功能位于 [Druid控制台](../operations/manageui.md) 的 "Load Data" 视图中。 Druid可视化数据加载器目前支持 [Kafka](kafka.md), [Kinesis](kinesis.md) 和 [本地批](native.md) 模式。

#### `dataSchema`
> [!WARNING]
>
> `dataSchema` 规范在0.17.0版本中做了更改，新的规范支持除*Hadoop摄取方式*外的所有方式。 可以在 [过时的 `dataSchema` 规范]()查看老的规范

`dataSchema` 包含了以下部分：
* [`数据源名称`](#datasource), [`主时间戳列`](#timestampspec), [`维度`](#dimensionspec), [`指标`](#metricsspec) 和 [`转换与过滤`](#transformspec)

一个 `dataSchema` 如下：
```json
"dataSchema": {
  "dataSource": "wikipedia",
  "timestampSpec": {
    "column": "timestamp",
    "format": "auto"
  },
  "dimensionsSpec": {
    "dimensions": [
      { "type": "string", "page" },
      { "type": "string", "language" },
      { "type": "long", "name": "userId" }
    ]
  },
  "metricsSpec": [
    { "type": "count", "name": "count" },
    { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
    { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
  ],
  "granularitySpec": {
    "segmentGranularity": "day",
    "queryGranularity": "none",
    "intervals": [
      "2013-08-31/2013-09-01"
    ]
  }
}
```

##### `dataSource`
`dataSource` 位于 `dataSchema` -> `dataSource` 中，简单的标识了数据将被写入的数据源的名称，示例如下：
```json
"dataSource": "my-first-datasource"
```
##### `timestampSpec`
`timestampSpec` 位于 `dataSchema` -> `timestampSpec` 中，用来配置 [主时间戳](#timestampspec), 示例如下：
```json
"timestampSpec": {
  "column": "timestamp",
  "format": "auto"
}
```
> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

`timestampSpec` 可以包含以下的部分：

<table>
    <thead>
        <th>字段</th>
        <th>描述</th>
        <th>默认值</th>
    </thead>
    <tbody>
        <tr>
            <td>column</td>
            <td>要从中读取主时间戳的输入行字段。<br><br>不管这个输入字段的名称是什么，主时间戳总是作为一个名为"__time"的列存储在您的Druid数据源中</td>
            <td>timestamp</td>
        </tr>
        <tr>
            <td>format</td>
            <td>
                时间戳格式，可选项有：
                <ul>
                    <li><code>iso</code>: 使用"T"分割的ISO8601，像"2000-01-01T01:02:03.456"</li>
                    <li><code>posix</code>: 自纪元以来的秒数</li>
                    <li><code>millis</code>: 自纪元以来的毫秒数</li>
                    <li><code>micro</code>: 自纪元以来的微秒数</li>
                    <li><code>nano</code>: 自纪元以来的纳秒数</li>
                    <li><code>auto</code>: 自动检测ISO或者毫秒格式</li>
                    <li>任何 <a href="http://joda-time.sourceforge.net/apidocs/org/joda/time/format/DateTimeFormat.html">Joda DateTimeFormat字符串</a></li>
                </ul>
            </td>
            <td>auto</td>
        </tr>
        <tr>
            <td>missingValue</td>
            <td>用于具有空或缺少时间戳列的输入记录的时间戳。应该是ISO8601格式，如<code>"2000-01-01T01:02:03.456"</code>。由于Druid需要一个主时间戳，因此此设置对于接收根本没有任何时间戳的数据集非常有用。</td>
            <td>none</td>
        </tr>
    </tbody>
</table>

##### `dimensionSpec`
`dimensionsSpec` 位于 `dataSchema` -> `dimensionsSpec`, 用来配置维度。示例如下：
```json
"dimensionsSpec" : {
  "dimensions": [
    "page",
    "language",
    { "type": "long", "name": "userId" }
  ],
  "dimensionExclusions" : [],
  "spatialDimensions" : []
}
```

> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

`dimensionsSpec` 可以包括以下部分：

| 字段 | 描述 | 默认值 |
|-|-|-|
| dimensions | 维度名称或者对象的列表，在 `dimensions` 和 `dimensionExclusions` 中不能包含相同的列。 <br><br> 如果该配置为一个空数组，Druid将会把所有未出现在 `dimensionExclusions` 中的非时间、非指标列当做字符串类型的维度列，参见[Inclusions and exclusions](#Inclusions-and-exclusions)。 | `[]` |
| dimensionExclusions | 在摄取中需要排除的列名称，在该配置中只支持名称，不支持对象。在 `dimensions` 和 `dimensionExclusions` 中不能包含相同的列。 | `[]` |
| spatialDimensions | 一个[空间维度](../querying/spatialfilter.md)的数组 | `[]` |

###### `Dimension objects`
在 `dimensions` 列的每一个维度可以是一个名称，也可以是一个对象。 提供一个名称等价于提供了一个给定名称的 `string` 类型的维度对象。例如： `page` 等价于 `{"name": "page", "type": "string"}`。

维度对象可以有以下的部分：

| 字段 | 描述 | 默认值 |
|-|-|-|
| type | `string`, `long`, `float` 或者 `double` | `string` |
| name | 维度名称，将用作从输入记录中读取的字段名，以及存储在生成的段中的列名。<br><br> 注意： 如果想在摄取的时候重新命名列，可以使用 [`transformSpec`](#transformspec) | none（必填）|
| createBitmapIndex | 对于字符串类型的维度，是否应为生成的段中的列创建位图索引。创建位图索引需要更多存储空间，但会加快某些类型的筛选（特别是相等和前缀筛选）。仅支持字符串类型的维度。| `true` |

###### `Inclusions and exclusions`
Druid以两种可能的方式来解释 `dimensionsSpec` : *normal* 和 *schemaless*

当 `dimensions` 或者 `spatialDimensions` 为非空时， 将会采用正常的解释方式。 在该情况下， 前边说的两个列表结合起来的集合当做摄入的维度集合。

当 `dimensions` 和 `spatialDimensions` 同时为空或者null时候，将会采用无模式的解释方式。 在该情况下，维度集合由以下方式决定：
1. 首先，从 [`inputFormat`](./dataformats.md) (或者 [`flattenSpec`](./dataformats.md#FlattenSpec), 如果正在使用 )中所有输入字段集合开始
2. 排除掉任何在 `dimensionExclusions` 中的列
3. 排除掉在 [`timestampSpec`](#timestampspec) 中的时间列
4. 排除掉 [`metricsSpec`](#metricsspec) 中用于聚合器输入的列
5. 排除掉 [`metricsSpec`](#metricsspec) 中任何与聚合器同名的列
6. 所有的其他字段都被按照[默认配置](#dimensionspec)摄入为 `string` 类型的维度

> [!WARNING]
> 注意：在无模式的维度解释方式中，由 [`transformSpec`](#transformspec) 生成的列当前并未考虑。

##### `metricsSpec`

`metricsSpec` 位于 `dataSchema` -> `metricsSpec` 中，是一个在摄入阶段要应用的 [聚合器](../querying/Aggregations.md) 列表。 在启用了 [rollup](#rollup) 时是很有用的，因为它将配置如何在摄入阶段进行聚合。

一个 `metricsSpec` 实例如下：
```json
"metricsSpec": [
  { "type": "count", "name": "count" },
  { "type": "doubleSum", "name": "bytes_added_sum", "fieldName": "bytes_added" },
  { "type": "doubleSum", "name": "bytes_deleted_sum", "fieldName": "bytes_deleted" }
]
```
> [!WARNING]
> 通常，当 [rollup](#rollup) 被禁用时，应该有一个空的 `metricsSpec`（因为没有rollup，Druid不会在摄取时进行任何的聚合，所以没有理由包含摄取时聚合器）。但是，在某些情况下，定义Metrics仍然是有意义的：例如，如果要创建一个复杂的列作为 [近似聚合](../querying/Aggregations.md#近似聚合) 的预计算部分，则只能通过在 `metricsSpec` 中定义度量来实现

##### `granularitySpec`

`granularitySpec` 位于 `dataSchema` -> `granularitySpec`, 用来配置以下操作：
1. 通过 `segmentGranularity` 来将数据源分区到 [时间块](../design/Design.md#数据源和段)
2. 如果需要的话，通过 `queryGranularity` 来截断时间戳
3. 通过 `interval` 来指定批摄取中应创建段的时间块
4. 通过 `rollup` 来指定是否在摄取时进行汇总

除了 `rollup`, 这些操作都是基于 [主时间戳列](#主时间戳列)

一个 `granularitySpec` 实例如下：
```json
"granularitySpec": {
  "segmentGranularity": "day",
  "queryGranularity": "none",
  "intervals": [
    "2013-08-31/2013-09-01"
  ],
  "rollup": true
}
```

`granularitySpec` 可以有以下的部分：

| 字段 | 描述 | 默认值 |
|-|-|-|
| type | `uniform` 或者 `arbitrary` ，大多数时候使用 `uniform` | `uniform` |
| segmentGranularity | 数据源的 [时间分块](../design/Design.md#数据源和段) 粒度。每个时间块可以创建多个段, 例如，当设置为 `day` 时，同一天的事件属于同一时间块，该时间块可以根据其他配置和输入大小进一步划分为多个段。这里可以提供任何粒度。请注意，同一时间块中的所有段应具有相同的段粒度。 <br><br> 如果 `type` 字段设置为 `arbitrary` 则忽略 | `day` |
| queryGranularity | 每个段内时间戳存储的分辨率, 必须等于或比 `segmentGranularity` 更细。这将是您可以查询的最细粒度，并且仍然可以查询到合理的结果。但是请注意，您仍然可以在比此粒度更粗的场景进行查询，例如 "`minute`"的值意味着记录将以分钟的粒度存储，并且可以在分钟的任意倍数（包括分钟、5分钟、小时等）进行查询。<br><br> 这里可以提供任何 [粒度](../querying/AggregationGranularity.md) 。使用 `none` 按原样存储时间戳，而不进行任何截断。请注意，即使将 `queryGranularity` 设置为 `none`，也将应用 `rollup`。 | `none` |
| rollup | 是否在摄取时使用 [rollup](#rollup)。 注意：即使 `queryGranularity` 设置为 `none`，rollup也仍然是有效的，当数据具有相同的时间戳时数据将被汇总 | `true` |
| interval | 描述应该创建段的时间块的间隔列表。如果 `type` 设置为`uniform`，则此列表将根据 `segmentGranularity` 进行拆分和舍入。如果 `type` 设置为 `arbitrary` ，则将按原样使用此列表。<br><br> 如果该值不提供或者为空值，则批处理摄取任务通常会根据在输入数据中找到的时间戳来确定要输出的时间块。<br><br> 如果指定，批处理摄取任务可以跳过确定分区阶段，这可能会导致更快的摄取。批量摄取任务也可以预先请求它们的所有锁，而不是逐个请求。批处理摄取任务将丢弃任何时间戳超出指定间隔的记录。<br><br> 在任何形式的流摄取中忽略该配置。 | `null` |

##### `transformSpec`
`transformSpec` 位于 `dataSchema` -> `transformSpec`，用来摄取时转换和过滤输入数据。 一个 `transformSpec` 实例如下：
```json
"transformSpec": {
  "transforms": [
    { "type": "expression", "name": "countryUpper", "expression": "upper(country)" }
  ],
  "filter": {
    "type": "selector",
    "dimension": "country",
    "value": "San Serriffe"
  }
}
```

> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

##### 过时的 `dataSchema` 规范
> [!WARNING]
>
> `dataSchema` 规范在0.17.0版本中做了更改，新的规范支持除*Hadoop摄取方式*外的所有方式。 可以在 [`dataSchema`](#dataschema)查看老的规范

除了上面 `dataSchema` 一节中列出的组件之外，过时的 `dataSchema` 规范还有以下两个组件。
* [input row parser](), [flatten of nested data]()

**parser**(已废弃)
在过时的 `dataSchema` 中，`parser` 位于 `dataSchema` -> `parser`中，负责配置与解析输入记录相关的各种项。由于 `parser` 已经废弃，不推荐使用，强烈建议改用 `inputFormat`。 对于 `inputFormat` 和支持的 `parser` 类型，可以参见 [数据格式](dataformats.md)。

`parseSpec`主要部分的详细，参见他们的子部分：
* [`timestampSpec`](#timestampspec), 配置 [主时间戳列](#主时间戳列)
* [`dimensionsSpec`](#dimensionspec), 配置 [维度](#维度)
* [`flattenSpec`](./dataformats.md#FlattenSpec)

一个 `parser` 实例如下：

```json
"parser": {
  "type": "string",
  "parseSpec": {
    "format": "json",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        { "type": "path", "name": "userId", "expr": "$.user.id" }
      ]
    },
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [
        { "type": "string", "page" },
        { "type": "string", "language" },
        { "type": "long", "name": "userId" }
      ]
    }
  }
}
```
**flattenSpec**
在过时的 `dataSchema` 中，`flattenSpec` 位于`dataSchema` -> `parser` -> `parseSpec` -> `flattenSpec`中，负责在潜在的嵌套输入数据（如JSON、Avro等）和Druid的数据模型之间架起桥梁。有关详细信息，请参见 [flattenSpec](./dataformats.md#FlattenSpec) 。

#### `ioConfig`

`ioConfig` 影响从源系统（如Apache Kafka、Amazon S3、挂载的文件系统或任何其他受支持的源系统）读取数据的方式。`inputFormat` 属性适用于除Hadoop摄取之外的[所有摄取方法](#摄入方式)。Hadoop摄取仍然使用过时的 `dataSchema` 中的 [parser]。`ioConfig` 的其余部分特定于每个单独的摄取方法。读取JSON数据的 `ioConfig` 示例如下：
```json
"ioConfig": {
    "type": "<ingestion-method-specific type code>",
    "inputFormat": {
      "type": "json"
    },
    ...
}
```
详情可以参见每个 [摄取方式](#摄入方式) 提供的文档。

#### `tuningConfig`

优化属性在 `tuningConfig` 中指定，`tuningConfig` 位于摄取规范的顶层。有些属性适用于所有摄取方法，但大多数属性特定于每个单独的摄取方法。`tuningConfig` 将所有共享的公共属性设置为默认值的示例如下：
```json
"tuningConfig": {
  "type": "<ingestion-method-specific type code>",
  "maxRowsInMemory": 1000000,
  "maxBytesInMemory": <one-sixth of JVM memory>,
  "indexSpec": {
    "bitmap": { "type": "concise" },
    "dimensionCompression": "lz4",
    "metricCompression": "lz4",
    "longEncoding": "longs"
  },
  <other ingestion-method-specific properties>
}
```

| 字段 | 描述 | 默认值 |
|-|-|-|
| type | 每一种摄入方式都有自己的类型，必须指定为与摄入方式匹配的类型。通常的选项有 `index`, `hadoop`, `kafka` 和 `kinesis` | |
| maxRowsInMemory | 数据持久化到硬盘前在内存中存储的最大数据条数。 注意，这个数字是汇总后的，所以可能并不等于输入的记录数。 当摄入的数据达到 `maxRowsInMemory` 或者 `maxBytesInMemory` 时数据将被持久化到硬盘。 | `1000000` |
| maxBytesInMemory | 在持久化之前要存储在JVM堆中的数据最大字节数。这是基于对内存使用的粗略估计。当达到 `maxRowsInMemory` 或`maxBytesInMemory` 时（以先发生的为准），摄取的记录将被持久化到磁盘。<br><br>将 `maxBytesInMemory` 设置为-1将禁用此检查，这意味着Druid将完全依赖 `maxRowsInMemory` 来控制内存使用。将其设置为零意味着将使用默认值（JVM堆大小的六分之一）。<br><br> 请注意，内存使用量的估计值被设计为高估值，并且在使用复杂的摄取时聚合器（包括sketches）时可能特别高。如果这导致索引工作负载过于频繁地持久化到磁盘，则可以将 `maxBytesInMemory` 设置为-1并转而依赖 `maxRowsInMemory`。 | JVM堆内存最大值的1/6 |
| indexSpec | 优化数据如何被索引，详情可以看下面的表格 | 看下面的表格 |
| 其他属性 | 每一种摄入方式都有其自己的优化属性。 详情可以查看每一种方法的文档。 [Kafka索引服务](kafka.md), [Kinesis索引服务](kinesis.md), [本地批](native.md) 和 [Hadoop批](hadoop.md) | |

**`indexSpec`**

上边表格中的 `indexSpec` 部分可以包含以下属性：

| 字段 | 描述 | 默认值 |
|-|-|-|
| bitmap | 位图索引的压缩格式。 需要一个 `type` 设置为 `concise` 或者 `roaring` 的JSON对象。对于 `roaring`类型，布尔属性`compressRunOnSerialization`（默认为true）控制在确定运行长度编码更节省空间时是否使用该编码。 | `{"type":"concise"}` |
| dimensionCompression | 维度列的压缩格式。 可选项有 `lz4`, `lzf` 或者 `uncompressed` | `lz4` |
| metricCompression | Metrics列的压缩格式。可选项有 `lz4`, `lzf`, `uncompressed` 或者 `none`(`none` 比 `uncompressed` 更有效，但是在老版本的Druid不支持) | `lz4` |
| longEncoding | long类型列的编码格式。无论它们是维度还是Metrics，都适用，选项是 `auto` 或 `long`。`auto` 根据列基数使用偏移量或查找表对值进行编码，并以可变大小存储它们。`longs` 按原样存储值，每个值8字节。 | `longs` |

除了这些属性之外，每个摄取方法都有自己的特定调整属性。有关详细信息，请参阅每个 [摄取方法](#摄入方式) 的文档。