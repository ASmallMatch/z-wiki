# 01: 包命名规范统一(z-wiki-{version}-{os}-{arch})

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/incremental-update/PRD.md`
- 关联 ADR:`docs/adr/0018-self-hosted-incremental-update.md`(D4)

## What to build

改 `desktop/electron-builder.yml` 各 target 的 `artifactName` 为 `z-wiki-${version}-${os}-${arch}.${ext}`,统一完整包命名,让产物一眼区分平台+arch。解决现状歧义:`z-wiki-0.1.0.dmg` 不知是 x64、`zwiki-setup-0.1.0.exe` 看不出平台、`-win.zip` 的 win 是 target 名不是规范标识。

electron-builder 的 `${os}` token = mac/win/linux(与 `process.platform` 的 darwin/win32/linux 不同),正好作平台标识。各 target(mac dmg / win nsis / win zip / linux AppImage)统一模板。nsis 现有 `zwiki-setup-` 前缀去掉,统一 `z-wiki-`(exe 扩展名已说明是安装器)。

## Acceptance criteria

- [ ] mac dmg 产物名 `z-wiki-{ver}-mac-{arm64|x64}.dmg`(两个 arch 都带后缀)
- [ ] win nsis 产物名 `z-wiki-{ver}-win-x64.exe`
- [ ] win zip 便携产物名 `z-wiki-{ver}-win-x64.zip`
- [ ] linux AppImage 产物名 `z-wiki-{ver}-linux-x64.AppImage`
- [ ] `make package` 产物名一眼区分平台+arch,无歧义
- [ ] `make typecheck` 与 `make format` 通过

## Blocked by

None - can start immediately
