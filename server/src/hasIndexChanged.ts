// hasIndexChanged.ts — 判断本次 buildView 结果是否相对上次有内容变化。
// 纯函数,供 Interaction 决定是否广播 kb_updated。
//
// 为什么对比 fragments 而非 pages 索引:PageMeta.updated 截断到天
// (toISOString().slice(0,10)),同日编辑会使索引序列化不变,漏判。
// pages 的 title/summary/toc 都是 fragment 内容的派生,fragment 不变则它们不
// 变;对比 fragments 逐项内容,充分且正确。
import type { PageMeta } from "./buildView.js";

export function hasIndexChanged(
  oldFragments: Map<string, string> | null,
  newFragments: Map<string, string>
): boolean {
  if (!oldFragments) return true;
  if (oldFragments.size !== newFragments.size) return true;
  for (const [stem, html] of newFragments) {
    if (oldFragments.get(stem) !== html) return true;
  }
  return false;
}

// 仅用于测试引用 PageMeta 类型,避免未使用告警。
export type { PageMeta };
