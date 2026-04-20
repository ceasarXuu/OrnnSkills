# Performance Benchmarks

本仓库的性能 benchmark 目标不是“跑一个好看的数字”，而是把 dashboard 读侧、trace 统计、SSE 广播这些真实热点固定成可回归的工程标准。

## 指标设计

当前 benchmark 分成两类:

- `revalidate`: 上游文件刚发生一次真实变更后，读侧完成一次重新校验/重新聚合的延迟。
- `steady`: 无上游变更时，系统在稳定运行阶段重复执行同一路径的延迟。

重点指标如下:

- `agentUsage.revalidate.summary`
  - 目标: `agent-usage-summary.json` 发生一次更新后，dashboard 读侧应直接走摘要快路径，不再回扫整份 `agent-usage.ndjson`。
- `agentUsage.cached`
  - 目标: 同一份摘要重复读取时，延迟应接近内存命中。
- `processedTraces.revalidate.oneFile`
  - 目标: 单个 trace 文件增长后，只重新扫描变化文件，而不是回扫全部 trace 文件。
- `processedTraces.cached`
  - 目标: 无 trace 变更时，processed trace 统计应走项目级缓存。
- `projectSnapshot.steady`
  - 目标: dashboard 主快照读取维持在可交互级别，避免项目规模放大后出现明显卡顿。
- `projectSnapshotVersion.steady`
  - 目标: SSE 版本探测足够轻，能支撑周期性广播扫描。
- `sseBroadcast.steady`
  - 目标: 多客户端 steady broadcast 保持低延迟，不把周期性刷新变成 CPU 热点。

## 工作负载预设

脚本内置三个 workload preset:

- `smoke`
  - 适合本地快速验证脚本是否可运行。
- `standard`
  - 默认基线，模拟中等偏大的真实项目。
  - 当前规模: `160` skills, `6 x 1500` traces, `600` decision events, `12000` agent usage records, `12` SSE projects。
- `stress`
  - 用于做容量边界检查，不作为日常必跑默认集。
  - 预算会按 fan-out 增长做适度放宽，避免把线性扩容误判为回归。

除此之外，另有一个单独的 `soak` 脚本用于覆盖“长时间持续运行 + 项目轮转”场景。

## 预算规则

预算统一看 `p95`，不是单次最好成绩。

原因:

- `p50` 太乐观，无法反映尾延迟。
- `max` 太容易被偶发抖动污染。
- `p95` 更适合做工程回归门槛。

## 运行方式

常用命令:

```bash
npm run benchmark:dashboard
npm run benchmark:dashboard:smoke
npm run benchmark:dashboard:soak
npm run benchmark:dashboard:soak:check
npm run benchmark:dashboard:stress
npm run benchmark:dashboard:check
```

其中:

- `benchmark:dashboard`
  - 运行默认 `standard` workload，并输出各项指标。
- `benchmark:dashboard:check`
  - 在 `standard` workload 上执行预算校验；任一指标超出 `p95` 预算时返回非零退出码。
  - `standard` 是默认 gate，`stress` 主要用于观察容量余量和扩容斜率。
- `benchmark:dashboard:soak`
  - 默认使用 `smoke` workload 连续轮转 `640` 个临时项目，重点看长期运行下的周期耗时漂移和缓存是否保持有界。
- `benchmark:dashboard:soak:check`
  - 校验 reader 级缓存没有突破上限，适合作为长运行保护门。

自定义示例:

```bash
npm run benchmark:dashboard:soak -- --dataset standard --cycles 320
```

## 长运行保护

目前 dashboard 读侧的长运行保护主要依赖两类机制:

- 有界缓存
  - `agent usage` 摘要缓存: 最多 `256` 条，默认闲置 `15` 分钟过期。
  - `processed trace` 文件缓存: 最多 `1024` 条，默认闲置 `15` 分钟过期。
  - `processed trace` 项目级计数缓存: 最多 `512` 条，默认闲置 `15` 分钟过期。
- soak benchmark
  - 用高轮转临时项目反复触发 `readAgentUsageStats`、`countProcessedTraceIds`、`readProjectSnapshotVersion`、`readProjectSnapshot`。
  - 目标不是给出绝对内存承诺，而是防止 reader 级缓存因为项目 churn 无界增长。

## 迭代方法

建议固定使用以下循环:

1. `npm run benchmark:dashboard`
2. 找到超预算或最接近预算的热点
3. 只做根因级优化，不做表面调参
4. 跑定向单测
5. 再跑 `npm run benchmark:dashboard:check`

## 当前工程约束

本轮 benchmark 重点覆盖的是 Node 端 dashboard 读路径，不覆盖:

- 浏览器渲染耗时
- 真实网络 RTT
- 外部 LLM provider 延迟
- 磁盘冷启动和操作系统页缓存差异

因此这些 benchmark 更适合作为“仓库内回归标准”，不是最终用户设备上的绝对体验数字。