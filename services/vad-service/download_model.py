"""
下载 SileroVAD 模型的脚本
直接下载 JIT 模型文件，不依赖 silero-vad 包
"""
import os
import requests
import torch
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SileroVAD JIT 模型的直接下载链接
JIT_MODEL_URL = "https://github.com/snakers4/silero-vad/raw/v4.0.0/src/silero_vad/data/silero_vad.jit"


def download_file(url: str, filepath: str):
    """下载文件"""
    logger.info(f"Downloading from {url}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0
    
    with open(filepath, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"\rProgress: {percent:.1f}%", end='', flush=True)
    
    print()  # 换行
    logger.info(f"Downloaded to {filepath}")


def download_silero_vad_model(model_dir="rtcmedia/snakers4_silero-vad"):
    """
    下载 SileroVAD JIT 模型文件
    
    Args:
        model_dir: 模型保存目录
    """
    # 确定模型文件路径
    model_path = os.path.join(model_dir, "src", "silero_vad", "data", "silero_vad.jit")
    
    # 如果模型已存在，跳过下载
    if os.path.exists(model_path):
        logger.info(f"Model already exists at {model_path}")
        logger.info("Testing model...")
        try:
            model = torch.jit.load(model_path, map_location=torch.device('cpu'))
            model.eval()
            
            # 测试模型
            import numpy as np
            test_audio = np.zeros(512, dtype=np.float32)
            test_tensor = torch.from_numpy(test_audio).unsqueeze(0)
            with torch.no_grad():
                prob = model(test_tensor, 16000)
                logger.info(f"✅ Model test successful! Output shape: {prob.shape if hasattr(prob, 'shape') else 'scalar'}")
            return model
        except Exception as e:
            logger.warning(f"Existing model test failed: {e}, will re-download")
            os.remove(model_path)
    
    logger.info("Downloading SileroVAD JIT model...")
    
    try:
        # 直接下载 JIT 模型文件
        download_file(JIT_MODEL_URL, model_path)
        
        # 验证下载的文件
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Downloaded file not found at {model_path}")
        
        file_size = os.path.getsize(model_path)
        logger.info(f"Model file size: {file_size / 1024 / 1024:.2f} MB")
        
        # 测试加载模型
        logger.info("Testing loaded model...")
        model = torch.jit.load(model_path, map_location=torch.device('cpu'))
        model.eval()
        
        # 测试推理
        import numpy as np
        test_audio = np.zeros(512, dtype=np.float32)  # 512 samples = 32ms @ 16kHz
        test_tensor = torch.from_numpy(test_audio).unsqueeze(0)
        with torch.no_grad():
            prob = model(test_tensor, 16000)
            logger.info(f"✅ Model test successful! Output: {prob}")
        
        logger.info(f"✅ Model downloaded and verified at: {model_path}")
        return model
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download model: {e}")
        logger.info("\nAlternative: Manual download")
        logger.info("1. Visit: https://github.com/snakers4/silero-vad")
        logger.info("2. Download silero_vad.jit from releases")
        logger.info(f"3. Place it in: {model_path}")
        raise
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise


if __name__ == "__main__":
    download_silero_vad_model()

