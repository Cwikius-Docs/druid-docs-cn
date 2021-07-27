
Druid includes a set of reference configurations and launch scripts for single-machine deployments:

- `nano-quickstart`
- `micro-quickstart`
- `small`
- `medium`
- `large`
- `xlarge`

The `micro-quickstart` is sized for small machines like laptops and is intended for quick evaluation use-cases.

The `nano-quickstart` is an even smaller configuration, targeting a machine with 1 CPU and 4GiB memory. It is meant for limited evaluations in resource constrained environments, such as small Docker containers.

The other configurations are intended for general use single-machine deployments. They are sized for hardware roughly based on Amazon's i3 series of EC2 instances.

The startup scripts for these example configurations run a single ZK instance along with the Druid services. You can choose to deploy ZK separately as well.

The example configurations run the Druid Coordinator and Overlord together in a single process using the optional configuration `druid.coordinator.asOverlord.enabled=true`, described in the [Coordinator configuration documentation](../configuration/index.md#coordinator-operation).

While example configurations are provided for very large single machines, at higher scales we recommend running Druid in a [clustered deployment](../tutorials/cluster.md), for fault-tolerance and reduced resource contention.

## Single server reference configurations

### Nano-Quickstart: 1 CPU, 4GiB RAM

- Launch command: `bin/start-nano-quickstart`
- Configuration directory: `conf/druid/single-server/nano-quickstart`

### Micro-Quickstart: 4 CPU, 16GiB RAM

- Launch command: `bin/start-micro-quickstart`
- Configuration directory: `conf/druid/single-server/micro-quickstart`

### Small: 8 CPU, 64GiB RAM (~i3.2xlarge)

- Launch command: `bin/start-small`
- Configuration directory: `conf/druid/single-server/small`

### Medium: 16 CPU, 128GiB RAM (~i3.4xlarge)

- Launch command: `bin/start-medium`
- Configuration directory: `conf/druid/single-server/medium`

### Large: 32 CPU, 256GiB RAM (~i3.8xlarge)

- Launch command: `bin/start-large`
- Configuration directory: `conf/druid/single-server/large`

### X-Large: 64 CPU, 512GiB RAM (~i3.16xlarge)

- Launch command: `bin/start-xlarge`
- Configuration directory: `conf/druid/single-server/xlarge`


### 单服务器部署

Druid包括一组参考配置和用于单机部署的启动脚本：

* `nano-quickstart`
* `micro-quickstart`
* `small`
* `medium`
* `large`
* `large`
* `xlarge`

`micro-quickstart`适合于笔记本电脑等小型机器，旨在用于快速评估测试使用场景。

`nano-quickstart`是一种甚至更小的配置，目标是具有1个CPU和4GB内存的计算机。它旨在在资源受限的环境（例如小型Docker容器）中进行有限的评估测试。

其他配置旨在用于一般用途的单机部署,它们的大小适合大致基于亚马逊i3系列EC2实例的硬件。

这些示例配置的启动脚本与Druid服务一起运行单个ZK实例,您也可以选择单独部署ZK。

通过[Coordinator配置文档](../../Configuration/configuration.md#Coordinator)中描述的可选配置`druid.coordinator.asOverlord.enabled = true`可以在单个进程中同时运行Druid Coordinator和Overlord。

虽然为大型单台计算机提供了示例配置，但在更高规模下，我们建议在集群部署中运行Druid，以实现容错和减少资源争用。

#### 单服务器参考配置
##### Nano-Quickstart: 1 CPU, 4GB 内存

* 启动命令: `bin/start-nano-quickstart`
* 配置目录: `conf/druid/single-server/nano-quickstart`

##### Micro-Quickstart: 4 CPU, 16GB 内存

* 启动命令: `bin/start-micro-quickstart`
* 配置目录: `conf/druid/single-server/micro-quickstart`

##### Small: 8 CPU, 64GB 内存 (~i3.2xlarge)

* 启动命令: `bin/start-small`
* 配置目录: `conf/druid/single-server/small`

##### Medium: 16 CPU, 128GB 内存 (~i3.4xlarge)

* 启动命令: `bin/start-medium`
* 配置目录: `conf/druid/single-server/medium`

##### Large: 32 CPU, 256GB 内存 (~i3.8xlarge)

* 启动命令: `bin/start-large`
* 配置目录: `conf/druid/single-server/large`

##### X-Large: 64 CPU, 512GB 内存 (~i3.16xlarge)

* 启动命令: `bin/start-xlarge`
* 配置目录: `conf/druid/single-server/xlarge`

