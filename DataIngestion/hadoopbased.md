<!-- toc -->
## 基于Hadoop的摄入

Apache Druid当前支持通过一个Hadoop摄取任务来支持基于Apache Hadoop的批量索引任务， 这些任务被提交到 [Druid Overlord](../Design/Overlord.md)的一个运行实例上。详情可以查看 [基于Hadoop的摄取vs基于本地批摄取的对比](ingestion.md#批量摄取) 来了解基于Hadoop的摄取、本地简单批摄取、本地并行摄取三者的比较。

运行一个基于Hadoop的批量摄取任务，首先需要编写一个如下的摄取规范， 然后提交到Overlord的 [`druid/indexer/v1/task`](../Operations/api.md#overlord) 接口，或者使用Druid软件包中自带的 `bin/post-index-task` 脚本。

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

还要注意，Druid会自动计算在Hadoop集群中运行的Hadoop作业容器的类路径。但是，如果Hadoop和Druid的依赖项之间发生冲突，可以通过设置 `druid.extensions.hadoopContainerDruidClasspath`属性。请参阅 [基本druid配置中的扩展配置](../Configuration/configuration.md#扩展) 。
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
| `filter` | JSON | 查看 [Filter](../Querying/filters.md) | 否 |
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
##### `jobProperties`
#### `partitionsSpec`
##### 基于哈希的分区
##### 单一维度范围分区
### 远程Hadoop集群
### Elastic MapReduce
### Kerberized Hadoop集群
#### 从具有EMR的S3加载
### 使用其他的Hadoop
### 命令行版本
#### 可选项
#### 规范文件