# 02: 打包脚本 -- 代码包 + latest.json

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D2/D3/D5)

## What to build

新增打包脚本,`make package` 末尾(electron-builder 打完完整包后)衔接:从 `release/<plat>-unpacked/resources/` 抽出代码包内容,打 tar.gz + 生成 latest.json。

代码包内容(4 处,ADR-0018 D2):

- `app/dist`(desktop 主进程编译产物)
- `app/node_modules/@z-wiki/server`(server 代码)
- `web/dist`(前端 SPA)
- `app/package.json`(版本号)

产出:

- `z-wiki-code-{version}.tar.gz`(跨平台,含上述 4 处)
- `latest.json`(先只 code 档 + 三版本号 `appVersion`/`depsVersion`/`baselineVersion`;full/app 档由 Ticket 5/6 补)
  - `depsVersion` = `package-lock.json` sha256 前 12 位
  - `baselineVersion` = Electron + pandoc/rg/fd 版本组合(与 `toolBins.ts` 的 version.json 同源)
  - code 条目含 url + sha512 + size

tar.gz 用项目既有 tar 模式(prior art:`scripts/fetch-tool-bins.ts`、`server/src/pandocManager.ts` 的 `tar -xf`)。

## Acceptance criteria

- [ ] `make package` 产出 `release/z-wiki-code-{ver}.tar.gz` + `release/latest.json`
- [ ] 代码包只含 4 处路径,不含第三方 node_modules
- [ ] latest.json 含三版本号 + code 条目(url/sha512/size)
- [ ] sha512 与实际包内容匹配
- [ ] Seam 2 单测通过(mock unpacked 结构,验证包内容 + manifest)
- [ ] `make typecheck` 与 `make format` 通过

## Blocked by

None - can start immediately
