---
id: native-batch
title: "Native batch ingestion"
sidebar_label: "Native batch"
---

<!--
  ~ Licensed to the Apache Software Foundation (ASF) under one
  ~ or more contributor license agreements.  See the NOTICE file
  ~ distributed with this work for additional information
  ~ regarding copyright ownership.  The ASF licenses this file
  ~ to you under the Apache License, Version 2.0 (the
  ~ "License"); you may not use this file except in compliance
  ~ with the License.  You may obtain a copy of the License at
  ~
  ~   http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~ Unless required by applicable law or agreed to in writing,
  ~ software distributed under the License is distributed on an
  ~ "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  ~ KIND, either express or implied.  See the License for the
  ~ specific language governing permissions and limitations
  ~ under the License.
  -->


Apache Druid currently has two types of native batch indexing tasks, `index_parallel` which can run
multiple tasks in parallel, and `index` which will run a single indexing task. Please refer to our
[Hadoop-based vs. native batch comparison table](index.md#batch) for comparisons between Hadoop-based, native batch
(simple), and native batch (parallel) ingestion.

To run either kind of native batch indexing task, write an ingestion spec as specified below. Then POST it to the
[`/druid/indexer/v1/task`](../operations/api-reference.md#tasks) endpoint on the Overlord, or use the
`bin/post-index-task` script included with Druid.

## Tutorial

This page contains reference documentation for native batch ingestion.
For a walk-through instead, check out the [Loading a file](../tutorials/tutorial-batch.md) tutorial, which
demonstrates the "simple" (single-task) mode.

## Parallel task

The Parallel task (type `index_parallel`) is a task for parallel batch indexing. This task only uses Druid's resource and
doesn't depend on other external systems like Hadoop. The `index_parallel` task is a supervisor task that orchestrates
the whole indexing process. The supervisor task splits the input data and creates worker tasks to process those splits.
The created worker tasks are issued to the Overlord so that they can be scheduled and run on MiddleManagers or Indexers.
Once a worker task successfully processes the assigned input split, it reports the generated segment list to the supervisor task.
The supervisor task periodically checks the status of worker tasks. If one of them fails, it retries the failed task
until the number of retries reaches the configured limit. If all worker tasks succeed, it publishes the reported segments at once and finalizes ingestion.

The detailed behavior of the Parallel task is different depending on the [`partitionsSpec`](#partitionsspec).
See each `partitionsSpec` for more details.

To use this task, the [`inputSource`](#input-sources) in the `ioConfig` should be _splittable_ and `maxNumConcurrentSubTasks` should be set to larger than 1 in the `tuningConfig`.
Otherwise, this task runs sequentially; the `index_parallel` task reads each input file one by one and creates segments by itself.
The supported splittable input formats for now are:

- [`s3`](#s3-input-source) reads data from AWS S3 storage.
- [`gs`](#google-cloud-storage-input-source) reads data from Google Cloud Storage.
- [`azure`](#azure-input-source) reads data from Azure Blob Storage.
- [`hdfs`](#hdfs-input-source) reads data from HDFS storage.
- [`http`](#http-input-source) reads data from HTTP servers.
- [`local`](#local-input-source) reads data from local storage.
- [`druid`](#druid-input-source) reads data from a Druid datasource.
- [`sql`](#sql-input-source) reads data from a RDBMS source.

Some other cloud storage types are supported with the legacy [`firehose`](#firehoses-deprecated).
The below `firehose` types are also splittable. Note that only text formats are supported
with the `firehose`.

### Compression formats supported
The supported compression formats for native batch ingestion are `bz2`, `gz`, `xz`, `zip`, `sz` (Snappy), and `zst` (ZSTD).

- [`static-cloudfiles`](../development/extensions-contrib/cloudfiles.md#firehose)

### Implementation considerations

- You may want to control the amount of input data each worker task processes. This can be
  controlled using different configurations depending on the phase in parallel ingestion (see [`partitionsSpec`](#partitionsspec) for more details).
  For the tasks that read data from the `inputSource`, you can set the [Split hint spec](#split-hint-spec) in the `tuningConfig`.
  For the tasks that merge shuffled segments, you can set the `totalNumMergeTasks` in the `tuningConfig`.
- The number of concurrent worker tasks in parallel ingestion is determined by `maxNumConcurrentSubTasks` in the `tuningConfig`.
  The supervisor task checks the number of current running worker tasks and creates more if it's smaller than `maxNumConcurrentSubTasks`
  no matter how many task slots are currently available.
  This may affect to other ingestion performance. See the below [Capacity Planning](#capacity-planning) section for more details.
- By default, batch ingestion replaces all data (in your `granularitySpec`'s intervals) in any segment that it writes to.
  If you'd like to add to the segment instead, set the `appendToExisting` flag in the `ioConfig`. Note that it only replaces
  data in segments where it actively adds data: if there are segments in your `granularitySpec`'s intervals that have
  no data written by this task, they will be left alone. If any existing segments partially overlap with the
  `granularitySpec`'s intervals, the portion of those segments outside the new segments' intervals will still be visible.
- You can set `dropExisting` flag in the `ioConfig` to true if you want the ingestion task to drop all existing segments that 
  start and end within your `granularitySpec`'s intervals. This applies whether or not the new data covers all existing segments. 
  `dropExisting` only applies when `appendToExisting` is false and the  `granularitySpec` contains an `interval`. WARNING: this 
  functionality is still in beta and can result in temporary data unavailability for data within the specified `interval`
  
  The following examples demonstrate when to set the `dropExisting` property to true in the `ioConfig`:
  
  - Example 1: Consider an existing segment with an interval of 2020-01-01 to 2021-01-01 and YEAR segmentGranularity. You want to
  overwrite the whole interval of 2020-01-01 to 2021-01-01 with new data using the finer segmentGranularity of MONTH. 
  If the replacement data does not have a record within every months from 2020-01-01 to 2021-01-01
  Druid cannot drop the original YEAR segment even if it does include all the replacement. Set `dropExisting` to true in this case to drop 
  the original segment at year `segmentGranularity` since you no longer need it.
  - Example 2: Consider the case where you want to re-ingest or overwrite a datasource and the new data does not contains some time intervals that exist
  in the datasource. For example, a datasource contains the following data at MONTH segmentGranularity:  
    January: 1 record  
    February: 10 records  
    March: 10 records  
  You want to re-ingest and overwrite with new data as follows:  
    January: 0 records  
    February: 10 records  
    March: 9 records  
  Unless you set `dropExisting` to true, the result after ingestion with overwrite using the same MONTH segmentGranularity would be:  
    January: 1 record  
    February: 10 records  
    March: 9 records  
  This is incorrect since the new data has 0 records for January. Setting `dropExisting` to true to drop the original 
  segment for January that is not needed since the newly ingested data has no records for January.
   
### Task syntax

A sample task is shown below:

```json
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia_parallel_index_test",
      "timestampSpec": {
        "column": "timestamp"
      },
      "dimensionsSpec": {
        "dimensions": [
          "page",
          "language",
          "user",
          "unpatrolled",
          "newPage",
          "robot",
          "anonymous",
          "namespace",
          "continent",
          "country",
          "region",
          "city"
        ]
      },
      "metricsSpec": [
        {
          "type": "count",
              "name": "count"
            },
            {
              "type": "doubleSum",
              "name": "added",
              "fieldName": "added"
            },
            {
              "type": "doubleSum",
              "name": "deleted",
              "fieldName": "deleted"
            },
            {
              "type": "doubleSum",
              "name": "delta",
              "fieldName": "delta"
            }
        ],
        "granularitySpec": {
          "segmentGranularity": "DAY",
          "queryGranularity": "second",
          "intervals" : [ "2013-08-31/2013-09-02" ]
        }
    },
    "ioConfig": {
        "type": "index_parallel",
        "inputSource": {
          "type": "local",
          "baseDir": "examples/indexing/",
          "filter": "wikipedia_index_data*"
        },
        "inputFormat": {
          "type": "json"
        }
    },
    "tuningConfig": {
        "type": "index_parallel",
        "maxNumConcurrentSubTasks": 2
    }
  }
}
```

|property|description|required?|
|--------|-----------|---------|
|type|The task type, this should always be `index_parallel`.|yes|
|id|The task ID. If this is not explicitly specified, Druid generates the task ID using task type, data source name, interval, and date-time stamp. |no|
|spec|The ingestion spec including the data schema, IOConfig, and TuningConfig. See below for more details. |yes|
|context|Context containing various task configuration parameters. See below for more details.|no|
|awaitSegmentAvailabilityTimeoutMillis|Long|Milliseconds to wait for the newly indexed segments to become available for query after ingestion completes. If `<= 0`, no wait will occur. If `> 0`, the task will wait for the Coordinator to indicate that the new segments are available for querying. If the timeout expires, the task will exit as successful, but the segments were not confirmed to have become available for query. Note for compaction tasks: you should not set this to a non-zero value because it is not supported by the compaction task type at this time.|no (default = 0)|

### `dataSchema`

This field is required.

See [Ingestion Spec DataSchema](../ingestion/index.md#dataschema)

If you specify `intervals` explicitly in your dataSchema's `granularitySpec`, batch ingestion will lock the full intervals
specified when it starts up, and you will learn quickly if the specified interval overlaps with locks held by other
tasks (e.g., Kafka ingestion). Otherwise, batch ingestion will lock each interval as it is discovered, so you may only
learn that the task overlaps with a higher-priority task later in ingestion.  If you specify `intervals` explicitly, any
rows outside the specified intervals will be thrown away. We recommend setting `intervals` explicitly if you know the
time range of the data so that locking failure happens faster, and so that you don't accidentally replace data outside
that range if there's some stray data with unexpected timestamps.

### `ioConfig`

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|The task type, this should always be `index_parallel`.|none|yes|
|inputFormat|[`inputFormat`](./data-formats.md#input-format) to specify how to parse input data.|none|yes|
|appendToExisting|Creates segments as additional shards of the latest version, effectively appending to the segment set instead of replacing it. This means that you can append new segments to any datasource regardless of its original partitioning scheme. You must use the `dynamic` partitioning type for the appended segments. If you specify a different partitioning type, the task fails with an error.|false|no|
|dropExisting|If `true` and `appendToExisting` is `false` and the `granularitySpec` contains an`interval`, then the ingestion task drops (mark unused) all existing segments fully contained by the specified `interval` when the task publishes new segments. If ingestion fails, Druid does not drop or mark unused any segments. In the case of misconfiguration where either `appendToExisting` is `true` or `interval` is not specified in `granularitySpec`, Druid does not drop any segments even if `dropExisting` is `true`. WARNING: this functionality is still in beta and can result in temporary data unavailability for data within the specified `interval`.|false|no|

### `tuningConfig`

The tuningConfig is optional and default parameters will be used if no tuningConfig is specified. See below for more details.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|The task type, this should always be `index_parallel`.|none|yes|
|maxRowsPerSegment|Deprecated. Use `partitionsSpec` instead. Used in sharding. Determines how many rows are in each segment.|5000000|no|
|maxRowsInMemory|Used in determining when intermediate persists to disk should occur. Normally user does not need to set this, but depending on the nature of data, if rows are short in terms of bytes, user may not want to store a million rows in memory and this value should be set.|1000000|no|
|maxBytesInMemory|Used in determining when intermediate persists to disk should occur. Normally this is computed internally and user does not need to set it. This value represents number of bytes to aggregate in heap memory before persisting. This is based on a rough estimate of memory usage and not actual usage. The maximum heap memory usage for indexing is maxBytesInMemory * (2 + maxPendingPersists). Note that `maxBytesInMemory` also includes heap usage of artifacts created from intermediary persists. This means that after every persist, the amount of `maxBytesInMemory` until next persist will decreases, and task will fail when the sum of bytes of all intermediary persisted artifacts exceeds `maxBytesInMemory`.|1/6 of max JVM memory|no|
|maxColumnsToMerge|A parameter that limits how many segments can be merged in a single phase when merging segments for publishing. This limit is imposed on the total number of columns present in a set of segments being merged. If the limit is exceeded, segment merging will occur in multiple phases. At least 2 segments will be merged in a single phase, regardless of this setting.|-1 (unlimited)|no|
|maxTotalRows|Deprecated. Use `partitionsSpec` instead. Total number of rows in segments waiting for being pushed. Used in determining when intermediate pushing should occur.|20000000|no|
|numShards|Deprecated. Use `partitionsSpec` instead. Directly specify the number of shards to create when using a `hashed` `partitionsSpec`. If this is specified and `intervals` is specified in the `granularitySpec`, the index task can skip the determine intervals/partitions pass through the data. `numShards` cannot be specified if `maxRowsPerSegment` is set.|null|no|
|splitHintSpec|Used to give a hint to control the amount of data that each first phase task reads. This hint could be ignored depending on the implementation of the input source. See [Split hint spec](#split-hint-spec) for more details.|size-based split hint spec|no|
|partitionsSpec|Defines how to partition data in each timeChunk, see [PartitionsSpec](#partitionsspec)|`dynamic` if `forceGuaranteedRollup` = false, `hashed` or `single_dim` if `forceGuaranteedRollup` = true|no|
|indexSpec|Defines segment storage format options to be used at indexing time, see [IndexSpec](index.md#indexspec)|null|no|
|indexSpecForIntermediatePersists|Defines segment storage format options to be used at indexing time for intermediate persisted temporary segments. this can be used to disable dimension/metric compression on intermediate segments to reduce memory required for final merging. however, disabling compression on intermediate segments might increase page cache use while they are used before getting merged into final segment published, see [IndexSpec](index.md#indexspec) for possible values.|same as indexSpec|no|
|maxPendingPersists|Maximum number of persists that can be pending but not started. If this limit would be exceeded by a new intermediate persist, ingestion will block until the currently-running persist finishes. Maximum heap memory usage for indexing scales with maxRowsInMemory * (2 + maxPendingPersists).|0 (meaning one persist can be running concurrently with ingestion, and none can be queued up)|no|
|forceGuaranteedRollup|Forces guaranteeing the [perfect rollup](../ingestion/index.md#rollup). The perfect rollup optimizes the total size of generated segments and querying time while indexing time will be increased. If this is set to true, `intervals` in `granularitySpec` must be set and `hashed` or `single_dim` must be used for `partitionsSpec`. This flag cannot be used with `appendToExisting` of IOConfig. For more details, see the below __Segment pushing modes__ section.|false|no|
|reportParseExceptions|If true, exceptions encountered during parsing will be thrown and will halt ingestion; if false, unparseable rows and fields will be skipped.|false|no|
|pushTimeout|Milliseconds to wait for pushing segments. It must be >= 0, where 0 means to wait forever.|0|no|
|segmentWriteOutMediumFactory|Segment write-out medium to use when creating segments. See [SegmentWriteOutMediumFactory](#segmentwriteoutmediumfactory).|Not specified, the value from `druid.peon.defaultSegmentWriteOutMediumFactory.type` is used|no|
|maxNumConcurrentSubTasks|Maximum number of worker tasks which can be run in parallel at the same time. The supervisor task would spawn worker tasks up to `maxNumConcurrentSubTasks` regardless of the current available task slots. If this value is set to 1, the supervisor task processes data ingestion on its own instead of spawning worker tasks. If this value is set to too large, too many worker tasks can be created which might block other ingestion. Check [Capacity Planning](#capacity-planning) for more details.|1|no|
|maxRetry|Maximum number of retries on task failures.|3|no|
|maxNumSegmentsToMerge|Max limit for the number of segments that a single task can merge at the same time in the second phase. Used only `forceGuaranteedRollup` is set.|100|no|
|totalNumMergeTasks|Total number of tasks to merge segments in the merge phase when `partitionsSpec` is set to `hashed` or `single_dim`.|10|no|
|taskStatusCheckPeriodMs|Polling period in milliseconds to check running task statuses.|1000|no|
|chatHandlerTimeout|Timeout for reporting the pushed segments in worker tasks.|PT10S|no|
|chatHandlerNumRetries|Retries for reporting the pushed segments in worker tasks.|5|no|
|awaitSegmentAvailabilityTimeoutMillis|Long|Milliseconds to wait for the newly indexed segments to become available for query after ingestion completes. If `<= 0`, no wait will occur. If `> 0`, the task will wait for the Coordinator to indicate that the new segments are available for querying. If the timeout expires, the task will exit as successful, but the segments were not confirmed to have become available for query.|no (default = 0)| 

### Split Hint Spec

The split hint spec is used to give a hint when the supervisor task creates input splits.
Note that each worker task processes a single input split. You can control the amount of data each worker task will read during the first phase.

#### Size-based Split Hint Spec

The size-based split hint spec is respected by all splittable input sources except for the HTTP input source and SQL input source.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `maxSize`.|none|yes|
|maxSplitSize|Maximum number of bytes of input files to process in a single subtask. If a single file is larger than this number, it will be processed by itself in a single subtask (Files are never split across tasks yet). Note that one subtask will not process more files than `maxNumFiles` even when their total size is smaller than `maxSplitSize`. [Human-readable format](../configuration/human-readable-byte.md) is supported.|1GiB|no|
|maxNumFiles|Maximum number of input files to process in a single subtask. This limit is to avoid task failures when the ingestion spec is too long. There are two known limits on the max size of serialized ingestion spec, i.e., the max ZNode size in ZooKeeper (`jute.maxbuffer`) and the max packet size in MySQL (`max_allowed_packet`). These can make ingestion tasks fail if the serialized ingestion spec size hits one of them. Note that one subtask will not process more data than `maxSplitSize` even when the total number of files is smaller than `maxNumFiles`.|1000|no|

#### Segments Split Hint Spec

The segments split hint spec is used only for [`DruidInputSource`](#druid-input-source) (and legacy [`IngestSegmentFirehose`](#ingestsegmentfirehose)).

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `segments`.|none|yes|
|maxInputSegmentBytesPerTask|Maximum number of bytes of input segments to process in a single subtask. If a single segment is larger than this number, it will be processed by itself in a single subtask (input segments are never split across tasks). Note that one subtask will not process more segments than `maxNumSegments` even when their total size is smaller than `maxInputSegmentBytesPerTask`. [Human-readable format](../configuration/human-readable-byte.md) is supported.|1GiB|no|
|maxNumSegments|Maximum number of input segments to process in a single subtask. This limit is to avoid task failures when the ingestion spec is too long. There are two known limits on the max size of serialized ingestion spec, i.e., the max ZNode size in ZooKeeper (`jute.maxbuffer`) and the max packet size in MySQL (`max_allowed_packet`). These can make ingestion tasks fail if the serialized ingestion spec size hits one of them. Note that one subtask will not process more data than `maxInputSegmentBytesPerTask` even when the total number of segments is smaller than `maxNumSegments`.|1000|no|

### `partitionsSpec`

PartitionsSpec is used to describe the secondary partitioning method.
You should use different partitionsSpec depending on the [rollup mode](../ingestion/index.md#rollup) you want.
For perfect rollup, you should use either `hashed` (partitioning based on the hash of dimensions in each row) or
`single_dim` (based on ranges of a single dimension). For best-effort rollup, you should use `dynamic`.

The three `partitionsSpec` types have different characteristics.

| PartitionsSpec | Ingestion speed | Partitioning method | Supported rollup mode | Secondary partition pruning at query time |
|----------------|-----------------|---------------------|-----------------------|-------------------------------|
| `dynamic` | Fastest  | Partitioning based on number of rows in segment. | Best-effort rollup | N/A |
| `hashed`  | Moderate | Partitioning based on the hash value of partition dimensions. This partitioning may reduce your datasource size and query latency by improving data locality. See [Partitioning](./index.md#partitioning) for more details. | Perfect rollup | The broker can use the partition information to prune segments early to speed up queries. Since the broker knows how to hash `partitionDimensions` values to locate a segment, given a query including a filter on all the `partitionDimensions`, the broker can pick up only the segments holding the rows satisfying the filter on `partitionDimensions` for query processing.<br/><br/>Note that `partitionDimensions` must be set at ingestion time to enable secondary partition pruning at query time.|
| `single_dim` | Slowest | Range partitioning based on the value of the partition dimension. Segment sizes may be skewed depending on the partition key distribution. This may reduce your datasource size and query latency by improving data locality. See [Partitioning](./index.md#partitioning) for more details. | Perfect rollup | The broker can use the partition information to prune segments early to speed up queries. Since the broker knows the range of `partitionDimension` values in each segment, given a query including a filter on the `partitionDimension`, the broker can pick up only the segments holding the rows satisfying the filter on `partitionDimension` for query processing. |

The recommended use case for each partitionsSpec is:
- If your data has a uniformly distributed column which is frequently used in your queries,
consider using `single_dim` partitionsSpec to maximize the performance of most of your queries.
- If your data doesn't have a uniformly distributed column, but is expected to have a [high rollup ratio](./index.md#maximizing-rollup-ratio)
when you roll up with some dimensions, consider using `hashed` partitionsSpec.
It could reduce the size of datasource and query latency by improving data locality.
- If the above two scenarios are not the case or you don't need to roll up your datasource,
consider using `dynamic` partitionsSpec. 

#### Dynamic partitioning

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `dynamic`|none|yes|
|maxRowsPerSegment|Used in sharding. Determines how many rows are in each segment.|5000000|no|
|maxTotalRows|Total number of rows across all segments waiting for being pushed. Used in determining when intermediate segment push should occur.|20000000|no|

With the Dynamic partitioning, the parallel index task runs in a single phase:
it will spawn multiple worker tasks (type `single_phase_sub_task`), each of which creates segments.
How the worker task creates segments is:

- The task creates a new segment whenever the number of rows in the current segment exceeds
  `maxRowsPerSegment`.
- Once the total number of rows in all segments across all time chunks reaches to `maxTotalRows`,
  the task pushes all segments created so far to the deep storage and creates new ones.

#### Hash-based partitioning

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `hashed`|none|yes|
|numShards|Directly specify the number of shards to create. If this is specified and `intervals` is specified in the `granularitySpec`, the index task can skip the determine intervals/partitions pass through the data. This property and `targetRowsPerSegment` cannot both be set.|none|no|
|targetRowsPerSegment|A target row count for each partition. If `numShards` is left unspecified, the Parallel task will determine a partition count automatically such that each partition has a row count close to the target, assuming evenly distributed keys in the input data. A target per-segment row count of 5 million is used if both `numShards` and `targetRowsPerSegment` are null. |null (or 5,000,000 if both `numShards` and `targetRowsPerSegment` are null)|no|
|partitionDimensions|The dimensions to partition on. Leave blank to select all dimensions.|null|no|
|partitionFunction|A function to compute hash of partition dimensions. See [Hash partition function](#hash-partition-function)|`murmur3_32_abs`|no|

The Parallel task with hash-based partitioning is similar to [MapReduce](https://en.wikipedia.org/wiki/MapReduce).
The task runs in up to 3 phases: `partial dimension cardinality`, `partial segment generation` and `partial segment merge`.
- The `partial dimension cardinality` phase is an optional phase that only runs if `numShards` is not specified.
The Parallel task splits the input data and assigns them to worker tasks based on the split hint spec.
Each worker task (type `partial_dimension_cardinality`) gathers estimates of partitioning dimensions cardinality for
each time chunk. The Parallel task will aggregate these estimates from the worker tasks and determine the highest
cardinality across all of the time chunks in the input data, dividing this cardinality by `targetRowsPerSegment` to
automatically determine `numShards`.
- In the `partial segment generation` phase, just like the Map phase in MapReduce,
the Parallel task splits the input data based on the split hint spec
and assigns each split to a worker task. Each worker task (type `partial_index_generate`) reads the assigned split,
and partitions rows by the time chunk from `segmentGranularity` (primary partition key) in the `granularitySpec`
and then by the hash value of `partitionDimensions` (secondary partition key) in the `partitionsSpec`.
The partitioned data is stored in local storage of 
the [middleManager](../design/middlemanager.md) or the [indexer](../design/indexer.md).
- The `partial segment merge` phase is similar to the Reduce phase in MapReduce.
The Parallel task spawns a new set of worker tasks (type `partial_index_generic_merge`) to merge the partitioned data
created in the previous phase. Here, the partitioned data is shuffled based on
the time chunk and the hash value of `partitionDimensions` to be merged; each worker task reads the data
falling in the same time chunk and the same hash value from multiple MiddleManager/Indexer processes and merges
them to create the final segments. Finally, they push the final segments to the deep storage at once.

##### Hash partition function

In hash partitioning, the partition function is used to compute hash of partition dimensions. The partition dimension
values are first serialized into a byte array as a whole, and then the partition function is applied to compute hash of
the byte array.
Druid currently supports only one partition function.

|name|description|
|----|-----------|
|`murmur3_32_abs`|Applies an absolute value function to the result of [`murmur3_32`](https://guava.dev/releases/16.0/api/docs/com/google/common/hash/Hashing.html#murmur3_32()).|

#### Single-dimension range partitioning

> Single dimension range partitioning is currently not supported in the sequential mode of the Parallel task.
The Parallel task will use one subtask when you set `maxNumConcurrentSubTasks` to 1.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `single_dim`|none|yes|
|partitionDimension|The dimension to partition on. Only rows with a single dimension value are allowed.|none|yes|
|targetRowsPerSegment|Target number of rows to include in a partition, should be a number that targets segments of 500MB\~1GB.|none|either this or `maxRowsPerSegment`|
|maxRowsPerSegment|Soft max for the number of rows to include in a partition.|none|either this or `targetRowsPerSegment`|
|assumeGrouped|Assume that input data has already been grouped on time and dimensions. Ingestion will run faster, but may choose sub-optimal partitions if this assumption is violated.|false|no|

With `single-dim` partitioning, the Parallel task runs in 3 phases,
i.e., `partial dimension distribution`, `partial segment generation`, and `partial segment merge`.
The first phase is to collect some statistics to find
the best partitioning and the other 2 phases are to create partial segments
and to merge them, respectively, as in hash-based partitioning.
- In the `partial dimension distribution` phase, the Parallel task splits the input data and
assigns them to worker tasks based on the split hint spec. Each worker task (type `partial_dimension_distribution`) reads
the assigned split and builds a histogram for `partitionDimension`.
The Parallel task collects those histograms from worker tasks and finds
the best range partitioning based on `partitionDimension` to evenly
distribute rows across partitions. Note that either `targetRowsPerSegment`
or `maxRowsPerSegment` will be used to find the best partitioning.
- In the `partial segment generation` phase, the Parallel task spawns new worker tasks (type `partial_range_index_generate`)
to create partitioned data. Each worker task reads a split created as in the previous phase,
partitions rows by the time chunk from the `segmentGranularity` (primary partition key) in the `granularitySpec`
and then by the range partitioning found in the previous phase.
The partitioned data is stored in local storage of
the [middleManager](../design/middlemanager.md) or the [indexer](../design/indexer.md).
- In the `partial segment merge` phase, the parallel index task spawns a new set of worker tasks (type `partial_index_generic_merge`) to merge the partitioned
data created in the previous phase. Here, the partitioned data is shuffled based on
the time chunk and the value of `partitionDimension`; each worker task reads the segments
falling in the same partition of the same range from multiple MiddleManager/Indexer processes and merges
them to create the final segments. Finally, they push the final segments to the deep storage.

> Because the task with single-dimension range partitioning makes two passes over the input
> in `partial dimension distribution` and `partial segment generation` phases,
> the task may fail if the input changes in between the two passes.

### HTTP status endpoints

The supervisor task provides some HTTP endpoints to get running status.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/mode`

Returns 'parallel' if the indexing task is running in parallel. Otherwise, it returns 'sequential'.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/phase`

Returns the name of the current phase if the task running in the parallel mode.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/progress`

Returns the estimated progress of the current phase if the supervisor task is running in the parallel mode.

An example of the result is

```json
{
  "running":10,
  "succeeded":0,
  "failed":0,
  "complete":0,
  "total":10,
  "estimatedExpectedSucceeded":10
}
```

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtasks/running`

Returns the task IDs of running worker tasks, or an empty list if the supervisor task is running in the sequential mode.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs`

Returns all worker task specs, or an empty list if the supervisor task is running in the sequential mode.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs/running`

Returns running worker task specs, or an empty list if the supervisor task is running in the sequential mode.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs/complete`

Returns complete worker task specs, or an empty list if the supervisor task is running in the sequential mode.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}`

Returns the worker task spec of the given id, or HTTP 404 Not Found error if the supervisor task is running in the sequential mode.

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}/state`

Returns the state of the worker task spec of the given id, or HTTP 404 Not Found error if the supervisor task is running in the sequential mode.
The returned result contains the worker task spec, a current task status if exists, and task attempt history.

An example of the result is

```json
{
  "spec": {
    "id": "index_parallel_lineitem_2018-04-20T22:12:43.610Z_2",
    "groupId": "index_parallel_lineitem_2018-04-20T22:12:43.610Z",
    "supervisorTaskId": "index_parallel_lineitem_2018-04-20T22:12:43.610Z",
    "context": null,
    "inputSplit": {
      "split": "/path/to/data/lineitem.tbl.5"
    },
    "ingestionSpec": {
      "dataSchema": {
        "dataSource": "lineitem",
        "timestampSpec": {
          "column": "l_shipdate",
          "format": "yyyy-MM-dd"
        },
        "dimensionsSpec": {
          "dimensions": [
            "l_orderkey",
            "l_partkey",
            "l_suppkey",
            "l_linenumber",
            "l_returnflag",
            "l_linestatus",
            "l_shipdate",
            "l_commitdate",
            "l_receiptdate",
            "l_shipinstruct",
            "l_shipmode",
            "l_comment"
          ]
        },
        "metricsSpec": [
          {
            "type": "count",
            "name": "count"
          },
          {
            "type": "longSum",
            "name": "l_quantity",
            "fieldName": "l_quantity",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_extendedprice",
            "fieldName": "l_extendedprice",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_discount",
            "fieldName": "l_discount",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_tax",
            "fieldName": "l_tax",
            "expression": null
          }
        ],
        "granularitySpec": {
          "type": "uniform",
          "segmentGranularity": "YEAR",
          "queryGranularity": {
            "type": "none"
          },
          "rollup": true,
          "intervals": [
            "1980-01-01T00:00:00.000Z/2020-01-01T00:00:00.000Z"
          ]
        },
        "transformSpec": {
          "filter": null,
          "transforms": []
        }
      },
      "ioConfig": {
        "type": "index_parallel",
        "inputSource": {
          "type": "local",
          "baseDir": "/path/to/data/",
          "filter": "lineitem.tbl.5"
        },
        "inputFormat": {
          "format": "tsv",
          "delimiter": "|",
          "columns": [
            "l_orderkey",
            "l_partkey",
            "l_suppkey",
            "l_linenumber",
            "l_quantity",
            "l_extendedprice",
            "l_discount",
            "l_tax",
            "l_returnflag",
            "l_linestatus",
            "l_shipdate",
            "l_commitdate",
            "l_receiptdate",
            "l_shipinstruct",
            "l_shipmode",
            "l_comment"
          ]
        },
        "appendToExisting": false,
        "dropExisting": false
      },
      "tuningConfig": {
        "type": "index_parallel",
        "maxRowsPerSegment": 5000000,
        "maxRowsInMemory": 1000000,
        "maxTotalRows": 20000000,
        "numShards": null,
        "indexSpec": {
          "bitmap": {
            "type": "roaring"
          },
          "dimensionCompression": "lz4",
          "metricCompression": "lz4",
          "longEncoding": "longs"
        },
        "indexSpecForIntermediatePersists": {
          "bitmap": {
            "type": "roaring"
          },
          "dimensionCompression": "lz4",
          "metricCompression": "lz4",
          "longEncoding": "longs"
        },
        "maxPendingPersists": 0,
        "reportParseExceptions": false,
        "pushTimeout": 0,
        "segmentWriteOutMediumFactory": null,
        "maxNumConcurrentSubTasks": 4,
        "maxRetry": 3,
        "taskStatusCheckPeriodMs": 1000,
        "chatHandlerTimeout": "PT10S",
        "chatHandlerNumRetries": 5,
        "logParseExceptions": false,
        "maxParseExceptions": 2147483647,
        "maxSavedParseExceptions": 0,
        "forceGuaranteedRollup": false,
        "buildV9Directly": true
      }
    }
  },
  "currentStatus": {
    "id": "index_sub_lineitem_2018-04-20T22:16:29.922Z",
    "type": "index_sub",
    "createdTime": "2018-04-20T22:16:29.925Z",
    "queueInsertionTime": "2018-04-20T22:16:29.929Z",
    "statusCode": "RUNNING",
    "duration": -1,
    "location": {
      "host": null,
      "port": -1,
      "tlsPort": -1
    },
    "dataSource": "lineitem",
    "errorMsg": null
  },
  "taskHistory": []
}
```

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}/history`

Returns the task attempt history of the worker task spec of the given id, or HTTP 404 Not Found error if the supervisor task is running in the sequential mode.

### Capacity planning

The supervisor task can create up to `maxNumConcurrentSubTasks` worker tasks no matter how many task slots are currently available.
As a result, total number of tasks which can be run at the same time is `(maxNumConcurrentSubTasks + 1)` (including the supervisor task).
Please note that this can be even larger than total number of task slots (sum of the capacity of all workers).
If `maxNumConcurrentSubTasks` is larger than `n (available task slots)`, then
`maxNumConcurrentSubTasks` tasks are created by the supervisor task, but only `n` tasks would be started.
Others will wait in the pending state until any running task is finished.

If you are using the Parallel Index Task with stream ingestion together,
we would recommend to limit the max capacity for batch ingestion to prevent
stream ingestion from being blocked by batch ingestion. Suppose you have
`t` Parallel Index Tasks to run at the same time, but want to limit
the max number of tasks for batch ingestion to `b`. Then, (sum of `maxNumConcurrentSubTasks`
of all Parallel Index Tasks + `t` (for supervisor tasks)) must be smaller than `b`.

If you have some tasks of a higher priority than others, you may set their
`maxNumConcurrentSubTasks` to a higher value than lower priority tasks.
This may help the higher priority tasks to finish earlier than lower priority tasks
by assigning more task slots to them.

## Simple task

The simple task (type `index`) is designed to be used for smaller data sets. The task executes within the indexing service.

### Task syntax

A sample task is shown below:

```json
{
  "type" : "index",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "timestampSpec" : {
        "column" : "timestamp",
        "format" : "auto"
      },
      "dimensionsSpec" : {
        "dimensions": ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"],
        "dimensionExclusions" : []
      },
      "metricsSpec" : [
        {
          "type" : "count",
          "name" : "count"
        },
        {
          "type" : "doubleSum",
          "name" : "added",
          "fieldName" : "added"
        },
        {
          "type" : "doubleSum",
          "name" : "deleted",
          "fieldName" : "deleted"
        },
        {
          "type" : "doubleSum",
          "name" : "delta",
          "fieldName" : "delta"
        }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "DAY",
        "queryGranularity" : "NONE",
        "intervals" : [ "2013-08-31/2013-09-01" ]
      }
    },
    "ioConfig" : {
      "type" : "index",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "examples/indexing/",
        "filter" : "wikipedia_data.json"
       },
       "inputFormat": {
         "type": "json"
       }
    },
    "tuningConfig" : {
      "type" : "index",
      "maxRowsPerSegment" : 5000000,
      "maxRowsInMemory" : 1000000
    }
  }
}
```

|property|description|required?|
|--------|-----------|---------|
|type|The task type, this should always be `index`.|yes|
|id|The task ID. If this is not explicitly specified, Druid generates the task ID using task type, data source name, interval, and date-time stamp. |no|
|spec|The ingestion spec including the data schema, IOConfig, and TuningConfig. See below for more details. |yes|
|context|Context containing various task configuration parameters. See below for more details.|no|

### `dataSchema`

This field is required.

See the [`dataSchema`](../ingestion/index.md#dataschema) section of the ingestion docs for details.

If you do not specify `intervals` explicitly in your dataSchema's granularitySpec, the Local Index Task will do an extra
pass over the data to determine the range to lock when it starts up.  If you specify `intervals` explicitly, any rows
outside the specified intervals will be thrown away. We recommend setting `intervals` explicitly if you know the time
range of the data because it allows the task to skip the extra pass, and so that you don't accidentally replace data outside
that range if there's some stray data with unexpected timestamps.

### `ioConfig`

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|The task type, this should always be "index".|none|yes|
|inputFormat|[`inputFormat`](./data-formats.md#input-format) to specify how to parse input data.|none|yes|
|appendToExisting|Creates segments as additional shards of the latest version, effectively appending to the segment set instead of replacing it. This means that you can append new segments to any datasource regardless of its original partitioning scheme. You must use the `dynamic` partitioning type for the appended segments. If you specify a different partitioning type, the task fails with an error.|false|no|
|dropExisting|If `true` and `appendToExisting` is `false` and the `granularitySpec` contains an`interval`, then the ingestion task drops (mark unused) all existing segments fully contained by the specified `interval` when the task publishes new segments. If ingestion fails, Druid does not drop or mark unused any segments. In the case of misconfiguration where either `appendToExisting` is `true` or `interval` is not specified in `granularitySpec`, Druid does not drop any segments even if `dropExisting` is `true`. WARNING: this functionality is still in beta and can result in temporary data unavailability for data within the specified `interval`.|false|no|

### `tuningConfig`

The tuningConfig is optional and default parameters will be used if no tuningConfig is specified. See below for more details.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|The task type, this should always be "index".|none|yes|
|maxRowsPerSegment|Deprecated. Use `partitionsSpec` instead. Used in sharding. Determines how many rows are in each segment.|5000000|no|
|maxRowsInMemory|Used in determining when intermediate persists to disk should occur. Normally user does not need to set this, but depending on the nature of data, if rows are short in terms of bytes, user may not want to store a million rows in memory and this value should be set.|1000000|no|
|maxBytesInMemory|Used in determining when intermediate persists to disk should occur. Normally this is computed internally and user does not need to set it. This value represents number of bytes to aggregate in heap memory before persisting. This is based on a rough estimate of memory usage and not actual usage. The maximum heap memory usage for indexing is maxBytesInMemory * (2 + maxPendingPersists). Note that `maxBytesInMemory` also includes heap usage of artifacts created from intermediary persists. This means that after every persist, the amount of `maxBytesInMemory` until next persist will decreases, and task will fail when the sum of bytes of all intermediary persisted artifacts exceeds `maxBytesInMemory`.|1/6 of max JVM memory|no|
|maxTotalRows|Deprecated. Use `partitionsSpec` instead. Total number of rows in segments waiting for being pushed. Used in determining when intermediate pushing should occur.|20000000|no|
|numShards|Deprecated. Use `partitionsSpec` instead. Directly specify the number of shards to create. If this is specified and `intervals` is specified in the `granularitySpec`, the index task can skip the determine intervals/partitions pass through the data. `numShards` cannot be specified if `maxRowsPerSegment` is set.|null|no|
|partitionDimensions|Deprecated. Use `partitionsSpec` instead. The dimensions to partition on. Leave blank to select all dimensions. Only used with `forceGuaranteedRollup` = true, will be ignored otherwise.|null|no|
|partitionsSpec|Defines how to partition data in each timeChunk, see [PartitionsSpec](#partitionsspec)|`dynamic` if `forceGuaranteedRollup` = false, `hashed` if `forceGuaranteedRollup` = true|no|
|indexSpec|Defines segment storage format options to be used at indexing time, see [IndexSpec](index.md#indexspec)|null|no|
|indexSpecForIntermediatePersists|Defines segment storage format options to be used at indexing time for intermediate persisted temporary segments. this can be used to disable dimension/metric compression on intermediate segments to reduce memory required for final merging. however, disabling compression on intermediate segments might increase page cache use while they are used before getting merged into final segment published, see [IndexSpec](index.md#indexspec) for possible values.|same as indexSpec|no|
|maxPendingPersists|Maximum number of persists that can be pending but not started. If this limit would be exceeded by a new intermediate persist, ingestion will block until the currently-running persist finishes. Maximum heap memory usage for indexing scales with maxRowsInMemory * (2 + maxPendingPersists).|0 (meaning one persist can be running concurrently with ingestion, and none can be queued up)|no|
|forceGuaranteedRollup|Forces guaranteeing the [perfect rollup](../ingestion/index.md#rollup). The perfect rollup optimizes the total size of generated segments and querying time while indexing time will be increased. If this is set to true, the index task will read the entire input data twice: one for finding the optimal number of partitions per time chunk and one for generating segments. Note that the result segments would be hash-partitioned. This flag cannot be used with `appendToExisting` of IOConfig. For more details, see the below __Segment pushing modes__ section.|false|no|
|reportParseExceptions|DEPRECATED. If true, exceptions encountered during parsing will be thrown and will halt ingestion; if false, unparseable rows and fields will be skipped. Setting `reportParseExceptions` to true will override existing configurations for `maxParseExceptions` and `maxSavedParseExceptions`, setting `maxParseExceptions` to 0 and limiting `maxSavedParseExceptions` to no more than 1.|false|no|
|pushTimeout|Milliseconds to wait for pushing segments. It must be >= 0, where 0 means to wait forever.|0|no|
|segmentWriteOutMediumFactory|Segment write-out medium to use when creating segments. See [SegmentWriteOutMediumFactory](#segmentwriteoutmediumfactory).|Not specified, the value from `druid.peon.defaultSegmentWriteOutMediumFactory.type` is used|no|
|logParseExceptions|If true, log an error message when a parsing exception occurs, containing information about the row where the error occurred.|false|no|
|maxParseExceptions|The maximum number of parse exceptions that can occur before the task halts ingestion and fails. Overridden if `reportParseExceptions` is set.|unlimited|no|
|maxSavedParseExceptions|When a parse exception occurs, Druid can keep track of the most recent parse exceptions. "maxSavedParseExceptions" limits how many exception instances will be saved. These saved exceptions will be made available after the task finishes in the [task completion report](tasks.md#task-reports). Overridden if `reportParseExceptions` is set.|0|no|

### `partitionsSpec`

PartitionsSpec is to describe the secondary partitioning method.
You should use different partitionsSpec depending on the [rollup mode](../ingestion/index.md#rollup) you want.
For perfect rollup, you should use `hashed`.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `hashed`|none|yes|
|maxRowsPerSegment|Used in sharding. Determines how many rows are in each segment.|5000000|no|
|numShards|Directly specify the number of shards to create. If this is specified and `intervals` is specified in the `granularitySpec`, the index task can skip the determine intervals/partitions pass through the data. `numShards` cannot be specified if `maxRowsPerSegment` is set.|null|no|
|partitionDimensions|The dimensions to partition on. Leave blank to select all dimensions.|null|no|
|partitionFunction|A function to compute hash of partition dimensions. See [Hash partition function](#hash-partition-function)|`murmur3_32_abs`|no|

For best-effort rollup, you should use `dynamic`.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should always be `dynamic`|none|yes|
|maxRowsPerSegment|Used in sharding. Determines how many rows are in each segment.|5000000|no|
|maxTotalRows|Total number of rows in segments waiting for being pushed.|20000000|no|

### `segmentWriteOutMediumFactory`

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|type|String|See [Additional Peon Configuration: SegmentWriteOutMediumFactory](../configuration/index.md#segmentwriteoutmediumfactory) for explanation and available options.|yes|

### Segment pushing modes

While ingesting data using the Index task, it creates segments from the input data and pushes them. For segment pushing,
the Index task supports two segment pushing modes, i.e., _bulk pushing mode_ and _incremental pushing mode_ for
[perfect rollup and best-effort rollup](../ingestion/index.md#rollup), respectively.

In the bulk pushing mode, every segment is pushed at the very end of the index task. Until then, created segments
are stored in the memory and local storage of the process running the index task. As a result, this mode might cause a
problem due to limited storage capacity, and is not recommended to use in production.

On the contrary, in the incremental pushing mode, segments are incrementally pushed, that is they can be pushed
in the middle of the index task. More precisely, the index task collects data and stores created segments in the memory
and disks of the process running that task until the total number of collected rows exceeds `maxTotalRows`. Once it exceeds,
the index task immediately pushes all segments created until that moment, cleans all pushed segments up, and
continues to ingest remaining data.

To enable bulk pushing mode, `forceGuaranteedRollup` should be set in the TuningConfig. Note that this option cannot
be used with `appendToExisting` of IOConfig.

## Input Sources

The input source is the place to define from where your index task reads data.
Only the native Parallel task and Simple task support the input source. 

### S3 Input Source

> You need to include the [`druid-s3-extensions`](../development/extensions-core/s3.md) as an extension to use the S3 input source. 

The S3 input source is to support reading objects directly from S3.
Objects can be specified either via a list of S3 URI strings or a list of
S3 location prefixes, which will attempt to list the contents and ingest
all objects contained in the locations. The S3 input source is splittable
and can be used by the [Parallel task](#parallel-task),
where each worker task of `index_parallel` will read one or multiple objects.

Sample specs:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "uris": ["s3://foo/bar/file.json", "s3://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "prefixes": ["s3://foo/bar/", "s3://bar/foo/"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```


```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "objects": [
          { "bucket": "foo", "path": "bar/file1.json"},
          { "bucket": "bar", "path": "foo/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `s3`.|None|yes|
|uris|JSON array of URIs where S3 objects to be ingested are located.|None|`uris` or `prefixes` or `objects` must be set|
|prefixes|JSON array of URI prefixes for the locations of S3 objects to be ingested. Empty objects starting with one of the given prefixes will be skipped.|None|`uris` or `prefixes` or `objects` must be set|
|objects|JSON array of S3 Objects to be ingested.|None|`uris` or `prefixes` or `objects` must be set|
|properties|Properties Object for overriding the default S3 configuration. See below for more information.|None|No (defaults will be used if not given)

Note that the S3 input source will skip all empty objects only when `prefixes` is specified.

S3 Object:

|property|description|default|required?|
|--------|-----------|-------|---------|
|bucket|Name of the S3 bucket|None|yes|
|path|The path where data is located.|None|yes|

Properties Object:

|property|description|default|required?|
|--------|-----------|-------|---------|
|accessKeyId|The [Password Provider](../operations/password-provider.md) or plain text string of this S3 InputSource's access key|None|yes if secretAccessKey is given|
|secretAccessKey|The [Password Provider](../operations/password-provider.md) or plain text string of this S3 InputSource's secret key|None|yes if accessKeyId is given|

**Note :** *If accessKeyId and secretAccessKey are not given, the default [S3 credentials provider chain](../development/extensions-core/s3.md#s3-authentication-methods) is used.*

### Google Cloud Storage Input Source

> You need to include the [`druid-google-extensions`](../development/extensions-core/google.md) as an extension to use the Google Cloud Storage input source.

The Google Cloud Storage input source is to support reading objects directly
from Google Cloud Storage. Objects can be specified as list of Google
Cloud Storage URI strings. The Google Cloud Storage input source is splittable
and can be used by the [Parallel task](#parallel-task), where each worker task of `index_parallel` will read
one or multiple objects.

Sample specs:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "uris": ["gs://foo/bar/file.json", "gs://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "prefixes": ["gs://foo/bar/", "gs://bar/foo/"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```


```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "objects": [
          { "bucket": "foo", "path": "bar/file1.json"},
          { "bucket": "bar", "path": "foo/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `google`.|None|yes|
|uris|JSON array of URIs where Google Cloud Storage objects to be ingested are located.|None|`uris` or `prefixes` or `objects` must be set|
|prefixes|JSON array of URI prefixes for the locations of Google Cloud Storage objects to be ingested. Empty objects starting with one of the given prefixes will be skipped.|None|`uris` or `prefixes` or `objects` must be set|
|objects|JSON array of Google Cloud Storage objects to be ingested.|None|`uris` or `prefixes` or `objects` must be set|

Note that the Google Cloud Storage input source will skip all empty objects only when `prefixes` is specified.

Google Cloud Storage object:

|property|description|default|required?|
|--------|-----------|-------|---------|
|bucket|Name of the Google Cloud Storage bucket|None|yes|
|path|The path where data is located.|None|yes|

### Azure Input Source

> You need to include the [`druid-azure-extensions`](../development/extensions-core/azure.md) as an extension to use the Azure input source.

The Azure input source is to support reading objects directly from Azure Blob store. Objects can be
specified as list of Azure Blob store URI strings. The Azure input source is splittable and can be used
by the [Parallel task](#parallel-task), where each worker task of `index_parallel` will read
a single object.

Sample specs:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "uris": ["azure://container/prefix1/file.json", "azure://container/prefix2/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "prefixes": ["azure://container/prefix1/", "azure://container/prefix2/"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```


```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "objects": [
          { "bucket": "container", "path": "prefix1/file1.json"},
          { "bucket": "container", "path": "prefix2/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `azure`.|None|yes|
|uris|JSON array of URIs where Azure Blob objects to be ingested are located. Should be in form "azure://\<container>/\<path-to-file\>"|None|`uris` or `prefixes` or `objects` must be set|
|prefixes|JSON array of URI prefixes for the locations of Azure Blob objects to be ingested. Should be in the form "azure://\<container>/\<prefix\>". Empty objects starting with one of the given prefixes will be skipped.|None|`uris` or `prefixes` or `objects` must be set|
|objects|JSON array of Azure Blob objects to be ingested.|None|`uris` or `prefixes` or `objects` must be set|

Note that the Azure input source will skip all empty objects only when `prefixes` is specified.

Azure Blob object:

|property|description|default|required?|
|--------|-----------|-------|---------|
|bucket|Name of the Azure Blob Storage container|None|yes|
|path|The path where data is located.|None|yes|

### HDFS Input Source

> You need to include the [`druid-hdfs-storage`](../development/extensions-core/hdfs.md) as an extension to use the HDFS input source.

The HDFS input source is to support reading files directly
from HDFS storage. File paths can be specified as an HDFS URI string or a list
of HDFS URI strings. The HDFS input source is splittable and can be used by the [Parallel task](#parallel-task),
where each worker task of `index_parallel` will read one or multiple files.

Sample specs:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://namenode_host/foo/bar/", "hdfs://namenode_host/bar/foo"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://namenode_host/foo/bar/", "hdfs://namenode_host/bar/foo"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://namenode_host/foo/bar/file.json", "hdfs://namenode_host/bar/foo/file2.json"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": ["hdfs://namenode_host/foo/bar/file.json", "hdfs://namenode_host/bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `hdfs`.|None|yes|
|paths|HDFS paths. Can be either a JSON array or comma-separated string of paths. Wildcards like `*` are supported in these paths. Empty files located under one of the given paths will be skipped.|None|yes|

You can also ingest from other storage using the HDFS input source if the HDFS client supports that storage.
However, if you want to ingest from cloud storage, consider using the service-specific input source for your data storage.
If you want to use a non-hdfs protocol with the HDFS input source, include the protocol
in `druid.ingestion.hdfs.allowedProtocols`. See [HDFS input source security configuration](../configuration/index.md#hdfs-input-source) for more details.

### HTTP Input Source

The HTTP input source is to support reading files directly from remote sites via HTTP.

> **NOTE:** Ingestion tasks run under the operating system account that runs the Druid processes, for example the Indexer, Middle Manager, and Peon. This means any user who can submit an ingestion task can specify an `HTTPInputSource` at any location where the Druid process has permissions. For example, using `HTTPInputSource`, a console user has access to internal network locations where the they would be denied access otherwise.

> **WARNING:** `HTTPInputSource` is not limited to the HTTP or HTTPS protocols. It uses the Java `URI` class that supports HTTP, HTTPS, FTP, file, and jar protocols by default. This means you should never run Druid under the `root` account, because a user can use the file protocol to access any files on the local disk.

For more information about security best practices, see [Security overview](../operations/security-overview.md#best-practices).

The HTTP input source is _splittable_ and can be used by the [Parallel task](#parallel-task),
where each worker task of `index_parallel` will read only one file. This input source does not support Split Hint Spec.

Sample specs:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

Example with authentication fields using the DefaultPassword provider (this requires the password to be in the ingestion spec):

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
        "httpAuthenticationUsername": "username",
        "httpAuthenticationPassword": "password123"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

You can also use the other existing Druid PasswordProviders. Here is an example using the EnvironmentVariablePasswordProvider:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
        "httpAuthenticationUsername": "username",
        "httpAuthenticationPassword": {
          "type": "environment",
          "variable": "HTTP_INPUT_SOURCE_PW"
        }
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
}
```

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `http`|None|yes|
|uris|URIs of the input files. See below for the protocols allowed for URIs.|None|yes|
|httpAuthenticationUsername|Username to use for authentication with specified URIs. Can be optionally used if the URIs specified in the spec require a Basic Authentication Header.|None|no|
|httpAuthenticationPassword|PasswordProvider to use with specified URIs. Can be optionally used if the URIs specified in the spec require a Basic Authentication Header.|None|no|

You can only use protocols listed in the `druid.ingestion.http.allowedProtocols` property as HTTP input sources.
The `http` and `https` protocols are allowed by default. See [HTTP input source security configuration](../configuration/index.md#http-input-source) for more details.

### Inline Input Source

The Inline input source can be used to read the data inlined in its own spec.
It can be used for demos or for quickly testing out parsing and schema.

Sample spec:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "inline",
        "data": "0,values,formatted\n1,as,CSV"
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```

|property|description|required?|
|--------|-----------|---------|
|type|This should be "inline".|yes|
|data|Inlined data to ingest.|yes|

### Local Input Source

The Local input source is to support reading files directly from local storage,
and is mainly intended for proof-of-concept testing.
The Local input source is _splittable_ and can be used by the [Parallel task](#parallel-task),
where each worker task of `index_parallel` will read one or multiple files.

Sample spec:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "local",
        "filter" : "*.csv",
        "baseDir": "/data/directory",
        "files": ["/bar/foo", "/foo/bar"]
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```

|property|description|required?|
|--------|-----------|---------|
|type|This should be "local".|yes|
|filter|A wildcard filter for files. See [here](http://commons.apache.org/proper/commons-io/apidocs/org/apache/commons/io/filefilter/WildcardFileFilter) for more information.|yes if `baseDir` is specified|
|baseDir|Directory to search recursively for files to be ingested. Empty files under the `baseDir` will be skipped.|At least one of `baseDir` or `files` should be specified|
|files|File paths to ingest. Some files can be ignored to avoid ingesting duplicate files if they are located under the specified `baseDir`. Empty files will be skipped.|At least one of `baseDir` or `files` should be specified|

### Druid Input Source

The Druid input source is to support reading data directly from existing Druid segments,
potentially using a new schema and changing the name, dimensions, metrics, rollup, etc. of the segment.
The Druid input source is _splittable_ and can be used by the [Parallel task](#parallel-task).
This input source has a fixed input format for reading from Druid segments;
no `inputFormat` field needs to be specified in the ingestion spec when using this input source.

|property|description|required?|
|--------|-----------|---------|
|type|This should be "druid".|yes|
|dataSource|A String defining the Druid datasource to fetch rows from|yes|
|interval|A String representing an ISO-8601 interval, which defines the time range to fetch the data over.|yes|
|filter| See [Filters](../querying/filters.md). Only rows that match the filter, if specified, will be returned.|no|

The Druid input source can be used for a variety of purposes, including:

- Creating new datasources that are rolled-up copies of existing datasources.
- Changing the [partitioning or sorting](index.md#partitioning) of a datasource to improve performance.
- Updating or removing rows using a [`transformSpec`](index.md#transformspec).

When using the Druid input source, the timestamp column shows up as a numeric field named `__time` set to the number
of milliseconds since the epoch (January 1, 1970 00:00:00 UTC). It is common to use this in the timestampSpec, if you
want the output timestamp to be equivalent to the input timestamp. In this case, set the timestamp column to `__time`
and the format to `auto` or `millis`.

It is OK for the input and output datasources to be the same. In this case, newly generated data will overwrite the
previous data for the intervals specified in the `granularitySpec`. Generally, if you are going to do this, it is a
good idea to test out your reindexing by writing to a separate datasource before overwriting your main one.
Alternatively, if your goals can be satisfied by [compaction](compaction.md), consider that instead as a simpler
approach.

An example task spec is shown below. It reads from a hypothetical raw datasource `wikipedia_raw` and creates a new
rolled-up datasource `wikipedia_rollup` by grouping on hour, "countryName", and "page".

```json
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia_rollup",
      "timestampSpec": {
        "column": "__time",
        "format": "millis"
      },
      "dimensionsSpec": {
        "dimensions": [
          "countryName",
          "page"
        ]
      },
      "metricsSpec": [
        {
          "type": "count",
          "name": "cnt"
        }
      ],
      "granularitySpec": {
        "type": "uniform",
        "queryGranularity": "HOUR",
        "segmentGranularity": "DAY",
        "intervals": ["2016-06-27/P1D"],
        "rollup": true
      }
    },
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "druid",
        "dataSource": "wikipedia_raw",
        "interval": "2016-06-27/P1D"
      }
    },
    "tuningConfig": {
      "type": "index_parallel",
      "partitionsSpec": {
        "type": "hashed"
      },
      "forceGuaranteedRollup": true,
      "maxNumConcurrentSubTasks": 1
    }
  }
}
```

> Note: Older versions (0.19 and earlier) did not respect the timestampSpec when using the Druid input source. If you
> have ingestion specs that rely on this and cannot rewrite them, set
> [`druid.indexer.task.ignoreTimestampSpecForDruidInputSource`](../configuration/index.md#indexer-general-configuration)
> to `true` to enable a compatibility mode where the timestampSpec is ignored.

### SQL Input Source

The SQL input source is used to read data directly from RDBMS.
The SQL input source is _splittable_ and can be used by the [Parallel task](#parallel-task), where each worker task will read from one SQL query from the list of queries.
This input source does not support Split Hint Spec.
Since this input source has a fixed input format for reading events, no `inputFormat` field needs to be specified in the ingestion spec when using this input source.
Please refer to the Recommended practices section below before using this input source.

|property|description|required?|
|--------|-----------|---------|
|type|This should be "sql".|Yes|
|database|Specifies the database connection details. The database type corresponds to the extension that supplies the `connectorConfig` support. The specified extension must be loaded into Druid:<br/><br/><ul><li>[mysql-metadata-storage](../development/extensions-core/mysql.md) for `mysql`</li><li> [postgresql-metadata-storage](../development/extensions-core/postgresql.md) extension for `postgresql`.</li></ul><br/><br/>You can selectively allow JDBC properties in `connectURI`. See [JDBC connections security config](../configuration/index.md#jdbc-connections-to-external-databases) for more details.|Yes|
|foldCase|Toggle case folding of database column names. This may be enabled in cases where the database returns case insensitive column names in query results.|No|
|sqls|List of SQL queries where each SQL query would retrieve the data to be indexed.|Yes|

An example SqlInputSource spec is shown below:

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "sql",
        "database": {
            "type": "mysql",
            "connectorConfig": {
                "connectURI": "jdbc:mysql://host:port/schema",
                "user": "user",
                "password": "password"
            }
        },
        "sqls": ["SELECT * FROM table1 WHERE timestamp BETWEEN '2013-01-01 00:00:00' AND '2013-01-01 11:59:59'", "SELECT * FROM table2 WHERE timestamp BETWEEN '2013-01-01 00:00:00' AND '2013-01-01 11:59:59'"]
      }
    },
...
```

The spec above will read all events from two separate SQLs for the interval `2013-01-01/2013-01-02`.
Each of the SQL queries will be run in its own sub-task and thus for the above example, there would be two sub-tasks.

**Recommended practices**

Compared to the other native batch InputSources, SQL InputSource behaves differently in terms of reading the input data and so it would be helpful to consider the following points before using this InputSource in a production environment:

* During indexing, each sub-task would execute one of the SQL queries and the results are stored locally on disk. The sub-tasks then proceed to read the data from these local input files and generate segments. Presently, there isn’t any restriction on the size of the generated files and this would require the MiddleManagers or Indexers to have sufficient disk capacity based on the volume of data being indexed.

* Filtering the SQL queries based on the intervals specified in the `granularitySpec` can avoid unwanted data being retrieved and stored locally by the indexing sub-tasks. For example, if the `intervals` specified in the `granularitySpec` is `["2013-01-01/2013-01-02"]` and the SQL query is `SELECT * FROM table1`, `SqlInputSource` will read all the data for `table1` based on the query, even though only data between the intervals specified will be indexed into Druid.

* Pagination may be used on the SQL queries to ensure that each query pulls a similar amount of data, thereby improving the efficiency of the sub-tasks.

* Similar to file-based input formats, any updates to existing data will replace the data in segments specific to the intervals specified in the `granularitySpec`.


### Combining Input Source

The Combining input source is used to read data from multiple InputSources. This input source should be only used if all the delegate input sources are
 _splittable_ and can be used by the [Parallel task](#parallel-task). This input source will identify the splits from its delegates and each split will be processed by a worker task. Similar to other input sources, this input source supports a single `inputFormat`. Therefore, please note that delegate input sources requiring an `inputFormat` must have the same format for input data.

|property|description|required?|
|--------|-----------|---------|
|type|This should be "combining".|Yes|
|delegates|List of _splittable_ InputSources to read data from.|Yes|

Sample spec:


```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "combining",
        "delegates" : [
         {
          "type": "local",
          "filter" : "*.csv",
          "baseDir": "/data/directory",
          "files": ["/bar/foo", "/foo/bar"]
         },
         {
          "type": "druid",
          "dataSource": "wikipedia",
          "interval": "2013-01-01/2013-01-02"
         }
        ]
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```


###

## Firehoses (Deprecated)

Firehoses are deprecated in 0.17.0. It's highly recommended to use the [Input source](#input-sources) instead.
There are several firehoses readily available in Druid, some are meant for examples, others can be used directly in a production environment.

### StaticS3Firehose

> You need to include the [`druid-s3-extensions`](../development/extensions-core/s3.md) as an extension to use the StaticS3Firehose.

This firehose ingests events from a predefined list of S3 objects.
This firehose is _splittable_ and can be used by the [Parallel task](#parallel-task).
Since each split represents an object in this firehose, each worker task of `index_parallel` will read an object.

Sample spec:

```json
"firehose" : {
    "type" : "static-s3",
    "uris": ["s3://foo/bar/file.gz", "s3://bar/foo/file2.gz"]
}
```

This firehose provides caching and prefetching features. In the Simple task, a firehose can be read twice if intervals or
shardSpecs are not specified, and, in this case, caching can be useful. Prefetching is preferred when direct scan of objects is slow.
Note that prefetching or caching isn't that useful in the Parallel task.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `static-s3`.|None|yes|
|uris|JSON array of URIs where s3 files to be ingested are located.|None|`uris` or `prefixes` must be set|
|prefixes|JSON array of URI prefixes for the locations of s3 files to be ingested.|None|`uris` or `prefixes` must be set|
|maxCacheCapacityBytes|Maximum size of the cache space in bytes. 0 means disabling cache. Cached files are not removed until the ingestion task completes.|1073741824|no|
|maxFetchCapacityBytes|Maximum size of the fetch space in bytes. 0 means disabling prefetch. Prefetched files are removed immediately once they are read.|1073741824|no|
|prefetchTriggerBytes|Threshold to trigger prefetching s3 objects.|maxFetchCapacityBytes / 2|no|
|fetchTimeout|Timeout for fetching an s3 object.|60000|no|
|maxFetchRetry|Maximum retry for fetching an s3 object.|3|no|

#### StaticGoogleBlobStoreFirehose

> You need to include the [`druid-google-extensions`](../development/extensions-core/google.md) as an extension to use the StaticGoogleBlobStoreFirehose.

This firehose ingests events, similar to the StaticS3Firehose, but from an Google Cloud Store.

As with the S3 blobstore, it is assumed to be gzipped if the extension ends in .gz

This firehose is _splittable_ and can be used by the [Parallel task](#parallel-task).
Since each split represents an object in this firehose, each worker task of `index_parallel` will read an object.

Sample spec:

```json
"firehose" : {
    "type" : "static-google-blobstore",
    "blobs": [
        {
          "bucket": "foo",
          "path": "/path/to/your/file.json"
        },
        {
          "bucket": "bar",
          "path": "/another/path.json"
        }
    ]
}
```

This firehose provides caching and prefetching features. In the Simple task, a firehose can be read twice if intervals or
shardSpecs are not specified, and, in this case, caching can be useful. Prefetching is preferred when direct scan of objects is slow.
Note that prefetching or caching isn't that useful in the Parallel task.

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be `static-google-blobstore`.|None|yes|
|blobs|JSON array of Google Blobs.|None|yes|
|maxCacheCapacityBytes|Maximum size of the cache space in bytes. 0 means disabling cache. Cached files are not removed until the ingestion task completes.|1073741824|no|
|maxFetchCapacityBytes|Maximum size of the fetch space in bytes. 0 means disabling prefetch. Prefetched files are removed immediately once they are read.|1073741824|no|
|prefetchTriggerBytes|Threshold to trigger prefetching Google Blobs.|maxFetchCapacityBytes / 2|no|
|fetchTimeout|Timeout for fetching a Google Blob.|60000|no|
|maxFetchRetry|Maximum retry for fetching a Google Blob.|3|no|

Google Blobs:

|property|description|default|required?|
|--------|-----------|-------|---------|
|bucket|Name of the Google Cloud bucket|None|yes|
|path|The path where data is located.|None|yes|

### HDFSFirehose

> You need to include the [`druid-hdfs-storage`](../development/extensions-core/hdfs.md) as an extension to use the HDFSFirehose.

This firehose ingests events from a predefined list of files from the HDFS storage.
This firehose is _splittable_ and can be used by the [Parallel task](#parallel-task).
Since each split represents an HDFS file, each worker task of `index_parallel` will read files.

Sample spec:

```json
"firehose" : {
    "type" : "hdfs",
    "paths": "/foo/bar,/foo/baz"
}
```

This firehose provides caching and prefetching features. During native batch indexing, a firehose can be read twice if
`intervals` are not specified, and, in this case, caching can be useful. Prefetching is preferred when direct scanning
of files is slow.
Note that prefetching or caching isn't that useful in the Parallel task.

|Property|Description|Default|
|--------|-----------|-------|
|type|This should be `hdfs`.|none (required)|
|paths|HDFS paths. Can be either a JSON array or comma-separated string of paths. Wildcards like `*` are supported in these paths.|none (required)|
|maxCacheCapacityBytes|Maximum size of the cache space in bytes. 0 means disabling cache. Cached files are not removed until the ingestion task completes.|1073741824|
|maxFetchCapacityBytes|Maximum size of the fetch space in bytes. 0 means disabling prefetch. Prefetched files are removed immediately once they are read.|1073741824|
|prefetchTriggerBytes|Threshold to trigger prefetching files.|maxFetchCapacityBytes / 2|
|fetchTimeout|Timeout for fetching each file.|60000|
|maxFetchRetry|Maximum number of retries for fetching each file.|3|

You can also ingest from other storage using the HDFS firehose if the HDFS client supports that storage.
However, if you want to ingest from cloud storage, consider using the service-specific input source for your data storage.
If you want to use a non-hdfs protocol with the HDFS firehose, you need to include the protocol you want
in `druid.ingestion.hdfs.allowedProtocols`. See [HDFS firehose security configuration](../configuration/index.md#hdfs-input-source) for more details.

### LocalFirehose

This Firehose can be used to read the data from files on local disk, and is mainly intended for proof-of-concept testing, and works with `string` typed parsers.
This Firehose is _splittable_ and can be used by [native parallel index tasks](native-batch.md#parallel-task).
Since each split represents a file in this Firehose, each worker task of `index_parallel` will read a file.
A sample local Firehose spec is shown below:

```json
{
    "type": "local",
    "filter" : "*.csv",
    "baseDir": "/data/directory"
}
```

|property|description|required?|
|--------|-----------|---------|
|type|This should be "local".|yes|
|filter|A wildcard filter for files. See [here](http://commons.apache.org/proper/commons-io/apidocs/org/apache/commons/io/filefilter/WildcardFileFilter) for more information.|yes|
|baseDir|directory to search recursively for files to be ingested. |yes|

<a name="http-firehose"></a>

### HttpFirehose

This Firehose can be used to read the data from remote sites via HTTP, and works with `string` typed parsers.
This Firehose is _splittable_ and can be used by [native parallel index tasks](native-batch.md#parallel-task).
Since each split represents a file in this Firehose, each worker task of `index_parallel` will read a file.
A sample HTTP Firehose spec is shown below:

```json
{
    "type": "http",
    "uris": ["http://example.com/uri1", "http://example2.com/uri2"]
}
```

You can only use protocols listed in the `druid.ingestion.http.allowedProtocols` property as HTTP firehose input sources.
The `http` and `https` protocols are allowed by default. See [HTTP firehose security configuration](../configuration/index.md#http-input-source) for more details.

The below configurations can be optionally used if the URIs specified in the spec require a Basic Authentication Header.
Omitting these fields from your spec will result in HTTP requests with no Basic Authentication Header.

|property|description|default|
|--------|-----------|-------|
|httpAuthenticationUsername|Username to use for authentication with specified URIs|None|
|httpAuthenticationPassword|PasswordProvider to use with specified URIs|None|

Example with authentication fields using the DefaultPassword provider (this requires the password to be in the ingestion spec):

```json
{
    "type": "http",
    "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
    "httpAuthenticationUsername": "username",
    "httpAuthenticationPassword": "password123"
}
```

You can also use the other existing Druid PasswordProviders. Here is an example using the EnvironmentVariablePasswordProvider:

```json
{
    "type": "http",
    "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
    "httpAuthenticationUsername": "username",
    "httpAuthenticationPassword": {
        "type": "environment",
        "variable": "HTTP_FIREHOSE_PW"
    }
}
```

The below configurations can optionally be used for tuning the Firehose performance.
Note that prefetching or caching isn't that useful in the Parallel task.

|property|description|default|
|--------|-----------|-------|
|maxCacheCapacityBytes|Maximum size of the cache space in bytes. 0 means disabling cache. Cached files are not removed until the ingestion task completes.|1073741824|
|maxFetchCapacityBytes|Maximum size of the fetch space in bytes. 0 means disabling prefetch. Prefetched files are removed immediately once they are read.|1073741824|
|prefetchTriggerBytes|Threshold to trigger prefetching HTTP objects.|maxFetchCapacityBytes / 2|
|fetchTimeout|Timeout for fetching an HTTP object.|60000|
|maxFetchRetry|Maximum retries for fetching an HTTP object.|3|

<a name="segment-firehose"></a>

### IngestSegmentFirehose

This Firehose can be used to read the data from existing druid segments, potentially using a new schema and changing the name, dimensions, metrics, rollup, etc. of the segment.
This Firehose is _splittable_ and can be used by [native parallel index tasks](native-batch.md#parallel-task).
This firehose will accept any type of parser, but will only utilize the list of dimensions and the timestamp specification.
 A sample ingest Firehose spec is shown below:

```json
{
    "type": "ingestSegment",
    "dataSource": "wikipedia",
    "interval": "2013-01-01/2013-01-02"
}
```

|property|description|required?|
|--------|-----------|---------|
|type|This should be "ingestSegment".|yes|
|dataSource|A String defining the data source to fetch rows from, very similar to a table in a relational database|yes|
|interval|A String representing the ISO-8601 interval. This defines the time range to fetch the data over.|yes|
|dimensions|The list of dimensions to select. If left empty, no dimensions are returned. If left null or not defined, all dimensions are returned. |no|
|metrics|The list of metrics to select. If left empty, no metrics are returned. If left null or not defined, all metrics are selected.|no|
|filter| See [Filters](../querying/filters.md)|no|
|maxInputSegmentBytesPerTask|Deprecated. Use [Segments Split Hint Spec](#segments-split-hint-spec) instead. When used with the native parallel index task, the maximum number of bytes of input segments to process in a single task. If a single segment is larger than this number, it will be processed by itself in a single task (input segments are never split across tasks). Defaults to 150MB.|no|

<a name="sql-firehose"></a>

### SqlFirehose

This Firehose can be used to ingest events residing in an RDBMS. The database connection information is provided as part of the ingestion spec.
For each query, the results are fetched locally and indexed.
If there are multiple queries from which data needs to be indexed, queries are prefetched in the background, up to `maxFetchCapacityBytes` bytes.
This Firehose is _splittable_ and can be used by [native parallel index tasks](native-batch.md#parallel-task).
This firehose will accept any type of parser, but will only utilize the list of dimensions and the timestamp specification. See the extension documentation for more detailed ingestion examples.

Requires one of the following extensions:
 * [MySQL Metadata Store](../development/extensions-core/mysql.md).
 * [PostgreSQL Metadata Store](../development/extensions-core/postgresql.md).


```json
{
    "type": "sql",
    "database": {
        "type": "mysql",
        "connectorConfig": {
            "connectURI": "jdbc:mysql://host:port/schema",
            "user": "user",
            "password": "password"
        }
     },
    "sqls": ["SELECT * FROM table1", "SELECT * FROM table2"]
}
```

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|This should be "sql".||Yes|
|database|Specifies the database connection details. The database type corresponds to the extension that supplies the `connectorConfig` support. The specified extension must be loaded into Druid:<br/><br/><ul><li>[mysql-metadata-storage](../development/extensions-core/mysql.md) for `mysql`</li><li> [postgresql-metadata-storage](../development/extensions-core/postgresql.md) extension for `postgresql`.</li></ul><br/><br/>You can selectively allow JDBC properties in `connectURI`. See [JDBC connections security config](../configuration/index.md#jdbc-connections-to-external-databases) for more details.||Yes|
|maxCacheCapacityBytes|Maximum size of the cache space in bytes. 0 means disabling cache. Cached files are not removed until the ingestion task completes.|1073741824|No|
|maxFetchCapacityBytes|Maximum size of the fetch space in bytes. 0 means disabling prefetch. Prefetched files are removed immediately once they are read.|1073741824|No|
|prefetchTriggerBytes|Threshold to trigger prefetching SQL result objects.|maxFetchCapacityBytes / 2|No|
|fetchTimeout|Timeout for fetching the result set.|60000|No|
|foldCase|Toggle case folding of database column names. This may be enabled in cases where the database returns case insensitive column names in query results.|false|No|
|sqls|List of SQL queries where each SQL query would retrieve the data to be indexed.||Yes|

#### Database

|property|description|default|required?|
|--------|-----------|-------|---------|
|type|The type of database to query. Valid values are `mysql` and `postgresql`_||Yes|
|connectorConfig|Specify the database connection properties via `connectURI`, `user` and `password`||Yes|

### InlineFirehose

This Firehose can be used to read the data inlined in its own spec.
It can be used for demos or for quickly testing out parsing and schema, and works with `string` typed parsers.
A sample inline Firehose spec is shown below:

```json
{
    "type": "inline",
    "data": "0,values,formatted\n1,as,CSV"
}
```

|property|description|required?|
|--------|-----------|---------|
|type|This should be "inline".|yes|
|data|Inlined data to ingest.|yes|

### CombiningFirehose

This Firehose can be used to combine and merge data from a list of different Firehoses.

```json
{
    "type": "combining",
    "delegates": [ { firehose1 }, { firehose2 }, ... ]
}
```

|property|description|required?|
|--------|-----------|---------|
|type|This should be "combining"|yes|
|delegates|List of Firehoses to combine data from|yes|



## 本地批摄入

Apache Druid当前支持两种类型的本地批量索引任务， `index_parallel` 可以并行的运行多个任务， `index`运行单个索引任务。 详情可以查看 [基于Hadoop的摄取vs基于本地批摄取的对比](ingestion.md#批量摄取) 来了解基于Hadoop的摄取、本地简单批摄取、本地并行摄取三者的比较。

要运行这两种类型的本地批索引任务，请按以下指定编写摄取规范。然后将其发布到Overlord的 `/druid/indexer/v1/task` 接口，或者使用druid附带的 `bin/post-index-task`。

### 教程

此页包含本地批处理摄取的参考文档。相反，如果要进行演示，请查看 [加载文件教程](../GettingStarted/chapter-1.md)，该教程演示了"简单"（单任务）模式

### 并行任务

并行任务（`index_parallel`类型）是用于并行批索引的任务。此任务只使用Druid的资源，不依赖于其他外部系统，如Hadoop。`index_parallel` 任务是一个supervisor任务，它协调整个索引过程。supervisor分割输入数据并创建辅助任务来处理这些分割, 创建的worker将发布给Overlord，以便在MiddleManager或Indexer上安排和运行。一旦worker成功处理分配的输入拆分，它就会将生成的段列表报告给supervisor任务。supervisor定期检查工作任务的状态。如果其中一个失败，它将重试失败的任务，直到重试次数达到配置的限制。如果所有工作任务都成功，它将立即发布报告的段并完成摄取。

并行任务的详细行为是不同的，取决于 [`partitionsSpec`](#partitionsspec)，详情可以查看 `partitionsSpec`

要使用此任务，`ioConfig` 中的 [`inputSource`](#输入源) 应为*splittable(可拆分的)*，`tuningConfig` 中的 `maxNumConcurrentSubTasks` 应设置为大于1。否则，此任务将按顺序运行；`index_parallel` 任务将逐个读取每个输入文件并自行创建段。目前支持的可拆分输入格式有：

* [`s3`](#s3%e8%be%93%e5%85%a5%e6%ba%90) 从AWS S3存储读取数据
* [`gs`](#谷歌云存储输入源) 从谷歌云存储读取数据
* [`azure`](#azure%e8%be%93%e5%85%a5%e6%ba%90) 从Azure Blob存储读取数据
* [`hdfs`](#hdfs%e8%be%93%e5%85%a5%e6%ba%90) 从HDFS存储中读取数据
* [`http`](#HTTP输入源) 从HTTP服务中读取数据
* [`local`](#local%e8%be%93%e5%85%a5%e6%ba%90) 从本地存储中读取数据
* [`druid`](#druid%e8%be%93%e5%85%a5%e6%ba%90) 从Druid数据源中读取数据

传统的 [`firehose`](#firehoses%e5%b7%b2%e5%ba%9f%e5%bc%83) 支持其他一些云存储类型。下面的 `firehose` 类型也是可拆分的。请注意，`firehose` 只支持文本格式。

* [`static-cloudfiles`](../development/rackspacecloudfiles.md)

您可能需要考虑以下事项：
* 您可能希望控制每个worker进程的输入数据量。这可以使用不同的配置进行控制，具体取决于并行摄取的阶段（有关更多详细信息，请参阅 [`partitionsSpec`](#partitionsspec)。对于从 `inputSource` 读取数据的任务，可以在 `tuningConfig` 中设置 [分割提示规范](#分割提示规范)。对于合并无序段的任务，可以在 `tuningConfig` 中设置`totalNumMergeTasks`。
* 并行摄取中并发worker的数量由 `tuningConfig` 中的`maxNumConcurrentSubTasks` 确定。supervisor检查当前正在运行的worker的数量，如果小于 `maxNumConcurrentSubTasks`，则无论当前有多少任务槽可用，都会创建更多的worker。这可能会影响其他摄取性能。有关更多详细信息，请参阅下面的 [容量规划部分](#容量规划)。
* 默认情况下，批量摄取将替换它写入的任何段中的所有数据（在`granularitySpec` 的间隔中）。如果您想添加到段中，请在 `ioConfig` 中设置 `appendToExisting` 标志。请注意，它只替换主动添加数据的段中的数据：如果 `granularitySpec` 的间隔中有段没有此任务写入的数据，则它们将被单独保留。如果任何现有段与 `granularitySpec` 的间隔部分重叠，则新段间隔之外的那些段的部分仍将可见。

#### 任务符号

一个简易的任务如下所示：

```json
{
  "type": "index_parallel",
  "spec": {
    "dataSchema": {
      "dataSource": "wikipedia_parallel_index_test",
      "timestampSpec": {
        "column": "timestamp"
      },
      "dimensionsSpec": {
        "dimensions": [
          "page",
          "language",
          "user",
          "unpatrolled",
          "newPage",
          "robot",
          "anonymous",
          "namespace",
          "continent",
          "country",
          "region",
          "city"
        ]
      },
      "metricsSpec": [
        {
          "type": "count",
              "name": "count"
            },
            {
              "type": "doubleSum",
              "name": "added",
              "fieldName": "added"
            },
            {
              "type": "doubleSum",
              "name": "deleted",
              "fieldName": "deleted"
            },
            {
              "type": "doubleSum",
              "name": "delta",
              "fieldName": "delta"
            }
        ],
        "granularitySpec": {
          "segmentGranularity": "DAY",
          "queryGranularity": "second",
          "intervals" : [ "2013-08-31/2013-09-02" ]
        }
    },
    "ioConfig": {
        "type": "index_parallel",
        "inputSource": {
          "type": "local",
          "baseDir": "examples/indexing/",
          "filter": "wikipedia_index_data*"
        },
        "inputFormat": {
          "type": "json"
        }
    },
    "tuningconfig": {
        "type": "index_parallel",
        "maxNumConcurrentSubTasks": 2
    }
  }
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 任务类型，应当总是 `index_parallel` | 是 |
| `id` | 任务ID。 如果该项没有显式的指定，Druid将使用任务类型、数据源名称、时间间隔、日期时间戳生成一个任务ID | 否 |
| `spec` | 摄取规范包括数据schema、IOConfig 和 TuningConfig。详情见下边详细描述 | 是 |
| `context` | Context包括了多个任务配置参数。详情见下边详细描述 | 否 |

##### `dataSchema`

该字段为必须字段。

可以参见 [摄取规范中的dataSchema](ingestion.md#dataSchema)

如果在dataSchema的 `granularitySpec` 中显式地指定了 `intervals`，则批处理摄取将锁定启动时指定的完整间隔，并且您将快速了解指定间隔是否与其他任务（例如Kafka摄取）持有的锁重叠。否则，在发现每个间隔时，批处理摄取将锁定该间隔，因此您可能只会在摄取过程中了解到该任务与较高优先级的任务重叠。如果显式指定 `intervals`，则指定间隔之外的任何行都将被丢弃。如果您知道数据的时间范围，我们建议显式地设置`intervals`，以便锁定失败发生得更快，并且如果有一些带有意外时间戳的杂散数据，您不会意外地替换该范围之外的数据。

##### `ioConfig`

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型， 应当总是  `index_parallel` | none | 是 |
| `inputFormat` | [`inputFormat`](dataformats.md#InputFormat) 用来指定如何解析输入数据 | none | 是 |
| `appendToExisting` | 创建段作为最新版本的附加分片，有效地附加到段集而不是替换它。仅当现有段集具有可扩展类型 `shardSpec`时，此操作才有效。 | false | 否 |

##### `tuningConfig`

tuningConfig是一个可选项，如果未指定则使用默认的参数。 详情如下：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型，应当总是 `index_parallel` | none | 是 |
| `maxRowsPerSegment` | 已废弃。使用 `partitionsSpec` 替代，被用来分片。 决定在每个段中有多少行。 | 5000000 | 否 |
| `maxRowsInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常用户不需要设置此值，但根据数据的性质，如果行的字节数较短，则用户可能不希望在内存中存储一百万行，应设置此值。 | 1000000 | 否 |
| `maxBytesInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常这是在内部计算的，用户不需要设置它。此值表示在持久化之前要在堆内存中聚合的字节数。这是基于对内存使用量的粗略估计，而不是实际使用量。用于索引的最大堆内存使用量为 `maxBytesInMemory *（2 + maxPendingResistent）` | 最大JVM内存的1/6 | 否 |
| `maxTotalRows` | 已废弃。使用 `partitionsSpec` 替代。等待推送的段中的总行数。用于确定何时应进行中间推送。| 20000000 | 否 |
| `numShards` | 已废弃。使用 `partitionsSpec` 替代。当使用 `hashed` `partitionsSpec`时直接指定要创建的分片数。如果该值被指定了且在 `granularitySpec`中指定了 `intervals`，那么索引任务可以跳过确定间隔/分区传递数据。如果设置了 `maxRowsPerSegment`，则无法指定 `numShards`。 | null | 否 |
| `splitHintSpec` | 用于提供提示以控制每个第一阶段任务读取的数据量。根据输入源的实现，可以忽略此提示。有关更多详细信息，请参见 [分割提示规范](#分割提示规范)。 | 基于大小的分割提示规范 | 否 |
| `partitionsSpec` | 定义在每个时间块中如何分区数据。 参见 [partitionsSpec](#partitionsspec) | 如果 `forceGuaranteedRollup` = false, 则为 `dynamic`; 如果 `forceGuaranteedRollup` = true, 则为 `hashed` 或者 `single_dim` | 否 |
| `indexSpec` | 定义段在索引阶段的存储格式相关选项，参见 [IndexSpec](ingestion.md#tuningConfig) | null | 否 |
| `indexSpecForIntermediatePersists` | 定义要在索引时用于中间持久化临时段的段存储格式选项。这可用于禁用中间段上的维度/度量压缩，以减少最终合并所需的内存。但是，在中间段上禁用压缩可能会增加页缓存的使用，而在它们被合并到发布的最终段之前使用它们，有关可能的值，请参阅 [IndexSpec](ingestion.md#tuningConfig)。 | 与 `indexSpec` 相同 | 否 |
| `maxPendingPersists` | 可挂起但未启动的最大持久化任务数。如果新的中间持久化将超过此限制，则在当前运行的持久化完成之前，摄取将被阻止。使用`maxRowsInMemory * (2 + maxPendingResistents)` 索引扩展的最大堆内存使用量。 | 0 (这意味着一个持久化任务只可以与摄取同时运行，而没有一个可以排队) | 否 |
| `forceGuaranteedRollup` | 强制保证 [最佳Rollup](ingestion.md#Rollup)。最佳rollup优化了生成的段的总大小和查询时间，同时索引时间将增加。如果设置为true，则必须设置 `granularitySpec` 中的 `intervals` ，同时必须对 `partitionsSpec` 使用 `single_dim` 或者 `hashed` 。此标志不能与 `IOConfig` 的 `appendToExisting` 一起使用。有关更多详细信息，请参见下面的 ["分段推送模式"](#分段推送模式) 部分。 | false | 否 |
| `reportParseExceptions` | 如果为true，则将引发解析期间遇到的异常并停止摄取；如果为false，则将跳过不可解析的行和字段。 | false | 否 |
| `pushTimeout` | 段推送的超时毫秒时间。 该值必须设置为 >= 0, 0意味着永不超时 | 0 | 否 |
| `segmentWriteOutMediumFactory` | 创建段时使用的段写入介质。 参见 [segmentWriteOutMediumFactory](#segmentWriteOutMediumFactory) | 未指定， 值来源于 `druid.peon.defaultSegmentWriteOutMediumFactory.type` | 否 |
| `maxNumConcurrentSubTasks` | 可同时并行运行的最大worker数。无论当前可用的任务槽如何，supervisor都将生成最多为 `maxNumConcurrentSubTasks` 的worker。如果此值设置为1，supervisor将自行处理数据摄取，而不是生成worker。如果将此值设置为太大，则可能会创建太多的worker，这可能会阻止其他摄取。查看 [容量规划](#容量规划) 以了解更多详细信息。 | 1 | 否 |
| `maxRetry` | 任务失败后最大重试次数 | 3 | 否 |
| `maxNumSegmentsToMerge` | 单个任务在第二阶段可同时合并的段数的最大限制。仅在 `forceGuaranteedRollup` 被设置的时候使用。 | 100 | 否 |
| `totalNumMergeTasks` | 当 `partitionsSpec` 被设置为 `hashed` 或者 `single_dim`时， 在合并阶段用来合并段的最大任务数。 | 10 | 否 |
| `taskStatusCheckPeriodMs` | 检查运行任务状态的轮询周期（毫秒）。| 1000 | 否 |
| `chatHandlerTimeout` | 报告worker中的推送段超时。| PT10S | 否 |
| `chatHandlerNumRetries` | 重试报告worker中的推送段 | 5 | 否 |

#### 分割提示规范

分割提示规范用于在supervisor创建输入分割时给出提示。请注意，每个worker处理一个输入拆分。您可以控制每个worker在第一阶段读取的数据量。

**基于大小的分割提示规范**
除HTTP输入源外，所有可拆分输入源都遵循基于大小的拆分提示规范。

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应当总是 `maxSize` | none | 是 |
| `maxSplitSize` | 单个任务中要处理的输入文件的最大字节数。如果单个文件大于此数字，则它将在单个任务中自行处理（文件永远不会跨任务拆分）。 | 500MB | 否 |

**段分割提示规范**

段分割提示规范仅仅用在 [`DruidInputSource`](#Druid输入源)(和过时的 [`IngestSegmentFirehose`](#IngestSegmentFirehose))

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应当总是 `segments` | none | 是 |
| `maxInputSegmentBytesPerTask` | 单个任务中要处理的输入段的最大字节数。如果单个段大于此数字，则它将在单个任务中自行处理（输入段永远不会跨任务拆分）。 | 500MB | 否 |

##### `partitionsSpec`

PartitionsSpec用于描述辅助分区方法。您应该根据需要的rollup模式使用不同的partitionsSpec。为了实现 [最佳rollup](ingestion.md#rollup)，您应该使用 `hashed`（基于每行中维度的哈希进行分区）或 `single_dim`（基于单个维度的范围）。对于"尽可能rollup"模式，应使用 `dynamic`。

三种 `partitionsSpec` 类型有着不同的特征。

| PartitionsSpec | 摄入速度 | 分区方式 | 支持的rollup模式 | 查询时的段修剪 |
|-|-|-|-|-|
| `dynamic` | 最快 | 基于段中的行数来进行分区 | 尽可能rollup | N/A |
| `hashed` | 中等 | 基于分区维度的哈希值进行分区。此分区可以通过改进数据位置性来减少数据源大小和查询延迟。有关详细信息，请参见 [分区](ingestion.md#分区)。 | 最佳rollup | N/A |
| `single_dim` | 最慢 | 基于分区维度值的范围分区。段大小可能会根据分区键分布而倾斜。这可能通过改善数据位置性来减少数据源大小和查询延迟。有关详细信息，请参见 [分区](ingestion.md#分区)。 | 最佳rollup | Broker可以使用分区信息提前修剪段以加快查询速度。由于Broker知道每个段中 `partitionDimension` 值的范围，因此，给定一个包含`partitionDimension` 上的筛选器的查询，Broker只选取包含满足 `partitionDimension` 上的筛选器的行的段进行查询处理。|

对于每一种partitionSpec，推荐的使用场景是：

* 如果数据有一个在查询中经常使用的均匀分布列，请考虑使用 `single_dim` partitionsSpec来最大限度地提高大多数查询的性能。
* 如果您的数据不是均匀分布的列，但在使用某些维度进行rollup时，需要具有较高的rollup汇总率，请考虑使用 `hashed` partitionsSpec。通过改善数据的局部性，可以减小数据源的大小和查询延迟。
* 如果以上两个场景不是这样，或者您不需要rollup数据源，请考虑使用 `dynamic` partitionsSpec。

**Dynamic分区**

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `dynamic` | none | 是 |
| `maxRowsPerSegment` | 用来分片。决定在每一个段中有多少行 | 5000000 | 否 |
| `maxTotalRows` | 等待推送的所有段的总行数。用于确定中间段推送的发生时间。 | 20000000 | 否 |

使用Dynamic分区，并行索引任务在一个阶段中运行：它将生成多个worker(`single_phase_sub_task` 类型)，每个worker都创建段。worker创建段的方式是：

* 每当当前段中的行数超过 `maxRowsPerSegment` 时，任务将创建一个新段。
* 一旦所有时间块中所有段中的行总数达到 `maxTotalRows`，任务就会将迄今为止创建的所有段推送到深层存储并创建新段。

**基于哈希的分区**

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `hashed` | none | 是 |
| `numShards` | 直接指定要创建的分片数。如果该值被指定了，同时在 `granularitySpec` 中指定了 `intervals`，那么索引任务可以跳过确定通过数据的间隔/分区 | null | 是 |
| `partitionDimensions` | 要分区的维度。留空可选择所有维度。| null | 否 |

基于哈希分区的并行任务类似于 [MapReduce](https://en.wikipedia.org/wiki/MapReduce)。任务分为两个阶段运行，即 `部分段生成` 和 `部分段合并`。

* 在 `部分段生成` 阶段，与MapReduce中的Map阶段一样，并行任务根据分割提示规范分割输入数据，并将每个分割分配给一个worker。每个worker（`partial_index_generate` 类型）从 `granularitySpec` 中的`segmentGranularity（主分区键）` 读取分配的分割，然后按`partitionsSpec` 中 `partitionDimensions（辅助分区键）`的哈希值对行进行分区。分区数据存储在 [MiddleManager](../design/MiddleManager.md) 或 [Indexer](../design/Indexer.md) 的本地存储中。
* `部分段合并` 阶段类似于MapReduce中的Reduce阶段。并行任务生成一组新的worker（`partial_index_merge` 类型）来合并在前一阶段创建的分区数据。这里，分区数据根据要合并的时间块和分区维度的散列值进行洗牌；每个worker从多个MiddleManager/Indexer进程中读取落在同一时间块和同一散列值中的数据，并将其合并以创建最终段。最后，它们将最后的段一次推送到深层存储。

**基于单一维度范围分区**

> [!WARNING]
> 在并行任务的顺序模式下，当前不支持单一维度范围分区。尝试将`maxNumConcurrentSubTasks` 设置为大于1以使用此分区方式。

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `single_dim` | none | 是 |
| `partitionDimension` | 要分区的维度。 仅仅允许具有单一维度值的行 | none | 是 |
| `targetRowsPerSegment` | 在一个分区中包含的目标行数，应当是一个500MB ~ 1GB目标段的数值。 | none | 要么该值被设置，或者 `maxRowsPerSegment`被设置。 |
| `maxRowsPerSegment` | 分区中要包含的行数的软最大值。| none | 要么该值被设置，或者 `targetRowsPerSegment`被设置。|
| `assumeGrouped` | 假设输入数据已经按时间和维度分组。摄取将运行得更快，但如果违反此假设，则可能会选择次优分区 | false | 否 |

在 `single-dim` 分区下，并行任务分为3个阶段进行，即 `部分维分布`、`部分段生成` 和 `部分段合并`。第一个阶段是收集一些统计数据以找到最佳分区，另外两个阶段是创建部分段并分别合并它们，就像在基于哈希的分区中那样。

* 在 `部分维度分布` 阶段，并行任务分割输入数据，并根据分割提示规范将其分配给worker。每个worker任务（`partial_dimension_distribution` 类型）读取分配的分割并为 `partitionDimension` 构建直方图。并行任务从worker任务收集这些直方图，并根据 `partitionDimension` 找到最佳范围分区，以便在分区之间均匀分布行。请注意，`targetRowsPerSegment` 或 `maxRowsPerSegment` 将用于查找最佳分区。
* 在 `部分段生成` 阶段，并行任务生成新的worker任务（`partial_range_index_generate` 类型）以创建分区数据。每个worker任务都读取在前一阶段中创建的分割，根据 `granularitySpec` 中的`segmentGranularity（主分区键）`的时间块对行进行分区，然后根据在前一阶段中找到的范围分区对行进行分区。分区数据存储在 [MiddleManager](../design/MiddleManager.md) 或 [Indexer](../design/Indexer.md)的本地存储中。
* 在 `部分段合并` 阶段，并行索引任务生成一组新的worker任务（`partial_index_generic_merge`类型）来合并在上一阶段创建的分区数据。这里，分区数据根据时间块和 `partitionDimension` 的值进行洗牌；每个工作任务从多个MiddleManager/Indexer进程中读取属于同一范围的同一分区中的段，并将它们合并以创建最后的段。最后，它们将最后的段推到深层存储。

> [!WARNING]
> 由于单一维度范围分区的任务在 `部分维度分布` 和 `部分段生成` 阶段对输入进行两次传递，因此如果输入在两次传递之间发生变化，任务可能会失败

#### HTTP状态接口

supervisor任务提供了一些HTTP接口来获取任务状态。

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/mode`

如果索引任务以并行的方式运行，则返回 "parallel", 否则返回 "sequential"

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/phase`

如果任务以并行的方式运行，则返回当前阶段的名称

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/progress`

如果supervisor任务以并行的方式运行，则返回当前阶段的预估进度

一个示例结果如下：
```json
{
  "running":10,
  "succeeded":0,
  "failed":0,
  "complete":0,
  "total":10,
  "estimatedExpectedSucceeded":10
}
```

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtasks/running`

返回正在运行的worker任务的任务IDs，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs`

返回所有的worker任务规范，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs/running`

返回正在运行的worker任务规范，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspecs/complete`

返回已经完成的worker任务规范，如果该supervisor任务以序列模式运行则返回一个空的列表

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}`

返回指定ID的worker任务规范，如果该supervisor任务以序列模式运行则返回一个HTTP 404

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}/state`

返回指定ID的worker任务规范的状态，如果该supervisor任务以序列模式运行则返回一个HTTP 404。 返回的结果集中包括worker任务规范，当前任务状态(如果存在的话) 以及任务尝试历史记录。

一个示例结果如下：
```json
{
  "spec": {
    "id": "index_parallel_lineitem_2018-04-20T22:12:43.610Z_2",
    "groupId": "index_parallel_lineitem_2018-04-20T22:12:43.610Z",
    "supervisorTaskId": "index_parallel_lineitem_2018-04-20T22:12:43.610Z",
    "context": null,
    "inputSplit": {
      "split": "/path/to/data/lineitem.tbl.5"
    },
    "ingestionSpec": {
      "dataSchema": {
        "dataSource": "lineitem",
        "timestampSpec": {
          "column": "l_shipdate",
          "format": "yyyy-MM-dd"
        },
        "dimensionsSpec": {
          "dimensions": [
            "l_orderkey",
            "l_partkey",
            "l_suppkey",
            "l_linenumber",
            "l_returnflag",
            "l_linestatus",
            "l_shipdate",
            "l_commitdate",
            "l_receiptdate",
            "l_shipinstruct",
            "l_shipmode",
            "l_comment"
          ]
        },
        "metricsSpec": [
          {
            "type": "count",
            "name": "count"
          },
          {
            "type": "longSum",
            "name": "l_quantity",
            "fieldName": "l_quantity",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_extendedprice",
            "fieldName": "l_extendedprice",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_discount",
            "fieldName": "l_discount",
            "expression": null
          },
          {
            "type": "doubleSum",
            "name": "l_tax",
            "fieldName": "l_tax",
            "expression": null
          }
        ],
        "granularitySpec": {
          "type": "uniform",
          "segmentGranularity": "YEAR",
          "queryGranularity": {
            "type": "none"
          },
          "rollup": true,
          "intervals": [
            "1980-01-01T00:00:00.000Z/2020-01-01T00:00:00.000Z"
          ]
        },
        "transformSpec": {
          "filter": null,
          "transforms": []
        }
      },
      "ioConfig": {
        "type": "index_parallel",
        "inputSource": {
          "type": "local",
          "baseDir": "/path/to/data/",
          "filter": "lineitem.tbl.5"
        },
        "inputFormat": {
          "format": "tsv",
          "delimiter": "|",
          "columns": [
            "l_orderkey",
            "l_partkey",
            "l_suppkey",
            "l_linenumber",
            "l_quantity",
            "l_extendedprice",
            "l_discount",
            "l_tax",
            "l_returnflag",
            "l_linestatus",
            "l_shipdate",
            "l_commitdate",
            "l_receiptdate",
            "l_shipinstruct",
            "l_shipmode",
            "l_comment"
          ]
        },
        "appendToExisting": false
      },
      "tuningConfig": {
        "type": "index_parallel",
        "maxRowsPerSegment": 5000000,
        "maxRowsInMemory": 1000000,
        "maxTotalRows": 20000000,
        "numShards": null,
        "indexSpec": {
          "bitmap": {
            "type": "roaring"
          },
          "dimensionCompression": "lz4",
          "metricCompression": "lz4",
          "longEncoding": "longs"
        },
        "indexSpecForIntermediatePersists": {
          "bitmap": {
            "type": "roaring"
          },
          "dimensionCompression": "lz4",
          "metricCompression": "lz4",
          "longEncoding": "longs"
        },
        "maxPendingPersists": 0,
        "reportParseExceptions": false,
        "pushTimeout": 0,
        "segmentWriteOutMediumFactory": null,
        "maxNumConcurrentSubTasks": 4,
        "maxRetry": 3,
        "taskStatusCheckPeriodMs": 1000,
        "chatHandlerTimeout": "PT10S",
        "chatHandlerNumRetries": 5,
        "logParseExceptions": false,
        "maxParseExceptions": 2147483647,
        "maxSavedParseExceptions": 0,
        "forceGuaranteedRollup": false,
        "buildV9Directly": true
      }
    }
  },
  "currentStatus": {
    "id": "index_sub_lineitem_2018-04-20T22:16:29.922Z",
    "type": "index_sub",
    "createdTime": "2018-04-20T22:16:29.925Z",
    "queueInsertionTime": "2018-04-20T22:16:29.929Z",
    "statusCode": "RUNNING",
    "duration": -1,
    "location": {
      "host": null,
      "port": -1,
      "tlsPort": -1
    },
    "dataSource": "lineitem",
    "errorMsg": null
  },
  "taskHistory": []
}
```

* `http://{PEON_IP}:{PEON_PORT}/druid/worker/v1/chat/{SUPERVISOR_TASK_ID}/subtaskspec/{SUB_TASK_SPEC_ID}/history
  `

返回被指定ID的worker任务规范的任务尝试历史记录，如果该supervisor任务以序列模式运行则返回一个HTTP 404

#### 容量规划

不管当前有多少任务槽可用，supervisor任务最多可以创建 `maxNumConcurrentSubTasks` worker任务, 因此，可以同时运行的任务总数为 `(maxNumConcurrentSubTasks+1)(包括supervisor任务)`。请注意，这甚至可以大于任务槽的总数（所有worker的容量之和）。如果`maxNumConcurrentSubTasks` 大于 `n（可用任务槽）`，则`maxNumConcurrentSubTasks` 任务由supervisor任务创建，但只有 `n` 个任务将启动, 其他人将在挂起状态下等待，直到任何正在运行的任务完成。

如果将并行索引任务与流摄取一起使用，我们建议**限制批摄取的最大容量**，以防止流摄取被批摄取阻止。假设您同时有 `t` 个并行索引任务要运行， 但是想将批摄取的最大任务数限制在 `b`。 那么， 所有并行索引任务的 `maxNumConcurrentSubTasks` 之和 + `t`(supervisor任务数) 必须小于 `b`。

如果某些任务的优先级高于其他任务，则可以将其`maxNumConcurrentSubTasks` 设置为高于低优先级任务的值。这可能有助于高优先级任务比低优先级任务提前完成，方法是为它们分配更多的任务槽。

### 简单任务

简单任务（`index`类型）设计用于较小的数据集。任务在索引服务中执行。

#### 任务符号

一个示例任务如下：

```json
{
  "type" : "index",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "timestampSpec" : {
        "column" : "timestamp",
        "format" : "auto"
      },
      "dimensionsSpec" : {
        "dimensions": ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"],
        "dimensionExclusions" : []
      },
      "metricsSpec" : [
        {
          "type" : "count",
          "name" : "count"
        },
        {
          "type" : "doubleSum",
          "name" : "added",
          "fieldName" : "added"
        },
        {
          "type" : "doubleSum",
          "name" : "deleted",
          "fieldName" : "deleted"
        },
        {
          "type" : "doubleSum",
          "name" : "delta",
          "fieldName" : "delta"
        }
      ],
      "granularitySpec" : {
        "type" : "uniform",
        "segmentGranularity" : "DAY",
        "queryGranularity" : "NONE",
        "intervals" : [ "2013-08-31/2013-09-01" ]
      }
    },
    "ioConfig" : {
      "type" : "index",
      "inputSource" : {
        "type" : "local",
        "baseDir" : "examples/indexing/",
        "filter" : "wikipedia_data.json"
       },
       "inputFormat": {
         "type": "json"
       }
    },
    "tuningConfig" : {
      "type" : "index",
      "maxRowsPerSegment" : 5000000,
      "maxRowsInMemory" : 1000000
    }
  }
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 任务类型， 应该总是 `index` | 是 |
| `id` | 任务ID。如果该值为显式的指定，Druid将会使用任务类型、数据源名称、时间间隔以及日期时间戳生成一个任务ID | 否 |
| `spec` | 摄入规范，包括dataSchema、IOConfig 和 TuningConfig。 详情见下边的描述 | 是 |
| `context` | 包含多个任务配置参数的上下文。 详情见下边的描述 | 否 |

##### `dataSchema`

**该字段为必须字段。**

详情可以见摄取文档中的 [`dataSchema`](ingestion.md#dataSchema) 部分。

如果没有在 `dataSchema` 的 `granularitySpec` 中显式指定 `intervals`，本地索引任务将对数据执行额外的传递，以确定启动时要锁定的范围。如果显式指定 `intervals`，则指定间隔之外的任何行都将被丢弃。如果您知道数据的时间范围，我们建议显式设置 `intervals`，因为它允许任务跳过额外的过程，并且如果有一些带有意外时间戳的杂散数据，您不会意外地替换该范围之外的数据。

##### `ioConfig`

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型，应该总是 `index` | none | 是 |
| `inputFormat` | [`inputFormat`](dataformats.md#InputFormat) 指定如何解析输入数据 | none | 是 |
| `appendToExisting` | 创建段作为最新版本的附加分片，有效地附加到段集而不是替换它。仅当现有段集具有可扩展类型 `shardSpec`时，此操作才有效。 | false | 否 |

##### `tuningConfig`

tuningConfig是一个可选项，如果未指定则使用默认的参数。 详情如下：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 任务类型，应当总是 `index` | none | 是 |
| `maxRowsPerSegment` | 已废弃。使用 `partitionsSpec` 替代，被用来分片。 决定在每个段中有多少行。 | 5000000 | 否 |
| `maxRowsInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常用户不需要设置此值，但根据数据的性质，如果行的字节数较短，则用户可能不希望在内存中存储一百万行，应设置此值。 | 1000000 | 否 |
| `maxBytesInMemory` | 用于确定何时应该从中间层持久化到磁盘。通常这是在内部计算的，用户不需要设置它。此值表示在持久化之前要在堆内存中聚合的字节数。这是基于对内存使用量的粗略估计，而不是实际使用量。用于索引的最大堆内存使用量为 `maxBytesInMemory *（2 + maxPendingResistent）` | 最大JVM内存的1/6 | 否 |
| `maxTotalRows` | 已废弃。使用 `partitionsSpec` 替代。等待推送的段中的总行数。用于确定何时应进行中间推送。| 20000000 | 否 |
| `numShards` | 已废弃。使用 `partitionsSpec` 替代。当使用 `hashed` `partitionsSpec`时直接指定要创建的分片数。如果该值被指定了且在 `granularitySpec`中指定了 `intervals`，那么索引任务可以跳过确定间隔/分区传递数据。如果设置了 `maxRowsPerSegment`，则无法指定 `numShards`。 | null | 否 |
| `partitionsSpec` | 定义在每个时间块中如何分区数据。 参见 [partitionsSpec](#partitionsspec) | 如果 `forceGuaranteedRollup` = false, 则为 `dynamic`; 如果 `forceGuaranteedRollup` = true, 则为 `hashed` 或者 `single_dim` | 否 |
| `indexSpec` | 定义段在索引阶段的存储格式相关选项，参见 [IndexSpec](ingestion.md#tuningConfig) | null | 否 |
| `indexSpecForIntermediatePersists` | 定义要在索引时用于中间持久化临时段的段存储格式选项。这可用于禁用中间段上的维度/度量压缩，以减少最终合并所需的内存。但是，在中间段上禁用压缩可能会增加页缓存的使用，而在它们被合并到发布的最终段之前使用它们，有关可能的值，请参阅 [IndexSpec](ingestion.md#tuningConfig)。 | 与 `indexSpec` 相同 | 否 |
| `maxPendingPersists` | 可挂起但未启动的最大持久化任务数。如果新的中间持久化将超过此限制，则在当前运行的持久化完成之前，摄取将被阻止。使用`maxRowsInMemory * (2 + maxPendingResistents)` 索引扩展的最大堆内存使用量。 | 0 (这意味着一个持久化任务只可以与摄取同时运行，而没有一个可以排队) | 否 |
| `forceGuaranteedRollup` | 强制保证 [最佳Rollup](ingestion.md#Rollup)。最佳rollup优化了生成的段的总大小和查询时间，同时索引时间将增加。如果设置为true，则必须设置 `granularitySpec` 中的 `intervals` ，同时必须对 `partitionsSpec` 使用 `single_dim` 或者 `hashed` 。此标志不能与 `IOConfig` 的 `appendToExisting` 一起使用。有关更多详细信息，请参见下面的 ["分段推送模式"](#分段推送模式) 部分。 | false | 否 |
| `reportParseExceptions` | 已废弃。如果为true，则将引发解析期间遇到的异常并停止摄取；如果为false，则将跳过不可解析的行和字段。将 `reportParseExceptions` 设置为true将覆盖`maxParseExceptions` 和 `maxSavedParseExceptions` 的现有配置，将 `maxParseExceptions` 设置为0并将 `maxSavedParseExceptions` 限制为不超过1。 | false | 否 |
| `pushTimeout` | 段推送的超时毫秒时间。 该值必须设置为 >= 0, 0意味着永不超时 | 0 | 否 |
| `segmentWriteOutMediumFactory` | 创建段时使用的段写入介质。 参见 [segmentWriteOutMediumFactory](#segmentWriteOutMediumFactory) | 未指定， 值来源于 `druid.peon.defaultSegmentWriteOutMediumFactory.type` | 否 |
| `logParseExceptions` | 如果为true，则在发生解析异常时记录错误消息，其中包含有关发生错误的行的信息。 | false | 否 |
| `maxParseExceptions` | 任务停止接收并失败之前可能发生的最大分析异常数。如果设置了`reportParseExceptions`，则该配置被覆盖。 | unlimited | 否 |
| `maxSavedParseExceptions` | 当出现解析异常时，Druid可以跟踪最新的解析异常。"maxSavedParseExceptions" 限制将保存多少个异常实例。这些保存的异常将在任务完成报告中的任务完成后可用。如果设置了 `reportParseExceptions` ，则该配置被覆盖。 | 0 | 否 |


##### `partitionsSpec`

PartitionsSpec用于描述辅助分区方法。您应该根据需要的rollup模式使用不同的partitionsSpec。为了实现 [最佳rollup](ingestion.md#rollup)，您应该使用 `hashed`（基于每行中维度的哈希进行分区）

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `hashed` | none | 是 |
| `maxRowsPerSegment` | 用在分片中，决定在每个段中有多少行 | 5000000 | 否 |
| `numShards` | 直接指定要创建的分片数。如果该值被指定了，同时在 `granularitySpec` 中指定了 `intervals`，那么索引任务可以跳过确定通过数据的间隔/分区 | null | 是 |
| `partitionDimensions` | 要分区的维度。留空可选择所有维度。| null | 否 |

对于尽可能rollup模式，您应该使用 `dynamic`

| 属性 | 描述 | 默认值 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `dynamic` | none | 是 |
| `maxRowsPerSegment` | 用来分片。决定在每一个段中有多少行 | 5000000 | 否 |
| `maxTotalRows` | 等待推送的所有段的总行数。用于确定中间段推送的发生时间。 | 20000000 | 否 |

##### `segmentWriteOutMediumFactory`

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 配置解释和可选项可以参见 [额外的Peon配置：SegmentWriteOutMediumFactory](../configuration/human-readable-byte.md#SegmentWriteOutMediumFactory) | 是 |

#### 分段推送模式

当使用简单任务摄取数据时，它从输入数据创建段并推送它们。对于分段推送，索引任务支持两种分段推送模式，分别是*批量推送模式*和*增量推送模式*，以实现 [最佳rollup和尽可能rollup](ingestion.md#rollup)。

在批量推送模式下，在索引任务的最末端推送每个段。在此之前，创建的段存储在运行索引任务的进程的内存和本地存储中。因此，此模式可能由于存储容量有限而导致问题，建议不要在生产中使用。

相反，在增量推送模式下，分段是增量推送的，即可以在索引任务的中间推送。更准确地说，索引任务收集数据并将创建的段存储在运行该任务的进程的内存和磁盘中，直到收集的行总数超过 `maxTotalRows`。一旦超过，索引任务将立即推送创建的所有段，直到此时为止，清除所有推送的段，并继续接收剩余的数据。

要启用批量推送模式，应在 `TuningConfig` 中设置`forceGuaranteedRollup`。请注意，此选项不能与 `IOConfig` 的`appendToExisting`一起使用。

### 输入源

输入源是定义索引任务读取数据的位置。只有本地并行任务和简单任务支持输入源。

#### S3输入源

> [!WARNING]
> 您需要添加 [`druid-s3-extensions`](../development/S3-compatible.md) 扩展以便使用S3输入源。

S3输入源支持直接从S3读取对象。可以通过S3 URI字符串列表或S3位置前缀列表指定对象，该列表将尝试列出内容并摄取位置中包含的所有对象。S3输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个对象。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "uris": ["s3://foo/bar/file.json", "s3://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "prefixes": ["s3://foo/bar", "s3://bar/foo"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "s3",
        "objects": [
          { "bucket": "foo", "path": "bar/file1.json"},
          { "bucket": "bar", "path": "foo/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `s3` | None | 是 |
| `uris` | 指定被摄取的S3对象位置的URI JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `prefixes` | 指定被摄取的S3对象所在的路径前缀的URI JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。 |
| `objects` | 指定被摄取的S3对象的JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `properties` | 指定用来覆盖默认S3配置的对象属性，详情见下边 | None | 否（未指定则使用默认）|

注意：只有当 `prefixes` 被指定时，S3输入源将略过空的对象。

S3对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `bucket` | S3 Bucket的名称 | None | 是 |
| `path` | 数据路径 | None | 是 |

属性对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `accessKeyId` | S3输入源访问密钥的 [Password Provider](../operations/passwordproviders.md) 或纯文本字符串 | None | 如果 `secretAccessKey` 被提供的话，则为必须 |
| `secretAccessKey` | S3输入源访问密钥的 [Password Provider](../operations/passwordproviders.md) 或纯文本字符串 | None | 如果 `accessKeyId` 被提供的话，则为必须 |

**注意**： *如果 `accessKeyId` 和 `secretAccessKey` 未被指定的话， 则将使用默认的 [S3认证](../development/S3-compatible.md#S3认证方式)*

#### 谷歌云存储输入源

> [!WARNING]
> 您需要添加 [`druid-google-extensions`](../configuration/core-ext/google-cloud-storage.md) 扩展以便使用谷歌云存储输入源。

谷歌云存储输入源支持直接从谷歌云存储读取对象，可以通过谷歌云存储URI字符串列表指定对象。谷歌云存储输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个对象。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "uris": ["gs://foo/bar/file.json", "gs://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "prefixes": ["gs://foo/bar", "gs://bar/foo"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "google",
        "objects": [
          { "bucket": "foo", "path": "bar/file1.json"},
          { "bucket": "bar", "path": "foo/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `google` | None | 是 |
| `uris` | 指定被摄取的谷歌云存储对象位置的URI JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `prefixes` | 指定被摄取的谷歌云存储对象所在的路径前缀的URI JSON数组。 以被给定的前缀开头的空对象将被略过 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。 |
| `objects` | 指定被摄取的谷歌云存储对象的JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|

注意：只有当 `prefixes` 被指定时，谷歌云存储输入源将略过空的对象。

谷歌云存储对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `bucket` | 谷歌云存储 Bucket的名称 | None | 是 |
| `path` | 数据路径 | None | 是 |

#### Azure输入源

> [!WARNING]
> 您需要添加 [`druid-azure-extensions`](../configuration/core-ext/microsoft-azure.md) 扩展以便使用Azure输入源。

Azure输入源支持直接从Azure读取对象，可以通过Azure URI字符串列表指定对象。Azure输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个对象。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "uris": ["azure://container/prefix1/file.json", "azure://container/prefix2/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "prefixes": ["azure://container/prefix1", "azure://container/prefix2"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "azure",
        "objects": [
          { "bucket": "container", "path": "prefix1/file1.json"},
          { "bucket": "container", "path": "prefix2/file2.json"}
        ]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `azure` | None | 是 |
| `uris` | 指定被摄取的azure对象位置的URI JSON数组, 格式必须为 `azure://<container>/<path-to-file>` | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|
| `prefixes` | 指定被摄取的azure对象所在的路径前缀的URI JSON数组, 格式必须为 `azure://<container>/<prefix>`, 以被给定的前缀开头的空对象将被略过 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。 |
| `objects` | 指定被摄取的azure对象的JSON数组 | None | `uris` 或者 `prefixes` 或者 `objects` 必须被设置。|

注意：只有当 `prefixes` 被指定时，azure输入源将略过空的对象。

azure对象：

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `bucket` | azure Bucket的名称 | None | 是 |
| `path` | 数据路径 | None | 是 |

#### HDFS输入源

> [!WARNING]
> 您需要添加 [`druid-hdfs-extensions`](../configuration/core-ext/hdfs.md) 扩展以便使用HDFS输入源。

HDFS输入源支持直接从HDFS存储中读取文件，文件路径可以指定为HDFS URI字符串或者HDFS URI字符串列表。HDFS输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务将读取一个或多个文件。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://foo/bar/", "hdfs://bar/foo"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": ["hdfs://foo/bar", "hdfs://bar/foo"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": "hdfs://foo/bar/file.json", "hdfs://bar/foo/file2.json"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "hdfs",
        "paths": ["hdfs://foo/bar/file.json", "hdfs://bar/foo/file2.json"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该总是 `hdfs` | None | 是 |
| `paths` | HDFS路径。可以是JSON数组或逗号分隔的路径字符串，这些路径支持类似*的通配符。给定路径之下的空文件将会被跳过。 | None | 是 |

您还可以使用HDFS输入源从云存储摄取数据。但是，如果您想从AWS S3或谷歌云存储读取数据，可以考虑使用 [S3输入源](../configuration/core-ext/s3.md) 或 [谷歌云存储输入源](../configuration/core-ext/google-cloud-storage.md)。

#### HTTP输入源

HTTP输入源支持直接通过HTTP从远程站点直接读取文件。 HTTP输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务只能读取一个文件。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"]
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

使用DefaultPassword Provider的身份验证字段示例（这要求密码位于摄取规范中）：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
        "httpAuthenticationUsername": "username",
        "httpAuthenticationPassword": "password123"
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
```

您还可以使用其他现有的Druid PasswordProvider。下面是使用EnvironmentVariablePasswordProvider的示例：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "http",
        "uris": ["http://example.com/uri1", "http://example2.com/uri2"],
        "httpAuthenticationUsername": "username",
        "httpAuthenticationPassword": {
          "type": "environment",
          "variable": "HTTP_INPUT_SOURCE_PW"
        }
      },
      "inputFormat": {
        "type": "json"
      },
      ...
    },
...
}
```

| 属性 | 描述 | 默认 | 是否必须 |
|-|-|-|-|
| `type` | 应该是 `http` | None | 是 |
| `uris` | 输入文件的uris | None | 是 |
| `httpAuthenticationUsername` | 用于指定uri的身份验证的用户名。如果规范中指定的uri需要基本身份验证头，则改属性是可选的。 | None | 否 |
| `httpAuthenticationPassword` | 用于指定uri的身份验证的密码。如果规范中指定的uri需要基本身份验证头，则改属性是可选的。 | None | 否 |

#### Inline输入源

Inline输入源可用于读取其规范内联的数据。它可用于演示或用于快速测试数据解析和schema。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "inline",
        "data": "0,values,formatted\n1,as,CSV"
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```
| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 应该是 `inline` | 是 |
| `data` | 要摄入的内联数据 | 是


#### Local输入源

Local输入源支持直接从本地存储中读取文件，主要目的用于PoC测试。 Local输入源是可拆分的，可以由 [并行任务](#并行任务) 使用，其中 `index_parallel` 的每个worker任务读取一个或者多个文件。

样例规范：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "local",
        "filter" : "*.csv",
        "baseDir": "/data/directory",
        "files": ["/bar/foo", "/foo/bar"]
      },
      "inputFormat": {
        "type": "csv"
      },
      ...
    },
...
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 应该是 `local` | 是 |
| `filter` | 文件的通配符筛选器, 详细信息 [点击此处](http://commons.apache.org/proper/commons-io/apidocs/org/apache/commons/io/filefilter/WildcardFileFilter.html) 查看 | 如果 `baseDir` 指定了，则为必须 |
| `baseDir` | 递归搜索要接收的文件的目录, 将跳过 `baseDir` 下的空文件。 | `baseDir` 或者 `files` 至少需要被指定一个 |
| `files` | 要摄取的文件路径。如果某些文件位于指定的 `baseDir` 下，则可以忽略它们以避免摄取重复文件。该选项会跳过空文件。| `baseDir` 或者 `files` 至少需要被指定一个 |

#### Druid输入源

Druid输入源支持直接从现有的Druid段读取数据，可能使用新的模式，并更改段的名称、维度、Metrics、Rollup等。Druid输入源是可拆分的，可以由 [并行任务](#并行任务) 使用。这个输入源有一个固定的从Druid段读取的输入格式；当使用这个输入源时，不需要在摄取规范中指定输入格式字段。

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 应该是 `druid` | 是 |
| `dataSource` | 定义要从中获取行的Druid数据源 | 是 |
| `interval` | ISO-8601时间间隔的字符串，它定义了获取数据的时间范围。 | 是 |
| `dimensions` | 包含要从Druid数据源中选择的维度列名称的字符串列表。如果列表为空，则不返回维度。如果为空，则返回所有维度。 | 否 |
| `metrics` | 包含要选择的Metric列名称的字符串列表。如果列表为空，则不返回任何度量。如果为空，则返回所有Metric。 | 否 |
| `filter` | 详情请查看 [filters](../querying/filters.html) 如果指定，则只返回与筛选器匹配的行。 | 否 |

DruidInputSource规范的最小示例如下所示：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "druid",
        "dataSource": "wikipedia",
        "interval": "2013-01-01/2013-01-02"
      }
      ...
    },
...
```

上面的规范将从 `wikipedia` 数据源中读取所有现有dimension和metric列，包括 `2013-01-01/2013-01-02` 时间间隔内带有时间戳（ `__time` 列）的所有行。

以下规范使用了筛选器并读取原始数据源列子集：
```json
...
    "ioConfig": {
      "type": "index_parallel",
      "inputSource": {
        "type": "druid",
        "dataSource": "wikipedia",
        "interval": "2013-01-01/2013-01-02",
        "dimensions": [
          "page",
          "user"
        ],
        "metrics": [
          "added"
        ],
        "filter": {
          "type": "selector",
          "dimension": "page",
          "value": "Druid"
        }
      }
      ...
    },
...
```

上面的规范只返回 `page`、`user` 维度和 `added` 的Metric。只返回`page` = `Druid` 的行。

### Firehoses(已废弃)
#### StaticS3Firehose
#### HDFSFirehose
#### LocalFirehose
#### HttpFirehose
#### IngestSegmentFirehose
#### SqlFirehose
#### InlineFirehose
#### CombiningFirehose