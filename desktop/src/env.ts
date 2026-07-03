// env.ts — 副作用模块:在 pi SDK 被 import 前设环境变量。
// 必须作为 main.ts 的第一个 import(ESM 按声明顺序求值依赖图,先于此文件后的 import)。
//
// 关键:pi 的 tools-manager.js 顶层 `const TOOLS_DIR = getBinDir()` 在模块加载时求值,
// getBinDir() 读 process.env.PI_CODING_AGENT_DIR(默认 ~/.pi/agent)。server 传给
// DefaultResourceLoader 的 agentDir 参数不同步到此 env —— 故必须在此显式设,指向
// UserDataDir/.pi/agent,否则 pi 找不到预打进的 rg/fd(ADR-0003 D8)。
import { app } from 'electron'
import { agentDirFor } from './paths.js'

// 统一 app 名为 'z-wiki':package.json name 是 '@z-wiki/desktop',带斜杠会让
// userData 路径变成 ~/Library/Application Support/@z-wiki/desktop(可读性差 + 跨平台隐患)。
// 必须在任何 app.getPath('userData') 调用前设。
app.setName('z-wiki')

const userDataDir = app.getPath('userData')
process.env.PI_CODING_AGENT_DIR = agentDirFor(userDataDir)
// 禁用 pi 下载分支(ADR-0003 D8):国内 GitHub releases 不可达时不卡 10s 超时,必走预打进二进制。
process.env.PI_OFFLINE = '1'
