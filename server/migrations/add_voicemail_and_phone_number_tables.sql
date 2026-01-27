-- 创建留言表
CREATE TABLE IF NOT EXISTS voicemails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    -- 关联信息
    user_id INTEGER NOT NULL,
    sip_user_id INTEGER,
    sip_call_id INTEGER,
    
    -- 来电信息
    caller_number VARCHAR(20) NOT NULL,
    caller_name VARCHAR(128),
    caller_location VARCHAR(256),
    
    -- 留言音频信息
    audio_path VARCHAR(512) NOT NULL,
    audio_url VARCHAR(1024),
    audio_format VARCHAR(16) DEFAULT 'wav',
    audio_size INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    sample_rate INTEGER DEFAULT 8000,
    channels INTEGER DEFAULT 1,
    
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
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sip_user_id) REFERENCES sip_users(id) ON DELETE SET NULL,
    FOREIGN KEY (sip_call_id) REFERENCES sip_calls(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_voicemails_user_id ON voicemails(user_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_sip_user_id ON voicemails(sip_user_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_sip_call_id ON voicemails(sip_call_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_caller_number ON voicemails(caller_number);
CREATE INDEX IF NOT EXISTS idx_voicemails_status ON voicemails(status);
CREATE INDEX IF NOT EXISTS idx_voicemails_is_read ON voicemails(is_read);
CREATE INDEX IF NOT EXISTS idx_voicemails_is_important ON voicemails(is_important);
CREATE INDEX IF NOT EXISTS idx_voicemails_transcribe_status ON voicemails(transcribe_status);
CREATE INDEX IF NOT EXISTS idx_voicemails_deleted_at ON voicemails(deleted_at);

-- 创建号码管理表
CREATE TABLE IF NOT EXISTS phone_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    -- 关联信息
    user_id INTEGER NOT NULL,
    group_id INTEGER,
    
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
    active_scheme_id INTEGER,
    
    -- 统计信息
    total_calls INTEGER DEFAULT 0,
    total_voicemails INTEGER DEFAULT 0,
    last_call_at DATETIME,
    
    -- 元数据
    metadata TEXT,
    notes TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (active_scheme_id) REFERENCES sip_users(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_phone_numbers_user_id ON phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_group_id ON phone_numbers(group_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number ON phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON phone_numbers(status);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_is_primary ON phone_numbers(is_primary);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_active_scheme_id ON phone_numbers(active_scheme_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_deleted_at ON phone_numbers(deleted_at);
