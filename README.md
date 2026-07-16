# z-wiki

基于 LLM agent 的个人知识库编译器。上传文档自动编译为 markdown 知识库,agent 可读 / 写 / 编辑 / 搜索 / 转换;数据在本机,server 走 loopback,本地优先。

## 安装

从 release 拿对应平台的包:

| 平台 | 包 | 用法 |
|---|---|---|
| Windows | `zwiki-setup-<ver>.exe`(安装版) / `z-wiki-<ver>-win.zip`(便携) | 安装版双击装;便携版解压后双击 `z-wiki.exe` |
| macOS | `z-wiki-<ver>-arm64.dmg`(Apple Silicon) / `z-wiki-<ver>.dmg`(Intel) | 双击 dmg,把 z-wiki 拖到「应用程序」 |
| Linux | `z-wiki-<ver>.AppImage` | `chmod +x z-wiki-*.AppImage` 后双击或 `./z-wiki-*.AppImage` |

## 首次启动较慢,属正常现象

**首次启动需等几十秒到 1 分钟,不要以为卡死打不开:**

- 首次需把内置的 pandoc(约 180MB)从安装包复制到用户数据目录(`copyFileSync` 同步,阻塞主进程)。
- 旧 Windows(见下)禁 GPU 后走软件渲染,初始化也慢。

**第二次起会快很多**:pandoc 不再复制(版本一致跳过),软件渲染缓存命中。

窗口出来后,先到「设置」填 LLM 配置(Base URL / 模型 / API Key),agent 才能调用。

## 旧 Windows 兼容

Windows 10 2004 以下(如 1809)上,Electron 的 GPU / 沙箱兼容差,app 会自动禁硬件加速 + 沙箱(app 内部检测系统 build 号)。代价:

- 首次启动更慢(软件渲染初始化)。
- 3D 书架首页走软件渲染,可能卡顿(核心知识库 / agent / 文章功能不受影响)。

双击 `z-wiki.exe` 即可(app 自动处理)。极少数情况仍有问题,可用 zip 便携包里的 `z-wiki.bat` 启动器(带 `--disable-gpu --no-sandbox` 启动)。

## 数据位置

- 配置 + agent 全局资源:`%APPDATA%\z-wiki\`(Windows)、`~/Library/Application Support/z-wiki`(mac)、`~/.config/z-wiki`(Linux)。
- 知识库内容:默认在 userData 下的 `kb/`,可在设置里切换 / 新建 Vault 到自定义位置(如 D 盘)。

重装 / 升级不丢数据(数据在 userData,不在安装目录)。

## 已知限制

- **未签名**:mac 双击被 Gatekeeper 拦,右键 -> 打开绕过;Windows SmartScreen 可能警告,点「仍要运行」。签名是后续运维投入。
- **无自动更新**:首版不做,升级需重新下载安装包。
- **3D 书架**:旧 Windows(软件渲染)可能卡;核心功能不受影响。

## 开发

见 `CLAUDE.md`(架构契约 + 命令)、`CONTEXT.md`(领域词汇)、`docs/adr/`(决策记录)。

打包:`make package`(默认当前平台;`TARGETS="--mac --win --linux"` 三平台交叉打包)。
拉取 rg/fd/pandoc 二进制(开发期):`tsx scripts/fetch-tool-bins.ts --all`。
bump 版本:`npm run bump <patch|minor|major|x.y.z>`(同步 4 个 package.json)。
