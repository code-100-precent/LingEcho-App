@echo off
chcp 65001 >nul
echo ========================================
echo    LingEcho 前端服务启动
echo ========================================
echo.

cd /d %~dp0web
echo 正在启动前端服务 (端口 5173)...
echo.
npm run dev

pause
