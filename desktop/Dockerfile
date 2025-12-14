# voicePilotCOre 多阶段构建 Dockerfile
# 第一阶段：构建后端应用
FROM golang:1.25.1-alpine AS backend-builder

# 设置工作目录
WORKDIR /app

# 安装必要的构建工具
RUN apk add --no-cache git ca-certificates tzdata

# 复制go mod文件
COPY server/go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY .. .

# 构建主服务器
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/server/main.go

# 构建语音服务器
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o voice ./cmd/voice/main.go

# 第二阶段：构建前端应用
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# 复制package文件
COPY ui/package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制前端源代码
COPY ui/ ./

# 构建前端应用
RUN npm run build

# 第三阶段：最终运行镜像
FROM alpine:latest

# 安装必要的运行时包
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    wget \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建应用用户
RUN adduser -D -s /bin/sh appuser

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=backend-builder /app/main .
COPY --from=backend-builder /app/voiceserver .

# 从构建阶段复制前端构建产物
COPY --from=frontend-builder /app/dist ./ui/dist

# 复制静态资源和模板
COPY server/static ./static/
COPY server/templates ./templates/
COPY scripts/ ./scripts/
COPY doc/ ./doc/

# 复制配置文件
COPY server/banner.txt .
COPY server/objects.go .
COPY server/objects_secure.go .
COPY server/assets.go .

# 创建必要的目录
RUN mkdir -p \
    logs \
    uploads \
    backups \
    media_cache \
    recorddata \
    tracedata \
    temp \
    search \
    data

# 设置目录权限
RUN chown -R appuser:appuser /app

# 切换到应用用户
USER appuser

# 暴露端口
EXPOSE 7072 8000

# 设置环境变量
ENV APP_ENV=production
ENV MODE=production
ENV ADDR=:7072
ENV VOICE_SERVER_ADDR=:8000
ENV DB_DRIVER=sqlite
ENV DSN=./data/voice_pilot_core.db

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7072/health || exit 1

# 启动脚本
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# 启动命令
ENTRYPOINT ["/app/docker-entrypoint.sh"]
