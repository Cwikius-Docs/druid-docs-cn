---
id: human-readable-byte
title: "Human-readable Byte Configuration Reference"
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


This page documents configuration properties related to bytes.

These properties can be configured through 2 ways:
1. a simple number in bytes
2. a number with a unit suffix

## A number in bytes

Given that cache size is 3G, there's a configuration as below

```properties
# 3G bytes = 3_000_000_000 bytes
druid.cache.sizeInBytes=3000000000 
```


## A number with a unit suffix

When you have to put a large number for some configuration as above, it is easy to make a mistake such as extra or missing 0s. Druid supports a better way, a number with a unit suffix.

Given a disk of 1T, the configuration can be

```properties
druid.segmentCache.locations=[{"path":"/segment-cache-00","maxSize":"1t"},{"path":"/segment-cache-01","maxSize":"1200g"}]
```

Note: in above example, both `1t` and `1T` are acceptable since it's case-insensitive.
Also, only integers are valid as the number part. For example, you can't replace `1200g` with `1.2t`.

### Supported Units
In the world of computer, a unit like `K` is ambiguous. It means 1000 or 1024 in different contexts, for more information please see [Here](https://en.wikipedia.org/wiki/Binary_prefix).

To make it clear, the base of units are defined in Druid as below

| Unit | Description | Base |
|---|---|---|
| K | Kilo Decimal Byte | 1_000 |
| M | Mega Decimal Byte | 1_000_000 |
| G | Giga Decimal Byte | 1_000_000_000 |
| T | Tera Decimal Byte | 1_000_000_000_000 |
| P | Peta Decimal Byte | 1_000_000_000_000_000 |
| KiB | Kilo Binary Byte | 1024 |
| MiB  | Mega Binary Byte | 1024 * 1024 |
| GiB | Giga Binary Byte | 1024 * 1024 * 1024 |
| TiB  | Tera Binary Byte | 1024 * 1024 * 1024 * 1024 |
| PiB  | Peta Binary Byte | 1024 * 1024 * 1024 * 1024 * 1024 |

Unit is case-insensitive. `k`, `kib`, `KiB`, `kiB` are all acceptable.

Here are two examples

```properties
# 1G bytes = 1_000_000_000 bytes
druid.cache.sizeInBytes=1g 
```

```properties
# 256MiB bytes = 256 * 1024 * 1024 bytes
druid.cache.sizeInBytes=256MiB 
```






## 配置文档

本部分内容列出来了每一种Druid服务的所有配置项

### 推荐的配置文件组织方式

对于Druid的配置文件，一种推荐的结构组织方式为将配置文件放置在Druid根目录的`conf`目录下，如以下所示：

```json
$ ls -R conf
druid

conf/druid:
_common       broker        coordinator   historical    middleManager overlord

conf/druid/_common:
common.runtime.properties log4j2.xml

conf/druid/broker:
jvm.config         runtime.properties

conf/druid/coordinator:
jvm.config         runtime.properties

conf/druid/historical:
jvm.config         runtime.properties

conf/druid/middleManager:
jvm.config         runtime.properties

conf/druid/overlord:
jvm.config         runtime.properties
```

每一个目录下都有一个 `runtime.properties` 文件，该文件中包含了特定的Druid进程相关的配置项，例如 `historical` 

`jvm.config` 文件包含了每一个服务的JVM参数，例如堆内存属性等

所有进程共享的通用属性位于 `_common/common.runtime.properties` 中。

### 通用配置

本节下的属性是应该在集群中的所有Druid服务之间共享的公共配置。

#### JVM配置最佳实践

在我们的所有进程中有四个需要配置的JVM参数

1. `-Duser.timezone=UTC` 该参数将JVM的默认时区设置为UTC。我们总是这样设置，不使用其他默认时区进行测试，因此本地时区可能会工作，但它们也可能会发现奇怪和有趣的错误。要在非UTC时区中发出查询，请参阅 [查询粒度](../querying/granularity.md)
2. `-Dfile.encoding=UTF-8` 这类似于时区，我们假设UTF-8进行测试。本地编码可能有效，但也可能导致奇怪和有趣的错误。
3. `-Djava.io.tmpdir=<a path>` 系统中与文件系统交互的各个部分都是通过临时文件完成的，这些文件可能会变得有些大。许多生产系统都被设置为具有小的（但是很快的）`/tmp`目录，这对于Druid来说可能是个问题，因此我们建议将JVM的tmp目录指向一些有更多内容的目录。此目录不应为volatile tmpfs。这个目录还应该具有良好的读写速度，因此应该强烈避免NFS挂载。
4. `-Djava.util.logging.manager=org.apache.logging.log4j.jul.LogManager` 这允许log4j2处理使用标准java日志的非log4j2组件（如jetty）的日志。

#### 扩展
#### 请求日志
#### SQL兼容的空值处理
### Master
#### Coordinator
#### Overlord
### Data
#### MiddleManager and Peons
##### SegmentWriteOutMediumFactory
#### Indexer
#### Historical
### Query
#### Broker
#### Router