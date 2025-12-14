"""
测试 VAD 服务的脚本
"""
import base64
import requests
import numpy as np
import time

# 生成测试用的 PCM 音频数据（16kHz, 16-bit, 单声道）
def generate_test_audio(duration_ms=100, sample_rate=16000):
    """生成测试音频（静音）"""
    num_samples = int(sample_rate * duration_ms / 1000)
    # 生成静音（全0）或简单的正弦波
    audio = np.zeros(num_samples, dtype=np.int16)
    return audio.tobytes()

def test_vad_service():
    """测试 VAD 服务"""
    base_url = "http://localhost:7073"
    session_id = f"test_{int(time.time())}"
    
    # 1. 健康检查
    print("1. Testing health check...")
    resp = requests.get(f"{base_url}/health")
    print(f"   Health: {resp.json()}")
    assert resp.status_code == 200
    
    # 2. 测试 PCM 音频（静音）
    print("\n2. Testing PCM audio (silence)...")
    pcm_data = generate_test_audio(100)  # 100ms 静音
    pcm_base64 = base64.b64encode(pcm_data).decode('utf-8')
    
    payload = {
        "audio_data": pcm_base64,
        "audio_format": "pcm",
        "sample_rate": 16000,
        "channels": 1
    }
    
    resp = requests.post(
        f"{base_url}/vad?session_id={session_id}",
        json=payload
    )
    result = resp.json()
    print(f"   Result: {result}")
    assert "have_voice" in result
    assert "voice_stop" in result
    
    # 3. 测试多次调用（模拟流式处理）
    print("\n3. Testing multiple calls (streaming simulation)...")
    for i in range(5):
        pcm_data = generate_test_audio(100)
        pcm_base64 = base64.b64encode(pcm_data).decode('utf-8')
        payload["audio_data"] = pcm_base64
        
        resp = requests.post(
            f"{base_url}/vad?session_id={session_id}",
            json=payload
        )
        result = resp.json()
        print(f"   Call {i+1}: have_voice={result['have_voice']}, voice_stop={result['voice_stop']}")
        time.sleep(0.1)
    
    # 4. 重置会话
    print("\n4. Testing session reset...")
    resp = requests.post(f"{base_url}/vad/reset?session_id={session_id}")
    print(f"   Reset: {resp.json()}")
    assert resp.status_code == 200
    
    print("\n✅ All tests passed!")

if __name__ == "__main__":
    try:
        test_vad_service()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

