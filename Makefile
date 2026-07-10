.PHONY: help install run run-w build typecheck lint format format-check clean

WORKTREE ?= .claude/worktrees/command

help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-15s %s\n", $$1, $$2}'

install: ## 安装依赖
	npm install --ignore-scripts

run: ## 构建并启动主工作区的 desktop(Electron)
	npm run desktop

run-w: ## 复用主工作区依赖,启动 worktree 的 desktop
	@ln -sfn "$(CURDIR)/node_modules" "$(WORKTREE)/node_modules"
	cd "$(WORKTREE)" && npm run desktop

build: ## 构建前端 + 后端产物
	npm run build

typecheck: ## 全量类型检查
	npm run typecheck

lint: ## Biome lint 检查(不修改)
	npm run lint

format: ## Biome 格式化(写入)
	npm run format

format-check: ## Biome 格式化检查(只读,用于 CI)
	npm run format:check

clean: ## 清理构建产物与依赖
	rm -rf node_modules server/dist web/dist
	@echo "已清理"
