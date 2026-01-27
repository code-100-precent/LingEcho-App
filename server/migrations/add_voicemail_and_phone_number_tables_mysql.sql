-- 创建留言表
CREATE TABLE IF NOT EXISTS voicemails (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    -- 关联信息
    user_id BIGINT NOT NULL,
    sip_user_id BIGINT,
    sip_call_id BIGINT,
    
    -- 来电信息
    caller_number VARCHAR(20) NOT NULL,
    caller_name VARCHAR(128),
    caller_location VARCHAR(256),
    
    -- 留言音频信息
    audio_path VARCHAR(512) NOT NULL,
    audio_url VARCHAR(1024),
    audio_format VARCHAR(16) DEFAULT 'wav',
    audio_size INT DEFAULT 0,
    duration INT DEFAULT 0,
    sample_rate INT DEFAULT 8000,
    channels INT DEFAULT 1,
    
    -- 留言内容
    transcribed_text TEXT,
    summary TEXT,
    keywords TEXT,
    
    -- 状态信息
    status VARCHAR(20) DEFAULT 'new',
    is_read BOOLEAN DEFAULT 0,
    is_important BOOLEAN DEFAULT 0,
    read_at DATETIME,
    
    -- 转录和分析状态
    transcribe_status VARCHAR(32) DEFAULT 'pending',
    transcribe_error TEXT,
    transcribed_at DATETIME,
    
    -- 元数据
    metadata TEXT,
    notes TEXT,
    
    INDEX idx_voicemails_user_id (user_id),
    INDEX idx_voicemails_sip_user_id (sip_user_id),
    INDEX idx_voicemails_sip_call_id (sip_call_id),
    INDEX idx_voicemails_caller_number (caller_number),
    INDEX idx_voicemails_status (status),
    INDEX idx_voicemails_is_read (is_read),
    INDEX idx_voicemails_is_important (is_important),
    INDEX idx_voicemails_transcribe_status (transcribe_status),
    INDEX idx_voicemails_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建号码管理表
CREATE TABLE IF NOT EXISTS phone_numbers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    -- 关联信息
    user_id BIGINT NOT NULL,
    group_id BIGINT,
    
    -- 号码信息
    phone_number VARCHAR(20) NOT NULL,
    country_code VARCHAR(10) DEFAULT '+86',
    carrier VARCHAR(64),
    location VARCHAR(256),
    
    -- 号码别名和备注
    alias VARCHAR(128),
    description TEXT,
    
    -- 状态信息
    status VARCHAR(20) DEFAULT 'inactive',
    is_verified BOOLEAN DEFAULT 0,
    verified_at DATETIME,
    is_primary BOOLEAN DEFAULT 0,
    
    -- 呼叫转移配置
    call_forward_enabled BOOLEAN DEFAULT 0,
    call_forward_status VARCHAR(20) DEFAULT 'unknown',
    call_forward_number VARCHAR(20),
    call_forward_set_at DATETIME,
    
    -- 绑定的代接方案
    active_scheme_id BIGINT,
    
    -- 统计信息
    total_calls INT DEFAULT 0,
    total_voicemails INT DEFAULT 0,
    last_call_at DATETIME,
    
    -- 元数据
    metadata TEXT,
    notes TEXT,
    
    INDEX idx_phone_numbers_user_id (user_id),
    INDEX idx_phone_numbers_group_id (group_id),
    INDEX idx_phone_numbers_phone_number (phone_number),
    INDEX idx_phone_numbers_status (status),
    INDEX idx_phone_numbers_is_primary (is_primary),
    INDEX idx_phone_numbers_active_scheme_id (active_scheme_id),
    INDEX idx_phone_numbers_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
