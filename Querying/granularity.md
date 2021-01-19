<!--toc-->

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

## 查询粒度(Query granularities)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述了原生查询中的一种查询方式。 对于Druid SQL中使用的该种类型的信息，可以参考 [SQL文档](druidsql.md)。

粒度字段决定了数据如何被根据时间维度组织，或者如何按小时、天、分钟等进行聚合

对于简单粒度可以使用字符串进行指定，或者对于任意粒度使用对象进行指定

### **简单粒度(Simple Granularities)**

简单粒度被指定为字符串和bucket时间戳（按UTC时间）（例如 days开始在UTC00：00）

当前支持的粒度字符串有： `all`, `none`, `second`, `minute`, `fifteen_minute`, `thirty_minute`, `hour`, `day`, `week`, `month`, `quater` 和 `year`
* `all`表示所有的数据都写入到一个bucket
* `none`不存储数据（它实际上使用索引的粒度-这里的最小值是`none`，这意味着毫秒粒度）。目前不建议在[TimeseriesQuery](timeseriesquery.md) 中使用`none`（系统将尝试为所有不存在的毫秒生成0值，这通常是非常多的）。

实例：

假设有以下数据按秒的粒度摄入到Druid中：

```json
{"timestamp": "2013-08-31T01:02:33Z", "page": "AAA", "language" : "en"}
{"timestamp": "2013-09-01T01:02:33Z", "page": "BBB", "language" : "en"}
{"timestamp": "2013-09-02T23:32:45Z", "page": "CCC", "language" : "en"}
{"timestamp": "2013-09-03T03:32:45Z", "page": "DDD", "language" : "en"}
```

当提交一个 `hour` 粒度的GroupBy查询时：

```json
{
   "queryType":"groupBy",
   "dataSource":"my_dataSource",
   "granularity":"hour",
   "dimensions":[
      "language"
   ],
   "aggregations":[
      {
         "type":"count",
         "name":"count"
      }
   ],
   "intervals":[
      "2000-01-01T00:00Z/3000-01-01T00:00Z"
   ]
}
```
将得到以下结果：

```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-31T01:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-01T01:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T23:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-03T03:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
} ]
```
可以注意到所有的空的buckets都被丢弃。

如果查询粒度变为 `day`, 将会得到：

```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-31T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-01T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-03T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
} ]
```
如果查询粒度为 `none`, 将会得到和摄入的数据粒度一样的数据：

```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-31T01:02:33.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-01T01:02:33.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T23:32:45.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-03T03:32:45.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
} ]
```

**注意**：当查询时的 `granularity` 小于 [数据摄取](../DataIngestion/ingestion.md) 时候设置的 `queryGranularity`是不合理的，因为在存储的数据中没有更细粒度的数据了。 所以，当查询时设置的粒度小于摄取时设置的粒度时，Druid将基于`granularity`与`queryGranularity`相同的基础上进行生产结果。

如果查询粒度更改为 `all`,将会在一个bucket中查到所以数据：

```json
[ {
  "version" : "v1",
  "timestamp" : "2000-01-01T00:00:00.000Z",
  "event" : {
    "count" : 4,
    "language" : "en"
  }
} ]
```

### **持续时间粒度**

持续时间粒度指定为精确的持续时间（毫秒），时间戳返回为UTC。持续时间粒度值以毫秒为单位。

它们还支持指定可选的原点，该原点定义从何处开始计算时间段（默认为1970-01-01T00:00:00Z）。

```json
{"type": "duration", "duration": 7200000}
```
每两小时就有一次

```json
{"type": "duration", "duration": 3600000, "origin": "2012-01-01T00:30:00Z"}
```

在每小时30分时每一小时就有一次。

实例：

还是使用上边摄入的数据的例子，当提交一个24小时持续的GroupBy查询：

```json
{
   "queryType":"groupBy",
   "dataSource":"my_dataSource",
   "granularity":{"type": "duration", "duration": "86400000"},
   "dimensions":[
      "language"
   ],
   "aggregations":[
      {
         "type":"count",
         "name":"count"
      }
   ],
   "intervals":[
      "2000-01-01T00:00Z/3000-01-01T00:00Z"
   ]
}
```
将会得到：

```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-31T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-01T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-03T00:00:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
} ]
```
如果设置了查询粒度的起始时间为 `2012-01-01T00:30:00Z` :

```json
   "granularity":{"type": "duration", "duration": "86400000", "origin":"2012-01-01T00:30:00Z"}
```
将会得到：
```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-31T00:30:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-01T00:30:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T00:30:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-03T00:30:00.000Z",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
} ]
```
可以注意到每个Bucket的起始时间都在30分钟。

### **周期性粒度**

周期粒度以 [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) 格式指定为年、月、周、小时、分钟和秒（如P2W、P3M、PT1H30M、PT0.750S）的任意周期组合。它们支持指定一个时区来确定时段边界的起始位置以及返回的时间戳的时区。默认情况下，年份从1月1日开始，月份从1月1日开始，周从周一开始，除非指定了原点。

时区是可选的，默认为UTC。 起始时间也是可选的，默认为在给定时区的1970-01-01T00:00:00

```json
{"type": "period", "period": "P2D", "timeZone": "America/Los_Angeles"}
```
这将在太平洋时区持续两天。

```json
{"type": "period", "period": "P3M", "timeZone": "America/Los_Angeles", "origin": "2012-02-01T00:00:00-08:00"}
```
在太平洋时区，三个月的季度定义为从2月份开始，这将是三个月的时间段。

同样使用上边的示例数据，在太平洋时区下提交一个一天的周期的GroupBy查询：

```json
{
   "queryType":"groupBy",
   "dataSource":"my_dataSource",
   "granularity":{"type": "period", "period": "P1D", "timeZone": "America/Los_Angeles"},
   "dimensions":[
      "language"
   ],
   "aggregations":[
      {
         "type":"count",
         "name":"count"
      }
   ],
   "intervals":[
      "1999-12-31T16:00:00.000-08:00/2999-12-31T16:00:00.000-08:00"
   ]
}
```
将会得到：

```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-30T00:00:00.000-07:00",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-08-31T00:00:00.000-07:00",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T00:00:00.000-07:00",
  "event" : {
    "count" : 2,
    "language" : "en"
  }
} ]
```
**注意**： 每一个bucket的时间戳都已经转换成太平洋时间。 `{"timestamp": "2013-09-02T23:32:45Z", "page": "CCC", "language" : "en"}`和`{"timestamp": "2013-09-03T03:32:45Z", "page": "DDD", "language" : "en"}`两行被合并到一个bucket中，是因为在太平洋时区下是同一天。

同时也可以注意到，groupBy查询中的`intervals`不会被转换成指定的时区，时区只会在查询结果中生效。

如果设置了粒度的起始时间为：`1970-01-01T20:30:00-08:00`:

```json
   "granularity":{"type": "period", "period": "P1D", "timeZone": "America/Los_Angeles", "origin": "1970-01-01T20:30:00-08:00"}
```

将会得到：

```json
[ {
  "version" : "v1",
  "timestamp" : "2013-08-29T20:30:00.000-07:00",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-08-30T20:30:00.000-07:00",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-01T20:30:00.000-07:00",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
}, {
  "version" : "v1",
  "timestamp" : "2013-09-02T20:30:00.000-07:00",
  "event" : {
    "count" : 1,
    "language" : "en"
  }
} ]
```

注意到，查询中指定的`origin`与时区无关，它仅仅决定了第一个粒度bucket的起始点，在这种情况下，`{"timestamp": "2013-09-02T23:32:45Z", "page": "CCC", "language" : "en"}` 和 `{"timestamp": "2013-09-03T03:32:45Z", "page": "DDD", "language" : "en"}` 数据行就不在一个bucket中了。

### **支持的时区**

时区是由[Joda Time Library](https://www.joda.org/)提供的， 其使用的是标准IANA时区。 详情可以查看 [Joda Time时区支持](http://joda-time.sourceforge.net/timezones.html)







