Status: ready-for-agent

# 03 — pandoc 桌面形态内置 + GPL 声明

## Parent

ADR-0007(`docs/adr/0007-non-md-bash-pandoc.md`)决策 3(按平台内置)+ 决策 4(GPL-2.0 分发义务)。

## What to build

Slice 01 的 pandoc 下载管理是开发形态(按需下载到 UserDataDir)。桌面形态要"双击即用",不能依赖运行时下载。本 slice 把 pandoc 二进制按平台打进 Electron 包,并尽 GPL-2.0 分发义务。

实现:

- desktop 打包时,按目标平台把对应 pandoc 便携二进制放进 `extraResources/bin`(electron-builder 的 extraResources 配置)
- spawnHook 检测形态:桌面形态注入 `extraResources/bin` 到 PATH(开发形态用 Slice 01 的 UserDataDir/bin 下载)
- about/credits 页加 pandoc GPL-2.0 许可声明 + jgm/pandoc 源码链接(尽 GPL 分发义务:保留声明 + 提供源码获取方式)

pandoc 是 GPL-2.0(gh licenseInfo 确认)。作为独立二进制被 spawn(不链接进 z-wiki 进程),GPL 不传染主程序代码。分发义务 = 保留声明 + 源码链接。

## Acceptance criteria

- [ ] desktop 按平台打包时,extraResources 含对应平台 pandoc 二进制
- [ ] 桌面形态运行时,bash 调 pandoc 可达(不需运行时下载)
- [ ] spawnHook 桌面形态注入 extraResources/bin 到 PATH(开发形态仍用 UserDataDir 下载)
- [ ] about/credits 页含 pandoc GPL-2.0 声明 + jgm/pandoc 源码链接
- [ ] 桌面形态端到端:上传 docx → 编译 → 可见(不依赖外网下载 pandoc)
- [ ] `make typecheck` + `make lint` 通过

## Blocked by

- 01 — docx 上传→编译端到端 tracer bullet(开发形态通路先通,桌面形态再内置)
