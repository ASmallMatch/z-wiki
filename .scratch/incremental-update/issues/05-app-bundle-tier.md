# 05: 应用包档 -- 依赖升级更新

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D2/D5)

## What to build

扩展三档的第二档:应用包(依赖升级场景)。`depsVersion` 变时下应用包,整体替换 `app/`(含 node_modules)。

打包侧:`buildAppBundle` 从 unpacked 抽整个 `app/` + `web/dist/` 打 `z-wiki-app-{ver}.tar.gz`(跨平台,因 native prebuilds 全平台打进 node_modules,ADR-0018 D5)。latest.json 加 app 条目(url/sha512/size)。

客户端:决策返回 app 档时,下载应用包 -> 校验 -> 解压 -> 整体替换 `app/`(删旧 `app/` 换新,不用处理 node_modules 内部增删改)。

## Acceptance criteria

- [ ] `make package` 额外产出 `z-wiki-app-{ver}.tar.gz`
- [ ] 应用包含整个 `app/`(含 node_modules)+ `web/dist/`
- [ ] latest.json 加 app 条目
- [ ] `depsVersion` 变 -> 决策选 app -> 整体替换 `app/` -> 重启新版本
- [ ] Seam 2 单测扩展覆盖 buildAppBundle
- [ ] `make typecheck` 与 `make format` 通过
- [ ] 手动验证依赖升级场景跑通

## Blocked by

- 04: 代码包更新端到端
