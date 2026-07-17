# 03: updater 决策纯函数 + 本地状态

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D2)

## What to build

实现 updater 的决策层纯函数 + 本地状态读写,不接 IO(下载/覆盖在 Ticket 4)。

`selectUpdatePackage(localState, remoteManifest) -> UpdatePlan`:

- 输入:本地 `{appVersion, depsVersion, baselineVersion}` + 远程 latest.json
- 输出:`{action: 'none'|'full'|'app'|'code', package: {url, sha512, size}}`
- 决策(从重到轻):
  - `baselineVersion` 变 -> full(即使 appVersion/depsVersion 也变)
  - `depsVersion` 变 -> app
  - 只 `appVersion` 变 -> code
  - 都没变 -> none
  - linux 平台 -> 总 full(AppImage 只读,ADR-0018 D6/D8)

本地状态:`userData/.update-state.json` 读写(`{appVersion, depsVersion, baselineVersion}`)。

纯函数,不依赖 electron app 对象(可单测,prior art:`desktop/src/toolBins.ts` 的 `needsRelayout` + `toolBins.test.ts` mkdtemp 模式)。

## Acceptance criteria

- [ ] `selectUpdatePackage` 三档各变一档选对(full/app/code)
- [ ] 无更新 -> none
- [ ] 多档同变选重的(baseline+app -> full,deps+app -> app)
- [ ] linux 平台 -> 总 full
- [ ] `.update-state.json` 读写正确
- [ ] Seam 1 单测通过
- [ ] `make typecheck` 与 `make format` 通过

## Blocked by

None - can start immediately
