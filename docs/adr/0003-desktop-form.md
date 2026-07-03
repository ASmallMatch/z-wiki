# ADR-0003: 桌面形态 —— Electron in-process server + UserDataDir 引导配置 + Vault 模型

- 状态:accepted
- 日期:2026-07-02
- 范围:z-wiki 从"开发者本机跑 server + web dev"演进到"普通用户双击即用的桌面 app",涉及 shell 选型、数据目录拆分、运行时编排、切库语义
- 关联:ADR-0001(server seam)、ADR-0002(layer1 契约)、CONTEXT.md(桌面形态术语)

## 约束:不破坏现有三层代码

桌面化是**在三层之外加一层 shell + 编排**,不是把三层揉进 Electron。以下硬约束贯穿所有决策:

1. **三层物理边界不动**——`kb/`(layer1)、`web/`(layer2)、`server/`(layer3)仍是三个独立目录/包,不合并、不互相穿透。开发者现有工作流(`npm run dev` 起 server+web concurrently)不受影响。
2. **layer3 内部 seam 不动**——ADR-0001 的 AgentHost + Interaction 拆分、ADR-0002 的 layer1 契约(`kbLayout.ts` 集中定义、raw 只读走代码、buildView 走 HTTP)原样保留。
3. **只改入口与路径来源,不改 seam 形状**——本 ADR 触及 `agentHost.ts`/`index.ts`/`interaction.ts` 时,改的是"入口怎么被调"和"路径常量从哪来",不改这些模块对外的契约与职责边界。

## 背景

z-wiki 现状是开发形态:`npm run dev` 起两个进程(Fastify server on :3000 + Vite on :5173),所有路径用 `__dirname/../..` 推 `PROJECT_ROOT`,把代码与数据(`kb/`、`.pi/agent/`)绑死在一起。目标用户从开发者扩展到普通人,需要"双击即用、跨平台(Win/Linux/Mac)、重装不丢数据"。

为此评估了三种运行形态:

- **双击起服务 + 自动开浏览器**(单可执行文件,如 bun --compile):省一个原生壳,但**浏览器关了 server 不退**成为持续性的生命周期麻烦——普通用户不会去任务管理器杀进程,做托盘又滑回"自己做桌面"。
- **开发者 zip 包**:服务不到非技术用户,排除。
- **Electron 原生窗口**:主进程即 Node,server 零改造 in-process 跑;原生窗口天然解决"关窗口=关 app"的生命周期问题;一次性打包复杂度换持续的体验确定性。

## 决策

### D1: shell 选 Electron

主进程即 Node 运行时,pi SDK 纯 JS 无原生编译、`buildAgentContext`/`createInteraction` 原样可调,Fastify 的 WebSocket/multipart 能力零改造收下。代价是包体(~150MB)与内存,对一个本地知识库+LLM agent 工具可接受。

### D2: server 主进程内嵌(in-process),不走子进程

将 `server/src/index.ts` 的 `start()` 重构为导出 `createServer()` 返回 Fastify app 实例,Electron 主进程 import 它并在主进程内 listen。理由:改动最小;WebSocket/multipart 契约不动(守住三层架构);端口冲突用 `app.listen({port:0})` 取随机空闲端口规避,主进程把实际端口经 IPC/`loadURL` query 注入渲染进程。

不选 fork 子进程:隔离优势在小工具上不值得多带一个进程的打包/生命周期守护复杂度。崩了再说(可升级到子进程),符合"先简单后抽象"。

不选"拆掉 HTTP 走纯 IPC":要把 HTTP/WS/multipart 三套契约重写,无收益,违背"三层架构契约不变"。

### D2.1: 前端静态资源由 Fastify 同端口 serve

prod 下不跑 Vite dev server。`web` 构建为静态资源(`web/dist`),server 加 `@fastify/static` 同端口 serve。渲染进程 `loadURL('http://127.0.0.1:<port>/')`,SPA + API 同源。

选择依据:前端 `useChat.ts`/`useData.ts` 已用相对路径 `fetch('/api/...')`,同源下天然工作,前端代码一行不改;WebSocket 连接亦同源。复用 ADR-0001 的 HTTP 契约,不动 layer2/layer3 边界。

不选 `loadFile`(file://):SPA 从 file:// origin 请求 http:// API 跨源,需改 fetch 加完整 origin + 处理 CORS + WS 绝对地址,且 file:// 下 History 路由 404,对已有相对路径代码库是倒退。

### D3: 引入 UserDataDir,数据/代码物理分离

app bundle 只读(尤其 mac),`kb/`、`.pi/agent/`、`.env` 现有 `__dirname/../..` 推导会写爆只读目录。

- **引导配置**(app 自身启动所需、与具体知识库无关):固定落在 Electron `app.getPath('userData')`,真相源为单一 `config.json`。含已知 Vault 列表 + 当前打开项、API key、provider/model 配置、全局偏好。
- **Vault 内容**(随知识库走):`kb/`(layer1 全部)与该 Vault 的 agent 会话历史。

### D3.1: 单一真相源 = config.json,pi 文件为派生产物

`config.json` 是唯一真相源。`.pi/agent/` 下的 pi 契约文件不再由用户/设置页直接读写,而是启动时从 `config.json` 生成:

| 旧(`.pi/agent/` 一坨) | 新归属 | 真相源 | 派生产物 |
|---|---|---|---|
| `models.json` | 全局(UserDataDir) | `config.json` 的 provider/model 字段 | 启动时生成 `models.json` 喂 `ModelRegistry` |
| `auth.json` | — | `config.json` 的 `apiKey` 字段 | 不落盘,`setRuntimeApiKey` 运行时注入 |
| `sessions/chat/`、`sessions/` | 随 Vault | (会话本身) | pi 直接读写,Vault 切换即切历史 |

API key 明文存 `config.json`(威胁模型:本地单用户工具,loopback server,能读 userData 的攻击者已能读进程内存,keystore 防不住该层级;多用户/暴露网络时再升 keystore)。

设置页 = `config.json` 的 GUI 编辑器:改 provider/model 改 config,改 key 改 config。`models.json` 是生成物,`auth.json` 不存在。

对应代码:`agentHost.ts` 的 `AGENT_DIR`/`KB_ROOT`/`MODELS_JSON` 从"单一 PROJECT_ROOT 推导 + 写死路径"改为"全局 dir + 当前 Vault dir 两路输入 + 启动时生成 models.json"。

### D4: 多 Vault,切换语义为"换指针"非"搬数据"

借鉴 Obsidian:一台机器多个知识库,设置里切换,一次只开一个。切换 = 改"当前打开哪个 kb/",不搬运文件。新路径可为空(首次起步从 bundle 内 `kb_example/` 复制样板)或已存在 KB。

不选"搬家"模型:搬家可在"切换"之上叠出(切到新空库+复制内容+删旧库),反过来不行;且搬家是低频伪需求,先做切换符合"复制两次再抽象"。

### D5: 切换 Vault 时,活跃 ingest 阻止切换

ingest agent 的 cwd 在创建时绑死当前 `kb/`,切库只影响"下次创建 agent 用哪个路径",已在跑的 ingest 仍指旧库,会与已切到新库的 buildView/Interaction 状态分裂。

决策:检测到活跃 ingest 时,设置页禁用"切换"并提示"有上传正在处理,请等待完成"。`interaction.ts` 已持有 ingest session,加一个活跃布尔/计数即可暴露状态。

不选"取消 ingest 再切":ingest 无事务保证,半成品污染旧库难修。不选"排队等待":用户点切换以为切了实际没切,迷惑性更糟。

### D6: agent 工具集默认去掉 bash;win 兼容靠 pi 自探测 + 可选自备 Git Bash

读 pi 源码(`utils/shell.js`、`tools/bash.js`、`tools/grep.js`、`tools/find.js`、`tools/ls.js`)确认跨平台实情:

- `ls/read/edit/write` —— 纯 Node `fs`,跨平台零依赖。
- `grep/find` —— spawn `rg`(ripgrep)/ `fd`,`ensureTool` 支持自动下载二进制,win 上无需系统预装。
- `bash` —— 唯一依赖系统 shell。`getShellConfig()` 在 win 上依次找 `Program Files\Git\bin\bash.exe` → PATH 上的 `bash.exe` → 找不到抛错;支持 `shellPath` 配置覆盖。unix 走 `/bin/bash` → PATH → `sh`。

决策:

1. **默认 `tools` 去掉 `bash`**(`agentHost.ts:108/138` 的 tools 数组移除 `"bash"`)。z-wiki agent 是知识库编译器,`read/edit/write/grep/find/ls` 覆盖全部需求;去掉 bash 收紧能力面(用户上传源触发 agent 跑 `rm -rf` 的风险面消除),且 win/mac/linux 行为一致。
2. **bash 作为可选能力**:settings 里可开启。开启时 pi 的 `getShellConfig` 自动探测系统 Git Bash——win 用户装了 Git for Windows 即自动可用,无需我们配置。
3. **win 无 bash 时不阻断**:首次启动检测到 win 且无 bash → 设置页/说明文档提示"bash 工具不可用,如需可安装 Git for Windows"。默认工具集不含 bash,故普通用户双击即用不受影响。
4. **不捆绑 Git Bash**:源码证明 pi 已自带 rg/fd 自动下载,win 兼容性已解决大半;剩余的 bash 项不值得为它背 80MB 体积 + GPLv3 许可灰区 + MSYS2 路径转换坑。要求自备 + 写清说明,不违背双击即用。

### D7: 切换 Vault 的闭环 —— 显式指令 + 复用 WS 断开清理

切库是 server 层概念(改 agent session 绑定的 KB 路径),shell 只转发用户意图。入口 = 设置页 → `POST /api/vault/switch` → server。

读 `interaction.ts:194-229` 源码确认:chat session 是 **per-WS-connection**(每个 `/ws` 连接 `createChatSession` 一次,断开自动 `session.dispose()`),`chatClients` 为 Set 持有多连接。代码注释"常驻"为误导,实际非单例。

闭环:

1. 设置页发 `POST /api/vault/switch`,带目标 Vault 路径。
2. server 查活跃 ingest(D5)——有则 409 拒绝,前端提示等待。
3. 无活跃 → 更新"当前 Vault 路径" → 向所有 chatClients 推 `vault_changed` 事件(带新 Vault 元信息) → `socket.close()` 关闭连接。每个连接的 `on("close")` 自动 `session.dispose()`,**复用现有清理逻辑,无需新写 session 关闭代码**。
4. 重建 buildView(扫新 Vault)。
5. 前端检测到 `vault_changed` → 识别为切库(非崩溃)→ 清空消息列表 → 自动重连 WS → 重连时 `createChatSession` 用新 KB 路径 → 重拉 `/api/pages`。

这是 (A) 与 (B) 的混合,优于纯 (B):切库指令显式(POST 端点 + `vault_changed` 事件),但旧 session 消亡复用现有 WS 断开清理。前端唯一新增点:据 `vault_changed` 区分"切库重连"与"崩溃重连"。

子决策:

- **agent context 不随切库重建**:`buildAgentContext` 是全局单例(authStorage/modelRegistry/resourceLoader 均与具体 KB 无关,D3.1 已定全局)。切库只重建 chat session(绑 KB cwd),不碰 context。注意 `agentHost.ts` 中 resourceLoader 的 `cwd`(桌面形态下 = 全局 app 资源目录)与 chat session 的 `cwd`(= 当前 Vault 的 `kb/`)本就不同,切库只换后者。
- **不引入"chat session 单例化"改造**:现有 per-connection 模型保留,切库靠"关全部连接 + 重连自然用新路径"达成,不为切库把 session 改成单例(YAGNI)。

### D8: rg/fd 二进制预打进 UserDataDir 的 bin + `PI_OFFLINE=1`

读 pi 源码(`utils/tools-manager.js`)确认:`getToolPath(tool)` 探测顺序为 **`getBinDir()` 本地 → 系统 PATH → 下载**。`getBinDir() = join(getAgentDir(), "bin")`,即 `<全局 agentDir>/bin`(桌面形态下 = `UserDataDir/.pi/agent/bin/`)。只要二进制在此目录,pi 优先用,不下载。另有 `PI_OFFLINE=1` 环境变量彻底禁用下载分支。

决策:

1. **bundle 内带 rg/fd 二进制模板**(`resources/bin/<platform>-<arch>/`),首次启动复制到 `UserDataDir/.pi/agent/bin/`。与 D3.1 的"models.json 启动生成"同模式:bundle 只读模板 → 运行时铺到可写区。
2. **设 `PI_OFFLINE=1`**:Electron 主进程启动时 `process.env.PI_OFFLINE = "1"`,在 `buildAgentContext` 之前。pi 跳过所有下载尝试,保证国内用户网络不通(GitHub releases 不可达)不卡 10 秒超时,且无意外网络行为。
3. **版本管理**:bundle 内带版本号,首次启动检测 `getBinDir()` 已有二进制版本不一致则重新铺放,支持后续升级。

不选 PATH 注入(让 pi 走系统探测):依赖 PATH 在 agent 任何 spawn 之前已设好,时序脆弱;且无版本管理能力。预打进 pi 自己的探测首选路径,不依赖 PATH。

不选"把 agentDir 设成 bundle 只读目录让 getBinDir 自然指向":会让 auth/sessions 跟进只读区,爆炸。`getBinDir` 绑死 agentDir,不能单独指 bin。

许可证:ripgrep = MIT/Unlicense,fd = MIT。可商用捆绑,无 GPL 传染(与 D6 拒绝捆绑 Git Bash 的 GPLv3 顾虑对照)。代价:bundle 体积 +~15MB(win/mac/linux × x64/arm64 六套二进制),在已接受 Electron ~150MB 基础上可接受,换"国内用户离线可用 + 永不卡 GitHub 下载"。

### D9: Electron 主进程代码独立成 `desktop/` 顶层包,不穿透三层

遵守"不破坏现有三层"约束,主进程代码(窗口管理、rg/fd 铺放、`PI_OFFLINE` 设置、调 `createServer` 启动 server)独立成第四个顶层 workspace 包 `desktop/`,与 `server/`/`web/`/`kb/` 平级。

依赖方向单向:`desktop/` → `@z-wiki/server`,反向不存在。`server/` 不知道 desktop 存在,只通过显式导出的窄接口被接入:

- `createServer()`(D2 从 `index.ts` 的 `start()` 拆出)——返回 Fastify app 实例,desktop 主进程 listen 随机端口。
- `buildAgentContext()`——已导出,desktop 首次启动 / 切库时调(实际仍由 server 内部消费,desktop 仅触发生命周期)。

`desktop/` 不得 import server 内部模块(如 `interaction.ts`/`agentHost.ts` 的私有符号),只能用上述窄接口。这与 ADR-0001 "Interaction 通过 AgentHost 窄 interface 碰 agent" 是同一种纪律。

不选"主进程代码塞进 `server/`":让 server 包既 CLI 跑又 Electron 跑,污染 server 的 layer3 职责,破坏 ADR-0001 边界。不选塞进 `web/`:web 是 layer2 SPA,不该有 Node 主进程代码。

后果:`package.json` workspaces 加 `"desktop"`;electron-builder main 指 `desktop/dist/main.js`;server/web 的 build 与 tsconfig 不动。dev 形态(`npm run dev`)完全不受影响,desktop 是可选额外形态。

## 后果

- **领域语言**:CONTEXT.md 新增"桌面形态"一节——Shell(壳)、嵌入式 server、UserDataDir、Vault、引导配置、Vault 内容、切换 Vault。
- **首刀代码**:`agentHost.ts` 的 `AGENT_DIR`/`KB_ROOT` 重构为两路输入 + `MODELS_JSON` 改为启动生成;`index.ts` 的 `start()` 拆出 `createServer()` 并显式导出;`agentHost.ts` tools 数组去掉 `"bash"`;`interaction.ts` 新增 `/api/vault/switch` 端点 + `vault_changed` WS 事件 + 活跃 ingest 状态暴露;新建 `desktop/` 包(主进程入口、窗口管理、`PI_OFFLINE=1` 设置、首次启动从 bundle 铺放 rg/fd 到 `getBinDir()`、调 `createServer`)。
- **新增依赖**(`desktop/` 包内):electron、electron-builder、@fastify/static(prod 下同端口 serve SPA + API)。
- **新增 bundle 资源**:rg/fd 二进制(`resources/bin/<platform>-<arch>/`)、`kb_example/` 样板(首次起步用)。
- **未决**:签名/公证(mac Apple Developer、Win 代码签名证书)是发布期投入,非架构问题;自动更新(electron-updater)策略待定,不影响首版可运行。
