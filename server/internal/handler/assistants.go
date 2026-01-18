package handlers

import (
	apperrors "github.com/code-100-precent/LingEcho/pkg/errors"
	"github.com/code-100-precent/LingEcho/pkg/response"

	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/code-100-precent/LingEcho"
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/graph"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// hashString 计算字符串的哈希值（用于灰度发布）
func hashString(s string) int {
	hash := sha256.Sum256([]byte(s))
	hashStr := hex.EncodeToString(hash[:])
	// 取前8个字符转换为整数
	val, _ := strconv.ParseInt(hashStr[:8], 16, 64)
	return int(val % 100)
}

// CreateAssistant create new assistant
func (h *Handlers) CreateAssistant(c *gin.Context) {
	var input struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
		GroupID     *uint  `json:"groupId,omitempty"` // Organization ID, if set, creates a shared assistant for the organization
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	user := models.CurrentUser(c)

	// If an organization ID is specified, verify that the user has permission to create a shared assistant in that organization
	if input.GroupID != nil {
		var group models.Group
		if err := h.db.First(&group, *input.GroupID).Error; err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Organization does not exist"))
			return
		}
		// Check if the user is the creator or administrator of the organization
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", *input.GroupID, user.ID, models.GroupRoleAdmin).First(&member).Error; err != nil {
				apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Insufficient permissions"))
				return
			}
		}
	}

	assistant := models.Assistant{
		UserID:       user.ID,
		GroupID:      input.GroupID,
		Name:         input.Name,
		Description:  input.Description,
		Icon:         input.Icon,
		SystemPrompt: "empty system prompt",
		PersonaTag:   "mentor",
		Temperature:  0.6,
		MaxTokens:    150,
		JsSourceID:   strconv.FormatInt(utils.SnowflakeUtil.NextID(), 20),
		Language:     "zh-cn",
		Speaker:      "101016",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.db.Create(&assistant).Error; err != nil {
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrInternalServer, fmt.Sprintf("Failed to create assistant %s", assistant.Name)))
		return
	}
	utils.Sig().Emit(constants.AssistantCreate, user, h.db, assistant)
	apperrors.RespondSuccess(c, assistant)
}

// ListAssistants Query all assistants of the current user, including organization-shared assistants
func (h *Handlers) ListAssistants(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}
	var list []models.Assistant

	// Query user's own assistants and organization-shared assistants
	// 1. Assistants created by the user (user_id = ?)
	// 2. Organization-shared assistants (group_id IN (list of organization IDs the user belongs to))
	var groupIDs []uint
	h.db.Model(&models.GroupMember{}).
		Where("user_id = ?", user.ID).
		Pluck("group_id", &groupIDs)

	query := h.db.Model(&models.Assistant{})
	if len(groupIDs) > 0 {
		// User's own assistants OR organization-shared assistants
		query = query.Where("user_id = ? OR (group_id IN ? AND group_id IS NOT NULL)", user.ID, groupIDs)
	} else {
		// Only query user's own assistants
		query = query.Where("user_id = ?", user.ID)
	}

	if err := query.Order("created_at desc").Find(&list).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "select assistants failed"))
		return
	}

	apperrors.RespondSuccess(c, list)
}

// GetAssistant Query a single assistant
func (h *Handlers) GetAssistant(c *gin.Context) {
	user := models.CurrentUser(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var assistant models.Assistant
	if err := h.db.First(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}
	if user.ID != assistant.UserID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "permission denied"))
		return
	}
	apperrors.RespondSuccess(c, assistant)
}

// UpdateAssistant Update assistant
func (h *Handlers) UpdateAssistant(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var input struct {
		Name                 string   `json:"name"`
		Description          string   `json:"description"`
		Icon                 string   `json:"icon"`
		SystemPrompt         string   `json:"systemPrompt"`
		PersonaTag           string   `json:"persona_tag"`
		Temperature          float32  `json:"temperature"`
		MaxTokens            int      `json:"maxTokens"`
		Language             string   `json:"language"`
		Speaker              string   `json:"speaker"`
		VoiceCloneId         *int     `json:"voiceCloneId"`
		KnowledgeBaseId      *string  `json:"knowledgeBaseId"`
		TtsProvider          string   `json:"ttsProvider"`
		ApiKey               string   `json:"apiKey"`
		ApiSecret            string   `json:"apiSecret"`
		LLMModel             string   `json:"llmModel"` // LLM model name
		EnableGraphMemory    *bool    `json:"enableGraphMemory"`
		EnableVAD            *bool    `json:"enableVAD"`            // 是否启用VAD
		VADThreshold         *float64 `json:"vadThreshold"`         // VAD阈值
		VADConsecutiveFrames *int     `json:"vadConsecutiveFrames"` // VAD连续帧数
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "invalid request"))
		return
	}

	var assistant models.Assistant
	if err := h.db.First(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// Update fields
	updateData := map[string]interface{}{
		"updated_at": time.Now(),
	}

	// Only update non-empty fields
	if input.Name != "" {
		updateData["name"] = input.Name
	}
	if input.Description != "" {
		updateData["description"] = input.Description
	}
	if input.Icon != "" {
		updateData["icon"] = input.Icon
	}
	if input.SystemPrompt != "" {
		updateData["system_prompt"] = input.SystemPrompt
	}
	if input.PersonaTag != "" {
		updateData["persona_tag"] = input.PersonaTag
	}
	if input.Temperature != 0 {
		updateData["temperature"] = input.Temperature
	}
	if input.MaxTokens != 0 {
		updateData["max_tokens"] = input.MaxTokens
	}
	if input.Language != "" {
		updateData["language"] = input.Language
	}
	if input.Speaker != "" {
		updateData["speaker"] = input.Speaker
	}
	if input.VoiceCloneId != nil {
		updateData["voice_clone_id"] = input.VoiceCloneId
	}
	if input.KnowledgeBaseId != nil {
		updateData["knowledge_base_id"] = input.KnowledgeBaseId
	}
	if input.TtsProvider != "" {
		updateData["tts_provider"] = input.TtsProvider
	}
	if input.ApiKey != "" {
		updateData["api_key"] = input.ApiKey
	}
	if input.ApiSecret != "" {
		updateData["api_secret"] = input.ApiSecret
	}
	if input.LLMModel != "" {
		updateData["llm_model"] = input.LLMModel
	}
	if input.EnableGraphMemory != nil {
		updateData["enable_graph_memory"] = *input.EnableGraphMemory
	}
	if input.EnableVAD != nil {
		updateData["enable_vad"] = *input.EnableVAD
	}
	if input.VADThreshold != nil {
		updateData["vad_threshold"] = *input.VADThreshold
	}
	if input.VADConsecutiveFrames != nil {
		updateData["vad_consecutive_frames"] = *input.VADConsecutiveFrames
	}

	if err := h.db.Model(&assistant).Where("id = ?", id).Updates(updateData).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "update failed"))
		return
	}

	// Re-query the updated data
	if err := h.db.First(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "update failed"))
		return
	}

	apperrors.RespondSuccess(c, assistant)
}

// UpdateAssistantJS Update assistant JS template
func (h *Handlers) UpdateAssistantJS(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var input struct {
		JsSourceId string `json:"jsSourceId"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	var assistant models.Assistant
	if err := h.db.First(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// If a JS template ID is provided, verify that the template exists
	if input.JsSourceId != "" {
		_, err := models.GetJSTemplateByJsSourceID(h.db, input.JsSourceId)
		if err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Specified JS template does not exist"))
			return
		}
	}

	// Update JS template ID
	if err := h.db.Model(&assistant).Update("js_source_id", input.JsSourceId).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Update failed"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}

// GetAssistantGraphData 获取助手在图数据库中的图数据
func (h *Handlers) GetAssistantGraphData(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var assistant models.Assistant
	if err := h.db.First(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// 检查是否启用了 Neo4j
	if !config.GlobalConfig.Neo4jEnabled {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Neo4j not enabled"))
		return
	}

	// 检查助手是否启用了图记忆
	if !assistant.EnableGraphMemory {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Graph memory not enabled"))
		return
	}

	// 获取图数据
	store := graph.GetDefaultStore()
	if store == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Graph store not available"))
		return
	}

	ctx := c.Request.Context()
	graphData, err := store.GetAssistantGraphData(ctx, id)
	if err != nil {
		logger.Error("Failed to get assistant graph data", zap.Error(err), zap.Int64("assistantID", id))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Failed to get graph data"))
		return
	}

	apperrors.RespondSuccess(c, graphData)
}

// DeleteAssistant Delete assistant
func (h *Handlers) DeleteAssistant(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var assistant models.Assistant
	if err := h.db.First(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	if err := h.db.Delete(&assistant, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "delete failed"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}

func (h *Handlers) ServeVoiceSculptorLoaderJS(c *gin.Context) {
	jsSourceID := c.Param("id")
	var assistant models.Assistant
	err := h.db.Where("js_source_id = ?", jsSourceID).First(&assistant).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"code":  http.StatusNotFound,
			"error": "assistant is not exists",
			"data":  nil,
		})
		return
	}

	host := c.Request.Host
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s%s", scheme, host, config.GlobalConfig.APIPrefix)

	// Check if there is a bound JS template
	var templateContent string
	if assistant.JsSourceID != "" {
		// Try to get the bound JS template
		jsTemplate, err := models.GetJSTemplateByJsSourceID(h.db, assistant.JsSourceID)
		if err == nil && jsTemplate.Content != "" {
			// 检查是否有灰度版本
			activeVersion, err := models.GetActiveJSTemplateVersion(h.db, jsTemplate.ID)
			if err == nil && activeVersion != nil && activeVersion.Grayscale > 0 {
				// 使用灰度版本（根据用户ID或其他因素决定是否使用灰度版本）
				// 这里简化处理：如果灰度>0，使用版本内容；否则使用模板内容
				// 实际可以根据用户ID、IP等做更精细的灰度控制
				userHash := hashString(c.ClientIP() + c.GetHeader("User-Agent"))
				if userHash%100 < activeVersion.Grayscale {
					templateContent = activeVersion.Content
				} else {
					templateContent = jsTemplate.Content
				}
			} else {
				// Use the bound JS template
				templateContent = jsTemplate.Content
			}
		}
	}

	// If there is no bound JS template, use the default client.js
	if templateContent == "" {
		templateContent = LingEcho.AssistantJsModule
	}

	// Inject SDK at the beginning of the template content (if not already loaded)
	sdkPath := fmt.Sprintf("%s/static/js/lingecho-sdk.js", baseURL)
	sdkInjection := fmt.Sprintf(`
// LingEcho SDK - auto load
(function() {
    // If SDK is already loaded, return
    if (typeof LingEchoSDK !== 'undefined' && window.lingEcho) {
        console.log('[LingEcho] SDK already loaded');
        window.__LINGECHO_SDK_READY__ = true;
        return;
    }
    
    // Asynchronously load SDK
    (function loadSDK() {
        const script = document.createElement('script');
        script.src = '%s';
        script.async = false; // Ensure execution order
        script.onload = function() {
            console.log('[LingEcho] SDK script loaded');
            // Wait for SDK class definition
            (function waitForSDKClass() {
                if (typeof LingEchoSDK !== 'undefined') {
                    // SDK class is loaded, wait for instance creation or manual creation
                    (function waitForInstance() {
                        if (window.lingEcho) {
                            console.log('[LingEcho] SDK instance ready');
                            window.__LINGECHO_SDK_READY__ = true;
                            // Trigger custom event
                            if (typeof window.dispatchEvent !== 'undefined') {
                                window.dispatchEvent(new Event('lingecho-sdk-ready'));
                            }
                            return;
                        }
                        // If SDK class is loaded but instance is not created, try to create
                        if (typeof SERVER_BASE !== 'undefined' || (typeof window !== 'undefined' && window.SERVER_BASE)) {
                            try {
                                const serverBase = typeof SERVER_BASE !== 'undefined' ? SERVER_BASE : window.SERVER_BASE;
                                const assistantName = typeof ASSISTANT_NAME !== 'undefined' ? ASSISTANT_NAME : (window.ASSISTANT_NAME || '');
                                window.lingEcho = new LingEchoSDK({
                                    baseURL: serverBase,
                                    assistantName: assistantName
                                });
                                window.__LINGECHO_SDK_READY__ = true;
                                console.log('[LingEcho] SDK instance created');
                                if (typeof window.dispatchEvent !== 'undefined') {
                                    window.dispatchEvent(new Event('lingecho-sdk-ready'));
                                }
                                return;
                            } catch (e) {
                                console.error('[LingEcho] Failed to create SDK instance:', e);
                            }
                        }
                        // Continue waiting
                        setTimeout(waitForInstance, 100);
                    })();
                } else {
                    // SDK class is not defined yet, continue waiting
                    setTimeout(waitForSDKClass, 100);
                }
            })();
        };
        script.onerror = function() {
            console.error('[LingEcho] Failed to load SDK script');
            window.__LINGECHO_SDK_ERROR__ = true;
        };
        // Insert at the beginning of head, ensuring priority loading
        const head = document.head || document.getElementsByTagName('head')[0];
        head.insertBefore(script, head.firstChild);
    })();
})();

`, sdkPath)

	// Combine SDK and template content
	fullTemplateContent := sdkInjection + templateContent

	tmpl, err := template.New("verification").Parse(fullTemplateContent)
	if err != nil {
		logger.Error("failed to parse verification template: ", zap.Error(err))
	}
	data := struct {
		BaseURL        string
		Name           string
		AssistantID    int64
		JsSourceID     string
		Description    string
		Language       string
		Speaker        string
		TtsProvider    string
		LLMModel       string
		Temperature    float32
		MaxTokens      int
		ASSISTANT_NAME string
		SERVER_BASE    string
	}{
		BaseURL:        baseURL,
		Name:           assistant.Name,
		AssistantID:    assistant.ID,
		JsSourceID:     assistant.JsSourceID,
		Description:    assistant.Description,
		Language:       assistant.Language,
		Speaker:        assistant.Speaker,
		TtsProvider:    assistant.TtsProvider,
		LLMModel:       assistant.LLMModel,
		Temperature:    assistant.Temperature,
		MaxTokens:      assistant.MaxTokens,
		ASSISTANT_NAME: assistant.Name,
		SERVER_BASE:    baseURL,
	}
	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		logger.Error("failed to render loader template: ", zap.Error(err))
	}

	c.Header("Content-Type", "application/javascript; charset=utf-8")
	c.String(http.StatusOK, body.String())
}

// ListAssistantTools Get all tools of the assistant
func (h *Handlers) ListAssistantTools(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	assistantID, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	// Verify that the assistant exists and belongs to the current user
	var assistant models.Assistant
	if err := h.db.First(&assistant, assistantID).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// Get all tools (including disabled ones)
	var tools []models.AssistantTool
	if err := h.db.Where("assistant_id = ?", assistantID).
		Order("created_at ASC").
		Find(&tools).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "查询失败"))
		return
	}

	apperrors.RespondSuccess(c, tools)
}

// CreateAssistantTool Create a new tool
func (h *Handlers) CreateAssistantTool(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	assistantID, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	// Verify that the assistant exists and belongs to the current user
	var assistant models.Assistant
	if err := h.db.First(&assistant, assistantID).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	var input struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description" binding:"required"`
		Parameters  string `json:"parameters" binding:"required"` // JSON Schema格式
		Code        string `json:"code,omitempty"`                // 可选的代码实现（weather, calculator等）
		WebhookURL  string `json:"webhookUrl,omitempty"`          // Webhook URL（用于自定义工具执行）
		Enabled     bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	// Verify that name and description are not just whitespace
	if strings.TrimSpace(input.Name) == "" {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}
	if strings.TrimSpace(input.Description) == "" {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	// 验证name格式（只允许字母、数字、下划线、连字符）
	if matched, _ := regexp.MatchString(`^[a-zA-Z0-9_-]+$`, input.Name); !matched {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	// Verify that Parameters is valid JSON Schema
	var paramsSchema map[string]interface{}
	if err := json.Unmarshal([]byte(input.Parameters), &paramsSchema); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	// Verify JSON Schema basic structure
	if schemaType, ok := paramsSchema["type"].(string); !ok || schemaType != "object" {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	// Verify properties field (if exists)
	if properties, ok := paramsSchema["properties"].(map[string]interface{}); ok {
		// properties can be empty, but if it has values, they should be validated
		for _, prop := range properties {
			if propMap, ok := prop.(map[string]interface{}); ok {
				// Verify that each property has a type field
				if _, hasType := propMap["type"]; !hasType {
					apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
					return
				}
			}
		}
	}

	// Verify required field (if exists)
	if required, ok := paramsSchema["required"].([]interface{}); ok {
		// Verify that values in required are strings
		for _, req := range required {
			if _, ok := req.(string); !ok {
				apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
				return
			}
		}
	}

	// Verify: If webhook_url is provided, code should be empty or "webhook"
	if input.WebhookURL != "" {
		if input.Code != "" && input.Code != "webhook" {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
		// Verify webhook URL format
		if !isValidURL(input.WebhookURL) {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
	}

	tool := models.AssistantTool{
		AssistantID: assistantID,
		Name:        input.Name,
		Description: input.Description,
		Parameters:  input.Parameters,
		Code:        input.Code,
		WebhookURL:  input.WebhookURL,
		Enabled:     input.Enabled,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := models.CreateAssistantTool(h.db, &tool); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Creation failed"))
		return
	}

	apperrors.RespondSuccess(c, tool)
}

// UpdateAssistantTool Update tool
func (h *Handlers) UpdateAssistantTool(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	assistantID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	toolID, _ := strconv.ParseInt(c.Param("toolId"), 10, 64)

	// Verify that the assistant exists and belongs to the current user
	var assistant models.Assistant
	if err := h.db.First(&assistant, assistantID).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}
	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// Verify that the tool exists and belongs to the assistant
	if exists, err := models.IsAssistantToolOwner(h.db, toolID, assistantID); err != nil || !exists {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Parameters  string `json:"parameters"` // JSON Schema format
		Code        string `json:"code,omitempty"`
		WebhookURL  string `json:"webhookUrl,omitempty"`
		Enabled     *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	updates := make(map[string]interface{})
	if input.Name != "" {
		// Verify that name is not just whitespace
		if strings.TrimSpace(input.Name) == "" {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
		// Verify name format
		if matched, _ := regexp.MatchString(`^[a-zA-Z0-9_-]+$`, input.Name); !matched {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
		updates["name"] = input.Name
	}
	if input.Description != "" {
		// Verify that description is not just whitespace
		if strings.TrimSpace(input.Description) == "" {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
		updates["description"] = input.Description
	}
	if input.Parameters != "" {
		// Verify that Parameters is valid JSON Schema
		var paramsJSON map[string]interface{}
		if err := json.Unmarshal([]byte(input.Parameters), &paramsJSON); err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}

		// Verify JSON Schema basic structure
		if schemaType, ok := paramsJSON["type"].(string); !ok || schemaType != "object" {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}

		// Verify properties field (if exists)
		if properties, ok := paramsJSON["properties"].(map[string]interface{}); ok {
			for _, prop := range properties {
				if propMap, ok := prop.(map[string]interface{}); ok {
					if _, hasType := propMap["type"]; !hasType {
						apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
						return
					}
				}
			}
		}

		// Verify required field (if exists)
		if required, ok := paramsJSON["required"].([]interface{}); ok {
			for _, req := range required {
				if _, ok := req.(string); !ok {
					apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
					return
				}
			}
		}

		updates["parameters"] = input.Parameters
	}
	if input.Code != "" {
		updates["code"] = input.Code
	}
	if input.WebhookURL != "" {
		// Verify webhook URL format
		if !isValidURL(input.WebhookURL) {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
		// If webhook_url is provided, code should be empty or "webhook"
		if input.Code != "" && input.Code != "webhook" {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
			return
		}
		updates["webhook_url"] = input.WebhookURL
	}
	if input.Enabled != nil {
		updates["enabled"] = *input.Enabled
	}

	if len(updates) == 0 {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	if err := models.UpdateAssistantTool(h.db, toolID, assistantID, updates); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Update failed"))
		return
	}

	// Get the updated tool
	tool, err := models.GetAssistantToolByID(h.db, toolID, assistantID)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		return
	}

	apperrors.RespondSuccess(c, tool)
}

// DeleteAssistantTool Delete tool
func (h *Handlers) DeleteAssistantTool(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	assistantID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	toolID, _ := strconv.ParseInt(c.Param("toolId"), 10, 64)

	// Verify that the assistant exists and belongs to the current user
	var assistant models.Assistant
	if err := h.db.First(&assistant, assistantID).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}
	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// Verify that the tool exists and belongs to the assistant
	if exists, err := models.IsAssistantToolOwner(h.db, toolID, assistantID); err != nil || !exists {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	if err := models.DeleteAssistantTool(h.db, toolID, assistantID); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Deletion failed"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}

// TestAssistantTool Test tool execution
func (h *Handlers) TestAssistantTool(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "unauthorized"))
		return
	}

	assistantID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	toolID, _ := strconv.ParseInt(c.Param("toolId"), 10, 64)

	// Verify that the assistant exists and belongs to the current user
	var assistant models.Assistant
	if err := h.db.First(&assistant, assistantID).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}
	if assistant.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "forbidden"))
		return
	}

	// Verify that the tool exists and belongs to the assistant
	tool, err := models.GetAssistantToolByID(h.db, toolID, assistantID)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "not found"))
		return
	}

	var input struct {
		Args map[string]interface{} `json:"args" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Parameter error"))
		return
	}

	// Directly call the execution logic in assistant_tools.go to test the tool
	testResult, err := h.executeToolForTest(tool, input.Args)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Tool execution failed"))
		return
	}

	response.Success(c, "Tool test successful", gin.H{
		"result": testResult,
		"tool":   tool,
	})
}

// executeToolForTest Execute tool test (using execution logic in assistant_tools.go)
func (h *Handlers) executeToolForTest(tool *models.AssistantTool, args map[string]interface{}) (string, error) {
	// Call the executeToolCode method in assistant_tools.go
	// Since executeToolCode requires assistantID, we use 0 as a placeholder (test scenario)
	return h.executeToolCode(*tool, 0, args)
}

// isValidURL Validate URL format
func isValidURL(urlStr string) bool {
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return false
	}
	// Only allow HTTP and HTTPS protocols
	return parsedURL.Scheme == "http" || parsedURL.Scheme == "https"
}
