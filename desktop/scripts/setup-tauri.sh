#!/bin/bash

# voicePilotCore Tauri 项目设置脚本

echo "🚀 开始设置 voicePilotCore Tauri 项目..."

# 检查 Rust 是否安装
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust 未安装，请先安装 Rust: https://rustup.rs/"
    exit 1
fi

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 安装 Rust 依赖
echo "📦 安装 Rust 依赖..."
cd src-tauri
cargo build
cd ..

# 安装 Node.js 依赖
echo "📦 安装 Node.js 依赖..."
npm install

# 创建图标目录
echo "🎨 创建图标目录..."
mkdir -p src-tauri/icons

# 复制默认图标（如果有的话）
if [ -f "public/icon.png" ]; then
    cp public/icon.png src-tauri/icons/icon.png
    echo "✅ 复制了默认图标"
else
    echo "⚠️  未找到默认图标，请手动添加图标到 src-tauri/icons/ 目录"
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p src-tauri/migrations
mkdir -p src-tauri/icons

echo "✅ voicePilotCore Tauri 项目设置完成！"
echo ""
echo "📋 可用的命令："
echo "  npm run tauri:dev    - 开发模式运行"
echo "  npm run tauri:build  - 构建应用"
echo "  npm run dev          - 仅运行前端开发服务器"
echo ""
echo "🎯 下一步："
echo "  1. 添加应用图标到 src-tauri/icons/ 目录"
echo "  2. 运行 npm run tauri:dev 开始开发"
echo "  3. 根据需要调整 tauri.conf.json 配置"
