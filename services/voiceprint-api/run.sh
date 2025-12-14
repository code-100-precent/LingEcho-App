#!/bin/bash

# 声纹识别服务运行脚本

set -e

echo "=========================================="
echo "声纹识别服务启动脚本"
echo "=========================================="

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python 3.10+"
    exit 1
fi

# 检查配置文件
if [ ! -f "data/.voiceprint.yaml" ]; then
    echo "创建配置文件..."
    mkdir -p data
    cp voiceprint.yaml data/.voiceprint.yaml
    echo "✅ 配置文件已创建: data/.voiceprint.yaml"
    echo "⚠️  请编辑 data/.voiceprint.yaml 配置数据库连接信息"
    echo ""
    echo "按 Enter 继续（确保已配置数据库）..."
    read
fi

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
    echo "✅ 虚拟环境已创建"
fi

# 激活虚拟环境
echo "激活虚拟环境..."
source venv/bin/activate

# 检查 PyTorch（必须先安装）
if ! python3 -c "import torch" 2>/dev/null; then
    echo "安装 PyTorch..."
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    echo "✅ PyTorch 安装完成"
fi

# 检查其他依赖
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "安装其他依赖..."
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt
    echo "✅ 依赖安装完成"
fi

# 启动服务
echo ""
echo "=========================================="
echo "启动服务..."
echo "=========================================="
echo ""

# 使用生产环境启动脚本
python start_server.py

