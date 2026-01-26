# 代接方案 API 测试指南

## 前置条件

1. 启动服务器：`cd server && go run cmd/server/main.go`
2. 确保已登录并获取 token
3. 确保已创建至少一个 AI 助手

## API 测试示例

### 1. 创建代接方案

```bash
curl -X POST http://localhost:7072/api/schemes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schemeName": "工作模式",
    "description": "工作时间使用，礼貌回复",
    "assistantId": 1,
    "autoAnswer": true,
    "autoAnswerDelay": 0,
    "openingMessage": "您好，我现在不方便接听电话，请问有什么事吗？",
    "keywordReplies": [
      {"keyword": "快递", "reply": "快递请放在门口，谢谢！"},
      {"keyword": "外卖", "reply": "外卖请放在门口，谢谢！"},
      {"keyword": "推销", "reply": "不需要，谢谢。"}
    ],
    "fallbackMessage": "好的，我会尽快回复您。",
    "recordingEnabled": true,
    "recordingMode": "full",
    "messageEnabled": true,
    "messageDuration": 20,
    "messagePrompt": "请在嘀声后留言，我会尽快回复您。",
    "boundPhoneNumber": "13800138000"
  }'
```

### 2. 获取方案列表

```bash
curl -X GET http://localhost:7072/api/schemes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. 获取方案详情

```bash
curl -X GET http://localhost:7072/api/schemes/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. 更新方案

```bash
curl -X PUT http://localhost:7072/api/schemes/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schemeName": "工作模式（已更新）",
    "openingMessage": "您好，我现在正在开会，请问有什么紧急的事吗？"
  }'
```

### 5. 激活方案

```bash
curl -X POST http://localhost:7072/api/schemes/1/activate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. 获取当前激活的方案

```bash
curl -X GET http://localhost:7072/api/schemes/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. 删除方案

```bash
curl -X DELETE http://localhost:7072/api/schemes/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 功能测试

### 测试开场白

1. 创建一个方案，设置 `openingMessage`
2. 激活该方案
3. 拨打 SIP 号码
4. 接通后应该听到开场白

### 测试关键词回复

1. 创建方案时设置 `keywordReplies`：
   ```json
   "keywordReplies": [
     {"keyword": "快递", "reply": "快递请放在门口"}
   ]
   ```
2. 激活方案
3. 拨打 SIP 号码
4. 说出包含"快递"的话
5. 应该听到预设的回复

### 测试兜底回复

1. 创建方案时设置 `fallbackMessage`
2. 激活方案
3. 拨打 SIP 号码
4. 当 LLM 服务不可用时，应该听到兜底回复

## 预期响应格式

### 成功响应

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "id": 1,
    "schemeName": "工作模式",
    "username": "scheme_1_1234567890",
    "isActive": false,
    "createdAt": "2026-01-26T16:00:00Z",
    ...
  }
}
```

### 错误响应

```json
{
  "code": 500,
  "msg": "创建方案失败",
  "data": "error details"
}
```

## 注意事项

1. **方案激活**：同一用户只能有一个激活方案
2. **关键词匹配**：当前使用简单的子串匹配，可以扩展为正则表达式或模糊匹配
3. **权限检查**：只能操作自己创建的方案
4. **默认值**：
   - `messageDuration` 默认 20 秒
   - `recordingMode` 默认 "full"
   - `enabled` 默认 true

## 下一步

- 实现留言功能
- 实现录音功能
- 开发前端界面
- 添加通话记录和摘要
