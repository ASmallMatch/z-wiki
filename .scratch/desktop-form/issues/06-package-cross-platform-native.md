# 06: 打包 + 跨平台 + 原生体验

- 状态:`done`(commit `16ffab5`,2026-07-16)
- 父 PRD:`.scratch/desktop-form/PRD.md`
- 关联 ADR:`docs/adr/0003-desktop-form.md`(D1 跨平台、D6 win 兼容说明、D8 rg/fd 按平台)

## What to build

用 electron-builder 产出 Windows/Linux/Mac 三平台可运行包,并补齐原生桌面体验(菜单、拖拽上传、右键菜单)。完成后普通用户能拿到双击即用的安装包/可执行文件。

端到端行为:

- electron-builder 配置:mac(dmg)/ win(nsis)/ linux(AppImage);extraResources 按平台过滤 rg/fd 二进制 + `kb_example/` 样板进 bundle。
- build 流程:`npm run build -w web` 产 `web/dist` → `npm run build -w server` 产 `server/dist` → electron-builder 打包 desktop。
- 原生菜单:mac 顶部菜单定制(应用菜单 + Edit/View/Window/Help,去掉 Electron 占位无意义项);win/linux 标题栏符合习惯。
- 文件拖拽上传:窗口接收文件拖拽 → 走现有 `POST /api/upload`(Fastify multipart),不新写上传逻辑。
- 右键菜单:符合桌面习惯(替代浏览器默认右键)。
- win 无 bash 说明:首次启动检测 win 且无 Git Bash → 设置页/说明文档提示"bash 工具不可用,如需可安装 Git for Windows",但不阻断使用(默认 tools 不含 bash)。

## Acceptance criteria

- [ ] electron-builder 配置存在,`make package`(或等效)产出 mac/win/linux 三平台产物。
- [ ] extraResources 把 rg/fd(按平台)+ kb_example 打进 bundle,切片 4 的铺放逻辑能从 bundle 读到。
- [ ] build 流程文档化(Makefile target 或 README):web build → server build → electron-builder。
- [ ] mac 产物:`.app` 双击能跑,顶部菜单定制过(无 Electron 占位菜单)。
- [ ] win 产物:`.exe` 目录或 nsis 安装包双击能跑。
- [ ] linux 产物:AppImage `chmod +x` 后能跑。
- [ ] 拖拽文件到窗口 → 上传到 `/api/upload` 成功(复用现有上传端点)。
- [ ] 右键菜单是桌面风格(非浏览器默认)。
- [ ] win 无 bash 时不阻断使用,有明确提示(设置页或文档)。
- [ ] 手动验证:三平台各跑一次,确认应用启动、SPA 加载、agent 对话、上传 ingest、切库均工作。

## Blocked by

- `04-userdata-init-and-tool-bins.md`(rg/fd + kb_example 资源就绪)
- `05-settings-vault-switch-apikey.md`(设置页就绪,win 无 bash 提示挂在设置页)

## Notes

代码签名/公证(mac Apple Developer、Win 代码签名证书)是发布期投入,不在此切片的验收内 —— 首版可分发未签名产物(用户手动信任),签名作为后续运维任务。跨平台 rg/fd 自动下载在 Electron 打包后能否从 `getBinDir()` 加载,是切片 4 已验证的 spike,此处打包复用。


## 实现记录(commit `16ffab5`,2026-07-16)

**实现期决策:**
- 配置落 `desktop/electron-builder.yml`(独立文件,不塞 package.json `build` 字段)。
- mac dmg(arm64+x64,不做 universal)/ win nsis / linux AppImage(YAGNI,不加 deb)。
- `asar: false`:v1 简化路径解析,规避 preload/fs 在 asar 内的加载坑(ADR 未强制 asar,包体可接受)。
- electron 固定 `38.8.6`(electron-builder 要求精确版本非范围;≥38 满足 undici 约束)。

**关键 bug 修复(打包时暴露):**
- **extraResources 平台过滤**:${os} token 是 mac/win/linux,与 `process.platform`(darwin/win32/linux)不一致。原 `from: resources/bin/${os}-${arch}` 解析成 `mac-arm64`(不存在,实际是 `darwin-arm64`),bin 没打进 bundle。改用平台级 extraResources 显式写 `darwin-${arch}`/`win32-${arch}`/`linux-${arch}`,与 `paths.ts` `platformArch()` 同构。
- **win/linux executableName**:默认从 `@z-wiki/desktop` 派生含非法 `@`,AppImage build 失败。显式设 `executableName: z-wiki`。
- **pino-pretty transport**:server `isDev`(NODE_ENV!==production)在打包后为 true,触发 pino-pretty transport,但它是 devDep 不在 bundle,加载崩。env.ts 打包时设 `NODE_ENV=production`(dev 形态保留 pino-pretty)。
- **fetch-tool-bins extractArchive**:原按目标平台选 powershell/tar,mac 宿主解 win zip 失败。改按压缩包扩展名选工具(mac bsdtar `tar -xf` 解 zip,linux 回落 unzip)。

**原生体验:**
- 右键菜单:`contextMenu.ts` 纯函数构造模板(编辑 role + back/forward + 视图 role),`main.ts` `webContents(context-menu)` 弹出。纯函数 5 个单测。
- 拖拽上传:`useFileDrop` hook(ChatPanel 常驻挂载全局生效),拖文件到窗口走现有 `upload` -> `POST /api/upload`,不新写上传逻辑。
- Settings Git Bash 提示补强:明确"默认工具集不含 bash、win 无 Git Bash 不阻断"(issue 验收 9)。bash 已在 ADR-0011 从 AGENT_TOOLS 移除,shellPath 字段为预留覆盖口子。

**验证:**
- mac 完整冒烟(独立 userData-dir 强制首次启动):app 存活 + server 嵌入(随机端口)+ SPA 加载(/、/api/pages、assets 全 200)+ WS 连接 + rg/fd/pandoc 从 bundle 铺放到 `UserDataDir/.pi/agent/bin/`(Mach-O arm64)+ kb_example 复制 + config.json 写入。Info.plist CFBundleName=CFBundleDisplayName=`z-wiki`,exe 名 `z-wiki`。
- win/linux 交叉打包产物生成:`z-wiki Setup 0.1.0.exe`(nsis,x64)、`z-wiki-0.1.0.AppImage`(x64);win-unpacked 含 `win32-x64/` bin。未本地运行验证(mac 无法跑 win/linux),靠产物生成 + bin 入包 + 元数据正确。
- `make typecheck` 通过;`npm test` 274 过(+5 contextMenu);`make lint`/`make format` 干净。

**已知限制 / 后续:**
- win/linux 产物未真机验证(首版策略:mac 完整验证 + win/linux 产物生成,真机/CI 列后续)。
- 未签名:mac 双击被 Gatekeeper 拦,需右键 -> 打开(Makefile package target 已提示)。
- `make install` 用 `--ignore-scripts` 会跳过 electron 二进制下载;打包前需裸 `npm install` 装 electron(handoff 已注明)。
- 首版 `linux-arm64` 二进制已 fetch 但未配 linux arm64 target(YAGNI,需时加 `arch: [x64, arm64]`)。
- asar:false 包体偏大(mac ~180MB);未来可启用 asar + asarUnpack(preload)瘦身,需验证 pi/fastify-static 在 asar 内行为。
