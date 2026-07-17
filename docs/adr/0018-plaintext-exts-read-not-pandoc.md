# ADR-0018: 纯文本后缀(.txt/.text/.log)走 read,不走 pandoc

- 状态:accepted
- 日期:2026-07-17
- 关联:extends ADR-0007 决策 1(白名单语义);refines ADR-0011 shouldBlockRead

## 背景

ADR-0007 决策 1 定 `/api/upload` 白名单 = "pandoc 原生支持的输入格式",非 md 文件走 pandoc 工具转文本。ADR-0011 的 `shouldBlockRead` 据此拦截:后缀在 `ALLOWED_UPLOAD_EXTS` 且非 `.md` -> block,逼 agent 用 pandoc。

纯文本后缀(.txt/.text/.log)处于"二不像":像 `.md`(纯文本,`read` 直读无乱码,不需 pandoc),又不是 `.md`(后缀不同)。若把 `.txt` 直接加进 `ALLOWED_UPLOAD_EXTS`,会触发 `shouldBlockRead` 的反直觉拦截 -- agent 被逼用 pandoc 处理纯文本,而 pandoc 对纯文本仅透传,零增益,且与"read 能读纯文本"的设计意图打架。于是纯文本后缀既需要被上传接受,又不能进 `ALLOWED_UPLOAD_EXTS`。

## 决策

layer1 Source 的读法从二分(md / pandoc)细化为三分:

- **md**(.md)-- 原样 `read`
- **纯文本**(.txt/.text/.log,`PLAINTEXT_EXTS`)-- 原样 `read`
- **pandoc 格式**(docx/xlsx/...,`ALLOWED_UPLOAD_EXTS` 非 md 项)-- pandoc 工具转文本

新增 `PLAINTEXT_EXTS = ['.txt', '.text', '.log']` 常量;`ALLOWED_UPLOAD_EXTS` 保持"pandoc 格式"语义不变(仍含 `.md` 供上传接受,`shouldBlockRead`/`buildIngestPrompt` 前置 `=== '.md'` 排除);导出 `ACCEPTED_UPLOAD_EXTS = [...ALLOWED_UPLOAD_EXTS, ...PLAINTEXT_EXTS]` 供上传校验与前端 `accept` 共用。

`shouldBlockRead` 放行条件从"不在 `ALLOWED_UPLOAD_EXTS`"改为显式"`.md` ∪ `PLAINTEXT_EXTS`"(行为对 .txt 不变,放行理由更显式);`buildIngestPrompt` 对 `.md` ∪ `PLAINTEXT_EXTS` 指示 `read`,其余指示 pandoc。

## 后果

- `/api/upload` 接受 `.txt/.text/.log`,落 `raw/` 原样(与 md 一致,不预转)。
- agent 读 `raw/x.txt` 走 `read`(放行),不走 pandoc;ingest prompt 指示 `read`。
- `buildView` 不碰 `raw/`,纯文本落 raw/ 不影响可视层。
- `.log` 常是运行日志而非知识源,但 agent 按 §1 编译规则判断是否值得编译(≥3 篇或单篇 >100 行),放行上传 ≠ 强制入库。
- `ALLOWED_UPLOAD_EXTS` 仍含 `.md`(历史:上传接受),其"pandoc 格式"语义对 `.md` 不准,由 `shouldBlockRead`/`buildIngestPrompt` 前置排除化解;未来可考虑把 `.md` 移出进一步清理(本次不做,surgical)。
