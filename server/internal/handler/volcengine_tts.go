<<<<<<< HEAD
package handlers

import (
	"fmt"
	"strconv"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/voiceclone"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// VolcengineTTSRequest 火山引擎TTS请求
type VolcengineTTSRequest struct {
	AssetID  string `json:"assetId" binding:"required"` // speaker_id
	Text     string `json:"text" binding:"required"`
	Language string `json:"language" binding:"required"`
	Key      string `json:"key,omitempty"` // 可选，指定存储路径
}

// VolcengineTTSResponse 火山引擎TTS响应
type VolcengineTTSResponse struct {
	URL string `json:"url"`
}

// VolcengineSubmitAudioRequest 提交音频请求
type VolcengineSubmitAudioRequest struct {
	SpeakerID string `form:"speakerId" binding:"required"` // 从控制台获取的 speaker_id
	Language  string `form:"language" binding:"required"`
}

// VolcengineQueryTaskRequest 查询任务请求
type VolcengineQueryTaskRequest struct {
	SpeakerID string `json:"speakerId" binding:"required"` // speaker_id
}

// VolcengineQueryTaskResponse 查询任务响应
type VolcengineQueryTaskResponse struct {
	SpeakerID  string `json:"speakerId"`
	Status     int    `json:"status"`     // 0=NotFound, 1=Training, 2=Success, 3=Failed, 4=Active
	TrainVID   string `json:"trainVid"`   // 训练版本
	AssetID    string `json:"assetId"`    // 音色ID（与 speaker_id 相同）
	FailedDesc string `json:"failedDesc"` // 失败原因
	CreateTime int64  `json:"createTime"` // 创建时间
}

// VolcengineSynthesize 火山引擎语音合成
func (h *Handlers) VolcengineSynthesize(c *gin.Context) {
	var req VolcengineTTSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err.Error())
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "用户未登录")
		return
	}

	// 根据 assetId 查找对应的音色
	var clone models.VoiceClone
	if err := h.db.Where("user_id = ? AND asset_id = ? AND provider = ? AND is_active = ?",
		user.ID, req.AssetID, "volcengine", true).First(&clone).Error; err != nil {
		// 如果找不到对应的音色，仍然允许合成，但不保存历史记录
		logrus.WithError(err).Warn("volcengine: voice clone not found, synthesis will proceed without history")
	}

	// 生成存储路径（使用 .wav 格式，浏览器可以播放）
	key := req.Key
	if key == "" {
		// 只生成相对存储 key，统一由存储层决定对外前缀
		key = "volcengine/" + req.AssetID + "_" + strconv.FormatInt(int64(len(req.Text)), 10)
	}

	// 调用火山引擎合成（使用 voiceclone）
	factory := voiceclone.NewFactory()
	service, err := factory.CreateServiceFromEnv(voiceclone.ProviderVolcengine)
	if err != nil {
		response.Fail(c, "初始化火山引擎服务失败", err.Error())
		return
	}

	synthesizeReq := &voiceclone.SynthesizeRequest{
		AssetID:  req.AssetID, // 使用 speaker_id
		Text:     req.Text,
		Language: req.Language,
	}
	url, err := service.SynthesizeToStorage(c.Request.Context(), synthesizeReq, key)
	if err != nil {
		response.Fail(c, "语音合成失败", err.Error())
		return
	}

	// 如果找到了对应的音色，保存合成历史
	if clone.ID > 0 {
		// 记录合成历史
		synthesis := &models.VoiceSynthesis{
			UserID:       user.ID,
			VoiceCloneID: clone.ID,
			Text:         req.Text,
			Language:     req.Language,
			AudioURL:     url,
			Status:       "success",
		}
		if err := h.db.Create(synthesis).Error; err != nil {
			logrus.WithError(err).Error("volcengine: failed to save synthesis history")
			// 不因为保存历史失败而返回错误，合成已经成功
		} else {
			// 更新音色使用统计
			clone.IncrementUsage()
			if err := h.db.Save(&clone).Error; err != nil {
				logrus.WithError(err).Error("volcengine: failed to update voice clone usage")
			}
		}
	}

	response.Success(c, "语音合成成功", VolcengineTTSResponse{URL: url})
}

// VolcengineSubmitAudio 提交音频文件进行训练
// 注意：speaker_id 需要从火山引擎控制台获取
func (h *Handlers) VolcengineSubmitAudio(c *gin.Context) {
	var req VolcengineSubmitAudioRequest
	if err := c.ShouldBind(&req); err != nil {
		response.Fail(c, "参数错误", err.Error())
		return
	}

	// 获取上传的文件
	file, err := c.FormFile("audio")
	if err != nil {
		response.Fail(c, "获取音频文件失败", err.Error())
		return
	}

	// 打开文件
	src, err := file.Open()
	if err != nil {
		response.Fail(c, "打开音频文件失败", err.Error())
		return
	}
	defer src.Close()

	// 提交音频（使用 voiceclone）
	factory := voiceclone.NewFactory()
	service, err := factory.CreateServiceFromEnv(voiceclone.ProviderVolcengine)
	if err != nil {
		response.Fail(c, "初始化火山引擎服务失败", err.Error())
		return
	}

	submitReq := &voiceclone.SubmitAudioRequest{
		TaskID:    req.SpeakerID, // 使用 speaker_id 作为 TaskID
		TextID:    0,             // 火山引擎不需要
		TextSegID: 0,             // 火山引擎不需要
		AudioFile: src,
		Language:  req.Language,
	}
	err = service.SubmitAudio(c.Request.Context(), submitReq)
	if err != nil {
		response.Fail(c, "提交音频失败", err.Error())
		return
	}

	// 保存配置到数据库（如果配置了）
	h.saveVoiceCloneConfig("volcengine")

	response.Success(c, "提交音频成功", map[string]interface{}{
		"speakerId": req.SpeakerID,
		"message":   "音频已提交，请使用 speaker_id 查询训练状态",
	})
}

// VolcengineQueryTask 查询任务状态
func (h *Handlers) VolcengineQueryTask(c *gin.Context) {
	var req VolcengineQueryTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "参数错误", err.Error())
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "用户未登录")
		return
	}

	// 查询任务状态（使用 voiceclone）
	factory := voiceclone.NewFactory()
	service, err := factory.CreateServiceFromEnv(voiceclone.ProviderVolcengine)
	if err != nil {
		response.Fail(c, "初始化火山引擎服务失败", err.Error())
		return
	}

	status, err := service.QueryTaskStatus(c.Request.Context(), req.SpeakerID)
	if err != nil {
		response.Fail(c, "查询任务状态失败", err.Error())
		return
	}

	// 转换状态码
	var trainStatus int
	switch status.Status {
	case voiceclone.TrainingStatusInProgress:
		trainStatus = 1 // Training
	case voiceclone.TrainingStatusSuccess:
		trainStatus = 2 // Success
	case voiceclone.TrainingStatusFailed:
		trainStatus = 3 // Failed
	case voiceclone.TrainingStatusQueued:
		trainStatus = 0 // NotFound/Queued
	default:
		trainStatus = 0
	}

	// 如果训练成功，保存到 VoiceClone 表
	if trainStatus == 2 && status.AssetID != "" {
		// 火山引擎没有 VoiceTrainingTask，需要先创建或查找一个虚拟任务
		// 查找或创建虚拟训练任务（使用 speaker_id 作为 task_id）
		var task models.VoiceTrainingTask
		if err := h.db.Where("user_id = ? AND task_id = ?", user.ID, req.SpeakerID).First(&task).Error; err != nil {
			// 不存在，创建虚拟任务
			task = models.VoiceTrainingTask{
				UserID:   user.ID,
				TaskID:   req.SpeakerID,
				TaskName: fmt.Sprintf("火山引擎音色 %s", req.SpeakerID),
				Status:   models.TrainingStatusSuccess,
				AssetID:  status.AssetID,
				TrainVID: status.TrainVID,
			}
			if err := h.db.Create(&task).Error; err != nil {
				response.Fail(c, "创建训练任务记录失败", err.Error())
				return
			}
		} else {
			// 已存在，更新状态
			task.Status = models.TrainingStatusSuccess
			task.AssetID = status.AssetID
			task.TrainVID = status.TrainVID
			if err := h.db.Save(&task).Error; err != nil {
				response.Fail(c, "更新训练任务记录失败", err.Error())
				return
			}
		}

		// 使用 upsertVoiceClone 保存音色记录
		if err := h.upsertVoiceClone(c.Request.Context(), user.ID, &task, status.AssetID, status.TrainVID, "volcengine"); err != nil {
			response.Fail(c, "创建音色记录失败", err.Error())
			return
		}
	}

	response.Success(c, "查询任务状态成功", VolcengineQueryTaskResponse{
		SpeakerID:  status.TaskID,
		Status:     trainStatus,
		TrainVID:   status.TrainVID,
		AssetID:    status.AssetID, // speaker_id 就是 asset_id
		FailedDesc: status.FailedDesc,
		CreateTime: status.CreatedAt.UnixMilli(),
	})
}
=======
package handlers

import (
	"fmt"
	"strconv"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/voiceclone"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// VolcengineTTSRequest represents Volcengine TTS request
type VolcengineTTSRequest struct {
	AssetID  string `json:"assetId" binding:"required"` // speaker_id
	Text     string `json:"text" binding:"required"`
	Language string `json:"language" binding:"required"`
	Key      string `json:"key,omitempty"` // Optional, specify storage path
}

// VolcengineTTSResponse represents Volcengine TTS response
type VolcengineTTSResponse struct {
	URL string `json:"url"`
}

// VolcengineSubmitAudioRequest represents submit audio request
type VolcengineSubmitAudioRequest struct {
	SpeakerID string `form:"speakerId" binding:"required"` // speaker_id from console
	Language  string `form:"language" binding:"required"`
}

// VolcengineQueryTaskRequest represents query task request
type VolcengineQueryTaskRequest struct {
	SpeakerID string `json:"speakerId" binding:"required"` // speaker_id
}

// VolcengineQueryTaskResponse represents query task response
type VolcengineQueryTaskResponse struct {
	SpeakerID  string `json:"speakerId"`
	Status     int    `json:"status"`     // 0=NotFound, 1=Training, 2=Success, 3=Failed, 4=Active
	TrainVID   string `json:"trainVid"`   // Training version
	AssetID    string `json:"assetId"`    // Voice ID (same as speaker_id)
	FailedDesc string `json:"failedDesc"` // Failure reason
	CreateTime int64  `json:"createTime"` // Creation time
}

// VolcengineSynthesize handles Volcengine voice synthesis
func (h *Handlers) VolcengineSynthesize(c *gin.Context) {
	var req VolcengineTTSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid parameters", err.Error())
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "Unauthorized", "User not logged in")
		return
	}

	// Find corresponding voice clone by assetId
	var clone models.VoiceClone
	if err := h.db.Where("user_id = ? AND asset_id = ? AND provider = ? AND is_active = ?",
		user.ID, req.AssetID, "volcengine", true).First(&clone).Error; err != nil {
		// If voice clone not found, still allow synthesis but don't save history
		logrus.WithError(err).Warn("volcengine: voice clone not found, synthesis will proceed without history")
	}

	// Generate storage path (use .wav format for browser playback)
	key := req.Key
	if key == "" {
		// Generate relative storage key, let storage layer decide external prefix
		key = "volcengine/" + req.AssetID + "_" + strconv.FormatInt(int64(len(req.Text)), 10)
	}

	// Call Volcengine synthesis (using voiceclone)
	factory := voiceclone.NewFactory()
	service, err := factory.CreateServiceFromEnv(voiceclone.ProviderVolcengine)
	if err != nil {
		response.Fail(c, "Failed to initialize Volcengine service", err.Error())
		return
	}

	synthesizeReq := &voiceclone.SynthesizeRequest{
		AssetID:  req.AssetID, // Use speaker_id
		Text:     req.Text,
		Language: req.Language,
	}
	url, err := service.SynthesizeToStorage(c.Request.Context(), synthesizeReq, key)
	if err != nil {
		response.Fail(c, "Voice synthesis failed", err.Error())
		return
	}

	// If voice clone found, save synthesis history
	if clone.ID > 0 {
		// Record synthesis history
		synthesis := &models.VoiceSynthesis{
			UserID:       user.ID,
			VoiceCloneID: clone.ID,
			Text:         req.Text,
			Language:     req.Language,
			AudioURL:     url,
			Status:       "success",
		}
		if err := h.db.Create(synthesis).Error; err != nil {
			logrus.WithError(err).Error("volcengine: failed to save synthesis history")
			// Don't return error for history save failure, synthesis already succeeded
		} else {
			// Update voice clone usage statistics
			clone.IncrementUsage()
			if err := h.db.Save(&clone).Error; err != nil {
				logrus.WithError(err).Error("volcengine: failed to update voice clone usage")
			}
		}
	}

	response.Success(c, "Voice synthesis successful", VolcengineTTSResponse{URL: url})
}

// VolcengineSubmitAudio submits audio file for training
// Note: speaker_id needs to be obtained from Volcengine console
func (h *Handlers) VolcengineSubmitAudio(c *gin.Context) {
	var req VolcengineSubmitAudioRequest
	if err := c.ShouldBind(&req); err != nil {
		response.Fail(c, "Invalid parameters", err.Error())
		return
	}

	// Get uploaded file
	file, err := c.FormFile("audio")
	if err != nil {
		response.Fail(c, "Failed to get audio file", err.Error())
		return
	}

	// Open file
	src, err := file.Open()
	if err != nil {
		response.Fail(c, "Failed to open audio file", err.Error())
		return
	}
	defer src.Close()

	// Submit audio (using voiceclone)
	factory := voiceclone.NewFactory()
	service, err := factory.CreateServiceFromEnv(voiceclone.ProviderVolcengine)
	if err != nil {
		response.Fail(c, "Failed to initialize Volcengine service", err.Error())
		return
	}

	submitReq := &voiceclone.SubmitAudioRequest{
		TaskID:    req.SpeakerID, // Use speaker_id as TaskID
		TextID:    0,             // Not needed for Volcengine
		TextSegID: 0,             // Not needed for Volcengine
		AudioFile: src,
		Language:  req.Language,
	}
	err = service.SubmitAudio(c.Request.Context(), submitReq)
	if err != nil {
		response.Fail(c, "Failed to submit audio", err.Error())
		return
	}

	// Save configuration to database (if configured)
	h.saveVoiceCloneConfig("volcengine")

	response.Success(c, "Audio submitted successfully", map[string]interface{}{
		"speakerId": req.SpeakerID,
		"message":   "Audio submitted, please use speaker_id to query training status",
	})
}

// VolcengineQueryTask queries task status
func (h *Handlers) VolcengineQueryTask(c *gin.Context) {
	var req VolcengineQueryTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid parameters", err.Error())
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "Unauthorized", "User not logged in")
		return
	}

	// Query task status (using voiceclone)
	factory := voiceclone.NewFactory()
	service, err := factory.CreateServiceFromEnv(voiceclone.ProviderVolcengine)
	if err != nil {
		response.Fail(c, "Failed to initialize Volcengine service", err.Error())
		return
	}

	status, err := service.QueryTaskStatus(c.Request.Context(), req.SpeakerID)
	if err != nil {
		response.Fail(c, "Failed to query task status", err.Error())
		return
	}

	// Convert status code
	var trainStatus int
	switch status.Status {
	case voiceclone.TrainingStatusInProgress:
		trainStatus = 1 // Training
	case voiceclone.TrainingStatusSuccess:
		trainStatus = 2 // Success
	case voiceclone.TrainingStatusFailed:
		trainStatus = 3 // Failed
	case voiceclone.TrainingStatusQueued:
		trainStatus = 0 // NotFound/Queued
	default:
		trainStatus = 0
	}

	// If training succeeded, save to VoiceClone table
	if trainStatus == 2 && status.AssetID != "" {
		// Volcengine doesn't have VoiceTrainingTask, need to create or find a virtual task first
		// Find or create virtual training task (use speaker_id as task_id)
		var task models.VoiceTrainingTask
		if err := h.db.Where("user_id = ? AND task_id = ?", user.ID, req.SpeakerID).First(&task).Error; err != nil {
			// Doesn't exist, create virtual task
			task = models.VoiceTrainingTask{
				UserID:   user.ID,
				TaskID:   req.SpeakerID,
				TaskName: fmt.Sprintf("Volcengine Voice %s", req.SpeakerID),
				Status:   models.TrainingStatusSuccess,
				AssetID:  status.AssetID,
				TrainVID: status.TrainVID,
			}
			if err := h.db.Create(&task).Error; err != nil {
				response.Fail(c, "Failed to create training task record", err.Error())
				return
			}
		} else {
			// Already exists, update status
			task.Status = models.TrainingStatusSuccess
			task.AssetID = status.AssetID
			task.TrainVID = status.TrainVID
			if err := h.db.Save(&task).Error; err != nil {
				response.Fail(c, "Failed to update training task record", err.Error())
				return
			}
		}

		// Use upsertVoiceClone to save voice record
		if err := h.upsertVoiceClone(c.Request.Context(), user.ID, &task, status.AssetID, status.TrainVID, "volcengine"); err != nil {
			response.Fail(c, "Failed to create voice record", err.Error())
			return
		}
	}

	response.Success(c, "Query task status successful", VolcengineQueryTaskResponse{
		SpeakerID:  status.TaskID,
		Status:     trainStatus,
		TrainVID:   status.TrainVID,
		AssetID:    status.AssetID, // speaker_id is asset_id
		FailedDesc: status.FailedDesc,
		CreateTime: status.CreatedAt.UnixMilli(),
	})
}
>>>>>>> 3dfadd85bd518bde3e99c3d51af6bb1fe0a2141c
