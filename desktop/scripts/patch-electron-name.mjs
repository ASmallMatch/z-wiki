// 开发模式 patch:把 node_modules/electron/dist/Electron.app 的
// CFBundleName/CFBundleDisplayName 从 "Electron" 改为 "z-wiki",
// 让 macOS Mission Control/Dock/应用切换器显示 z-wiki。
//
// 原因:app.setName() 只改应用菜单,不影响 OS 读取的 bundle 名
// (Electron 文档明确:"it does not affect the name that the OS uses")。
// macOS 的 NSRunningApplication.localizedName 取自 bundle Info.plist,
// 故必须改 Electron.app 的 Info.plist。打包后由 electron-builder 的 Info.plist 接管。
//
// 副作用:npm i 重装 electron 会还原为 "Electron",需重跑(已集成进 npm run desktop)。
// 回退:npm rebuild electron 或 rm -rf node_modules/electron && npm i。
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

// 非 macOS 无需 patch(Windows/Linux 应用名走 app.setName + 图标)。
if (process.platform !== 'darwin') process.exit(0)

const APP_NAME = 'z-wiki'

// require('electron') 返回 Electron 二进制文件路径:
// .../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
const require = createRequire(import.meta.url)
const electronBin = require('electron')
// 二进制是文件不是目录,不能用字符串拼接 ".."(existsSync 不解析 ..,会 ENOTDIR),用 path.resolve 规范化。
const plistPath = path.resolve(electronBin, '../../Info.plist')
if (!existsSync(plistPath)) {
  console.warn('[patch-electron-name] Info.plist not found, skip')
  process.exit(0)
}

const readKey = (key) => {
  try {
    return execFileSync('defaults', ['read', plistPath, key], { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

// 幂等:已是目标名则跳过,避免每次 npm run desktop 都改+触发签名变化。
if (readKey('CFBundleName') === APP_NAME && readKey('CFBundleDisplayName') === APP_NAME) {
  process.exit(0)
}

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  execFileSync('plutil', ['-replace', key, '-string', APP_NAME, plistPath], { stdio: 'inherit' })
}
console.log(`[patch-electron-name] CFBundleName/CFBundleDisplayName -> "${APP_NAME}"`)
