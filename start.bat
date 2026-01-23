@echo off
chcp 65001 >nul
echo ========================================
echo    LingEcho 启动脚本
echo ========================================
echo.

echo [1/3] 检查环境配置...
if not exist .env (
    echo ❌ 错误: .env 文件不存在
    echo 请先复制 server\env.example 为 .env 并配置
    pause
    exit /b 1
)
echo ✅ 环境配置文件存在

echo.
echo [2/3] 启动后端服务 (端口 7072)...
start "LingEcho Backend" cmd /k "cd /d %~dp0server && go run ./cmd/server/main.go -mode=dev"
timeout /t 3 >nul

echo.
echo [3/3] 启动前端服务 (端口 5173)...
start "LingEcho Frontend" cmd /k "cd /d %~dp0web && npm run dev"

echo.
echo ========================================
echo ✅ 启动完成！
echo ========================================
echo.
echo 📌 访问地址:
echo    前端界面: http://localhost:5173
echo    后端API:  http://localhost:7072/api
echo    API文档:  http://localhost:7072/api/docs
echo.
echo 💡 提示:
echo    - 两个命令行窗口会自动打开
echo    - 关闭窗口即可停止服务
echo    - 首次启动可能需要等待几秒
echo.
pause
