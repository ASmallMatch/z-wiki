.PHONY: help install dev dev-server dev-web build health typecheck lint format format-check stop clean

PORT ?= 3000
WEB_PORT ?= 5173

help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-15s %s\n", $$1, $$2}'

install: ## 安装依赖
	npm install --ignore-scripts

dev: ## 同时启动 server + web(开发模式)
	npm run dev

dev-server: ## 仅启动后端(server :$(PORT))
	PORT=$(PORT) npm run dev -w server

dev-web: ## 仅启动前端(web :$(WEB_PORT),proxy 到 server)
	npm run dev -w web

build: ## 构建前端 + 后端产物
	npm run build

health: ## 知识库健康检查(断链/孤儿/空文件等)
	npm run health

typecheck: ## 全量类型检查
	npm run typecheck

lint: ## Biome lint 检查(不修改)
	npm run lint

format: ## Biome 格式化(写入)
	npm run format

format-check: ## Biome 格式化检查(只读,用于 CI)
	npm run format:check

stop: ## 停止 server 与 web 进程
	@lsof -ti :$(PORT) | xargs kill 2>/dev/null && echo "已停止 server :$(PORT)" || echo "server :$(PORT) 无进程"
	@lsof -ti :$(WEB_PORT) | xargs kill 2>/dev/null && echo "已停止 web :$(WEB_PORT)" || echo "web :$(WEB_PORT) 无进程"

clean: ## 清理构建产物与依赖
	rm -rf node_modules server/dist web/dist
	@echo "已清理"
