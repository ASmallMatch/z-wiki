; installer.nsh - NSIS 安装器自定义脚本(切片 06:跳过默认 app-running 检测)。
;
; electron-builder 的 _CHECK_APP_RUNNING(allowOnlyOneInstallerInstance.nsh)在安装前检测
; ${APP_EXECUTABLE_FILENAME}(z-wiki.exe)是否在跑,但 26.15.3 该检测在首次安装即误报
; "${PRODUCT_NAME} 正在运行,请关闭"(electron-builder issue #6865,2026-05-30 关闭但未真修,
; 26.15.3 仍复现)。官方留 customCheckAppRunning hook:定义该宏即替代默认检测。
;
; 空宏 = 跳过检测。代价:覆盖安装时若 app 真在跑,exe 被占用会导致覆盖失败(报"文件写入失败",
; 需手动关 app 重试);首次安装与 app 未运行的覆盖安装不受影响。
!macro customCheckAppRunning
!macroend
