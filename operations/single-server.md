## 独立服务器部署

Druid 包含有一组可用的参考配置和用于单机部署的启动脚本：

- `nano-quickstart`
- `micro-quickstart`
- `small`
- `medium`
- `large`
- `xlarge`

`micro-quickstart` 适合于笔记本电脑等小型计算机，主要用于能够快速评估 Druid 的使用场景。

其他的配置包含有针对使用独立服务器进行部署的配置，这些配置通常需要与 AWS 的 i3 系列 EC2 服务器等同才行。

这些示例配置的启动脚本与 Druid 服务一起运行单个 ZooKeeper 实例来运行，你也也可以选择单独部署 ZooKeeper。

在示例程序中的 Druid Coordinator 和 Overlord 作为一个独立的进程同时运行，使用的可选配置为 `druid.coordinator.asOverlord.enabled=true`，
相关的内容请参考 [Coordinator configuration documentation](../configuration/index.md#coordinator-operation) 页面中的内容。

我们虽然为大型单台计算机提供了配置的实例，但是在更加真实和大数据的环境下，我们建议在集群方式下部署 Druid，请参考 [clustered deployment](../tutorials/cluster.md) 页面中的内容。
通过集群范式的部署，能够更好的增加的 Druid 容错能力和扩展能力。

### Nano-Quickstart: 1 CPU, 4GiB RAM

- 启动命令： `bin/start-nano-quickstart`
- 配置目录： `conf/druid/single-server/nano-quickstart`

### Micro-Quickstart: 4 CPU, 16GiB RAM

- 启动命令： `bin/start-micro-quickstart`
- 配置目录： `conf/druid/single-server/micro-quickstart`

### Small: 8 CPU, 64GiB RAM (~i3.2xlarge)

- 启动命令： `bin/start-small`
- 配置目录： `conf/druid/single-server/small`

### Medium: 16 CPU, 128GiB RAM (~i3.4xlarge)

- 启动命令： `bin/start-medium`
- 配置目录： `conf/druid/single-server/medium`

### Large: 32 CPU, 256GiB RAM (~i3.8xlarge)

- 启动命令： `bin/start-large`
- 配置目录： `conf/druid/single-server/large`

### X-Large: 64 CPU, 512GiB RAM (~i3.16xlarge)

- 启动命令： `bin/start-xlarge`
- 配置目录： `conf/druid/single-server/xlarge`
