package handlers

import (
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/sip/codec"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// convertOutgoingSession 转换sip包的OutgoingSession到handler的OutgoingSession
func convertOutgoingSession(sessionInterface interface{}) *OutgoingSession {
	// 使用反射获取字段值
	v := reflect.ValueOf(sessionInterface)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return nil
	}

	resp := &OutgoingSession{}

	// 获取字段值
	if field := v.FieldByName("RemoteRTPAddr"); field.IsValid() {
		resp.RemoteRTPAddr = field.String()
	}
	if field := v.FieldByName("CallID"); field.IsValid() {
		resp.CallID = field.String()
	}
	if field := v.FieldByName("TargetURI"); field.IsValid() {
		resp.TargetURI = field.String()
	}
	if field := v.FieldByName("Status"); field.IsValid() {
		resp.Status = field.String()
	}
	if field := v.FieldByName("Error"); field.IsValid() {
		resp.Error = field.String()
	}
	if field := v.FieldByName("StartTime"); field.IsValid() {
		if t, ok := field.Interface().(time.Time); ok {
			resp.StartTime = t.Format("2006-01-02T15:04:05Z07:00")
		}
	}
	if field := v.FieldByName("AnswerTime"); field.IsValid() {
		if field.Kind() == reflect.Ptr && !field.IsNil() {
			if t, ok := field.Elem().Interface().(time.Time); ok {
				answerTime := t.Format("2006-01-02T15:04:05Z07:00")
				resp.AnswerTime = &answerTime
			}
		}
	}
	if field := v.FieldByName("EndTime"); field.IsValid() {
		if field.Kind() == reflect.Ptr && !field.IsNil() {
			if t, ok := field.Elem().Interface().(time.Time); ok {
				endTime := t.Format("2006-01-02T15:04:05Z07:00")
				resp.EndTime = &endTime
			}
		}
	}

	return resp
}

// SipHandler SIP相关处理器
type SipHandler struct {
	db        *gorm.DB
	sipServer SipServerInterface // SIP服务器接口
}

// SipServerInterface SIP服务器接口，用于解耦
type SipServerInterface interface {
	MakeOutgoingCall(targetURI string) (string, error)
	GetOutgoingSession(callID string) (interface{}, bool) // 返回sip包的OutgoingSession
	CancelOutgoingCall(callID string) error
	HangupOutgoingCall(callID string) error // 挂断已接通的通话
}

// OutgoingSession 呼出会话信息（与sip包中的结构对应）
type OutgoingSession struct {
	RemoteRTPAddr string
	CallID        string
	TargetURI     string
	Status        string
	StartTime     string
	AnswerTime    *string
	EndTime       *string
	Error         string
}

// NewSipHandler 创建SIP处理器
func NewSipHandler(db *gorm.DB, sipServer SipServerInterface) *SipHandler {
	return &SipHandler{
		db:        db,
		sipServer: sipServer,
	}
}

// MakeOutgoingCallRequest 发起呼出请求
type MakeOutgoingCallRequest struct {
	TargetURI string `json:"targetUri" binding:"required"` // 目标URI，如: sip:user@192.168.1.100:5060
	UserID    *uint  `json:"userId,omitempty"`             // 关联用户ID（可选）
	GroupID   *uint  `json:"groupId,omitempty"`            // 关联组织ID（可选）
	Notes     string `json:"notes,omitempty"`              // 备注
}

// MakeOutgoingCallResponse 发起呼出响应
type MakeOutgoingCallResponse struct {
	CallID    string `json:"callId"`    // 通话ID
	Status    string `json:"status"`    // 状态
	TargetURI string `json:"targetUri"` // 目标URI
}

// MakeOutgoingCall 发起呼出呼叫
// @Summary 发起SIP呼出呼叫
// @Description 发起一个SIP呼出呼叫到指定的URI
// @Tags SIP
// @Accept json
// @Produce json
// @Param request body MakeOutgoingCallRequest true "呼出请求"
// @Success 200 {object} response.Response{data=MakeOutgoingCallResponse}
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/sip/calls/outgoing [post]
func (h *SipHandler) MakeOutgoingCall(c *gin.Context) {
	var req MakeOutgoingCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request: "+err.Error(), nil)
		return
	}

	// 验证targetURI格式
	if req.TargetURI == "" {
		response.Fail(c, "targetUri is required", nil)
		return
	}

	// 检查SIP服务器是否可用
	if h.sipServer == nil {
		response.Fail(c, "SIP server is not available", nil)
		return
	}

	// 发起呼出
	callID, err := h.sipServer.MakeOutgoingCall(req.TargetURI)
	if err != nil {
		logrus.WithError(err).Error("Failed to make outgoing call")
		response.Fail(c, "Failed to make call: "+err.Error(), nil)
		return
	}

	// 创建通话记录
	sipCall := &models.SipCall{
		CallID:    callID,
		Direction: models.SipCallDirectionOutbound,
		Status:    models.SipCallStatusCalling,
		ToURI:     req.TargetURI,
		StartTime: time.Now(),
		UserID:    req.UserID,
		GroupID:   req.GroupID,
		Notes:     req.Notes,
	}

	if err := models.CreateSipCall(h.db, sipCall); err != nil {
		logrus.WithError(err).Warn("Failed to create call record")
		// 不返回错误，因为呼叫已经发起
	}

	response.Success(c, "Call initiated successfully", MakeOutgoingCallResponse{
		CallID:    callID,
		Status:    "calling",
		TargetURI: req.TargetURI,
	})
}

// GetOutgoingCallStatus 获取呼出状态
// @Summary 获取呼出呼叫状态
// @Description 根据CallID获取呼出呼叫的当前状态
// @Tags SIP
// @Produce json
// @Param callId path string true "通话ID"
// @Success 200 {object} response.Response{data=OutgoingSession}
// @Failure 404 {object} response.Response
// @Router /api/sip/calls/outgoing/{callId} [get]
func (h *SipHandler) GetOutgoingCallStatus(c *gin.Context) {
	callID := c.Param("callId")
	if callID == "" {
		response.Fail(c, "callId is required", nil)
		return
	}

	// 检查SIP服务器是否可用
	if h.sipServer == nil {
		response.Fail(c, "SIP server is not available", nil)
		return
	}

	// 先从数据库查询通话记录
	sipCall, err := models.GetSipCallByCallID(h.db, callID)
	if err != nil {
		// 如果数据库中没有，尝试从SIP服务器获取会话信息
		sessionInterface, exists := h.sipServer.GetOutgoingSession(callID)
		if !exists {
			response.Fail(c, "Call not found", nil)
			return
		}

		// 转换为响应格式
		resp := convertOutgoingSession(sessionInterface)
		if resp == nil {
			response.Fail(c, "Failed to convert session", nil)
			return
		}

		response.Success(c, "Success", resp)
		return
	}

	// 如果数据库中有记录，也尝试从SIP服务器获取最新状态
	var resp *OutgoingSession
	if sessionInterface, exists := h.sipServer.GetOutgoingSession(callID); exists {
		resp = convertOutgoingSession(sessionInterface)
	}

	// 如果SIP服务器中没有会话，但从数据库中有记录，返回数据库中的信息
	if resp == nil {
		// 从数据库记录构建响应
		startTime := sipCall.StartTime.Format("2006-01-02T15:04:05Z07:00")
		resp = &OutgoingSession{
			CallID:        sipCall.CallID,
			TargetURI:     sipCall.ToURI,
			Status:        string(sipCall.Status),
			StartTime:     startTime,
			RemoteRTPAddr: sipCall.RemoteRTPAddr,
			Error:         sipCall.ErrorMessage,
		}

		if sipCall.AnswerTime != nil {
			answerTime := sipCall.AnswerTime.Format("2006-01-02T15:04:05Z07:00")
			resp.AnswerTime = &answerTime
		}

		if sipCall.EndTime != nil {
			endTime := sipCall.EndTime.Format("2006-01-02T15:04:05Z07:00")
			resp.EndTime = &endTime
		}
	}

	response.Success(c, "Success", resp)
}

// CancelOutgoingCall 取消呼出呼叫
// @Summary 取消呼出呼叫
// @Description 取消一个正在进行的呼出呼叫
// @Tags SIP
// @Produce json
// @Param callId path string true "通话ID"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /api/sip/calls/outgoing/{callId}/cancel [post]
func (h *SipHandler) CancelOutgoingCall(c *gin.Context) {
	callID := c.Param("callId")
	if callID == "" {
		response.Fail(c, "callId is required", nil)
		return
	}

	// 检查SIP服务器是否可用
	if h.sipServer == nil {
		response.Fail(c, "SIP server is not available", nil)
		return
	}

	err := h.sipServer.CancelOutgoingCall(callID)
	if err != nil {
		response.Fail(c, err.Error(), nil)
		return
	}

	// 更新通话记录状态
	sipCall, err := models.GetSipCallByCallID(h.db, callID)
	if err == nil {
		now := time.Now()
		sipCall.Status = models.SipCallStatusCancelled
		sipCall.EndTime = &now
		if err := models.UpdateSipCall(h.db, sipCall); err != nil {
			logrus.WithError(err).Warn("Failed to update call record")
		}
	}

	response.Success(c, "Call cancelled successfully", nil)
}

// HangupOutgoingCall 挂断呼出呼叫
// @Summary 挂断呼出呼叫
// @Description 挂断一个已接通的呼出呼叫
// @Tags SIP
// @Produce json
// @Param callId path string true "通话ID"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /api/sip/calls/outgoing/{callId}/hangup [post]
func (h *SipHandler) HangupOutgoingCall(c *gin.Context) {
	if h.sipServer == nil {
		response.Fail(c, "SIP server is not initialized", nil)
		return
	}

	callID := c.Param("callId")
	if callID == "" {
		response.Fail(c, "callId is required", nil)
		return
	}

	err := h.sipServer.HangupOutgoingCall(callID)
	if err != nil {
		if err.Error() == "call not found" {
			response.Fail(c, "Call not found", err.Error())
		} else {
			response.Fail(c, "Failed to hangup call", err.Error())
		}
		return
	}

	// 更新通话记录状态
	sipCall, err := models.GetSipCallByCallID(h.db, callID)
	if err == nil {
		now := time.Now()
		sipCall.Status = models.SipCallStatusEnded
		sipCall.EndTime = &now
		if sipCall.AnswerTime != nil {
			duration := int(now.Sub(*sipCall.AnswerTime).Seconds())
			if duration > 0 {
				sipCall.Duration = duration
			}
		}
		if err := models.UpdateSipCall(h.db, sipCall); err != nil {
			logrus.WithError(err).Warn("Failed to update call record status to ended")
		}
	} else {
		logrus.WithError(err).Warn("Call record not found for hangup update")
	}

	response.Success(c, "Call hung up successfully", gin.H{"message": "Call hung up successfully"})
}

// GetCallHistory 获取通话历史
// @Summary 获取通话历史
// @Description 获取通话记录列表
// @Tags SIP
// @Produce json
// @Param userId query int false "用户ID"
// @Param status query string false "状态筛选"
// @Param limit query int false "限制数量" default(20)
// @Param page query int false "页码" default(1)
// @Success 200 {object} response.Response{data=[]models.SipCall}
// @Router /api/sip/calls [get]
func (h *SipHandler) GetCallHistory(c *gin.Context) {
	// 如果有认证，获取当前用户
	user := models.CurrentUser(c)
	
	userIDStr := c.Query("userId")
	status := c.Query("status")
	limitStr := c.DefaultQuery("limit", "20")
	pageStr := c.DefaultQuery("page", "1")

	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	
	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	
	offset := (page - 1) * limit

	var calls []models.SipCall
	var total int64
	query := h.db.Model(&models.SipCall{})

	// 如果有用户登录，返回该用户的记录或没有关联用户的记录
	if user != nil {
		query = query.Where("user_id = ? OR user_id IS NULL", user.ID)
	} else if userIDStr != "" {
		if userID, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
			query = query.Where("user_id = ?", uint(userID))
		}
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}
	
	// 获取总数
	query.Count(&total)

	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&calls).Error; err != nil {
		logrus.WithError(err).Error("Failed to get call history")
		response.Fail(c, "Failed to get call history: "+err.Error(), nil)
		return
	}

	response.Success(c, "Success", gin.H{
		"list":  calls,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetCallDetail 获取通话详情
// @Summary 获取通话详情
// @Description 获取通话记录详情，包括录音、转录等信息
// @Tags SIP
// @Produce json
// @Param callId path string true "通话ID"
// @Success 200 {object} response.Response{data=models.SipCall}
// @Router /api/sip/calls/{callId}/detail [get]
func (h *SipHandler) GetCallDetail(c *gin.Context) {
	callID := c.Param("callId")
	if callID == "" {
		response.Fail(c, "callId is required", nil)
		return
	}

	sipCall, err := models.GetSipCallByCallID(h.db, callID)
	if err != nil {
		response.Fail(c, "Call not found", nil)
		return
	}
	
	// 检查权限
	user := models.CurrentUser(c)
	if user != nil && sipCall.UserID != nil && *sipCall.UserID != user.ID {
		response.Fail(c, "无权访问此通话记录", nil)
		return
	}

	response.Success(c, "Success", sipCall)
}

// GetSipUsers 获取SIP用户列表
// @Summary 获取SIP用户列表
// @Description 获取所有SIP用户列表
// @Tags SIP
// @Produce json
// @Success 200 {object} response.Response{data=[]models.SipUser}
// @Router /api/sip/users [get]
func (h *SipHandler) GetSipUsers(c *gin.Context) {
	var sipUsers []models.SipUser
	query := h.db.Order("created_at DESC")

	// 可选：根据状态筛选
	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 可选：只获取已启用的用户
	enabled := c.Query("enabled")
	if enabled == "true" {
		query = query.Where("enabled = ?", true)
	}

	if err := query.Find(&sipUsers).Error; err != nil {
		logrus.WithError(err).Error("Failed to get SIP users")
		response.Fail(c, "Failed to get SIP users: "+err.Error(), nil)
		return
	}

	response.Success(c, "Success", sipUsers)
}

// TranscribeCallRequest 转录请求
type TranscribeCallRequest struct {
	AudioURL string `json:"audioUrl" binding:"required"` // 音频文件URL
	Language string `json:"language"`                    // 语言，默认zh-CN
}

// RequestTranscription 请求通话录音转录
// @Summary 请求通话录音转录
// @Description 使用ASR服务转录通话录音
// @Tags SIP
// @Accept json
// @Produce json
// @Param callId path string true "通话ID"
// @Param request body TranscribeCallRequest true "转录请求"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /api/sip/calls/{callId}/transcribe [post]
func (h *SipHandler) RequestTranscription(c *gin.Context) {
	callID := c.Param("callId")
	if callID == "" {
		response.Fail(c, "callId is required", nil)
		return
	}

	var req TranscribeCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request: "+err.Error(), nil)
		return
	}

	// 获取通话记录
	sipCall, err := models.GetSipCallByCallID(h.db, callID)
	if err != nil {
		response.Fail(c, "Call not found", nil)
		return
	}

	// 检查权限
	user := models.CurrentUser(c)
	if user != nil && sipCall.UserID != nil && *sipCall.UserID != user.ID {
		response.Fail(c, "无权访问此通话记录", nil)
		return
	}

	// 检查是否有录音
	if sipCall.RecordURL == "" {
		response.Fail(c, "此通话没有录音文件", nil)
		return
	}

	// 检查是否已经转录过
	if sipCall.Transcription != "" && sipCall.TranscriptionStatus == "completed" {
		response.Success(c, "转录已完成", gin.H{
			"transcription": sipCall.Transcription,
			"status":        "completed",
		})
		return
	}

	// 更新转录状态为处理中
	if err := h.db.Model(&models.SipCall{}).
		Where("call_id = ?", callID).
		Updates(map[string]interface{}{
			"transcription_status": "processing",
		}).Error; err != nil {
		logrus.WithError(err).Error("Failed to update transcription status")
	}

	// 异步处理转录
	go h.processTranscription(callID, sipCall, req)

	response.Success(c, "转录任务已提交", gin.H{
		"status":  "processing",
		"message": "转录正在进行中，请稍后查看结果",
		"callId":  callID,
	})
}

// processTranscription 处理转录任务
func (h *SipHandler) processTranscription(callID string, sipCall *models.SipCall, req TranscribeCallRequest) {
	logrus.WithFields(logrus.Fields{
		"call_id":   callID,
		"audio_url": sipCall.RecordURL,
	}).Info("开始处理转录任务")

	// 1. 读取录音文件
	audioPath := sipCall.RecordURL
	// 如果是相对路径，转换为绝对路径
	if !strings.HasPrefix(audioPath, "http") {
		// 移除 /api/uploads/ 或 /api/files/ 前缀
		audioPath = strings.TrimPrefix(audioPath, "/api/uploads/")
		audioPath = strings.TrimPrefix(audioPath, "/api/files/")
		audioPath = "uploads/" + audioPath
	}

	logrus.WithField("audio_path", audioPath).Info("读取录音文件")

	// 读取WAV文件
	audioData, err := os.ReadFile(audioPath)
	if err != nil {
		logrus.WithError(err).Error("读取录音文件失败")
		h.updateTranscriptionError(callID, "读取录音文件失败: "+err.Error())
		return
	}

	// 2. 解析WAV文件，提取PCM数据
	pcmData, sampleRate, err := h.parseWAVFile(audioData)
	if err != nil {
		logrus.WithError(err).Error("解析WAV文件失败")
		h.updateTranscriptionError(callID, "解析WAV文件失败: "+err.Error())
		return
	}

	logrus.WithFields(logrus.Fields{
		"pcm_size":    len(pcmData),
		"sample_rate": sampleRate,
		"duration_sec": float64(len(pcmData)) / float64(sampleRate) / 2.0, // PCM16 = 2 bytes per sample
	}).Info("WAV文件解析成功")
	
	// 检查音频长度
	if len(pcmData) < sampleRate*2 { // 少于1秒
		logrus.Warn("音频时长太短，可能无法正确转录")
	}

	// 3. 如果采样率不是16kHz，需要重采样
	if sampleRate != 16000 {
		logrus.WithFields(logrus.Fields{
			"from_rate": sampleRate,
			"to_rate":   16000,
		}).Info("重采样音频")
		
		// 使用codec包进行重采样
		pcmData = codec.ResampleAudio(pcmData, sampleRate, 16000)
		sampleRate = 16000
		
		logrus.WithFields(logrus.Fields{
			"new_size":    len(pcmData),
			"sample_rate": sampleRate,
		}).Info("重采样完成")
	}

	// 4. 获取用户凭证（用于ASR服务）
	var credential *models.UserCredential
	if sipCall.UserID != nil {
		var cred models.UserCredential
		if err := h.db.Where("user_id = ?", *sipCall.UserID).First(&cred).Error; err == nil {
			credential = &cred
		}
	}

	if credential == nil {
		// 使用第一个可用凭证
		var cred models.UserCredential
		if err := h.db.First(&cred).Error; err != nil {
			logrus.WithError(err).Error("未找到可用凭证")
			h.updateTranscriptionError(callID, "未找到可用凭证")
			return
		}
		credential = &cred
	}

	// 5. 创建ASR服务
	transcriberFactory := recognizer.GetGlobalFactory()
	language := req.Language
	if language == "" {
		language = "zh-CN"
	}

	// 从凭证中获取ASR配置
	provider := credential.GetASRProvider()
	if provider == "" {
		logrus.Error("ASR provider未配置")
		h.updateTranscriptionError(callID, "ASR provider未配置")
		return
	}

	// 创建ASR配置对象
	asrConfig, err := recognizer.NewTranscriberConfigFromMap(provider, credential.AsrConfig, language)
	if err != nil {
		logrus.WithError(err).Error("创建ASR配置失败")
		h.updateTranscriptionError(callID, "创建ASR配置失败: "+err.Error())
		return
	}

	asrTranscriber, err := transcriberFactory.CreateTranscriber(asrConfig)
	if err != nil {
		logrus.WithError(err).Error("创建ASR服务失败")
		h.updateTranscriptionError(callID, "创建ASR服务失败: "+err.Error())
		return
	}

	// 6. 执行转录
	var transcriptionText string
	done := make(chan bool, 1)
	var asrErr error

	asrTranscriber.Init(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			if text != "" {
				transcriptionText = text
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
	if err := asrTranscriber.ConnAndReceive(callID); err != nil {
		logrus.WithError(err).Error("ASR连接失败")
		h.updateTranscriptionError(callID, "ASR连接失败: "+err.Error())
		return
	}

	// 发送音频数据
	if err := asrTranscriber.SendAudioBytes(pcmData); err != nil {
		logrus.WithError(err).Error("ASR发送音频失败")
		h.updateTranscriptionError(callID, "ASR发送音频失败: "+err.Error())
		return
	}

	// 发送结束标记
	if err := asrTranscriber.SendEnd(); err != nil {
		logrus.WithError(err).Error("ASR发送结束标记失败")
		h.updateTranscriptionError(callID, "ASR发送结束标记失败: "+err.Error())
		return
	}

	// 等待识别结果（带超时）
	select {
	case <-done:
		if asrErr != nil {
			logrus.WithError(asrErr).Error("ASR识别失败")
			h.updateTranscriptionError(callID, "ASR识别失败: "+asrErr.Error())
			return
		}
	case <-time.After(60 * time.Second):
		logrus.Error("ASR识别超时")
		h.updateTranscriptionError(callID, "ASR识别超时")
		return
	}

	// 7. 保存转录结果
	if transcriptionText == "" {
		transcriptionText = "（未识别到内容）"
	}

	if err := h.db.Model(&models.SipCall{}).
		Where("call_id = ?", callID).
		Updates(map[string]interface{}{
			"transcription":        transcriptionText,
			"transcription_status": "completed",
			"transcription_error":  "",
		}).Error; err != nil {
		logrus.WithError(err).Error("保存转录结果失败")
		return
	}

	logrus.WithFields(logrus.Fields{
		"call_id": callID,
		"text":    transcriptionText,
	}).Info("✅ 转录完成")
}

// updateTranscriptionError 更新转录错误信息
func (h *SipHandler) updateTranscriptionError(callID string, errorMsg string) {
	h.db.Model(&models.SipCall{}).
		Where("call_id = ?", callID).
		Updates(map[string]interface{}{
			"transcription_status": "failed",
			"transcription_error":  errorMsg,
		})
}

// parseWAVFile 解析WAV文件，提取PCM数据和采样率
func (h *SipHandler) parseWAVFile(wavData []byte) ([]byte, int, error) {
	if len(wavData) < 44 {
		return nil, 0, fmt.Errorf("WAV文件太小")
	}

	// 检查RIFF头
	if string(wavData[0:4]) != "RIFF" {
		return nil, 0, fmt.Errorf("不是有效的WAV文件")
	}

	// 检查WAVE标识
	if string(wavData[8:12]) != "WAVE" {
		return nil, 0, fmt.Errorf("不是有效的WAVE格式")
	}

	// 读取采样率（字节24-27）
	sampleRate := int(wavData[24]) | int(wavData[25])<<8 | int(wavData[26])<<16 | int(wavData[27])<<24

	// 查找data chunk
	offset := 12
	for offset < len(wavData)-8 {
		chunkID := string(wavData[offset : offset+4])
		chunkSize := int(wavData[offset+4]) | int(wavData[offset+5])<<8 | int(wavData[offset+6])<<16 | int(wavData[offset+7])<<24

		if chunkID == "data" {
			// 找到data chunk，提取PCM数据
			dataStart := offset + 8
			dataEnd := dataStart + chunkSize
			if dataEnd > len(wavData) {
				dataEnd = len(wavData)
			}
			return wavData[dataStart:dataEnd], sampleRate, nil
		}

		offset += 8 + chunkSize
	}

	return nil, 0, fmt.Errorf("未找到data chunk")
}
