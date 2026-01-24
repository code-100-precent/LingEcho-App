<<<<<<< HEAD
package config

import (
	"log"
	"os"
	"time"

	"github.com/LingByte/lingstorage-sdk-go"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/notification"
	"github.com/code-100-precent/LingEcho/pkg/utils"
)

// Config System  CommonConfig
type Config struct {
	MachineID        int64  `env:"MACHINE_ID"`
	ServerName       string `env:"SERVER_NAME"`
	ServerDesc       string `env:"SERVER_DESC"`
	ServerUrl        string `env:"SERVER_URL"`
	ServerLogo       string `env:"SERVER_LOGO"`
	ServerTermsUrl   string `env:"SERVER_TERMS_URL"`
	DBDriver         string `env:"DB_DRIVER"`
	DSN              string `env:"DSN"`
	Log              logger.LogConfig
	Mail             notification.MailConfig
	Addr             string `env:"ADDR"`
	Mode             string `env:"MODE"`
	DocsPrefix       string `env:"DOCS_PREFIX"`
	APIPrefix        string `env:"API_PREFIX"`
	AuthHeader       string `env:"AUTH_HEADER"`
	AdminPrefix      string `env:"ADMIN_PREFIX"`
	AuthPrefix       string `env:"AUTH_PREFIX"`
	SessionSecret    string `env:"SESSION_SECRET"`
	SecretExpireDays string `env:"SESSION_EXPIRE_DAYS"`
	LLMApiKey        string `env:"LLM_API_KEY"`
	LLMBaseURL       string `env:"LLM_BASE_URL"`
	LLMModel         string `env:"LLM_MODEL"`
	SearchEnabled    bool   `env:"SEARCH_ENABLED"`
	SearchPath       string `env:"SEARCH_PATH"`
	SearchBatchSize  int    `env:"SEARCH_BATCH_SIZE"`
	MonitorPrefix    string `env:"MONITOR_PREFIX"`
	LanguageEnabled  bool   `env:"LANGUAGE_ENABLED"`
	APISecretKey     string `env:"API_SECRET_KEY"`
	BackupEnabled    bool   `env:"BACKUP_ENABLED"`
	BackupPath       string `env:"BACKUP_PATH"`
	BackupSchedule   string `env:"BACKUP_SCHEDULE"`
	// ASR/TTS配置
	QiniuASRApiKey  string `env:"QINIU_ASR_API_KEY"`
	QiniuASRBaseURL string `env:"QINIU_ASR_BASE_URL"`
	QiniuTTSApiKey  string `env:"QINIU_TTS_API_KEY"`
	QiniuTTSBaseURL string `env:"QINIU_TTS_BASE_URL"`

	XunfeiWsAppId     string `env:"XUNFEI_WS_APP_ID"`
	XunfeiWsApiKey    string `env:"XUNFEI_WS_API_KEY"`
	XunfeiWsApiSecret string `env:"XUNFEI_WS_API_SECRET"`

	// 知识库配置
	KnowledgeBaseEnabled  bool   `env:"KNOWLEDGE_BASE_ENABLED"`  // 是否启用知识库功能
	KnowledgeBaseProvider string `env:"KNOWLEDGE_BASE_PROVIDER"` // 知识库提供者：aliyun, milvus, qdrant, elasticsearch, pinecone

	// 阿里云百炼配置
	BailianAccessKeyId     string `env:"BAILIAN_ACCESS_KEY_ID"`
	BailianAccessKeySecret string `env:"BAILIAN_ACCESS_KEY_SECRET"`
	BailianEndpoint        string `env:"BAILIAN_ENDPOINT"`
	BailianWorkspaceId     string `env:"BAILIAN_WORKSPACE_ID"`
	BailianCategoryId      string `env:"BAILIAN_CATEGORY_ID"`
	BailianSourceType      string `env:"BAILIAN_SOURCE_TYPE"`
	BailianParser          string `env:"BAILIAN_PARSER"`
	BailianStructType      string `env:"BAILIAN_STRUCT_TYPE"`
	BailianSinkType        string `env:"BAILIAN_SINK_TYPE"`

	// Milvus 配置
	MilvusAddress    string `env:"MILVUS_ADDRESS"`    // Milvus 服务器地址（默认: localhost:19530）
	MilvusUsername   string `env:"MILVUS_USERNAME"`   // 用户名（可选）
	MilvusPassword   string `env:"MILVUS_PASSWORD"`   // 密码（可选）
	MilvusCollection string `env:"MILVUS_COLLECTION"` // 集合名称
	MilvusDimension  int    `env:"MILVUS_DIMENSION"`  // 向量维度（默认: 768）

	// Qdrant 配置
	QdrantBaseURL    string `env:"QDRANT_BASE_URL"`   // Qdrant 服务器地址（默认: http://localhost:6333）
	QdrantApiKey     string `env:"QDRANT_API_KEY"`    // API Key（可选）
	QdrantCollection string `env:"QDRANT_COLLECTION"` // 集合名称
	QdrantDimension  int    `env:"QDRANT_DIMENSION"`  // 向量维度（默认: 384）

	// Elasticsearch 配置
	ElasticsearchBaseURL  string `env:"ELASTICSEARCH_BASE_URL"` // Elasticsearch 服务器地址（默认: http://localhost:9200）
	ElasticsearchUsername string `env:"ELASTICSEARCH_USERNAME"` // 用户名（可选）
	ElasticsearchPassword string `env:"ELASTICSEARCH_PASSWORD"` // 密码（可选）
	ElasticsearchIndex    string `env:"ELASTICSEARCH_INDEX"`    // 索引名称

	// Pinecone 配置
	PineconeApiKey    string `env:"PINECONE_API_KEY"`    // API Key（必需）
	PineconeBaseURL   string `env:"PINECONE_BASE_URL"`   // Base URL（默认: https://api.pinecone.io）
	PineconeIndexName string `env:"PINECONE_INDEX_NAME"` // 索引名称（必需）
	PineconeDimension int    `env:"PINECONE_DIMENSION"`  // 向量维度（默认: 1536）

	// 缓存配置
	Cache cache.Config

	// SSL/TLS配置
	SSLEnabled  bool   `env:"SSL_ENABLED"`
	SSLCertFile string `env:"SSL_CERT_FILE"`
	SSLKeyFile  string `env:"SSL_KEY_FILE"`

	// Neo4j 图数据库配置
	Neo4jEnabled         bool   `env:"NEO4J_ENABLED"`  // 是否启用 Neo4j
	Neo4jURI             string `env:"NEO4J_URI"`      // Neo4j 连接 URI（默认: bolt://localhost:7687）
	Neo4jUsername        string `env:"NEO4J_USERNAME"` // Neo4j 用户名（默认: neo4j）
	Neo4jPassword        string `env:"NEO4J_PASSWORD"` // Neo4j 密码
	Neo4jDatabase        string `env:"NEO4J_DATABASE"` // Neo4j 数据库名称（默认: neo4j）
	LingstorageBaseUrl   string `env:"LINGSTORAGE_BASE_URL"`
	LingstorageApiKey    string `env:"LINGSTORAGE_API_KEY"`
	LingstorageApiSecret string `env:"LINGSTORAGE_API_SECRET"`
	LingstorageBucket    string `env:"LINGSTORAGE_BUCKET"`

	// 中间件配置
	Middleware MiddlewareConfig
}

// MiddlewareConfig 中间件配置
type MiddlewareConfig struct {
	// 限流配置
	RateLimit RateLimiterConfig
	// 超时配置
	Timeout TimeoutConfig
	// 熔断器配置
	CircuitBreaker CircuitBreakerConfig
	// 是否启用各个中间件
	EnableRateLimit      bool `env:"ENABLE_RATE_LIMIT"`
	EnableTimeout        bool `env:"ENABLE_TIMEOUT"`
	EnableCircuitBreaker bool `env:"ENABLE_CIRCUIT_BREAKER"`
	EnableOperationLog   bool `env:"ENABLE_OPERATION_LOG"`
}

// RateLimiterConfig 限流配置
type RateLimiterConfig struct {
	// 全局限流配置
	GlobalRPS    int           `env:"RATE_LIMIT_GLOBAL_RPS"`   // 全局每秒请求数
	GlobalBurst  int           `env:"RATE_LIMIT_GLOBAL_BURST"` // 全局突发请求数
	GlobalWindow time.Duration // 全局时间窗口

	// 用户限流配置
	UserRPS    int           `env:"RATE_LIMIT_USER_RPS"`   // 用户每秒请求数
	UserBurst  int           `env:"RATE_LIMIT_USER_BURST"` // 用户突发请求数
	UserWindow time.Duration // 用户时间窗口

	// IP限流配置
	IPRPS    int           `env:"RATE_LIMIT_IP_RPS"`   // IP每秒请求数
	IPBurst  int           `env:"RATE_LIMIT_IP_BURST"` // IP突发请求数
	IPWindow time.Duration // IP时间窗口
}

// TimeoutConfig 超时配置
type TimeoutConfig struct {
	// 默认超时时间
	DefaultTimeout time.Duration `env:"DEFAULT_TIMEOUT"`
	// 超时后的降级响应
	FallbackResponse interface{}
}

// CircuitBreakerConfig 熔断器配置
type CircuitBreakerConfig struct {
	// 失败阈值
	FailureThreshold int `env:"CIRCUIT_BREAKER_FAILURE_THRESHOLD"`
	// 成功阈值（半开状态下）
	SuccessThreshold int `env:"CIRCUIT_BREAKER_SUCCESS_THRESHOLD"`
	// 超时时间
	Timeout time.Duration `env:"CIRCUIT_BREAKER_TIMEOUT"`
	// 熔断器打开后的等待时间
	OpenTimeout time.Duration `env:"CIRCUIT_BREAKER_OPEN_TIMEOUT"`
	// 最大并发请求数
	MaxConcurrentRequests int `env:"CIRCUIT_BREAKER_MAX_CONCURRENT"`
}

var GlobalConfig *Config

var GlobalStore *lingstorage.Client

func Load() error {
	// 1. 根据环境加载 .env 文件（如果不存在也不报错，使用默认值）s
	env := os.Getenv("APP_ENV")
	err := utils.LoadEnv(env)
	if err != nil {
		// .env文件不存在时只记录日志，不影响启动
		log.Printf("Note: .env file not found or failed to load: %v (using default values)", err)
	}

	// 2. 加载全局配置（所有配置都有默认值，确保无.env文件也能启动）
	GlobalConfig = &Config{
		MachineID:        utils.GetIntEnv("MACHINE_ID"),
		ServerName:       getStringOrDefault("SERVER_NAME", ""),
		ServerDesc:       getStringOrDefault("SERVER_DESC", ""),
		ServerUrl:        getStringOrDefault("SERVER_URL", ""),
		ServerLogo:       getStringOrDefault("SERVER_LOGO", ""),
		ServerTermsUrl:   getStringOrDefault("SERVER_TERMS_URL", ""),
		DBDriver:         getStringOrDefault("DB_DRIVER", "sqlite"),
		DSN:              getStringOrDefault("DSN", "./ling.db"),
		Addr:             getStringOrDefault("ADDR", ":7072"),
		Mode:             getStringOrDefault("MODE", "development"),
		DocsPrefix:       getStringOrDefault("DOCS_PREFIX", "/api/docs"),
		AuthHeader:       getStringOrDefault("AUTH_HEADER", "Authorization"),
		APIPrefix:        getStringOrDefault("API_PREFIX", "/api"),
		AdminPrefix:      getStringOrDefault("ADMIN_PREFIX", "/admin"),
		AuthPrefix:       getStringOrDefault("AUTH_PREFIX", "/auth"),
		SecretExpireDays: getStringOrDefault("SESSION_EXPIRE_DAYS", "7"),
		SessionSecret:    getStringOrDefault("SESSION_SECRET", generateDefaultSessionSecret()),
		Log: logger.LogConfig{
			Level:      getStringOrDefault("LOG_LEVEL", "info"),
			Filename:   getStringOrDefault("LOG_FILENAME", "./logs/app.log"),
			MaxSize:    getIntOrDefault("LOG_MAX_SIZE", 100),
			MaxAge:     getIntOrDefault("LOG_MAX_AGE", 30),
			MaxBackups: getIntOrDefault("LOG_MAX_BACKUPS", 5),
			Daily:      getBoolOrDefault("LOG_DAILY", true),
		},
		Mail: notification.MailConfig{
			Host:     getStringOrDefault("MAIL_HOST", ""),
			Username: getStringOrDefault("MAIL_USERNAME", ""),
			Password: getStringOrDefault("MAIL_PASSWORD", ""),
			Port:     int64(getIntOrDefault("MAIL_PORT", 587)),
			From:     getStringOrDefault("MAIL_FROM", ""),
		},
		LLMApiKey:       getStringOrDefault("LLM_API_KEY", ""),
		LLMBaseURL:      getStringOrDefault("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMModel:        getStringOrDefault("LLM_MODEL", "gpt-3.5-turbo"),
		SearchEnabled:   getBoolOrDefault("SEARCH_ENABLED", false),
		SearchPath:      getStringOrDefault("SEARCH_PATH", "./search"),
		SearchBatchSize: getIntOrDefault("SEARCH_BATCH_SIZE", 100),
		MonitorPrefix:   getStringOrDefault("MONITOR_PREFIX", "/metrics"),
		LanguageEnabled: getBoolOrDefault("LANGUAGE_ENABLED", true),
		APISecretKey:    getStringOrDefault("API_SECRET_KEY", generateDefaultSessionSecret()),
		BackupEnabled:   getBoolOrDefault("BACKUP_ENABLED", false),
		BackupPath:      getStringOrDefault("BACKUP_PATH", "./backups"),
		BackupSchedule:  getStringOrDefault("BACKUP_SCHEDULE", "0 2 * * *"),
		// ASR/TTS配置
		QiniuASRApiKey:    getStringOrDefault("QINIU_ASR_API_KEY", ""),
		QiniuASRBaseURL:   getStringOrDefault("QINIU_ASR_BASE_URL", ""),
		QiniuTTSApiKey:    getStringOrDefault("QINIU_TTS_API_KEY", ""),
		QiniuTTSBaseURL:   getStringOrDefault("QINIU_TTS_BASE_URL", ""),
		XunfeiWsAppId:     getStringOrDefault("XUNFEI_WS_APP_ID", ""),
		XunfeiWsApiKey:    getStringOrDefault("XUNFEI_WS_API_KEY", ""),
		XunfeiWsApiSecret: getStringOrDefault("XUNFEI_WS_API_SECRET", ""),
		// 知识库配置
		KnowledgeBaseEnabled:  getBoolOrDefault("KNOWLEDGE_BASE_ENABLED", false),
		KnowledgeBaseProvider: getStringOrDefault("KNOWLEDGE_BASE_PROVIDER", "aliyun"),
		// 阿里云百炼配置
		BailianAccessKeyId:     getStringOrDefault("BAILIAN_ACCESS_KEY_ID", ""),
		BailianAccessKeySecret: getStringOrDefault("BAILIAN_ACCESS_KEY_SECRET", ""),
		BailianEndpoint:        getStringOrDefault("BAILIAN_ENDPOINT", ""),
		BailianWorkspaceId:     getStringOrDefault("BAILIAN_WORKSPACE_ID", ""),
		BailianCategoryId:      getStringOrDefault("BAILIAN_CATEGORY_ID", ""),
		BailianSourceType:      getStringOrDefault("BAILIAN_SOURCE_TYPE", ""),
		BailianParser:          getStringOrDefault("BAILIAN_PARSER", ""),
		BailianStructType:      getStringOrDefault("BAILIAN_STRUCT_TYPE", ""),
		BailianSinkType:        getStringOrDefault("BAILIAN_SINK_TYPE", ""),
		// Milvus 配置
		MilvusAddress:    getStringOrDefault("MILVUS_ADDRESS", "localhost:19530"),
		MilvusUsername:   getStringOrDefault("MILVUS_USERNAME", ""),
		MilvusPassword:   getStringOrDefault("MILVUS_PASSWORD", ""),
		MilvusCollection: getStringOrDefault("MILVUS_COLLECTION", ""),
		MilvusDimension:  getIntOrDefault("MILVUS_DIMENSION", 768),
		// Qdrant 配置
		QdrantBaseURL:    getStringOrDefault("QDRANT_BASE_URL", "http://localhost:6333"),
		QdrantApiKey:     getStringOrDefault("QDRANT_API_KEY", ""),
		QdrantCollection: getStringOrDefault("QDRANT_COLLECTION", ""),
		QdrantDimension:  getIntOrDefault("QDRANT_DIMENSION", 384),
		// Elasticsearch 配置
		ElasticsearchBaseURL:  getStringOrDefault("ELASTICSEARCH_BASE_URL", "http://localhost:9200"),
		ElasticsearchUsername: getStringOrDefault("ELASTICSEARCH_USERNAME", ""),
		ElasticsearchPassword: getStringOrDefault("ELASTICSEARCH_PASSWORD", ""),
		ElasticsearchIndex:    getStringOrDefault("ELASTICSEARCH_INDEX", ""),
		// Pinecone 配置
		PineconeApiKey:    getStringOrDefault("PINECONE_API_KEY", ""),
		PineconeBaseURL:   getStringOrDefault("PINECONE_BASE_URL", "https://api.pinecone.io"),
		PineconeIndexName: getStringOrDefault("PINECONE_INDEX_NAME", ""),
		PineconeDimension: getIntOrDefault("PINECONE_DIMENSION", 1536),
		// 缓存配置
		Cache: loadCacheConfig(),
		// SSL/TLS配置（默认禁用）
		SSLEnabled:  getBoolOrDefault("SSL_ENABLED", false),
		SSLCertFile: getStringOrDefault("SSL_CERT_FILE", ""),
		SSLKeyFile:  getStringOrDefault("SSL_KEY_FILE", ""),
		// Neo4j 图数据库配置（默认禁用）
		Neo4jEnabled:         getBoolOrDefault("NEO4J_ENABLED", false),
		Neo4jURI:             getStringOrDefault("NEO4J_URI", "bolt://localhost:7687"),
		Neo4jUsername:        getStringOrDefault("NEO4J_USERNAME", "neo4j"),
		Neo4jPassword:        getStringOrDefault("NEO4J_PASSWORD", ""),
		Neo4jDatabase:        getStringOrDefault("NEO4J_DATABASE", "neo4j"),
		LingstorageBaseUrl:   getStringOrDefault("LINGSTORAGE_BASE_URL", "https://api.lingstorage.com"),
		LingstorageApiKey:    getStringOrDefault("LINGSTORAGE_API_KEY", ""),
		LingstorageApiSecret: getStringOrDefault("LINGSTORAGE_API_SECRET", ""),
		LingstorageBucket:    getStringOrDefault("LINGSTORAGE_BUCKET", "default"),
		// 中间件配置
		Middleware: loadMiddlewareConfig(),
	}
	GlobalStore = lingstorage.NewClient(&lingstorage.Config{
		BaseURL:   GlobalConfig.LingstorageBaseUrl,
		APIKey:    GlobalConfig.LingstorageApiKey,
		APISecret: GlobalConfig.LingstorageApiSecret,
	})

	return nil
}

// getStringOrDefault 获取环境变量值，如果为空则返回默认值
func getStringOrDefault(key, defaultValue string) string {
	value := utils.GetEnv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// getBoolOrDefault 获取布尔环境变量值，如果为空则返回默认值
func getBoolOrDefault(key string, defaultValue bool) bool {
	value := utils.GetEnv(key)
	if value == "" {
		return defaultValue
	}
	return utils.GetBoolEnv(key)
}

// getIntOrDefault 获取整数环境变量值，如果为空则返回默认值
func getIntOrDefault(key string, defaultValue int) int {
	value := utils.GetIntEnv(key)
	if value == 0 {
		return defaultValue
	}
	return int(value)
}

// generateDefaultSessionSecret 生成默认的会话密钥（仅用于开发环境）
func generateDefaultSessionSecret() string {
	// 如果环境变量中已有值，使用环境变量
	if secret := utils.GetEnv("SESSION_SECRET"); secret != "" {
		return secret
	}
	// 否则生成一个随机字符串（仅用于开发）
	return "default-secret-key-change-in-production-" + utils.RandText(16)
}

// loadCacheConfig 加载缓存配置，设置所有默认值
func loadCacheConfig() cache.Config {
	cacheType := utils.GetEnv("CACHE_TYPE")
	if cacheType == "" {
		cacheType = "local"
	}

	// 解析时间字符串的辅助函数
	parseDuration := func(s string, defaultVal time.Duration) time.Duration {
		if s == "" {
			return defaultVal
		}
		d, err := time.ParseDuration(s)
		if err != nil {
			return defaultVal
		}
		return d
	}

	// Redis 配置
	redisAddr := utils.GetEnv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	redisDB := int(utils.GetIntEnv("REDIS_DB"))
	if redisDB == 0 {
		redisDB = 0
	}

	redisPoolSize := int(utils.GetIntEnv("REDIS_POOL_SIZE"))
	if redisPoolSize == 0 {
		redisPoolSize = 10
	}

	redisMinIdleConns := int(utils.GetIntEnv("REDIS_MIN_IDLE_CONNS"))
	if redisMinIdleConns == 0 {
		redisMinIdleConns = 5
	}

	// 本地缓存配置
	localMaxSize := int(utils.GetIntEnv("LOCAL_CACHE_MAX_SIZE"))
	if localMaxSize == 0 {
		localMaxSize = 1000
	}

	localDefaultExpiration := parseDuration(utils.GetEnv("LOCAL_CACHE_DEFAULT_EXPIRATION"), 5*time.Minute)
	localCleanupInterval := parseDuration(utils.GetEnv("LOCAL_CACHE_CLEANUP_INTERVAL"), 10*time.Minute)

	return cache.Config{
		Type: cacheType,
		Redis: cache.RedisConfig{
			Addr:         redisAddr,
			Password:     utils.GetEnv("REDIS_PASSWORD"),
			DB:           redisDB,
			PoolSize:     redisPoolSize,
			MinIdleConns: redisMinIdleConns,
			DialTimeout:  parseDuration(utils.GetEnv("REDIS_DIAL_TIMEOUT"), 5*time.Second),
			ReadTimeout:  parseDuration(utils.GetEnv("REDIS_READ_TIMEOUT"), 3*time.Second),
			WriteTimeout: parseDuration(utils.GetEnv("REDIS_WRITE_TIMEOUT"), 3*time.Second),
			IdleTimeout:  parseDuration(utils.GetEnv("REDIS_IDLE_TIMEOUT"), 5*time.Minute),
		},
		Local: cache.LocalConfig{
			MaxSize:           localMaxSize,
			DefaultExpiration: localDefaultExpiration,
			CleanupInterval:   localCleanupInterval,
		},
	}
}

// loadMiddlewareConfig 加载中间件配置
func loadMiddlewareConfig() MiddlewareConfig {
	// 解析时间字符串的辅助函数
	parseDuration := func(s string, defaultVal time.Duration) time.Duration {
		if s == "" {
			return defaultVal
		}
		d, err := time.ParseDuration(s)
		if err != nil {
			return defaultVal
		}
		return d
	}

	// 根据环境模式设置默认值
	mode := getStringOrDefault("MODE", "development")
	var defaultConfig MiddlewareConfig

	if mode == "production" {
		// 生产环境配置
		defaultConfig = MiddlewareConfig{
			RateLimit: RateLimiterConfig{
				GlobalRPS:    2000,
				GlobalBurst:  4000,
				GlobalWindow: time.Minute,
				UserRPS:      200,
				UserBurst:    400,
				UserWindow:   time.Minute,
				IPRPS:        100,
				IPBurst:      200,
				IPWindow:     time.Minute,
			},
			Timeout: TimeoutConfig{
				DefaultTimeout: 30 * time.Second,
				FallbackResponse: map[string]interface{}{
					"error":   "service_unavailable",
					"message": "服务暂时不可用，请稍后重试",
					"code":    503,
				},
			},
			CircuitBreaker: CircuitBreakerConfig{
				FailureThreshold:      3,
				SuccessThreshold:      2,
				Timeout:               30 * time.Second,
				OpenTimeout:           30 * time.Second,
				MaxConcurrentRequests: 200,
			},
			EnableRateLimit:      true,
			EnableTimeout:        true,
			EnableCircuitBreaker: true,
			EnableOperationLog:   true,
		}
	} else {
		// 开发环境配置
		defaultConfig = MiddlewareConfig{
			RateLimit: RateLimiterConfig{
				GlobalRPS:    10000,
				GlobalBurst:  20000,
				GlobalWindow: time.Minute,
				UserRPS:      1000,
				UserBurst:    2000,
				UserWindow:   time.Minute,
				IPRPS:        500,
				IPBurst:      1000,
				IPWindow:     time.Minute,
			},
			Timeout: TimeoutConfig{
				DefaultTimeout: 60 * time.Second,
				FallbackResponse: map[string]interface{}{
					"error":   "service_unavailable",
					"message": "服务暂时不可用，请稍后重试",
					"code":    503,
				},
			},
			CircuitBreaker: CircuitBreakerConfig{
				FailureThreshold:      10,
				SuccessThreshold:      5,
				Timeout:               60 * time.Second,
				OpenTimeout:           60 * time.Second,
				MaxConcurrentRequests: 1000,
			},
			EnableRateLimit:      true,
			EnableTimeout:        true,
			EnableCircuitBreaker: false, // 开发环境关闭熔断器
			EnableOperationLog:   true,
		}
	}

	// 从环境变量覆盖配置
	return MiddlewareConfig{
		RateLimit: RateLimiterConfig{
			GlobalRPS:    getIntOrDefault("RATE_LIMIT_GLOBAL_RPS", defaultConfig.RateLimit.GlobalRPS),
			GlobalBurst:  getIntOrDefault("RATE_LIMIT_GLOBAL_BURST", defaultConfig.RateLimit.GlobalBurst),
			GlobalWindow: parseDuration(getStringOrDefault("RATE_LIMIT_GLOBAL_WINDOW", "1m"), defaultConfig.RateLimit.GlobalWindow),
			UserRPS:      getIntOrDefault("RATE_LIMIT_USER_RPS", defaultConfig.RateLimit.UserRPS),
			UserBurst:    getIntOrDefault("RATE_LIMIT_USER_BURST", defaultConfig.RateLimit.UserBurst),
			UserWindow:   parseDuration(getStringOrDefault("RATE_LIMIT_USER_WINDOW", "1m"), defaultConfig.RateLimit.UserWindow),
			IPRPS:        getIntOrDefault("RATE_LIMIT_IP_RPS", defaultConfig.RateLimit.IPRPS),
			IPBurst:      getIntOrDefault("RATE_LIMIT_IP_BURST", defaultConfig.RateLimit.IPBurst),
			IPWindow:     parseDuration(getStringOrDefault("RATE_LIMIT_IP_WINDOW", "1m"), defaultConfig.RateLimit.IPWindow),
		},
		Timeout: TimeoutConfig{
			DefaultTimeout:   parseDuration(getStringOrDefault("DEFAULT_TIMEOUT", "30s"), defaultConfig.Timeout.DefaultTimeout),
			FallbackResponse: defaultConfig.Timeout.FallbackResponse,
		},
		CircuitBreaker: CircuitBreakerConfig{
			FailureThreshold:      getIntOrDefault("CIRCUIT_BREAKER_FAILURE_THRESHOLD", defaultConfig.CircuitBreaker.FailureThreshold),
			SuccessThreshold:      getIntOrDefault("CIRCUIT_BREAKER_SUCCESS_THRESHOLD", defaultConfig.CircuitBreaker.SuccessThreshold),
			Timeout:               parseDuration(getStringOrDefault("CIRCUIT_BREAKER_TIMEOUT", "30s"), defaultConfig.CircuitBreaker.Timeout),
			OpenTimeout:           parseDuration(getStringOrDefault("CIRCUIT_BREAKER_OPEN_TIMEOUT", "30s"), defaultConfig.CircuitBreaker.OpenTimeout),
			MaxConcurrentRequests: getIntOrDefault("CIRCUIT_BREAKER_MAX_CONCURRENT", defaultConfig.CircuitBreaker.MaxConcurrentRequests),
		},
		EnableRateLimit:      getBoolOrDefault("ENABLE_RATE_LIMIT", defaultConfig.EnableRateLimit),
		EnableTimeout:        getBoolOrDefault("ENABLE_TIMEOUT", defaultConfig.EnableTimeout),
		EnableCircuitBreaker: getBoolOrDefault("ENABLE_CIRCUIT_BREAKER", defaultConfig.EnableCircuitBreaker),
		EnableOperationLog:   getBoolOrDefault("ENABLE_OPERATION_LOG", defaultConfig.EnableOperationLog),
	}
}
=======
package config

import (
	"errors"
	"log"
	"os"
	"time"

	"github.com/LingByte/lingstorage-sdk-go"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/notification"
	"github.com/code-100-precent/LingEcho/pkg/utils"
)

// Config main configuration structure
type Config struct {
	MachineID    int64              `env:"MACHINE_ID"`
	Server       ServerConfig       `mapstructure:"server"`
	Database     DatabaseConfig     `mapstructure:"database"`
	Log          logger.LogConfig   `mapstructure:"log"`
	Cache        cache.Config       `mapstructure:"cache"`
	Auth         AuthConfig         `mapstructure:"auth"`
	Services     ServicesConfig     `mapstructure:"services"`
	Integrations IntegrationsConfig `mapstructure:"integrations"`
	Features     FeaturesConfig     `mapstructure:"features"`
	Middleware   MiddlewareConfig   `mapstructure:"middleware"`
}

// ServerConfig server configuration
type ServerConfig struct {
	Name          string `env:"SERVER_NAME"`
	Desc          string `env:"SERVER_DESC"`
	URL           string `env:"SERVER_URL"`
	Logo          string `env:"SERVER_LOGO"`
	TermsURL      string `env:"SERVER_TERMS_URL"`
	Addr          string `env:"ADDR"`
	Mode          string `env:"MODE"`
	DocsPrefix    string `env:"DOCS_PREFIX"`
	APIPrefix     string `env:"API_PREFIX"`
	AdminPrefix   string `env:"ADMIN_PREFIX"`
	AuthPrefix    string `env:"AUTH_PREFIX"`
	MonitorPrefix string `env:"MONITOR_PREFIX"`
	SSLEnabled    bool   `env:"SSL_ENABLED"`
	SSLCertFile   string `env:"SSL_CERT_FILE"`
	SSLKeyFile    string `env:"SSL_KEY_FILE"`
}

// DatabaseConfig database configuration
type DatabaseConfig struct {
	Driver string `env:"DB_DRIVER"`
	DSN    string `env:"DSN"`
}

// AuthConfig authentication configuration
type AuthConfig struct {
	Header           string `env:"AUTH_HEADER"`
	SessionSecret    string `env:"SESSION_SECRET"`
	SecretExpireDays string `env:"SESSION_EXPIRE_DAYS"`
	APISecretKey     string `env:"API_SECRET_KEY"`
}

// ServicesConfig services configuration
type ServicesConfig struct {
	LLM           LLMConfig               `mapstructure:"llm"`
	Mail          notification.MailConfig `mapstructure:"mail"`
	KnowledgeBase KnowledgeBaseConfig     `mapstructure:"knowledge_base"`
	Voice         VoiceConfig             `mapstructure:"voice"`
	Storage       StorageConfig           `mapstructure:"storage"`
}

// LLMConfig LLM service configuration
type LLMConfig struct {
	APIKey  string `env:"LLM_API_KEY"`
	BaseURL string `env:"LLM_BASE_URL"`
	Model   string `env:"LLM_MODEL"`
}

// KnowledgeBaseConfig knowledge base configuration
type KnowledgeBaseConfig struct {
	Enabled       bool                `env:"KNOWLEDGE_BASE_ENABLED"`
	Provider      string              `env:"KNOWLEDGE_BASE_PROVIDER"`
	Bailian       BailianConfig       `mapstructure:"bailian"`
	Milvus        MilvusConfig        `mapstructure:"milvus"`
	Qdrant        QdrantConfig        `mapstructure:"qdrant"`
	Elasticsearch ElasticsearchConfig `mapstructure:"elasticsearch"`
	Pinecone      PineconeConfig      `mapstructure:"pinecone"`
	Neo4j         Neo4jConfig         `mapstructure:"neo4j"`
}

// BailianConfig Bailian configuration
type BailianConfig struct {
	AccessKeyId     string `env:"BAILIAN_ACCESS_KEY_ID"`
	AccessKeySecret string `env:"BAILIAN_ACCESS_KEY_SECRET"`
	Endpoint        string `env:"BAILIAN_ENDPOINT"`
	WorkspaceId     string `env:"BAILIAN_WORKSPACE_ID"`
	CategoryId      string `env:"BAILIAN_CATEGORY_ID"`
	SourceType      string `env:"BAILIAN_SOURCE_TYPE"`
	Parser          string `env:"BAILIAN_PARSER"`
	StructType      string `env:"BAILIAN_STRUCT_TYPE"`
	SinkType        string `env:"BAILIAN_SINK_TYPE"`
}

// MilvusConfig Milvus configuration
type MilvusConfig struct {
	Address    string `env:"MILVUS_ADDRESS"`
	Username   string `env:"MILVUS_USERNAME"`
	Password   string `env:"MILVUS_PASSWORD"`
	Collection string `env:"MILVUS_COLLECTION"`
	Dimension  int    `env:"MILVUS_DIMENSION"`
}

// QdrantConfig Qdrant configuration
type QdrantConfig struct {
	BaseURL    string `env:"QDRANT_BASE_URL"`
	APIKey     string `env:"QDRANT_API_KEY"`
	Collection string `env:"QDRANT_COLLECTION"`
	Dimension  int    `env:"QDRANT_DIMENSION"`
}

// ElasticsearchConfig Elasticsearch configuration
type ElasticsearchConfig struct {
	BaseURL  string `env:"ELASTICSEARCH_BASE_URL"`
	Username string `env:"ELASTICSEARCH_USERNAME"`
	Password string `env:"ELASTICSEARCH_PASSWORD"`
	Index    string `env:"ELASTICSEARCH_INDEX"`
}

// PineconeConfig Pinecone configuration
type PineconeConfig struct {
	APIKey    string `env:"PINECONE_API_KEY"`
	BaseURL   string `env:"PINECONE_BASE_URL"`
	IndexName string `env:"PINECONE_INDEX_NAME"`
	Dimension int    `env:"PINECONE_DIMENSION"`
}

// Neo4jConfig Neo4j configuration
type Neo4jConfig struct {
	Enabled  bool   `env:"NEO4J_ENABLED"`
	URI      string `env:"NEO4J_URI"`
	Username string `env:"NEO4J_USERNAME"`
	Password string `env:"NEO4J_PASSWORD"`
	Database string `env:"NEO4J_DATABASE"`
}

// VoiceConfig voice service configuration
type VoiceConfig struct {
	Qiniu  QiniuVoiceConfig  `mapstructure:"qiniu"`
	Xunfei XunfeiVoiceConfig `mapstructure:"xunfei"`
}

// QiniuVoiceConfig Qiniu voice configuration
type QiniuVoiceConfig struct {
	ASRAPIKey  string `env:"QINIU_ASR_API_KEY"`
	ASRBaseURL string `env:"QINIU_ASR_BASE_URL"`
	TTSAPIKey  string `env:"QINIU_TTS_API_KEY"`
	TTSBaseURL string `env:"QINIU_TTS_BASE_URL"`
}

// XunfeiVoiceConfig Xunfei voice configuration
type XunfeiVoiceConfig struct {
	WSAppId     string `env:"XUNFEI_WS_APP_ID"`
	WSAPIKey    string `env:"XUNFEI_WS_API_KEY"`
	WSAPISecret string `env:"XUNFEI_WS_API_SECRET"`
}

// StorageConfig storage configuration
type StorageConfig struct {
	BaseURL   string `env:"LINGSTORAGE_BASE_URL"`
	APIKey    string `env:"LINGSTORAGE_API_KEY"`
	APISecret string `env:"LINGSTORAGE_API_SECRET"`
	Bucket    string `env:"LINGSTORAGE_BUCKET"`
}

// IntegrationsConfig integrations configuration
type IntegrationsConfig struct {
	// Other third-party integration configurations can be added here
}

// FeaturesConfig feature flags configuration
type FeaturesConfig struct {
	SearchEnabled   bool   `env:"SEARCH_ENABLED"`
	SearchPath      string `env:"SEARCH_PATH"`
	SearchBatchSize int    `env:"SEARCH_BATCH_SIZE"`
	LanguageEnabled bool   `env:"LANGUAGE_ENABLED"`
	BackupEnabled   bool   `env:"BACKUP_ENABLED"`
	BackupPath      string `env:"BACKUP_PATH"`
	BackupSchedule  string `env:"BACKUP_SCHEDULE"`
}

// MiddlewareConfig middleware configuration
type MiddlewareConfig struct {
	// Rate limiting configuration
	RateLimit RateLimiterConfig
	// Timeout configuration
	Timeout TimeoutConfig
	// Circuit breaker configuration
	CircuitBreaker CircuitBreakerConfig
	// Whether to enable each middleware
	EnableRateLimit      bool `env:"ENABLE_RATE_LIMIT"`
	EnableTimeout        bool `env:"ENABLE_TIMEOUT"`
	EnableCircuitBreaker bool `env:"ENABLE_CIRCUIT_BREAKER"`
	EnableOperationLog   bool `env:"ENABLE_OPERATION_LOG"`
}

// RateLimiterConfig rate limiting configuration
type RateLimiterConfig struct {
	GlobalRPS    int           `env:"RATE_LIMIT_GLOBAL_RPS"`   // Global requests per second
	GlobalBurst  int           `env:"RATE_LIMIT_GLOBAL_BURST"` // Global burst requests
	GlobalWindow time.Duration // Global time window
	UserRPS      int           `env:"RATE_LIMIT_USER_RPS"`   // User requests per second
	UserBurst    int           `env:"RATE_LIMIT_USER_BURST"` // User burst requests
	UserWindow   time.Duration // User time window
	IPRPS        int           `env:"RATE_LIMIT_IP_RPS"`   // IP requests per second
	IPBurst      int           `env:"RATE_LIMIT_IP_BURST"` // IP burst requests
	IPWindow     time.Duration // IP time window
}

// TimeoutConfig timeout configuration
type TimeoutConfig struct {
	DefaultTimeout   time.Duration `env:"DEFAULT_TIMEOUT"`
	FallbackResponse interface{}
}

// CircuitBreakerConfig circuit breaker configuration
type CircuitBreakerConfig struct {
	FailureThreshold      int           `env:"CIRCUIT_BREAKER_FAILURE_THRESHOLD"`
	SuccessThreshold      int           `env:"CIRCUIT_BREAKER_SUCCESS_THRESHOLD"`
	Timeout               time.Duration `env:"CIRCUIT_BREAKER_TIMEOUT"`
	OpenTimeout           time.Duration `env:"CIRCUIT_BREAKER_OPEN_TIMEOUT"`
	MaxConcurrentRequests int           `env:"CIRCUIT_BREAKER_MAX_CONCURRENT"`
}

var GlobalConfig *Config

var GlobalStore *lingstorage.Client

func Load() error {
	// 1. Load .env file based on environment (don't error if it doesn't exist, use default values)
	env := os.Getenv("APP_ENV")
	err := utils.LoadEnv(env)
	if err != nil {
		// Only log when .env file doesn't exist, don't affect startup
		log.Printf("Note: .env file not found or failed to load: %v (using default values)", err)
	}

	// 2. Load global configuration
	GlobalConfig = &Config{
		MachineID: utils.GetIntEnv("MACHINE_ID"),
		Server: ServerConfig{
			Name:          getStringOrDefault("SERVER_NAME", ""),
			Desc:          getStringOrDefault("SERVER_DESC", ""),
			URL:           getStringOrDefault("SERVER_URL", ""),
			Logo:          getStringOrDefault("SERVER_LOGO", ""),
			TermsURL:      getStringOrDefault("SERVER_TERMS_URL", ""),
			Addr:          getStringOrDefault("ADDR", ":7072"),
			Mode:          getStringOrDefault("MODE", "development"),
			DocsPrefix:    getStringOrDefault("DOCS_PREFIX", "/api/docs"),
			APIPrefix:     getStringOrDefault("API_PREFIX", "/api"),
			AdminPrefix:   getStringOrDefault("ADMIN_PREFIX", "/admin"),
			AuthPrefix:    getStringOrDefault("AUTH_PREFIX", "/auth"),
			MonitorPrefix: getStringOrDefault("MONITOR_PREFIX", "/metrics"),
			SSLEnabled:    getBoolOrDefault("SSL_ENABLED", false),
			SSLCertFile:   getStringOrDefault("SSL_CERT_FILE", ""),
			SSLKeyFile:    getStringOrDefault("SSL_KEY_FILE", ""),
		},
		Database: DatabaseConfig{
			Driver: getStringOrDefault("DB_DRIVER", "sqlite"),
			DSN:    getStringOrDefault("DSN", "./ling.db"),
		},
		Log: logger.LogConfig{
			Level:      getStringOrDefault("LOG_LEVEL", "info"),
			Filename:   getStringOrDefault("LOG_FILENAME", "./logs/app.log"),
			MaxSize:    getIntOrDefault("LOG_MAX_SIZE", 100),
			MaxAge:     getIntOrDefault("LOG_MAX_AGE", 30),
			MaxBackups: getIntOrDefault("LOG_MAX_BACKUPS", 5),
			Daily:      getBoolOrDefault("LOG_DAILY", true),
		},
		Cache: loadCacheConfig(),
		Auth: AuthConfig{
			Header:           getStringOrDefault("AUTH_HEADER", "Authorization"),
			SessionSecret:    getStringOrDefault("SESSION_SECRET", generateDefaultSessionSecret()),
			SecretExpireDays: getStringOrDefault("SESSION_EXPIRE_DAYS", "7"),
			APISecretKey:     getStringOrDefault("API_SECRET_KEY", generateDefaultSessionSecret()),
		},
		Services: ServicesConfig{
			LLM: LLMConfig{
				APIKey:  getStringOrDefault("LLM_API_KEY", ""),
				BaseURL: getStringOrDefault("LLM_BASE_URL", "https://api.openai.com/v1"),
				Model:   getStringOrDefault("LLM_MODEL", "gpt-3.5-turbo"),
			},
			Mail: notification.MailConfig{
				Host:     getStringOrDefault("MAIL_HOST", ""),
				Username: getStringOrDefault("MAIL_USERNAME", ""),
				Password: getStringOrDefault("MAIL_PASSWORD", ""),
				Port:     int64(getIntOrDefault("MAIL_PORT", 587)),
				From:     getStringOrDefault("MAIL_FROM", ""),
			},
			KnowledgeBase: KnowledgeBaseConfig{
				Enabled:  getBoolOrDefault("KNOWLEDGE_BASE_ENABLED", false),
				Provider: getStringOrDefault("KNOWLEDGE_BASE_PROVIDER", "aliyun"),
				Bailian: BailianConfig{
					AccessKeyId:     getStringOrDefault("BAILIAN_ACCESS_KEY_ID", ""),
					AccessKeySecret: getStringOrDefault("BAILIAN_ACCESS_KEY_SECRET", ""),
					Endpoint:        getStringOrDefault("BAILIAN_ENDPOINT", ""),
					WorkspaceId:     getStringOrDefault("BAILIAN_WORKSPACE_ID", ""),
					CategoryId:      getStringOrDefault("BAILIAN_CATEGORY_ID", ""),
					SourceType:      getStringOrDefault("BAILIAN_SOURCE_TYPE", ""),
					Parser:          getStringOrDefault("BAILIAN_PARSER", ""),
					StructType:      getStringOrDefault("BAILIAN_STRUCT_TYPE", ""),
					SinkType:        getStringOrDefault("BAILIAN_SINK_TYPE", ""),
				},
				Milvus: MilvusConfig{
					Address:    getStringOrDefault("MILVUS_ADDRESS", "localhost:19530"),
					Username:   getStringOrDefault("MILVUS_USERNAME", ""),
					Password:   getStringOrDefault("MILVUS_PASSWORD", ""),
					Collection: getStringOrDefault("MILVUS_COLLECTION", ""),
					Dimension:  getIntOrDefault("MILVUS_DIMENSION", 768),
				},
				Qdrant: QdrantConfig{
					BaseURL:    getStringOrDefault("QDRANT_BASE_URL", "http://localhost:6333"),
					APIKey:     getStringOrDefault("QDRANT_API_KEY", ""),
					Collection: getStringOrDefault("QDRANT_COLLECTION", ""),
					Dimension:  getIntOrDefault("QDRANT_DIMENSION", 384),
				},
				Elasticsearch: ElasticsearchConfig{
					BaseURL:  getStringOrDefault("ELASTICSEARCH_BASE_URL", "http://localhost:9200"),
					Username: getStringOrDefault("ELASTICSEARCH_USERNAME", ""),
					Password: getStringOrDefault("ELASTICSEARCH_PASSWORD", ""),
					Index:    getStringOrDefault("ELASTICSEARCH_INDEX", ""),
				},
				Pinecone: PineconeConfig{
					APIKey:    getStringOrDefault("PINECONE_API_KEY", ""),
					BaseURL:   getStringOrDefault("PINECONE_BASE_URL", "https://api.pinecone.io"),
					IndexName: getStringOrDefault("PINECONE_INDEX_NAME", ""),
					Dimension: getIntOrDefault("PINECONE_DIMENSION", 1536),
				},
				Neo4j: Neo4jConfig{
					Enabled:  getBoolOrDefault("NEO4J_ENABLED", false),
					URI:      getStringOrDefault("NEO4J_URI", "bolt://localhost:7687"),
					Username: getStringOrDefault("NEO4J_USERNAME", "neo4j"),
					Password: getStringOrDefault("NEO4J_PASSWORD", ""),
					Database: getStringOrDefault("NEO4J_DATABASE", "neo4j"),
				},
			},
			Voice: VoiceConfig{
				Qiniu: QiniuVoiceConfig{
					ASRAPIKey:  getStringOrDefault("QINIU_ASR_API_KEY", ""),
					ASRBaseURL: getStringOrDefault("QINIU_ASR_BASE_URL", ""),
					TTSAPIKey:  getStringOrDefault("QINIU_TTS_API_KEY", ""),
					TTSBaseURL: getStringOrDefault("QINIU_TTS_BASE_URL", ""),
				},
				Xunfei: XunfeiVoiceConfig{
					WSAppId:     getStringOrDefault("XUNFEI_WS_APP_ID", ""),
					WSAPIKey:    getStringOrDefault("XUNFEI_WS_API_KEY", ""),
					WSAPISecret: getStringOrDefault("XUNFEI_WS_API_SECRET", ""),
				},
			},
			Storage: StorageConfig{
				BaseURL:   getStringOrDefault("LINGSTORAGE_BASE_URL", "https://api.lingstorage.com"),
				APIKey:    getStringOrDefault("LINGSTORAGE_API_KEY", ""),
				APISecret: getStringOrDefault("LINGSTORAGE_API_SECRET", ""),
				Bucket:    getStringOrDefault("LINGSTORAGE_BUCKET", "default"),
			},
		},
		Features: FeaturesConfig{
			SearchEnabled:   getBoolOrDefault("SEARCH_ENABLED", false),
			SearchPath:      getStringOrDefault("SEARCH_PATH", "./search"),
			SearchBatchSize: getIntOrDefault("SEARCH_BATCH_SIZE", 100),
			LanguageEnabled: getBoolOrDefault("LANGUAGE_ENABLED", true),
			BackupEnabled:   getBoolOrDefault("BACKUP_ENABLED", false),
			BackupPath:      getStringOrDefault("BACKUP_PATH", "./backups"),
			BackupSchedule:  getStringOrDefault("BACKUP_SCHEDULE", "0 2 * * *"),
		},
		Middleware: loadMiddlewareConfig(),
	}
	GlobalStore = lingstorage.NewClient(&lingstorage.Config{
		BaseURL:   GlobalConfig.Services.Storage.BaseURL,
		APIKey:    GlobalConfig.Services.Storage.APIKey,
		APISecret: GlobalConfig.Services.Storage.APISecret,
	})

	return nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	// Validate database configuration
	if c.Database.DSN == "" {
		return errors.New("database DSN is required")
	}

	// Validate server configuration
	if c.Server.Addr == "" {
		return errors.New("server address is required")
	}

	// Validate knowledge base configuration
	if c.Services.KnowledgeBase.Enabled {
		if c.Services.KnowledgeBase.Provider == "" {
			return errors.New("knowledge base provider is required when enabled")
		}

		switch c.Services.KnowledgeBase.Provider {
		case "aliyun":
			if c.Services.KnowledgeBase.Bailian.AccessKeyId == "" || c.Services.KnowledgeBase.Bailian.AccessKeySecret == "" {
				return errors.New("bailian access key and secret are required")
			}
		case "milvus":
			if c.Services.KnowledgeBase.Milvus.Address == "" {
				return errors.New("milvus address is required")
			}
		case "qdrant":
			if c.Services.KnowledgeBase.Qdrant.BaseURL == "" {
				return errors.New("qdrant base URL is required")
			}
		case "elasticsearch":
			if c.Services.KnowledgeBase.Elasticsearch.BaseURL == "" {
				return errors.New("elasticsearch base URL is required")
			}
		case "pinecone":
			if c.Services.KnowledgeBase.Pinecone.APIKey == "" || c.Services.KnowledgeBase.Pinecone.IndexName == "" {
				return errors.New("pinecone API key and index name are required")
			}
		}
	}

	// Validate Neo4j configuration
	if c.Services.KnowledgeBase.Neo4j.Enabled {
		if c.Services.KnowledgeBase.Neo4j.URI == "" {
			return errors.New("neo4j URI is required when enabled")
		}
	}

	return nil
}

// getStringOrDefault gets environment variable value, returns default if empty
func getStringOrDefault(key, defaultValue string) string {
	value := utils.GetEnv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// getBoolOrDefault gets boolean environment variable value, returns default if empty
func getBoolOrDefault(key string, defaultValue bool) bool {
	value := utils.GetEnv(key)
	if value == "" {
		return defaultValue
	}
	return utils.GetBoolEnv(key)
}

// getIntOrDefault gets integer environment variable value, returns default if empty
func getIntOrDefault(key string, defaultValue int) int {
	value := utils.GetIntEnv(key)
	if value == 0 {
		return defaultValue
	}
	return int(value)
}

// generateDefaultSessionSecret generates default session secret (for development only)
func generateDefaultSessionSecret() string {
	if secret := utils.GetEnv("SESSION_SECRET"); secret != "" {
		return secret
	}
	return "default-secret-key-change-in-production-" + utils.RandText(16)
}

// loadCacheConfig loads cache configuration with all default values
func loadCacheConfig() cache.Config {
	cacheType := utils.GetEnv("CACHE_TYPE")
	if cacheType == "" {
		cacheType = "local"
	}
	parseDuration := func(s string, defaultVal time.Duration) time.Duration {
		if s == "" {
			return defaultVal
		}
		d, err := time.ParseDuration(s)
		if err != nil {
			return defaultVal
		}
		return d
	}
	redisAddr := utils.GetEnv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisDB := int(utils.GetIntEnv("REDIS_DB"))
	if redisDB == 0 {
		redisDB = 0
	}
	redisPoolSize := int(utils.GetIntEnv("REDIS_POOL_SIZE"))
	if redisPoolSize == 0 {
		redisPoolSize = 10
	}
	redisMinIdleConns := int(utils.GetIntEnv("REDIS_MIN_IDLE_CONNS"))
	if redisMinIdleConns == 0 {
		redisMinIdleConns = 5
	}
	localMaxSize := int(utils.GetIntEnv("LOCAL_CACHE_MAX_SIZE"))
	if localMaxSize == 0 {
		localMaxSize = 1000
	}
	localDefaultExpiration := parseDuration(utils.GetEnv("LOCAL_CACHE_DEFAULT_EXPIRATION"), 5*time.Minute)
	localCleanupInterval := parseDuration(utils.GetEnv("LOCAL_CACHE_CLEANUP_INTERVAL"), 10*time.Minute)
	return cache.Config{
		Type: cacheType,
		Redis: cache.RedisConfig{
			Addr:         redisAddr,
			Password:     utils.GetEnv("REDIS_PASSWORD"),
			DB:           redisDB,
			PoolSize:     redisPoolSize,
			MinIdleConns: redisMinIdleConns,
			DialTimeout:  parseDuration(utils.GetEnv("REDIS_DIAL_TIMEOUT"), 5*time.Second),
			ReadTimeout:  parseDuration(utils.GetEnv("REDIS_READ_TIMEOUT"), 3*time.Second),
			WriteTimeout: parseDuration(utils.GetEnv("REDIS_WRITE_TIMEOUT"), 3*time.Second),
			IdleTimeout:  parseDuration(utils.GetEnv("REDIS_IDLE_TIMEOUT"), 5*time.Minute),
		},
		Local: cache.LocalConfig{
			MaxSize:           localMaxSize,
			DefaultExpiration: localDefaultExpiration,
			CleanupInterval:   localCleanupInterval,
		},
	}
}

// loadMiddlewareConfig loads middleware configuration
func loadMiddlewareConfig() MiddlewareConfig {
	parseDuration := func(s string, defaultVal time.Duration) time.Duration {
		if s == "" {
			return defaultVal
		}
		d, err := time.ParseDuration(s)
		if err != nil {
			return defaultVal
		}
		return d
	}
	mode := getStringOrDefault("MODE", "development")
	var defaultConfig MiddlewareConfig

	if mode == "production" {
		defaultConfig = MiddlewareConfig{
			RateLimit: RateLimiterConfig{
				GlobalRPS:    2000,
				GlobalBurst:  4000,
				GlobalWindow: time.Minute,
				UserRPS:      200,
				UserBurst:    400,
				UserWindow:   time.Minute,
				IPRPS:        100,
				IPBurst:      200,
				IPWindow:     time.Minute,
			},
			Timeout: TimeoutConfig{
				DefaultTimeout: 30 * time.Second,
				FallbackResponse: map[string]interface{}{
					"error":   "service_unavailable",
					"message": "Service temporarily unavailable, please try again later",
					"code":    503,
				},
			},
			CircuitBreaker: CircuitBreakerConfig{
				FailureThreshold:      3,
				SuccessThreshold:      2,
				Timeout:               30 * time.Second,
				OpenTimeout:           30 * time.Second,
				MaxConcurrentRequests: 200,
			},
			EnableRateLimit:      true,
			EnableTimeout:        true,
			EnableCircuitBreaker: true,
			EnableOperationLog:   true,
		}
	} else {
		defaultConfig = MiddlewareConfig{
			RateLimit: RateLimiterConfig{
				GlobalRPS:    10000,
				GlobalBurst:  20000,
				GlobalWindow: time.Minute,
				UserRPS:      1000,
				UserBurst:    2000,
				UserWindow:   time.Minute,
				IPRPS:        500,
				IPBurst:      1000,
				IPWindow:     time.Minute,
			},
			Timeout: TimeoutConfig{
				DefaultTimeout: 60 * time.Second,
				FallbackResponse: map[string]interface{}{
					"error":   "service_unavailable",
					"message": "Service temporarily unavailable, please try again later",
					"code":    503,
				},
			},
			CircuitBreaker: CircuitBreakerConfig{
				FailureThreshold:      10,
				SuccessThreshold:      5,
				Timeout:               60 * time.Second,
				OpenTimeout:           60 * time.Second,
				MaxConcurrentRequests: 1000,
			},
			EnableRateLimit:      true,
			EnableTimeout:        true,
			EnableCircuitBreaker: false,
			EnableOperationLog:   true,
		}
	}
	return MiddlewareConfig{
		RateLimit: RateLimiterConfig{
			GlobalRPS:    getIntOrDefault("RATE_LIMIT_GLOBAL_RPS", defaultConfig.RateLimit.GlobalRPS),
			GlobalBurst:  getIntOrDefault("RATE_LIMIT_GLOBAL_BURST", defaultConfig.RateLimit.GlobalBurst),
			GlobalWindow: parseDuration(getStringOrDefault("RATE_LIMIT_GLOBAL_WINDOW", "1m"), defaultConfig.RateLimit.GlobalWindow),
			UserRPS:      getIntOrDefault("RATE_LIMIT_USER_RPS", defaultConfig.RateLimit.UserRPS),
			UserBurst:    getIntOrDefault("RATE_LIMIT_USER_BURST", defaultConfig.RateLimit.UserBurst),
			UserWindow:   parseDuration(getStringOrDefault("RATE_LIMIT_USER_WINDOW", "1m"), defaultConfig.RateLimit.UserWindow),
			IPRPS:        getIntOrDefault("RATE_LIMIT_IP_RPS", defaultConfig.RateLimit.IPRPS),
			IPBurst:      getIntOrDefault("RATE_LIMIT_IP_BURST", defaultConfig.RateLimit.IPBurst),
			IPWindow:     parseDuration(getStringOrDefault("RATE_LIMIT_IP_WINDOW", "1m"), defaultConfig.RateLimit.IPWindow),
		},
		Timeout: TimeoutConfig{
			DefaultTimeout:   parseDuration(getStringOrDefault("DEFAULT_TIMEOUT", "30s"), defaultConfig.Timeout.DefaultTimeout),
			FallbackResponse: defaultConfig.Timeout.FallbackResponse,
		},
		CircuitBreaker: CircuitBreakerConfig{
			FailureThreshold:      getIntOrDefault("CIRCUIT_BREAKER_FAILURE_THRESHOLD", defaultConfig.CircuitBreaker.FailureThreshold),
			SuccessThreshold:      getIntOrDefault("CIRCUIT_BREAKER_SUCCESS_THRESHOLD", defaultConfig.CircuitBreaker.SuccessThreshold),
			Timeout:               parseDuration(getStringOrDefault("CIRCUIT_BREAKER_TIMEOUT", "30s"), defaultConfig.CircuitBreaker.Timeout),
			OpenTimeout:           parseDuration(getStringOrDefault("CIRCUIT_BREAKER_OPEN_TIMEOUT", "30s"), defaultConfig.CircuitBreaker.OpenTimeout),
			MaxConcurrentRequests: getIntOrDefault("CIRCUIT_BREAKER_MAX_CONCURRENT", defaultConfig.CircuitBreaker.MaxConcurrentRequests),
		},
		EnableRateLimit:      getBoolOrDefault("ENABLE_RATE_LIMIT", defaultConfig.EnableRateLimit),
		EnableTimeout:        getBoolOrDefault("ENABLE_TIMEOUT", defaultConfig.EnableTimeout),
		EnableCircuitBreaker: getBoolOrDefault("ENABLE_CIRCUIT_BREAKER", defaultConfig.EnableCircuitBreaker),
		EnableOperationLog:   getBoolOrDefault("ENABLE_OPERATION_LOG", defaultConfig.EnableOperationLog),
	}
}
>>>>>>> 3dfadd85bd518bde3e99c3d51af6bb1fe0a2141c
