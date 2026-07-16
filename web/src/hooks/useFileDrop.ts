// useFileDrop.ts - 窗口级文件拖拽上传(切片 06):拖文件到窗口任意位置 -> onFile 回调。
// 复用 useChat.upload(走现有 POST /api/upload),不新写上传逻辑(ADR-0003 D2.1 / issue 06)。
// 阻止浏览器默认(打开文件 / navigate 到文件),仅拦截含 Files 的拖拽,不影响文本选区拖拽。
import { useEffect } from 'react'

/**
 * @param onFile 文件回调(传 useChat.upload,HTTP 上传 + ingest 角标反馈)。
 */
export function useFileDrop(onFile: (file: File) => void): void {
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const onDragOver = (e: DragEvent) => {
      // 必须 preventDefault dragover,否则 drop 事件不触发(浏览器默认接管为"打开文件")。
      if (!hasFiles(e)) return
      e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      // 多文件逐一上传(各自独立 ingest);ingest 角标单值,反映最后一个,已知 v1 取舍。
      for (const f of files) onFile(f)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFile])
}
