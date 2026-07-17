# 07: clean-release

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D7)

## What to build

`make clean-release`:清理 `release/`,只保留当前平台当前 arch 的完整包 + 跨平台 app/code 包 + latest.json + unpacked 缓存,删其他平台完整包。

`planCleanRelease(releaseDir, currentPlatArch) -> {keep[], delete[]}` 纯函数:

- 保留:当前 arch 完整包 + blockmap、`z-wiki-app-*.tar.gz`、`z-wiki-code-*.tar.gz`、`latest.json`、unpacked 缓存(`mac/`/`*-unpacked/`)
- 删除:其他平台/arch 的完整包 + blockmap
- 当前 arch 从 `process.platform` + `process.arch` 算(prior art:`desktop/src/pathUtils.ts` 的 `platformArch()`)

`Makefile` 加 `clean-release` target。

app/code 包不带平台后缀,不匹配删除模式,自动保留。unpacked 缓存保留(加速下次打包)。

## Acceptance criteria

- [ ] `planCleanRelease` 纯函数正确(保留/删除清单)
- [ ] 当前 arch 完整包 + blockmap 保留
- [ ] 其他平台完整包 + blockmap 删除
- [ ] app/code 包 + latest.json 保留
- [ ] unpacked 目录保留
- [ ] `Makefile` clean-release target 跑通
- [ ] Seam 3 单测通过(造假 release/ 验证)
- [ ] `make typecheck` 与 `make format` 通过

## Blocked by

- 01: 包命名规范统一(按命名模式过滤)
