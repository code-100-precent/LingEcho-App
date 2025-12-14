# pkg/voicev2 WebSocket 信息交互流程文档

## 目录

1. [概述](#概述)
2. [连接建立流程](#连接建立流程)
3. [消息类型定义](#消息类型定义)
4. [音频处理流程（ASR）](#音频处理流程asr)
5. [LLM处理流程](#llm处理流程)
6. [TTS处理流程](#tts处理流程)
7. [文本消息处理](#文本消息处理)
8. [错误处理机制](#错误处理机制)
9. [状态管理](#状态管理)
10. [完整交互时序图](#完整交互时序图)

---

## 概述

`pkg/voicev2` 实现了一个完整的实时语音对话系统，通过 WebSocket 协议进行双向通信。系统包含三个核心服务：

- **ASR (Automatic Speech Recognition)**: 语音识别服务
- **LLM (Large Language Model)**: 大语言模型服务
- **TTS (Text-to-Speech)**: 语音合成服务

### 架构特点

- **异步消息处理**: 使用消息队列实现异步处理，避免阻塞
- **流式处理**: LLM 和 TTS 都支持流式处理，降低延迟
- **增量更新**: ASR 结果和 LLM 响应都支持增量更新
- **状态管理**: 统一的状态管理，确保处理顺序和一致性

---

## 连接建立流程

### 1. WebSocket 连接初始化

```
客户端 → 服务端: WebSocket 握手
服务端 → 客户端: 连接建立
```

### 2. 服务初始化步骤

```
1. 创建 VoiceClient 实例
   ├─ 初始化上下文 (context.Context)
   ├─ 创建消息写入器 (MessageWriter)
   └─ 从数据库加载 Assistant 配置（LLM模型、温度、最大Token数）

2. 初始化服务
   ├─ 初始化 ASR 服务 (根据 credential 和 language)
   ├─ 初始化 TTS 服务 (根据 credential 和 speaker)
   └─ 初始化 LLM 服务 (根据 credential 和 systemPrompt)

3. 建立 ASR 连接
   ├─ 设置 ASR 回调函数
   │  ├─ 识别结果回调 (HandleResult)
   │  └─ 错误回调 (HandleError)
   └─ 启动 ASR 接收 goroutine (ConnAndReceive)

4. 启动 TTS 队列处理器
   └─ 启动独立的 goroutine 处理 TTS 任务队列

5. 等待 ASR 连接建立 (DefaultASRConnectionDelay = 500ms)

6. 发送连接成功消息
   服务端 → 客户端: {"type": "connected", "message": "WebSocket voice connection established"}
```

### 3. 消息循环启动

```
启动三个独立的 goroutine:
├─ 主循环: 接收 WebSocket 消息并分发到队列
├─ 音频处理: 从 audioChan 读取音频数据并发送到 ASR
└─ 文本处理: 从 textChan 读取文本消息并处理
```

---

## 消息类型定义

### 客户端 → 服务端

| 消息类型 | 格式 | 说明 |
|---------|------|------|
| **BinaryMessage** | `[]byte` | 音频数据（PCM格式） |
| **TextMessage** | JSON | 文本控制消息 |

#### TextMessage 类型

```json
// 新会话请求
{
  "type": "new_session"
}

// 心跳请求
{
  "type": "ping"
}
```

### 服务端 → 客户端

| 消息类型 | 格式 | 说明 |
|---------|------|------|
| **connected** | JSON | 连接成功通知 |
| **error** | JSON | 错误消息 |
| **asr_result** | JSON | ASR识别结果（增量） |
| **llm_response** | JSON | LLM响应（增量） |
| **tts_start** | JSON | TTS合成开始 |
| **tts_end** | JSON | TTS合成结束 |
| **session_cleared** | JSON | 会话已清除 |
| **pong** | JSON | 心跳响应 |
| **BinaryMessage** | `[]byte` | TTS音频数据 |

#### JSON 消息格式

```json
// connected
{
  "type": "connected",
  "message": "WebSocket voice connection established"
}

// error
{
  "type": "error",
  "message": "错误描述",
  "fatal": true/false
}

// asr_result
{
  "type": "asr_result",
  "text": "识别的文本"
}

// llm_response (增量)
{
  "type": "llm_response",
  "text": "LLM响应的片段"
}

// tts_start
{
  "type": "tts_start",
  "sampleRate": 16000,
  "channels": 1,
  "bitDepth": 16
}

// tts_end
{
  "type": "tts_end"
}

// session_cleared
{
  "type": "session_cleared",
  "message": "Conversation history and ASR status cleared"
}

// pong
{
  "type": "pong"
}
```

---

## 音频处理流程（ASR）

### 1. 音频数据接收

```
客户端 → 服务端: BinaryMessage (音频数据)
         ↓
    主消息循环
         ↓
    分发到 audioChan (缓冲队列，容量100)
         ↓
    音频处理 goroutine
```

### 2. 音频数据发送到 ASR

```
音频处理 goroutine
    ↓
检查状态:
├─ 是否正在处理致命错误? → 忽略
├─ 客户端是否激活? → 忽略
├─ TTS是否正在播放? → 忽略（防止TTS音频被识别）
└─ 通过检查 → 发送到 ASR 服务
```

### 3. ASR 识别结果处理

ASR 服务通过回调函数返回识别结果，有三种类型的回调：

#### 3.1 中间结果 (isLast=false, OnRecognitionResultChange)

```
ASR 服务 → HandleResult(text, isLast=false)
    ↓
更新累积文本 (SetLastText)
    ↓
检查是否是完整句子?
├─ 否 → 只累积，不发送，不处理
└─ 是 → 提取增量句子
         ↓
    过滤无意义文本
         ↓
    发送增量句子到前端
         ↓
    立即处理（调用LLM和TTS）
```

#### 3.2 完整句子 (isLast=false, OnSentenceEnd)

```
ASR 服务 → HandleResult(text, isLast=false, 包含句号)
    ↓
从累积文本中提取增量部分
    ↓
过滤无意义文本
    ↓
发送增量句子到前端: {"type": "asr_result", "text": "你好"}
    ↓
立即处理（调用LLM和TTS）
```

#### 3.3 最终结果 (isLast=true, OnRecognitionComplete)

```
ASR 服务 → HandleResult(text, isLast=true)
    ↓
检查是否已处理过? → 是则跳过
    ↓
停止静音计时器
    ↓
提取增量部分（相对于已处理的累积文本）
    ↓
过滤无意义文本
    ↓
发送最终结果到前端: {"type": "asr_result", "text": "你好，我是用户"}
    ↓
立即处理（调用LLM和TTS）
    ↓
清空累积文本，准备下次识别
```

### 4. ASR 错误处理

```
ASR 错误回调
    ↓
检查错误类型:
├─ 致命错误（额度不足等）→ HandleFatalError
└─ 普通错误 → 发送错误消息到前端
```

### 5. ASR 服务重启

```
检测到 "not running" 错误
    ↓
检查服务是否真的需要重启
    ↓
调用 RestartClient()
    ↓
记录日志: "ASR服务已重启"
```

---

## LLM处理流程

### 1. 触发LLM查询

```
ASR识别到完整句子
    ↓
TextProcessor.Process(text)
    ↓
检查状态:
├─ 是否正在处理致命错误? → 跳过
├─ 是否正在处理? → 跳过
├─ 是否已处理过? → 跳过
└─ 通过检查 → 继续
```

### 2. 知识库检索（可选）

```
如果配置了 knowledgeKey:
    ↓
搜索知识库 (SearchKnowledgeBase)
    ↓
构建增强查询文本:
    "用户问题: {text}\n\n{知识库内容1}\n\n{知识库内容2}...\n\n请基于以上信息回答..."
```

### 3. 构建系统提示词

```
基础 systemPrompt
    ↓
如果设置了 maxTokens:
    ↓
添加长度限制提示:
    "重要提示：你的回复有长度限制（约 {estimatedChars} 个字符）..."
```

### 4. 流式LLM查询

```
调用 LLM.QueryStream(query, options, callback)
    ↓
对每个响应片段 (segment):
    ├─ 累积到 fullResponse
    ├─ 发送增量响应到前端: {"type": "llm_response", "text": "你好"}
    ├─ 添加到句子缓冲区 (sentenceBuffer)
    └─ 处理句子缓冲区 (提取完整句子)
         ↓
    检测到完整句子?
         ↓
    过滤 emoji
         ↓
    加入 TTS 队列
```

### 5. 句子处理逻辑

```
processSentenceBuffer:
    ↓
循环处理:
├─ 提取第一个完整句子（包含句号等）
├─ 过滤 emoji
├─ 加入 TTS 队列
└─ 从缓冲区移除已处理句子
```

### 6. LLM响应完成处理

```
isComplete = true
    ↓
处理剩余文本:
├─ 如果 sentenceBuffer 有内容 → 过滤并加入 TTS 队列
└─ 如果 sentenceBuffer 为空但 fullResponse 有内容 → 使用完整响应
```

---

## TTS处理流程

### 1. TTS任务入队

```
检测到完整句子
    ↓
创建 TTSTask:
├─ Text: 过滤后的文本
├─ Ctx: TTS上下文（可取消）
└─ Writer: 消息写入器
    ↓
加入 TTS 队列 (缓冲100个任务)
```

### 2. TTS队列处理

```
TTS队列处理器 (独立 goroutine)
    ↓
从队列取出任务
    ↓
如果不是第一个任务:
    ↓
等待前一个任务完成 (WaitTTSTaskDone)
    ↓
处理 TTS 任务
```

### 3. TTS合成

```
processTTSTask
    ↓
设置 TTS 播放状态 (SetTTSPlaying(true))
    ↓
发送 TTS 开始消息: {"type": "tts_start", "sampleRate": 16000, ...}
    ↓
调用 TTS.Synthesize(ctx, handler, text)
    ↓
对每个音频片段:
    ├─ 发送二进制音频数据到前端
    └─ 累积总字节数
    ↓
TTS合成完成
    ↓
发送 TTS 结束消息: {"type": "tts_end"}
    ↓
计算播放时长
    ↓
等待播放完成 (Sleep)
    ↓
清空文本状态
    ↓
恢复 ASR 识别 (SetTTSPlaying(false))
    ↓
发送任务完成信号 (ttsTaskDone)
```

### 4. TTS打断机制

```
新的ASR结果触发处理
    ↓
TextProcessor.Process()
    ↓
取消之前的TTS合成 (CancelTTS)
    ↓
创建新的TTS上下文
    ↓
开始新的LLM查询和TTS合成
```

---

## 文本消息处理

### 1. 新会话请求

```
客户端 → 服务端: {"type": "new_session"}
    ↓
MessageHandler.HandleTextMessage()
    ↓
清理状态:
├─ 清空对话历史 (state.Clear())
└─ 重启 ASR 连接 (RestartClient)
    ↓
服务端 → 客户端: {"type": "session_cleared", "message": "..."}
```

### 2. 心跳请求

```
客户端 → 服务端: {"type": "ping"}
    ↓
MessageHandler.HandleTextMessage()
    ↓
服务端 → 客户端: {"type": "pong"}
```

---

## 错误处理机制

### 1. 错误分类

- **致命错误 (Fatal)**: 额度不足、配置错误等，需要断开连接
- **非致命错误**: 临时错误，可以重试

### 2. 错误处理流程

```
检测到错误
    ↓
检查错误类型:
├─ 致命错误 → HandleFatalError
│   ├─ 设置致命错误状态 (SetFatalError(true))
│   ├─ 发送错误消息到前端
│   └─ 停止所有处理
└─ 非致命错误 → 发送错误消息到前端
```

### 3. 错误消息格式

```json
{
  "type": "error",
  "message": "错误描述",
  "fatal": true/false
}
```

---

## 状态管理

### ClientState 状态字段

| 字段 | 类型 | 说明 |
|-----|------|------|
| `lastText` | string | 最后识别的文本 |
| `lastProcessedText` | string | 最后处理的文本 |
| `lastSentText` | string | 上次发送给前端的文本 |
| `lastProcessedCumulativeText` | string | 上次处理的累积文本 |
| `isProcessing` | bool | 是否正在处理 |
| `isTTSPlaying` | bool | TTS是否正在播放 |
| `isFatalError` | bool | 是否正在处理致命错误 |
| `ttsQueue` | chan | TTS任务队列 |
| `ttsQueueRunning` | bool | TTS队列是否正在运行 |

### 状态转换

```
空闲状态
    ↓
收到ASR结果 → 标记为处理中 (isProcessing=true)
    ↓
调用LLM → 保持处理中
    ↓
TTS合成 → TTS播放中 (isTTSPlaying=true)
    ↓
TTS完成 → 恢复空闲状态
```

---

## 完整交互时序图

```
客户端                    服务端                    ASR服务              LLM服务              TTS服务
  |                        |                        |                    |                    |
  |---WebSocket连接-------->|                        |                    |                    |
  |                        |---初始化服务----------->|                    |                    |
  |                        |---建立ASR连接---------->|                    |                    |
  |                        |<--连接成功--------------|                    |                    |
  |<--connected------------|                        |                    |                    |
  |                        |                        |                    |                    |
  |---音频数据(Binary)----->|                        |                    |                    |
  |                        |---发送音频------------>|                    |                    |
  |                        |                        |---识别结果--------->|                    |
  |                        |<--识别结果--------------|                    |                    |
  |<--asr_result-----------|                        |                    |                    |
  |                        |---调用LLM----------------------------------->|                    |
  |                        |<--流式响应片段--------------------------------|                    |
  |<--llm_response---------|                        |                    |                    |
  |                        |---加入TTS队列----------------------------------------------->|
  |<--tts_start------------|                        |                    |                    |
  |<--音频数据(Binary)------|                        |                    |                    |
  |<--tts_end--------------|                        |                    |                    |
  |                        |                        |                    |                    |
  |---{"type":"ping"}----->|                        |                    |                    |
  |<--{"type":"pong"}------|                        |                    |                    |
  |                        |                        |                    |                    |
  |---{"type":"new_session"}->|                    |                    |                    |
  |                        |---清理状态------------->|                    |                    |
  |<--session_cleared------|                        |                    |                    |
```

---

## 关键设计要点

### 1. 异步处理

- 使用消息队列 (`audioChan`, `textChan`) 实现异步处理
- 避免阻塞主消息循环
- 队列满时丢弃消息，记录警告

### 2. 增量更新

- ASR结果：只发送增量部分，避免重复
- LLM响应：流式发送片段，实时显示
- 累积文本管理：跟踪已处理部分，提取增量

### 3. 状态保护

- TTS播放时忽略音频数据（防止回声）
- 处理中状态防止重复处理
- 致命错误状态阻止新处理

### 4. 资源管理

- 使用 context 控制 goroutine 生命周期
- TTS 任务可取消（实现打断功能）
- 连接关闭时清理所有资源

### 5. 错误恢复

- ASR 服务自动重启
- 非致命错误不影响整体流程
- 致命错误优雅断开连接

---

## 配置参数

| 参数 | 默认值 | 说明 |
|-----|--------|------|
| `DefaultASRConnectionDelay` | 500ms | ASR连接延迟 |
| `DefaultLLMModel` | "deepseek-v3.1" | 默认LLM模型 |
| `AudioQueueSize` | 100 | 音频队列大小 |
| `TextQueueSize` | 10 | 文本队列大小 |
| `TTSQueueSize` | 100 | TTS队列大小 |

---

## 注意事项

1. **音频格式**: 客户端发送的音频数据应为 PCM 格式，采样率、声道数、位深度由 TTS 服务返回
2. **消息顺序**: 虽然使用异步处理，但关键消息（如 tts_start/tts_end）的顺序是保证的
3. **并发安全**: 所有状态操作都使用锁保护，确保并发安全
4. **资源清理**: 连接关闭时会清理所有资源，包括停止服务、取消上下文、清空队列

---

## 更新日志

- **v2.0**: 重构架构，分离关注点，改进错误处理和状态管理
- 支持知识库检索
- 支持流式LLM和TTS
- 改进ASR结果处理逻辑（增量提取）

