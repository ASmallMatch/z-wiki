# ADR-0019: ingest 进度基于里程碑锚点(引出事件 + server 算 + 前端插值)

- 状态:accepted
- 日期:2026-07-17
- 关联:extends ADR-0007(ingest 工作流);refines ADR-0011(ingest session onEvent)

## 背景

ingest 是上传后起独立 agent session 编译 raw 文件的工作流(ADR-0007)。前端角标在 compiling 阶段显示进度,但原实现是纯时间假进度(easeOutCubic 20s 爬到 90% 封顶),理由注释是"ingest 是 LLM 回合无真实百分比"。

更根本的原因:`runIngest` 的 `createIngestSession({ onEvent: () => {} })` 把 ingest agent 事件整个丢弃(对比对话 session 经 `relayEvent` 转发前端)。前端在整个 ingest 期间只收到 `ingest_started` / `ingest_done` / `ingest_error` 三个广播,无从得知 agent 在干嘛。`ingest_started` 甚至不参与角标(由 fetch 返回驱动 compiling)。

## 决策

引出 ingest agent 事件,基于工具调用里程碑锚定阶段边界,server 算锚点、前端锚点间插值。

### D1:引出事件 + server 算锚点

`runIngest` 的 `onEvent` 不再空:调 `classifyMilestone(event)`(纯函数,`ingestProgress.ts`)识别 `tool_execution_start` 命中的里程碑,若推进则 `broadcast ingest_progress{percent}`。每 session 闭包维护 `ingestPercent`(单调递增,`max(current, milestone)`)。

里程碑(基于 ingest 工作流 + layer1 三分读法 ADR-0018):
- 15 `read`/`pandoc` 命中 `raw/`(读取源)
- 50 `write`/`edit` 命中 `wiki/`(编译写入)
- 70 `write`/`edit` 命中 `index.md`(索引归档)
- 82 `write`/`edit` 命中 `output/`(产出报告,可选)
- 92 `write`/`edit` 命中 `log.md`(日志归档)
- 100 由 `ingest_done` 承担(不在此常量)

路径取 `args.file_path`(read/write/edit)或 `args.filePath`(pandoc),小写化匹配。

### D2:前端锚点间插值

`ingest_progress{percent}` 更新角标 `anchor`(当前真实锚点)+ `target`(下一锚点,`nextAnchor(anchor)`,共享 `INGEST_PROGRESS_ANCHORS` 常量)。compiling 阶段从 `anchor` 向 `target` 段式 `easeOutCubic` 插值(8s/段,不超 target);到达后停,等真实锚点推进。`ingest_done` 跳 100%,`ingest_error` 保持当前值变红。

### D3:并发跟随 v1 取舍

`ingest_progress` 不带 raw 标识,broadcast 给所有 WS,前端覆盖式更新(角标单值反映最后一个)。跟随 `useFileDrop` 多文件并发的 v1 取舍(角标单值,已知)。

## 固有边界

ingest 是 LLM 回合,主要耗时是思考(判断/编译决策),不产生工具事件。里程碑只锚定"阶段边界",阶段内思考进度仍靠插值估算。所以"准确"= 走到哪个阶段准,不反映阶段内思考进度。这是里程碑方案的硬边界 -- 总事件数不可预知,纯事件计数必假,里程碑锚点是唯一能"准"的形态。

## 后果

- `runIngest` onEvent 引出事件;新增 `ingestProgress.ts`(`INGEST_PROGRESS_ANCHORS` + `classifyMilestone` + `nextAnchor`,前后端共享,模式同 `ALLOWED_UPLOAD_EXTS`)。
- `interaction.ts` broadcast `ingest_progress`;前端 `useChat` 加事件处理 + 段式插值(替原固定 90% 假进度)。
- agent 判断不编译(只 read 后 agent_end)时:15% -> `ingest_done` 100%,中间无锚点,直接跳。
- 可选 output 跳过不影响(82 不命中,单调递增跳过)。
- ingest agent 原始事件(text_delta/thinking)仍不进前端(只算锚点,不转发),不污染对话流。
