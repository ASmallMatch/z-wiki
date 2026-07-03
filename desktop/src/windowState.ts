// windowState.ts — 窗口尺寸/位置持久化。
// 写入 config.json 的 preferences.windowBounds(ADR-0003:全局偏好归 config.json,首版不引新依赖)。
// 直接读写 JSON 文件,不 import server 内部 config.ts(D9:desktop 只用 createServer 窄接口)。
// 原子写(tmp + rename):避免写中途崩溃丢 apiKey —— config.json 是真相源,损坏即阻断启动。
import fs from 'node:fs'
import path from 'node:path'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  /** 是否最大化(恢复时直接最大化,免得存了最大化尺寸却以普通窗口打开)。 */
  maximized?: boolean
}

/** 从 config.json 的 preferences.windowBounds 读取上次窗口状态;无则返回 null。 */
export function loadWindowBounds(configPath: string): WindowBounds | null {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const cfg = JSON.parse(raw) as { preferences?: { windowBounds?: WindowBounds } }
    return cfg.preferences?.windowBounds ?? null
  } catch {
    // 文件不存在或损坏:返回 null,窗口用默认尺寸。
    return null
  }
}

/**
 * 保存窗口状态到 config.json 的 preferences.windowBounds。
 * 读-改-写保留其他字段(apiKey/provider/model/vaults);原子写避免崩溃损坏。
 */
export function saveWindowBounds(configPath: string, bounds: WindowBounds): void {
  let cfg: Record<string, unknown> = {}
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  } catch {
    // config.json 不存在或损坏:server 启动已读过,理论不至此;空对象起步避免崩。
  }
  const prevPrefs = (cfg.preferences as Record<string, unknown> | undefined) ?? {}
  cfg.preferences = { ...prevPrefs, windowBounds: bounds }

  const tmp = `${configPath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf-8')
  fs.renameSync(tmp, configPath)
}

/** config.json 路径 = appRoot 下(agentDir 上两级,ADR-0003 D3.1)。 */
export function configPathFor(agentDir: string): string {
  const appRoot = path.dirname(path.dirname(agentDir))
  return path.join(appRoot, 'config.json')
}
