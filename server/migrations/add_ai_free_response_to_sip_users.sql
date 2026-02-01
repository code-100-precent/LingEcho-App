-- 添加AI自由回答字段到 sip_users 表

ALTER TABLE `sip_users` ADD COLUMN `ai_free_response` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用AI自由回答' AFTER `fallback_message`;
