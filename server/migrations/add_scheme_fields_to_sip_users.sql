-- 添加代接方案相关字段到 sip_users 表

-- 方案基本信息
ALTER TABLE `sip_users` ADD COLUMN `scheme_name` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '方案名称' AFTER `id`;
ALTER TABLE `sip_users` ADD COLUMN `description` TEXT COMMENT '方案描述' AFTER `scheme_name`;

-- AI 回复配置
ALTER TABLE `sip_users` ADD COLUMN `opening_message` TEXT COMMENT '开场白' AFTER `auto_answer_delay`;
ALTER TABLE `sip_users` ADD COLUMN `keyword_replies` JSON COMMENT '关键词回复配置' AFTER `opening_message`;
ALTER TABLE `sip_users` ADD COLUMN `fallback_message` TEXT COMMENT '兜底回复' AFTER `keyword_replies`;

-- 录音配置
ALTER TABLE `sip_users` ADD COLUMN `recording_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否开启录音' AFTER `fallback_message`;
ALTER TABLE `sip_users` ADD COLUMN `recording_mode` VARCHAR(20) NOT NULL DEFAULT 'full' COMMENT '录音模式：full/message' AFTER `recording_enabled`;
ALTER TABLE `sip_users` ADD COLUMN `recording_path` VARCHAR(512) COMMENT '录音文件存储路径模板' AFTER `recording_mode`;

-- 留言配置
ALTER TABLE `sip_users` ADD COLUMN `message_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用留言功能' AFTER `recording_path`;
ALTER TABLE `sip_users` ADD COLUMN `message_duration` INT NOT NULL DEFAULT 20 COMMENT '留言时长（秒）' AFTER `message_enabled`;
ALTER TABLE `sip_users` ADD COLUMN `message_prompt` TEXT COMMENT '留言提示语' AFTER `message_duration`;

-- 代接号码
ALTER TABLE `sip_users` ADD COLUMN `bound_phone_number` VARCHAR(20) COMMENT '绑定的手机号' AFTER `message_prompt`;
ALTER TABLE `sip_users` ADD INDEX `idx_bound_phone_number` (`bound_phone_number`);

-- 统计信息
ALTER TABLE `sip_users` ADD COLUMN `message_count` INT NOT NULL DEFAULT 0 COMMENT '留言次数' AFTER `total_call_duration`;

-- 配置信息
ALTER TABLE `sip_users` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为当前激活方案' AFTER `enabled`;
ALTER TABLE `sip_users` ADD INDEX `idx_is_active` (`user_id`, `is_active`);
