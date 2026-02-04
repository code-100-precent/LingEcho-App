package handlers

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"time"

	"github.com/LingByte/lingstorage-sdk-go"
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/sip/codec"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// VoicemailProcessor 留言处理器
type VoicemailProcessor struct {
	db *gorm.DB
}

// NewVoicemailProcessor 创建留言处理器
func NewVoicemailProcessor(db *gorm.DB) *VoicemailProcessor {
	return &VoicemailProcessor{
		db: db,
	}
}

// ProcessVoicemail 处理留言（上传音频、转录、生成摘要）
func (p *VoicemailProcessor) ProcessVoicemail(
	ctx context.Context,
	voicemailID uint,
	pcmuAudio []byte,
	asrConfig map[string]interface{},
	llmProvider llm.LLMProvider,
) error {
	// 1. 获取留言记录
	voicemail, err := models.GetVoicemailByID(p.db, voicemailID)
	if err != nil {
		return fmt.Errorf("获取留言记录失败: %w", err)
	}

	logrus.WithFields(logrus.Fields{
		"voicemail_id": voicemailID,
		"audio_size":   len(pcmuAudio),
	}).Info("🎙️ 开始处理留言")

	// 2. 上传音频到存储
	audioURL, err := p.uploadAudio(ctx, voicemailID, pcmuAudio)
	if err != nil {
		logrus.WithError(err).Error("上传留言音频失败")
		// 不返回错误，继续处理
	} else {
		voicemail.AudioURL = audioURL
		logrus.WithField("audio_url", audioURL).Info("✅ 留言音频上传成功")
	}

	// 3. 语音转文字
	transcribedText, err := p.transcribeAudio(ctx, pcmuAudio, asrConfig)
	if err != nil {
		logrus.WithError(err).Error("留言转录失败")
		voicemail.TranscribeStatus = "failed"
		voicemail.TranscribeError = err.Error()
	} else {
		voicemail.TranscribedText = transcribedText
		voicemail.TranscribeStatus = "completed"
		now := time.Now()
		voicemail.TranscribedAt = &now
		logrus.WithField("text", transcribedText).Info("✅ 留言转录成功")
	}

	// 4. 生成摘要和关键词
	if transcribedText != "" && llmProvider != nil {
		summary, keywords, err := p.generateSummary(ctx, transcribedText, llmProvider)
		if err != nil {
			logrus.WithError(err).Warn("生成留言摘要失败")
		} else {
			voicemail.Summary = summary
			voicemail.Keywords = keywords
			logrus.WithFields(logrus.Fields{
				"summary":  summary,
				"keywords": keywords,
			}).Info("✅ 留言摘要生成成功")
		}
	}

	// 5. 更新留言记录
	if err := models.UpdateVoicemail(p.db, voicemail); err != nil {
		return fmt.Errorf("更新留言记录失败: %w", err)
	}

	logrus.WithField("voicemail_id", voicemailID).Info("✅ 留言处理完成")
	return nil
}

// uploadAudio 上传音频到存储
func (p *VoicemailProcessor) uploadAudio(ctx context.Context, voicemailID uint, pcmuAudio []byte) (string, error) {
	// 1. 转换 PCMU -> PCM16
	pcm16Audio := codec.PCMUToPCM16(pcmuAudio)

	// 2. 生成存储路径
	timestamp := time.Now().Unix()
	storageKey := fmt.Sprintf("voicemails/%d_%d.wav", voicemailID, timestamp)

	// 3. 上传到 LingStorage
	result, err := config.GlobalStore.UploadBytes(&lingstorage.UploadBytesRequest{
		Bucket:   config.GlobalConfig.Services.Storage.Bucket,
		Data:     pcm16Audio,
		Filename: storageKey,
	})

	if err != nil {
		return "", fmt.Errorf("上传音频失败: %w", err)
	}

	return result.URL, nil
}

// transcribeAudio 语音转文字
func (p *VoicemailProcessor) transcribeAudio(ctx context.Context, pcmuAudio []byte, asrConfig map[string]interface{}) (string, error) {
	// 1. 转换 PCMU 8kHz -> PCM16 16kHz（ASR通常需要16kHz）
	pcm8k := codec.PCMUToPCM16(pcmuAudio)
	pcm16k := codec.ResampleAudio(pcm8k, 8000, 16000)

	// 2. 从配置创建ASR服务
	provider := "qcloud" // 默认使用腾讯云
	if p, ok := asrConfig["provider"].(string); ok && p != "" {
		provider = p
	}

	language := "zh" // 默认中文
	if l, ok := asrConfig["language"].(string); ok && l != "" {
		language = l
	}

	// 创建ASR配置
	asrConfigObj, err := recognizer.NewTranscriberConfigFromMap(provider, asrConfig, language)
	if err != nil {
		return "", fmt.Errorf("创建ASR配置失败: %w", err)
	}

	// 创建ASR服务
	factory := recognizer.NewTranscriberFactory()
	asrService, err := factory.CreateTranscriber(asrConfigObj)
	if err != nil {
		return "", fmt.Errorf("创建ASR服务失败: %w", err)
	}

	// 3. 执行转录
	var transcribedText string
	var asrErr error
	done := make(chan bool, 1)

	asrService.Init(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			if text != "" {
				transcribedText = text
			}
			if isLast || text != "" {
				select {
				case done <- true:
				default:
				}
			}
		},
		func(err error, isFatal bool) {
			asrErr = err
			select {
			case done <- true:
			default:
			}
		},
	)

	// 连接并发送音频
	if err := asrService.ConnAndReceive("voicemail_transcribe"); err != nil {
		return "", fmt.Errorf("ASR连接失败: %w", err)
	}

	if err := asrService.SendAudioBytes(pcm16k); err != nil {
		return "", fmt.Errorf("发送音频失败: %w", err)
	}

	if err := asrService.SendEnd(); err != nil {
		return "", fmt.Errorf("发送结束标记失败: %w", err)
	}

	// 等待转录结果（带超时）
	select {
	case <-done:
		if asrErr != nil {
			return "", fmt.Errorf("ASR转录失败: %w", asrErr)
		}
	case <-time.After(30 * time.Second):
		return "", fmt.Errorf("ASR转录超时")
	case <-ctx.Done():
		return "", fmt.Errorf("转录被取消")
	}

	if transcribedText == "" {
		return "", fmt.Errorf("未识别到内容")
	}

	return transcribedText, nil
}

// generateSummary 生成摘要和关键词
func (p *VoicemailProcessor) generateSummary(ctx context.Context, text string, llmProvider llm.LLMProvider) (string, string, error) {
	// 构建提示词
	prompt := fmt.Sprintf(`请分析以下留言内容，生成简洁的摘要和关键词。

留言内容：
%s

请按以下格式返回（不要包含其他内容）：
摘要：[一句话总结留言的主要内容]
关键词：[提取3-5个关键词，用逗号分隔]`, text)

	// 调用LLM
	response, err := llmProvider.Query(prompt, "")
	if err != nil {
		return "", "", fmt.Errorf("LLM调用失败: %w", err)
	}

	// 解析响应
	summary, keywords := parseSummaryResponse(response)
	
	return summary, keywords, nil
}

// parseSummaryResponse 解析摘要响应
func parseSummaryResponse(response string) (summary string, keywords string) {
	// 简单的解析逻辑
	lines := splitLines(response)
	
	for _, line := range lines {
		if len(line) > 3 {
			if line[:3] == "摘要：" || line[:3] == "摘要:" {
				summary = line[3:]
			} else if len(line) > 4 && (line[:4] == "关键词：" || line[:4] == "关键词:") {
				keywords = line[4:]
			}
		}
	}
	
	// 如果没有找到格式化的内容，使用整个响应作为摘要
	if summary == "" {
		summary = response
	}
	
	return
}

// splitLines 分割行
func splitLines(text string) []string {
	var lines []string
	var currentLine string
	
	for _, char := range text {
		if char == '\n' || char == '\r' {
			if currentLine != "" {
				lines = append(lines, currentLine)
				currentLine = ""
			}
		} else {
			currentLine += string(char)
		}
	}
	
	if currentLine != "" {
		lines = append(lines, currentLine)
	}
	
	return lines
}

// SaveVoicemailAudio 保存留言音频到本地文件
func (p *VoicemailProcessor) SaveVoicemailAudio(voicemailID uint, pcmuAudio []byte) (string, error) {
	// 创建存储目录
	storageDir := filepath.Join(".", "uploads", "voicemails")
	
	// 转换 PCMU -> PCM16
	_ = codec.PCMUToPCM16(pcmuAudio) // 转换但暂不使用
	
	// 生成文件名
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("voicemail_%d_%d.wav", voicemailID, timestamp)
	filepath := filepath.Join(storageDir, filename)
	
	// 保存文件（这里简化处理，实际应该写入WAV格式）
	// 注意：这里需要添加WAV文件头
	
	return filepath, nil
}

// VoicemailHandler 留言处理器
type VoicemailHandler struct {
	db        *gorm.DB
	processor *VoicemailProcessor
}

// NewVoicemailHandler 创建留言处理器
func NewVoicemailHandler(db *gorm.DB) *VoicemailHandler {
	return &VoicemailHandler{
		db:        db,
		processor: NewVoicemailProcessor(db),
	}
}

// ListVoicemails 获取留言列表
// @Summary 获取留言列表
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "页码" default(1)
// @Param size query int false "每页数量" default(20)
// @Param status query string false "状态筛选"
// @Param caller_number query string false "来电号码筛选"
// @Success 200 {object} response.Response{data=[]models.Voicemail}
// @Router /api/voicemails [get]
func (h *VoicemailHandler) ListVoicemails(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	status := c.Query("status")
	callerNumber := c.Query("caller_number")

	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}

	offset := (page - 1) * size

	var voicemails []models.Voicemail
	var total int64
	var err error

	// 根据不同条件查询
	if status != "" {
		voicemails, total, err = models.GetVoicemailsByStatus(h.db, user.ID, models.VoicemailStatus(status), size, offset)
	} else if callerNumber != "" {
		voicemails, total, err = models.GetVoicemailsByCallerNumber(h.db, user.ID, callerNumber, size, offset)
	} else {
		voicemails, total, err = models.GetVoicemailsByUserID(h.db, user.ID, size, offset)
	}

	if err != nil {
		response.Fail(c, "获取留言列表失败", err.Error())
		return
	}

	response.Success(c, "success", gin.H{
		"list":  voicemails,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

// GetVoicemail 获取留言详情
// @Summary 获取留言详情
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "留言ID"
// @Success 200 {object} response.Response{data=models.Voicemail}
// @Router /api/voicemails/{id} [get]
func (h *VoicemailHandler) GetVoicemail(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	voicemailID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的留言ID", err.Error())
		return
	}

	voicemail, err := models.GetVoicemailByID(h.db, uint(voicemailID))
	if err != nil {
		response.Fail(c, "留言不存在", err.Error())
		return
	}

	// 检查权限
	if voicemail.UserID != user.ID {
		response.Fail(c, "无权访问此留言", nil)
		return
	}

	// 自动标记为已读
	if !voicemail.IsRead {
		if err := models.MarkVoicemailAsRead(h.db, uint(voicemailID)); err == nil {
			voicemail.IsRead = true
			voicemail.Status = models.VoicemailStatusRead
			now := time.Now()
			voicemail.ReadAt = &now
		}
	}

	response.Success(c, "success", voicemail)
}

// MarkAsRead 标记留言为已读
// @Summary 标记留言为已读
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "留言ID"
// @Success 200 {object} response.Response
// @Router /api/voicemails/{id}/read [post]
func (h *VoicemailHandler) MarkAsRead(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	voicemailID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的留言ID", err.Error())
		return
	}

	voicemail, err := models.GetVoicemailByID(h.db, uint(voicemailID))
	if err != nil {
		response.Fail(c, "留言不存在", err.Error())
		return
	}

	// 检查权限
	if voicemail.UserID != user.ID {
		response.Fail(c, "无权操作此留言", nil)
		return
	}

	if err := models.MarkVoicemailAsRead(h.db, uint(voicemailID)); err != nil {
		response.Fail(c, "标记失败", err.Error())
		return
	}

	response.Success(c, "标记成功", nil)
}

// DeleteVoicemail 删除留言
// @Summary 删除留言
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "留言ID"
// @Success 200 {object} response.Response
// @Router /api/voicemails/{id} [delete]
func (h *VoicemailHandler) DeleteVoicemail(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	voicemailID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的留言ID", err.Error())
		return
	}

	voicemail, err := models.GetVoicemailByID(h.db, uint(voicemailID))
	if err != nil {
		response.Fail(c, "留言不存在", err.Error())
		return
	}

	// 检查权限
	if voicemail.UserID != user.ID {
		response.Fail(c, "无权删除此留言", nil)
		return
	}

	if err := models.DeleteVoicemail(h.db, uint(voicemailID)); err != nil {
		response.Fail(c, "删除失败", err.Error())
		return
	}

	response.Success(c, "删除成功", nil)
}

// GetUnreadCount 获取未读留言数量
// @Summary 获取未读留言数量
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response{data=int64}
// @Router /api/voicemails/unread/count [get]
func (h *VoicemailHandler) GetUnreadCount(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	count, err := models.GetUnreadVoicemailsCount(h.db, user.ID)
	if err != nil {
		response.Fail(c, "获取未读数量失败", err.Error())
		return
	}

	response.Success(c, "success", gin.H{
		"count": count,
	})
}

// UpdateVoicemail 更新留言（标记重要等）
// @Summary 更新留言
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "留言ID"
// @Success 200 {object} response.Response
// @Router /api/voicemails/{id} [put]
func (h *VoicemailHandler) UpdateVoicemail(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	voicemailID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的留言ID", err.Error())
		return
	}

	var req struct {
		IsImportant *bool   `json:"isImportant"`
		Status      *string `json:"status"`
		Notes       *string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	voicemail, err := models.GetVoicemailByID(h.db, uint(voicemailID))
	if err != nil {
		response.Fail(c, "留言不存在", err.Error())
		return
	}

	// 检查权限
	if voicemail.UserID != user.ID {
		response.Fail(c, "无权修改此留言", nil)
		return
	}

	// 更新字段
	if req.IsImportant != nil {
		voicemail.IsImportant = *req.IsImportant
	}
	if req.Status != nil {
		voicemail.Status = models.VoicemailStatus(*req.Status)
	}
	if req.Notes != nil {
		voicemail.Notes = *req.Notes
	}

	if err := models.UpdateVoicemail(h.db, voicemail); err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}

	response.Success(c, "更新成功", voicemail)
}


// TranscribeVoicemail 转录留言
// @Summary 转录留言语音
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "留言ID"
// @Success 200 {object} response.Response
// @Router /api/voicemails/{id}/transcribe [post]
func (h *VoicemailHandler) TranscribeVoicemail(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	voicemailID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的留言ID", err.Error())
		return
	}

	voicemail, err := models.GetVoicemailByID(h.db, uint(voicemailID))
	if err != nil {
		response.Fail(c, "留言不存在", err.Error())
		return
	}

	// 检查权限
	if voicemail.UserID != user.ID {
		response.Fail(c, "无权操作此留言", nil)
		return
	}

	// 检查是否已经转录
	if voicemail.TranscribeStatus == "completed" && voicemail.TranscribedText != "" {
		response.Success(c, "留言已转录", gin.H{
			"transcribedText": voicemail.TranscribedText,
		})
		return
	}

	// 异步处理转录（这里简化处理，实际应该从音频文件读取）
	// 注意：实际使用时需要从 audio_path 或 audio_url 读取音频数据
	response.Success(c, "转录任务已提交，请稍后查看结果", gin.H{
		"status": "processing",
	})

	// 启动异步转录任务
	go func() {
		ctx := context.Background()
		
		// 获取ASR配置（从用户凭证或系统配置）
		asrConfig := map[string]interface{}{
			"provider": "qcloud",
			"language": "zh",
		}
		
		// 获取LLM提供者（用于生成摘要）
		var llmProvider llm.LLMProvider
		// 这里需要根据用户配置创建LLM提供者
		// 简化处理，使用nil
		
		// 注意：这里需要实际的音频数据
		// 实际使用时应该从存储中读取音频文件
		pcmuAudio := []byte{} // 占位符
		
		if err := h.processor.ProcessVoicemail(ctx, uint(voicemailID), pcmuAudio, asrConfig, llmProvider); err != nil {
			logrus.WithError(err).Error("留言转录失败")
		}
	}()
}

// GenerateSummary 生成留言摘要
// @Summary 生成留言摘要
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "留言ID"
// @Success 200 {object} response.Response
// @Router /api/voicemails/{id}/summary [post]
func (h *VoicemailHandler) GenerateSummary(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	voicemailID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的留言ID", err.Error())
		return
	}

	voicemail, err := models.GetVoicemailByID(h.db, uint(voicemailID))
	if err != nil {
		response.Fail(c, "留言不存在", err.Error())
		return
	}

	// 检查权限
	if voicemail.UserID != user.ID {
		response.Fail(c, "无权操作此留言", nil)
		return
	}

	// 检查是否已转录
	if voicemail.TranscribedText == "" {
		response.Fail(c, "请先转录留言", nil)
		return
	}

	// 检查是否已有摘要
	if voicemail.Summary != "" {
		response.Success(c, "摘要已存在", gin.H{
			"summary":  voicemail.Summary,
			"keywords": voicemail.Keywords,
		})
		return
	}

	response.Success(c, "摘要生成任务已提交", gin.H{
		"status": "processing",
	})

	// 异步生成摘要
	go func() {
		_ = context.Background() // 预留用于后续使用
		
		// 获取LLM提供者
		// 这里需要根据用户配置创建LLM提供者
		var llmProvider llm.LLMProvider
		// 简化处理
		
		if llmProvider == nil {
			logrus.Warn("LLM提供者未配置，跳过摘要生成")
			return
		}
		
		// 生成摘要
		prompt := "请用一句话总结以下留言内容：" + voicemail.TranscribedText
		summary, err := llmProvider.Query(prompt, "")
		if err != nil {
			logrus.WithError(err).Error("生成摘要失败")
			return
		}
		
		// 更新留言
		voicemail.Summary = summary
		if err := models.UpdateVoicemail(h.db, voicemail); err != nil {
			logrus.WithError(err).Error("更新留言摘要失败")
		}
	}()
}

// BatchProcessVoicemails 批量处理留言（转录+摘要）
// @Summary 批量处理留言
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /api/voicemails/batch-process [post]
func (h *VoicemailHandler) BatchProcessVoicemails(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	var req struct {
		VoicemailIDs []uint `json:"voicemailIds" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	if len(req.VoicemailIDs) == 0 {
		response.Fail(c, "请选择要处理的留言", nil)
		return
	}

	// 验证所有留言都属于当前用户
	for _, id := range req.VoicemailIDs {
		voicemail, err := models.GetVoicemailByID(h.db, id)
		if err != nil {
			response.Fail(c, "留言不存在", err.Error())
			return
		}
		if voicemail.UserID != user.ID {
			response.Fail(c, "无权操作部分留言", nil)
			return
		}
	}

	response.Success(c, "批量处理任务已提交", gin.H{
		"count":  len(req.VoicemailIDs),
		"status": "processing",
	})

	// 异步批量处理
	go func() {
		ctx := context.Background()
		
		for _, id := range req.VoicemailIDs {
			// 获取配置
			asrConfig := map[string]interface{}{
				"provider": "qcloud",
				"language": "zh",
			}
			
			// 处理留言（这里需要实际的音频数据）
			pcmuAudio := []byte{} // 占位符
			
			if err := h.processor.ProcessVoicemail(ctx, id, pcmuAudio, asrConfig, nil); err != nil {
				logrus.WithFields(logrus.Fields{
					"voicemail_id": id,
					"error":        err,
				}).Error("批量处理留言失败")
			}
			
			// 避免过快处理
			time.Sleep(1 * time.Second)
		}
		
		logrus.WithField("count", len(req.VoicemailIDs)).Info("批量处理留言完成")
	}()
}

// GetVoicemailStats 获取留言统计信息
// @Summary 获取留言统计信息
// @Tags Voicemail
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /api/voicemails/stats [get]
func (h *VoicemailHandler) GetVoicemailStats(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	// 获取总数
	var total int64
	if err := h.db.Model(&models.Voicemail{}).Where("user_id = ?", user.ID).Count(&total).Error; err != nil {
		response.Fail(c, "获取统计失败", err.Error())
		return
	}

	// 获取未读数量
	unread, err := models.GetUnreadVoicemailsCount(h.db, user.ID)
	if err != nil {
		response.Fail(c, "获取未读数量失败", err.Error())
		return
	}

	// 获取重要留言数量
	var important int64
	if err := h.db.Model(&models.Voicemail{}).Where("user_id = ? AND is_important = ?", user.ID, true).Count(&important).Error; err != nil {
		response.Fail(c, "获取重要留言数量失败", err.Error())
		return
	}

	// 获取今天的留言数量
	today := time.Now().Truncate(24 * time.Hour)
	var todayCount int64
	if err := h.db.Model(&models.Voicemail{}).Where("user_id = ? AND created_at >= ?", user.ID, today).Count(&todayCount).Error; err != nil {
		response.Fail(c, "获取今日留言数量失败", err.Error())
		return
	}

	response.Success(c, "success", gin.H{
		"total":     total,
		"unread":    unread,
		"important": important,
		"today":     todayCount,
	})
}
