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

## Kerberized HDFS存储
### Hadoop设置
以下配置文件需要拷贝到Druid配置文件夹：
1. 对于HDFS作为深度存储，`hdfs-site.xml`, `core-site.xml`
2. 对于数据摄入，`mapred-site.xml`, `yarn-site.xml`

#### HDFS文件夹和权限
1. 选择用于Druid深度存储的文件夹，例如"druid"
2. 在hdfs中所需父文件夹下创建文件夹，例如 `hdfs dfs -mkdir /druid` 或者 `hdfs dfs -mkdir /apps/druid`
3. 授予druid进程访问此文件夹的适当权限。这将确保druid能够在HDFS中创建必要的文件夹，如数据和索引日志。例如，如果druid进程以用户"root"的身份运行，那么 `hdfs dfs -chown root:root /apps/druid` 或者 `hdfs dfs -chmod 777 /apps/druid`

Druid创建了必要的子文件夹，以便在这个新创建的文件夹下存储数据和索引。

### Druid设置

在 `conf/druid/common/common.runtime.properties` 中编辑`common.runtime.properties` 以包含HDFS属性,用于该位置的文件夹与上面示例中使用的文件夹相同

#### common.runtime.properties
```json
# Deep storage
#
# For HDFS:
druid.storage.type=hdfs
druid.storage.storageDirectory=/druid/segments
# OR
# druid.storage.storageDirectory=/apps/druid/segments

#
# Indexing service logs
#

# For HDFS:
druid.indexer.logs.type=hdfs
druid.indexer.logs.directory=/druid/indexing-logs
# OR
# druid.storage.storageDirectory=/apps/druid/indexing-logs
```
注意：注释掉文件中的本地存储和S3存储参数

同时，需要在 `conf/druid/_common/common/common.runtime.properties` 中增加hdfs-storage核心扩展：

```json
#
# Extensions
#

druid.extensions.directory=dist/druid/extensions
druid.extensions.hadoopDependenciesDir=dist/druid/hadoop-dependencies
druid.extensions.loadList=["mysql-metadata-storage", "druid-hdfs-storage", "druid-kerberos"]
```

#### Hadoop Jars
确保Druid有必要的jar来支持Hadoop版本

通过 `hadoop version` 命令来查看hadoop版本

在其他使用hadoop的情况（如 `WanDisco`）下，需要保证：
1. 必要的库是可用的
2. 在 `conf/druid/_common/common.runtime.properties` 中 `druid.extensions.loadList` 增加必要的扩展

#### Kerberos设置
创建一个无头的keytab，它可以访问druid数据和索引。

编辑 `conf/druid/_common/common.runtime.properties` 增加下列属性：

```json
druid.hadoop.security.kerberos.principal
druid.hadoop.security.kerberos.keytab
```
例如：
```json
druid.hadoop.security.kerberos.principal=hdfs-test@EXAMPLE.IO
druid.hadoop.security.kerberos.keytab=/etc/security/keytabs/hdfs.headless.keytab
```

#### 重启Druid服务

完成上述更改后，重新启动Druid。这将确保Druid与Kerberized Hadoop一起工作