Status: ready-for-agent

# useToast 组件(主题化 toast,Provider + hook)

## What to build

新建 `web/src/hooks/useToast.tsx`,对齐 `useTheme.tsx` 的 Context 模式:

- `ToastProvider`:持有当前 toast 状态,渲染 toast DOM。
- `useToast()` hook:返回 `{ show(msg: string) }`,`show` 用 `useCallback` 稳定引用(拦截器闭包可用)。
- App 顶层挂 `<ToastProvider>`(放 `ThemeProvider` 内,复用主题变量)。

toast 形态:

- 位置:屏幕底部居中(避开 header / FloatingActions 右下 / chat 输入框)。
- 消失:自动 2.5s + 可点击关闭。不做悬停暂停。
- 堆叠:同时只显示一条,新覆盖旧。
- 样式:主题变量(`--surface-alt` 底 + `--text` 字 + `--border` 边 + `--shadow-md` + `--r-md`),随 Archive/Draft 主题切换。
- 文案:由调用方传入(拦截器传"该页未在书本中")。

## Acceptance criteria

- [ ] `web/src/hooks/useToast.tsx` 新建,导出 `ToastProvider` 与 `useToast`
- [ ] `App.tsx` 在 `ThemeProvider` 内挂 `<ToastProvider>`
- [ ] `show(msg)` 触发底部居中 toast 显示
- [ ] 2.5s 后自动消失;点击 toast 可立即关闭
- [ ] 连续 `show` 新覆盖旧(同时只一条)
- [ ] toast 用主题变量,Archive(暗)/ Draft(浅)切换时外观随之变
- [ ] `make typecheck` 通过;`make format` 无 diff

## 不测

纯展示 + context,对齐 `useTheme.tsx` 无测试。手动验证。

## Blocked by

无。
