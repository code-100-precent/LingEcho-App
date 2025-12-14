"""
配置管理
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""
    
    # 服务配置
    host: str = "0.0.0.0"
    port: int = 7075
    title: str = "ASR-TTS Service"
    version: str = "1.0.0"
    
    # ASR 配置
    default_asr_model: str = "base"  # tiny/base/small/medium/large
    asr_language: str = "zh"
    
    # TTS 配置
    default_tts_engine: str = "edge-tts"  # edge-tts 或 pyttsx3
    default_tts_voice: str = "zh-CN-XiaoxiaoNeural"
    
    # 文件上传配置
    max_upload_size: int = 50 * 1024 * 1024  # 50MB
    upload_dir: str = "/tmp/asr_tts_uploads"
    
    # 日志配置
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()

