"""
TTS Service - 文本转语音服务
支持 edge-tts 和 pyttsx3
"""
import os
import logging
from typing import Optional

# 尝试导入 edge-tts（更快的 TTS 引擎）
try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

# 尝试导入 pyttsx3（备用方案）
try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    HAS_PYTTSX3 = False

logger = logging.getLogger(__name__)


class TTSService:
    """TTS 服务类"""
    
    def __init__(self):
        self.edge_tts_voice = "zh-CN-XiaoxiaoNeural"  # 默认中文语音
        self.pyttsx3_engine = None
    
    def synthesize(
        self,
        text: str,
        output_file: str,
        language: str = "zh",
        use_edge_tts: bool = True,
        voice: Optional[str] = None
    ) -> dict:
        """
        使用 TTS 引擎进行文本转语音
        
        Args:
            text: 要合成的文本
            output_file: 输出音频文件路径
            language: 语言代码
            use_edge_tts: 是否优先使用 edge-tts
            voice: 语音名称（edge-tts 使用）
        
        Returns:
            dict: 包含输出文件路径和元数据的字典
        """
        logger.info(f"正在合成语音: {text[:50]}...")
        
        # 优先使用 edge-tts（更快）
        if use_edge_tts and HAS_EDGE_TTS:
            try:
                self._synthesize_edge(text, output_file, voice or self.edge_tts_voice)
                return {
                    "output_file": output_file,
                    "engine": "edge-tts",
                    "voice": voice or self.edge_tts_voice,
                }
            except Exception as e:
                logger.warning(f"edge-tts 合成失败，回退到 pyttsx3: {e}")
        
        # 使用 pyttsx3（备用方案）
        if HAS_PYTTSX3:
            self._synthesize_pyttsx3(text, output_file, language)
            return {
                "output_file": output_file,
                "engine": "pyttsx3",
            }
        
        raise RuntimeError("没有可用的 TTS 引擎")
    
    def synthesize_bytes(
        self,
        text: str,
        language: str = "zh",
        use_edge_tts: bool = True,
        voice: Optional[str] = None
    ) -> bytes:
        """
        合成语音并返回字节数据
        
        Args:
            text: 要合成的文本
            language: 语言代码
            use_edge_tts: 是否优先使用 edge-tts
            voice: 语音名称
        
        Returns:
            bytes: 音频字节数据
        """
        import tempfile
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_path = tmp_file.name
        
        try:
            result = self.synthesize(text, tmp_path, language, use_edge_tts, voice)
            
            # 读取生成的音频文件
            with open(tmp_path, "rb") as f:
                audio_data = f.read()
            
            return audio_data
        finally:
            # 清理临时文件
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def _synthesize_edge(self, text: str, output_file: str, voice: str) -> None:
        """使用 edge-tts 进行文本转语音"""
        import asyncio
        
        async def _synthesize():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_file)
        
        asyncio.run(_synthesize())
        logger.info(f"edge-tts 语音合成完成，已保存到: {output_file}")
    
    def _synthesize_pyttsx3(self, text: str, output_file: str, language: str) -> None:
        """使用 pyttsx3 进行文本转语音"""
        if self.pyttsx3_engine is None:
            self.pyttsx3_engine = pyttsx3.init()
            
            # 设置语音属性
            voices = self.pyttsx3_engine.getProperty('voices')
            if voices:
                # 尝试找到中文语音
                for voice in voices:
                    if 'chinese' in voice.name.lower() or 'zh' in voice.id.lower():
                        self.pyttsx3_engine.setProperty('voice', voice.id)
                        break
            
            # 设置语速和音量
            self.pyttsx3_engine.setProperty('rate', 150)
            self.pyttsx3_engine.setProperty('volume', 1.0)
        
        # 保存为 WAV 文件
        self.pyttsx3_engine.save_to_file(text, output_file)
        self.pyttsx3_engine.runAndWait()
        
        logger.info(f"pyttsx3 语音合成完成，已保存到: {output_file}")
    
    def get_available_voices(self) -> list:
        """获取可用的语音列表（edge-tts）"""
        if not HAS_EDGE_TTS:
            return []
        
        import asyncio
        
        async def _get_voices():
            voices = await edge_tts.list_voices()
            return [v for v in voices if v["Locale"].startswith("zh")]
        
        return asyncio.run(_get_voices())

