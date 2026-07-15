// vaultLayout.ts - Vault 命名契约集中点(镜像 kbLayout.ts 集中 layer1 路径契约)。
// vault 目录名派生(slugify)+ 显示名查找(vaultDisplayName),从 interaction.ts 闭包外提为模块级纯函数,
// 可单测(中文保留正则、合并/兜底、显示名查找)。interaction.ts 的 vault 端点引用此处,不再各自内联。
import path from 'node:path'
import type { VaultEntry } from './config.js'

/**
 * 把名字转为安全的目录名段(用于派生新 Vault 的 kb/ 路径)。
 *
 * 字符类 `[^\w.一-龥-]`:保留 word 字符(A-Za-z0-9_)、点号、CJK 范围(一=U+4E00 .. 龥=U+9FA5)、连字符;
 * 其余(含空格、标点、路径分隔符)替成 `-`。随后合并连续 `-`、去首尾 `-`;全空兜底 `vault`(避免空目录名段)。
 */
export function slugify(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.一-龥-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'vault'
  )
}

/**
 * 查 config.json 中已知 Vault 的显示名(找不到则取 kb/ 父目录名;父目录名为空则兜底返回 kbRootPath)。
 * cfg 取最小结构类型 `{ vaults?: VaultEntry[] }`,不依赖完整 ConfigJson。
 */
export function vaultDisplayName(kbRootPath: string, cfg: { vaults?: VaultEntry[] }): string {
  const found = cfg.vaults?.find((v) => v.path === kbRootPath)
  return found?.name || path.basename(path.dirname(kbRootPath)) || kbRootPath
}
