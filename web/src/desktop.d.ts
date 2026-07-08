// desktop.d.ts — 桌面形态 preload 注入的 window.desktop 类型声明。
// dev 形态(浏览器)无 preload,window.desktop 为 undefined,前端据此条件渲染桌面专属 UI。
export {}

declare global {
  interface Window {
    desktop?: {
      // 在系统文件管理器中打开 vault 目录。成功返回空串,失败返回错误消息。
      openVault: (vaultPath: string) => Promise<string>
      // 弹原生文件夹选择器,返回选中目录绝对路径(取消返回空串)。
      selectVaultPath: () => Promise<string>
    }
  }
}
