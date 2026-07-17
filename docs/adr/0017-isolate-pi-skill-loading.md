# ADR-0017: 限制 pi skill 加载到 z-wiki 自有(隔离 ~/.claude/skills/)

- 状态:accepted
- 日期:2026-07-17
- 范围:server agentHost buildAgentContext 的 DefaultResourceLoader 选项
- 关联:extends ADR-0009(health-check skill);补强 ADR-0003 D6 工具集

## 背景

pi coding agent 启动时,DefaultResourceLoader 默认扫描 skill 目录(`loadSkills` + `collectAncestorAgentsSkillDirs`),把所有 skill 的 name+description 经 `formatSkillsForSystemPrompt` 注入 agent system prompt。`noSkills` 默认 `false`。

z-wiki 用 pi,`agentDir=.pi/agent`、`cwd=appRoot`。pi 向上收集祖先 skill 目录,把 `~/.claude/skills/` 的 70+ Claude Code 开发技能(lark-* 全家桶、firecrawl、architecture、tdd、code-review 等)全灌进 z-wiki agent 的 system prompt。用户问"你有什么工具",agent 把这些 skill 全列了--技术上没说谎(pi 确实注入),但严重误导:这些 skill 大多依赖 z-wiki agent 没有的工具(firecrawl API、lark API、gh CLI),在知识库场景下用不了。

根因:z-wiki 没隔离 pi 的 skill 加载,默认继承全局 Claude Code skills。

## 决策

buildAgentContext 的 DefaultResourceLoader 传:
- `noSkills: true` -- 跳过默认目录扫描(reload 里 `noSkills` 时只取 `cliEnabledSkills + additionalSkillPaths`,不取 `enabledSkills`)
- `additionalSkillPaths: [path.join(appRoot, '.pi', 'skills', 'health-check')]` -- 显式只加载 z-wiki 自有 skill(ADR-0009)

净效果:z-wiki agent 的 system prompt 只含 `health-check` 一个 skill,`~/.claude/skills/` 的 70+ 不再注入。

## 边界确认

- **不误伤 z-wiki 功能**:z-wiki 仅依赖 `health-check` 这一个 pi skill(ADR-0009 快捷按钮 `send('/skill:health-check')`);pandoc/health_check 是 customTool,走 `extensionFactories`/`customTools`,不受 `noSkills` 影响。
- **dev 形态**:`appRoot`=项目根,`.pi/skills/health-check/SKILL.md` 已存在。
- **桌面形态**:`appRoot`=UserDataDir,ADR-0009 已规划 app bundle 带一份 `.pi/skills/`(切片 06),`noSkills` 不改变既有打包约束。
- **不影响 extensions**:`noSkills` 只管 skills,`extensionFactories`(kbHooks/thinking)照常。

## 被否备选

- **prompt 层纠偏**(KB_SYSTEM_PROMPT 补"忽略其他 skill 描述"):治标,skills 仍占 system prompt token + agent 仍可能触发。
- **删 ~/.claude/skills/ 的无关 skills**:那是用户的 Claude Code 全局 skills,不属于 z-wiki,不该动。
- **noSkills: true 不传 additionalSkillPaths**:会误伤 health-check(ADR-0009 快捷按钮失效)。

## 后果

- z-wiki agent 只看到 `health-check` skill;用户问"工具"时不再列 lark/firecrawl 等无关技能。
- **后续 z-wiki 新增 pi skill 须手动加进 `additionalSkillPaths`**(不再自动发现 `.pi/skills/` 下全部)。这是隔离的代价--可控性换自动发现。
- `~/.claude/skills/` 的 Claude Code 开发技能不再泄漏进 z-wiki agent。
- 单测难覆盖(`DefaultResourceLoader.reload` 涉及 pi 内部 + fs 扫描),验证靠 typecheck + 现有测试不破 + 运行时确认 skill 列表。

## 验证

- `make typecheck`(4 tsconfig)通过;现有全量测试不破。
- 运行时:起 server,agent system prompt 的 skill 列表只剩 `health-check`(用户在桌面应用问 agent 确认)。
