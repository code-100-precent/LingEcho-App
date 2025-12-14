# Probe 网络抓包工具 Makefile

.PHONY: help build run clean deps test install

# 默认目标
help:
	@echo "Probe 网络抓包工具"
	@echo "=================="
	@echo ""
	@echo "可用命令:"
	@echo "  make deps     - 安装依赖"
	@echo "  make build    - 构建程序"
	@echo "  make run      - 运行程序 (需要指定INTERFACE)"
	@echo "  make clean    - 清理构建文件"
	@echo "  make test     - 运行测试"
	@echo "  make install  - 安装到系统"
	@echo ""
	@echo "示例:"
	@echo "  make run INTERFACE=en0"
	@echo "  make run INTERFACE=eth0 PORT=8080"

# 安装依赖
deps:
	@echo "📦 安装依赖..."
	go mod tidy
	go mod download

# 构建程序
build: deps
	@echo "🔨 构建程序..."
	go build -o bin/probe main.go

# 运行程序
run: deps
	@if [ -z "$(INTERFACE)" ]; then \
		echo "❌ 错误: 请指定网络接口名称"; \
		echo "使用方法: make run INTERFACE=<接口名称>"; \
		echo "示例: make run INTERFACE=en0"; \
		exit 1; \
	fi
	@echo "🚀 启动Probe抓包工具..."
	@echo "网络接口: $(INTERFACE)"
	@echo "Web端口: $(or $(PORT),8080)"
	go run main.go -i $(INTERFACE) -p $(or $(PORT),8080) -v

# 清理构建文件
clean:
	@echo "🧹 清理构建文件..."
	rm -rf bin/
	go clean

# 运行测试
test:
	@echo "🧪 运行测试..."
	go test ./...

# 安装到系统
install: build
	@echo "📦 安装到系统..."
	sudo cp bin/probe /usr/local/bin/
	@echo "✅ 安装完成! 现在可以使用 'probe' 命令"

# 开发模式运行
dev: deps
	@if [ -z "$(INTERFACE)" ]; then \
		echo "❌ 错误: 请指定网络接口名称"; \
		echo "使用方法: make dev INTERFACE=<接口名称>"; \
		exit 1; \
	fi
	@echo "🔧 开发模式启动..."
	air -c .air.toml

# 检查代码质量
lint:
	@echo "🔍 检查代码质量..."
	golangci-lint run

# 格式化代码
fmt:
	@echo "🎨 格式化代码..."
	go fmt ./...
	goimports -w .

# 生成文档
docs:
	@echo "📚 生成文档..."
	godoc -http=:6060
	@echo "文档服务器启动在: http://localhost:6060"
