"""
SileroVAD gRPC Service - 独立的语音活动检测服务（gRPC 版本）
基于 xiaozhi-esp32 的 SileroVAD 实现
"""
import grpc
from concurrent import futures
import time
import numpy as np
import torch
import opuslib_next
import logging

# 导入生成的 gRPC 代码（需要先运行 protoc 生成）
# from vad_pb2 import VADRequest, VADResponse
# from vad_pb2_grpc import VADServiceServicer, add_VADServiceServicer_to_server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SileroVADService:
    """SileroVAD 服务类（与 HTTP 版本相同）"""
    
    def __init__(
        self,
        model_dir: str = "rtcmedia/snakers4_silero-vad",
        threshold: float = 0.5,
        threshold_low: float = 0.2,
        min_silence_duration_ms: int = 1000,
        frame_window_threshold: int = 3,
    ):
        logger.info(f"Loading SileroVAD model from {model_dir}")
        self.model, _ = torch.hub.load(
            repo_or_dir=model_dir,
            source="local",
            model="silero_vad",
            force_reload=False,
        )
        self.model.eval()
        
        self.opus_decoder = opuslib_next.Decoder(16000, 1)
        self.vad_threshold = threshold
        self.vad_threshold_low = threshold_low
        self.silence_threshold_ms = min_silence_duration_ms
        self.frame_window_threshold = frame_window_threshold
        self.sessions = {}
        
        logger.info("SileroVAD gRPC service initialized successfully")
    
    def _get_or_create_session(self, session_id: str):
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
    ):
        """处理音频数据（与 HTTP 版本相同的逻辑）"""
        session = self._get_or_create_session(session_id)
        
        try:
            if audio_format.lower() == "opus":
                try:
                    pcm_data = self.opus_decoder.decode(audio_data, 960)
                    session["audio_buffer"].extend(pcm_data)
                except opuslib_next.OpusError as e:
                    logger.warning(f"OPUS decode error: {e}")
                    return {
                        "have_voice": session["have_voice"],
                        "voice_stop": False,
                        "speech_prob": None,
                    }
            else:
                session["audio_buffer"].extend(audio_data)
            
            client_have_voice = False
            speech_prob = None
            
            while len(session["audio_buffer"]) >= 512 * 2:
                chunk = bytes(session["audio_buffer"][:512 * 2])
                session["audio_buffer"] = session["audio_buffer"][512 * 2:]
                
                audio_int16 = np.frombuffer(chunk, dtype=np.int16)
                audio_float32 = audio_int16.astype(np.float32) / 32768.0
                audio_tensor = torch.from_numpy(audio_float32)
                
                with torch.no_grad():
                    prob = self.model(audio_tensor, sample_rate).item()
                    if speech_prob is None:
                        speech_prob = prob
                
                if prob >= self.vad_threshold:
                    is_voice = True
                elif prob <= self.vad_threshold_low:
                    is_voice = False
                else:
                    is_voice = session["last_is_voice"]
                
                session["last_is_voice"] = is_voice
                session["voice_window"].append(is_voice)
                if len(session["voice_window"]) > 10:
                    session["voice_window"] = session["voice_window"][-10:]
                
                client_have_voice = (
                    session["voice_window"].count(True) >= self.frame_window_threshold
                )
                
                voice_stop = False
                if session["have_voice"] and not client_have_voice:
                    current_time = time.time() * 1000
                    if session["last_activity_time"] > 0:
                        stop_duration = current_time - session["last_activity_time"]
                        if stop_duration >= self.silence_threshold_ms:
                            voice_stop = True
                            session["voice_stop"] = True
                
                if client_have_voice:
                    session["have_voice"] = True
                    session["last_activity_time"] = time.time() * 1000
                    session["voice_stop"] = False
                else:
                    session["have_voice"] = False
            
            return {
                "have_voice": client_have_voice,
                "voice_stop": session.get("voice_stop", False),
                "speech_prob": speech_prob,
            }
            
        except Exception as e:
            logger.error(f"Error processing audio: {e}", exc_info=True)
            raise


# 注意：需要先定义 .proto 文件并生成 Python 代码
# 这里只是示例结构
"""
class VADService(VADServiceServicer):
    def __init__(self):
        self.vad_service = SileroVADService()
    
    def Detect(self, request, context):
        result = self.vad_service.process_audio(
            audio_data=request.audio_data,
            audio_format=request.audio_format,
            sample_rate=request.sample_rate,
            channels=request.channels,
            session_id=request.session_id,
        )
        return VADResponse(
            have_voice=result["have_voice"],
            voice_stop=result["voice_stop"],
            speech_prob=result.get("speech_prob", 0.0),
        )


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    add_VADServiceServicer_to_server(VADService(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    logger.info("VAD gRPC server started on port 50051")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
"""

