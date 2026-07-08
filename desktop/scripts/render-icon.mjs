import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 从 build/icon.svg 矢量渲染 1024 png(供 BrowserWindow.icon + app.dock.setIcon)。
// 背景透明:SVG 内已画 squircle 白底(圆角矩形,四角透明),Dock 显示圆角;
// resvg 不再铺整画布白底,否则四角不透明、Dock 里就是方形。打包生成 .icns/.ico 时也走这个源。
const here = path.dirname(fileURLToPath(import.meta.url))
const svgPath = path.join(here, '..', 'build', 'icon.svg')
const outPath = path.join(here, '..', 'build', 'icon.png')

const svg = fs.readFileSync(svgPath)
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1024 },
  background: 'transparent',
})
const png = resvg.render().asPng()
fs.writeFileSync(outPath, png)
console.log(`rendered ${outPath} (${png.length} bytes, ${resvg.width}x${resvg.height})`)
