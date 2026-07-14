// reflow 调度核心（纯函数）：给定书的逻辑位置，算出 reflow 后的新 slotIndex 与数据偏移。
// pos = slotIndex + rotVal/effStep（以槽为单位，0=中心，±half=窗口边界）。
// 滑出 ±(half+0.5) 的书移到另一端（±=slots）并换皮到对应数据。
// 用 while 循环而非单次 if：快速拖动一帧 rot 大跳时 pos 可能跨多个窗口宽，
// 单次移动会让书滞留窗口外（a 算出超大值 -> position 飞出滑轨、书脊朝向偏离）。
// slots == 2*(half+0.5)（slots 奇数 + half=(slots-1)/2 推得），每次移动正好一个窗口宽，
// while 至多 ceil(溢出量/窗口宽) 次即收敛，不会在正负窗口间震荡。
export function reflowSlot(
  slotIndex: number,
  rotVal: number,
  effStep: number,
  half: number,
  slots: number,
): { slotIndex: number; dataOffset: number; moved: boolean } {
  let s = slotIndex
  let dataOffset = 0
  let pos = s + rotVal / effStep
  while (pos > half + 0.5) {
    s -= slots
    dataOffset -= slots
    pos = s + rotVal / effStep
  }
  while (pos < -half - 0.5) {
    s += slots
    dataOffset += slots
    pos = s + rotVal / effStep
  }
  return { slotIndex: s, dataOffset, moved: dataOffset !== 0 }
}
