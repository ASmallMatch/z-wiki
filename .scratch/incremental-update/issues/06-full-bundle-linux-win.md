# 06: 完整包档 + linux 例外 + win 替换时序

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D2/D6/D8)

## What to build

扩展三档的第三档(完整包)+ linux 例外 + win 替换时序补全。

latest.json full 按平台 map(依赖 Ticket 01 命名规范):

```
"full": { "mac-arm64": "...", "mac-x64": "...", "win-x64": "...", "linux-x64": "..." }
```

客户端 `platformArch()` 取键(prior art:`desktop/src/pathUtils.ts`)。

决策:`baselineVersion` 变 -> full。linux 总 full(AppImage 只读,ADR-0018 D6/D8)。

updater 完整包路径:

- mac/win:提示"基线层升级,请下载新完整包重新安装"(完整包是安装器,不能自动覆盖 runtime/二进制)
- linux:下新 AppImage 单文件替换(完整包 = AppImage,可自动替换单文件)

win 代码包/应用包退出后替换时序:若 Ticket 04 未做(只做了 mac),在此补 win 的 `.node` 锁定规避(退出后 updater 替换再重启)。

## Acceptance criteria

- [ ] latest.json full 按平台 map,客户端按 platformArch 取
- [ ] `baselineVersion` 变 -> 决策选 full
- [ ] linux 总 full(忽略 appVersion/depsVersion 差异)
- [ ] mac/win full 档提示下完整包重新安装
- [ ] linux full 档下新 AppImage 单文件替换
- [ ] win 代码包/应用包替换时序跑通(若 Ticket 04 未做)
- [ ] `make typecheck` 与 `make format` 通过
- [ ] 手动验证 baseline 升级 + linux 更新

## Blocked by

- 05: 应用包档 -- 依赖升级更新
- 01: 包命名规范统一(full 包名依赖)
