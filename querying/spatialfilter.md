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

## 空间过滤器(Spatial Filters)

> [!WARNING]
> Apache Druid支持两种查询语言： [Druid SQL](druidsql.md) 和 [原生查询](makeNativeQueries.md)。该文档描述的功能仅仅在原生查询中可用。

Apache Druid支持基于原点和边界过滤特殊的空间索引列。

### 空间索引

在任意的数据spec中，有一种可以提供空间维度的选项。例如，在JSON数据中，空间维度可以如下描述：

```json
{
    "type": "hadoop",
    "dataSchema": {
        "dataSource": "DatasourceName",
        "parser": {
            "type": "string",
            "parseSpec": {
                "format": "json",
                "timestampSpec": {
                    "column": "timestamp",
                    "format": "auto"
                },
                "dimensionsSpec": {
                    "dimensions": [],
                    "spatialDimensions": [{
                        "dimName": "coordinates",
                        "dims": ["lat", "long"]
                    }]
                }
            }
        }
    }
}
```

### 空间过滤器

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `dimName` | 空间维度的名称。一个空间维度可以从多个其他维度构建，或者它可能已经作为一个事件的一部分存在。如果空间维度已经存在，则它必须是一个坐标值数组。 | 是 |
| `dims` | 构成空间维度的维度名称列表。 | 否 |

空间过滤器的语法如下：

```json
"filter" : {
    "type": "spatial",
    "dimension": "spatialDim",
    "bound": {
        "type": "rectangular",
        "minCoords": [10.0, 20.0],
        "maxCoords": [30.0, 40.0]
    }
}
```

#### 边界类型(Bound Types)

**`rectangular`**

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `minCoords` | 对于坐标[x, y, z, …]的最小维度坐标 | 是 |
| `maxCoords` | 对于坐标[x, y, z, …]的最大维度坐标 | 是 |

**`radius`**

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `coords` | 对于坐标 [x, y, z, …]的起始坐标值 | 是 |
| `radius` | 浮点型弧度值 | 是 |

**`polygon`**

| 属性 | 描述 | 是否必须 |
|-|-|-|
| `abscissa` | 多边形角点的水平坐标 | 是 |
| `ordinate` | 多边形角点的垂直坐标 | 是 |

