# ADR-0016: agent 文件工具路径沙箱(锁 kb/ 内)

- 状态:accepted
- 日期:2026-07-17
- 范围:server kbHooks `tool_call` 拦截 + `makePandocTool.execute` 内拦 + kbLayout 路径判断函数
- 关联:extends ADR-0002(raw 只读)、ADR-0011(kbHooks tool_call 拦截模式);补强 ADR-0003 D6 工具集

## 背景

pi 的文件工具(read/write/edit/grep/find/ls)路径解析走 `resolveToCwd`->`resolvePath`(`packages/coding-agent/src/utils/paths.ts`),本质是 `path.resolve`:`isAbsolute(input) ? resolve(input) : resolve(cwd, input)`。**不做 cwd sandbox**--agent 传绝对路径(`/etc/passwd`)或 `../` 逃逸(`../../server`)即可跳出 cwd(kb/),跨目录读写。

z-wiki 侧 kbHooks 的 `tool_call` 钩子(ADR-0011)原本只处理 read(拦非 md 后缀,提示 pandoc)与 write/edit(拦 raw/ 写,ADR-0002 决策 2),**不拦 grep/find/ls**,且 read/write/edit 的拦截也**不看路径是否在 kb/ 内**。agent cwd = kbRoot 只是默认路径,不是安全边界。

威胁:raw/ 是用户上传的外部文档(docx/pdf/网页转 md),可能含 prompt injection,诱导 agent 跨目录读 `config.json` 的 `apiKey`、`~/.ssh` 等,内容经 LLM API 外泄;write/edit 能写 kb/ 外(改 server 代码、写 shell 启动文件),比读更危险(持久化)。

## 决策

### D1:读/写边界不对称(读宽写严)

- 读工具(read/grep/find/ls/pandoc):边界 = kb/ 内**含 raw/**(ingest 要读 raw/,`buildIngestPrompt` 指示 `read raw/${rawName}`)。新函数 `isWithinKb(abs, kbRoot)`(`kbLayout.ts`):`path.relative(kbRoot, abs)` 不以 `..` 开头且非绝对。
- 写工具(write/edit):边界 = kb/ 内**且非 raw/**,复用现成 `isWritablePath`(已排除 raw/ + kb/ 外)。

### D2:拦截点分布(内置走 kbHooks,pandoc 走 execute)

- 内置工具(read/write/edit/grep/find/ls):kbHooks `tool_call` 钩子,按工具名取路径字段(read=`file_path`/`path`;grep/find/ls=`path`;write/edit=`file_path`),调 `shouldBlockReadPath`/`shouldBlockWritePath`(纯函数,单测)。
- pandoc(customTool):不经 `tool_call` 钩子(是否触发未确认),在 `makePandocTool.execute` 开头加 `isWithinKb` 检查,越界返回错误文本内容(非 `{block,reason}` 机制,customTool 限制)。

### D3:不处理 symlink

`isWithinKb` 是字符串 `path.relative` 判断,不解析 symlink。kb/ 内若存指向外的符号链接,agent 读该链接会逃逸。接受此风险:agent 无 bash(ADR-0011)不能 `ln -s` 自建 symlink,逃逸要求用户主动建链接,不属于 agent 攻击面。`fs.realpath` defense in depth 的成本(性能 + 链接断裂处理 + TOCTOU)与威胁不匹配。

### D4:write/edit 拦截统一

`shouldBlockWritePath` 替代原 `isWriteToRaw`:先判 `isRawPath`(raw 只读,ADR-0002 决策 2 reason)再判 `!isWritablePath`(kb/ 外越界 reason),一个函数两种 reason。`isWriteToRaw` 删除。

## 被否备选

- **改 pi 的 `resolvePath` 加 sandbox**:pi 是外部 npm 包 `@earendil-works/pi-coding-agent`,z-wiki 不 fork;契约是 server 侧加防御不改 pi(与 raw 只读同模式)。
- **`fs.realpath` 解析 symlink 后再判**:见 D3,成本不匹配。
- **只堵 grep/find/ls**:留 read 的洞(agent 仍能 `read` kb/ 外偷 apiKey),等于没堵;write/edit 能写 kb/ 外更危险。统一堵全部 7 个文件工具。
- **读写都排除 raw/**:破坏 ingest(要读 raw/),且 raw 只读是写约束不是读约束。

## 后果

- agent 不能跨 kb/ 检索/读写;跨库需求走 Vault 切换(ADR-0003 D7),非 agent 跨目录。
- pandoc 拦截点与其他工具不对称(在 execute 内,反馈是错误文本非 block),已记 D2。
- symlink 逃逸是已知未堵边缘(D3),未来若 agent 获得建链接能力须重审。
- `isWriteToRaw` 删除,write/edit 走 `shouldBlockWritePath` 统一 reason(raw 只读 vs 越界)。
- kbLayout 新增 `isWithinKb`(与 `isWritablePath` 对称,只差不排除 raw/)。

## 验证

- `kbHooks.test.ts` 补 `shouldBlockReadPath`/`shouldBlockWritePath` 用例:kb/ 内放行(含 raw/ 读)、kb/ 外绝对路径 block、`../` 逃逸 block、空/缺失放行、raw/ 写 block、可写区放行。14 测试全绿。
- `make typecheck`(4 tsconfig)通过;`npm test`(297)全绿;`make format` 无改动。
