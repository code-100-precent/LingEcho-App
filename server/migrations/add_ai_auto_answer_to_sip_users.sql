-- 添加 AI 代接功能到 sip_users 表
-- 执行日期: 2026-01-26
-- 描述: 为 SIP 用户添加 AI 助手绑定和自动接听配置

-- 添加 AI 代接相关字段
ALTER TABLE sip_users ADD COLUMN assistant_id INT UNSIGNED NULL COMMENT '绑定的 AI 助手 ID';
ALTER TABLE sip_users ADD COLUMN auto_answer BOOLEAN DEFAULT FALSE COMMENT '是否启用自动接听';
ALTER TABLE sip_users ADD COLUMN auto_answer_delay INT DEFAULT 0 COMMENT '自动接听延迟（秒）';

-- 添加外键约束（可选，如果 assistants 表存在）
-- 注意：如果 assistants 表不存在或字段名不同，请注释掉此行
ALTER TABLE sip_users ADD CONSTRAINT fk_sip_users_assistant 
  FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE SET NULL;

-- 添加索引以提高查询性能
CREATE INDEX idx_sip_users_assistant_id ON sip_users(assistant_id);
CREATE INDEX idx_sip_users_auto_answer ON sip_users(auto_answer);

-- 验证字段添加成功
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT, 
    COLUMN_COMMENT
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sip_users'
    AND COLUMN_NAME IN ('assistant_id', 'auto_answer', 'auto_answer_delay');
