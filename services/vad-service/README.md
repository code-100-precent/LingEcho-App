# SileroVAD Service

独立的语音活动检测（VAD）服务，基于 xiaozhi-esp32 的 SileroVAD 实现。

## 功能特性

- ✅ 支持 PCM 和 OPUS 音频格式输入
- ✅ 16kHz 单声道音频处理
- ✅ 输出 `have_voice` 和 `voice_stop` 状态
- ✅ HTTP RESTful API
- ✅ gRPC 接口（可选）
- ✅ 会话状态管理
- ✅ 双阈值检测机制

## 安装

```bash
cd services/vad-service

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

**注意：** 如果使用 Python 3.14+，依赖版本已更新为兼容版本。如果仍有问题，可以尝试：
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

## 配置

### 下载 SileroVAD 模型

**重要：** 本服务使用 JIT 模型（.jit 文件），**不需要** `silero-vad` 包和 `onnxruntime`，只需要 `torch`。

确保 SileroVAD 模型已下载。可以通过以下方式获取：

1. **自动下载（推荐）**：
   ```bash
   python download_model.py
   ```
   这会使用 `torch.hub` 从 GitHub 下载模型。

2. **从 xiaozhi-esp32 项目复制**（如果已有）：
   ```bash
   mkdir -p rtcmedia/snakers4_silero-vad/src/silero_vad/data
   cp xiaozhi-esp32-server-main/main/xiaozhi-server/models/snakers4_silero-vad/src/silero_vad/data/silero_vad.jit \
      rtcmedia/snakers4_silero-vad/src/silero_vad/data/
   ```

3. **手动下载**：
   - 访问 [SileroVAD GitHub Releases](https://github.com/snakers4/silero-vad/releases)
   - 下载 `silero_vad.jit` 文件
   - 放置到 `rtcmedia/snakers4_silero-vad/src/silero_vad/data/silero_vad.jit`

4. **使用 torch.hub 在代码中自动下载**：
   服务启动时会自动尝试下载（如果模型不存在）。

## 运行 HTTP 服务

```bash
python vad_service.py
```

服务将在 `http://0.0.0.0:7073` 启动。

**注意：** 默认端口已改为 7073。

## API 文档

### POST /vad

检测音频中的语音活动。

**请求参数：**
- `audio_data` (bytes): 音频数据（Base64 编码或直接 bytes）
- `audio_format` (string): 音频格式，`"pcm"` 或 `"opus"`（默认：`"pcm"`）
- `sample_rate` (int): 采样率（默认：16000）
- `channels` (int): 声道数（默认：1）
- `session_id` (query param): 会话 ID（用于状态管理，默认：`"default"`）

**响应：**
```json
{
  "have_voice": true,
  "voice_stop": false,
  "speech_prob": 0.85
}
```

**示例（使用 curl）：**

方式 1：JSON 格式（Base64 编码）
```bash
# PCM 格式
curl -X POST "http://localhost:7073/vad?session_id=test123" \
  -H "Content-Type: application/json" \
  -d '{
    "audio_data": "<base64_encoded_pcm_data>",
    "audio_format": "pcm",
    "sample_rate": 16000,
    "channels": 1
  }'

# OPUS 格式
curl -X POST "http://localhost:7073/vad?session_id=test123" \
  -H "Content-Type: application/json" \
  -d '{
    "audio_data": "<base64_encoded_opus_data>",
    "audio_format": "opus",
    "sample_rate": 16000,
    "channels": 1
  }'
```

方式 2：文件上传格式
```bash
# 直接上传音频文件
curl -X POST "http://localhost:7073/vad/upload?session_id=test123" \
  -F "file=@audio.pcm" \
  -F "audio_format=pcm" \
  -F "sample_rate=16000" \
  -F "channels=1"
```

### POST /vad/reset

重置会话状态。

**参数：**
- `session_id` (query param): 会话 ID

**响应：**
```json
{
  "status": "ok",
  "message": "Session test123 reset"
}
```

### GET /health

健康检查。

**响应：**
```json
{
  "status": "healthy",
  "service": "SileroVAD"
}
```

## gRPC 服务（可选）

### 生成 gRPC 代码

```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. vad.proto
```

### 运行 gRPC 服务

```bash
python vad_service_grpc.py
```

## 在 Go 后端中使用

### 使用测试客户端

```bash
# 编译测试客户端
go build -o test_client test_client.go

# 运行测试（确保 VAD 服务已启动）
./test_client

# 使用音频文件测试
./test_client audio.pcm
```

### HTTP 客户端示例

完整实现请参考 `test_client.go` 或 `client_example.go`。

简单示例：
```go
package main

import (
    "bytes"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type VADRequest struct {
    AudioData   string `json:"audio_data"`   // Base64 编码
    AudioFormat string `json:"audio_format"` // "pcm" 或 "opus"
    SampleRate  int    `json:"sample_rate"`
    Channels    int    `json:"channels"`
}

type VADResponse struct {
    HaveVoice  bool    `json:"have_voice"`
    VoiceStop  bool    `json:"voice_stop"`
    SpeechProb float64 `json:"speech_prob,omitempty"`
}

func DetectVAD(audioData []byte, format string, sessionID string) (*VADResponse, error) {
    // Base64 编码音频数据
    audioBase64 := base64.StdEncoding.EncodeToString(audioData)
    
    req := VADRequest{
        AudioData:   audioBase64,
        AudioFormat: format,
        SampleRate:  16000,
        Channels:    1,
    }
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }
    
    url := fmt.Sprintf("http://localhost:7073/vad?session_id=%s", sessionID)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var vadResp VADResponse
    if err := json.Unmarshal(body, &vadResp); err != nil {
        return nil, err
    }
    
    return &vadResp, nil
}
```

## 配置参数

可以通过修改 `SileroVADService` 初始化参数来调整检测行为：

- `threshold` (默认 0.5): 语音检测高阈值
- `threshold_low` (默认 0.2): 语音检测低阈值
- `min_silence_duration_ms` (默认 1000): 最小静默持续时间（毫秒）
- `frame_window_threshold` (默认 3): 滑动窗口中至少需要多少帧有语音

## 测试

运行测试脚本验证服务是否正常工作：

```bash
# 确保服务已启动
python vad_service.py

# 在另一个终端运行测试
python test_vad.py
```

## VAD 算法说明

本服务完整实现了 SileroVAD 算法，包括：

1. **模型推理**：使用 SileroVAD 模型对音频帧进行语音概率预测
2. **双阈值检测**：
   - 高阈值（默认 0.5）：超过此值认为有语音
   - 低阈值（默认 0.2）：低于此值认为无语音
   - 中间值：延续前一帧的状态（防止抖动）
3. **滑动窗口**：使用滑动窗口平滑检测结果，减少误判
4. **静默检测**：检测连续静默时间，判断一句话是否结束（`voice_stop`）

算法逻辑与 xiaozhi-esp32 中的实现完全一致。

## 注意事项

1. 确保音频数据是 16kHz、单声道格式
2. PCM 数据应该是 16-bit 小端格式
3. OPUS 数据需要是 16kHz 单声道编码
4. 使用不同的 `session_id` 来管理多个独立的会话状态
5. 每次处理 512 个采样点（32ms @ 16kHz），不足的数据会缓冲等待

## Docker 部署

```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7073

CMD ["python", "vad_service.py"]
```

## 许可证

与主项目保持一致。

