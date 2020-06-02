<!-- toc -->
## SQL

> [!WARNING]
> Apache Druid支持两种查询语言： Druid SQL和 [原生查询](makeNativeQueries.md)。本文档讲述SQL查询。

Druid SQL是一个内置的SQL层，是Druid基于JSON的本地查询语言的替代品，它由基于 [Apache Calcite](https://calcite.apache.org/) 的解析器和规划器提供支持。Druid SQL将SQL转换为查询Broker(查询的第一个进程)上的原生Druid查询，然后作为原生Druid查询传递给数据进程。除了在Broker上 [转换SQL](查询翻译) 的（轻微）开销之外，与原生查询相比，没有额外的性能损失。

### 查询符号

Druid SQL支持如下结构的SELECT查询：

```
[ EXPLAIN PLAN FOR ]
[ WITH tableName [ ( column1, column2, ... ) ] AS ( query ) ]
SELECT [ ALL | DISTINCT ] { * | exprs }
FROM { <table> | (<subquery>) | <o1> [ INNER | LEFT ] JOIN <o2> ON condition }
[ WHERE expr ]
[ GROUP BY [ exprs | GROUPING SETS ( (exprs), ... ) | ROLLUP (exprs) | CUBE (exprs) ] ]
[ HAVING expr ]
[ ORDER BY expr [ ASC | DESC ], expr [ ASC | DESC ], ... ]
[ LIMIT limit ]
[ UNION ALL <another query> ]
```

#### FROM
#### WHERE
#### GROUP BY
#### HAVING
#### ORDER BY
#### LIMIT
#### UNION ALL
#### EXPLAIN PLAN
#### 标识符和标量
#### 动态参数
### 数据类型
#### 标准类型
#### 多值字符串
#### NULL
### 聚合函数
### 扩展函数
#### 数值函数
#### 字符串函数
#### 时间函数
#### 约化函数
#### IP地址函数
#### 比较操作符
#### Sketch函数
#### 其他扩展函数
### 多值字符串函数
### 查询翻译
#### 最佳实践
#### 解释EXPLAIN PLAN输出
#### 查询类型
#### 时间过滤器
#### 连接
#### 子查询
#### 近似
#### 不支持的特征
### 客户端API
#### HTTP POST
#### JDBC
#### 动态参数
#### 连接上下文
### 元数据表
#### 信息Schema
#### 系统Schema
### 服务配置
### 安全性