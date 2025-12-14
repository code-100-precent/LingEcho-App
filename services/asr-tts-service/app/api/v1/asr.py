"""
ASR API 端点
"""
import os
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from app.services.asr_service import ASRService
from app.core.config import settings

router = APIRouter(prefix="/asr", tags=["ASR"])

# 初始化服务
asr_service = ASRService()


class ASRRequest(BaseModel):
    """ASR 请求模型（JSON 格式）"""
    model_name: str = settings.default_asr_model
    language: str = settings.asr_language
    initial_prompt: Optional[str] = None


class ASRResponse(BaseModel):
    """ASR 响应模型"""
    text: str
    language: str
    segments: list = []


@router.post("/transcribe", response_model=ASRResponse)
async def transcribe_audio(
    file: UploadFile = File(..., description="音频文件"),
    model_name: str = Form(default=settings.default_asr_model),
    language: str = Form(default=settings.asr_language),
    initial_prompt: Optional[str] = Form(default=None),
):
    """
    识别上传的音频文件
    
    - **file**: 音频文件（支持 WAV, MP3, M4A 等格式）
    - **model_name**: Whisper 模型名称 (tiny/base/small/medium/large)
    - **language**: 语言代码（默认 zh）
    - **initial_prompt**: 初始提示词（用于引导输出格式）
    """
    # 检查文件大小
    file_content = await file.read()
    if len(file_content) > settings.max_upload_size:
        raise HTTPException(
            status_code=413,
            detail=f"文件大小超过限制 ({settings.max_upload_size / 1024 / 1024}MB)"
        )
    
    # 创建临时文件
    suffix = os.path.splitext(file.filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(file_content)
        tmp_path = tmp_file.name
    
    try:
        # 执行识别
        result = asr_service.transcribe(
            tmp_path,
            model_name=model_name,
            language=language,
            initial_prompt=initial_prompt
        )
        
        return ASRResponse(
            text=result["text"],
            language=result["language"],
            segments=result.get("segments", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/transcribe/bytes", response_model=ASRResponse)
async def transcribe_bytes(
    request: ASRRequest,
    audio_data: bytes = File(..., description="音频字节数据"),
):
    """
    识别音频字节数据
    
    - **audio_data**: 音频字节数据
    - **model_name**: Whisper 模型名称
    - **language**: 语言代码
    - **initial_prompt**: 初始提示词
    """
    try:
        result = asr_service.transcribe_bytes(
            audio_data,
            model_name=request.model_name,
            language=request.language,
            initial_prompt=request.initial_prompt
        )
        
        return ASRResponse(
            text=result["text"],
            language=result["language"],
            segments=result.get("segments", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")

