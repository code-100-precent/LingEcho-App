# ASR-TTS Service

ASR (语音识别) 和 TTS (文本转语音) 服务，基于 Whisper 和 edge-tts/pyttsx3。

## 功能特性

- **ASR (语音识别)**：
  - 使用 Whisper 进行语音识别
  - 支持多种模型（tiny/base/small/medium/large）
  - 支持多种音频格式（WAV, MP3, M4A 等）
  - 自动繁简转换
  - 支持文件上传和字节流两种方式

- **TTS (文本转语音)**：
  - 支持 edge-tts（推荐，更快）
  - 支持 pyttsx3（备用方案）
  - 支持多种中文语音
  - 支持文件输出和字节流两种方式

## 快速开始

### 1. 安装依赖

```bash
cd services/asr-tts-service
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 开发模式
python -m app.main

# 或使用 uvicorn
uvicorn app.application:app --host 0.0.0.0 --port 7075 --reload
```

### 3. 访问服务

- **服务地址**: http://localhost:7075
- **API 文档**: http://localhost:7075/docs
- **健康检查**: http://localhost:7075/api/v1/health

## API 端点

### ASR (语音识别)

#### POST `/api/v1/asr/transcribe`
识别上传的音频文件

**请求**:
- `file`: 音频文件（multipart/form-data）
- `model_name`: 模型名称（可选，默认 base）
- `language`: 语言代码（可选，默认 zh）
- `initial_prompt`: 初始提示词（可选）

**响应**:
```json
{
  "text": "识别出的文本",
  "language": "zh",
  "segments": []
}
```

#### POST `/api/v1/asr/transcribe/bytes`
识别音频字节数据

**请求**:
- `audio_data`: 音频字节数据（multipart/form-data）
- JSON body: `ASRRequest`

### TTS (文本转语音)

#### POST `/api/v1/tts/synthesize`
合成文本为语音

**请求**:
- `text`: 要合成的文本（form-data）
- `language`: 语言代码（可选，默认 zh）
- `use_edge_tts`: 是否使用 edge-tts（可选，默认 true）
- `voice`: 语音名称（可选）
- `return_file`: 是否返回文件路径（可选，默认 false）

**响应**:
- `return_file=true`: 返回 JSON，包含文件路径
- `return_file=false`: 返回音频字节流（WAV 格式）

#### GET `/api/v1/tts/voices`
获取可用的语音列表

### 健康检查

#### GET `/api/v1/health`
服务健康检查

## 配置

通过环境变量或 `.env` 文件配置：

```env
HOST=0.0.0.0
PORT=7075
DEFAULT_ASR_MODEL=base
ASR_LANGUAGE=zh
DEFAULT_TTS_ENGINE=edge-tts
DEFAULT_TTS_VOICE=zh-CN-XiaoxiaoNeural
MAX_UPLOAD_SIZE=52428800
LOG_LEVEL=INFO
```

## Docker 部署

### 构建镜像

```bash
docker build -t asr-tts-service .
```

### 运行容器

```bash
docker run -d \
  --name asr-tts-service \
  -p 7075:7075 \
  asr-tts-service
```

### 使用 docker-compose

```bash
docker-compose up -d
```

## 注意事项

1. **Whisper 模型**：首次使用时会自动下载模型，可能需要一些时间
2. **ffmpeg**：Whisper 需要 ffmpeg，确保系统已安装
3. **内存占用**：较大的模型（如 large）会占用较多内存
4. **edge-tts**：需要网络连接才能使用

## 开发

### 项目结构

```
services/asr-tts-service/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── asr.py      # ASR API
│   │       ├── tts.py      # TTS API
│   │       ├── health.py   # 健康检查
│   │       └── api.py      # 路由聚合
│   ├── core/
│   │   ├── config.py       # 配置
│   │   └── logger.py       # 日志
│   ├── services/
│   │   ├── asr_service.py  # ASR 服务
│   │   └── tts_service.py # TTS 服务
│   ├── application.py      # FastAPI 应用
│   └── main.py             # 启动入口
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 许可证

与主项目相同

