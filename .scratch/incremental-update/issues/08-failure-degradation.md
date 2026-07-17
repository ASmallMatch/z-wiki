# 08: 失败降级与边界处理

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D1 后果)

## What to build

为 updater 的各失败场景加明确降级提示,不崩溃。

- 覆盖失败(写权限/磁盘/时序):提示"更新失败,请下载完整包重新安装"
- mac translocation(从 dmg 直接运行未拖进 Applications):检测 `Resources/app/` 写失败 -> 提示"请将 z-wiki 拖到 Applications 文件夹再更新"或"下完整包"
- 下载失败(网络):提示"下载失败,重试"或"下完整包",不崩
- sha512 校验失败(包损坏/篡改):提示"校验失败,请重试",不安装

## Acceptance criteria

- [ ] 覆盖失败有明确提示,不崩,app 可继续用旧版
- [ ] mac translocation 检测 + 提示拖进 Applications
- [ ] 下载失败提示重试,不崩
- [ ] sha512 校验失败提示,不安装损坏包
- [ ] 各失败场景 app 仍可启动(旧版可用)
- [ ] `make typecheck` 与 `make format` 通过
- [ ] 手动验证各失败场景

## Blocked by

- 06: 完整包档 + linux 例外 + win 替换时序
