package middleware

import "strings"

// OperationLogConfig 操作日志配置
type OperationLogConfig struct {
	// 是否启用操作日志
	Enabled bool
	// 是否记录查询操作
	LogQueries bool
	// 重要操作模式
	ImportantPatterns map[string][]string
	// 不重要的POST操作
	UnimportantPostPaths []string
	// 系统内部操作路径
	SystemInternalPaths []string
	// 操作描述映射
	OperationDescriptions map[string]string
}

// DefaultOperationLogConfig 默认配置
func DefaultOperationLogConfig() *OperationLogConfig {
	return &OperationLogConfig{
		Enabled:    true,
		LogQueries: false,
		ImportantPatterns: map[string][]string{
			// 认证相关重要操作
			"auth": {
				"/api/auth/login",
				"/api/auth/register",
				"/api/auth/logout",
				"/api/auth/change-password",
				"/api/auth/reset-password",
				"/api/auth/verify-email",
				"/api/auth/two-factor",
			},
			// 用户资料重要操作
			"profile": {
				"/api/auth/update",
				"/api/auth/preferences",
			},
			// 通知重要操作
			"notification": {
				"/api/notification/mark-read",
				"/api/notification/delete",
				"/api/notification/clear",
			},
			// 助手重要操作
			"assistant": {
				"/api/assistant/create",
				"/api/assistant/update",
				"/api/assistant/delete",
			},
			// 聊天重要操作
			"chat": {
				"/api/chat/send",
				"/api/chat/delete",
				"/api/chat/clear",
			},
			// 语音训练重要操作
			"voice": {
				"/api/voice/training/create",
				"/api/voice/training/update",
				"/api/voice/training/delete",
			},
			// 知识库重要操作
			"knowledge": {
				"/api/knowledge/create",
				"/api/knowledge/update",
				"/api/knowledge/delete",
			},
			// 群组重要操作
			"group": {
				"/api/group/create",
				"/api/group/update",
				"/api/group/delete",
				"/api/group/join",
				"/api/group/leave",
			},
			// 凭证重要操作
			"credentials": {
				"/api/credentials/create",
				"/api/credentials/update",
				"/api/credentials/delete",
			},
			// 文件上传重要操作
			"upload": {
				"/api/upload",
			},
		},
		UnimportantPostPaths: []string{
			"/api/auth/refresh",      // token刷新
			"/api/notification/read", // 标记已读（批量操作）
			"/api/chat/typing",       // 输入状态
			"/api/voice/heartbeat",   // 语音心跳
			"/api/metrics/collect",   // 指标收集
		},
		SystemInternalPaths: []string{
			"/api/system/",
			"/api/internal/",
			"/api/debug/",
			"/api/test/",
		},
		OperationDescriptions: map[string]string{
			"/api/auth/login":             "用户登录",
			"/api/auth/logout":            "用户登出",
			"/api/auth/register":          "用户注册",
			"/api/auth/change-password":   "修改密码",
			"/api/auth/reset-password":    "重置密码",
			"/api/auth/update":            "更新个人资料",
			"/api/auth/preferences":       "更新偏好设置",
			"/api/auth/two-factor":        "两步验证操作",
			"/api/notification/mark-read": "标记通知已读",
			"/api/notification/delete":    "删除通知",
			"/api/notification/clear":     "清空通知",
			"/api/assistant/create":       "创建助手",
			"/api/assistant/update":       "更新助手",
			"/api/assistant/delete":       "删除助手",
			"/api/chat/send":              "发送消息",
			"/api/chat/delete":            "删除聊天记录",
			"/api/voice/training/create":  "创建语音训练",
			"/api/voice/training/update":  "更新语音训练",
			"/api/voice/training/delete":  "删除语音训练",
			"/api/knowledge/create":       "创建知识库",
			"/api/knowledge/update":       "更新知识库",
			"/api/knowledge/delete":       "删除知识库",
			"/api/group/create":           "创建群组",
			"/api/group/join":             "加入群组",
			"/api/group/leave":            "离开群组",
			"/api/upload":                 "文件上传",
		},
	}
}

// ShouldLogOperation 基于配置判断是否应该记录操作
func (config *OperationLogConfig) ShouldLogOperation(method, path string) bool {
	if !config.Enabled {
		return false
	}

	// 1. 如果不记录查询操作，跳过GET、HEAD、OPTIONS
	if !config.LogQueries && (method == "GET" || method == "HEAD" || method == "OPTIONS") {
		return false
	}

	// 2. 只记录写操作（POST、PUT、DELETE、PATCH）
	if method != "POST" && method != "PUT" && method != "DELETE" && method != "PATCH" {
		return false
	}

	// 3. 检查是否为重要操作
	return config.isImportantOperation(path, method)
}

// isImportantOperation 判断是否为重要操作
func (config *OperationLogConfig) isImportantOperation(path, method string) bool {
	// 检查是否匹配重要操作模式
	for _, patterns := range config.ImportantPatterns {
		for _, pattern := range patterns {
			if strings.HasPrefix(path, pattern) {
				return true
			}
		}
	}

	// 基于HTTP方法的重要性判断
	switch method {
	case "DELETE":
		// 删除操作通常都很重要
		return true
	case "POST":
		// POST操作需要进一步判断
		return config.isPostOperationImportant(path)
	case "PUT", "PATCH":
		// 更新操作通常重要，但排除一些系统内部操作
		return !config.isSystemInternalOperation(path)
	}

	return false
}

// isPostOperationImportant 判断POST操作是否重要
func (config *OperationLogConfig) isPostOperationImportant(path string) bool {
	// 排除一些不重要的POST操作
	for _, unimportantPath := range config.UnimportantPostPaths {
		if strings.HasPrefix(path, unimportantPath) {
			return false
		}
	}

	// 其他POST操作都认为是重要的
	return true
}

// isSystemInternalOperation 判断是否为系统内部操作
func (config *OperationLogConfig) isSystemInternalOperation(path string) bool {
	for _, internalPath := range config.SystemInternalPaths {
		if strings.HasPrefix(path, internalPath) {
			return true
		}
	}
	return false
}

// GetOperationDescription 获取操作描述
func (config *OperationLogConfig) GetOperationDescription(method, path string) string {
	// 首先尝试从配置中获取精确匹配的描述
	if desc, exists := config.OperationDescriptions[path]; exists {
		return desc
	}

	// 基于路径模式匹配
	for pattern, desc := range config.OperationDescriptions {
		if strings.Contains(path, pattern) {
			return desc
		}
	}

	// 基于HTTP方法的默认描述
	switch method {
	case "DELETE":
		return "删除操作"
	case "POST":
		return "创建操作"
	case "PUT":
		return "更新操作"
	case "PATCH":
		return "部分更新操作"
	default:
		return "用户操作"
	}
}
