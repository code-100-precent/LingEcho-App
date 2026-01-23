@echo off
chcp 65001 >nul
echo ========================================
echo    LingEcho 后端服务启动
echo ========================================
echo.

cd /d %~dp0server
echo 正在启动后端服务 (端口 7072)...
echo.
go run ./cmd/server/main.go -mode=dev

pause
