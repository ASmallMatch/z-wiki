# 04: 代码包更新端到端(tracer bullet)

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D1/D6/D9)

## What to build

updater 接入 `desktop/src/main.ts` 的 bootstrap(后台,不阻塞启动),跑通代码包更新的完整端到端路径。这是首个端到端 demoable 的 tracer bullet。

流程:

1. app 启动后台 fetch latest.json(不阻塞 bootstrap)
2. `selectUpdatePackage`(Ticket 03)决策 -> code 档
3. 下载 code 包到 `userData/update-cache/`
4. sha512 校验
5. 解压 tar.gz 到临时目录(prior art:`pandocManager.ts` 的 `tar -xzf`)
6. 原子覆盖 4 处路径(`app/dist` + `@z-wiki/server` + `web/dist` + `package.json`)
   - mac/linux:重命名替换(`app/` -> `app.old`,新 -> `app/`,重启后清 `app.old`)
   - win:退出后替换或重启时早期替换(避开 `.node` 锁定;若复杂可后置到 Ticket 06)
7. 更新 `.update-state.json`
8. 弹"更新已就绪,重启生效",用户点重启 -> app 替换 + 重启(下载自动,重启用户点)

app/full 档降级:决策返回 app/full 时提示"请下载完整包"(IO 不实现,Ticket 05/06 补)。

手动验证:造 latest.json + code 包,app 检测新版 -> 下载覆盖 -> 重启新版本。

## Acceptance criteria

- [ ] app 启动后台检查更新,不阻塞 bootstrap
- [ ] 代码包更新:下载 -> 校验 -> 覆盖 4 处 -> 重启新版本(mac 跑通)
- [ ] 下载自动,重启用户点(不自动重启)
- [ ] `.update-state.json` 更新为新版本号
- [ ] app/full 档降级提示(不崩)
- [ ] `make typecheck` 与 `make format` 通过
- [ ] 手动验证 mac 代码包更新跑通

## Blocked by

- 02: 打包脚本 -- 代码包 + latest.json
- 03: updater 决策纯函数 + 本地状态
