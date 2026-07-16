@echo off
rem z-wiki 启动器(旧 Windows 兼容):带 --disable-gpu --no-sandbox 启动 z-wiki.exe。
rem 旧 Windows(1809 等)上 Electron 38 GPU/沙箱兼容差,双击 z-wiki.exe 会崩;
rem 带 --disable-gpu --no-sandbox 启动不崩(已验证)。此 bat 等同手动命令行加参数。
rem 双击此文件启动,而非双击 z-wiki.exe。
start "" "%~dp0z-wiki.exe" --disable-gpu --no-sandbox
