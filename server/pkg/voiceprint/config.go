package voiceprint

import (
	"time"
)

// Config 声纹识别服务配置
type Config struct {
	// 服务基础配置
	Enabled bool   `env:"VOICEPRINT_ENABLED" mapstructure:"enabled"`
	BaseURL string `env:"VOICEPRINT_BASE_URL" mapstructure:"base_url"`
	APIKey  string `env:"VOICEPRINT_API_KEY" mapstructure:"api_key"`

	// 超时配置
	Timeout        time.Duration `env:"VOICEPRINT_TIMEOUT" mapstructure:"timeout"`
	ConnectTimeout time.Duration `env:"VOICEPRINT_CONNECT_TIMEOUT" mapstructure:"connect_timeout"`

	// 重试配置
	MaxRetries    int           `env:"VOICEPRINT_MAX_RETRIES" mapstructure:"max_retries"`
	RetryInterval time.Duration `env:"VOICEPRINT_RETRY_INTERVAL" mapstructure:"retry_interval"`

	// 识别配置
	SimilarityThreshold float64 `env:"VOICEPRINT_SIMILARITY_THRESHOLD" mapstructure:"similarity_threshold"`
	MaxCandidates       int     `env:"VOICEPRINT_MAX_CANDIDATES" mapstructure:"max_candidates"`

	// 缓存配置
	CacheEnabled bool          `env:"VOICEPRINT_CACHE_ENABLED" mapstructure:"cache_enabled"`
	CacheTTL     time.Duration `env:"VOICEPRINT_CACHE_TTL" mapstructure:"cache_ttl"`

	// 日志配置
	LogEnabled bool   `env:"VOICEPRINT_LOG_ENABLED" mapstructure:"log_enabled"`
	LogLevel   string `env:"VOICEPRINT_LOG_LEVEL" mapstructure:"log_level"`
}

// DefaultConfig 返回默认配置
func DefaultConfig() *Config {
	return &Config{
		Enabled:             false,
		BaseURL:             "http://localhost:8005",
		APIKey:              "",
		Timeout:             30 * time.Second,
		ConnectTimeout:      10 * time.Second,
		MaxRetries:          3,
		RetryInterval:       1 * time.Second,
		SimilarityThreshold: 0.6,
		MaxCandidates:       10,
		CacheEnabled:        true,
		CacheTTL:            5 * time.Minute,
		LogEnabled:          true,
		LogLevel:            "info",
	}
}

// Validate 验证配置
func (c *Config) Validate() error {
	if !c.Enabled {
		return nil
	}

	if c.BaseURL == "" {
		return ErrInvalidConfig("base_url is required")
	}

	if c.APIKey == "" {
		return ErrInvalidConfig("api_key is required")
	}

	if c.SimilarityThreshold < 0 || c.SimilarityThreshold > 1 {
		return ErrInvalidConfig("similarity_threshold must be between 0 and 1")
	}

	if c.MaxCandidates <= 0 {
		return ErrInvalidConfig("max_candidates must be greater than 0")
	}

	return nil
}
