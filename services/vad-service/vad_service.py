"""
SileroVAD Service - 独立的语音活动检测服务
基于 xiaozhi-esp32 的 SileroVAD 实现
"""
import time
import base64
import os
import numpy as np
import torch
import opuslib_next
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import logging

# 尝试导入 requests（用于自动下载模型）
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SileroVAD Service", version="1.0.0")


class VADRequest(BaseModel):
    """VAD 请求模型（JSON 格式，使用 Base64 编码的音频数据）"""
    audio_data: str  # Base64 编码的音频数据
    audio_format: str = "pcm"  # "pcm" 或 "opus"
    sample_rate: int = 16000
    channels: int = 1


class VADResponse(BaseModel):
    """VAD 响应模型"""
    have_voice: bool  # 当前帧是否有人说话
    voice_stop: bool  # 是否判断为这句话结束（静默超阈值）
    speech_prob: Optional[float] = None  # 语音概率（可选）


class SileroVADService:
    """SileroVAD 服务类"""
    
    def __init__(
        self,
        model_dir: str = None,
        threshold: float = 0.5,
        threshold_low: float = 0.2,
        min_silence_duration_ms: int = 1000,
        frame_window_threshold: int = 3,
    ):
        """
        初始化 VAD 服务
        
        Args:
            model_dir: SileroVAD 模型目录（如果为 None，会尝试自动下载）
            threshold: 语音检测高阈值（>= 此值认为有语音）
            threshold_low: 语音检测低阈值（<= 此值认为无语音）
            min_silence_duration_ms: 最小静默持续时间（毫秒），超过此时间认为一句话结束
            frame_window_threshold: 滑动窗口中至少需要多少帧有语音才认为有语音
        """
        if model_dir is None:
            # 尝试多个可能的路径
            possible_paths = [
                "rtcmedia/snakers4_silero-vad",
                "models/snakers4_silero-vad",
                "../xiaozhi-esp32-server-main/main/xiaozhi-server/models/snakers4_silero-vad",
            ]
            model_dir = None
            for path in possible_paths:
                if os.path.exists(path):
                    model_dir = path
                    break
            
            if model_dir is None:
                logger.warning("Model directory not found, will try to download from GitHub")
                model_dir = "snakers4/silero-vad"  # 使用 GitHub 路径
        
        logger.info(f"Loading SileroVAD model from {model_dir}")
        try:
            # 尝试使用 torch.hub 加载（如果模型目录有 hubconf.py）
            try:
                self.model, _ = torch.hub.load(
                    repo_or_dir=model_dir,
                    source="local",
                    model="silero_vad",
                    force_reload=False,
                )
                self.model.eval()
                logger.info("SileroVAD model loaded via torch.hub")
            except Exception as hub_error:
                # 如果 hub 加载失败，尝试直接加载 JIT 模型或从 GitHub 下载
                logger.info(f"torch.hub load failed, trying alternatives: {hub_error}")
                
                # 尝试多个可能的 JIT 模型路径
                possible_jit_paths = [
                    os.path.join(model_dir, "src", "silero_vad", "data", "silero_vad.jit"),
                    os.path.join(model_dir, "silero_vad.jit"),
                    "silero_vad.jit",  # 当前目录
                ]
                
                jit_model_path = None
                for path in possible_jit_paths:
                    if os.path.exists(path):
                        jit_model_path = path
                        break
                
                if jit_model_path:
                    # 直接加载 JIT 模型（不需要 silero-vad 包）
                    self.model = torch.jit.load(jit_model_path, map_location=torch.device('cpu'))
                    self.model.eval()
                    logger.info(f"SileroVAD JIT model loaded directly from {jit_model_path}")
                else:
                    # 尝试从 GitHub 直接下载 JIT 文件
                    logger.info("Local model not found, trying to download from GitHub...")
                    try:
                        if not HAS_REQUESTS:
                            raise ImportError("requests package not installed")
                        model_dir_path = "rtcmedia/snakers4_silero-vad/src/silero_vad/data"
                        os.makedirs(model_dir_path, exist_ok=True)
                        jit_model_path = os.path.join(model_dir_path, "silero_vad.jit")
                        
                        if not os.path.exists(jit_model_path):
                            logger.info("Downloading JIT model file from GitHub...")
                            url = "https://github.com/snakers4/silero-vad/raw/v4.0.0/src/silero_vad/data/silero_vad.jit"
                            response = requests.get(url, stream=True)
                            response.raise_for_status()
                            
                            with open(jit_model_path, 'wb') as f:
                                for chunk in response.iter_content(chunk_size=8192):
                                    if chunk:
                                        f.write(chunk)
                            
                            logger.info(f"Model downloaded to {jit_model_path}")
                        
                        # 加载下载的 JIT 模型
                        self.model = torch.jit.load(jit_model_path, map_location=torch.device('cpu'))
                        self.model.eval()
                        logger.info("SileroVAD JIT model downloaded and loaded from GitHub")
                    except ImportError:
                        raise FileNotFoundError(
                            f"Failed to load SileroVAD model:\n"
                            f"1. Local paths tried: {possible_jit_paths}\n"
                            f"2. Missing 'requests' package for auto-download\n"
                            f"Please run: pip install requests\n"
                            f"Or run: python download_model.py\n"
                            f"Or manually download from: https://github.com/snakers4/silero-vad"
                        )
                    except Exception as download_error:
                        raise FileNotFoundError(
                            f"Failed to load SileroVAD model:\n"
                            f"1. Local paths tried: {possible_jit_paths}\n"
                            f"2. GitHub download failed: {download_error}\n"
                            f"Please run: python download_model.py\n"
                            f"Or manually download from: https://github.com/snakers4/silero-vad"
                        )
        except Exception as e:
            logger.error(f"Failed to load SileroVAD model: {e}")
            raise RuntimeError(f"Failed to load VAD model from {model_dir}: {e}")
        
        # OPUS 解码器（用于解码 OPUS 格式的音频）
        # 延迟初始化，避免在服务启动时就创建（可能导致析构问题）
        self.opus_decoder = None
        self._decoder_sample_rate = 16000
        self._decoder_channels = 1
        
        # VAD 参数
        self.vad_threshold = threshold
        self.vad_threshold_low = threshold_low
        self.silence_threshold_ms = min_silence_duration_ms
        self.frame_window_threshold = frame_window_threshold
        
        # 状态管理（每个会话独立）
        self.sessions = {}
        
        logger.info("SileroVAD service initialized successfully")
    
    def _get_or_create_session(self, session_id: str):
        """获取或创建会话状态"""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "audio_buffer": bytearray(),
                "voice_window": [],
                "have_voice": False,
                "last_is_voice": False,
                "last_activity_time": 0,
                "voice_stop": False,
            }
        return self.sessions[session_id]
    
    def process_audio(
        self,
        audio_data: bytes,
        audio_format: str = "pcm",
        sample_rate: int = 16000,
        channels: int = 1,
        session_id: str = "default",
    ) -> VADResponse:
        """
        处理音频数据并返回 VAD 结果
        
        Args:
            audio_data: 音频数据（PCM 或 OPUS）
            audio_format: 音频格式 ("pcm" 或 "opus")
            sample_rate: 采样率（默认 16000）
            channels: 声道数（默认 1）
            session_id: 会话 ID（用于状态管理）
        
        Returns:
            VADResponse: VAD 检测结果
        """
        session = self._get_or_create_session(session_id)
        
        try:
            # 解码 OPUS 音频
            if audio_format.lower() == "opus":
                # 延迟初始化 OPUS 解码器
                if self.opus_decoder is None:
                    try:
                        self.opus_decoder = opuslib_next.Decoder(
                            self._decoder_sample_rate,
                            self._decoder_channels
                        )
                    except Exception as e:
                        logger.error(f"Failed to create OPUS decoder: {e}")
                        return VADResponse(
                            have_voice=session["have_voice"],
                            voice_stop=False,
                        )
                
                try:
                    pcm_data = self.opus_decoder.decode(audio_data, 960)
                    session["audio_buffer"].extend(pcm_data)
                except opuslib_next.OpusError as e:
                    logger.warning(f"OPUS decode error: {e}")
                    return VADResponse(
                        have_voice=session["have_voice"],
                        voice_stop=False,
                    )
            else:
                # PCM 格式直接使用
                session["audio_buffer"].extend(audio_data)
            
            # 处理缓冲区中的完整帧（每次处理 512 采样点 = 1024 字节）
            client_have_voice = False
            speech_prob = None
            
            while len(session["audio_buffer"]) >= 512 * 2:
                # 提取前 512 个采样点（1024 字节）
                chunk = bytes(session["audio_buffer"][:512 * 2])
                session["audio_buffer"] = session["audio_buffer"][512 * 2:]
                
                # 转换为模型需要的张量格式
                audio_int16 = np.frombuffer(chunk, dtype=np.int16)
                audio_float32 = audio_int16.astype(np.float32) / 32768.0
                audio_tensor = torch.from_numpy(audio_float32)
                
                # 检测语音活动
                # SileroVAD 模型需要输入形状为 [batch, samples] 或 [samples]
                # 确保输入格式正确
                if audio_tensor.dim() == 1:
                    audio_tensor = audio_tensor.unsqueeze(0)  # [1, 512]
                
                with torch.no_grad():
                    # SileroVAD 模型调用：model(audio_tensor, sample_rate)
                    # 返回形状通常是 [batch, 1] 或 [1]
                    output = self.model(audio_tensor, sample_rate)
                    # 处理不同的输出格式
                    if isinstance(output, torch.Tensor):
                        if output.dim() > 0:
                            prob = output.item() if output.numel() == 1 else output[0].item()
                        else:
                            prob = output.item()
                    else:
                        prob = float(output)
                    
                    if speech_prob is None:
                        speech_prob = prob
                
                # 双阈值判断
                if prob >= self.vad_threshold:
                    is_voice = True
                elif prob <= self.vad_threshold_low:
                    is_voice = False
                else:
                    # 在阈值之间，延续前一个状态
                    is_voice = session["last_is_voice"]
                
                session["last_is_voice"] = is_voice
                
                # 更新滑动窗口
                session["voice_window"].append(is_voice)
                # 保持窗口大小（只保留最近的 N 帧）
                if len(session["voice_window"]) > 10:
                    session["voice_window"] = session["voice_window"][-10:]
                
                # 判断是否有语音（滑动窗口中至少 threshold 帧有语音）
                client_have_voice = (
                    session["voice_window"].count(True) >= self.frame_window_threshold
                )
                
                # 检测语音结束（与 xiaozhi-esp32 逻辑一致）
                # 如果之前有声音，但本次没有声音，且与上次有声音的时间差已经超过了静默阈值，则认为已经说完一句话
                if session["have_voice"] and not client_have_voice:
                    current_time = time.time() * 1000
                    if session["last_activity_time"] > 0:
                        stop_duration = current_time - session["last_activity_time"]
                        if stop_duration >= self.silence_threshold_ms:
                            session["voice_stop"] = True
                
                # 更新状态
                if client_have_voice:
                    session["have_voice"] = True
                    session["last_activity_time"] = time.time() * 1000
                    session["voice_stop"] = False
                else:
                    session["have_voice"] = False
            
            # 返回结果（voice_stop 需要检查当前状态）
            voice_stop = session.get("voice_stop", False)
            # 如果检测到 voice_stop，重置标志以便下次检测
            if voice_stop:
                session["voice_stop"] = False
            
            return VADResponse(
                have_voice=client_have_voice,
                voice_stop=voice_stop,
                speech_prob=speech_prob,
            )
            
        except Exception as e:
            logger.error(f"Error processing audio: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")
    
    def reset_session(self, session_id: str):
        """重置会话状态"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Session {session_id} reset")


# 全局 VAD 服务实例
vad_service = SileroVADService()


@app.post("/vad", response_model=VADResponse)
async def vad_detect_json(request: VADRequest, session_id: str = "default"):
    """
    VAD 检测接口（JSON 格式，音频数据使用 Base64 编码）
    
    Args:
        request: VAD 请求（包含 Base64 编码的音频数据和格式信息）
        session_id: 会话 ID（用于状态管理，默认 "default"）
    
    Returns:
        VADResponse: VAD 检测结果
    """
    try:
        # 解码 Base64 音频数据
        try:
            audio_data = base64.b64decode(request.audio_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio data: {str(e)}")
        
        result = vad_service.process_audio(
            audio_data=audio_data,
            audio_format=request.audio_format,
            sample_rate=request.sample_rate,
            channels=request.channels,
            session_id=session_id,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VAD detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vad/upload", response_model=VADResponse)
async def vad_detect_upload(
    file: UploadFile = File(...),
    audio_format: str = Form("pcm"),
    sample_rate: int = Form(16000),
    channels: int = Form(1),
    session_id: str = Form("default"),
):
    """
    VAD 检测接口（文件上传格式，直接上传音频文件）
    
    Args:
        file: 音频文件（PCM 或 OPUS）
        audio_format: 音频格式（"pcm" 或 "opus"）
        sample_rate: 采样率（默认 16000）
        channels: 声道数（默认 1）
        session_id: 会话 ID（用于状态管理，默认 "default"）
    
    Returns:
        VADResponse: VAD 检测结果
    """
    try:
        audio_data = await file.read()
        result = vad_service.process_audio(
            audio_data=audio_data,
            audio_format=audio_format,
            sample_rate=sample_rate,
            channels=channels,
            session_id=session_id,
        )
        return result
    except Exception as e:
        logger.error(f"VAD detection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vad/reset")
async def reset_vad_session(session_id: str = "default"):
    """重置 VAD 会话状态"""
    vad_service.reset_session(session_id)
    return {"status": "ok", "message": f"Session {session_id} reset"}


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "healthy", "service": "SileroVAD"}


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=7073,
        log_level="info",
    )

