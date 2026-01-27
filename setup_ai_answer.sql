-- AI 代接快速设置脚本
-- 使用方法: mysql -u root -p lingecho_db_v1 < setup_ai_answer.sql

-- 1. 查看现有的 SipUser
SELECT '=== 现有 SIP 用户 ===' as '';
SELECT id, username, user_id, assistant_id, auto_answer, enabled 
FROM sip_users 
LIMIT 10;

-- 2. 查看现有的 Assistant
SELECT '=== 现有 AI 助手 ===' as '';
SELECT id, name, system_prompt, language, speaker 
FROM assistants 
WHERE deleted_at IS NULL
LIMIT 10;

-- 3. 更新 test000 启用 AI 代接（如果存在）
-- 注意：需要先确保有 assistant_id，如果没有请先创建 assistant
UPDATE sip_users 
SET 
  auto_answer = 1,
  assistant_id = 1,  -- 替换为实际的 assistant_id
  opening_message = '您好，我现在不方便接听电话，请问有什么事吗？',
  keyword_replies = JSON_ARRAY(
    JSON_OBJECT('keyword', '快递', 'reply', '快递请放在门口，谢谢！'),
    JSON_OBJECT('keyword', '外卖', 'reply', '外卖请放在门口，谢谢！')
  ),
  fallback_message = '好的，我会尽快回复您。',
  recording_enabled = 1,
  recording_mode = 'full',
  message_enabled = 1,
  message_duration = 20,
  enabled = 1,
  updated_at = NOW()
WHERE username = 'test000';

-- 4. 验证更新
SELECT '=== 更新后的 test000 配置 ===' as '';
SELECT 
  id,
  username,
  auto_answer,
  assistant_id,
  opening_message,
  keyword_replies,
  fallback_message,
  enabled
FROM sip_users 
WHERE username = 'test000';

-- 5. 如果需要为手机号创建新的 SipUser（可选）
-- 取消下面的注释并修改参数
/*
INSERT INTO sip_users (
  scheme_name,
  username,
  user_id,
  assistant_id,
  auto_answer,
  opening_message,
  keyword_replies,
  fallback_message,
  recording_enabled,
  recording_mode,
  message_enabled,
  message_duration,
  bound_phone_number,
  enabled,
  created_at,
  updated_at
) VALUES (
  '手机代接',
  '+8615555555555',
  1,  -- 替换为你的 user_id
  1,  -- 替换为你的 assistant_id
  1,
  '您好，我现在不方便接听电话，请问有什么事吗？',
  JSON_ARRAY(
    JSON_OBJECT('keyword', '快递', 'reply', '快递请放在门口，谢谢！')
  ),
  '好的，我会尽快回复您。',
  1,
  'full',
  1,
  20,
  '+8615555555555',
  1,
  NOW(),
  NOW()
);
*/

SELECT '=== 设置完成 ===' as '';
SELECT '请使用 SIP 客户端拨打: test000@172.16.176.157' as '测试方法';
