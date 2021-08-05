# Hadoop 导入数据

Apache Hadoop-based batch ingestion in Apache Druid is supported via a Hadoop-ingestion task. These tasks can be posted to a running
instance of a Druid [Overlord](../design/overlord.md). Please refer to our [Hadoop-based vs. native batch comparison table](index.md#batch) for
comparisons between Hadoop-based, native batch (simple), and native batch (parallel) ingestion.

To run a Hadoop-based ingestion task, write an ingestion spec as specified below. Then POST it to the
[`/druid/indexer/v1/task`](../operations/api-reference.md#tasks) endpoint on the Overlord, or use the
`bin/post-index-task` script included with Druid.

## Tutorial

This page contains reference documentation for Hadoop-based ingestion.
For a walk-through instead, check out the [Loading from Apache Hadoop](../tutorials/tutorial-batch-hadoop.md) tutorial.

## Task syntax

A sample task is shown below:

```json
{
  "type" : "index_hadoop",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "parser" : {
        "type" : "hadoopyString",
        "parseSpec" : {
          "format" : "json",
          "timestampSpec" : {
            "column" : "timestamp",
            "format" : "auto"
          },
          "dimensionsSpec" : {
            "dimensions": ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"],
            "dimensionExclusions" : [],
            "spatialDimensions" : []
          }
        }
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
      "type" : "hadoop",
      "inputSpec" : {
        "type" : "static",
        "paths" : "/MyDirectory/example/wikipedia_data.json"
      }
    },
    "tuningConfig" : {
      "type": "hadoop"
    }
  },
  "hadoopDependencyCoordinates": <my_hadoop_version>
}
```

|property|description|required?|
|--------|-----------|---------|
|type|The task type, this should always be "index_hadoop".|yes|
|spec|A Hadoop Index Spec. See [Ingestion](../ingestion/index.md)|yes|
|hadoopDependencyCoordinates|A JSON array of Hadoop dependency coordinates that Druid will use, this property will override the default Hadoop coordinates. Once specified, Druid will look for those Hadoop dependencies from the location specified by `druid.extensions.hadoopDependenciesDir`|no|
|classpathPrefix|Classpath that will be prepended for the Peon process.|no|

Also note that Druid automatically computes the classpath for Hadoop job containers that run in the Hadoop cluster. But in case of conflicts between Hadoop and Druid's dependencies, you can manually specify the classpath by setting `druid.extensions.hadoopContainerDruidClasspath` property. See the extensions config in [base druid configuration](../configuration/index.md#extensions).

## `dataSchema`

This field is required. See the [`dataSchema`](index.md#legacy-dataschema-spec) section of the main ingestion page for details on
what it should contain.

## `ioConfig`

This field is required.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|type|String|This should always be 'hadoop'.|yes|
|inputSpec|Object|A specification of where to pull the data in from. See below.|yes|
|segmentOutputPath|String|The path to dump segments into.|Only used by the [Command-line Hadoop indexer](#cli). This field must be null otherwise.|
|metadataUpdateSpec|Object|A specification of how to update the metadata for the druid cluster these segments belong to.|Only used by the [Command-line Hadoop indexer](#cli). This field must be null otherwise.|

### `inputSpec`

There are multiple types of inputSpecs:

#### `static`

A type of inputSpec where a static path to the data files is provided.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|inputFormat|String|Specifies the Hadoop InputFormat class to use. e.g. `org.apache.hadoop.mapreduce.lib.input.SequenceFileInputFormat` |no|
|paths|Array of String|A String of input paths indicating where the raw data is located.|yes|

For example, using the static input paths:

```
"paths" : "hdfs://path/to/data/is/here/data.gz,hdfs://path/to/data/is/here/moredata.gz,hdfs://path/to/data/is/here/evenmoredata.gz"
```

You can also read from cloud storage such as AWS S3 or Google Cloud Storage.
To do so, you need to install the necessary library under Druid's classpath in _all MiddleManager or Indexer processes_.
For S3, you can run the below command to install the [Hadoop AWS module](https://hadoop.apache.org/docs/current/hadoop-aws/tools/hadoop-aws/).

```bash
java -classpath "${DRUID_HOME}lib/*" org.apache.druid.cli.Main tools pull-deps -h "org.apache.hadoop:hadoop-aws:${HADOOP_VERSION}";
cp ${DRUID_HOME}/hadoop-dependencies/hadoop-aws/${HADOOP_VERSION}/hadoop-aws-${HADOOP_VERSION}.jar ${DRUID_HOME}/extensions/druid-hdfs-storage/
```

Once you install the Hadoop AWS module in all MiddleManager and Indexer processes, you can put
your S3 paths in the inputSpec with the below job properties.
For more configurations, see the [Hadoop AWS module](https://hadoop.apache.org/docs/current/hadoop-aws/tools/hadoop-aws/).

```
"paths" : "s3a://billy-bucket/the/data/is/here/data.gz,s3a://billy-bucket/the/data/is/here/moredata.gz,s3a://billy-bucket/the/data/is/here/evenmoredata.gz"
```

```json
"jobProperties" : {
  "fs.s3a.impl" : "org.apache.hadoop.fs.s3a.S3AFileSystem",
  "fs.AbstractFileSystem.s3a.impl" : "org.apache.hadoop.fs.s3a.S3A",
  "fs.s3a.access.key" : "YOUR_ACCESS_KEY",
  "fs.s3a.secret.key" : "YOUR_SECRET_KEY"
}
```

For Google Cloud Storage, you need to install [GCS connector jar](https://github.com/GoogleCloudPlatform/bigdata-interop/blob/master/gcs/INSTALL.md)
under `${DRUID_HOME}/hadoop-dependencies` in _all MiddleManager or Indexer processes_.
Once you install the GCS Connector jar in all MiddleManager and Indexer processes, you can put
your Google Cloud Storage paths in the inputSpec with the below job properties.
For more configurations, see the [instructions to configure Hadoop](https://github.com/GoogleCloudPlatform/bigdata-interop/blob/master/gcs/INSTALL.md#configure-hadoop),
[GCS core default](https://github.com/GoogleCloudDataproc/hadoop-connectors/blob/v2.0.0/gcs/conf/gcs-core-default.xml)
and [GCS core template](https://github.com/GoogleCloudPlatform/bdutil/blob/master/conf/hadoop2/gcs-core-template.xml).

```
"paths" : "gs://billy-bucket/the/data/is/here/data.gz,gs://billy-bucket/the/data/is/here/moredata.gz,gs://billy-bucket/the/data/is/here/evenmoredata.gz"
```

```json
"jobProperties" : {
  "fs.gs.impl" : "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFileSystem",
  "fs.AbstractFileSystem.gs.impl" : "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFS"
}
```

#### `granularity`

A type of inputSpec that expects data to be organized in directories according to datetime using the path format: `y=XXXX/m=XX/d=XX/H=XX/M=XX/S=XX` (where date is represented by lowercase and time is represented by uppercase).

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|dataGranularity|String|Specifies the granularity to expect the data at, e.g. hour means to expect directories `y=XXXX/m=XX/d=XX/H=XX`.|yes|
|inputFormat|String|Specifies the Hadoop InputFormat class to use. e.g. `org.apache.hadoop.mapreduce.lib.input.SequenceFileInputFormat` |no|
|inputPath|String|Base path to append the datetime path to.|yes|
|filePattern|String|Pattern that files should match to be included.|yes|
|pathFormat|String|Joda datetime format for each directory. Default value is `"'y'=yyyy/'m'=MM/'d'=dd/'H'=HH"`, or see [Joda documentation](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html)|no|

For example, if the sample config were run with the interval 2012-06-01/2012-06-02, it would expect data at the paths:

```
s3n://billy-bucket/the/data/is/here/y=2012/m=06/d=01/H=00
s3n://billy-bucket/the/data/is/here/y=2012/m=06/d=01/H=01
...
s3n://billy-bucket/the/data/is/here/y=2012/m=06/d=01/H=23
```

#### `dataSource`

This is a type of `inputSpec` that reads data already stored inside Druid. This is used to allow "re-indexing" data and for "delta-ingestion" described later in `multi` type inputSpec.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|type|String.|This should always be 'dataSource'.|yes|
|ingestionSpec|JSON object.|Specification of Druid segments to be loaded. See below.|yes|
|maxSplitSize|Number|Enables combining multiple segments into single Hadoop InputSplit according to size of segments. With -1, druid calculates max split size based on user specified number of map task(mapred.map.tasks or mapreduce.job.maps). By default, one split is made for one segment. maxSplitSize is specified in bytes.|no|
|useNewAggs|Boolean|If "false", then list of aggregators in "metricsSpec" of hadoop indexing task must be same as that used in original indexing task while ingesting raw data. Default value is "false". This field can be set to "true" when "inputSpec" type is "dataSource" and not "multi" to enable arbitrary aggregators while reindexing. See below for "multi" type support for delta-ingestion.|no|

Here is what goes inside `ingestionSpec`:

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|dataSource|String|Druid dataSource name from which you are loading the data.|yes|
|intervals|List|A list of strings representing ISO-8601 Intervals.|yes|
|segments|List|List of segments from which to read data from, by default it is obtained automatically. You can obtain list of segments to put here by making a POST query to Coordinator at url /druid/coordinator/v1/metadata/datasources/segments?full with list of intervals specified in the request payload, e.g. ["2012-01-01T00:00:00.000/2012-01-03T00:00:00.000", "2012-01-05T00:00:00.000/2012-01-07T00:00:00.000"]. You may want to provide this list manually in order to ensure that segments read are exactly same as they were at the time of task submission, task would fail if the list provided by the user does not match with state of database when the task actually runs.|no|
|filter|JSON|See [Filters](../querying/filters.md)|no|
|dimensions|Array of String|Name of dimension columns to load. By default, the list will be constructed from parseSpec. If parseSpec does not have an explicit list of dimensions then all the dimension columns present in stored data will be read.|no|
|metrics|Array of String|Name of metric columns to load. By default, the list will be constructed from the "name" of all the configured aggregators.|no|
|ignoreWhenNoSegments|boolean|Whether to ignore this ingestionSpec if no segments were found. Default behavior is to throw error when no segments were found.|no|

For example

```json
"ioConfig" : {
  "type" : "hadoop",
  "inputSpec" : {
    "type" : "dataSource",
    "ingestionSpec" : {
      "dataSource": "wikipedia",
      "intervals": ["2014-10-20T00:00:00Z/P2W"]
    }
  },
  ...
}
```

#### `multi`

This is a composing inputSpec to combine other inputSpecs. This inputSpec is used for delta ingestion. You can also use a `multi` inputSpec to combine data from multiple dataSources. However, each particular dataSource can only be specified one time.
Note that, "useNewAggs" must be set to default value false to support delta-ingestion.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|children|Array of JSON objects|List of JSON objects containing other inputSpecs.|yes|

For example:

```json
"ioConfig" : {
  "type" : "hadoop",
  "inputSpec" : {
    "type" : "multi",
    "children": [
      {
        "type" : "dataSource",
        "ingestionSpec" : {
          "dataSource": "wikipedia",
          "intervals": ["2012-01-01T00:00:00.000/2012-01-03T00:00:00.000", "2012-01-05T00:00:00.000/2012-01-07T00:00:00.000"],
          "segments": [
            {
              "dataSource": "test1",
              "interval": "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000",
              "version": "v2",
              "loadSpec": {
                "type": "local",
                "path": "/tmp/index1.zip"
              },
              "dimensions": "host",
              "metrics": "visited_sum,unique_hosts",
              "shardSpec": {
                "type": "none"
              },
              "binaryVersion": 9,
              "size": 2,
              "identifier": "test1_2000-01-01T00:00:00.000Z_3000-01-01T00:00:00.000Z_v2"
            }
          ]
        }
      },
      {
        "type" : "static",
        "paths": "/path/to/more/wikipedia/data/"
      }
    ]
  },
  ...
}
```

It is STRONGLY RECOMMENDED to provide list of segments in `dataSource` inputSpec explicitly so that your delta ingestion task is idempotent. You can obtain that list of segments by making following call to the Coordinator.
POST `/druid/coordinator/v1/metadata/datasources/{dataSourceName}/segments?full`
Request Body: [interval1, interval2,...] for example ["2012-01-01T00:00:00.000/2012-01-03T00:00:00.000", "2012-01-05T00:00:00.000/2012-01-07T00:00:00.000"]

## `tuningConfig`

The tuningConfig is optional and default parameters will be used if no tuningConfig is specified.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|workingPath|String|The working path to use for intermediate results (results between Hadoop jobs).|Only used by the [Command-line Hadoop indexer](#cli). The default is '/tmp/druid-indexing'. This field must be null otherwise.|
|version|String|The version of created segments. Ignored for HadoopIndexTask unless useExplicitVersion is set to true|no (default == datetime that indexing starts at)|
|partitionsSpec|Object|A specification of how to partition each time bucket into segments. Absence of this property means no partitioning will occur. See [`partitionsSpec`](#partitionsspec) below.|no (default == 'hashed')|
|maxRowsInMemory|Integer|The number of rows to aggregate before persisting. Note that this is the number of post-aggregation rows which may not be equal to the number of input events due to roll-up. This is used to manage the required JVM heap size. Normally user does not need to set this, but depending on the nature of data, if rows are short in terms of bytes, user may not want to store a million rows in memory and this value should be set.|no (default == 1000000)|
|maxBytesInMemory|Long|The number of bytes to aggregate in heap memory before persisting. Normally this is computed internally and user does not need to set it. This is based on a rough estimate of memory usage and not actual usage. The maximum heap memory usage for indexing is maxBytesInMemory * (2 + maxPendingPersists). Note that `maxBytesInMemory` also includes heap usage of artifacts created from intermediary persists. This means that after every persist, the amount of `maxBytesInMemory` until next persist will decreases, and task will fail when the sum of bytes of all intermediary persisted artifacts exceeds `maxBytesInMemory`.|no (default == One-sixth of max JVM memory)|
|leaveIntermediate|Boolean|Leave behind intermediate files (for debugging) in the workingPath when a job completes, whether it passes or fails.|no (default == false)|
|cleanupOnFailure|Boolean|Clean up intermediate files when a job fails (unless leaveIntermediate is on).|no (default == true)|
|overwriteFiles|Boolean|Override existing files found during indexing.|no (default == false)|
|ignoreInvalidRows|Boolean|DEPRECATED. Ignore rows found to have problems. If false, any exception encountered during parsing will be thrown and will halt ingestion; if true, unparseable rows and fields will be skipped. If `maxParseExceptions` is defined, this property is ignored.|no (default == false)|
|combineText|Boolean|Use CombineTextInputFormat to combine multiple files into a file split. This can speed up Hadoop jobs when processing a large number of small files.|no (default == false)|
|useCombiner|Boolean|Use Hadoop combiner to merge rows at mapper if possible.|no (default == false)|
|jobProperties|Object|A map of properties to add to the Hadoop job configuration, see below for details.|no (default == null)|
|indexSpec|Object|Tune how data is indexed. See [`indexSpec`](index.md#indexspec) on the main ingestion page for more information.|no|
|indexSpecForIntermediatePersists|Object|defines segment storage format options to be used at indexing time for intermediate persisted temporary segments. this can be used to disable dimension/metric compression on intermediate segments to reduce memory required for final merging. however, disabling compression on intermediate segments might increase page cache use while they are used before getting merged into final segment published, see [`indexSpec`](index.md#indexspec) for possible values.|no (default = same as indexSpec)|
|numBackgroundPersistThreads|Integer|The number of new background threads to use for incremental persists. Using this feature causes a notable increase in memory pressure and CPU usage but will make the job finish more quickly. If changing from the default of 0 (use current thread for persists), we recommend setting it to 1.|no (default == 0)|
|forceExtendableShardSpecs|Boolean|Forces use of extendable shardSpecs. Hash-based partitioning always uses an extendable shardSpec. For single-dimension partitioning, this option should be set to true to use an extendable shardSpec. For partitioning, please check [Partitioning specification](#partitionsspec). This option can be useful when you need to append more data to existing dataSource.|no (default = false)|
|useExplicitVersion|Boolean|Forces HadoopIndexTask to use version.|no (default = false)|
|logParseExceptions|Boolean|If true, log an error message when a parsing exception occurs, containing information about the row where the error occurred.|no(default = false)|
|maxParseExceptions|Integer|The maximum number of parse exceptions that can occur before the task halts ingestion and fails. Overrides `ignoreInvalidRows` if `maxParseExceptions` is defined.|no(default = unlimited)|
|useYarnRMJobStatusFallback|Boolean|If the Hadoop jobs created by the indexing task are unable to retrieve their completion status from the JobHistory server, and this parameter is true, the indexing task will try to fetch the application status from `http://<yarn-rm-address>/ws/v1/cluster/apps/<application-id>`, where `<yarn-rm-address>` is the value of `yarn.resourcemanager.webapp.address` in your Hadoop configuration. This flag is intended as a fallback for cases where an indexing task's jobs succeed, but the JobHistory server is unavailable, causing the indexing task to fail because it cannot determine the job statuses.|no (default = true)|
|awaitSegmentAvailabilityTimeoutMillis|Long|Milliseconds to wait for the newly indexed segments to become available for query after ingestion completes. If `<= 0`, no wait will occur. If `> 0`, the task will wait for the Coordinator to indicate that the new segments are available for querying. If the timeout expires, the task will exit as successful, but the segments were not confirmed to have become available for query.|no (default = 0)| 

### `jobProperties`

```json
   "tuningConfig" : {
     "type": "hadoop",
     "jobProperties": {
       "<hadoop-property-a>": "<value-a>",
       "<hadoop-property-b>": "<value-b>"
     }
   }
```

Hadoop's [MapReduce documentation](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/mapred-default.xml) lists the possible configuration parameters.

With some Hadoop distributions, it may be necessary to set `mapreduce.job.classpath` or `mapreduce.job.user.classpath.first`
to avoid class loading issues. See the [working with different Hadoop versions documentation](../operations/other-hadoop.md)
for more details.

## `partitionsSpec`

Segments are always partitioned based on timestamp (according to the granularitySpec) and may be further partitioned in
some other way depending on partition type. Druid supports two types of partitioning strategies: `hashed` (based on the
hash of all dimensions in each row), and `single_dim` (based on ranges of a single dimension).

Hashed partitioning is recommended in most cases, as it will improve indexing performance and create more uniformly
sized data segments relative to single-dimension partitioning.

### Hash-based partitioning

```json
  "partitionsSpec": {
     "type": "hashed",
     "targetRowsPerSegment": 5000000
   }
```

Hashed partitioning works by first selecting a number of segments, and then partitioning rows across those segments
according to the hash of all dimensions in each row. The number of segments is determined automatically based on the
cardinality of the input set and a target partition size.

The configuration options are:

|Field|Description|Required|
|--------|-----------|---------|
|type|Type of partitionSpec to be used.|"hashed"|
|targetRowsPerSegment|Target number of rows to include in a partition, should be a number that targets segments of 500MB\~1GB. Defaults to 5000000 if `numShards` is not set.|either this or `numShards`|
|targetPartitionSize|Deprecated. Renamed to `targetRowsPerSegment`. Target number of rows to include in a partition, should be a number that targets segments of 500MB\~1GB.|either this or `numShards`|
|maxRowsPerSegment|Deprecated. Renamed to `targetRowsPerSegment`. Target number of rows to include in a partition, should be a number that targets segments of 500MB\~1GB.|either this or `numShards`|
|numShards|Specify the number of partitions directly, instead of a target partition size. Ingestion will run faster, since it can skip the step necessary to select a number of partitions automatically.|either this or `maxRowsPerSegment`|
|partitionDimensions|The dimensions to partition on. Leave blank to select all dimensions. Only used with `numShards`, will be ignored when `targetRowsPerSegment` is set.|no|
|partitionFunction|A function to compute hash of partition dimensions. See [Hash partition function](#hash-partition-function)|`murmur3_32_abs`|no|

##### Hash partition function

In hash partitioning, the partition function is used to compute hash of partition dimensions. The partition dimension
values are first serialized into a byte array as a whole, and then the partition function is applied to compute hash of
the byte array.
Druid currently supports only one partition function.

|name|description|
|----|-----------|
|`murmur3_32_abs`|Applies an absolute value function to the result of [`murmur3_32`](https://guava.dev/releases/16.0/api/docs/com/google/common/hash/Hashing.html#murmur3_32()).|

### Single-dimension range partitioning

```json
  "partitionsSpec": {
     "type": "single_dim",
     "targetRowsPerSegment": 5000000
   }
```

Single-dimension range partitioning works by first selecting a dimension to partition on, and then separating that dimension
into contiguous ranges. Each segment will contain all rows with values of that dimension in that range. For example,
your segments may be partitioned on the dimension "host" using the ranges "a.example.com" to "f.example.com" and
"f.example.com" to "z.example.com". By default, the dimension to use is determined automatically, although you can
override it with a specific dimension.

The configuration options are:

|Field|Description|Required|
|--------|-----------|---------|
|type|Type of partitionSpec to be used.|"single_dim"|
|targetRowsPerSegment|Target number of rows to include in a partition, should be a number that targets segments of 500MB\~1GB.|yes|
|targetPartitionSize|Deprecated. Renamed to `targetRowsPerSegment`. Target number of rows to include in a partition, should be a number that targets segments of 500MB\~1GB.|no|
|maxRowsPerSegment|Maximum number of rows to include in a partition. Defaults to 50% larger than the `targetRowsPerSegment`.|no|
|maxPartitionSize|Deprecated. Use `maxRowsPerSegment` instead. Maximum number of rows to include in a partition. Defaults to 50% larger than the `targetPartitionSize`.|no|
|partitionDimension|The dimension to partition on. Leave blank to select a dimension automatically.|no|
|assumeGrouped|Assume that input data has already been grouped on time and dimensions. Ingestion will run faster, but may choose sub-optimal partitions if this assumption is violated.|no|

## Remote Hadoop clusters

If you have a remote Hadoop cluster, make sure to include the folder holding your configuration `*.xml` files in your Druid `_common` configuration folder.

If you are having dependency problems with your version of Hadoop and the version compiled with Druid, please see [these docs](../operations/other-hadoop.md).

## Elastic MapReduce

If your cluster is running on Amazon Web Services, you can use Elastic MapReduce (EMR) to index data
from S3. To do this:

- Create a persistent, [long-running cluster](http://docs.aws.amazon.com/ElasticMapReduce/latest/ManagementGuide/emr-plan-longrunning-transient).
- When creating your cluster, enter the following configuration. If you're using the wizard, this
  should be in advanced mode under "Edit software settings":

```
classification=yarn-site,properties=[mapreduce.reduce.memory.mb=6144,mapreduce.reduce.java.opts=-server -Xms2g -Xmx2g -Duser.timezone=UTC -Dfile.encoding=UTF-8 -XX:+PrintGCDetails -XX:+PrintGCTimeStamps,mapreduce.map.java.opts=758,mapreduce.map.java.opts=-server -Xms512m -Xmx512m -Duser.timezone=UTC -Dfile.encoding=UTF-8 -XX:+PrintGCDetails -XX:+PrintGCTimeStamps,mapreduce.task.timeout=1800000]
```

- Follow the instructions under
  [Configure for connecting to Hadoop](../tutorials/cluster.md#hadoop) using the XML files from `/etc/hadoop/conf`
  on your EMR master.

## Kerberized Hadoop clusters

By default druid can use the existing TGT kerberos ticket available in local kerberos key cache.
Although TGT ticket has a limited life cycle,
therefore you need to call `kinit` command periodically to ensure validity of TGT ticket.
To avoid this extra external cron job script calling `kinit` periodically,
you can provide the principal name and keytab location and druid will do the authentication transparently at startup and job launching time.

|Property|Possible Values|Description|Default|
|--------|---------------|-----------|-------|
|`druid.hadoop.security.kerberos.principal`|`druid@EXAMPLE.COM`| Principal user name |empty|
|`druid.hadoop.security.kerberos.keytab`|`/etc/security/keytabs/druid.headlessUser.keytab`|Path to keytab file|empty|

### Loading from S3 with EMR

- In the `jobProperties` field in the `tuningConfig` section of your Hadoop indexing task, add:

```
"jobProperties" : {
   "fs.s3.awsAccessKeyId" : "YOUR_ACCESS_KEY",
   "fs.s3.awsSecretAccessKey" : "YOUR_SECRET_KEY",
   "fs.s3.impl" : "org.apache.hadoop.fs.s3native.NativeS3FileSystem",
   "fs.s3n.awsAccessKeyId" : "YOUR_ACCESS_KEY",
   "fs.s3n.awsSecretAccessKey" : "YOUR_SECRET_KEY",
   "fs.s3n.impl" : "org.apache.hadoop.fs.s3native.NativeS3FileSystem",
   "io.compression.codecs" : "org.apache.hadoop.io.compress.GzipCodec,org.apache.hadoop.io.compress.DefaultCodec,org.apache.hadoop.io.compress.BZip2Codec,org.apache.hadoop.io.compress.SnappyCodec"
}
```

Note that this method uses Hadoop's built-in S3 filesystem rather than Amazon's EMRFS, and is not compatible
with Amazon-specific features such as S3 encryption and consistent views. If you need to use these
features, you will need to make the Amazon EMR Hadoop JARs available to Druid through one of the
mechanisms described in the [Using other Hadoop distributions](#using-other-hadoop-distributions) section.

## Using other Hadoop distributions

Druid works out of the box with many Hadoop distributions.

If you are having dependency conflicts between Druid and your version of Hadoop, you can try
searching for a solution in the [Druid user groups](https://groups.google.com/forum/#!forum/druid-user), or reading the
Druid [Different Hadoop Versions](../operations/other-hadoop.md) documentation.

<a name="cli"></a>

## Command line (non-task) version

To run:

```
java -Xmx256m -Duser.timezone=UTC -Dfile.encoding=UTF-8 -classpath lib/*:<hadoop_config_dir> org.apache.druid.cli.Main index hadoop <spec_file>
```

### Options

- "--coordinate" - provide a version of Apache Hadoop to use. This property will override the default Hadoop coordinates. Once specified, Apache Druid will look for those Hadoop dependencies from the location specified by `druid.extensions.hadoopDependenciesDir`.
- "--no-default-hadoop" - don't pull down the default hadoop version

### Spec file

The spec file needs to contain a JSON object where the contents are the same as the "spec" field in the Hadoop index task. See [Hadoop Batch Ingestion](../ingestion/hadoop.md) for details on the spec format.

In addition, a `metadataUpdateSpec` and `segmentOutputPath` field needs to be added to the ioConfig:

```
      "ioConfig" : {
        ...
        "metadataUpdateSpec" : {
          "type":"mysql",
          "connectURI" : "jdbc:mysql://localhost:3306/druid",
          "password" : "diurd",
          "segmentTable" : "druid_segments",
          "user" : "druid"
        },
        "segmentOutputPath" : "/MyDirectory/data/index/output"
      },
```

and a `workingPath` field needs to be added to the tuningConfig:

```
  "tuningConfig" : {
   ...
    "workingPath": "/tmp",
    ...
  }
```

#### Metadata Update Job Spec

This is a specification of the properties that tell the job how to update metadata such that the Druid cluster will see the output segments and load them.

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|type|String|"metadata" is the only value available.|yes|
|connectURI|String|A valid JDBC url to metadata storage.|yes|
|user|String|Username for db.|yes|
|password|String|password for db.|yes|
|segmentTable|String|Table to use in DB.|yes|

These properties should parrot what you have configured for your [Coordinator](../design/coordinator.md).

#### segmentOutputPath Config

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|segmentOutputPath|String|the path to dump segments into.|yes|

#### workingPath Config

|Field|Type|Description|Required|
|-----|----|-----------|--------|
|workingPath|String|the working path to use for intermediate results (results between Hadoop jobs).|no (default == '/tmp/druid-indexing')|

Please note that the command line Hadoop indexer doesn't have the locking capabilities of the indexing service, so if you choose to use it,
you have to take caution to not override segments created by real-time processing (if you that a real-time pipeline set up).




## 基于Hadoop的摄入

Apache Druid当前支持通过一个Hadoop摄取任务来支持基于Apache Hadoop的批量索引任务， 这些任务被提交到 [Druid Overlord](../design/Overlord.md)的一个运行实例上。详情可以查看 [基于Hadoop的摄取vs基于本地批摄取的对比](ingestion.md#批量摄取) 来了解基于Hadoop的摄取、本地简单批摄取、本地并行摄取三者的比较。

运行一个基于Hadoop的批量摄取任务，首先需要编写一个如下的摄取规范， 然后提交到Overlord的 [`druid/indexer/v1/task`](../operations/api.md#overlord) 接口，或者使用Druid软件包中自带的 `bin/post-index-task` 脚本。

### 教程

本章包括了基于Hadoop摄取的参考文档，对于粗略的查看，可以查看 [从Hadoop加载数据](../GettingStarted/chapter-3.md) 教程。

### 任务符号

以下为一个示例任务：
```json
{
  "type" : "index_hadoop",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "wikipedia",
      "parser" : {
        "type" : "hadoopyString",
        "parseSpec" : {
          "format" : "json",
          "timestampSpec" : {
            "column" : "timestamp",
            "format" : "auto"
          },
          "dimensionsSpec" : {
            "dimensions": ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"],
            "dimensionExclusions" : [],
            "spatialDimensions" : []
          }
        }
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
      "type" : "hadoop",
      "inputSpec" : {
        "type" : "static",
        "paths" : "/MyDirectory/example/wikipedia_data.json"
      }
    },
    "tuningConfig" : {
      "type": "hadoop"
    }
  },
  "hadoopDependencyCoordinates": <my_hadoop_version>
}
```

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `type` | 任务类型，应该总是 `index_hadoop` | 是 |
| `spec` | Hadoop索引任务规范。 详见 [ingestion](ingestion.md) | 是 |
| `hadoopDependencyCoordinates` | Druid使用的Hadoop依赖，这些属性会覆盖默认的Hadoop依赖。 如果该值被指定，Druid将在 `druid.extensions.hadoopDependenciesDir` 目录下查找指定的Hadoop依赖 | 否 |
| `classpathPrefix` | 为Peon进程准备的类路径。| 否 |

还要注意，Druid会自动计算在Hadoop集群中运行的Hadoop作业容器的类路径。但是，如果Hadoop和Druid的依赖项之间发生冲突，可以通过设置 `druid.extensions.hadoopContainerDruidClasspath`属性。请参阅 [基本druid配置中的扩展配置](../configuration/human-readable-byte.md#扩展) 。
#### `dataSchema`

该字段是必须的。 详情可以查看摄取页中的 [`dataSchema`](ingestion.md#dataschema) 部分来看它应该包括哪些部分。

#### `ioConfig`

该字段是必须的。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 应该总是 `hadoop` | 是 |
| `inputSpec` | Object | 指定从哪里拉数据。详情见以下。 | 是 |
| `segmentOutputPath` | String | 将段转储到的路径 | 仅仅在 [命令行Hadoop索引](#命令行版本) 中使用， 否则该字段必须为null |
| `metadataUpdateSpec` | Object | 关于如何更新这些段所属的druid集群的元数据的规范 | 仅仅在 [命令行Hadoop索引](#命令行版本) 中使用， 否则该字段必须为null |

##### `inputSpec`

有多种类型的inputSec：

**`static`**

一种`inputSpec`的类型，该类型提供数据文件的静态路径。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `inputFormat` | String | 指定要使用的Hadoop输入格式的类，比如 `org.apache.hadoop.mapreduce.lib.input.SequenceFileInputFormat` | 否 |
| `paths` | String数组 | 标识原始数据位置的输入路径的字符串 | 是 |

例如，以下例子使用了静态输入路径：

```json
"paths" : "hdfs://path/to/data/is/here/data.gz,hdfs://path/to/data/is/here/moredata.gz,hdfs://path/to/data/is/here/evenmoredata.gz"
```

也可以从云存储直接读取数据，例如AWS S3或者谷歌云存储。 前提是需要首先的所有Druid *MiddleManager进程或者Indexer进程*的类路径下安装必要的依赖库。对于S3，需要通过以下命令来安装 [Hadoop AWS 模块](https://hadoop.apache.org/docs/current/hadoop-aws/tools/hadoop-aws/index.html) 

```json
java -classpath "${DRUID_HOME}lib/*" org.apache.druid.cli.Main tools pull-deps -h "org.apache.hadoop:hadoop-aws:${HADOOP_VERSION}";
cp ${DRUID_HOME}/hadoop-dependencies/hadoop-aws/${HADOOP_VERSION}/hadoop-aws-${HADOOP_VERSION}.jar ${DRUID_HOME}/extensions/druid-hdfs-storage/
```

一旦在所有的MiddleManager和Indexer进程中安装了Hadoop AWS模块，即可将S3路径放到 `inputSpec` 中，同时需要有任务属性。 对于更多配置，可以查看  [Hadoop AWS 模块](https://hadoop.apache.org/docs/current/hadoop-aws/tools/hadoop-aws/index.html) 

```json
"paths" : "s3a://billy-bucket/the/data/is/here/data.gz,s3a://billy-bucket/the/data/is/here/moredata.gz,s3a://billy-bucket/the/data/is/here/evenmoredata.gz"
```

```json
"jobProperties" : {
  "fs.s3a.impl" : "org.apache.hadoop.fs.s3a.S3AFileSystem",
  "fs.AbstractFileSystem.s3a.impl" : "org.apache.hadoop.fs.s3a.S3A",
  "fs.s3a.access.key" : "YOUR_ACCESS_KEY",
  "fs.s3a.secret.key" : "YOUR_SECRET_KEY"
}
```

对于谷歌云存储，需要将 [GCS connector jar](https://github.com/GoogleCloudDataproc/hadoop-connectors/blob/master/gcs/INSTALL.md) 安装到*所有MiddleManager或者Indexer进程*的 `${DRUID_HOME}/hadoop-dependencies`。 一旦在所有的MiddleManager和Indexer进程中安装了GCS连接器jar包，即可将谷歌云存储路径放到 `inputSpec` 中，同时需要有任务属性。对于更多配置，可以查看 [instructions to configure Hadoop](https://github.com/GoogleCloudPlatform/bigdata-interop/blob/master/gcs/INSTALL.md#configure-hadoop), [GCS core default](https://github.com/GoogleCloudPlatform/bigdata-interop/blob/master/gcs/conf/gcs-core-default.xml) 和 [GCS core template](https://github.com/GoogleCloudPlatform/bdutil/blob/master/conf/hadoop2/gcs-core-template.xml).

```json
"paths" : "gs://billy-bucket/the/data/is/here/data.gz,gs://billy-bucket/the/data/is/here/moredata.gz,gs://billy-bucket/the/data/is/here/evenmoredata.gz"
```
```json
"jobProperties" : {
  "fs.gs.impl" : "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFileSystem",
  "fs.AbstractFileSystem.gs.impl" : "com.google.cloud.hadoop.fs.gcs.GoogleHadoopFS"
}
```

**`granularity`**

一种`inputSpec`类型，该类型期望数据已经按照日期时间组织到对应的目录中，路径格式为： `y=XXXX/m=XX/d=XX/H=XX/M=XX/S=XX` (其中日期用小写表示，时间用大写表示)。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `dataGranularity` | String | 指定期望的数据粒度，例如，hour意味着期望的目录格式为： `y=XXXX/m=XX/d=XX/H=XX` | 是 |
| `inputFormat` | String | 指定要使用的Hadoop输入格式的类，比如 `org.apache.hadoop.mapreduce.lib.input.SequenceFileInputFormat` | 否 |
| `inputPath` | String | 要将日期时间路径附加到的基路径。| 是 |
| `filePattern` | String | 要包含的文件应匹配的模式 | 是 |
| `pathFormat` | String | 每个目录的Joda datetime目录。 默认值为： `"'y'=yyyy/'m'=MM/'d'=dd/'H'=HH"` ,详情可以看 [Joda文档](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html) | 否 |

例如， 如果示例配置具有 2012-06-01/2012-06-02 时间间隔，则数据期望的路径是：

```json
s3n://billy-bucket/the/data/is/here/y=2012/m=06/d=01/H=00
s3n://billy-bucket/the/data/is/here/y=2012/m=06/d=01/H=01
...
s3n://billy-bucket/the/data/is/here/y=2012/m=06/d=01/H=23
```

**`dataSource`**

一种`inputSpec`的类型, 该类型读取已经存储在Druid中的数据。 该类型被用来"re-indexing"(重新索引)数据和下边描述 `multi` 类型 `inputSpec` 的 "delta-ingestion"(增量摄取)。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | 应该总是 `dataSource` | 是 |
| `ingestionSpec` | JSON对象 | 要加载的Druid段的规范。详情见下边内容。 | 是 |
| `maxSplitSize` | Number | 允许根据段的大小将多个段合并为单个Hadoop InputSplit。使用-1，druid根据用户指定的映射任务数计算最大拆分大小(`mapred.map.tasks` 或者 `mapreduce.job.maps`). 默认情况下，对一个段进行一次拆分。`maxSplitSize` 以字节为单位指定。 | 否 |
| `useNewAggs` | Boolean | 如果"false"，则hadoop索引任务的"metricsSpec"中的聚合器列表必须与接收原始数据时在原始索引任务中使用的聚合器列表相同。默认值为"false"。当"inputSpec"类型为"dataSource"而不是"multi"时，可以将此字段设置为"true"，以便在重新编制索引时启用任意聚合器。请参阅下面的"multi"类型增量摄取支持。| 否 |

下表中为`ingestionSpec`中的一些选项：

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `dataSource` | String | Druid数据源名称，从该数据源读取数据 | 是 |
| `intervals` | List |  ISO-8601时间间隔的字符串List | 是 |
| `segments` | List | 从中读取数据的段的列表，默认情况下自动获取。您可以通过向Coordinator的接口 `/druid/Coordinator/v1/metadata/datasources/segments?full` 进行POST查询来获取要放在这里的段列表。例如["2012-01-01T00:00:00.000/2012-01-03T00:00:00.000"，"2012-01-05T00:00:00.000/2012-01-07T00:00:00.000"]. 您可能希望手动提供此列表，以确保读取的段与任务提交时的段完全相同，如果用户提供的列表与任务实际运行时的数据库状态不匹配，则任务将失败 | 否 |
| `filter` | JSON | 查看 [Filter](../querying/filters.md) | 否 |
| `dimensions` | String数组 | 要加载的维度列的名称。默认情况下，列表将根据 `parseSpec` 构造。如果 `parseSpec` 没有维度的显式列表，则将读取存储数据中的所有维度列。 | 否 |
| `metrics` | String数组 | 要加载的Metric列的名称。默认情况下，列表将根据所有已配置聚合器的"name"构造。 | 否 |
| `ignoreWhenNoSegments` | boolean | 如果找不到段，是否忽略此 `ingestionSpec`。默认行为是在找不到段时引发错误。| 否 |

示例：

```json
"ioConfig" : {
  "type" : "hadoop",
  "inputSpec" : {
    "type" : "dataSource",
    "ingestionSpec" : {
      "dataSource": "wikipedia",
      "intervals": ["2014-10-20T00:00:00Z/P2W"]
    }
  },
  ...
}
```

**`multi`**

这是一个组合类型的 `inputSpec`, 来组合其他 `inputSpec`。此inputSpec用于增量接收。您还可以使用一个 `multi` 类型的inputSpec组合来自多个数据源的数据。但是，每个特定的数据源只能指定一次。注意，"useNewAggs"必须设置为默认值false以支持增量摄取。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `children` | JSON对象数组 | 一个JSON对象List，里边包含了其他类型的inputSpec | 是 |

示例：

```json
"ioConfig" : {
  "type" : "hadoop",
  "inputSpec" : {
    "type" : "multi",
    "children": [
      {
        "type" : "dataSource",
        "ingestionSpec" : {
          "dataSource": "wikipedia",
          "intervals": ["2012-01-01T00:00:00.000/2012-01-03T00:00:00.000", "2012-01-05T00:00:00.000/2012-01-07T00:00:00.000"],
          "segments": [
            {
              "dataSource": "test1",
              "interval": "2012-01-01T00:00:00.000/2012-01-03T00:00:00.000",
              "version": "v2",
              "loadSpec": {
                "type": "local",
                "path": "/tmp/index1.zip"
              },
              "dimensions": "host",
              "metrics": "visited_sum,unique_hosts",
              "shardSpec": {
                "type": "none"
              },
              "binaryVersion": 9,
              "size": 2,
              "identifier": "test1_2000-01-01T00:00:00.000Z_3000-01-01T00:00:00.000Z_v2"
            }
          ]
        }
      },
      {
        "type" : "static",
        "paths": "/path/to/more/wikipedia/data/"
      }
    ]
  },
  ...
}
```

**强烈建议显式**地在 `dataSource` 中的 `inputSpec` 中提供段列表，以便增量摄取任务是幂等的。您可以通过对Coordinator进行以下调用来获取该段列表，POST `/druid/coordinator/v1/metadata/datasources/{dataSourceName}/segments?full`, 请求体：[interval1，interval2，…]， 例如["2012-01-01T00:00:00.000/2012-01-03T00:00:00.000"，"2012-01-05T00:00:00.000/2012-01-07T00:00:00.000"]

#### `tuningConfig`

`tuningConfig` 是一个可选项，如果未指定的话，则使用默认的参数。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `workingPath` | String | 用于存储中间结果（Hadoop作业之间的结果）的工作路径 | 该配置仅仅使用在 [命令行Hadoop索引](#命令行版本) ，默认值为： `/tmp/druid-indexing`, 否则该值必须设置为null |
| `version` | String | 创建的段的版本。 对于Hadoop索引任务一般是忽略的，除非 `useExplicitVersion` 被设置为 `true` | 否（默认为索引任务开始的时间） |
| `partitionsSpec` | Object | 指定如何将时间块内的分区为段。缺少此属性意味着不会发生分区。 详情可见 [`partitionsSpec`](#partitionsspec) | 否（默认为 `hashed`） |
| `maxRowsInMemory` | Integer | 在持久化之前在堆内存中聚合的行数。注意：由于rollup操作，该值是聚合后的行数，可能不等于输入的行数。 该值常用来管理需要的JVM堆内存大小。通常情况下，用户并不需要设置该值，而是依赖数据自身。 如果数据是非常小的，用户希望在内存存储上百万行数据的话，则需要设置该值。 | 否（默认为：1000000）|
| `maxBytesInMemory` | Long | 在持久化之前在堆内存中聚合的字节数。通常这是在内部计算的，用户不需要设置它。此值表示在持久化之前要在堆内存中聚合的字节数。这是基于对内存使用量的粗略估计，而不是实际使用量。用于索引的最大堆内存使用量为 `maxBytesInMemory *（2 + maxPendingResistent）` | 否（默认为：最大JVM内存的1/6）|
| `leaveIntermediate` | Boolean | 作业完成时，不管通过还是失败，都在工作路径中留下中间文件（用于调试）。 | 否（默认为false）|
| `cleanupOnFailure` | Boolean | 当任务失败时清理中间文件（除非 `leaveIntermediate` 设置为true） | 否（默认为true）|
| `overwriteFiles` | Boolean | 在索引过程中覆盖找到的现存文件 | 否（默认为false）|
| `ignoreInvalidRows` | Boolean | **已废弃**。忽略发现有问题的行。如果为false，解析过程中遇到的任何异常都将引发并停止摄取；如果为true，将跳过不可解析的行和字段。如果定义了 `maxParseExceptions`，则忽略此属性。 | 否（默认为false）|
| `combineText` | Boolean | 使用CombineTextInputFormat将多个文件合并为一个文件拆分。这可以在处理大量小文件时加快Hadoop作业的速度。 | 否（默认为false）|
| `useCombiner` | Boolean | 如果可能的话，使用Hadoop Combiner在mapper阶段合并行 | 否（默认为false）|
| `jobProperties` | Object | 增加到Hadoop作业配置的属性map，详情见下边。 | 否（默认为null）|
| `indexSpec` | Object | 调整数据如何被索引。 详细信息可以见位于摄取页的 [`indexSpec`](ingestion.md#tuningConfig) | 否 |
| `indexSpecForIntermediatePersists` | Object | 定义要在索引时用于中间持久化临时段的段存储格式选项。这可用于禁用中间段上的dimension/metric压缩，以减少最终合并所需的内存。但是，在中间段上禁用压缩可能会增加页缓存的使用，因为可能在它们被合并到发布的最终段之前使用它们，有关可能的值，请参阅 [`indexSpec`](ingestion.md#tuningConfig)。 | 否（默认与indexSpec一样）|
| `numBackgroundPersistThreads` | Integer | 用于增量持久化的新后台线程数。使用此功能会显著增加内存压力和CPU使用率，但会使任务更快完成。如果从默认值0（对持久性使用当前线程）更改，建议将其设置为1。 | 否（默认为0）|
| `forceExtendableShardSpecs` | Boolean | 强制使用可扩展的shardSpec。基于哈希的分区总是使用可扩展的shardSpec。对于单维分区，此选项应设置为true以使用可扩展shardSpec。对于分区，请检查 [分区规范](#partitionsspec) | 否（默认为false）|
| `useExplicitVersion` | Boolean | 强制HadoopIndexTask使用version | 否（默认为false）|
| `logParseExceptions` | Boolean | 如果为true，则在发生解析异常时记录错误消息，其中包含有关发生错误的行的信息。| 否（默认为false）|
| `maxParseExceptions` | Integer | 任务停止接收并失败之前可能发生的最大分析异常数。如果设置了`reportParseExceptions`，则该配置被覆盖。 | 否（默认为unlimited）|
| `useYarnRMJobStatusFallback` | Boolean | 如果索引任务创建的Hadoop作业无法从JobHistory服务器检索其完成状态，并且此参数为true，则索引任务将尝试从 `http://<yarn rm address>/ws/v1/cluster/apps/<application id>` 获取应用程序状态，其中 `<yarn rm address>` 是Hadoop配置中 `yarn.resourcemanager.webapp.address` 的地址。此标志用于索引任务的作业成功但JobHistory服务器不可用的情况下的回退，从而导致索引任务失败，因为它无法确定作业状态。 | 否（默认为true）|

##### `jobProperties`

```json
   "tuningConfig" : {
     "type": "hadoop",
     "jobProperties": {
       "<hadoop-property-a>": "<value-a>",
       "<hadoop-property-b>": "<value-b>"
     }
   }
```
Hadoop的 [MapReduce文档](https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/mapred-default.xml) 列出来了所有可能的配置参数。

在一些Hadoop分布式环境中，可能需要设置 `mapreduce.job.classpath` 或者 `mapreduce.job.user.classpath.first` 来避免类加载相关的问题。 更多详细信息可以参见 [使用不同Hadoop版本的文档](../operations/other-hadoop.md) 

#### `partitionsSpec`

段总是基于时间戳进行分区（根据 `granularitySpec`），并且可以根据分区类型以其他方式进一步分区。Druid支持两种类型的分区策略：`hashed`（基于每行中所有维度的hash）和 `single_dim`（基于单个维度的范围）。

在大多数情况下，建议使用哈希分区，因为相对于单一维度分区，哈希分区将提高索引性能并创建更统一大小的数据段。

##### 基于哈希的分区

```json
  "partitionsSpec": {
     "type": "hashed",
     "targetRowsPerSegment": 5000000
   }
```

哈希分区的工作原理是首先选择多个段，然后根据每一行中所有维度的哈希对这些段中的行进行分区。段的数量是根据输入集的基数和目标分区大小自动确定的。

配置项为：

| 字段 | 描述 | 是否必须 |
|-|-|-|
| `type` | 使用的partitionsSpec的类型 | "hashed" |
| `targetRowsPerSegment` | 要包含在分区中的目标行数，应为500MB~1GB段的数。如果未设置 `numShards` ，则默认为5000000。 | 为该配置或者 `numShards` |
| `targetPartitionSize` | 已弃用。重命名为`targetRowsPerSegment`。要包含在分区中的目标行数，应为500MB~1GB段的数。 | 为该配置或者 `numShards` |
| `maxRowsPerSegment` | 已弃用。重命名为`targetRowsPerSegment`。要包含在分区中的目标行数，应为500MB~1GB段的数。 | 为该配置或者 `numShards` | 为该配置或者 `numShards` |
| `numShards` | 直接指定分区数，而不是目标分区大小。摄取将运行得更快，因为它可以跳过自动选择多个分区所需的步骤。| 为该配置或者 `maxRowsPerSegment` |
| `partitionDimensions` | 要划分的维度。留空可选择所有维度。仅与`numShard` 一起使用，在设置 `targetRowsPerSegment` 时将被忽略。| 否 |


##### 单一维度范围分区

```json
  "partitionsSpec": {
     "type": "single_dim",
     "targetRowsPerSegment": 5000000
   }
```

单一维度范围分区的工作原理是首先选择要分区的维度，然后将该维度分隔成连续的范围，每个段将包含该维度值在该范围内的所有行。例如，可以在维度"host"上对段进行分区,范围为"a.example.com"到"f.example.com"和"f.example.com"到"z.example.com"。 默认情况下，将自动确定要使用的维度，但可以使用特定维度替代它。

配置项为：

| 字段 | 描述 | 是否必须 |
|-|-|-|
| `type` | 使用的partitionsSpec的类型 | "single_dim" |
| `targetRowsPerSegment` | 要包含在分区中的目标行数，应为500MB~1GB段的数。 | 是 |
| `targetPartitionSize` | 已弃用。重命名为`targetRowsPerSegment`。要包含在分区中的目标行数，应为500MB~1GB段的数。 | 否 |
| `maxRowsPerSegment` | 要包含在分区中的最大行数。默认值为比`targetRowsPerSegment` 大50%。 | 否 |
| `maxPartitionSize` | 已弃用。请改用 `maxRowsPerSegment`。要包含在分区中的最大行数, 默认为比 `targetPartitionSize` 大50%。 | 否 |
| `partitionDimension` | 要分区的维度。留空可自动选择维度。 | 否 |
| `assumeGrouped` | 假设输入数据已经按时间和维度分组。摄取将运行得更快，但如果违反此假设，则可能会选择次优分区。 | 否 |

### 远程Hadoop集群

如果已经有了一个远程的Hadoop集群，确保在Druid的 `_common` 配置目录中包含 `*.xml` 文件。

如果Hadoop与Druid的版本存在依赖等问题，请查看 [这些文档](../operations/other-hadoop.md)

### Elastic MapReduce

如果集群运行在AWS上，可以使用Elastic MapReduce(EMR)来从S3中索引数据。需要以下几步：

* 创建一个 [持续运行的集群](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-plan-longrunning-transient.html)
* 创建集群时，请输入以下配置。如果使用向导，则应在"编辑软件设置"下处于高级模式：

```json
classification=yarn-site,properties=[mapreduce.reduce.memory.mb=6144,mapreduce.reduce.java.opts=-server -Xms2g -Xmx2g -Duser.timezone=UTC -Dfile.encoding=UTF-8 -XX:+PrintGCDetails -XX:+PrintGCTimeStamps,mapreduce.map.java.opts=758,mapreduce.map.java.opts=-server -Xms512m -Xmx512m -Duser.timezone=UTC -Dfile.encoding=UTF-8 -XX:+PrintGCDetails -XX:+PrintGCTimeStamps,mapreduce.task.timeout=1800000]
```
* 按照 [Hadoop连接配置](../tutorials/img/chapter-4.md#Hadoop连接配置) 指导，使用EMR master中 `/etc/hadoop/conf` 的XML文件。

### Kerberized Hadoop集群

默认情况下，druid可以使用本地kerberos密钥缓存中现有的TGT kerberos票证。虽然TGT票证的生命周期有限，但您需要定期调用 `kinit` 命令以确保TGT票证的有效性。为了避免这个额外的外部cron作业脚本周期性地调用 `kinit`，您可以提供主体名称和keytab位置，druid将在启动和作业启动时透明地执行身份验证。

| 属性 | 可能的值 |
|-|-|
| `druid.hadoop.security.kerberos.principal` | `druid@EXAMPLE.COM` |
| `druid.hadoop.security.kerberos.keytab` | `/etc/security/keytabs/druid.headlessUser.keytab` |

#### 从具有EMR的S3加载

* 在Hadoop索引任务中 `tuningConfig` 部分的 `jobProperties` 字段中添加一下内容：
  
```json
"jobProperties" : {
   "fs.s3.awsAccessKeyId" : "YOUR_ACCESS_KEY",
   "fs.s3.awsSecretAccessKey" : "YOUR_SECRET_KEY",
   "fs.s3.impl" : "org.apache.hadoop.fs.s3native.NativeS3FileSystem",
   "fs.s3n.awsAccessKeyId" : "YOUR_ACCESS_KEY",
   "fs.s3n.awsSecretAccessKey" : "YOUR_SECRET_KEY",
   "fs.s3n.impl" : "org.apache.hadoop.fs.s3native.NativeS3FileSystem",
   "io.compression.codecs" : "org.apache.hadoop.io.compress.GzipCodec,org.apache.hadoop.io.compress.DefaultCodec,org.apache.hadoop.io.compress.BZip2Codec,org.apache.hadoop.io.compress.SnappyCodec"
}
```
注意，此方法使用Hadoop的内置S3文件系统，而不是Amazon的EMRFS，并且与Amazon的特定功能（如S3加密和一致视图）不兼容。如果您需要使用这些特性，那么您将需要通过 [其他Hadoop发行版](#使用其他的Hadoop) 一节中描述的机制之一，使Amazon EMR Hadoop JARs对Druid可用。

### 使用其他的Hadoop

Druid在许多Hadoop发行版中都是开箱即用的。

如果Druid与您当前使用的Hadoop版本发生依赖冲突时，您可以尝试在 [Druid用户组](https://groups.google.com/forum/#!forum/druid-user) 中搜索解决方案， 或者阅读 [Druid不同版本Hadoop文档](../operations/other-hadoop.md)

### 命令行版本

运行：

```json
java -Xmx256m -Duser.timezone=UTC -Dfile.encoding=UTF-8 -classpath lib/*:<hadoop_config_dir> org.apache.druid.cli.Main index hadoop <spec_file>
```
#### 可选项

* "--coordinate" - 提供要使用的Apache Hadoop版本。此属性将覆盖默认的Hadoop。一旦指定，Apache Druid将从 `druid.extensions.hadoopDependenciesDir` 位置寻找Hadoop依赖。
* "--no-default-hadoop" - 不要下拉默认的hadoop版本

#### 规范文件

spec文件需要包含一个JSON对象，其中的内容与Hadoop索引任务中的"spec"字段相同。有关规范格式的详细信息，请参见 [Hadoop批处理摄取](hadoop.md)。

另外， `metadataUpdateSpec` 和 `segmentOutputPath` 字段需要被添加到ioConfig中：
```json
      "ioConfig" : {
        ...
        "metadataUpdateSpec" : {
          "type":"mysql",
          "connectURI" : "jdbc:mysql://localhost:3306/druid",
          "password" : "druid",
          "segmentTable" : "druid_segments",
          "user" : "druid"
        },
        "segmentOutputPath" : "/MyDirectory/data/index/output"
      },
```
同时， `workingPath` 字段需要被添加到tuningConfig：
```json
  "tuningConfig" : {
   ...
    "workingPath": "/tmp",
    ...
  }
```
**Metadata Update Job Spec**

这是一个属性规范，告诉作业如何更新元数据，以便Druid集群能够看到输出段并加载它们。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `type` | String | "metadata"是唯一可用的值 | 是 |
| `connectURI` | String | 连接元数据存储的可用的JDBC | 是 |
| `user` | String | DB的用户名 | 是 |
| `password` | String | DB的密码 | 是 |
| `segmentTable` | String | DB中使用的表 | 是 |

这些属性应该模仿您为 [Coordinator](../design/Coordinator.md) 配置的内容。

**segmentOutputPath配置**

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `segmentOutputPath` | String | 将段转储到的路径 | 是 |

**workingPath配置**

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| `workingPath` | String | 用于中间结果（Hadoop作业之间的结果）的工作路径。 | 否（默认为 `/tmp/druid-indexing` ）|

请注意，命令行Hadoop indexer不具备索引服务的锁定功能，因此如果选择使用它，则必须注意不要覆盖由实时处理创建的段（如果设置了实时管道）。