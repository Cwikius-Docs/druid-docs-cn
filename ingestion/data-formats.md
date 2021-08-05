---
id: data-formats
title: "Data formats"
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

Apache Druid can ingest denormalized data in JSON, CSV, or a delimited form such as TSV, or any custom format. While most examples in the documentation use data in JSON format, it is not difficult to configure Druid to ingest any other delimited data.
We welcome any contributions to new formats.

This page lists all default and core extension data formats supported by Druid.
For additional data formats supported with community extensions,
please see our [community extensions list](../development/extensions.md#community-extensions).

## Formatting the Data

The following samples show data formats that are natively supported in Druid:

_JSON_

```json
{"timestamp": "2013-08-31T01:02:33Z", "page": "Gypsy Danger", "language" : "en", "user" : "nuclear", "unpatrolled" : "true", "newPage" : "true", "robot": "false", "anonymous": "false", "namespace":"article", "continent":"North America", "country":"United States", "region":"Bay Area", "city":"San Francisco", "added": 57, "deleted": 200, "delta": -143}
{"timestamp": "2013-08-31T03:32:45Z", "page": "Striker Eureka", "language" : "en", "user" : "speed", "unpatrolled" : "false", "newPage" : "true", "robot": "true", "anonymous": "false", "namespace":"wikipedia", "continent":"Australia", "country":"Australia", "region":"Cantebury", "city":"Syndey", "added": 459, "deleted": 129, "delta": 330}
{"timestamp": "2013-08-31T07:11:21Z", "page": "Cherno Alpha", "language" : "ru", "user" : "masterYi", "unpatrolled" : "false", "newPage" : "true", "robot": "true", "anonymous": "false", "namespace":"article", "continent":"Asia", "country":"Russia", "region":"Oblast", "city":"Moscow", "added": 123, "deleted": 12, "delta": 111}
{"timestamp": "2013-08-31T11:58:39Z", "page": "Crimson Typhoon", "language" : "zh", "user" : "triplets", "unpatrolled" : "true", "newPage" : "false", "robot": "true", "anonymous": "false", "namespace":"wikipedia", "continent":"Asia", "country":"China", "region":"Shanxi", "city":"Taiyuan", "added": 905, "deleted": 5, "delta": 900}
{"timestamp": "2013-08-31T12:41:27Z", "page": "Coyote Tango", "language" : "ja", "user" : "cancer", "unpatrolled" : "true", "newPage" : "false", "robot": "true", "anonymous": "false", "namespace":"wikipedia", "continent":"Asia", "country":"Japan", "region":"Kanto", "city":"Tokyo", "added": 1, "deleted": 10, "delta": -9}
```

_CSV_

```
2013-08-31T01:02:33Z,"Gypsy Danger","en","nuclear","true","true","false","false","article","North America","United States","Bay Area","San Francisco",57,200,-143
2013-08-31T03:32:45Z,"Striker Eureka","en","speed","false","true","true","false","wikipedia","Australia","Australia","Cantebury","Syndey",459,129,330
2013-08-31T07:11:21Z,"Cherno Alpha","ru","masterYi","false","true","true","false","article","Asia","Russia","Oblast","Moscow",123,12,111
2013-08-31T11:58:39Z,"Crimson Typhoon","zh","triplets","true","false","true","false","wikipedia","Asia","China","Shanxi","Taiyuan",905,5,900
2013-08-31T12:41:27Z,"Coyote Tango","ja","cancer","true","false","true","false","wikipedia","Asia","Japan","Kanto","Tokyo",1,10,-9
```

_TSV (Delimited)_

```
2013-08-31T01:02:33Z  "Gypsy Danger"  "en"  "nuclear" "true"  "true"  "false" "false" "article" "North America" "United States" "Bay Area"  "San Francisco" 57  200 -143
2013-08-31T03:32:45Z  "Striker Eureka"  "en"  "speed" "false" "true"  "true"  "false" "wikipedia" "Australia" "Australia" "Cantebury" "Syndey"  459 129 330
2013-08-31T07:11:21Z  "Cherno Alpha"  "ru"  "masterYi"  "false" "true"  "true"  "false" "article" "Asia"  "Russia"  "Oblast"  "Moscow"  123 12  111
2013-08-31T11:58:39Z  "Crimson Typhoon" "zh"  "triplets"  "true"  "false" "true"  "false" "wikipedia" "Asia"  "China" "Shanxi"  "Taiyuan" 905 5 900
2013-08-31T12:41:27Z  "Coyote Tango"  "ja"  "cancer"  "true"  "false" "true"  "false" "wikipedia" "Asia"  "Japan" "Kanto" "Tokyo" 1 10  -9
```

Note that the CSV and TSV data do not contain column heads. This becomes important when you specify the data for ingesting.

Besides text formats, Druid also supports binary formats such as [Orc](#orc) and [Parquet](#parquet) formats.

## Custom Formats

Druid supports custom data formats and can use the `Regex` parser or the `JavaScript` parsers to parse these formats. Please note that using any of these parsers for
parsing data will not be as efficient as writing a native Java parser or using an external stream processor. We welcome contributions of new Parsers.

## Input Format

> The Input Format is a new way to specify the data format of your input data which was introduced in 0.17.0.
Unfortunately, the Input Format doesn't support all data formats or ingestion methods supported by Druid yet.
Especially if you want to use the Hadoop ingestion, you still need to use the [Parser](#parser).
If your data is formatted in some format not listed in this section, please consider using the Parser instead.

All forms of Druid ingestion require some form of schema object. The format of the data to be ingested is specified using the `inputFormat` entry in your [`ioConfig`](index.md#ioconfig).

### JSON

The `inputFormat` to load data of JSON format. An example is:

```json
"ioConfig": {
  "inputFormat": {
    "type": "json"
  },
  ...
}
```

The JSON `inputFormat` has the following components:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `json`. | yes |
| flattenSpec | JSON Object | Specifies flattening configuration for nested JSON data. See [`flattenSpec`](#flattenspec) for more info. | no |
| featureSpec | JSON Object | [JSON parser features](https://github.com/FasterXML/jackson-core/wiki/JsonParser-Features) supported by Jackson library. Those features will be applied when parsing the input JSON data. | no |

### CSV

The `inputFormat` to load data of the CSV format. An example is:

```json
"ioConfig": {
  "inputFormat": {
    "type": "csv",
    "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"]
  },
  ...
}
```

The CSV `inputFormat` has the following components:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `csv`. | yes |
| listDelimiter | String | A custom delimiter for multi-value dimensions. | no (default = ctrl+A) |
| columns | JSON array | Specifies the columns of the data. The columns should be in the same order with the columns of your data. | yes if `findColumnsFromHeader` is false or missing |
| findColumnsFromHeader | Boolean | If this is set, the task will find the column names from the header row. Note that `skipHeaderRows` will be applied before finding column names from the header. For example, if you set `skipHeaderRows` to 2 and `findColumnsFromHeader` to true, the task will skip the first two lines and then extract column information from the third line. `columns` will be ignored if this is set to true. | no (default = false if `columns` is set; otherwise null) |
| skipHeaderRows | Integer | If this is set, the task will skip the first `skipHeaderRows` rows. | no (default = 0) |

### TSV (Delimited)

```json
"ioConfig": {
  "inputFormat": {
    "type": "tsv",
    "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"],
    "delimiter":"|"
  },
  ...
}
```

The `inputFormat` to load data of a delimited format. An example is:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `tsv`. | yes |
| delimiter | String | A custom delimiter for data values. | no (default = `\t`) |
| listDelimiter | String | A custom delimiter for multi-value dimensions. | no (default = ctrl+A) |
| columns | JSON array | Specifies the columns of the data. The columns should be in the same order with the columns of your data. | yes if `findColumnsFromHeader` is false or missing |
| findColumnsFromHeader | Boolean | If this is set, the task will find the column names from the header row. Note that `skipHeaderRows` will be applied before finding column names from the header. For example, if you set `skipHeaderRows` to 2 and `findColumnsFromHeader` to true, the task will skip the first two lines and then extract column information from the third line. `columns` will be ignored if this is set to true. | no (default = false if `columns` is set; otherwise null) |
| skipHeaderRows | Integer | If this is set, the task will skip the first `skipHeaderRows` rows. | no (default = 0) |

Be sure to change the `delimiter` to the appropriate delimiter for your data. Like CSV, you must specify the columns and which subset of the columns you want indexed.

### ORC

> You need to include the [`druid-orc-extensions`](../development/extensions-core/orc.md) as an extension to use the ORC input format.

> If you are considering upgrading from earlier than 0.15.0 to 0.15.0 or a higher version,
> please read [Migration from 'contrib' extension](../development/extensions-core/orc.md#migration-from-contrib-extension) carefully.

The `inputFormat` to load data of ORC format. An example is:

```json
"ioConfig": {
  "inputFormat": {
    "type": "orc",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "nested",
          "expr": "$.path.to.nested"
        }
      ]
    },
    "binaryAsString": false
  },
  ...
}
```

The ORC `inputFormat` has the following components:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `orc`. | yes |
| flattenSpec | JSON Object | Specifies flattening configuration for nested ORC data. See [`flattenSpec`](#flattenspec) for more info. | no |
| binaryAsString | Boolean | Specifies if the binary orc column which is not logically marked as a string should be treated as a UTF-8 encoded string. | no (default = false) |

### Parquet

> You need to include the [`druid-parquet-extensions`](../development/extensions-core/parquet.md) as an extension to use the Parquet input format.

The `inputFormat` to load data of Parquet format. An example is:

```json
"ioConfig": {
  "inputFormat": {
    "type": "parquet",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "nested",
          "expr": "$.path.to.nested"
        }
      ]
    },
    "binaryAsString": false
  },
  ...
}
```

The Parquet `inputFormat` has the following components:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
|type| String| This should be set to `parquet` to read Parquet file| yes |
|flattenSpec| JSON Object |Define a [`flattenSpec`](#flattenspec) to extract nested values from a Parquet file. Note that only 'path' expression are supported ('jq' is unavailable).| no (default will auto-discover 'root' level properties) |
| binaryAsString | Boolean | Specifies if the bytes parquet column which is not logically marked as a string or enum type should be treated as a UTF-8 encoded string. | no (default = false) |

### Avro Stream

> You need to include the [`druid-avro-extensions`](../development/extensions-core/avro.md) as an extension to use the Avro Stream input format.

> See the [Avro Types](../development/extensions-core/avro.md#avro-types) section for how Avro types are handled in Druid

The `inputFormat` to load data of Avro format in stream ingestion. An example is:
```json
"ioConfig": {
  "inputFormat": {
    "type": "avro_stream",
    "avroBytesDecoder": {
      "type": "schema_inline",
      "schema": {
        //your schema goes here, for example
        "namespace": "org.apache.druid.data",
        "name": "User",
        "type": "record",
        "fields": [
          { "name": "FullName", "type": "string" },
          { "name": "Country", "type": "string" }
        ]
      }
    },
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "someRecord_subInt",
          "expr": "$.someRecord.subInt"
        }
      ]
    },
    "binaryAsString": false
  },
  ...
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
|type| String| This should be set to `avro_stream` to read Avro serialized data| yes |
|flattenSpec| JSON Object |Define a [`flattenSpec`](#flattenspec) to extract nested values from a Avro record. Note that only 'path' expression are supported ('jq' is unavailable).| no (default will auto-discover 'root' level properties) |
|`avroBytesDecoder`| JSON Object |Specifies how to decode bytes to Avro record. | yes |
| binaryAsString | Boolean | Specifies if the bytes Avro column which is not logically marked as a string or enum type should be treated as a UTF-8 encoded string. | no (default = false) |

##### Avro Bytes Decoder

If `type` is not included, the avroBytesDecoder defaults to `schema_repo`.

###### Inline Schema Based Avro Bytes Decoder

> The "schema_inline" decoder reads Avro records using a fixed schema and does not support schema migration. If you
> may need to migrate schemas in the future, consider one of the other decoders, all of which use a message header that
> allows the parser to identify the proper Avro schema for reading records.

This decoder can be used if all the input events can be read using the same schema. In this case, specify the schema in the input task JSON itself, as described below.

```
...
"avroBytesDecoder": {
  "type": "schema_inline",
  "schema": {
    //your schema goes here, for example
    "namespace": "org.apache.druid.data",
    "name": "User",
    "type": "record",
    "fields": [
      { "name": "FullName", "type": "string" },
      { "name": "Country", "type": "string" }
    ]
  }
}
...
```

###### Multiple Inline Schemas Based Avro Bytes Decoder

Use this decoder if different input events can have different read schemas. In this case, specify the schema in the input task JSON itself, as described below.

```
...
"avroBytesDecoder": {
  "type": "multiple_schemas_inline",
  "schemas": {
    //your id -> schema map goes here, for example
    "1": {
      "namespace": "org.apache.druid.data",
      "name": "User",
      "type": "record",
      "fields": [
        { "name": "FullName", "type": "string" },
        { "name": "Country", "type": "string" }
      ]
    },
    "2": {
      "namespace": "org.apache.druid.otherdata",
      "name": "UserIdentity",
      "type": "record",
      "fields": [
        { "name": "Name", "type": "string" },
        { "name": "Location", "type": "string" }
      ]
    },
    ...
    ...
  }
}
...
```

Note that it is essentially a map of integer schema ID to avro schema object. This parser assumes that record has following format.
  first 1 byte is version and must always be 1.
  next 4 bytes are integer schema ID serialized using big-endian byte order.
  remaining bytes contain serialized avro message.

##### SchemaRepo Based Avro Bytes Decoder

This Avro bytes decoder first extracts `subject` and `id` from the input message bytes, and then uses them to look up the Avro schema used to decode the Avro record from bytes. For details, see the [schema repo](https://github.com/schema-repo/schema-repo) and [AVRO-1124](https://issues.apache.org/jira/browse/AVRO-1124). You will need an http service like schema repo to hold the avro schema. For information on registering a schema on the message producer side, see `org.apache.druid.data.input.AvroStreamInputRowParserTest#testParse()`.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `schema_repo`. | no |
| subjectAndIdConverter | JSON Object | Specifies how to extract the subject and id from message bytes. | yes |
| schemaRepository | JSON Object | Specifies how to look up the Avro schema from subject and id. | yes |

###### Avro-1124 Subject And Id Converter

This section describes the format of the `subjectAndIdConverter` object for the `schema_repo` Avro bytes decoder.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `avro_1124`. | no |
| topic | String | Specifies the topic of your Kafka stream. | yes |


###### Avro-1124 Schema Repository

This section describes the format of the `schemaRepository` object for the `schema_repo` Avro bytes decoder.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `avro_1124_rest_client`. | no |
| url | String | Specifies the endpoint url of your Avro-1124 schema repository. | yes |

###### Confluent Schema Registry-based Avro Bytes Decoder

This Avro bytes decoder first extracts a unique `id` from input message bytes, and then uses it to look up the schema in the Schema Registry used to decode the Avro record from bytes.
For details, see the Schema Registry [documentation](http://docs.confluent.io/current/schema-registry/docs/) and [repository](https://github.com/confluentinc/schema-registry).

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `schema_registry`. | no |
| url | String | Specifies the url endpoint of the Schema Registry. | yes |
| capacity | Integer | Specifies the max size of the cache (default = Integer.MAX_VALUE). | no |
| urls | Array<String> | Specifies the url endpoints of the multiple Schema Registry instances. | yes(if `url` is not provided) |
| config | Json | To send additional configurations, configured for Schema Registry | no |
| headers | Json | To send headers to the Schema Registry | no |

For a single schema registry instance, use Field `url` or `urls` for multi instances.

Single Instance:
```json
...
"avroBytesDecoder" : {
   "type" : "schema_registry",
   "url" : <schema-registry-url>
}
...
```

Multiple Instances:
```json
...
"avroBytesDecoder" : {
   "type" : "schema_registry",
   "urls" : [<schema-registry-url-1>, <schema-registry-url-2>, ...],
   "config" : {
        "basic.auth.credentials.source": "USER_INFO",
        "basic.auth.user.info": "fred:letmein",
        "schema.registry.ssl.truststore.location": "/some/secrets/kafka.client.truststore.jks",
        "schema.registry.ssl.truststore.password": "<password>",
        "schema.registry.ssl.keystore.location": "/some/secrets/kafka.client.keystore.jks",
        "schema.registry.ssl.keystore.password": "<password>",
        "schema.registry.ssl.key.password": "<password>"
       ... 
   },
   "headers": {
       "traceID" : "b29c5de2-0db4-490b-b421",
       "timeStamp" : "1577191871865",
       ...
    }
}
...
```

### Avro OCF

> You need to include the [`druid-avro-extensions`](../development/extensions-core/avro.md) as an extension to use the Avro OCF input format.

> See the [Avro Types](../development/extensions-core/avro.md#avro-types) section for how Avro types are handled in Druid

The `inputFormat` to load data of Avro OCF format. An example is:
```json
"ioConfig": {
  "inputFormat": {
    "type": "avro_ocf",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "someRecord_subInt",
          "expr": "$.someRecord.subInt"
        }
      ]
    },
    "schema": {
      "namespace": "org.apache.druid.data.input",
      "name": "SomeDatum",
      "type": "record",
      "fields" : [
        { "name": "timestamp", "type": "long" },
        { "name": "eventType", "type": "string" },
        { "name": "id", "type": "long" },
        { "name": "someRecord", "type": {
          "type": "record", "name": "MySubRecord", "fields": [
            { "name": "subInt", "type": "int"},
            { "name": "subLong", "type": "long"}
          ]
        }}]
    },
    "binaryAsString": false
  },
  ...
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
|type| String| This should be set to `avro_ocf` to read Avro OCF file| yes |
|flattenSpec| JSON Object |Define a [`flattenSpec`](#flattenspec) to extract nested values from a Avro records. Note that only 'path' expression are supported ('jq' is unavailable).| no (default will auto-discover 'root' level properties) |
|schema| JSON Object |Define a reader schema to be used when parsing Avro records, this is useful when parsing multiple versions of Avro OCF file data | no (default will decode using the writer schema contained in the OCF file) |
| binaryAsString | Boolean | Specifies if the bytes parquet column which is not logically marked as a string or enum type should be treated as a UTF-8 encoded string. | no (default = false) |

### Protobuf

> You need to include the [`druid-protobuf-extensions`](../development/extensions-core/protobuf.md) as an extension to use the Protobuf input format.

The `inputFormat` to load data of Protobuf format. An example is:
```json
"ioConfig": {
  "inputFormat": {
    "type": "protobuf",
    "protoBytesDecoder": {
      "type": "file",
      "descriptor": "file:///tmp/metrics.desc",
      "protoMessageType": "Metrics"
    }
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "someRecord_subInt",
          "expr": "$.someRecord.subInt"
        }
      ]
    }
  },
  ...
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
|type| String| This should be set to `protobuf` to read Protobuf serialized data| yes |
|flattenSpec| JSON Object |Define a [`flattenSpec`](#flattenspec) to extract nested values from a Protobuf record. Note that only 'path' expression are supported ('jq' is unavailable).| no (default will auto-discover 'root' level properties) |
|`protoBytesDecoder`| JSON Object |Specifies how to decode bytes to Protobuf record. | yes |

### FlattenSpec

The `flattenSpec` is located in `inputFormat` → `flattenSpec` and is responsible for
bridging the gap between potentially nested input data (such as JSON, Avro, etc) and Druid's flat data model.
An example `flattenSpec` is:

```json
"flattenSpec": {
  "useFieldDiscovery": true,
  "fields": [
    { "name": "baz", "type": "root" },
    { "name": "foo_bar", "type": "path", "expr": "$.foo.bar" },
    { "name": "first_food", "type": "jq", "expr": ".thing.food[1]" }
  ]
}
```
> Conceptually, after input data records are read, the `flattenSpec` is applied first before
> any other specs such as [`timestampSpec`](./index.md#timestampspec), [`transformSpec`](./index.md#transformspec),
> [`dimensionsSpec`](./index.md#dimensionsspec), or [`metricsSpec`](./index.md#metricsspec). Keep this in mind when writing
> your ingestion spec.

Flattening is only supported for [data formats](data-formats.md) that support nesting, including `avro`, `json`, `orc`,
and `parquet`.

A `flattenSpec` can have the following components:

| Field | Description | Default |
|-------|-------------|---------|
| useFieldDiscovery | If true, interpret all root-level fields as available fields for usage by [`timestampSpec`](./index.md#timestampspec), [`transformSpec`](./index.md#transformspec), [`dimensionsSpec`](./index.md#dimensionsspec), and [`metricsSpec`](./index.md#metricsspec).<br><br>If false, only explicitly specified fields (see `fields`) will be available for use. | `true` |
| fields | Specifies the fields of interest and how they are accessed. [See below for details.](#field-flattening-specifications) | `[]` |

#### Field flattening specifications

Each entry in the `fields` list can have the following components:

| Field | Description | Default |
|-------|-------------|---------|
| type | Options are as follows:<br><br><ul><li>`root`, referring to a field at the root level of the record. Only really useful if `useFieldDiscovery` is false.</li><li>`path`, referring to a field using [JsonPath](https://github.com/jayway/JsonPath) notation. Supported by most data formats that offer nesting, including `avro`, `json`, `orc`, and `parquet`.</li><li>`jq`, referring to a field using [jackson-jq](https://github.com/eiiches/jackson-jq) notation. Only supported for the `json` format.</li></ul> | none (required) |
| name | Name of the field after flattening. This name can be referred to by the [`timestampSpec`](./index.md#timestampspec), [`transformSpec`](./index.md#transformspec), [`dimensionsSpec`](./index.md#dimensionsspec), and [`metricsSpec`](./index.md#metricsspec).| none (required) |
| expr | Expression for accessing the field while flattening. For type `path`, this should be [JsonPath](https://github.com/jayway/JsonPath). For type `jq`, this should be [jackson-jq](https://github.com/eiiches/jackson-jq) notation. For other types, this parameter is ignored. | none (required for types `path` and `jq`) |

#### Notes on flattening

* For convenience, when defining a root-level field, it is possible to define only the field name, as a string, instead of a JSON object. For example, `{"name": "baz", "type": "root"}` is equivalent to `"baz"`.
* Enabling `useFieldDiscovery` will only automatically detect "simple" fields at the root level that correspond to data types that Druid supports. This includes strings, numbers, and lists of strings or numbers. Other types will not be automatically detected, and must be specified explicitly in the `fields` list.
* Duplicate field `name`s are not allowed. An exception will be thrown.
* If `useFieldDiscovery` is enabled, any discovered field with the same name as one already defined in the `fields` list will be skipped, rather than added twice.
* [http://jsonpath.herokuapp.com/](http://jsonpath.herokuapp.com/) is useful for testing `path`-type expressions.
* jackson-jq supports a subset of the full [jq](https://stedolan.github.io/jq/) syntax.  Please refer to the [jackson-jq documentation](https://github.com/eiiches/jackson-jq) for details.

## Parser

> The Parser is deprecated for [native batch tasks](./native-batch.md), [Kafka indexing service](../development/extensions-core/kafka-ingestion.md),
and [Kinesis indexing service](../development/extensions-core/kinesis-ingestion.md).
Consider using the [input format](#input-format) instead for these types of ingestion.

This section lists all default and core extension parsers.
For community extension parsers, please see our [community extensions list](../development/extensions.md#community-extensions).

### String Parser

`string` typed parsers operate on text based inputs that can be split into individual records by newlines.
Each line can be further parsed using [`parseSpec`](#parsespec).

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `string` in general, or `hadoopyString` when used in a Hadoop indexing job. | yes |
| parseSpec | JSON Object | Specifies the format, timestamp, and dimensions of the data. | yes |

### Avro Hadoop Parser

> You need to include the [`druid-avro-extensions`](../development/extensions-core/avro.md) as an extension to use the Avro Hadoop Parser.

> See the [Avro Types](../development/extensions-core/avro.md#avro-types) section for how Avro types are handled in Druid

This parser is for [Hadoop batch ingestion](./hadoop.md).
The `inputFormat` of `inputSpec` in `ioConfig` must be set to `"org.apache.druid.data.input.avro.AvroValueInputFormat"`.
You may want to set Avro reader's schema in `jobProperties` in `tuningConfig`,
e.g.: `"avro.schema.input.value.path": "/path/to/your/schema.avsc"` or
`"avro.schema.input.value": "your_schema_JSON_object"`.
If the Avro reader's schema is not set, the schema in Avro object container file will be used.
See [Avro specification](http://avro.apache.org/docs/1.7.7/spec.html#Schema+Resolution) for more information.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `avro_hadoop`. | yes |
| parseSpec | JSON Object | Specifies the timestamp and dimensions of the data. Should be an "avro" parseSpec. | yes |
| fromPigAvroStorage | Boolean | Specifies whether the data file is stored using AvroStorage. | no(default == false) |

An Avro parseSpec can contain a [`flattenSpec`](#flattenspec) using either the "root" or "path"
field types, which can be used to read nested Avro records. The "jq" field type is not currently supported for Avro.

For example, using Avro Hadoop parser with custom reader's schema file:

```json
{
  "type" : "index_hadoop",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "",
      "parser" : {
        "type" : "avro_hadoop",
        "parseSpec" : {
          "format": "avro",
          "timestampSpec": <standard timestampSpec>,
          "dimensionsSpec": <standard dimensionsSpec>,
          "flattenSpec": <optional>
        }
      }
    },
    "ioConfig" : {
      "type" : "hadoop",
      "inputSpec" : {
        "type" : "static",
        "inputFormat": "org.apache.druid.data.input.avro.AvroValueInputFormat",
        "paths" : ""
      }
    },
    "tuningConfig" : {
       "jobProperties" : {
          "avro.schema.input.value.path" : "/path/to/my/schema.avsc"
      }
    }
  }
}
```

### ORC Hadoop Parser

> You need to include the [`druid-orc-extensions`](../development/extensions-core/orc.md) as an extension to use the ORC Hadoop Parser.

> If you are considering upgrading from earlier than 0.15.0 to 0.15.0 or a higher version,
> please read [Migration from 'contrib' extension](../development/extensions-core/orc.md#migration-from-contrib-extension) carefully.

This parser is for [Hadoop batch ingestion](./hadoop.md).
The `inputFormat` of `inputSpec` in `ioConfig` must be set to `"org.apache.orc.mapreduce.OrcInputFormat"`.

|Field     | Type        | Description                                                                            | Required|
|----------|-------------|----------------------------------------------------------------------------------------|---------|
|type      | String      | This should say `orc`                                                                  | yes|
|parseSpec | JSON Object | Specifies the timestamp and dimensions of the data (`timeAndDims` and `orc` format) and a `flattenSpec` (`orc` format) | yes|

The parser supports two `parseSpec` formats: `orc` and `timeAndDims`.

`orc` supports auto field discovery and flattening, if specified with a [`flattenSpec`](#flattenspec).
If no `flattenSpec` is specified, `useFieldDiscovery` will be enabled by default. Specifying a `dimensionSpec` is
optional if `useFieldDiscovery` is enabled: if a `dimensionSpec` is supplied, the list of `dimensions` it defines will be
the set of ingested dimensions, if missing the discovered fields will make up the list.

`timeAndDims` parse spec must specify which fields will be extracted as dimensions through the `dimensionSpec`.

[All column types](https://orc.apache.org/docs/types.md) are supported, with the exception of `union` types. Columns of
 `list` type, if filled with primitives, may be used as a multi-value dimension, or specific elements can be extracted with
`flattenSpec` expressions. Likewise, primitive fields may be extracted from `map` and `struct` types in the same manner.
Auto field discovery will automatically create a string dimension for every (non-timestamp) primitive or `list` of
primitives, as well as any flatten expressions defined in the `flattenSpec`.

#### Hadoop job properties
Like most Hadoop jobs, the best outcomes will add `"mapreduce.job.user.classpath.first": "true"` or
`"mapreduce.job.classloader": "true"` to the `jobProperties` section of `tuningConfig`. Note that it is likely if using
`"mapreduce.job.classloader": "true"` that you will need to set `mapreduce.job.classloader.system.classes` to include
`-org.apache.hadoop.hive.` to instruct Hadoop to load `org.apache.hadoop.hive` classes from the application jars instead
of system jars, e.g.

```json
...
    "mapreduce.job.classloader": "true",
    "mapreduce.job.classloader.system.classes" : "java., javax.accessibility., javax.activation., javax.activity., javax.annotation., javax.annotation.processing., javax.crypto., javax.imageio., javax.jws., javax.lang.model., -javax.management.j2ee., javax.management., javax.naming., javax.net., javax.print., javax.rmi., javax.script., -javax.security.auth.message., javax.security.auth., javax.security.cert., javax.security.sasl., javax.sound., javax.sql., javax.swing., javax.tools., javax.transaction., -javax.xml.registry., -javax.xml.rpc., javax.xml., org.w3c.dom., org.xml.sax., org.apache.commons.logging., org.apache.log4j., -org.apache.hadoop.hbase., -org.apache.hadoop.hive., org.apache.hadoop., core-default.xml, hdfs-default.xml, mapred-default.xml, yarn-default.xml",
...
```

This is due to the `hive-storage-api` dependency of the
`orc-mapreduce` library, which provides some classes under the `org.apache.hadoop.hive` package. If instead using the
setting `"mapreduce.job.user.classpath.first": "true"`, then this will not be an issue.

#### Examples

##### `orc` parser, `orc` parseSpec, auto field discovery, flatten expressions

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "orc",
          "flattenSpec": {
            "useFieldDiscovery": true,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "millis"
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

##### `orc` parser, `orc` parseSpec, field discovery with no flattenSpec or dimensionSpec

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "orc",
          "timestampSpec": {
            "column": "timestamp",
            "format": "millis"
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

##### `orc` parser, `orc` parseSpec, no autodiscovery

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "orc",
          "flattenSpec": {
            "useFieldDiscovery": false,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "millis"
          },
          "dimensionsSpec": {
            "dimensions": [
              "dim1",
              "dim3",
              "nestedDim",
              "listDimFirstItem"
            ],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

##### `orc` parser, `timeAndDims` parseSpec
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "timeAndDims",
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [
              "dim1",
              "dim2",
              "dim3",
              "listDim"
            ],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
  }
}

```

### Parquet Hadoop Parser

> You need to include the [`druid-parquet-extensions`](../development/extensions-core/parquet.md) as an extension to use the Parquet Hadoop Parser.

The Parquet Hadoop parser is for [Hadoop batch ingestion](./hadoop.md) and parses Parquet files directly.
The `inputFormat` of `inputSpec` in `ioConfig` must be set to `org.apache.druid.data.input.parquet.DruidParquetInputFormat`.

The Parquet Hadoop Parser supports auto field discovery and flattening if provided with a
[`flattenSpec`](#flattenspec) with the `parquet` `parseSpec`. Parquet nested list and map
[logical types](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md) _should_ operate correctly with
JSON path expressions for all supported types.

|Field     | Type        | Description                                                                            | Required|
|----------|-------------|----------------------------------------------------------------------------------------|---------|
| type      | String      | This should say `parquet`.| yes |
| parseSpec | JSON Object | Specifies the timestamp and dimensions of the data, and optionally, a flatten spec. Valid parseSpec formats are `timeAndDims` and `parquet` | yes |
| binaryAsString | Boolean | Specifies if the bytes parquet column which is not logically marked as a string or enum type should be treated as a UTF-8 encoded string. | no(default = false) |

When the time dimension is a [DateType column](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md),
a format should not be supplied. When the format is UTF8 (String), either `auto` or a explicitly defined
[format](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat) is required.

#### Parquet Hadoop Parser vs Parquet Avro Hadoop Parser

Both parsers read from Parquet files, but slightly differently. The main
differences are:

* The Parquet Hadoop Parser uses a simple conversion while the Parquet Avro Hadoop Parser
converts Parquet data into avro records first with the `parquet-avro` library and then
parses avro data using the `druid-avro-extensions` module to ingest into Druid.
* The Parquet Hadoop Parser sets a hadoop job property
`parquet.avro.add-list-element-records` to `false` (which normally defaults to `true`), in order to 'unwrap' primitive
list elements into multi-value dimensions.
* The Parquet Hadoop Parser supports `int96` Parquet values, while the Parquet Avro Hadoop Parser does not.
There may also be some subtle differences in the behavior of JSON path expression evaluation of `flattenSpec`.

Based on those differences, we suggest using the Parquet Hadoop Parser over the Parquet Avro Hadoop Parser
to allow ingesting data beyond the schema constraints of Avro conversion.
However, the Parquet Avro Hadoop Parser was the original basis for supporting the Parquet format, and as such it is a bit more mature.

#### Examples

##### `parquet` parser, `parquet` parseSpec
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.druid.data.input.parquet.DruidParquetInputFormat",
        "paths": "path/to/file.parquet"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "parquet",
        "parseSpec": {
          "format": "parquet",
          "flattenSpec": {
            "useFieldDiscovery": true,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

##### `parquet` parser, `timeAndDims` parseSpec
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.druid.data.input.parquet.DruidParquetInputFormat",
        "paths": "path/to/file.parquet"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "parquet",
        "parseSpec": {
          "format": "timeAndDims",
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [
              "dim1",
              "dim2",
              "dim3",
              "listDim"
            ],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
  }
}

```

### Parquet Avro Hadoop Parser

> Consider using the [Parquet Hadoop Parser](#parquet-hadoop-parser) over this parser to ingest
Parquet files. See [Parquet Hadoop Parser vs Parquet Avro Hadoop Parser](#parquet-hadoop-parser-vs-parquet-avro-hadoop-parser)
for the differences between those parsers.

> You need to include both the [`druid-parquet-extensions`](../development/extensions-core/parquet.md)
[`druid-avro-extensions`] as extensions to use the Parquet Avro Hadoop Parser.

The Parquet Avro Hadoop Parser is for [Hadoop batch ingestion](./hadoop.md).
This parser first converts the Parquet data into Avro records, and then parses them to ingest into Druid.
The `inputFormat` of `inputSpec` in `ioConfig` must be set to `org.apache.druid.data.input.parquet.DruidParquetAvroInputFormat`.

The Parquet Avro Hadoop Parser supports auto field discovery and flattening if provided with a
[`flattenSpec`](#flattenspec) with the `avro` `parseSpec`. Parquet nested list and map
[logical types](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md) _should_ operate correctly with
JSON path expressions for all supported types. This parser sets a hadoop job property
`parquet.avro.add-list-element-records` to `false` (which normally defaults to `true`), in order to 'unwrap' primitive
list elements into multi-value dimensions.

Note that the `int96` Parquet value type is not supported with this parser.

|Field     | Type        | Description                                                                            | Required|
|----------|-------------|----------------------------------------------------------------------------------------|---------|
| type      | String      | This should say `parquet-avro`. | yes |
| parseSpec | JSON Object | Specifies the timestamp and dimensions of the data, and optionally, a flatten spec. Should be `avro`. | yes |
| binaryAsString | Boolean | Specifies if the bytes parquet column which is not logically marked as a string or enum type should be treated as a UTF-8 encoded string. | no(default = false) |

When the time dimension is a [DateType column](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md),
a format should not be supplied. When the format is UTF8 (String), either `auto` or
an explicitly defined [format](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat) is required.

#### Example

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.druid.data.input.parquet.DruidParquetAvroInputFormat",
        "paths": "path/to/file.parquet"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "parquet-avro",
        "parseSpec": {
          "format": "avro",
          "flattenSpec": {
            "useFieldDiscovery": true,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

### Avro Stream Parser

> You need to include the [`druid-avro-extensions`](../development/extensions-core/avro.md) as an extension to use the Avro Stream Parser.

> See the [Avro Types](../development/extensions-core/avro.md#avro-types) section for how Avro types are handled in Druid

This parser is for [stream ingestion](./index.md#streaming) and reads Avro data from a stream directly.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `avro_stream`. | no |
| avroBytesDecoder | JSON Object | Specifies [`avroBytesDecoder`](#Avro Bytes Decoder) to decode bytes to Avro record. | yes |
| parseSpec | JSON Object | Specifies the timestamp and dimensions of the data. Should be an "avro" parseSpec. | yes |

An Avro parseSpec can contain a [`flattenSpec`](#flattenspec) using either the "root" or "path"
field types, which can be used to read nested Avro records. The "jq" field type is not currently supported for Avro.

For example, using Avro stream parser with schema repo Avro bytes decoder:

```json
"parser" : {
  "type" : "avro_stream",
  "avroBytesDecoder" : {
    "type" : "schema_repo",
    "subjectAndIdConverter" : {
      "type" : "avro_1124",
      "topic" : "${YOUR_TOPIC}"
    },
    "schemaRepository" : {
      "type" : "avro_1124_rest_client",
      "url" : "${YOUR_SCHEMA_REPO_END_POINT}",
    }
  },
  "parseSpec" : {
    "format": "avro",
    "timestampSpec": <standard timestampSpec>,
    "dimensionsSpec": <standard dimensionsSpec>,
    "flattenSpec": <optional>
  }
}
```

### Protobuf Parser

> You need to include the [`druid-protobuf-extensions`](../development/extensions-core/protobuf.md) as an extension to use the Protobuf Parser.

This parser is for [stream ingestion](./index.md#streaming) and reads Protocol buffer data from a stream directly.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `protobuf`. | yes |
| `protoBytesDecoder` | JSON Object | Specifies how to decode bytes to Protobuf record. | yes |
| parseSpec | JSON Object | Specifies the timestamp and dimensions of the data.  The format must be JSON. See [JSON ParseSpec](./index.md) for more configuration options.  Note that timeAndDims parseSpec is no longer supported. | yes |

Sample spec:

```json
"parser": {
  "type": "protobuf",
  "protoBytesDecoder": {
    "type": "file",
    "descriptor": "file:///tmp/metrics.desc",
    "protoMessageType": "Metrics"
  },
  "parseSpec": {
    "format": "json",
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [
        "unit",
        "http_method",
        "http_code",
        "page",
        "metricType",
        "server"
      ],
      "dimensionExclusions": [
        "timestamp",
        "value"
      ]
    }
  }
}
```

See the [extension description](../development/extensions-core/protobuf.md) for
more details and examples.

#### Protobuf Bytes Decoder

If `type` is not included, the `protoBytesDecoder` defaults to `schema_registry`.

##### File-based Protobuf Bytes Decoder

This Protobuf bytes decoder first read a descriptor file, and then parse it to get schema used to decode the Protobuf record from bytes.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `file`. | yes |
| descriptor | String | Protobuf descriptor file name in the classpath or URL. | yes |
| protoMessageType | String | Protobuf message type in the descriptor.  Both short name and fully qualified name are accepted.  The parser uses the first message type found in the descriptor if not specified. | no |

Sample spec:

```json
"protoBytesDecoder": {
  "type": "file",
  "descriptor": "file:///tmp/metrics.desc",
  "protoMessageType": "Metrics"
}
```

##### Confluent Schema Registry-based Protobuf Bytes Decoder

This Protobuf bytes decoder first extracts a unique `id` from input message bytes, and then uses it to look up the schema in the Schema Registry used to decode the Avro record from bytes.
For details, see the Schema Registry [documentation](http://docs.confluent.io/current/schema-registry/docs/) and [repository](https://github.com/confluentinc/schema-registry).

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| type | String | This should say `schema_registry`. | yes |
| url | String | Specifies the url endpoint of the Schema Registry. | yes |
| capacity | Integer | Specifies the max size of the cache (default = Integer.MAX_VALUE). | no |
| urls | Array<String> | Specifies the url endpoints of the multiple Schema Registry instances. | yes(if `url` is not provided) |
| config | Json | To send additional configurations, configured for Schema Registry | no |
| headers | Json | To send headers to the Schema Registry | no |

For a single schema registry instance, use Field `url` or `urls` for multi instances.

Single Instance:

```json
...
"protoBytesDecoder": {
  "url": <schema-registry-url>,
  "type": "schema_registry"
}
...
```

Multiple Instances:
```json
...
"protoBytesDecoder": {
  "urls": [<schema-registry-url-1>, <schema-registry-url-2>, ...],
  "type": "schema_registry",
  "capacity": 100,
  "config" : {
       "basic.auth.credentials.source": "USER_INFO",
       "basic.auth.user.info": "fred:letmein",
       "schema.registry.ssl.truststore.location": "/some/secrets/kafka.client.truststore.jks",
       "schema.registry.ssl.truststore.password": "<password>",
       "schema.registry.ssl.keystore.location": "/some/secrets/kafka.client.keystore.jks",
       "schema.registry.ssl.keystore.password": "<password>",
       "schema.registry.ssl.key.password": "<password>",
         ... 
  },
  "headers": {
      "traceID" : "b29c5de2-0db4-490b-b421",
      "timeStamp" : "1577191871865",
      ...
  }
}
...
```

## ParseSpec

> The Parser is deprecated for [native batch tasks](./native-batch.md), [Kafka indexing service](../development/extensions-core/kafka-ingestion.md),
and [Kinesis indexing service](../development/extensions-core/kinesis-ingestion.md).
Consider using the [input format](#input-format) instead for these types of ingestion.

ParseSpecs serve two purposes:

- The String Parser use them to determine the format (i.e., JSON, CSV, TSV) of incoming rows.
- All Parsers use them to determine the timestamp and dimensions of incoming rows.

If `format` is not included, the parseSpec defaults to `tsv`.

### JSON ParseSpec

Use this with the String Parser to load JSON.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `json`. | no |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |
| flattenSpec | JSON Object | Specifies flattening configuration for nested JSON data. See [`flattenSpec`](#flattenspec) for more info. | no |

Sample spec:

```json
"parseSpec": {
  "format" : "json",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "dimensionSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  }
}
```

### JSON Lowercase ParseSpec

> The _jsonLowercase_ parser is deprecated and may be removed in a future version of Druid.

This is a special variation of the JSON ParseSpec that lower cases all the column names in the incoming JSON data. This parseSpec is required if you are updating to Druid 0.7.x from Druid 0.6.x, are directly ingesting JSON with mixed case column names, do not have any ETL in place to lower case those column names, and would like to make queries that include the data you created using 0.6.x and 0.7.x.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `jsonLowercase`. | yes |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |

### CSV ParseSpec

Use this with the String Parser to load CSV. Strings are parsed using the com.opencsv library.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `csv`. | yes |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |
| listDelimiter | String | A custom delimiter for multi-value dimensions. | no (default = ctrl+A) |
| columns | JSON array | Specifies the columns of the data. | yes |

Sample spec:

```json
"parseSpec": {
  "format" : "csv",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"],
  "dimensionsSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  }
}
```

#### CSV Index Tasks

If your input files contain a header, the `columns` field is optional and you don't need to set.
Instead, you can set the `hasHeaderRow` field to true, which makes Druid automatically extract the column information from the header.
Otherwise, you must set the `columns` field and ensure that field must match the columns of your input data in the same order.

Also, you can skip some header rows by setting `skipHeaderRows` in your parseSpec. If both `skipHeaderRows` and `hasHeaderRow` options are set,
`skipHeaderRows` is first applied. For example, if you set `skipHeaderRows` to 2 and `hasHeaderRow` to true, Druid will
skip the first two lines and then extract column information from the third line.

Note that `hasHeaderRow` and `skipHeaderRows` are effective only for non-Hadoop batch index tasks. Other types of index
tasks will fail with an exception.

#### Other CSV Ingestion Tasks

The `columns` field must be included and and ensure that the order of the fields matches the columns of your input data in the same order.

### TSV / Delimited ParseSpec

Use this with the String Parser to load any delimited text that does not require special escaping. By default,
the delimiter is a tab, so this will load TSV.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `tsv`. | yes |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |
| delimiter | String | A custom delimiter for data values. | no (default = \t) |
| listDelimiter | String | A custom delimiter for multi-value dimensions. | no (default = ctrl+A) |
| columns | JSON String array | Specifies the columns of the data. | yes |

Sample spec:

```json
"parseSpec": {
  "format" : "tsv",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"],
  "delimiter":"|",
  "dimensionsSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  }
}
```

Be sure to change the `delimiter` to the appropriate delimiter for your data. Like CSV, you must specify the columns and which subset of the columns you want indexed.

#### TSV (Delimited) Index Tasks

If your input files contain a header, the `columns` field is optional and doesn't need to be set.
Instead, you can set the `hasHeaderRow` field to true, which makes Druid automatically extract the column information from the header.
Otherwise, you must set the `columns` field and ensure that field must match the columns of your input data in the same order.

Also, you can skip some header rows by setting `skipHeaderRows` in your parseSpec. If both `skipHeaderRows` and `hasHeaderRow` options are set,
`skipHeaderRows` is first applied. For example, if you set `skipHeaderRows` to 2 and `hasHeaderRow` to true, Druid will
skip the first two lines and then extract column information from the third line.

Note that `hasHeaderRow` and `skipHeaderRows` are effective only for non-Hadoop batch index tasks. Other types of index
tasks will fail with an exception.

#### Other TSV (Delimited) Ingestion Tasks

The `columns` field must be included and and ensure that the order of the fields matches the columns of your input data in the same order.

### Multi-value dimensions

Dimensions can have multiple values for TSV and CSV data. To specify the delimiter for a multi-value dimension, set the `listDelimiter` in the `parseSpec`.

JSON data can contain multi-value dimensions as well. The multiple values for a dimension must be formatted as a JSON array in the ingested data. No additional `parseSpec` configuration is needed.

### Regex ParseSpec

```json
"parseSpec":{
  "format" : "regex",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "dimensionsSpec" : {
    "dimensions" : [<your_list_of_dimensions>]
  },
  "columns" : [<your_columns_here>],
  "pattern" : <regex pattern for partitioning data>
}
```

The `columns` field must match the columns of your regex matching groups in the same order. If columns are not provided, default
columns names ("column_1", "column2", ... "column_n") will be assigned. Ensure that your column names include all your dimensions.

### JavaScript ParseSpec

```json
"parseSpec":{
  "format" : "javascript",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "dimensionsSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  },
  "function" : "function(str) { var parts = str.split(\"-\"); return { one: parts[0], two: parts[1] } }"
}
```

Note with the JavaScript parser that data must be fully parsed and returned as a `{key:value}` format in the JS logic.
This means any flattening or parsing multi-dimensional values must be done here.

> JavaScript-based functionality is disabled by default. Please refer to the Druid [JavaScript programming guide](../development/javascript.md) for guidelines about using Druid's JavaScript functionality, including instructions on how to enable it.

### TimeAndDims ParseSpec

Use this with non-String Parsers to provide them with timestamp and dimensions information. Non-String Parsers
handle all formatting decisions on their own, without using the ParseSpec.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `timeAndDims`. | yes |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |

### Orc ParseSpec

Use this with the Hadoop ORC Parser to load ORC files.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `orc`. | no |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |
| flattenSpec | JSON Object | Specifies flattening configuration for nested JSON data. See [`flattenSpec`](#flattenspec) for more info. | no |

### Parquet ParseSpec

Use this with the Hadoop Parquet Parser to load Parquet files.

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| format | String | This should say `parquet`. | no |
| timestampSpec | JSON Object | Specifies the column and format of the timestamp. | yes |
| dimensionsSpec | JSON Object | Specifies the dimensions of the data. | yes |
| flattenSpec | JSON Object | Specifies flattening configuration for nested JSON data. See [`flattenSpec`](#flattenspec) for more info. | no |



## 数据格式
Apache Druid可以接收JSON、CSV或TSV等分隔格式或任何自定义格式的非规范化数据。尽管文档中的大多数示例使用JSON格式的数据，但将Druid配置为接收任何其他分隔数据并不困难。我们欢迎对新格式的任何贡献。

此页列出了Druid支持的所有默认和核心扩展数据格式。有关社区扩展支持的其他数据格式，请参阅我们的 [社区扩展列表](../configuration/logging.md#社区扩展)。

### 格式化数据

下面的示例显示了在Druid中原生支持的数据格式：

*JSON*
```json
{"timestamp": "2013-08-31T01:02:33Z", "page": "Gypsy Danger", "language" : "en", "user" : "nuclear", "unpatrolled" : "true", "newPage" : "true", "robot": "false", "anonymous": "false", "namespace":"article", "continent":"North America", "country":"United States", "region":"Bay Area", "city":"San Francisco", "added": 57, "deleted": 200, "delta": -143}
{"timestamp": "2013-08-31T03:32:45Z", "page": "Striker Eureka", "language" : "en", "user" : "speed", "unpatrolled" : "false", "newPage" : "true", "robot": "true", "anonymous": "false", "namespace":"wikipedia", "continent":"Australia", "country":"Australia", "region":"Cantebury", "city":"Syndey", "added": 459, "deleted": 129, "delta": 330}
{"timestamp": "2013-08-31T07:11:21Z", "page": "Cherno Alpha", "language" : "ru", "user" : "masterYi", "unpatrolled" : "false", "newPage" : "true", "robot": "true", "anonymous": "false", "namespace":"article", "continent":"Asia", "country":"Russia", "region":"Oblast", "city":"Moscow", "added": 123, "deleted": 12, "delta": 111}
{"timestamp": "2013-08-31T11:58:39Z", "page": "Crimson Typhoon", "language" : "zh", "user" : "triplets", "unpatrolled" : "true", "newPage" : "false", "robot": "true", "anonymous": "false", "namespace":"wikipedia", "continent":"Asia", "country":"China", "region":"Shanxi", "city":"Taiyuan", "added": 905, "deleted": 5, "delta": 900}
{"timestamp": "2013-08-31T12:41:27Z", "page": "Coyote Tango", "language" : "ja", "user" : "cancer", "unpatrolled" : "true", "newPage" : "false", "robot": "true", "anonymous": "false", "namespace":"wikipedia", "continent":"Asia", "country":"Japan", "region":"Kanto", "city":"Tokyo", "added": 1, "deleted": 10, "delta": -9}
```

*CSV*
```json
2013-08-31T01:02:33Z,"Gypsy Danger","en","nuclear","true","true","false","false","article","North America","United States","Bay Area","San Francisco",57,200,-143
2013-08-31T03:32:45Z,"Striker Eureka","en","speed","false","true","true","false","wikipedia","Australia","Australia","Cantebury","Syndey",459,129,330
2013-08-31T07:11:21Z,"Cherno Alpha","ru","masterYi","false","true","true","false","article","Asia","Russia","Oblast","Moscow",123,12,111
2013-08-31T11:58:39Z,"Crimson Typhoon","zh","triplets","true","false","true","false","wikipedia","Asia","China","Shanxi","Taiyuan",905,5,900
2013-08-31T12:41:27Z,"Coyote Tango","ja","cancer","true","false","true","false","wikipedia","Asia","Japan","Kanto","Tokyo",1,10,-9
```

*TSV(Delimited)*
```json
2013-08-31T01:02:33Z  "Gypsy Danger"  "en"  "nuclear" "true"  "true"  "false" "false" "article" "North America" "United States" "Bay Area"  "San Francisco" 57  200 -143
2013-08-31T03:32:45Z  "Striker Eureka"  "en"  "speed" "false" "true"  "true"  "false" "wikipedia" "Australia" "Australia" "Cantebury" "Syndey"  459 129 330
2013-08-31T07:11:21Z  "Cherno Alpha"  "ru"  "masterYi"  "false" "true"  "true"  "false" "article" "Asia"  "Russia"  "Oblast"  "Moscow"  123 12  111
2013-08-31T11:58:39Z  "Crimson Typhoon" "zh"  "triplets"  "true"  "false" "true"  "false" "wikipedia" "Asia"  "China" "Shanxi"  "Taiyuan" 905 5 900
2013-08-31T12:41:27Z  "Coyote Tango"  "ja"  "cancer"  "true"  "false" "true"  "false" "wikipedia" "Asia"  "Japan" "Kanto" "Tokyo" 1 10  -9
```

请注意，CSV和TSV数据不包含列标题。当您指定要摄取的数据时，这一点就变得很重要。

除了文本格式，Druid还支持二进制格式，比如 [Orc](#orc) 和 [Parquet](#parquet) 格式。

### 定制格式

Druid支持自定义数据格式，可以使用 `Regex` 解析器或 `JavaScript` 解析器来解析这些格式。请注意，使用这些解析器中的任何一个来解析数据都不如编写原生Java解析器或使用外部流处理器那样高效。我们欢迎新解析器的贡献。

### InputFormat

> [!WARNING]
> 输入格式是在0.17.0中引入的指定输入数据的数据格式的新方法。不幸的是，输入格式还不支持Druid支持的所有数据格式或摄取方法。特别是如果您想使用Hadoop接收，您仍然需要使用 [解析器](#parser)。如果您的数据是以本节未列出的某种格式格式化的，请考虑改用解析器。

所有形式的Druid摄取都需要某种形式的schema对象。要摄取的数据的格式是使用[`ioConfig`](/ingestion.md#ioConfig) 中的 `inputFormat` 条目指定的。

#### JSON

**JSON**
一个加载JSON格式数据的 `inputFormat` 示例：
```json
"ioConfig": {
  "inputFormat": {
    "type": "json"
  },
  ...
}
```
JSON `inputFormat` 有以下组件：

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 填 `json` | 是 |
| flattenSpec | JSON对象 | 指定嵌套JSON数据的展平配置。更多信息请参见[flattenSpec](#flattenspec) | 否 |
| featureSpec | JSON对象 | Jackson库支持的 [JSON解析器特性](https://github.com/FasterXML/jackson-core/wiki/JsonParser-Features) 。这些特性将在解析输入JSON数据时应用。 | 否 |


#### CSV
一个加载CSV格式数据的 `inputFormat` 示例：
```json
"ioConfig": {
  "inputFormat": {
    "type": "csv",
    "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"]
  },
  ...
}
```

CSV `inputFormat` 有以下组件：

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 填 `csv` | 是 |
| listDelimiter | String | 多值维度的定制分隔符 | 否(默认ctrl + A) |
| columns | JSON数组 | 指定数据的列。列的顺序应该与数据列的顺序相同。 | 如果 `findColumnsFromHeader` 设置为 `false` 或者缺失， 则为必填项 |
| findColumnsFromHeader | 布尔 | 如果设置了此选项，则任务将从标题行中查找列名。请注意，在从标题中查找列名之前，将首先使用 `skipHeaderRows`。例如，如果将 `skipHeaderRows` 设置为2，将 `findColumnsFromHeader` 设置为 `true`，则任务将跳过前两行，然后从第三行提取列信息。该项如果设置为true，则将忽略 `columns` | 否（如果 `columns` 被设置则默认为 `false`, 否则为null） |
| skipHeaderRows | 整型数值 | 该项如果设置，任务将略过 `skipHeaderRows`配置的行数 | 否（默认为0） |

#### TSV(Delimited)
```json
"ioConfig": {
  "inputFormat": {
    "type": "tsv",
    "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"],
    "delimiter":"|"
  },
  ...
}
```
TSV `inputFormat` 有以下组件：

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 填 `tsv` | 是 |
| delimiter | String | 数据值的自定义分隔符 | 否(默认为 `\t`) |
| listDelimiter | String | 多值维度的定制分隔符 | 否(默认ctrl + A) |
| columns | JSON数组 | 指定数据的列。列的顺序应该与数据列的顺序相同。 | 如果 `findColumnsFromHeader` 设置为 `false` 或者缺失， 则为必填项 |
| findColumnsFromHeader | 布尔 | 如果设置了此选项，则任务将从标题行中查找列名。请注意，在从标题中查找列名之前，将首先使用 `skipHeaderRows`。例如，如果将 `skipHeaderRows` 设置为2，将 `findColumnsFromHeader` 设置为 `true`，则任务将跳过前两行，然后从第三行提取列信息。该项如果设置为true，则将忽略 `columns` | 否（如果 `columns` 被设置则默认为 `false`, 否则为null） |
| skipHeaderRows | 整型数值 | 该项如果设置，任务将略过 `skipHeaderRows`配置的行数 | 否（默认为0） |

请确保将分隔符更改为适合于数据的分隔符。与CSV一样，您必须指定要索引的列和列的子集。

#### ORC

> [!WARNING]
> 使用ORC输入格式之前，首先需要包含 [druid-orc-extensions](../development/orc-extensions.md)

> [!WARNING]
> 如果您正在考虑从早于0.15.0的版本升级到0.15.0或更高版本，请仔细阅读 [从contrib扩展的迁移](../development/orc-extensions.md#从contrib扩展迁移)。

一个加载ORC格式数据的 `inputFormat` 示例：
```json
"ioConfig": {
  "inputFormat": {
    "type": "orc",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "nested",
          "expr": "$.path.to.nested"
        }
      ]
    }
    "binaryAsString": false
  },
  ...
}
```

ORC `inputFormat` 有以下组件：

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 填 `orc` | 是 |
| flattenSpec | JSON对象 | 指定嵌套JSON数据的展平配置。更多信息请参见[flattenSpec](#flattenspec) | 否 |
| binaryAsString | 布尔类型 | 指定逻辑上未标记为字符串的二进制orc列是否应被视为UTF-8编码字符串。 | 否（默认为false） |

#### Parquet

> [!WARNING]
> 使用Parquet输入格式之前，首先需要包含 [druid-parquet-extensions](../development/parquet-extensions.md)

一个加载Parquet格式数据的 `inputFormat` 示例：
```json
"ioConfig": {
  "inputFormat": {
    "type": "parquet",
    "flattenSpec": {
      "useFieldDiscovery": true,
      "fields": [
        {
          "type": "path",
          "name": "nested",
          "expr": "$.path.to.nested"
        }
      ]
    }
    "binaryAsString": false
  },
  ...
}
```

Parquet `inputFormat` 有以下组件：

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 填 `parquet` | 是 |
| flattenSpec | JSON对象 | 定义一个 [flattenSpec](#flattenspec) 从Parquet文件提取嵌套的值。注意，只支持"path"表达式（'jq'不可用）| 否（默认自动发现根级别的属性） |
| binaryAsString | 布尔类型 | 指定逻辑上未标记为字符串的二进制orc列是否应被视为UTF-8编码字符串。 | 否（默认为false） |

#### FlattenSpec

`flattenSpec` 位于 `inputFormat` -> `flattenSpec` 中，负责将潜在的嵌套输入数据（如JSON、Avro等）和Druid的平面数据模型之间架起桥梁。 `flattenSpec` 示例如下：
```json
"flattenSpec": {
  "useFieldDiscovery": true,
  "fields": [
    { "name": "baz", "type": "root" },
    { "name": "foo_bar", "type": "path", "expr": "$.foo.bar" },
    { "name": "first_food", "type": "jq", "expr": ".thing.food[1]" }
  ]
}
```
> [!WARNING]
> 概念上，输入数据被读取后，Druid会以一个特定的顺序来对数据应用摄入规范： 首先 `flattenSpec`(如果有)，然后 `timestampSpec`, 然后 `transformSpec` ,最后是 `dimensionsSpec` 和 `metricsSpec`。在编写摄入规范时需要牢记这一点

展平操作仅仅支持嵌套的 [数据格式](dataformats.md), 包括：`avro`, `json`, `orc` 和 `parquet`。

`flattenSpec` 有以下组件：

| 字段 | 描述 | 默认值 |
|-|-|-|
| useFieldDiscovery | 如果为true，则将所有根级字段解释为可用字段，供 [`timestampSpec`](/ingestion.md#timestampSpec)、[`transformSpec`](/ingestion.md#transformSpec)、[`dimensionsSpec`](/ingestion.md#dimensionsSpec) 和 [`metricsSpec`](/ingestion.md#metricsSpec) 使用。<br><br> 如果为false，则只有显式指定的字段（请参阅 `fields`）才可供使用。 | true |
| fields | 指定感兴趣的字段及其访问方式, 详细请见下边 | `[]` |

**字段展平规范**

`fields` 列表中的每个条目都可以包含以下组件：

<table>
  <thead>
    <tr>
      <td>字段</td>
      <td>描述</td>
      <td>默认值</td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>type</td>
      <td>
        可选项如下：
        <ul>
          <li><code>root</code>, 引用记录根级别的字段。只有当<code>useFieldDiscovery</code> 为false时才真正有用。</li>
          <li><code>path</code>, 引用使用 <a href="https://github.com/json-path/JsonPath">JsonPath</a> 表示法的字段，支持大多数提供嵌套的数据格式，包括<code>avro</code>,<code>csv</code>, <code>json</code> 和 <code>parquet</code></li>
          <li><code>jq</code>, 引用使用 <a href="https://github.com/eiiches/jackson-jq">jackson-jq</a> 表示法的字段， 仅仅支持<code>json</code>格式</li>
        </ul>
      </td>
      <td>none(必填)</td>
    </tr>
    <tr>
      <td>name</td>
      <td>展平后的字段名称。这个名称可以被<code>timestampSpec</code>, <code>transformSpec</code>, <code>dimensionsSpec</code>和<code>metricsSpec</code>引用</td>
      <td>none(必填)</td>
    </tr>
    <tr>
      <td>expr</td>
      <td>用于在展平时访问字段的表达式。对于类型 `path`，这应该是 <a href="https://github.com/json-path/JsonPath">JsonPath</a>。对于 `jq` 类型，这应该是 <a href="https://github.com/eiiches/jackson-jq">jackson-jq</a> 表达式。对于其他类型，将忽略此参数。</td>
      <td>none(对于 `path` 和 `jq` 类型的为必填)</td>
    </tr>
  </tbody>
</table>

**展平操作的注意事项**

* 为了方便起见，在定义根级字段时，可以只将字段名定义为字符串，而不是JSON对象。例如 `{"name": "baz", "type": "root"}` 等价于 `baz`
* 启用 `useFieldDiscovery` 只会在根级别自动检测与Druid支持的数据类型相对应的"简单"字段, 这包括字符串、数字和字符串或数字列表。不会自动检测到其他类型，其他类型必须在 `fields` 列表中显式指定
* 不允许重复字段名（`name`）, 否则将引发异常
* 如果启用 `useFieldDiscovery`，则将跳过与字段列表中已定义的字段同名的任何已发现字段，而不是添加两次
* [http://jsonpath.herokuapp.com/](http://jsonpath.herokuapp.com/) 对于测试 `path`-类型表达式非常有用
* jackson jq支持完整 [`jq`](https://stedolan.github.io/jq/)语法的一个子集。有关详细信息，请参阅 [jackson jq](https://github.com/eiiches/jackson-jq) 文档

### Parser

> [!WARNING]
> parser在 [本地批任务](native.md), [Kafka索引任务](kafka.md) 和 [Kinesis索引任务](kinesis.md) 中已经废弃，在这些类型的摄入方式中考虑使用 [inputFormat](#数据格式)

该部分列出来了所有默认的以及核心扩展中的解析器。对于社区的扩展解析器，请参见 [社区扩展列表](../development/extensions.md#社区扩展)

#### String Parser

`string` 类型的解析器对基于文本的输入进行操作，这些输入可以通过换行符拆分为单独的记录, 可以使用 [`parseSpec`](#parsespec) 进一步分析每一行。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | string | 一般是 `string`, 在Hadoop索引任务中为 `hadoopyString` | 是 |
| parseSpec | JSON对象 | 指定格式，数据的timestamp和dimensions | 是 |

#### Avro Hadoop Parser

> [!WARNING]
> 需要添加 [druid-avro-extensions](../development/avro-extensions.md) 来使用 Avro Hadoop解析器

该解析器用于 [Hadoop批摄取](hadoop.md)。在 `ioConfig` 中，`inputSpec` 中的 `inputFormat` 必须设置为 `org.apache.druid.data.input.avro.AvroValueInputFormat`。您可能想在 `tuningConfig` 中的 `jobProperties` 选项设置Avro reader的schema， 例如：`"avro.schema.input.value.path": "/path/to/your/schema.avsc"` 或者 `"avro.schema.input.value": "your_schema_JSON_object"`。如果未设置Avro读取器的schema，则将使用Avro对象容器文件中的schema，详情可以参见 [avro规范](http://avro.apache.org/docs/1.7.7/spec.html#Schema+Resolution)

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 应该填 `avro_hadoop` | 是 |
| parseSpec | JSON对象 | 指定数据的时间戳和维度。应该是“avro”语法规范。| 是 |

Avro parseSpec可以包含使用"root"或"path"字段类型的 [flattenSpec](#flattenspec)，这些字段类型可用于读取嵌套的Avro记录。Avro当前不支持“jq”字段类型。

例如，使用带有自定义读取器schema文件的Avro Hadoop解析器：
```json
{
  "type" : "index_hadoop",
  "spec" : {
    "dataSchema" : {
      "dataSource" : "",
      "parser" : {
        "type" : "avro_hadoop",
        "parseSpec" : {
          "format": "avro",
          "timestampSpec": <standard timestampSpec>,
          "dimensionsSpec": <standard dimensionsSpec>,
          "flattenSpec": <optional>
        }
      }
    },
    "ioConfig" : {
      "type" : "hadoop",
      "inputSpec" : {
        "type" : "static",
        "inputFormat": "org.apache.druid.data.input.avro.AvroValueInputFormat",
        "paths" : ""
      }
    },
    "tuningConfig" : {
       "jobProperties" : {
          "avro.schema.input.value.path" : "/path/to/my/schema.avsc"
      }
    }
  }
}
```

#### ORC Hadoop Parser

> [!WARNING]
> 需要添加 [druid-orc-extensions](../development/orc-extensions.md) 来使用ORC Hadoop解析器

> [!WARNING]
> 如果您正在考虑从早于0.15.0的版本升级到0.15.0或更高版本，请仔细阅读 [从contrib扩展的迁移](../development/orc-extensions.md#从contrib扩展迁移)。

该解析器用于 [Hadoop批摄取](hadoop.md)。在 `ioConfig` 中，`inputSpec` 中的 `inputFormat` 必须设置为 `org.apache.orc.mapreduce.OrcInputFormat`。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 应该填 `orc` | 是 |
| parseSpec | JSON对象 | 指定数据(`timeAndDim` 和 `orc` 格式)的时间戳和维度和一个`flattenSpec`（`orc`格式）| 是 |

解析器支持两种 `parseSpec` 格式： `orc` 和 `timeAndDims`

`orc` 支持字段的自动发现和展平（如果指定了 [flattenSpec](#flattenspec)。如果未指定展平规范，则默认情况下将启用 `useFieldDiscovery`。如果启用了 `useFieldDiscovery`，则指定`dimensionSpec` 是可选的：如果提供了 `dimensionSpec`，则它定义的维度列表将是摄取维度的集合，如果缺少发现的字段将构成该列表。

`timeAndDims` 解析规范必须通过 `dimensionSpec` 指定哪些字段将提取为维度。

支持所有 [列类型](https://orc.apache.org/docs/types.html) ，但 `union` 类型除外。`list` 类型的列（如果用基本类型填充）可以用作多值维度，或者可以使用 [flattenSpec](#flattenspec) 表达式提取特定元素。同样，可以用同样的方式从 `map` 和 `struct` 类型中提取基本字段。自动字段发现将自动为每个（非时间戳）基本类型或基本类型 `list` 以及 `flattenSpec` 中定义的任何展平表达式创建字符串维度。

**Hadoop job属性**

像大多数Hadoop作业，最佳结果是在 `tuningConfig` 中的 `jobProperties` 中添加 `"mapreduce.job.user.classpath.first": "true"` 或者 `"mapreduce.job.classloader": "true"`。 注意，如果使用了 `"mapreduce.job.classloader": "true"`, 需要设置 `mapreduce.job.classloader.system.classes` 包含 `-org.apache.hadoop.hive.` 来让Hadoop从应用jars包中加载 `org.apache.hadoop.hive` 而非从系统jar中，例如：

```json
...
    "mapreduce.job.classloader": "true",
    "mapreduce.job.classloader.system.classes" : "java., javax.accessibility., javax.activation., javax.activity., javax.annotation., javax.annotation.processing., javax.crypto., javax.imageio., javax.jws., javax.lang.model., -javax.management.j2ee., javax.management., javax.naming., javax.net., javax.print., javax.rmi., javax.script., -javax.security.auth.message., javax.security.auth., javax.security.cert., javax.security.sasl., javax.sound., javax.sql., javax.swing., javax.tools., javax.transaction., -javax.xml.registry., -javax.xml.rpc., javax.xml., org.w3c.dom., org.xml.sax., org.apache.commons.logging., org.apache.log4j., -org.apache.hadoop.hbase., -org.apache.hadoop.hive., org.apache.hadoop., core-default.xml, hdfs-default.xml, mapred-default.xml, yarn-default.xml",
...
```

这是因为 `orc-mapreduce` 库的配置单元 `hive-storage-api` 依赖关系，它在 `org.apache.hadoop.hive` 包下提供了一些类。如果改为使用`"mapreduce.job.user.classpath.first"："true"`设置，则不会出现此问题。

**示例**

**`orc` parser, `orc` parseSpec, 自动字段发现, 展平表达式**
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "orc",
          "flattenSpec": {
            "useFieldDiscovery": true,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "millis"
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

**`orc` parser, `orc` parseSpec, 不具有 `flattenSpec` 或者 `dimensionSpec`的字段发现**

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "orc",
          "timestampSpec": {
            "column": "timestamp",
            "format": "millis"
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```
**`orc` parser, `orc` parseSpec, 非自动发现**

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "orc",
          "flattenSpec": {
            "useFieldDiscovery": false,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "millis"
          },
          "dimensionsSpec": {
            "dimensions": [
              "dim1",
              "dim3",
              "nestedDim",
              "listDimFirstItem"
            ],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

**`orc` parser, `timeAndDims` parseSpec**

```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.orc.mapreduce.OrcInputFormat",
        "paths": "path/to/file.orc"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "orc",
        "parseSpec": {
          "format": "timeAndDims",
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [
              "dim1",
              "dim2",
              "dim3",
              "listDim"
            ],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
  }
}
```

#### Parquet Hadoop Parser

> [!WARNING]
> 需要添加 [druid-parquet-extensions](../development/parquet-extensions.md) 来使用Parquet Hadoop解析器

该解析器用于 [Hadoop批摄取](hadoop.md)。在 `ioConfig` 中，`inputSpec` 中的 `inputFormat` 必须设置为 `org.apache.druid.data.input.parquet.DruidParquetInputFormat`。

Parquet Hadoop 解析器支持自动字段发现，如果提供了一个带有 `parquet` `parquetSpec`的 `flattenSpec` 也支持展平。 Parquet嵌套 list 和 map [逻辑类型](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md) 应与所有受支持类型的JSON path表达式一起正确操作。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 应该填 `parquet` | 是 |
| parseSpec | JSON对象 | 指定数据的时间戳和维度和一个可选的 `flattenSpec`。有效的 `parseSpec` 格式是 `timeAndDims` 和 `parquet` | 是 |
| binaryAsString | 布尔类型 | 指定逻辑上未标记为字符串的二进制orc列是否应被视为UTF-8编码字符串。 | 否（默认为false） |

当时间维度是一个 [date类型的列](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md), 则无需指定一个格式。 当格式为UTF8的String， 则要么指定为 `auto`，或者显式的指定一个 [时间格式](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html)。

**Parquet Hadoop解析器 vs Parquet Avro Hadoop解析器**
两者都是从Parquet文件中读取，但是又轻微的不同。主要不同之处是：
* Parquet Hadoop解析器使用简单的转换，而Parquet Avro Hadoop解析器首先使用 `parquet-avro` 库将Parquet数据转换为Avro记录，然后使用 `druid-avro-extensions` 模块将Avro数据解析为druid
* Parquet Hadoop解析器将Hadoop作业属性 `parquet.avro.add-list-element-records` 设置为false（通常默认为true），以便将原始列表元素"展开"为多值维度
* Parquet Hadoop解析器支持 `int96` Parquet值，而 Parquet Avro Hadoop解析器不支持。`flatteSpec` 的JSON path表达式求值的行为也可能存在一些细微的差异

基于这些差异，我们建议在Parquet avro hadoop解析器上使用Parquet Hadoop解析器，以允许摄取超出Avro转换模式约束的数据。然而，Parquet Avro Hadoop解析器是支持Parquet格式的原始基础，因此它更加成熟。

**示例**

`parquet` parser, `parquet` parseSpec
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.druid.data.input.parquet.DruidParquetInputFormat",
        "paths": "path/to/file.parquet"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "parquet",
        "parseSpec": {
          "format": "parquet",
          "flattenSpec": {
            "useFieldDiscovery": true,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```
`parquet` parser, `timeAndDims` parseSpec
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.druid.data.input.parquet.DruidParquetInputFormat",
        "paths": "path/to/file.parquet"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "parquet",
        "parseSpec": {
          "format": "timeAndDims",
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [
              "dim1",
              "dim2",
              "dim3",
              "listDim"
            ],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
  }
}
```

#### Parquet Avro Hadoop Parser

> [!WARNING]
> 考虑在该解析器之上使用 [Parquet Hadoop Parser](#parquet-hadoop-parser) 来摄取Parquet文件。 两者之间的不同之处参见 [Parquet Hadoop解析器 vs Parquet Avro Hadoop解析器]() 部分

> [!WARNING]
> 使用Parquet Avro Hadoop Parser需要同时加入 [druid-parquet-extensions](../development/parquet-extensions.md) 和 [druid-avro-extensions](../development/avro-extensions.md)

该解析器用于 [Hadoop批摄取](hadoop.md), 该解析器首先将Parquet数据转换为Avro记录，然后再解析它们后摄入到Druid。在 `ioConfig` 中，`inputSpec` 中的 `inputFormat` 必须设置为 `org.apache.druid.data.input.parquet.DruidParquetAvroInputFormat`。

Parquet Avro Hadoop 解析器支持自动字段发现，如果提供了一个带有 `avro` `parquetSpec`的 `flattenSpec` 也支持展平。 Parquet嵌套 list 和 map [逻辑类型](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md) 应与所有受支持类型的JSON path表达式一起正确操作。该解析器将Hadoop作业属性 `parquet.avro.add-list-element-records` 设置为false（通常默认为true），以便将原始列表元素"展开"为多值维度。

注意，`int96` Parquet值类型在该解析器中是不支持的。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| type | String | 应该填 `parquet-avro` | 是 |
| parseSpec | JSON对象 | 指定数据的时间戳和维度和一个可选的 `flattenSpec`, 应该是 `avro` | 是 |
| binaryAsString | 布尔类型 | 指定逻辑上未标记为字符串的二进制orc列是否应被视为UTF-8编码字符串。 | 否（默认为false） |

当时间维度是一个 [date类型的列](https://github.com/apache/parquet-format/blob/master/LogicalTypes.md), 则无需指定一个格式。 当格式为UTF8的String， 则要么指定为 `auto`，或者显式的指定一个 [时间格式](http://www.joda.org/joda-time/apidocs/org/joda/time/format/DateTimeFormat.html)。

**示例**
```json
{
  "type": "index_hadoop",
  "spec": {
    "ioConfig": {
      "type": "hadoop",
      "inputSpec": {
        "type": "static",
        "inputFormat": "org.apache.druid.data.input.parquet.DruidParquetAvroInputFormat",
        "paths": "path/to/file.parquet"
      },
      ...
    },
    "dataSchema": {
      "dataSource": "example",
      "parser": {
        "type": "parquet-avro",
        "parseSpec": {
          "format": "avro",
          "flattenSpec": {
            "useFieldDiscovery": true,
            "fields": [
              {
                "type": "path",
                "name": "nestedDim",
                "expr": "$.nestedData.dim1"
              },
              {
                "type": "path",
                "name": "listDimFirstItem",
                "expr": "$.listDim[1]"
              }
            ]
          },
          "timestampSpec": {
            "column": "timestamp",
            "format": "auto"
          },
          "dimensionsSpec": {
            "dimensions": [],
            "dimensionExclusions": [],
            "spatialDimensions": []
          }
        }
      },
      ...
    },
    "tuningConfig": <hadoop-tuning-config>
    }
  }
}
```

#### Avro Stream Parser

> [!WARNING]
> 需要添加 [druid-avro-extensions](../development/avro-extensions.md) 来使用Avro Stream解析器

该解析器用于 [流式摄取](streamingest.md), 直接从一个流来读取数据。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | String | `avro_stream` | 否 |
| avroBytesDecoder | JSON对象 | 指定如何对Avro记录进行解码 | 是 |
| parseSpec | JSON对象 | 指定数据的时间戳和维度。 应该是一个 `avro` parseSpec | 是 |

Avro parseSpec包含一个使用"root"或者"path"类型的 [`flattenSpec`](ingestion.md#flattenspec.md), 以便可以用来读取嵌套的avro数据。 "jq"类型在Avro中目前还不支持。

以下示例展示了一个具有**schema repo**avro解码器的 `Avro stream parser`:
```json
"parser" : {
  "type" : "avro_stream",
  "avroBytesDecoder" : {
    "type" : "schema_repo",
    "subjectAndIdConverter" : {
      "type" : "avro_1124",
      "topic" : "${YOUR_TOPIC}"
    },
    "schemaRepository" : {
      "type" : "avro_1124_rest_client",
      "url" : "${YOUR_SCHEMA_REPO_END_POINT}",
    }
  },
  "parseSpec" : {
    "format": "avro",
    "timestampSpec": <standard timestampSpec>,
    "dimensionsSpec": <standard dimensionsSpec>,
    "flattenSpec": <optional>
  }
}
```

**Avro Bytes Decoder**

如果 `type` 未被指定， `avroBytesDecoder` 默认使用 `schema_repo`。

**基于Avro Bytes Decoder的 `inline schema`**

> [!WARNING]
> "schema_inline"解码器使用固定schema读取Avro记录，不支持schema迁移。如果将来可能需要迁移schema，请考虑其他解码器之一，所有解码器都使用一个消息头，该消息头允许解析器识别正确的Avro schema以读取记录。

如果可以使用同一schema读取所有输入事件，则可以使用此解码器。在这种情况下，在输入任务JSON本身中指定schema，如下所述:
```json
...
"avroBytesDecoder": {
  "type": "schema_inline",
  "schema": {
    //your schema goes here, for example
    "namespace": "org.apache.druid.data",
    "name": "User",
    "type": "record",
    "fields": [
      { "name": "FullName", "type": "string" },
      { "name": "Country", "type": "string" }
    ]
  }
}
...
```
**基于Avro Bytes Decoder的 `multiple inline schemas`**

如果不同的输入事件可以有不同的读取schema，请使用此解码器。在这种情况下，在输入任务JSON本身中指定schema，如下所述:
```json
...
"avroBytesDecoder": {
  "type": "multiple_schemas_inline",
  "schemas": {
    //your id -> schema map goes here, for example
    "1": {
      "namespace": "org.apache.druid.data",
      "name": "User",
      "type": "record",
      "fields": [
        { "name": "FullName", "type": "string" },
        { "name": "Country", "type": "string" }
      ]
    },
    "2": {
      "namespace": "org.apache.druid.otherdata",
      "name": "UserIdentity",
      "type": "record",
      "fields": [
        { "name": "Name", "type": "string" },
        { "name": "Location", "type": "string" }
      ]
    },
    ...
    ...
  }
}
...
```
注意，它本质上是一个整数Schema ID到avro schema对象的映射。此解析器假定记录具有以下格式。第一个1字节是版本，必须始终为1, 接下来的4个字节是使用大端字节顺序序列化的整数模式ID。其余字节包含序列化的avro消息。

**基于Avro Bytes Decoder的 `SchemaRepo`**

Avro Bytes Decorder首先提取输入消息的 `subject` 和 `id`， 然后使用她们去查找用来解码Avro记录的Avro schema，详情可以参见 [Schema repo](https://github.com/schema-repo/schema-repo) 和 [AVRO-1124](https://issues.apache.org/jira/browse/AVRO-1124) 。 您需要一个类似schema repo的http服务来保存avro模式。有关在消息生成器端注册架构的信息，请见 `org.apache.druid.data.input.AvroStreamInputRowParserTest#testParse()`

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | String | `schema_repo` | 否 |
| subjectAndIdConverter | JSON对象 | 指定如何从消息字节中提取subject和id | 是 |
| schemaRepository | JSON对象 | 指定如何从subject和id查找Avro Schema | 是 |

**Avro-1124 Subject 和 Id 转换器**
这部分描述了 `schema_avro` avro 字节解码器中的 `subjectAndIdConverter` 的格式

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | String | `avro_1124` | 否 |
| topic | String | 指定Kafka流的主题 | 是 |

**Avro-1124 Schema Repository**
这部分描述了 `schema_avro` avro 字节解码器中的 `schemaRepository` 的格式

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | String | `avro_1124_rest_client` | 否 |
| url | String | 指定Avro-1124 schema repository的http url | 是 |

**Confluent Schema Registry-based Avro Bytes Decoder**

这个Avro字节解码器首先从输入消息字节中提取一个唯一的id，然后使用它在用于从字节解码Avro记录的模式注册表中查找模式。有关详细信息，请参阅schema注册 [文档](https://docs.confluent.io/current/schema-registry/index.html) 和 [存储库](https://github.com/confluentinc/schema-registry)。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | String | `schema_registry` | 否 |
| url | String | 指定架构注册表的url | 是 |
| capacity | 整型数字 | 指定缓存的最大值（默认为 Integer.MAX_VALUE）| 否 |

```json
...
"avroBytesDecoder" : {
   "type" : "schema_registry",
   "url" : <schema-registry-url>
}
...
```

#### Protobuf Parser

> [!WARNING]
> 需要添加 [druid-protobuf-extensions](../development/protobuf-extensions.md) 来使用Protobuf解析器

此解析器用于 [流接收](streamingest.md)，并直接从流中读取协议缓冲区数据。

| 字段 | 类型 | 描述 | 是否必须 |
|-|-|-|-|
| type | String | `protobuf` | 是 |
| descriptor | String | 类路径或URL中的Protobuf描述符文件名 | 是 |
| protoMessageType | String | 描述符中的Protobuf消息类型。可接受短名称和全限定名称。如果未指定，解析器将使用描述符中找到的第一个消息类型 | 否 |
| parseSpec | JSON对象 | 指定数据的时间戳和维度。格式必须为JSON。有关更多配置选项，请参阅 [JSON ParseSpec](#json)。请注意，不再支持timeAndDims parseSpec | 是 |

样例规范：
```json
"parser": {
  "type": "protobuf",
  "descriptor": "file:///tmp/metrics.desc",
  "protoMessageType": "Metrics",
  "parseSpec": {
    "format": "json",
    "timestampSpec": {
      "column": "timestamp",
      "format": "auto"
    },
    "dimensionsSpec": {
      "dimensions": [
        "unit",
        "http_method",
        "http_code",
        "page",
        "metricType",
        "server"
      ],
      "dimensionExclusions": [
        "timestamp",
        "value"
      ]
    }
  }
}
```
有关更多详细信息和示例，请参见 [扩展说明](../development/protobuf-extensions.md)。

### ParseSpec

> [!WARNING]
> Parser 在 [本地批任务](native.md), [kafka索引任务](kafka.md) 和[Kinesis索引任务](kinesis.md) 中已经废弃，在这些类型的摄入中考虑使用 [inputFormat](#InputFormat)

`parseSpec` 有两个目的：
* String解析器使用 `parseSpec` 来决定输入行的格式（例如： JSON，CSV，TSV）
* 所有的解析器使用 `parseSpec` 来决定输入行的timestamp和dimensions

如果 `format` 没有被包含，`parseSpec` 默认为 `tsv`

#### JSON解析规范
与字符串解析器一起用于加载JSON。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `json` | 否 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |
| flattenSpec | JSON对象 | 指定嵌套的JSON数据的展平配置，详情可见 [flattenSpec](#flattenspec) | 否 |

示例规范：
```json
"parseSpec": {
  "format" : "json",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "dimensionSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  }
}
```

#### JSON Lowercase解析规范

> [!WARNING]
> `JsonLowerCase` 解析器已经废弃，并可能在Druid将来的版本中移除

这是JSON ParseSpec的一个特殊变体，它将传入JSON数据中的所有列名小写。如果您正在从Druid 0.6.x更新到druid0.7.x，正在直接接收具有混合大小写列名的JSON，没有任何ETL来将这些列名转换大小写，并且希望进行包含使用0.6.x和0.7.x创建的数据的查询，则需要此parseSpec。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `jsonLowerCase` | 是 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |

#### CSV解析规范

与字符串解析器一起用于加载CSV， 字符串通过使用 `com.opencsv` 库来进行解析。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `csv` | 是 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |
| listDelimiter | String | 多值维度的定制分隔符 | 否（默认为 `ctrl + A`）|
| columns | JSON数组 | 指定数据的列 | 是 |

示例规范：
```json
"parseSpec": {
  "format" : "csv",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"],
  "dimensionsSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  }
}
```

**CSV索引任务**

如果输入文件包含头，则 `columns` 字段是可选的，不需要设置。相反，您可以将 `hasHeaderRow` 字段设置为 `true`，这将使Druid自动从标题中提取列信息。否则，必须设置 `columns` 字段，并确保该字段必须以相同的顺序与输入数据的列匹配。

另外，可以通过在parseSpec中设置 `skipHeaderRows` 跳过一些标题行。如果同时设置了 `skipHeaderRows` 和 `HashHeaderRow` 选项，则首先应用`skipHeaderRows` 。例如，如果将 `skipHeaderRows` 设置为2，`hasHeaderRow` 设置为true，Druid将跳过前两行，然后从第三行提取列信息。

请注意，`hasHeaderRow` 和 `skipHeaderRows` 仅对非Hadoop批索引任务有效。其他类型的索引任务将失败，并出现异常。

**其他CSV摄入任务**

必须包含 `columns` 字段，并确保字段的顺序与输入数据的列以相同的顺序匹配。

#### TSV/Delimited解析规范

与字符串解析器一起使用此命令可加载不需要特殊转义的任何分隔文本。默认情况下，分隔符是一个制表符，因此这将加载TSV。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `csv` | 是 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |
| delimiter | String | 数据值的定制分隔符 | 否（默认为 `\t`）|
| listDelimiter | String | 多值维度的定制分隔符 | 否（默认为 `ctrl + A`）|
| columns | JSON数组 | 指定数据的列 | 是 |

示例规范：
```json
"parseSpec": {
  "format" : "tsv",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "columns" : ["timestamp","page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city","added","deleted","delta"],
  "delimiter":"|",
  "dimensionsSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  }
}
```
请确保将 `delimiter` 更改为数据的适当分隔符。与CSV一样，您必须指定要索引的列和列的子集。

**TSV(Delimited)索引任务**

如果输入文件包含头，则 `columns` 字段是可选的，不需要设置。相反，您可以将 `hasHeaderRow` 字段设置为 `true`，这将使Druid自动从标题中提取列信息。否则，必须设置 `columns` 字段，并确保该字段必须以相同的顺序与输入数据的列匹配。

另外，可以通过在parseSpec中设置 `skipHeaderRows` 跳过一些标题行。如果同时设置了 `skipHeaderRows` 和 `HashHeaderRow` 选项，则首先应用`skipHeaderRows` 。例如，如果将 `skipHeaderRows` 设置为2，`hasHeaderRow` 设置为true，Druid将跳过前两行，然后从第三行提取列信息。

请注意，`hasHeaderRow` 和 `skipHeaderRows` 仅对非Hadoop批索引任务有效。其他类型的索引任务将失败，并出现异常。

**其他TSV(Delimited)摄入任务**

必须包含 `columns` 字段，并确保字段的顺序与输入数据的列以相同的顺序匹配。

#### 多值维度

对于TSV和CSV数据，维度可以有多个值。要为多值维度指定分隔符，请在`parseSpec` 中设置 `listDelimiter`。

JSON数据也可以包含多值维度。维度的多个值必须在接收的数据中格式化为 `JSON数组`，不需要额外的 `parseSpec` 配置。

#### 正则解析规范
```json
"parseSpec":{
  "format" : "regex",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "dimensionsSpec" : {
    "dimensions" : [<your_list_of_dimensions>]
  },
  "columns" : [<your_columns_here>],
  "pattern" : <regex pattern for partitioning data>
}
```

`columns` 字段必须以相同的顺序与regex匹配组的列匹配。如果未提供列，则默认列名称（“column_1”、“column2”、…”列“）将被分配, 确保列名包含所有维度

#### JavaScript解析规范
```json
"parseSpec":{
  "format" : "javascript",
  "timestampSpec" : {
    "column" : "timestamp"
  },
  "dimensionsSpec" : {
    "dimensions" : ["page","language","user","unpatrolled","newPage","robot","anonymous","namespace","continent","country","region","city"]
  },
  "function" : "function(str) { var parts = str.split(\"-\"); return { one: parts[0], two: parts[1] } }"
}
```

注意: JavaScript解析器必须完全解析数据，并在JS逻辑中以 `{key:value}` 格式返回。这意味着任何展平或解析多维值都必须在这里完成。

> [!WARNING]
> 默认情况下禁用基于JavaScript的功能。有关使用Druid的JavaScript功能的指南，包括如何启用它的说明，请参阅 [Druid JavaScript编程指南](../development/JavaScript.md)。

#### 时间和维度解析规范

与非字符串解析器一起使用，为它们提供时间戳和维度信息。非字符串解析器独立处理所有格式化决策，而不使用ParseSpec。

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `timeAndDims` | 是 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |

#### Orc解析规范

与Hadoop ORC解析器一起使用来加载ORC文件

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `orc` | 否 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |
| flattenSpec | JSON对象 | 指定嵌套的JSON数据的展平配置，详情可见 [flattenSpec](#flattenspec) | 否 |

#### Parquet解析规范

与Hadoop Parquet解析器一起使用来加载Parquet文件

| 字段 | 类型 | 描述 | 是否必填 |
|-|-|-|-|
| format | String | `parquet` | 否 |
| timestampSpec | JSON对象 | 指定timestamp的列和格式 | 是 |
| dimensionsSpec | JSON对象 | 指定数据的dimensions | 是 |
| flattenSpec | JSON对象 | 指定嵌套的JSON数据的展平配置，详情可见 [flattenSpec](#flattenspec) | 否 |