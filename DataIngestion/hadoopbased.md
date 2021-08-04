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

spec文件需要包含一个JSON对象，其中的内容与Hadoop索引任务中的"spec"字段相同。有关规范格式的详细信息，请参见 [Hadoop批处理摄取](hadoopbased.md)。

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