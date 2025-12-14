package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-gonic/gin"
)

// UpdateRateLimiterConfig updates rate limiter configuration
func (h *Handlers) UpdateRateLimiterConfig(c *gin.Context) {
	//var config middleware.RateLimiterConfig
	//if err := c.ShouldBindJSON(&config); err != nil {
	//	response.Fail(c, "invalid request", nil)
	//	return
	//}

	// Update rate limiter configuration
	//middleware.SetRateLimiterConfig(config)
	response.Success(c, "rate limiter config updated", nil)
}

// HealthCheck health check endpoint
func (h *Handlers) HealthCheck(c *gin.Context) {
	// Check database connection
	sqlDB, err := h.db.DB()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": "database connection failed"})
		return
	}
	if err := sqlDB.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": "database ping failed"})
		return
	}

	// Return health status
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

// SystemInit system initialization endpoint, returns basic configuration information
func (h *Handlers) SystemInit(c *gin.Context) {
	// Get database type
	dbDriver := config.GlobalConfig.DBDriver
	if dbDriver == "" {
		dbDriver = "sqlite"
	}

	// Determine if it's a memory database (SQLite file database may also lose data due to file loss, etc.)
	// Only persistent databases like MySQL and PostgreSQL don't need warnings
	isMemoryDB := strings.ToLower(dbDriver) == "sqlite"

	// Check if email configuration is complete
	mailConfig := config.GlobalConfig.Mail
	emailConfigured := mailConfig.Host != "" &&
		mailConfig.Port > 0 &&
		mailConfig.Username != "" &&
		mailConfig.Password != "" &&
		mailConfig.From != ""

	// Get voice clone configurations (from database first, then from .env)
	xunfeiConfig := h.getVoiceCloneConfig("xunfei")
	volcengineConfig := h.getVoiceCloneConfig("volcengine")

	// Return initialization information
	response.Success(c, "System initialization info", gin.H{
		"database": gin.H{
			"driver":     dbDriver,
			"isMemoryDB": isMemoryDB,
		},
		"email": gin.H{
			"configured": emailConfigured,
		},
		"voiceClone": gin.H{
			"xunfei": gin.H{
				"configured": xunfeiConfig != nil,
				"config":     xunfeiConfig,
			},
			"volcengine": gin.H{
				"configured": volcengineConfig != nil,
				"config":     volcengineConfig,
			},
		},
	})
}

// getVoiceCloneConfig 获取音色克隆配置（先从数据库读，再从.env读）
func (h *Handlers) getVoiceCloneConfig(provider string) map[string]interface{} {
	var configKey string
	var envConfig map[string]interface{}

	switch provider {
	case "xunfei":
		configKey = constants.KEY_VOICE_CLONE_XUNFEI_CONFIG
		// 从 .env 读取配置
		envConfig = map[string]interface{}{
			"app_id":        utils.GetEnv("XUNFEI_APP_ID"),
			"api_key":       utils.GetEnv("XUNFEI_API_KEY"),
			"base_url":      utils.GetEnv("XUNFEI_BASE_URL"),
			"ws_app_id":     utils.GetEnv("XUNFEI_WS_APP_ID"),
			"ws_api_key":    utils.GetEnv("XUNFEI_WS_API_KEY"),
			"ws_api_secret": utils.GetEnv("XUNFEI_WS_API_SECRET"),
		}
		if envConfig["base_url"] == "" {
			envConfig["base_url"] = "http://opentrain.xfyousheng.com"
		}
	case "volcengine":
		configKey = constants.KEY_VOICE_CLONE_VOLCENGINE_CONFIG
		// 从 .env 读取配置
		envConfig = map[string]interface{}{
			"app_id":         utils.GetEnv("VOLCENGINE_CLONE_APP_ID"),
			"token":          utils.GetEnv("VOLCENGINE_CLONE_TOKEN"),
			"cluster":        utils.GetEnv("VOLCENGINE_CLONE_CLUSTER"),
			"voice_type":     utils.GetEnv("VOLCENGINE_CLONE_VOICE_TYPE"),
			"encoding":       utils.GetEnv("VOLCENGINE_CLONE_ENCODING"),
			"frame_duration": utils.GetEnv("VOLCENGINE_CLONE_FRAME_DURATION"),
		}
		if envConfig["cluster"] == "" {
			envConfig["cluster"] = "volcano_icl"
		}
		if sampleRate := utils.GetIntEnv("VOLCENGINE_CLONE_SAMPLE_RATE"); sampleRate > 0 {
			envConfig["sample_rate"] = sampleRate
		}
		if bitDepth := utils.GetIntEnv("VOLCENGINE_CLONE_BIT_DEPTH"); bitDepth > 0 {
			envConfig["bit_depth"] = bitDepth
		}
		if channels := utils.GetIntEnv("VOLCENGINE_CLONE_CHANNELS"); channels > 0 {
			envConfig["channels"] = channels
		}
		if speedRatio := utils.GetFloatEnv("VOLCENGINE_CLONE_SPEED_RATIO"); speedRatio > 0 {
			envConfig["speed_ratio"] = speedRatio
		}
		if trainingTimes := utils.GetIntEnv("VOLCENGINE_CLONE_TRAINING_TIMES"); trainingTimes > 0 {
			envConfig["training_times"] = trainingTimes
		}
	default:
		return nil
	}

	// 先从数据库读取
	dbConfigStr := utils.GetValue(h.db, configKey)
	if dbConfigStr != "" {
		var dbConfig map[string]interface{}
		if err := json.Unmarshal([]byte(dbConfigStr), &dbConfig); err == nil {
			// 检查是否配置完整（至少要有必需的字段）
			if h.isConfigValid(provider, dbConfig) {
				return dbConfig
			}
		}
	}

	// 如果数据库没有或配置不完整，从 .env 读取
	if h.isConfigValid(provider, envConfig) {
		return envConfig
	}

	return nil
}

// isConfigValid 检查配置是否有效
func (h *Handlers) isConfigValid(provider string, config map[string]interface{}) bool {
	if config == nil {
		return false
	}

	switch provider {
	case "xunfei":
		appID, _ := config["app_id"].(string)
		apiKey, _ := config["api_key"].(string)
		return appID != "" && apiKey != ""
	case "volcengine":
		appID, _ := config["app_id"].(string)
		token, _ := config["token"].(string)
		return appID != "" && token != ""
	default:
		return false
	}
}

// SaveVoiceCloneConfig 保存音色克隆配置
func (h *Handlers) SaveVoiceCloneConfig(c *gin.Context) {
	var req struct {
		Provider string                 `json:"provider" binding:"required"`
		Config   map[string]interface{} `json:"config" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err.Error())
		return
	}

	// 验证配置
	if !h.isConfigValid(req.Provider, req.Config) {
		response.Fail(c, "配置无效", "请确保填写了所有必需的配置项")
		return
	}

	// 确定配置键
	var configKey string
	switch req.Provider {
	case "xunfei":
		configKey = constants.KEY_VOICE_CLONE_XUNFEI_CONFIG
	case "volcengine":
		configKey = constants.KEY_VOICE_CLONE_VOLCENGINE_CONFIG
	default:
		response.Fail(c, "不支持的提供商", "只支持 xunfei 和 volcengine")
		return
	}

	// 序列化为 JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		response.Fail(c, "序列化配置失败", err.Error())
		return
	}

	// 保存到数据库
	utils.SetValue(h.db, configKey, string(configJSON), "json", true, true)

	response.Success(c, "配置保存成功", nil)
}
