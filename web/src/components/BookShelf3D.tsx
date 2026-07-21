import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PageMeta } from '../hooks/useData'
import type { Theme } from '../hooks/useTheme'
import { reflowSlot } from './bookShelfReflow.js'
import {
  clampRot,
  computeRealSlots,
  computeShelfSlots,
  cursorForState,
  flyToTarget,
  isClickMove,
  orbitAlignTarget,
  snapTarget,
  velocityFromSamples,
} from './bookShelfInteraction.js'

/* ═══════════════════════════════════════════════════
   BookShelf3D — Three.js 圆柱形 3D 书架
   13 槽位均分圆柱，拖拽旋转，吸附轮播，当前项突出
   ═══════════════════════════════════════════════════ */

interface BookShelf3DProps {
  pages: PageMeta[]
  onBookClick: (stem: string) => void
  onIntroDone?: () => void
  theme: Theme
}

// ---------- 配置 ----------
const BOOK_W = 2.0
const BOOK_H = 2.7
const BOOK_D = 0.55
const ROUND_R = 0.08
const ROUND_S = 4
const SLOT_COUNT = 17 // 总槽位数：可见 13（slotIndex∈[-6,6]）+ 每侧缓冲 2（±7、±8）。N>slots 时 virtual 启用 reflow 无缝换皮
const RADIUS = 28 // 轴半径（增大→浅弧一字排开；17 槽下加大以填满屏宽并维持更浅弧度）
const ANGLE_STEP = 0.05 // 每槽位基础角度（入场后随 spreadP 放大到 1.2x）
const FOCAL_Z = 3.0 // 抽出本沿径向前移（z = RADIUS + FOCAL_Z = 31；相机 z=35，距相机 4 完整可见；与待机书落差 4 保留前突纵深）
const CURRENT_SCALE = 1.15 // 抽出本缩放放大（随 select lerp，用尺寸补强被削弱的纵深演出）
const SELECT_LERP = 0.3 // select 独立 lerp 系数（快于姿态 0.1）：快速滑动中 currentSlot 切换快，select 须尽快爬到 1 才能让纵深/缩放/光泽/翻面演出立起来
const CURRENT_TILT_X = -0.5 // 抽出本绕 X 轴后仰（顶部远离相机，书口顶角朝上远）
const CURRENT_TILT_Z = 0.35 // 抽出本绕 Z 轴侧倾（书脊侧角着地、书口顶角朝上）
const RETREAT_Z = -1 // 其余书远离并稳定停在此 z（z = RADIUS + RETREAT_Z = 27；与抽出本落差 FOCAL_Z-RETREAT_Z=4）
const FAN_TILT = 0.03 // 远离时绕 y 微旋系数：左侧顺时针、右侧逆时针，呈捧中间姿态
const SPREAD_MAX = 0.2 // 间距倍率上浮（effectiveStep = ANGLE_STEP*(1+SPREAD_MAX*spreadP)，最大 1.2x）
const LIFT_FROM_Y = -4 // 入场起点 y
const HOVER_LOST_THRESHOLD = 5
// ---------- 拖拽惯性驱动 ----------
const PIXEL_TO_ANGLE = 0.012 // 像素→弧度：拖拽 1:1 抓取灵敏度（现场调）
const DRAG_FRICTION = 0.9 // 惯性指数摩擦（/帧，dt*60 缩放）
const VEL_SNAP_THRESHOLD = 0.4 // 角速度低于此值（弧度/秒）触发末端吸附
const HIT_NDC_THRESHOLD = 0.06 // 屏幕投影命中阈值（ndc，约屏宽 6%）：点击点落在此半径内才算命中某书
const HIT_NDC_THRESHOLD_CURRENT = 0.12 // 中心抽出本命中阈值：抽出本侧倾后仰致视觉中心偏离几何中心，放宽 2 倍保证好点中进详情

// 固定色调（与全局温润深色主题协调）
const PAPER_CREAM = '#e8ddd0'

// 档案色板:每本书的身份色,封面画图案直接取色(ADR-0020 D2 保留;用法见 ADR-0023 D3)
// 同一色相族(靛蓝/青碧/松绿/琥珀/茜红/堇紫)贯穿两主题,Archive 深宝石 / Draft 柔粉彩(ADR-0022 D3)。
// Archive 取高饱和中亮色:深灰中性载体上原色直画仍存活(石板蓝/深青/森林绿/皮棕/酒红/深紫)
const ARCHIVE_ACCENTS = [
  '#6b8fc7', // 靛青(主 accent)
  '#3fae9d', // 青碧
  '#4da568', // 松绿
  '#d09245', // 琥珀
  '#c25a68', // 茜红
  '#8f6fd0', // 堇紫
]

// 案卷色板：与 Archive 同色相族的柔化版（ADR-0022 D3）。
// 封面画里再经粉彩映射(mixColor 向纸白 0.35)呈雾蓝/青瓷/鼠尾草/沙金/灰玫/藕紫,协调不糖果
const DRAFT_ACCENTS = [
  '#2b6cb0', // 墨蓝（主，对齐 Draft accent；ADR-0022 D1）
  '#3f8f85', // 青碧
  '#4a8f5f', // 松绿
  '#b88a4a', // 陶土橙（ADR-0006 材质正色传承，降级偶发暖点缀）
  '#b0515a', // 茜红（偶发暖）
  '#7a63b0', // 堇紫
]

// 每套主题的书配色(ADR-0006 D3':纸边/accent 色板/灯光随主题;ADR-0023:书皮 = 中性载体 + 封面画)
interface BookThemeColors {
  paper: string // 纸边(书顶/书底/书边)
  carrier: string // 书皮中性载体(ADR-0023 D1:零色相、每本相同,彩色只活在封面画图案里)
  accents: string[] // 书身份色板(按书名 hash 分配到封面画图案;ADR-0020 D2)
  dirLightIntensity: number // 主光强度
  rimLightColor: number // rim 点光颜色
}

// Archive:深色舞台 + 鲜明档案色板;载体深灰 #333,与展台 #12121a 拉开一层(ADR-0023 后果节风险点)
const ARCHIVE_COLORS: BookThemeColors = {
  paper: PAPER_CREAM,
  carrier: '#333333',
  accents: ARCHIVE_ACCENTS,
  dirLightIntensity: 1.1,
  rimLightColor: 0x6b8fc7,
}

// Draft:净纸浅展台 + 案卷色板;载体纸白,与净纸展台靠明度+投影分层
const DRAFT_COLORS: BookThemeColors = {
  paper: '#fdfbf5', // 最亮纸白(书顶/书底/书边跳出)
  carrier: '#f7f6f3',
  accents: DRAFT_ACCENTS,
  dirLightIntensity: 0.8,
  rimLightColor: 0x2b6cb0,
}

function colorsFor(theme: Theme): BookThemeColors {
  return theme === 'draft' ? DRAFT_COLORS : ARCHIVE_COLORS
}

// ---------- 颜色工具 ----------

function hashAccent(str: string, accents: string[]): string {
  return accents[hashStr(str) % accents.length]
}

// 线性混色:t=0 全 a,t=1 全 b
function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16)
  const pb = parseInt(b.replace('#', ''), 16)
  const r = Math.round(((pa >> 16) & 0xff) * (1 - t) + ((pb >> 16) & 0xff) * t)
  const g = Math.round(((pa >> 8) & 0xff) * (1 - t) + ((pb >> 8) & 0xff) * t)
  const bl = Math.round((pa & 0xff) * (1 - t) + (pb & 0xff) * t)
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}

// 按背景明暗返回可读文字色：浅底→深字，深底→白字（slice 03：Draft 浅书皮需深字）
function contrastColor(bg: string): string {
  const num = parseInt(bg.replace('#', ''), 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1c1917' : '#fff'
}

function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + percent))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + percent))
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + percent))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ---------- 封面画生成(ADR-0023:中性载体 + 程序化构图原型) ----------
// 与设计确认样张(.scratch/cover-art)同一套生成逻辑:彩色只活在图案里,载体零色相、每本相同;
// 同一书名 seeded RNG 出图确定(D2),Archive 原色直画 / Draft 同色相粉彩映射(D3/D5)。

// 书名 hash(hashAccent 同款算法,封面画取种子用)
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h)
}

// 确定性 RNG:同一书名+主题每次生成一致
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Draft 粉彩映射:同色相,向纸白混 0.35,杀贴纸感但不洗成空书(ADR-0023 D5)
function pastel(c: string): string {
  return mixColor(c, '#fbf9f2', 0.35)
}

// 标题安静区:每种原型预留的低对比区域,text 为压在其上的可读字色
interface QuietZone {
  x: number
  y: number
  w: number
  h: number
  text: string
  avoid?: { y: number; h: number } // 卷号标额外避让区(大字原型的色块域)
}

// 原型绘制上下文:画笔/面尺寸/种子流/图案色捆一个对象,避免 (ctx,W,H,rng,A,A2,theme) 长参数列
interface ArtCtx {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  rng: () => number
  accent: string // 主图案色(Draft 已经粉彩映射)
  accent2: string // 副图案色
  carrier: string // 中性载体色(色带原型留载体带用)
  theme: Theme
}

// 安静区配色:Draft 白纸带 / Archive 暗带 + 可读字色(geo/bands/bigvol 共用,alpha 按原型微调)
function quietPalette(theme: Theme, alpha: number): { bg: string; text: string } {
  return theme === 'draft'
    ? { bg: `rgba(255,255,255,${alpha})`, text: '#2a2620' }
    : { bg: `rgba(0,0,0,${alpha})`, text: '#f2f0eb' }
}

// 原型 0:几何色块构成
// 覆盖率:块高有界 + 底部余量留载体 + 圆半径设上限,封面满幅/书脊下彩色均 ≤ ~70%(载体必露出);
// Draft 固定 4 块加密(与 bands Draft 密度看齐,避免"空书")
function drawGeoArt(art: ArtCtx): QuietZone {
  const { ctx, W, H, rng, accent, accent2, theme } = art
  const draft = theme === 'draft'
  const n = draft ? 4 : 3 + Math.floor(rng() * 2)
  const quietIdx = 1 + Math.floor(rng() * (n - 2)) // 安静区放中间某块
  const colors = [accent, accent2]
  let ci = 0
  let y = 0
  const pal = quietPalette(theme, 0.42)
  const quiet: QuietZone = { x: 0, y: 0, w: W, h: H, text: pal.text }
  for (let i = 0; i < n; i++) {
    const h = H * (draft ? 0.14 + rng() * 0.08 : 0.2 + rng() * 0.1)
    // 首块留载体;Archive n=4 时尾块也留载体;底部余量不画,露出载体本色
    const isColored = i !== quietIdx && i !== 0 && (draft || i !== n - 1)
    if (i === quietIdx) {
      ctx.fillStyle = pal.bg
      ctx.fillRect(0, y, W, h)
      quiet.y = y
      quiet.h = h
    } else if (isColored) {
      ctx.fillStyle = colors[ci++ % colors.length]
      ctx.fillRect(0, y, W, h)
    }
    y += h
  }
  // 大圆/半圆压在一个非安静块上,圆域不得侵入安静区;半径上限保 70% 覆盖率红线
  const cx = W * (0.3 + rng() * 0.4)
  const r = draft ? W * (0.18 + rng() * 0.1) : W * (0.22 + rng() * 0.14)
  const qBot = quiet.y + quiet.h
  const belowRoom = H - (qBot + r + 12)
  let cy: number
  if (belowRoom > r * 0.5) {
    cy = qBot + r + 12 + rng() * belowRoom
  } else if (quiet.y - r - 12 > r * 0.6) {
    cy = quiet.y - r - 12 - rng() * (quiet.y - r - 12) * 0.5 // 放安静区上方
  } else {
    cy = H - r * 0.3 // 空间不足就贴底边当半圆
  }
  ctx.fillStyle = accent2
  ctx.beginPath()
  ctx.arc(cx, Math.min(cy, H - r * 0.2), r, 0, Math.PI * 2)
  ctx.fill()
  // 小方块点缀
  ctx.fillStyle = accent
  const s = W * 0.18
  ctx.fillRect(W * 0.08, quiet.y - s * 1.6, s, s)
  return quiet
}

// 原型 1:斜切色带(色带与载体带交替,Archive 彩色 ≤ 50-60%;Draft 加密加宽避免"空书")
function drawBandsArt(art: ArtCtx): QuietZone {
  const { ctx, W, H, rng, accent, accent2, carrier, theme } = art
  const angle = -(0.28 + rng() * 0.3)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(angle)
  const span = Math.hypot(W, H) * 1.2
  const draft = theme === 'draft'
  const n = draft ? 5 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 2)
  const cols = draft
    ? [accent, accent2, carrier] // Draft:2/3 带彩色,带更宽更密
    : rng() < 0.5
      ? [accent, carrier, accent2, carrier]
      : [accent2, carrier, accent, carrier]
  let x = -span / 2
  for (let i = 0; i < n; i++) {
    const bw = span * (draft ? 0.12 + rng() * 0.14 : 0.1 + rng() * 0.16)
    ctx.fillStyle = cols[i % cols.length]
    ctx.fillRect(x, -span / 2, bw, span)
    x += bw
  }
  ctx.restore()
  // 安静区:横贯纯色带 + accent 细线压边
  const pal = quietPalette(theme, draft ? 0.88 : 0.45)
  const qh = H * 0.34
  const qy = H * (0.3 + rng() * 0.22)
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, qy, W, qh)
  ctx.fillStyle = accent
  ctx.fillRect(0, qy - 3, W, 3)
  ctx.fillRect(0, qy + qh, W, 3)
  return { x: 0, y: qy, w: W, h: qh, text: pal.text }
}

// 原型 2:渐变大字卷号(色块内缩一圈,两侧+上下露出载体本色带,彩色 ~45-55%)
function drawBigVolArt(art: ArtCtx, vol: number): QuietZone {
  const { ctx, W, H, rng, accent, theme } = art
  const top = rng() < 0.5
  const m = W * 0.064 // 两侧内缩,露出载体描边
  const ph = H * (0.42 + rng() * 0.06)
  const py = top ? H * 0.05 : H * 0.95 - ph
  const g = ctx.createLinearGradient(0, py, 0, py + ph)
  g.addColorStop(0, accent)
  g.addColorStop(
    1,
    theme === 'draft' ? mixColor(accent, '#ffffff', 0.55) : mixColor(accent, '#000000', 0.55),
  )
  ctx.fillStyle = g
  ctx.fillRect(m, py, W - 2 * m, ph)
  // 巨大卷号数字,裁在色块内
  const num = String(vol).padStart(2, '0')
  ctx.save()
  ctx.beginPath()
  ctx.rect(m, py, W - 2 * m, ph)
  ctx.clip()
  ctx.translate(W / 2, py + ph / 2)
  ctx.rotate(rng() < 0.5 ? 0 : -Math.PI / 2)
  ctx.font = `900 ${W * 1.5}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = theme === 'draft' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'
  ctx.fillText(num, 0, 0)
  ctx.restore()
  // 安静区:对侧横带(与色块之间留一条载体本色带)
  const pal = quietPalette(theme, theme === 'draft' ? 0.9 : 0.5)
  const qh = H * 0.4
  const qy = top ? H * 0.56 : H * 0.05
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, qy, W, qh)
  return {
    x: 0,
    y: qy,
    w: W,
    h: qh,
    text: pal.text,
    avoid: { y: py, h: ph }, // 卷号标也别压色块/巨大数字
  }
}

// 原型 3:散点贴纸风(安静区 = 居中圆角纸标签;Draft 贴纸加密加大避免"空书")
function drawStickersArt(art: ArtCtx): QuietZone {
  const { ctx, W, H, rng, accent, accent2, theme } = art
  const draft = theme === 'draft'
  const k = W / 110 // 样张基准宽 110,贴纸尺寸随面宽等比
  const qw = W * 0.78
  const qh = H * 0.42
  const qx = (W - qw) / 2
  const qy = H * (0.26 + rng() * 0.14)
  // 先撒贴纸(避开标签区)
  const n = draft ? 26 + Math.floor(rng() * 10) : 16 + Math.floor(rng() * 8)
  for (let i = 0; i < n; i++) {
    const x = W * rng()
    const y = H * rng()
    if (x > qx - 14 * k && x < qx + qw + 14 * k && y > qy - 14 * k && y < qy + qh + 14 * k) continue
    const kind = Math.floor(rng() * 4)
    const c = rng() < 0.6 ? accent : accent2
    ctx.fillStyle = c
    ctx.strokeStyle = c
    const s = ((draft ? 6 : 4) + rng() * (draft ? 10 : 8)) * k
    if (kind === 0) {
      ctx.beginPath()
      ctx.arc(x, y, s / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 1) {
      ctx.lineWidth = draft ? 3 * k : 2 * k
      ctx.beginPath()
      ctx.arc(x, y, s / 2, 0, Math.PI * 2)
      ctx.stroke()
    } else if (kind === 2) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rng() * Math.PI)
      ctx.fillRect(-s / 2, -s / 2, s, s)
      ctx.restore()
    } else {
      ctx.lineWidth = draft ? 3 * k : 2 * k
      ctx.beginPath()
      ctx.moveTo(x - s / 2, y)
      ctx.lineTo(x + s / 2, y)
      ctx.moveTo(x, y - s / 2)
      ctx.lineTo(x, y + s / 2)
      ctx.stroke()
    }
  }
  // 纸标签
  ctx.fillStyle = draft ? '#ffffff' : '#efe8d8'
  ctx.beginPath()
  ctx.roundRect(qx, qy, qw, qh, 6 * k)
  ctx.fill()
  ctx.strokeStyle = draft ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  ctx.stroke()
  // 纸标签是浅色,两主题都用深字
  return { x: qx, y: qy, w: qw, h: qh, text: '#2a2620' }
}

// 可选部件:胶带(部分原型随 hash 出现,ADR-0023 D4)
function drawTapeArt(art: ArtCtx): void {
  const { ctx, W, H, rng, accent, theme } = art
  const k = W / 110
  ctx.save()
  ctx.translate(W * (0.2 + rng() * 0.6), H * 0.09)
  ctx.rotate((rng() - 0.5) * 0.7)
  ctx.fillStyle = accent
  ctx.globalAlpha = theme === 'draft' ? 0.75 : 0.85
  ctx.fillRect(-W * 0.3, -9 * k, W * 0.6, 18 * k)
  ctx.globalAlpha = 1
  ctx.restore()
}

// 封面画主体:中性载体上按书名 hash 选原型画图案(书脊/封面共用),返回安静区与主图案色
interface CoverArtData {
  title: string
  vol: number
  colors: BookThemeColors
  theme: Theme
}

// 原型选择的盐:与色相分配(hashStr(title)%6)解绑——同源时 gcd(4,6)=2 只有 12 种
// (原型,色相) 组合可达,独立 hash 后 24 种全可达;书脊/封面/两主题共用同一盐保持一致
const PROTO_SEED_SALT = '#proto'

function paintCoverArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  data: CoverArtData,
): { quiet: QuietZone; accent: string } {
  const seed = hashStr(data.title)
  const rng = mulberry32(seed)
  const accents = data.colors.accents
  const accentRaw = accents[seed % accents.length]
  let accent2Raw = accents[(seed + 1 + Math.floor(rng() * (accents.length - 1))) % accents.length]
  if (accent2Raw === accentRaw) accent2Raw = accents[(seed + 3) % accents.length]
  // Archive 高饱和原色直画;Draft 同色相粉彩映射(ADR-0023 D3/D5)
  const toArtColor = data.theme === 'draft' ? pastel : (c: string) => c
  const art: ArtCtx = {
    ctx,
    W,
    H,
    rng,
    accent: toArtColor(accentRaw),
    accent2: toArtColor(accent2Raw),
    carrier: data.colors.carrier,
    theme: data.theme,
  }
  const proto = hashStr(data.title + PROTO_SEED_SALT) % 4 // 构图原型按书名 hash 选(D2)

  ctx.fillStyle = data.colors.carrier
  ctx.fillRect(0, 0, W, H)

  let quiet: QuietZone
  if (proto === 0) quiet = drawGeoArt(art)
  else if (proto === 1) quiet = drawBandsArt(art)
  else if (proto === 2) quiet = drawBigVolArt(art, data.vol)
  else quiet = drawStickersArt(art)

  if ((proto === 0 || proto === 3) && rng() < 0.55) drawTapeArt(art)
  return { quiet, accent: art.accent }
}

// 顶/底纸边(书脊,保留 ADR-0006 材质正色)
function drawPaperEdgeArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  paper: string,
  theme: Theme,
): void {
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, 7)
  ctx.fillRect(0, H - 9, W, 9)
  ctx.fillStyle = theme === 'draft' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.3)'
  ctx.fillRect(0, 7, W, 1)
  ctx.fillRect(0, H - 10, W, 1)
}

// 卷号标(书脊,保留;候选位置避开安静区与大字色块)
function drawVolTagArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  accent: string,
  label: string,
  quiet: QuietZone,
): void {
  const tw = 46
  const th = 16
  const x = (W - tw) / 2
  const zones: { y: number; h: number }[] = quiet.avoid ? [quiet, quiet.avoid] : [quiet]
  const overlaps = (y: number) => zones.some((z) => y < z.y + z.h + 6 && y + th > z.y - 6)
  const candidates = [H * 0.06, H * 0.5, H - H * 0.06 - th, H * 0.3, H * 0.68]
  const found = candidates.find((c) => !overlaps(c))
  const y = found ?? (quiet.y > H / 2 ? H * 0.04 : H - th - H * 0.04)
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.roundRect(x, y, tw, th, 3)
  ctx.fill()
  ctx.fillStyle = contrastColor(accent)
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, W / 2, y + th / 2 + 0.5)
}

// 竖排书名压安静区(中文 2-8 字,字号随安静区高度自适应)
function drawVerticalTitle(ctx: CanvasRenderingContext2D, quiet: QuietZone, title: string): void {
  const chars = [...title]
  const fs = Math.min(24, (quiet.h - 20) / chars.length - 2)
  ctx.fillStyle = quiet.text
  ctx.font = `bold ${fs}px "PingFang SC", "Hiragino Sans GB", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = fs + 4
  const total = lh * chars.length
  let y = quiet.y + quiet.h / 2 - total / 2 + lh / 2
  for (const ch of chars) {
    ctx.fillText(ch, quiet.x + quiet.w / 2, y)
    y += lh
  }
}

// 噪点独立种子流的盐:与原型/参数流解耦,构图逻辑改动不带动噪点图案漂移
const NOISE_SEED_SALT = 0x5eed

// 噪点做旧(ADR-0023 D4;独立种子流,密度随面积等比)
function drawNoiseArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  rng: () => number,
): void {
  const count = Math.round((700 * W * H) / (110 * 601))
  ctx.globalAlpha = 0.06
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng() > 0.5 ? '#fff' : '#000'
    ctx.fillRect(rng() * W, rng() * H, 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

// 封面(正面)= 同一原型构图的满幅版:图案铺满,书名横排压安静区(ADR-0023 D4 可读性优先)
function makeCoverTexture(
  data: CoverArtData & { subtitle: string; meta: string },
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 700
  const ctx = ctx2d(canvas)

  const { quiet, accent } = paintCoverArt(ctx, 512, 700, data)

  // 类型标(WIKI/REPORT,小件锋利语言,保留)
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.roundRect(360, 50, 120, 42, 4)
  ctx.fill()
  ctx.fillStyle = contrastColor(accent)
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(data.meta, 420, 78)

  // 书名横排压安静区(单行自适应:54px 起按宽度等比缩,下限 36px,仍超则末尾省略)
  const cx = quiet.x + quiet.w / 2
  const cy = quiet.y + quiet.h / 2
  ctx.fillStyle = quiet.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const TITLE_MAX_W = quiet.w - 48
  const TITLE_MAX_FS = Math.min(54, quiet.h * 0.3)
  const TITLE_MIN_FS = 36
  let fs = TITLE_MAX_FS
  ctx.font = `bold ${fs}px sans-serif`
  while (fs > TITLE_MIN_FS && ctx.measureText(data.title).width > TITLE_MAX_W) {
    fs -= 1
    ctx.font = `bold ${fs}px sans-serif`
  }
  let titleText = data.title
  if (ctx.measureText(titleText).width > TITLE_MAX_W) {
    while (titleText.length > 0 && ctx.measureText(`${titleText}…`).width > TITLE_MAX_W) {
      titleText = titleText.slice(0, -1)
    }
    titleText += '…'
  }
  ctx.fillText(titleText, cx, cy - 14)
  ctx.globalAlpha = 0.75
  ctx.font = '26px sans-serif'
  ctx.fillText(data.subtitle, cx, cy + Math.max(26, fs * 0.85))
  ctx.globalAlpha = 1

  drawNoiseArt(ctx, 512, 700, mulberry32(hashStr(data.title) ^ NOISE_SEED_SALT))

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// 背面 = 中性载体基底(ADR-0023),既有 accent 顶条/标题/摘要/条码/meta 内容保留(最小侵入)
function makeBackTexture(data: {
  title: string
  accent: string
  carrier: string
  backText: string
  meta: string
}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 700
  const ctx = ctx2d(canvas)
  const textColor = contrastColor(data.carrier)

  ctx.fillStyle = data.carrier
  ctx.fillRect(0, 0, 512, 700)
  ctx.fillStyle = data.accent
  ctx.fillRect(0, 0, 512, 12)
  ctx.fillStyle = textColor
  ctx.font = 'bold 40px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(data.title, 40, 90)
  ctx.fillStyle = textColor
  ctx.font = '26px sans-serif'

  // 自动换行
  let line = '',
    y = 160
  for (const ch of data.backText) {
    const test = line + ch
    if (ctx.measureText(test).width > 430 && line.length > 0) {
      ctx.fillText(line, 40, y)
      line = ch
      y += 44
    } else {
      line = test
    }
  }
  ctx.fillText(line, 40, y)

  // 条码(seeded,同一书名列宽一致)
  const rng = mulberry32(hashStr(data.title) ^ 0xba4c0de)
  ctx.fillStyle = textColor === '#fff' ? 'rgba(255,255,255,0.25)' : 'rgba(28,25,23,0.3)'
  for (let i = 0; i < 30; i++) ctx.fillRect(40 + i * 12, 580, 6 + rng() * 4, 60)
  ctx.fillStyle = data.accent
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(data.meta, 40, 690)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// 书脊 = 设计确认样张的样子:中性载体 + 封面画 + 竖排书名压安静区 + 纸边/卷号标 + 噪点(ADR-0023 D6)
function makeSpineTexture(data: CoverArtData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 700
  const ctx = ctx2d(canvas)
  // 按样张逻辑尺寸(宽 110)等比绘制,构图比例与确认样张一致
  const S = 128 / 110
  const W = 110
  const H = 700 / S
  ctx.scale(S, S)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()

  const { quiet, accent } = paintCoverArt(ctx, W, H, data)

  drawPaperEdgeArt(ctx, W, H, data.colors.paper, data.theme)
  drawVolTagArt(ctx, W, H, accent, `Vol.${String(data.vol).padStart(2, '0')}`, quiet)
  drawVerticalTitle(ctx, quiet, data.title)
  drawNoiseArt(ctx, W, H, mulberry32(hashStr(data.title) ^ NOISE_SEED_SALT))

  // 书脊立体边:左暗右亮
  const g = ctx.createLinearGradient(0, 0, 10, 0)
  g.addColorStop(0, 'rgba(0,0,0,0.4)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 10, H)
  ctx.fillStyle = data.theme === 'draft' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)'
  ctx.fillRect(W - 2, 0, 2, H)
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeEdgeTexture(paper: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 700
  const ctx = ctx2d(canvas)

  const grd = ctx.createLinearGradient(0, 0, 256, 700)
  grd.addColorStop(0, shadeColor(paper, -12))
  grd.addColorStop(0.5, paper)
  grd.addColorStop(1, shadeColor(paper, -18))
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, 256, 700)

  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#6b5e4f'
  for (let i = 0; i < 700; i += 3) ctx.fillRect(0, i, 256, 1)
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#fff'
  for (let i = 1; i < 700; i += 6) ctx.fillRect(0, i, 256, 1)
  ctx.globalAlpha = 0.08
  ctx.fillStyle = '#3a3228'
  for (let i = 0; i < 700; i += 8) ctx.fillRect(0, i, Math.random() * 6 + 2, 3)
  ctx.globalAlpha = 0.18
  const vGrd = ctx.createLinearGradient(0, 0, 256, 0)
  vGrd.addColorStop(0, 'rgba(0,0,0,0.5)')
  vGrd.addColorStop(0.25, 'rgba(0,0,0,0)')
  vGrd.addColorStop(0.75, 'rgba(0,0,0,0)')
  vGrd.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vGrd
  ctx.fillRect(0, 0, 256, 700)
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeTopBottomTexture(paper: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = ctx2d(canvas)

  const grd = ctx.createLinearGradient(0, 0, 512, 256)
  grd.addColorStop(0, shadeColor(paper, -14))
  grd.addColorStop(0.5, paper)
  grd.addColorStop(1, shadeColor(paper, -20))
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, 512, 256)
  ctx.globalAlpha = 0.28
  ctx.fillStyle = '#7a6b5a'
  for (let i = 0; i < 512; i += 5) ctx.fillRect(i, 0, 1, 256)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 512, 18)
  ctx.fillRect(0, 238, 512, 18)
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// canvas 2d 上下文快捷获取
function ctx2d(canvas: HTMLCanvasElement) {
  // biome-ignore lint/style/noNonNullAssertion: 2d context 对 HTMLCanvasElement 不会返回 null
  return canvas.getContext('2d')!
}

// ---------- Shader（封面光泽） ----------

const SHEEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SHEEN_FRAGMENT = `
  uniform sampler2D uTexture;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec4 baseColor = texture2D(uTexture, vUv);
    vec2 sheenCenter = uMouse + vec2(sin(uTime * 0.5) * 0.08, cos(uTime * 0.4) * 0.08);
    float dist = length(vUv - sheenCenter);
    float sheen1 = pow(max(0.0, 1.0 - dist * 3.5), 3.0);
    float sheen2 = pow(max(0.0, 1.0 - dist * 6.0), 5.0) * 0.5;
    float sheen = (sheen1 + sheen2) * uIntensity;
    vec3 sheenColor = vec3(1.0, 0.96, 0.88);
    gl_FragColor = vec4(baseColor.rgb + sheenColor * sheen, baseColor.a);
  }
`

// ---------- 单本书的皮肤（可换皮的纹理组合） ----------

interface BookSkin {
  cover: THREE.CanvasTexture
  spine: THREE.CanvasTexture
  back: THREE.CanvasTexture
}

// 换皮句柄的类型：主 useEffect 写入，副 useEffect([theme]) 读出换 texture/灯光(ADR-0006 D2')
interface SwappableBook {
  dataIndex: number
  coverMat: THREE.ShaderMaterial
  spineMat: THREE.MeshStandardMaterial
  backMat: THREE.MeshStandardMaterial
  topMat: THREE.MeshStandardMaterial
  edgeMat: THREE.MeshStandardMaterial
}

interface SceneHandles {
  allSlots: SwappableBook[]
  skinPools: Record<Theme, BookSkin[]>
  topBotTexs: Record<Theme, THREE.CanvasTexture>
  edgeTexs: Record<Theme, THREE.CanvasTexture>
  dirLight: THREE.DirectionalLight
  rimLight: THREE.PointLight
}

/* ═══════════════════════════════════════════════════
   React 组件
   ═══════════════════════════════════════════════════ */

export default function BookShelf3D({ pages, onBookClick, onIntroDone, theme }: BookShelf3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onIntroDoneRef = useRef(onIntroDone)
  onIntroDoneRef.current = onIntroDone
  // onBookClick 走 ref 移出 deps：不依赖父组件 useCallback 纪律，避免父组件未 memo 时整场景重建
  const onBookClickRef = useRef(onBookClick)
  onBookClickRef.current = onBookClick

  // 换皮句柄：主 useEffect 写入，副 useEffect([theme]) 读出换 texture/灯光，不重建场景(ADR-0006 D2')
  const sceneRef = useRef<SceneHandles | null>(null)
  // 当前主题 ref：applySkin（滚动虚拟化换皮）读它选对应 skinPool；每次 render 同步更新
  const themeRef = useRef<Theme>(theme)
  themeRef.current = theme

  // biome-ignore lint/correctness/useExhaustiveDependencies: theme 故意不进依赖,走副 useEffect([theme]) 换皮不重建场景(ADR-0006 D2')
  useEffect(() => {
    const container = containerRef.current
    if (!container || pages.length === 0) return

    // 按更新时间排序（最新的在前）
    const sorted = [...pages].sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
    )
    const N = sorted.length
    const { slots, half, virtual } = computeShelfSlots(N, SLOT_COUNT)
    // 真书槽集（ADR-0015 D2）：N=1,2 补虚拟位时跳过 mod 重复槽，虚拟位不建 mesh/不进 allSlots。
    // realMin/Max 是 currentSlot 量化与 clamp/snap 的边界（D3/D4），永不着陆虚拟位。
    const realSlots = computeRealSlots(slots, N)
    const realMin = realSlots[0]
    const realMax = realSlots[realSlots.length - 1]
    const step = ANGLE_STEP // 槽位角步长（浅弧，非闭合圆）

    // ---------- 预生成两套纹理池（archive + draft，ADR-0006 D2'） ----------
    const makeSkinPool = (colors: BookThemeColors, theme: Theme): BookSkin[] =>
      sorted.map((page, i) => ({
        cover: makeCoverTexture({
          title: page.title,
          subtitle: page.type === 'wiki' ? '知识库' : '报告与分析',
          meta: page.type === 'wiki' ? 'WIKI' : 'REPORT',
          vol: i + 1,
          colors,
          theme,
        }),
        spine: makeSpineTexture({ title: page.title, vol: i + 1, colors, theme }),
        back: makeBackTexture({
          title: page.title,
          accent: hashAccent(page.title, colors.accents),
          carrier: colors.carrier,
          backText: page.summary || page.title,
          meta: page.updated,
        }),
      }))
    const skinPools: Record<Theme, BookSkin[]> = {
      archive: makeSkinPool(ARCHIVE_COLORS, 'archive'),
      draft: makeSkinPool(DRAFT_COLORS, 'draft'),
    }
    const skinPool = skinPools[theme] // 初始用当前主题；主题切换由副 useEffect 换

    // 通用纹理（不依赖书名，两套）
    const edgeTexs: Record<Theme, THREE.CanvasTexture> = {
      archive: makeEdgeTexture(ARCHIVE_COLORS.paper),
      draft: makeEdgeTexture(DRAFT_COLORS.paper),
    }
    const topBotTexs: Record<Theme, THREE.CanvasTexture> = {
      archive: makeTopBottomTexture(ARCHIVE_COLORS.paper, shadeColor(ARCHIVE_COLORS.paper, -55)),
      draft: makeTopBottomTexture(DRAFT_COLORS.paper, shadeColor(DRAFT_COLORS.paper, -55)),
    }
    const edgeTex = edgeTexs[theme]
    const topBotTex = topBotTexs[theme]
    const sharedGeo = new RoundedBoxGeometry(BOOK_W, BOOK_H, BOOK_D, ROUND_S, ROUND_R)

    // ---------- 场景 ----------
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    )
    camera.position.set(0, 0, 35)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(renderer.domElement)

    // ---------- 光照 ----------
    const initColors = colorsFor(theme)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xfff5e6, initColors.dirLightIntensity)
    dirLight.position.set(5, 8, 7)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    scene.add(dirLight)

    const rimLight = new THREE.PointLight(initColors.rimLightColor, 0.9, 35)
    rimLight.position.set(-6, 3, 8)
    scene.add(rimLight)

    const mouseLight = new THREE.PointLight(0xffffff, 0.8, 18)
    mouseLight.position.set(0, 0, 28)
    scene.add(mouseLight)

    // ---------- 书本（对象池） ----------
    const bookContainer = new THREE.Group()
    scene.add(bookContainer)

    interface BookSlot {
      group: THREE.Group
      coverMat: THREE.ShaderMaterial
      spineMat: THREE.MeshStandardMaterial
      backMat: THREE.MeshStandardMaterial
      topMat: THREE.MeshStandardMaterial
      edgeMat: THREE.MeshStandardMaterial
      frontUniforms: {
        uTexture: THREE.IUniform
        uMouse: THREE.IUniform
        uTime: THREE.IUniform
        uIntensity: THREE.IUniform
      }
      slotIndex: number // 当前圆柱槽位（可换皮后超出 -half..half）
      dataIndex: number // 绑定的数据索引
      isCenter3: boolean // 是否属于入场动作2 先升的中间3本（|slotIndex|<=1，换皮后不重算）
      select: number // 各自的抽出进度（isCurrent 时 lerp 向 1，否则 0；入场由 selectIntro 驱动）
      stem: string
    }

    const slotMap = new Map<number, BookSlot>()
    const allSlots: BookSlot[] = []

    function applySkin(book: BookSlot, dataIndex: number) {
      const skin = skinPools[themeRef.current][dataIndex]
      book.coverMat.uniforms.uTexture.value = skin.cover
      book.spineMat.map = skin.spine
      book.spineMat.needsUpdate = true
      book.backMat.map = skin.back
      book.backMat.needsUpdate = true
      book.dataIndex = dataIndex
      book.stem = sorted[dataIndex].stem
    }

    // 创建真书对象（ADR-0015 D2）：遍历 realSlots，虚拟位（N=1,2 的 mod 重复槽）不建 mesh。
    // 数据索引 ≡ slotIndex (mod N)，realSlots 已去重所以 dataIndex 不重复。
    for (const slotIndex of realSlots) {
      const dataIndex = ((slotIndex % N) + N) % N
      const page = sorted[dataIndex]
      const skin = skinPool[dataIndex]

      const bookGroup = new THREE.Group()
      const a = slotIndex * step

      const frontUniforms = {
        uTexture: { value: skin.cover },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uIntensity: { value: 0.0 },
      }
      const coverMat = new THREE.ShaderMaterial({
        uniforms: frontUniforms,
        vertexShader: SHEEN_VERTEX,
        fragmentShader: SHEEN_FRAGMENT,
        transparent: true,
      })
      const spineMat = new THREE.MeshStandardMaterial({ map: skin.spine, roughness: 0.5 })
      const backMat = new THREE.MeshStandardMaterial({ map: skin.back, roughness: 0.5 })
      const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.85 })
      const topMat = new THREE.MeshStandardMaterial({ map: topBotTex, roughness: 0.85 })

      // 面顺序：+x(切口), -x(书脊), +y(顶), -y(底), +z(封面), -z(背面)
      const materials = [edgeMat, spineMat, topMat, topMat, coverMat, backMat]
      const book = new THREE.Mesh(sharedGeo, materials)
      book.castShadow = true
      book.receiveShadow = true
      bookGroup.add(book)

      bookGroup.scale.setScalar(1)
      bookGroup.position.set(Math.sin(a) * RADIUS, LIFT_FROM_Y, RADIUS)
      bookGroup.rotation.y = a + Math.PI / 2 // 书脊朝镜头

      bookContainer.add(bookGroup)

      const slot: BookSlot = {
        group: bookGroup,
        coverMat,
        spineMat,
        backMat,
        topMat,
        edgeMat,
        frontUniforms,
        slotIndex,
        dataIndex,
        isCenter3: Math.abs(slotIndex) <= 1,
        select: 0,
        stem: page.stem,
      }
      allSlots.push(slot)
      slotMap.set(slotIndex, slot)

      // 入场动画完全由渲染循环根据 yLift3/yLiftRest/selectP/retreatP/spreadP 驱动，
      // 不在此处用 gsap 直接改 position，避免与渲染循环 lerp 冲突。
    }

    // ---------- 交互状态 ----------
    const mouse = new THREE.Vector2()
    const targetMouse = new THREE.Vector2()
    let pointerInside = false // 指针是否在容器内（驱动 hover 光泽）
    let orbiting = false // 轨道球自由旋转（中键/空格 toggle，仅中心抽出本）
    // 滑轨模型：rot.val（弧度）直接驱动所有书角度 a = slotIndex*effStep + rot.val。
    // currentSlot = round(-rot.val/effStep) 是当前正前方槽位（固定舞台），滑到中心的书做抽出动作。
    // 滑出可见窗口的书由 reflow 瞬移到另一端换皮（无限滑轨）。
    const rot = { val: 0 }
    let currentSlot = 0
    let snapping = false
    let hoverLostFrames = 0
    let isCurrentHovered = false
    let lastCursor = '' // 光标缓存：只在决策变化时写 inline style，避免每帧触 DOM
    let introDone = false
    // 拖拽惯性：左键 1:1 抓取驱动 rot，松手后指数摩擦衰减，末端 snap 到最近槽
    let dragging = false
    let dragStartX = 0 // 按下时 clientX
    let dragStartRot = 0 // 按下时 rot.val
    let dragMoved = false // 位移超阈值则非点击
    let vel = 0 // 惯性角速度（弧度/秒）
    let lastMoveX = 0 // 最近一次 move 的 clientX（测松手速度）
    // 惯性初速采样：拖拽 move 期间记录近 100ms 的 (时间戳, 横向位移) 样本，
    // 松手取总和/时间跨度的平均速度，抗手抖（原单帧法手抖即丢惯性）
    const velSamples: { t: number; dx: number }[] = []

    // 四段式入场编排：由渲染循环读这些进度变量驱动姿态
    const yLift3 = { val: 0 } // 动作2 中间3本上升
    const yLiftRest = { val: 0 } // 动作2 其余10本跟上
    const selectIntro = { val: 0 } // 动作4 中间本首演抽出进度（入场一次性，结束后=1）
    const retreatP = { val: 0 } // 动作4 12本远离到 z=17
    const spreadP = { val: 0 } // 动作4 12本远离时 1.2x 间距渐变
    let introTl: gsap.core.Timeline | null = null
    introTl = gsap.timeline({
      onComplete: () => {
        introDone = true
        onIntroDoneRef.current?.()
      },
    })
    introTl
      .to(yLift3, { val: 1, duration: 0.35, ease: 'power2.out' }) // 中间3本上升
      .to(yLiftRest, { val: 1, duration: 0.3, ease: 'power2.out' }) // 其余10本跟上
      .to({}, { duration: 0.2 }) // 停顿
      .to(selectIntro, { val: 1, duration: 0.35, ease: 'power2.out' }, '+=0') // 中间本抽出
      .to(retreatP, { val: 1, duration: 0.35, ease: 'power2.out' }, '<') // 12本同步远离
      .to(spreadP, { val: 1, duration: 0.3, ease: 'power2.out' }) // 1.2x 间距渐变

    // ---------- 指针事件 ----------
    function mouseToNDC(e: PointerEvent) {
      if (!container) return { x: 0, y: 0 }
      const rect = container.getBoundingClientRect()
      return {
        x: ((e.clientX - rect.left) / container.clientWidth) * 2 - 1,
        y: -((e.clientY - rect.top) / container.clientHeight) * 2 + 1,
      }
    }

    // 吸附 rot 到最近槽位（中心对齐到一本，固定舞台严丝合缝演出）
    function snapToNearest() {
      if (snapping) return
      const effStep = ANGLE_STEP * (1 + SPREAD_MAX * spreadP.val)
      const target = snapTarget(rot.val, effStep, half, virtual, realMin, realMax)
      snapping = true
      gsap.to(rot, {
        val: target,
        duration: 0.5,
        ease: 'back.out(1.4)',
        overwrite: 'auto',
        onComplete: () => {
          snapping = false
        },
      })
    }

    // 中断吸附/惯性，进入新的拖拽
    function beginDrag(clientX: number) {
      // 不立即打断 snap/点击演出：拖拽超阈值才 kill，纯点击则让演出继续（点击忽略原则）
      vel = 0
      dragging = true
      dragMoved = false
      dragStartX = clientX
      dragStartRot = rot.val
      lastMoveX = clientX
      velSamples.length = 0
    }

    // 屏幕空间投影命中：把书的实际渲染 position 投影到 NDC，算点击点到各书屏幕点的距离，
    // 取最近且 ≤ 阈值。替代原 3D 命中球——球半径(2.3)≫书间距(1.4)致相邻球重叠，
    // 且抽出本前移 z 更大→distance 更小霸屏误进详情。屏幕投影与 z 无关，点哪是哪。
    const _projVec = new THREE.Vector3()
    function nearestBookOnScreen(ndc: {
      x: number
      y: number
    }): { book: BookSlot; dist: number } | null {
      let nearest: BookSlot | null = null
      let nearestDist = Infinity
      for (const book of allSlots) {
        _projVec.copy(book.group.position).project(camera)
        const dx = _projVec.x - ndc.x
        const dy = _projVec.y - ndc.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = book
        }
      }
      return nearest ? { book: nearest, dist: nearestDist } : null
    }

    // 命中当前中心抽出本（用于点击打开 / 中键轨道球触发判定）
    function hitsCenterBook(ndc: { x: number; y: number }): boolean {
      const currentBook = slotMap.get(currentSlot)
      if (!currentBook) return false
      const hit = nearestBookOnScreen(ndc)
      return (
        hit !== null && hit.book.slotIndex === currentSlot && hit.dist <= HIT_NDC_THRESHOLD_CURRENT
      )
    }

    // 命中任意一本书（最近且在阈值内），用于点击滑轨上任意书触发演出。
    // 中心抽出本用更大阈值（侧倾后仰致视觉中心偏离几何中心），其余用标准阈值
    function hitAnyBook(ndc: { x: number; y: number }): BookSlot | null {
      const hit = nearestBookOnScreen(ndc)
      if (!hit) return null
      const threshold =
        hit.book.slotIndex === currentSlot ? HIT_NDC_THRESHOLD_CURRENT : HIT_NDC_THRESHOLD
      return hit.dist <= threshold ? hit.book : null
    }

    // 点击演出：tween rot 到目标槽（最短弧、按距离缩放时长），currentSlot 自然变为目标，
    // select 随之升起抽出。演出期归入 snapping 态（position 刚性直设），拖拽可打断、点击忽略
    function flyToSlot(targetSlot: number) {
      if (snapping) gsap.killTweensOf(rot)
      vel = 0
      const effStep = ANGLE_STEP * (1 + SPREAD_MAX * spreadP.val)
      const { target, duration } = flyToTarget(rot.val, targetSlot, effStep)
      snapping = true
      gsap.to(rot, {
        val: target,
        duration,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => {
          snapping = false
        },
      })
    }

    // 轨道球态切换：同步容器 class，CSS 借此把光标钉在 grabbing（抓住书转动，区别于推转盘）
    function setOrbiting(v: boolean) {
      orbiting = v
      container?.classList.toggle('orbiting', v)
    }

    // 进入轨道球：对齐 rot 到最近槽（稳定 currentSlot），清零惯性，避免旋转中 currentSlot 漂移
    function enterOrbit() {
      if (snapping) {
        gsap.killTweensOf(rot)
        snapping = false
      }
      vel = 0
      const effStep = ANGLE_STEP * (1 + SPREAD_MAX * spreadP.val)
      rot.val = orbitAlignTarget(rot.val, effStep, realMin, realMax)
      setOrbiting(true)
    }

    function onPointerEnter(e: PointerEvent) {
      pointerInside = true
      const ndc = mouseToNDC(e)
      targetMouse.x = ndc.x
      targetMouse.y = ndc.y
      // 入场期间禁止交互（动画必须播完），仅记录鼠标位置
    }

    function onPointerMove(e: PointerEvent) {
      const ndc = mouseToNDC(e)
      targetMouse.x = ndc.x
      targetMouse.y = ndc.y
      if (!introDone) return
      if (orbiting) return // 轨道球中：鼠标位置由渲染循环驱动三轴旋转，不拖拽
      if (!dragging) return
      // 未超点击位移阈值：不动 rot，让进行中的点击演出继续（点击忽略原则）
      if (isClickMove(e.clientX, dragStartX)) return
      if (!dragMoved) {
        dragMoved = true
        // 超阈值才打断 snap/演出，并从当前 rot 位置接管，避免回退
        if (snapping) {
          gsap.killTweensOf(rot)
          snapping = false
        }
        dragStartRot = rot.val
        dragStartX = e.clientX
        lastMoveX = e.clientX
      }
      // 1:1 抓取：按下点贴住指针，鼠标横向位移直接映射 rot
      const p2a = PIXEL_TO_ANGLE
      const raw = dragStartRot + (e.clientX - dragStartX) * p2a
      if (!virtual) {
        const effStep = ANGLE_STEP * (1 + SPREAD_MAX * spreadP.val)
        rot.val = clampRot(raw, effStep, half, realMin, realMax)
      } else {
        rot.val = raw
      }
      const now = performance.now()
      velSamples.push({ t: now, dx: e.clientX - lastMoveX })
      while (velSamples.length && now - velSamples[0].t > 100) velSamples.shift()
      lastMoveX = e.clientX
    }

    function onPointerDown(e: PointerEvent) {
      // 入场期间完全吞掉所有交互
      if (!introDone) return
      if (!container) return
      // 中键：toggle 轨道球（仅当命中中心抽出本）
      if (e.button === 1) {
        e.preventDefault()
        if (orbiting) {
          setOrbiting(false)
          return
        }
        const ndc = mouseToNDC(e)
        if (hitsCenterBook(ndc)) enterOrbit()
        return
      }
      // 左键：若在轨道球态则拖拽自动退出轨道球。退出轨道球的这一次 down 不进入拖拽/点击
      // （否则无位移松手会命中中心本触发 onBookClick，把"退出轨道球"误变成"打开文章"）
      if (e.button === 0) {
        if (orbiting) {
          setOrbiting(false)
          return
        }
        beginDrag(e.clientX)
        try {
          container.setPointerCapture(e.pointerId)
        } catch {
          /* pointer capture 失败可忽略 */
        }
      }
    }

    // 结束拖拽：释放 capture、置 dragging=false。cancelled 时丢弃惯性并对齐。
    // 点击判定与惯性初速计算需要完整 PointerEvent（clientX/clientY），留在 onPointerUp 处理
    function endDrag(pointerId: number, cancelled: boolean) {
      if (!dragging || !container) return
      try {
        container.releasePointerCapture(pointerId)
      } catch {
        /* pointer capture 失败可忽略 */
      }
      dragging = false
      if (cancelled) {
        vel = 0
        snapToNearest()
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!introDone) return
      if (e.button !== 0 || !dragging || !container) return
      if (!dragMoved) {
        // 短按点击：释放 capture、退出拖拽态。须用真实 clientY 算 NDC，否则 ndc.y=NaN 命中失败
        try {
          container.releasePointerCapture(e.pointerId)
        } catch {
          /* pointer capture 失败可忽略 */
        }
        dragging = false
        // 点击演出进行中：忽略本次点击，让演出继续播完
        if (snapping) return
        const ndc = mouseToNDC(e)
        const hit = hitAnyBook(ndc)
        if (!hit) {
          snapToNearest()
          return
        } // 点击空白：对齐到最近槽
        if (hit.slotIndex === currentSlot) {
          // 已是中心抽出本：再点一次打开文章
          onBookClickRef.current(hit.stem)
        } else {
          // 滑轨上任意书：演出滑到中心并抽出（不自动打开）
          flyToSlot(hit.slotIndex)
        }
        return
      }
      // 拖拽结束：用松手前近 100ms 的速度采样算惯性初速（弧度/秒）。
      // span 下限 16ms，防止 up 与最后一次 move 间隔过小把抖动放大成猛烈甩动
      const now = performance.now()
      vel = velocityFromSamples(velSamples, now, PIXEL_TO_ANGLE)
      velSamples.length = 0
      endDrag(e.pointerId, false)
      // 速度过小直接 snap，否则进入惯性衰减（由渲染循环处理）
      if (Math.abs(vel) < VEL_SNAP_THRESHOLD) {
        vel = 0
        snapToNearest()
      }
    }

    // pointercancel：触屏 pan-y 下手势被判为竖向滚动时浏览器发 cancel 而非 up，
    // 必须在此结束拖拽，否则 dragging 永真、capture 悬空、hover 闸门锁死
    function onPointerCancel(e: PointerEvent) {
      endDrag(e.pointerId, true)
    }

    function onPointerLeave() {
      pointerInside = false
      // 拖拽中途离开容器：丢弃惯性并对齐（pointer capture 通常会抑制 leave，此处兜底；
      // pointerId 已不可得，传 -1 让 releasePointerCapture 在 try/catch 中安全失败）
      if (dragging) endDrag(-1, true)
      // 离开容器：吸附 rot 到最近槽位（中心对齐到一本）
      if (introDone && !snapping) snapToNearest()
    }

    // 中键默认行为（浏览器自动滚动）拦截：pointerdown 之外再拦 mousedown
    function onMouseDown(e: MouseEvent) {
      if (e.button === 1) e.preventDefault()
    }

    // 空格 toggle 轨道球 / Esc 退出轨道球（三重闸门：路由红利随组件卸载、焦点、可见性）
    function isTypingTarget(): boolean {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      const tag = (el.tagName || '').toUpperCase()
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
    }
    let shelfVisible = true
    function onKeyDown(e: KeyboardEvent) {
      if (!introDone || !shelfVisible) return
      // 按住不放的自动重复事件不重复触发 toggle，避免轨道球态频闪
      if (e.repeat) return
      if (e.code === 'Escape') {
        if (orbiting) {
          setOrbiting(false)
          e.preventDefault()
        }
        return
      }
      if (e.code === 'Space') {
        if (isTypingTarget()) return
        // 拖拽进行中不进轨道球，避免 dragging+orbiting 冲突与残留 vel
        if (dragging) return
        e.preventDefault()
        if (orbiting) setOrbiting(false)
        else enterOrbit()
      }
    }

    container.addEventListener('pointerenter', onPointerEnter)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerCancel)
    container.addEventListener('pointerleave', onPointerLeave)
    container.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)

    const io = new IntersectionObserver(
      (entries) => {
        shelfVisible = entries[0]?.intersectionRatio >= 0.5
      },
      { threshold: [0, 0.5, 1] },
    )
    io.observe(container)

    // ---------- 响应式 ----------
    function onResize() {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    // ---------- 换皮（虚拟化）：滑出窗口的书移到另一端并换纹理 ----------
    function reflow() {
      const effStep = ANGLE_STEP * (1 + SPREAD_MAX * spreadP.val)
      for (const book of allSlots) {
        const {
          slotIndex: newSlot,
          dataOffset,
          moved,
        } = reflowSlot(book.slotIndex, rot.val, effStep, half, slots)
        if (moved) {
          slotMap.delete(book.slotIndex)
          book.slotIndex = newSlot
          const newDataIndex = (((book.dataIndex + dataOffset) % N) + N) % N
          applySkin(book, newDataIndex)
          slotMap.set(book.slotIndex, book)
          // 瞬移的书重置 select（屏外书非抽出态）
          book.select = 0
          // 立即重置到屏外新位置，避免跨屏飞入中间
          const isCurrent = book.slotIndex === currentSlot
          const a = book.slotIndex * effStep + rot.val
          const lift = book.isCenter3 ? yLift3.val : yLiftRest.val
          book.group.position.x = Math.sin(a) * RADIUS
          book.group.position.y = LIFT_FROM_Y * (1 - lift)
          if (isCurrent) {
            book.group.position.z = RADIUS + FOCAL_Z * book.select
          } else {
            book.group.position.z = RADIUS + RETREAT_Z * retreatP.val
          }
          book.group.rotation.y = isCurrent
            ? a + (Math.PI / 2) * (1 - book.select)
            : a + Math.PI / 2 + (book.slotIndex - currentSlot) * FAN_TILT * retreatP.val
        }
      }
    }

    // ---------- 动画循环 ----------
    let elapsedTime = 0
    let lastFrameTime = performance.now()
    let rafId = 0

    function animate() {
      rafId = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = (now - lastFrameTime) / 1000
      elapsedTime += dt
      lastFrameTime = now

      // 鼠标平滑跟随（dt 缩放）
      const mouseSmooth = 1 - 0.92 ** (dt * 60)
      mouse.x += (targetMouse.x - mouse.x) * mouseSmooth
      mouse.y += (targetMouse.y - mouse.y) * mouseSmooth
      mouseLight.position.set(mouse.x * 6, mouse.y * 4, 28)

      // 动态槽位角步长（入场后随 spreadP 放大到 1.2x）
      const effStep = ANGLE_STEP * (1 + SPREAD_MAX * spreadP.val)

      // 惯性衰减：松手后按角速度累加 rot，指数摩擦，速度过低时 snap 到最近槽
      if (!dragging && !orbiting && vel !== 0) {
        if (snapping) {
          gsap.killTweensOf(rot)
          snapping = false
        }
        rot.val += vel * dt
        if (!virtual) {
          rot.val = clampRot(rot.val, effStep, half, realMin, realMax)
        }
        vel *= DRAG_FRICTION ** (dt * 60)
        if (Math.abs(vel) < VEL_SNAP_THRESHOLD) {
          vel = 0
          snapToNearest()
        }
      }

      // 当前正前方槽位（固定舞台：滑到中心的书做抽出动作）。
      // virtual 滑轨：currentSlot 自由（round 无 clamp，reflow 使 slotIndex ≡ currentSlot mod slots 落回窗口）。
      // 非 virtual（N≤3 满窗 / N=1,2 补虚拟）：clamp 到 realSlots [realMin, realMax]（D3，防落虚拟）。
      const rawSlot = Math.round(-rot.val / effStep)
      currentSlot = virtual ? rawSlot : Math.max(realMin, Math.min(realMax, rawSlot))

      // 换皮虚拟化
      if (virtual) reflow()

      // 相机固定（不随鼠标视差，避免整体晃动；只有书在动）
      camera.lookAt(0, 0, 0)

      // hover 检测：仅当前中心抽出本（指针在容器内、未拖拽、未吸附、无惯性）
      let currentHovered = false
      if (introDone && pointerInside && !dragging && !snapping && vel === 0) {
        const currentBook = slotMap.get(currentSlot)
        if (currentBook) {
          const hit = nearestBookOnScreen(mouse)
          if (hit && hit.book.slotIndex === currentSlot && hit.dist <= HIT_NDC_THRESHOLD_CURRENT) {
            currentHovered = true
            hoverLostFrames = 0
          } else {
            hoverLostFrames++
            if (hoverLostFrames >= HOVER_LOST_THRESHOLD) currentHovered = false
            else currentHovered = isCurrentHovered
          }
        }
      } else {
        hoverLostFrames = HOVER_LOST_THRESHOLD
      }
      isCurrentHovered = currentHovered

      // 光标:JS 只补 CSS 做不到的一个形态——中心抽出本 hover 时 inline 写 pointer。
      // 决策为 '' 时清空 inline,光标让位 CSS(默认 grab / :active 拖动 grabbing /
      // .orbiting 轨道球 grabbing,见 home.css)。inline 优先级高于 class,故进出
      // 轨道球/起拖时必须清空 inline,主分支的 CSS 版本才生效。
      const cursor = cursorForState({ orbiting, dragging, currentHovered: isCurrentHovered })
      // function 声明提升致 TS 丢失 useEffect 入口 container guard 的 narrowing（同 mouseToNDC 的 if (!container)），运行期不可达
      if (cursor !== lastCursor && container) {
        lastCursor = cursor
        container.style.cursor = cursor
      }

      // 每本书的姿态：滑到中心(currentSlot)的书做抽出动作，其余待机；入场由进度变量驱动
      // 刚性期（拖拽/惯性/吸附/点击演出）：position 与 rotation 直设，避免 lerp 追不上快拖
      // 导致书挤到拖动方向尾端；lerp 只留给入场、select 爬升、hover 微调
      const rigid = dragging || vel !== 0 || snapping
      const smooth = rigid ? 1 : 1 - 0.9 ** (dt * 60)
      for (const book of allSlots) {
        const isCurrent = book.slotIndex === currentSlot
        const a = book.slotIndex * effStep + rot.val

        // 各自的抽出进度：入场中间本跟随 selectIntro 编排；其余 lerp 向 (isCurrent?1:0)
        // select 用独立更快系数（SELECT_LERP），与姿态丝滑系数解耦——快速滑动中 currentSlot 切换快，
        // select 须尽快爬到 1，否则纵深/缩放/光泽/翻面演出全被压制成"浅浅动一下"
        const introCenter = !introDone && book.slotIndex === 0
        const targetSelect = introCenter ? selectIntro.val : isCurrent ? 1 : 0
        const selectSmooth = 1 - (1 - SELECT_LERP) ** (dt * 60)
        book.select += (targetSelect - book.select) * selectSmooth

        const targetX = Math.sin(a) * RADIUS
        // 入场 y：中间3本用 yLift3，其余用 yLiftRest，都从 LIFT_FROM_Y 升到 0
        const lift = book.isCenter3 ? yLift3.val : yLiftRest.val
        const targetY = LIFT_FROM_Y * (1 - lift)

        // z：抽出本随 select 前突到 RADIUS+FOCAL_Z；其余12本随 retreatP 远离到 RADIUS+RETREAT_Z(17) 并稳定停住
        let targetZ: number
        if (isCurrent) {
          targetZ = RADIUS + FOCAL_Z * book.select
        } else {
          targetZ = RADIUS + RETREAT_Z * retreatP.val
        }

        book.group.position.x += (targetX - book.group.position.x) * smooth
        book.group.position.y += (targetY - book.group.position.y) * smooth
        book.group.position.z += (targetZ - book.group.position.z) * smooth

        // 抽出态基础斜放（书脊底角朝下近、书口朝上远）
        const baseTiltX = CURRENT_TILT_X * book.select
        const baseTiltZ = CURRENT_TILT_Z * book.select

        if (isCurrent && orbiting && introDone) {
          // 轨道球态：原始鼠标位置直接驱动三轴旋转（即时跟随），可看书的各个面
          // targetMouse.x∈[-1,1] → rotation.y ±π（封面/书脊/背面），targetMouse.y → rotation.x ±0.8（上下）
          book.group.rotation.x = targetMouse.y * 0.8
          book.group.rotation.y = targetMouse.x * Math.PI
          book.group.rotation.z = 0
        } else {
          // 非hover：抽出本从书脊朝外（a+π/2）转到封面朝外（a）；
          // 其余12本书脊朝外，远离时绕 y 微旋（左侧顺时针/右侧逆时针，slotIndex 正负定方向），呈捧中间姿态
          const targetRotY = isCurrent
            ? a + (Math.PI / 2) * (1 - book.select)
            : a + Math.PI / 2 + (book.slotIndex - currentSlot) * FAN_TILT * retreatP.val
          let rotDelta = targetRotY - book.group.rotation.y
          rotDelta = (((rotDelta % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
          book.group.rotation.y += rotDelta * smooth
          book.group.rotation.x += (baseTiltX - book.group.rotation.x) * smooth
          book.group.rotation.z += (baseTiltZ - book.group.rotation.z) * smooth
        }

        // 光泽强度：抽出本即亮（解耦 hover——滑动中 dragging/vel 非 0 时 hover 闸门关闭，光泽本该灭；
        // 改为 isCurrent 持续亮，让"当前抽出本"始终有视觉标识）。hover 不再额外叠加
        const targetIntensity = isCurrent ? 0.25 : 0.0
        book.frontUniforms.uIntensity.value +=
          (targetIntensity - book.frontUniforms.uIntensity.value) * smooth

        // 缩放：抽出本随 select 放大到 CURRENT_SCALE，用尺寸补强被削弱的纵深演出
        const targetScale = 1 + (CURRENT_SCALE - 1) * book.select
        const s = book.group.scale.x + (targetScale - book.group.scale.x) * smooth
        book.group.scale.setScalar(s)
        book.frontUniforms.uTime.value = elapsedTime
        book.frontUniforms.uMouse.value.set((mouse.x + 1) * 0.5, (mouse.y + 1) * 0.5)
      }

      renderer.render(scene, camera)
    }

    // 暴露换皮句柄给副 useEffect(ADR-0006 D2')：主题切换时换 skin/topBotTex/edgeTex + 灯光，不重建场景
    sceneRef.current = {
      allSlots,
      skinPools,
      topBotTexs,
      edgeTexs,
      dirLight,
      rimLight,
    }

    animate()

    // ---------- 清理 ----------
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
      container.removeEventListener('pointerenter', onPointerEnter)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerCancel)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      gsap.killTweensOf(rot)
      introTl?.kill()
      container.removeChild(renderer.domElement)
      renderer.dispose()

      sharedGeo.dispose()
      Object.values(edgeTexs).forEach((t) => {
        t.dispose()
      })
      Object.values(topBotTexs).forEach((t) => {
        t.dispose()
      })
      Object.values(skinPools)
        .flat()
        .forEach((skin) => {
          skin.cover.dispose()
          skin.spine.dispose()
          skin.back.dispose()
        })
      allSlots.forEach((book) => {
        book.coverMat.dispose()
        book.spineMat.dispose()
        book.backMat.dispose()
        book.topMat.dispose()
        book.edgeMat.dispose()
      })
      renderer.renderLists.dispose()
      sceneRef.current = null
    }
  }, [pages])

  // 主题切换：换 skin/topBotTex/edgeTex + 灯光，不重建场景(ADR-0006 D2')
  useEffect(() => {
    const handles = sceneRef.current
    if (!handles) return
    const colors = colorsFor(theme)
    const pool = handles.skinPools[theme]
    const topBot = handles.topBotTexs[theme]
    const edge = handles.edgeTexs[theme]
    handles.allSlots.forEach((book) => {
      const skin = pool[book.dataIndex]
      book.coverMat.uniforms.uTexture.value = skin.cover
      book.spineMat.map = skin.spine
      book.spineMat.needsUpdate = true
      book.backMat.map = skin.back
      book.backMat.needsUpdate = true
      book.topMat.map = topBot
      book.topMat.needsUpdate = true
      book.edgeMat.map = edge
      book.edgeMat.needsUpdate = true
    })
    handles.dirLight.intensity = colors.dirLightIntensity
    handles.rimLight.color.setHex(colors.rimLightColor)
  }, [theme])

  return <div ref={containerRef} className="book-shelf-3d" />
}
