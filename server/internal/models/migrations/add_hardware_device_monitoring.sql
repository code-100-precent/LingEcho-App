-- 硬件设备表
CREATE TABLE IF NOT EXISTS `hardware_devices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `user_id` bigint unsigned NOT NULL,
  `mac_address` varchar(17) NOT NULL,
  `device_name` varchar(128) DEFAULT NULL,
  `board` varchar(64) DEFAULT NULL,
  `app_version` varchar(32) DEFAULT NULL,
  `auto_update` int DEFAULT '1',
  `assistant_id` bigint unsigned DEFAULT NULL,
  
  -- 运行状态
  `is_online` tinyint(1) DEFAULT '0',
  `last_seen` datetime(3) DEFAULT NULL,
  `start_time` datetime(3) DEFAULT NULL,
  `uptime` bigint DEFAULT '0',
  `error_count` int DEFAULT '0',
  `last_error` text,
  `last_error_at` datetime(3) DEFAULT NULL,
  
  -- 系统信息
  `system_info` json DEFAULT NULL,
  `hardware_info` json DEFAULT NULL,
  `network_info` json DEFAULT NULL,
  
  -- 性能状态
  `cpu_usage` double DEFAULT '0',
  `memory_usage` double DEFAULT '0',
  `temperature` double DEFAULT '0',
  
  -- 音频设备状态
  `audio_status` json DEFAULT NULL,
  
  -- 服务状态
  `service_status` json DEFAULT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hardware_devices_mac_address` (`mac_address`),
  KEY `idx_hardware_devices_user_id` (`user_id`),
  KEY `idx_hardware_devices_assistant_id` (`assistant_id`),
  KEY `idx_hardware_devices_is_online` (`is_online`),
  KEY `idx_hardware_devices_last_seen` (`last_seen`),
  KEY `idx_hardware_devices_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 设备错误日志表
CREATE TABLE IF NOT EXISTS `device_error_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  `device_id` bigint unsigned NOT NULL,
  `mac_address` varchar(17) DEFAULT NULL,
  `error_type` varchar(64) DEFAULT