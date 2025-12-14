#!/bin/bash
# ASR-TTS Service 启动脚本

echo "正在启动 ASR-TTS Service..."

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "虚拟环境不存在，正在创建..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 升级 pip
pip install --upgrade pip

# 安装依赖
echo "正在安装依赖..."
pip install -r requirements.txt

# 启动服务
echo "正在启动服务..."
python -m app.main

