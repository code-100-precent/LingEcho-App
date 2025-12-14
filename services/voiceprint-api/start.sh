#!/bin/bash

# 声纹识别服务启动脚本
# 确保使用虚拟环境中的 Python

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "错误: 虚拟环境不存在，请先运行: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 检查 PyTorch 是否安装
if ! python -c "import torch" 2>/dev/null; then
    echo "错误: PyTorch 未安装"
    echo "正在安装 PyTorch..."
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# 检查其他依赖
if ! python -c "import scipy" 2>/dev/null; then
    echo "错误: 依赖未完整安装"
    echo "请运行: pip install -r requirements.txt"
    exit 1
fi

# 启动服务
echo "启动声纹识别服务..."
python -m app.main

