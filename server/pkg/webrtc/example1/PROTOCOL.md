# WebRTC + WebSocket 语音AI交互协议规范

## 📋 目录

1. [概述](#概述)
2. [协议架构](#协议架构)
3. [连接建立流程](#连接建立流程)
4. [消息格式定义](#消息格式定义)
5. [状态机定义](#状态机定义)
6. [错误处理](#错误处理)
7. [示例流程](#示例流程)

---

## 概述

本协议定义了基于 WebRTC 和 WebSocket 的语音AI交互系统的完整通信规范。

### 核心组件

- **WebSocket**: 用于信令传输和文本消息交互
- **WebRTC**: 用于实时音频传输（双向）
- **信令服务器**: 处理 WebRTC 连接协商
- **AI服务**: 处理语音识别、文本理解和语音合成

### 通信模式

1. **信令通道 (WebSocket)**: 
   - WebRTC 连接建立和协商
   - 文本消息传输（用户输入、AI回复）
   - 系统控制消息

2. **媒体通道 (WebRTC)**:
   - 客户端 → 服务器：用户语音输入
   - 服务器 → 客户端：AI语音回复

---

## 协议架构

```
┌─────────────┐                    ┌─────────────┐
│   Browser   │                    │  Go Server  │
│   Client    │                    │             │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │  ┌─────────────────────────────┐ │
       │  │   WebSocket (信令通道)        │ │
       │  │   - 连接建立                  │ │
       │  │   - WebRTC协商                │ │
       │  │   - 文本消息                  │ │
       │  └─────────────────────────────┘ │
       │                                   │
       │  ┌─────────────────────────────┐ │
       │  │   WebRTC (媒体通道)          │ │
       │  │   - 音频传输 (双向)           │ │
       │  └─────────────────────────────┘ │
       │                                   │
```

---

## 连接建立流程

### 阶段1: WebSocket 连接建立

```
Client                          Server
  │                               │
  │─── WebSocket Connect ────────>│
  │                               │
  │<─── init (session_id) ───────│
  │                               │
```

### 阶段2: WebRTC 连接建立

```
Client                          Server
  │                               │
  │─── offer (SDP + candidates) ─>│
  │                               │
  │<─── answer (SDP + candidates) ─│
  │                               │
  │─── ICE candidates ───────────>│
  │<─── ICE candidates ───────────│
  │                               │
  │<─── connected ────────────────│
  │                               │
```

### 阶段3: 媒体传输就绪

```
Client                          Server
  │                               │
  │─── ready ────────────────────>│
  │                               │
  │<─── ready ────────────────────│
  │                               │
  │  [开始音频传输]                │
  │                               │
```

---

## 消息格式定义

### 基础消息结构

所有 WebSocket 消息都遵循以下 JSON 格式：

```json
{
  "type": "message_type",
  "session_id": "session_xxx",
  "timestamp": 1234567890,
  "data": {},
  "error": null
}
```

### 消息类型定义

#### 1. 连接管理消息

##### `init` - 初始化消息（服务器 → 客户端）

服务器在 WebSocket 连接建立后立即发送。

```json
{
  "type": "init",
  "session_id": "session_1703123456789",
  "timestamp": 1703123456789,
  "data": {
    "server_version": "1.0.0",
    "supported_codecs": ["pcma", "opus"],
    "max_audio_duration": 30000
  }
}
```

##### `connected` - 连接确认（双向）

WebRTC 连接建立成功后发送。

```json
{
  "type": "connected",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "connection_state": "connected",
    "audio_codec": "pcma",
    "sample_rate": 8000
  }
}
```

##### `disconnect` - 断开连接（双向）

```json
{
  "type": "disconnect",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "reason": "user_requested" | "timeout" | "error"
  }
}
```

#### 2. WebRTC 信令消息

##### `offer` - WebRTC Offer（客户端 → 服务器）

```json
{
  "type": "offer",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "sdp": "v=0\r\no=- 123456789 2 IN IP4...",
    "candidates": [
      "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
      "candidate:2 1 UDP 1694498815 203.0.113.1 54322 typ srflx"
    ]
  }
}
```

##### `answer` - WebRTC Answer（服务器 → 客户端）

```json
{
  "type": "answer",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "sdp": "v=0\r\no=- 987654321 2 IN IP4...",
    "candidates": [
      "candidate:1 1 UDP 2130706431 192.168.1.200 54323 typ host"
    ]
  }
}
```

##### `ice_candidate` - ICE 候选者（双向）

```json
{
  "type": "ice_candidate",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
    "sdp_mid": "0",
    "sdp_mline_index": 0
  }
}
```

#### 3. 文本消息（AI交互）

##### `text_message` - 文本消息（客户端 → 服务器）

用户发送文本消息给AI。

```json
{
  "type": "text_message",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "message_id": "msg_001",
    "text": "你好，我想了解一下产品信息",
    "language": "zh-CN"
  }
}
```

##### `text_response` - AI文本回复（服务器 → 客户端）

AI返回文本回复。

```json
{
  "type": "text_response",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "message_id": "msg_001",
    "response_id": "resp_001",
    "text": "您好！很高兴为您服务。请问您想了解哪方面的产品信息？",
    "language": "zh-CN",
    "confidence": 0.95
  }
}
```

#### 4. 语音识别消息

##### `asr_start` - 开始语音识别（客户端 → 服务器）

通知服务器开始接收音频进行识别。

```json
{
  "type": "asr_start",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "language": "zh-CN",
    "format": "pcma",
    "sample_rate": 8000
  }
}
```

##### `asr_result` - 语音识别结果（服务器 → 客户端）

```json
{
  "type": "asr_result",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "result_id": "asr_001",
    "text": "你好，我想了解一下产品信息",
    "is_final": true,
    "confidence": 0.92,
    "language": "zh-CN",
    "start_time": 0,
    "end_time": 2500
  }
}
```

##### `asr_interim` - 临时识别结果（服务器 → 客户端）

```json
{
  "type": "asr_interim",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "result_id": "asr_001",
    "text": "你好，我想",
    "is_final": false,
    "confidence": 0.85
  }
}
```

##### `asr_stop` - 停止语音识别（客户端 → 服务器）

```json
{
  "type": "asr_stop",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {}
}
```

#### 5. 语音合成消息

##### `tts_request` - 请求语音合成（客户端 → 服务器）

```json
{
  "type": "tts_request",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "request_id": "tts_001",
    "text": "您好！很高兴为您服务。",
    "voice": "female_zh",
    "speed": 1.0,
    "pitch": 1.0
  }
}
```

##### `tts_start` - 开始播放TTS（服务器 → 客户端）

```json
{
  "type": "tts_start",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "request_id": "tts_001",
    "audio_format": "pcma",
    "sample_rate": 8000
  }
}
```

##### `tts_complete` - TTS播放完成（服务器 → 客户端）

```json
{
  "type": "tts_complete",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "request_id": "tts_001",
    "duration_ms": 2500
  }
}
```

#### 6. 控制消息

##### `ready` - 准备就绪（双向）

表示WebRTC连接已建立，可以开始传输音频。

```json
{
  "type": "ready",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "direction": "send" | "receive" | "both"
  }
}
```

##### `ping` - 心跳检测（双向）

```json
{
  "type": "ping",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {}
}
```

##### `pong` - 心跳响应（双向）

```json
{
  "type": "pong",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "server_time": 1703123456789
  }
}
```

##### `error` - 错误消息（双向）

```json
{
  "type": "error",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  }
}
```

---

## 状态机定义

### 客户端状态机

```
[Disconnected]
    │
    │ WebSocket Connect
    ▼
[Connecting]
    │
    │ Receive init
    ▼
[Initialized]
    │
    │ Send offer
    ▼
[Offer Sent]
    │
    │ Receive answer
    ▼
[Answer Received]
    │
    │ Exchange ICE candidates
    │ WebRTC Connected
    ▼
[WebRTC Connected]
    │
    │ Send/Receive ready
    ▼
[Ready]
    │
    │ Start audio transmission
    ▼
[Active]
    │
    │ Disconnect
    ▼
[Disconnected]
```

### 服务器状态机

```
[Waiting]
    │
    │ WebSocket Connect
    │ Send init
    ▼
[Initialized]
    │
    │ Receive offer
    ▼
[Offer Received]
    │
    │ Send answer
    ▼
[Answer Sent]
    │
    │ Exchange ICE candidates
    │ WebRTC Connected
    ▼
[WebRTC Connected]
    │
    │ Receive/Send ready
    ▼
[Ready]
    │
    │ Start audio processing
    ▼
[Active]
    │
    │ Disconnect
    ▼
[Waiting]
```

---

## 错误处理

### 错误代码定义

| 错误代码 | 描述 | 处理方式 |
|---------|------|---------|
| `ERR_CONNECTION_FAILED` | 连接失败 | 客户端重试连接 |
| `ERR_INVALID_MESSAGE` | 无效消息格式 | 忽略消息，记录日志 |
| `ERR_SESSION_NOT_FOUND` | 会话不存在 | 重新建立连接 |
| `ERR_WEBRTC_FAILED` | WebRTC连接失败 | 重新协商 |
| `ERR_AUDIO_ENCODE_FAILED` | 音频编码失败 | 停止音频传输 |
| `ERR_ASR_FAILED` | 语音识别失败 | 继续接收，记录错误 |
| `ERR_TTS_FAILED` | 语音合成失败 | 返回文本消息 |
| `ERR_TIMEOUT` | 操作超时 | 重试或断开连接 |
| `ERR_RATE_LIMIT` | 请求频率过高 | 客户端降低请求频率 |

### 错误消息格式

```json
{
  "type": "error",
  "session_id": "session_xxx",
  "timestamp": 1703123456789,
  "data": {
    "code": "ERR_WEBRTC_FAILED",
    "message": "WebRTC connection failed",
    "details": {
      "error_type": "ice_connection_failed",
      "retry_after": 5000
    }
  }
}
```

---

## 示例流程

### 完整交互流程示例

#### 1. 连接建立

```
Client                          Server
  │                               │
  │─── WebSocket Connect ────────>│
  │                               │
  │<─── init ─────────────────────│
  │   {session_id: "sess_001"}    │
  │                               │
  │─── offer ────────────────────>│
  │   {sdp, candidates}           │
  │                               │
  │<─── answer ───────────────────│
  │   {sdp, candidates}           │
  │                               │
  │─── ice_candidate ────────────>│
  │<─── ice_candidate ────────────│
  │                               │
  │<─── connected ────────────────│
  │─── ready ────────────────────>│
  │<─── ready ────────────────────│
  │                               │
```

#### 2. 语音交互流程

```
Client                          Server
  │                               │
  │─── asr_start ────────────────>│
  │                               │
  │  [WebRTC Audio Stream] ──────>│
  │                               │
  │<─── asr_interim ──────────────│
  │   {text: "你好"}              │
  │                               │
  │<─── asr_result ───────────────│
  │   {text: "你好，我想了解"}    │
  │                               │
  │─── asr_stop ─────────────────>│
  │                               │
  │                               │ [AI Processing]
  │                               │
  │<─── text_response ────────────│
  │   {text: "您好！很高兴..."}   │
  │                               │
  │<─── tts_start ────────────────│
  │                               │
  │<─── [WebRTC Audio Stream] ────│
  │                               │
  │<─── tts_complete ─────────────│
  │                               │
```

#### 3. 文本交互流程

```
Client                          Server
  │                               │
  │─── text_message ──────────────>│
  │   {text: "产品价格是多少？"}  │
  │                               │
  │                               │ [AI Processing]
  │                               │
  │<─── text_response ────────────│
  │   {text: "产品价格是..."}     │
  │                               │
```

---

## 实现建议

### 客户端实现要点

1. **连接管理**
   - 实现自动重连机制
   - 处理网络中断和恢复
   - 维护连接状态

2. **消息处理**
   - 实现消息队列
   - 处理消息超时
   - 实现消息重试机制

3. **WebRTC管理**
   - 监控连接状态
   - 处理ICE连接失败
   - 实现音频流控制

4. **错误处理**
   - 实现错误恢复机制
   - 用户友好的错误提示
   - 日志记录

### 服务器实现要点

1. **会话管理**
   - 维护客户端会话
   - 实现会话超时清理
   - 处理并发连接

2. **音频处理**
   - 音频流接收和缓冲
   - 实时语音识别
   - 音频编码和传输

3. **AI集成**
   - 文本理解处理
   - 语音合成管理
   - 响应队列管理

4. **性能优化**
   - 音频流缓冲优化
   - 并发处理优化
   - 资源清理

---

## 安全考虑

1. **认证授权**
   - WebSocket连接需要token验证
   - 会话ID需要加密
   - 实现访问频率限制

2. **数据安全**
   - 敏感数据加密传输
   - 音频数据隐私保护
   - 日志脱敏处理

3. **防护措施**
   - DDoS防护
   - 输入验证
   - SQL注入防护

---

## 版本管理

协议版本通过 `server_version` 字段在 `init` 消息中传递。

当前版本: **v1.0.0**

### 版本兼容性

- 主版本号变更：不兼容的协议变更
- 次版本号变更：向后兼容的功能添加
- 修订版本号变更：向后兼容的bug修复

---

## 附录

### A. 消息类型速查表

| 类型 | 方向 | 说明 |
|------|------|------|
| `init` | S→C | 初始化消息 |
| `offer` | C→S | WebRTC Offer |
| `answer` | S→C | WebRTC Answer |
| `ice_candidate` | 双向 | ICE候选者 |
| `connected` | 双向 | 连接确认 |
| `ready` | 双向 | 准备就绪 |
| `text_message` | C→S | 文本消息 |
| `text_response` | S→C | 文本回复 |
| `asr_start` | C→S | 开始识别 |
| `asr_result` | S→C | 识别结果 |
| `asr_interim` | S→C | 临时结果 |
| `asr_stop` | C→S | 停止识别 |
| `tts_request` | C→S | TTS请求 |
| `tts_start` | S→C | TTS开始 |
| `tts_complete` | S→C | TTS完成 |
| `ping` | 双向 | 心跳 |
| `pong` | 双向 | 心跳响应 |
| `error` | 双向 | 错误消息 |
| `disconnect` | 双向 | 断开连接 |

### B. 音频格式规范

- **编码格式**: PCMA (G.711 A-law) 或 OPUS
- **采样率**: 8000 Hz (PCMA) 或 16000/48000 Hz (OPUS)
- **声道**: 单声道 (Mono)
- **位深度**: 8-bit (PCMA) 或 16-bit (OPUS)
- **帧大小**: 20ms

### C. 时间戳规范

- 所有时间戳使用 Unix 毫秒时间戳
- 客户端和服务器时间需要同步（NTP）
- 相对时间使用毫秒为单位

---

**文档版本**: 1.0.0  
**最后更新**: 2024-01-XX  
**维护者**: LingEcho Team

