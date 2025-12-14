# LingEcho Multi-stage Dockerfile
# Stage 1: Build backend application
FROM golang:1.24-alpine AS backend-builder

# Set working directory
WORKDIR /app

# Install necessary build tools
RUN apk add --no-cache git ca-certificates tzdata

# Set Go environment variables
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=sum.golang.org
ENV CGO_ENABLED=0
ENV GOOS=linux

# Copy go mod files first for better layer caching
COPY server/go.mod server/go.sum ./

# Download dependencies
RUN go mod download

# Copy server source code
COPY server/ ./

# Build main server
RUN go build -a -installsuffix cgo -ldflags '-w -s' -o main ./cmd/server/main.go

# Stage 2: Build frontend application
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install dependencies (use npm ci for reproducible builds)
RUN npm ci

# Copy frontend source code
COPY web/ ./

# Build frontend application
RUN npm run build

# Stage 3: Final runtime image
FROM alpine:latest

# Install necessary runtime packages
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    wget \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create application user
RUN adduser -D -s /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy binary from backend build stage
COPY --from=backend-builder /app/main .

# Copy frontend build artifacts from frontend build stage
COPY --from=frontend-builder /app/dist ./web/dist

# Copy server static resources and templates
COPY server/static/ ./static/
COPY server/templates/ ./templates/
COPY server/scripts/ ./scripts/

# Copy server configuration files
COPY server/banner.txt ./banner.txt
COPY server/objects.go ./objects.go
COPY server/assets.go ./assets.go

# Create necessary directories with proper permissions
RUN mkdir -p \
    logs \
    uploads \
    backups \
    media_cache \
    recorddata \
    tracedata \
    temp \
    search \
    data \
    && chown -R appuser:appuser /app

# Switch to application user
USER appuser

# Expose ports
EXPOSE 7072 8000

# Set default environment variables
ENV APP_ENV=production
ENV MODE=production
ENV ADDR=:7072
ENV VOICE_SERVER_ADDR=:8000
ENV DB_DRIVER=sqlite
ENV DSN=./data/ling.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7072/health || exit 1

# Create and set entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Launch command
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["./main"]
