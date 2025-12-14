"""
TTS API 端点
"""
import os
import tempfile
from fastapi import APIRouter, HTTPException, Form, File
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Optional
from app.services.tts_service import TTSService
from app.core.config import settings

router = APIRouter(prefix="/tts", tags=["TTS"])

# 初始化服务
tts_service = TTSService()


class TTSRequest(BaseModel):
    """TTS 请求模型"""
    text: str
    language: str = "zh"
    use_edge_tts: bool = True
    voice: Optional[str] = None


class TTSResponse(BaseModel):
    """TTS 响应模型"""
    output_file: str
    engine: str
    voice: Optional[str] = None


@router.post("/synthesize")
async def synthesize_text(
    text: str = Form(..., description="要合成的文本"),
    language: str = Form(default="zh"),
    use_edge_tts: bool = Form(default=True),
    voice: Optional[str] = Form(default=None),
):
    """
    合成文本为语音，返回音频字节流
    
    - **text**: 要合成的文本
    - **language**: 语言代码（默认 zh）
    - **use_edge_tts**: 是否使用 edge-tts（默认 True）
    - **voice**: 语音名称（edge-tts 使用，默认 zh-CN-XiaoxiaoNeural）
    """
    try:
        # 使用字节流方式合成
        audio_data = tts_service.synthesize_bytes(
            text,
            language=language,
            use_edge_tts=use_edge_tts,
            voice=voice or settings.default_tts_voice
        )
        
        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="synthesized.wav"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")


@router.get("/voices")
async def get_available_voices():
    """获取可用的语音列表（edge-tts）"""
    try:
        voices = tts_service.get_available_voices()
        return {"voices": voices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取语音列表失败: {str(e)}")

