# ADR-0021: 思考控制两档化(toggle 开关)+ reasoning 恒 true 乐观声明

- 状态:accepted
- 日期:2026-07-18
- 范围:layer2(chat quickbar 思考控件 + 设置页)+ layer3(config.reasoning 移除 / generateModelsJson / interaction 路由与广播)
- 关联:supersedes ADR-0004 D8 的「config.reasoning 字段 + 自动推断 + available 档位暴露」部分;supersedes ADR-0012 D4(按 model 动态 available)与 D5(quickbar 下拉菜单)。ADR-0004 D8 的 thinkingLevel 持久化、ADR-0012 D1/D2(中文约束两段注入)不动

## 背景

ADR-0004 D8 引入 `config.reasoning`(设置页「思考模式」开关)的原因是:z-wiki 的 model 走任意 `baseUrl`+`model` 组合(无 provider 预设),除 DeepSeek 能按 baseUrl/model.id 自动推断外,模型是否支持思考无法推断,需人工声明。由此产生的耦合:

1. **两处开关管一件事**:聊天页 quickbar 有思考档位下拉,设置页还有个「模型是否支持思考」总闸。用户在聊天页看到按钮灰显,tooltip 指路「去设置页勾选 reasoning」——开个思考要跨两个页面。
2. **灰显/available 机制随之复杂**:`getAvailableThinkingLevels` → `serializeThinking` → 三处 WS 广播 + 两个 HTTP 端点都带 `{level, available}`,前端维护 `thinkingLevels` state 渲染菜单与灰显。

简化方向(经 grill 确认):设置页开关删掉,聊天页控件塌缩为两档 toggle(off/开),「开」用 pi 默认思考等级。

## 决策

### D1: model.reasoning 恒 true(乐观声明),删 config.reasoning

`generateModelsJson` 对任何 model 恒写 `reasoning: true`,不再读 config 也不自动推断。依据:

- **off 零副作用**:pi-agent-core 在 thinkingLevel=off 时 `reasoning: undefined`,provider 层不发任何思考参数(openai-completions 默认风格什么都不发;deepseek 格式显式发 `thinking:{type:'disabled'}`)。恒 true 不影响关闭态。
- **on 的责任交还 provider**:真·思考模型正常工作;不支持的模型要么 provider 报错(经 agent error 路径显示在聊天里),要么静默忽略(无 thinking token,用户从输出无思维链可发现)。z-wiki 不再替 provider 做能力判断。
- 备选「只留自动推断(DeepSeek→true,其余 false)」被否:Qwen-thinking/GLM-thinking 等非 DeepSeek 思考模型将永远开不了思考,功能实质退化。

`config.reasoning` 字段彻底删除(类型/readConfig 解析/设置页开关/GET /api/config/status 的 reasoning/POST /api/config/llm 的 reasoning 入参)。老 config.json 残留的 `reasoning` 键被逐字段解析天然忽略,静默丢弃不报错——与 provider 字段必须抛迁移错误不同:provider 被忽略会静默兜底成空 baseUrl 报误导性错误,reasoning 被忽略无任何副作用。

DeepSeek 的 `thinkingLevelMap` 自动注入保留(`isDeepSeekModel` 只剩此用途):DeepSeek effort 只认 high/max,不注入则 pi 档名原样发送不被识别。

### D2: config.thinkingLevel 存全档名,UI 塌缩两档

持久化层不变:仍是 pi 原档名(off/minimal/low/medium/high/xhigh)。UI 层 `!== 'off'` 即「开」。依据:

- 存量 config 零迁移(老用户存的 'high' 显示为「开」,语义正确);
- 手编 config 高档位的逃逸口保留;
- 不为两档 UI 引入 `'on'` 新枚举 + 迁移逻辑 + session 边界翻译层——持久化保真,呈现层简化。

代价(已接受):手编高档位的用户拨「关」再拨「开」归位到 medium,需重新手编才能回到 high。

「开」的目标档 = `'medium'`,对齐 pi 的 `DEFAULT_THINKING_LEVEL`(pi-coding-agent 未导出该常量,web 侧本地定义 `THINKING_ON_LEVEL` 并注释跟随)。

### D3: UI 为 toggle 按钮,显示真实档名

quickbar 下拉菜单改为点击即切换的按钮:`思考:off` ↔ `思考:medium`,一次点击完成(`aria-pressed` 表状态)。手编高档位时文案诚实显示实际档名(如 `思考:high`),点击回 off。不保留下拉:两个选项套下拉是仪式大于效用;「将来恢复多档」是想象中的需求(YAGNI),恢复时重做组件成本可控。

灰显机制删除:reasoning 恒 true 后 available 恒全档,无「不支持」态可灰;tooltip 指路设置页的文案随设置项一起消失。

### D4: available(thinkingLevels)从 API 全拆

所有 payload 只留 `thinkingLevel`:`session_init` / `thinking_changed` / model 切换广播、`GET /api/thinking`、`POST /api/config/thinking` 响应。`serializeThinking` 改 `currentThinkingLevel`(有活跃 chat session 读 session 实际值,无则回退 config)。前端 `useChat` 删 `thinkingLevels` state。不留字段「以防将来」:它是 `getAvailableThinkingLevels()` 一行的纯派生数据,需要时加回成本极低,留着则每次改广播结构都要维护没人读的字段。

## 后果

- `server/src/config.ts`:`ConfigJson.reasoning` 删除;`generateModelsJson` 恒 `reasoning: true`(入参 Pick 去掉 reasoning);`readConfig` 删解析行,老键静默忽略。
- `server/src/interaction.ts`:`serializeThinking` → `currentThinkingLevel`;三处广播 + 两端点瘦掉 `thinkingLevels`;`GET /api/config/status` 删 `reasoning`;`POST /api/config/llm` 删 `reasoning` 入参。
- `web`:`useChat` 删 `thinkingLevels`;`ChatPanel` 的 ThinkingButton 由下拉改 toggle(新增 `THINKING_ON_LEVEL` 常量);`Settings.tsx` 删思考模式开关。
- 死 CSS:`.chat-thinking-toggle`/`.chat-thinking-menu`/`.chat-thinking-hint` 不再被引用,随并行样式改动一并清理(本次不动 chat.css)。
- 测试:`config.test.ts` 改写(reasoning 恒 true / DeepSeek 映射 / 老 reasoning 键静默忽略);无 interaction 路由级测试,广播瘦身靠 typecheck + 手动验证。
- 不变:ingest session 恒 off;`thinkingPromptFactory` 段B 注入(`getThinkingLevel() !== 'off'` 判断两档下依然成立);`applyThinkingToChatSession` 的 clamp 防御保留;思维链渲染(thinking capsule)。
