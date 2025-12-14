"""
ASR Service - 语音识别服务
使用 Whisper 进行语音识别
"""
import os
import whisper
from typing import Optional
import logging

# 尝试导入繁简转换库
try:
    from zhconv import convert
    HAS_ZHCONV = True
except ImportError:
    HAS_ZHCONV = False

logger = logging.getLogger(__name__)


class ASRService:
    """ASR 服务类"""
    
    def __init__(self):
        self.models = {}  # 缓存已加载的模型
    
    def transcribe(
        self,
        audio_file: str,
        model_name: str = "base",
        language: str = "zh",
        initial_prompt: Optional[str] = None
    ) -> dict:
        """
        使用 Whisper 进行语音识别
        
        Args:
            audio_file: 音频文件路径
            model_name: Whisper 模型名称 (tiny/base/small/medium/large)
            language: 语言代码
            initial_prompt: 初始提示词（用于引导输出格式）
        
        Returns:
            dict: 包含识别文本和元数据的字典
        """
        if not os.path.exists(audio_file):
            raise FileNotFoundError(f"音频文件不存在: {audio_file}")
        
        # 加载模型（如果未加载则加载并缓存）
        if model_name not in self.models:
            logger.info(f"正在加载 Whisper 模型: {model_name}...")
            self.models[model_name] = whisper.load_model(model_name)
            logger.info(f"模型 {model_name} 加载完成")
        
        model = self.models[model_name]
        
        logger.info(f"正在识别音频文件: {audio_file}...")
        
        # 使用 initial_prompt 引导输出简体中文
        if initial_prompt is None:
            initial_prompt = "这是一段中文语音，使用简体中文。"
        
        result = model.transcribe(
            audio_file,
            language=language,
            initial_prompt=initial_prompt
        )
        
        text = result["text"].strip()
        
        # 如果识别结果包含繁体字，转换为简体
        if HAS_ZHCONV:
            text = convert(text, "zh-cn")  # 转换为简体中文
        
        logger.info(f"识别结果: {text}")
        
        return {
            "text": text,
            "language": result.get("language", language),
            "segments": result.get("segments", []),
        }
    
    def transcribe_bytes(
        self,
        audio_data: bytes,
        model_name: str = "base",
        language: str = "zh",
        initial_prompt: Optional[str] = None
    ) -> dict:
        """
        从字节数据识别语音
        
        Args:
            audio_data: 音频字节数据
            model_name: Whisper 模型名称
            language: 语言代码
            initial_prompt: 初始提示词
        
        Returns:
            dict: 包含识别文本和元数据的字典
        """
        import tempfile
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(audio_data)
            tmp_path = tmp_file.name
        
        try:
            result = self.transcribe(tmp_path, model_name, language, initial_prompt)
        finally:
            # 清理临时文件
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        
        return result

