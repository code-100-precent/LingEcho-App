package recording

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/LingByte/lingstorage-sdk-go"
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/hardware/analysis"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// RecordingManager 录音管理器
type RecordingManager struct {
	db              *gorm.DB
	logger          *zap.Logger
	storagePath     string                    // 录音文件存储路径
	maxFileSize     int64                     // 最大文件大小 (字节)
	maxDuration     int                       // 最大录音时长 (秒)
	enableCleanup   bool                      // 是否启用自动清理
	retentionDays   int                       // 保留天数
	analysisService *analysis.AnalysisService // AI分析服务
}

// NewRecordingManager 创建录音管理器
func NewRecordingManager(db *gorm.DB, logger *zap.Logger, storagePath string) *RecordingManager {
	return &RecordingManager{
		db:              db,
		logger:          logger,
		storagePath:     storagePath,
		maxFileSize:     100 * 1024 * 1024, // 100MB
		maxDuration:     3600,              // 1小时
		enableCleanup:   true,
		retentionDays:   30,                              // 保留30天
		analysisService: analysis.NewAnalysisService(db), // 初始化AI分析服务
	}
}

// RecordingConfig 录音配置
type RecordingConfig struct {
	UserID      uint
	AssistantID uint
	DeviceID    *string // 设备ID（MAC地址）
	MacAddress  string
	SessionID   string
	AudioFormat string
	SampleRate  int
	Channels    int
	CallType    string
}

// RecordingSession 录音会话
type RecordingSession struct {
	config      *RecordingConfig
	manager     *RecordingManager
	audioFile   *os.File
	audioPath   string
	startTime   time.Time
	endTime     time.Time
	audioSize   int64
	userInput   strings.Builder
	aiResponse  strings.Builder
	isRecording bool

	// WAV格式支持
	isWAV            bool
	wavHeaderWritten bool
	pcmDataSize      int64 // PCM数据大小，用于WAV头部
}

// StartRecording 开始录音
func (rm *RecordingManager) StartRecording(config *RecordingConfig) (*RecordingSession, error) {
	// 创建录音目录 - 直接使用storagePath，不再添加recordings子目录
	recordingDir := filepath.Join(rm.storagePath,
		fmt.Sprintf("user_%d", config.UserID),
		fmt.Sprintf("assistant_%d", config.AssistantID),
		time.Now().Format("2006/01/02"))

	if err := os.MkdirAll(recordingDir, 0755); err != nil {
		return nil, fmt.Errorf("创建录音目录失败: %w", err)
	}

	// 生成录音文件名 - 使用WAV格式以确保兼容性
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("%s_%s_%s.wav",
		timestamp, config.SessionID, config.MacAddress)
	audioPath := filepath.Join(recordingDir, filename)

	// 创建录音文件
	audioFile, err := os.Create(audioPath)
	if err != nil {
		return nil, fmt.Errorf("创建录音文件失败: %w", err)
	}

	session := &RecordingSession{
		config:           config,
		manager:          rm,
		audioFile:        audioFile,
		audioPath:        audioPath,
		startTime:        time.Now(),
		isRecording:      true,
		isWAV:            true,  // 标记为WAV格式
		wavHeaderWritten: false, // WAV头部尚未写入
	}

	rm.logger.Info("开始录音",
		zap.String("session_id", config.SessionID),
		zap.String("mac_address", config.MacAddress),
		zap.String("audio_path", audioPath),
		zap.String("format", "WAV"))

	return session, nil
}

// WriteAudio 写入音频数据
func (rs *RecordingSession) WriteAudio(data []byte) error {
	if !rs.isRecording || rs.audioFile == nil {
		return fmt.Errorf("录音会话未激活")
	}

	// 检查文件大小限制
	if rs.audioSize+int64(len(data)) > rs.manager.maxFileSize {
		return fmt.Errorf("录音文件超过大小限制")
	}

	// 检查录音时长限制
	if time.Since(rs.startTime).Seconds() > float64(rs.manager.maxDuration) {
		return fmt.Errorf("录音时长超过限制")
	}

	// 如果是WAV格式且头部未写入，先写入WAV头部
	if rs.isWAV && !rs.wavHeaderWritten {
		if err := rs.writeWAVHeader(); err != nil {
			return fmt.Errorf("写入WAV头部失败: %w", err)
		}
		rs.wavHeaderWritten = true
	}

	// 写入音频数据
	var writeData []byte
	if rs.isWAV {
		// 对于WAV格式，我们需要PCM数据
		// 如果输入是OPUS，需要先解码（这里简化处理，直接写入原始数据）
		// 在实际应用中，应该在session层面进行OPUS->PCM转换
		writeData = data
		rs.pcmDataSize += int64(len(data))
	} else {
		// 原始格式直接写入
		writeData = data
	}

	n, err := rs.audioFile.Write(writeData)
	if err != nil {
		return fmt.Errorf("写入音频数据失败: %w", err)
	}

	rs.audioSize += int64(n)
	return nil
}

// writeWAVHeader 写入WAV文件头部
func (rs *RecordingSession) writeWAVHeader() error {
	// WAV文件头部结构
	header := make([]byte, 44)

	// RIFF头部
	copy(header[0:4], "RIFF")
	// 文件大小（暂时写入0，停止录音时更新）
	// header[4:8] = 文件大小 - 8
	copy(header[8:12], "WAVE")

	// fmt子块
	copy(header[12:16], "fmt ")
	// fmt子块大小
	header[16] = 16 // PCM格式
	header[17] = 0
	header[18] = 0
	header[19] = 0

	// 音频格式（PCM = 1）
	header[20] = 1
	header[21] = 0

	// 声道数
	header[22] = byte(rs.config.Channels)
	header[23] = 0

	// 采样率
	sampleRate := uint32(rs.config.SampleRate)
	header[24] = byte(sampleRate)
	header[25] = byte(sampleRate >> 8)
	header[26] = byte(sampleRate >> 16)
	header[27] = byte(sampleRate >> 24)

	// 字节率 = 采样率 * 声道数 * 位深度/8
	byteRate := sampleRate * uint32(rs.config.Channels) * 2 // 假设16位
	header[28] = byte(byteRate)
	header[29] = byte(byteRate >> 8)
	header[30] = byte(byteRate >> 16)
	header[31] = byte(byteRate >> 24)

	// 块对齐 = 声道数 * 位深度/8
	blockAlign := uint16(rs.config.Channels * 2) // 假设16位
	header[32] = byte(blockAlign)
	header[33] = byte(blockAlign >> 8)

	// 位深度
	header[34] = 16 // 16位
	header[35] = 0

	// data子块
	copy(header[36:40], "data")
	// data子块大小（暂时写入0，停止录音时更新）
	// header[40:44] = PCM数据大小

	_, err := rs.audioFile.Write(header)
	return err
}

// AddUserInput 添加用户输入文本
func (rs *RecordingSession) AddUserInput(text string) {
	if rs.userInput.Len() > 0 {
		rs.userInput.WriteString("\n")
	}
	rs.userInput.WriteString(fmt.Sprintf("[%s] %s",
		time.Now().Format("15:04:05"), text))
}

// AddAIResponse 添加AI回复文本
func (rs *RecordingSession) AddAIResponse(text string) {
	if rs.aiResponse.Len() > 0 {
		rs.aiResponse.WriteString("\n")
	}
	rs.aiResponse.WriteString(fmt.Sprintf("[%s] %s",
		time.Now().Format("15:04:05"), text))
}

<<<<<<< HEAD
=======
// StartUserTurn 开始用户发言轮次
func (rs *RecordingSession) StartUserTurn() {
	rs.currentTurnID++
	now := time.Now()

	rs.currentUserTurn = &conversation.ConversationTurn{
		TurnID:       rs.currentTurnID,
		Timestamp:    now,
		Type:         "user",
		StartTime:    now,
		ASRStartTime: &now,
	}
}

// StartUserTurnIfNeeded 如果需要的话开始用户发言轮次（避免重复记录）
func (rs *RecordingSession) StartUserTurnIfNeeded() {
	// 如果当前没有用户轮次，或者当前轮次已经结束，则开始新的轮次
	if rs.currentUserTurn == nil {
		rs.StartUserTurn()
	}
}

// EndUserTurn 结束用户发言轮次
func (rs *RecordingSession) EndUserTurn(content string) {
	if rs.currentUserTurn == nil {
		return
	}

	now := time.Now()
	rs.currentUserTurn.Content = content
	rs.currentUserTurn.EndTime = now
	rs.currentUserTurn.Duration = now.Sub(rs.currentUserTurn.StartTime).Milliseconds()
	rs.currentUserTurn.ASREndTime = &now

	if rs.currentUserTurn.ASRStartTime != nil {
		asrDuration := now.Sub(*rs.currentUserTurn.ASRStartTime).Milliseconds()
		rs.currentUserTurn.ASRDuration = &asrDuration

		// 更新ASR指标
		rs.updateASRMetrics(asrDuration)
	}

	// 添加到对话记录
	rs.conversationDetails.Turns = append(rs.conversationDetails.Turns, *rs.currentUserTurn)
	rs.conversationDetails.TotalTurns++
	rs.conversationDetails.UserTurns++

	// 更新简单格式的用户输入
	if rs.userInput.Len() > 0 {
		rs.userInput.WriteString("\n")
	}
	rs.userInput.WriteString(fmt.Sprintf("[%s] %s",
		rs.currentUserTurn.Timestamp.Format("15:04:05"), content))

	// 清空当前用户轮次，为下次做准备
	rs.currentUserTurn = nil
}

// StartAITurn 开始AI回复轮次
func (rs *RecordingSession) StartAITurn() {
	rs.currentTurnID++
	now := time.Now()

	rs.currentAITurn = &conversation.ConversationTurn{
		TurnID:       rs.currentTurnID,
		Timestamp:    now,
		Type:         "ai",
		StartTime:    now,
		LLMStartTime: &now,
	}

	// 计算响应延迟（从上一个用户发言结束到AI开始回复）
	if len(rs.conversationDetails.Turns) > 0 {
		lastTurn := rs.conversationDetails.Turns[len(rs.conversationDetails.Turns)-1]
		if lastTurn.Type == "user" {
			responseDelay := now.Sub(lastTurn.EndTime).Milliseconds()
			rs.currentAITurn.ResponseDelay = &responseDelay
			rs.timingMetrics.ResponseDelays = append(rs.timingMetrics.ResponseDelays, responseDelay)
		}
	}
}

// EndLLMProcessing 结束LLM处理
func (rs *RecordingSession) EndLLMProcessing() {
	if rs.currentAITurn == nil || rs.currentAITurn.LLMStartTime == nil {
		return
	}

	now := time.Now()
	rs.currentAITurn.LLMEndTime = &now
	llmDuration := now.Sub(*rs.currentAITurn.LLMStartTime).Milliseconds()
	rs.currentAITurn.LLMDuration = &llmDuration

	// 更新LLM指标
	rs.updateLLMMetrics(llmDuration)

	// 注意：不在这里设置TTS开始时间，应该在实际开始TTS时设置
}

// StartTTSProcessing 开始TTS处理
func (rs *RecordingSession) StartTTSProcessing() {
	if rs.currentAITurn == nil {
		return
	}

	now := time.Now()
	rs.currentAITurn.TTSStartTime = &now
}

// EndTTSProcessing 结束TTS处理
func (rs *RecordingSession) EndTTSProcessing() {
	if rs.currentAITurn == nil || rs.currentAITurn.TTSStartTime == nil {
		return
	}

	now := time.Now()
	rs.currentAITurn.TTSEndTime = &now
	ttsDuration := now.Sub(*rs.currentAITurn.TTSStartTime).Milliseconds()
	rs.currentAITurn.TTSDuration = &ttsDuration

	// 更新TTS指标
	rs.updateTTSMetrics(ttsDuration)
}

// EndAITurn 结束AI回复轮次
func (rs *RecordingSession) EndAITurn(content string) {
	if rs.currentAITurn == nil {
		return
	}

	now := time.Now()
	rs.currentAITurn.Content = content
	rs.currentAITurn.EndTime = now
	rs.currentAITurn.Duration = now.Sub(rs.currentAITurn.StartTime).Milliseconds()

	// 注意：TTS计时应该在实际TTS开始和结束时进行，不在这里计算

	// 计算总延迟（从用户发言结束到AI回复完成）
	if len(rs.conversationDetails.Turns) > 0 {
		lastUserTurn := rs.findLastUserTurn()
		if lastUserTurn != nil {
			totalDelay := now.Sub(lastUserTurn.EndTime).Milliseconds()
			rs.currentAITurn.TotalDelay = &totalDelay
			rs.timingMetrics.TotalDelays = append(rs.timingMetrics.TotalDelays, totalDelay)
		}
	}

	// 添加到对话记录
	rs.conversationDetails.Turns = append(rs.conversationDetails.Turns, *rs.currentAITurn)
	rs.conversationDetails.TotalTurns++
	rs.conversationDetails.AITurns++

	// 更新简单格式的AI回复
	if rs.aiResponse.Len() > 0 {
		rs.aiResponse.WriteString("\n")
	}
	rs.aiResponse.WriteString(fmt.Sprintf("[%s] %s",
		rs.currentAITurn.Timestamp.Format("15:04:05"), content))
}

// RecordInterruption 记录中断事件
func (rs *RecordingSession) RecordInterruption() {
	rs.interruptions++
	rs.conversationDetails.Interruptions++
}

// findLastUserTurn 查找最后一个用户发言轮次
func (rs *RecordingSession) findLastUserTurn() *conversation.ConversationTurn {
	for i := len(rs.conversationDetails.Turns) - 1; i >= 0; i-- {
		if rs.conversationDetails.Turns[i].Type == "user" {
			return &rs.conversationDetails.Turns[i]
		}
	}
	return nil
}

// updateASRMetrics 更新ASR指标
func (rs *RecordingSession) updateASRMetrics(duration int64) {
	rs.timingMetrics.ASRCalls++
	rs.timingMetrics.ASRTotalTime += duration

	if rs.timingMetrics.ASRCalls == 1 {
		rs.timingMetrics.ASRMinTime = duration
		rs.timingMetrics.ASRMaxTime = duration
	} else {
		if duration < rs.timingMetrics.ASRMinTime {
			rs.timingMetrics.ASRMinTime = duration
		}
		if duration > rs.timingMetrics.ASRMaxTime {
			rs.timingMetrics.ASRMaxTime = duration
		}
	}

	rs.timingMetrics.ASRAverageTime = rs.timingMetrics.ASRTotalTime / int64(rs.timingMetrics.ASRCalls)
}

// updateLLMMetrics 更新LLM指标
func (rs *RecordingSession) updateLLMMetrics(duration int64) {
	rs.timingMetrics.LLMCalls++
	rs.timingMetrics.LLMTotalTime += duration

	if rs.timingMetrics.LLMCalls == 1 {
		rs.timingMetrics.LLMMinTime = duration
		rs.timingMetrics.LLMMaxTime = duration
	} else {
		if duration < rs.timingMetrics.LLMMinTime {
			rs.timingMetrics.LLMMinTime = duration
		}
		if duration > rs.timingMetrics.LLMMaxTime {
			rs.timingMetrics.LLMMaxTime = duration
		}
	}

	rs.timingMetrics.LLMAverageTime = rs.timingMetrics.LLMTotalTime / int64(rs.timingMetrics.LLMCalls)
}

// calculateDelayStatistics 计算延迟统计
func (rs *RecordingSession) calculateDelayStatistics() {
	// 计算响应延迟统计
	if len(rs.timingMetrics.ResponseDelays) > 0 {
		total := int64(0)
		min := rs.timingMetrics.ResponseDelays[0]
		max := rs.timingMetrics.ResponseDelays[0]

		for _, delay := range rs.timingMetrics.ResponseDelays {
			total += delay
			if delay < min {
				min = delay
			}
			if delay > max {
				max = delay
			}
		}

		rs.timingMetrics.AverageResponseDelay = total / int64(len(rs.timingMetrics.ResponseDelays))
		rs.timingMetrics.MinResponseDelay = min
		rs.timingMetrics.MaxResponseDelay = max
	}

	// 计算总延迟统计
	if len(rs.timingMetrics.TotalDelays) > 0 {
		total := int64(0)
		min := rs.timingMetrics.TotalDelays[0]
		max := rs.timingMetrics.TotalDelays[0]

		for _, delay := range rs.timingMetrics.TotalDelays {
			total += delay
			if delay < min {
				min = delay
			}
			if delay > max {
				max = delay
			}
		}

		rs.timingMetrics.AverageTotalDelay = total / int64(len(rs.timingMetrics.TotalDelays))
		rs.timingMetrics.MinTotalDelay = min
		rs.timingMetrics.MaxTotalDelay = max
	}
}

// updateTTSMetrics 更新TTS指标
func (rs *RecordingSession) updateTTSMetrics(duration int64) {
	rs.timingMetrics.TTSCalls++
	rs.timingMetrics.TTSTotalTime += duration

	if rs.timingMetrics.TTSCalls == 1 {
		rs.timingMetrics.TTSMinTime = duration
		rs.timingMetrics.TTSMaxTime = duration
	} else {
		if duration < rs.timingMetrics.TTSMinTime {
			rs.timingMetrics.TTSMinTime = duration
		}
		if duration > rs.timingMetrics.TTSMaxTime {
			rs.timingMetrics.TTSMaxTime = duration
		}
	}

	rs.timingMetrics.TTSAverageTime = rs.timingMetrics.TTSTotalTime / int64(rs.timingMetrics.TTSCalls)
}

>>>>>>> bacc4679b6354ad1d679dc9b00723ccf3d71a87d
// StopRecording 停止录音并保存记录
func (rs *RecordingSession) StopRecording(callStatus string) (*models.CallRecording, error) {
	if !rs.isRecording {
		return nil, fmt.Errorf("录音会话未激活")
	}

	rs.isRecording = false
	rs.endTime = time.Now()

<<<<<<< HEAD
=======
	// 完成对话记录
	rs.conversationDetails.EndTime = rs.endTime
	rs.timingMetrics.SessionDuration = rs.endTime.Sub(rs.startTime).Milliseconds()

	// 计算延迟指标的统计值
	rs.calculateDelayStatistics()

>>>>>>> bacc4679b6354ad1d679dc9b00723ccf3d71a87d
	// 如果是WAV格式，更新文件头部
	if rs.isWAV && rs.audioFile != nil {
		if err := rs.updateWAVHeader(); err != nil {
			rs.manager.logger.Warn("更新WAV头部失败", zap.Error(err))
		}
	}

	// 关闭音频文件
	if rs.audioFile != nil {
		rs.audioFile.Close()
		rs.audioFile = nil
	}

	// 获取文件信息
	fileInfo, err := os.Stat(rs.audioPath)
	if err != nil {
		return nil, fmt.Errorf("获取录音文件信息失败: %w", err)
	}

	duration := int(rs.endTime.Sub(rs.startTime).Seconds())

	// 生成对话摘要和关键词
	summary := rs.generateSummary()
	keywords := rs.extractKeywords()
	tags := rs.generateTags()

<<<<<<< HEAD
=======
	// 序列化详细对话记录和时间指标
	conversationDetailsJSON, err := json.Marshal(rs.conversationDetails)
	if err != nil {
		rs.manager.logger.Warn("序列化对话详情失败", zap.Error(err))
		conversationDetailsJSON = []byte("{}")
	}

	timingMetricsJSON, err := json.Marshal(rs.timingMetrics)
	if err != nil {
		rs.manager.logger.Warn("序列化时间指标失败", zap.Error(err))
		timingMetricsJSON = []byte("{}")
	}

>>>>>>> bacc4679b6354ad1d679dc9b00723ccf3d71a87d
	// 上传文件到lingstorage
	storageURL, err := rs.uploadToStorage()
	if err != nil {
		rs.manager.logger.Error("上传录音文件到存储失败", zap.Error(err))
		// 如果上传失败，使用本地路径作为备用
		storageURL = rs.generateStorageURL()
	} else {
		// 上传成功后删除本地文件
		if err := os.Remove(rs.audioPath); err != nil {
			rs.manager.logger.Warn("删除本地录音文件失败", zap.Error(err), zap.String("path", rs.audioPath))
		}
	}

	// 创建录音记录
	recording := &models.CallRecording{
		UserID:       rs.config.UserID,
		AssistantID:  rs.config.AssistantID,
		DeviceID:     *rs.config.DeviceID,
		MacAddress:   rs.config.MacAddress,
		SessionID:    rs.config.SessionID,
		AudioPath:    rs.audioPath,
		StorageURL:   storageURL,
		AudioFormat:  "wav", // 统一使用WAV格式
		AudioSize:    fileInfo.Size(),
		Duration:     duration,
		SampleRate:   rs.config.SampleRate,
		Channels:     rs.config.Channels,
		CallType:     rs.config.CallType,
		CallStatus:   callStatus,
		StartTime:    rs.startTime,
		EndTime:      rs.endTime,
		UserInput:    rs.userInput.String(),
		AIResponse:   rs.aiResponse.String(),
		Summary:      summary,
		Keywords:     keywords,
		Tags:         tags,
		AudioQuality: rs.calculateAudioQuality(),
		NoiseLevel:   rs.calculateNoiseLevel(),
<<<<<<< HEAD
=======

		// 新增详细记录字段
		ConversationDetails: string(conversationDetailsJSON),
		TimingMetrics:       string(timingMetricsJSON),
>>>>>>> bacc4679b6354ad1d679dc9b00723ccf3d71a87d
	}

	// 保存到数据库
	if err := models.CreateCallRecording(rs.manager.db, recording); err != nil {
		return nil, fmt.Errorf("保存录音记录失败: %w", err)
	}

	rs.manager.logger.Info("录音完成",
		zap.String("session_id", rs.config.SessionID),
		zap.String("mac_address", rs.config.MacAddress),
		zap.Int("duration", duration),
		zap.Int64("file_size", fileInfo.Size()),
		zap.String("storage_url", storageURL),
		zap.String("format", "WAV"))

	// 启动自动AI分析（异步执行）
	if rs.manager.analysisService != nil {
		rs.manager.logger.Info("启动自动AI分析", zap.Uint("recordingID", recording.ID))
		rs.manager.analysisService.AutoAnalyzeRecording(context.Background(), recording.ID)
	}

	return recording, nil
}

// updateWAVHeader 更新WAV文件头部的大小信息
func (rs *RecordingSession) updateWAVHeader() error {
	// 移动到文件开头
	if _, err := rs.audioFile.Seek(0, 0); err != nil {
		return err
	}

	// 读取现有头部
	header := make([]byte, 44)
	if _, err := rs.audioFile.Read(header); err != nil {
		return err
	}

	// 更新文件大小（RIFF chunk size = 文件大小 - 8）
	fileSize := uint32(rs.audioSize - 8)
	header[4] = byte(fileSize)
	header[5] = byte(fileSize >> 8)
	header[6] = byte(fileSize >> 16)
	header[7] = byte(fileSize >> 24)

	// 更新PCM数据大小
	pcmSize := uint32(rs.pcmDataSize)
	header[40] = byte(pcmSize)
	header[41] = byte(pcmSize >> 8)
	header[42] = byte(pcmSize >> 16)
	header[43] = byte(pcmSize >> 24)

	// 写回头部
	if _, err := rs.audioFile.Seek(0, 0); err != nil {
		return err
	}

	_, err := rs.audioFile.Write(header)
	return err
}

// generateSummary 生成对话摘要
func (rs *RecordingSession) generateSummary() string {
	userText := rs.userInput.String()
	aiText := rs.aiResponse.String()

	if userText == "" && aiText == "" {
		return "无对话内容"
	}

	// 简单的摘要生成逻辑
	summary := fmt.Sprintf("通话时长: %d秒", int(rs.endTime.Sub(rs.startTime).Seconds()))

	if userText != "" {
		lines := strings.Split(userText, "\n")
		summary += fmt.Sprintf(", 用户发言: %d次", len(lines))
	}

	if aiText != "" {
		lines := strings.Split(aiText, "\n")
		summary += fmt.Sprintf(", AI回复: %d次", len(lines))
	}

	return summary
}

// extractKeywords 提取关键词
func (rs *RecordingSession) extractKeywords() string {
	// 简单的关键词提取逻辑
	keywords := []string{}

	text := rs.userInput.String() + " " + rs.aiResponse.String()
	if text != "" {
		// 这里可以集成更复杂的NLP关键词提取算法
		// 目前只是简单示例
		if strings.Contains(text, "问题") || strings.Contains(text, "帮助") {
			keywords = append(keywords, "咨询")
		}
		if strings.Contains(text, "天气") {
			keywords = append(keywords, "天气查询")
		}
		if strings.Contains(text, "音乐") {
			keywords = append(keywords, "音乐")
		}
	}

	if len(keywords) == 0 {
		keywords = append(keywords, "日常对话")
	}

	// 确保返回有效的JSON字符串
	keywordsJSON, err := json.Marshal(keywords)
	if err != nil {
		// 如果序列化失败，返回默认值
		return `["日常对话"]`
	}
	return string(keywordsJSON)
}

// generateTags 生成标签
func (rs *RecordingSession) generateTags() string {
	// 简单的标签生成逻辑
	tags := []string{}

	text := rs.userInput.String() + " " + rs.aiResponse.String()
	if text != "" {
		// 基于对话内容生成标签
		if strings.Contains(text, "问题") || strings.Contains(text, "帮助") {
			tags = append(tags, "咨询")
		}
		if strings.Contains(text, "天气") {
			tags = append(tags, "天气")
		}
		if strings.Contains(text, "音乐") {
			tags = append(tags, "娱乐")
		}
		if strings.Contains(text, "新闻") {
			tags = append(tags, "资讯")
		}
		if strings.Contains(text, "时间") || strings.Contains(text, "日期") {
			tags = append(tags, "时间")
		}
	}

	// 基于通话时长添加标签
	duration := rs.endTime.Sub(rs.startTime).Seconds()
	if duration < 10 {
		tags = append(tags, "短通话")
	} else if duration > 60 {
		tags = append(tags, "长通话")
	}

	if len(tags) == 0 {
		tags = append(tags, "日常对话")
	}

	// 确保返回有效的JSON字符串
	tagsJSON, err := json.Marshal(tags)
	if err != nil {
		// 如果序列化失败，返回默认值
		return `["日常对话"]`
	}
	return string(tagsJSON)
}

// generateStorageURL 生成存储URL
func (rs *RecordingSession) generateStorageURL() string {
	// 生成相对于存储根目录的URL路径
	// 例如: /api/recordings/user_1/assistant_2/2026/01/25/20260125_143022_session_123_80:b5:4e:de:e7:c0.wav
	relativePath := strings.TrimPrefix(rs.audioPath, rs.manager.storagePath)
	relativePath = strings.TrimPrefix(relativePath, "/")
	relativePath = strings.TrimPrefix(relativePath, "\\") // Windows路径兼容

	// URL编码路径以处理特殊字符（如MAC地址中的冒号）
	pathParts := strings.Split(relativePath, "/")
	for i, part := range pathParts {
		// 对每个路径部分进行URL编码，但保留路径分隔符
		pathParts[i] = strings.ReplaceAll(part, ":", "%3A")
	}
	encodedPath := strings.Join(pathParts, "/")

	return "/api/recordings/" + encodedPath
}

// uploadToStorage 上传录音文件到lingstorage
func (rs *RecordingSession) uploadToStorage() (string, error) {
	// 打开录音文件
	file, err := os.Open(rs.audioPath)
	if err != nil {
		return "", fmt.Errorf("打开录音文件失败: %w", err)
	}
	defer file.Close()

	// 生成存储文件名 - 使用WAV格式
	timestamp := time.Now().Format("20060102_150405")
	fileName := fmt.Sprintf("recordings/user_%d/assistant_%d/%s/%s_%s_%s.wav",
		rs.config.UserID,
		rs.config.AssistantID,
		time.Now().Format("2006/01/02"),
		timestamp,
		rs.config.SessionID,
		rs.config.MacAddress)

	// 上传到lingstorage
	reader, err := config.GlobalStore.UploadFromReader(&lingstorage.UploadFromReaderRequest{
		Reader:   file,
		Bucket:   config.GlobalConfig.Services.Storage.Bucket,
		Filename: fileName,
		Key:      fileName,
	})
	if err != nil {
		return "", fmt.Errorf("上传录音文件失败: %w", err)
	}

	// 返回存储URL
	return reader.URL, nil
}

// calculateNoiseLevel 计算噪音水平
func (rs *RecordingSession) calculateNoiseLevel() float64 {
	// 简单的噪音水平评估
	// 这里可以集成更复杂的音频分析算法
	// 目前基于文件大小变化来估算
	if rs.audioSize == 0 {
		return 0.0
	}

	duration := rs.endTime.Sub(rs.startTime).Seconds()
	if duration == 0 {
		return 0.0
	}

	// 假设噪音水平与音频数据的变化相关
	// 这是一个简化的估算
	avgBytesPerSecond := float64(rs.audioSize) / duration

	// 基于经验值设定噪音水平
	if avgBytesPerSecond < 1000 {
		return 0.1 // 低噪音
	} else if avgBytesPerSecond < 5000 {
		return 0.3 // 中等噪音
	} else {
		return 0.6 // 高噪音
	}
}

// calculateAudioQuality 计算音频质量
func (rs *RecordingSession) calculateAudioQuality() float64 {
	// 简单的音频质量评估
	// 基于文件大小和时长的比率
	if rs.audioSize == 0 || rs.endTime.Sub(rs.startTime).Seconds() == 0 {
		return 0.5
	}

	duration := rs.endTime.Sub(rs.startTime).Seconds()
	bytesPerSecond := float64(rs.audioSize) / duration

	// 假设16kHz单声道16bit的理想比特率约为32KB/s
	idealBytesPerSecond := float64(32 * 1024)
	quality := bytesPerSecond / idealBytesPerSecond

	if quality > 1.0 {
		quality = 1.0
	}
	if quality < 0.1 {
		quality = 0.1
	}

	return quality
}

// CleanupOldRecordings 清理过期录音
func (rm *RecordingManager) CleanupOldRecordings(ctx context.Context) error {
	if !rm.enableCleanup {
		return nil
	}

	cutoffTime := time.Now().AddDate(0, 0, -rm.retentionDays)

	// 查找过期的录音记录
	var recordings []models.CallRecording
	err := rm.db.Where("created_at < ?", cutoffTime).Find(&recordings).Error
	if err != nil {
		return fmt.Errorf("查询过期录音失败: %w", err)
	}

	deletedCount := 0
	for _, recording := range recordings {
		// 删除音频文件
		if err := os.Remove(recording.AudioPath); err != nil {
			rm.logger.Warn("删除录音文件失败",
				zap.String("path", recording.AudioPath),
				zap.Error(err))
		}

		// 从数据库删除记录
		if err := rm.db.Delete(&recording).Error; err != nil {
			rm.logger.Error("删除录音记录失败",
				zap.Uint("id", recording.ID),
				zap.Error(err))
		} else {
			deletedCount++
		}
	}

	rm.logger.Info("清理过期录音完成",
		zap.Int("deleted_count", deletedCount),
		zap.Time("cutoff_time", cutoffTime))

	return nil
}

// GetRecordingsByAssistant 获取助手的录音列表
func (rm *RecordingManager) GetRecordingsByAssistant(userID, assistantID uint, page, pageSize int) ([]models.CallRecording, int64, error) {
	offset := (page - 1) * pageSize
	return models.GetCallRecordingsByAssistant(rm.db, userID, assistantID, pageSize, offset)
}

// GetRecordingsByDevice 获取设备的录音列表
func (rm *RecordingManager) GetRecordingsByDevice(userID uint, macAddress string, page, pageSize int) ([]models.CallRecording, int64, error) {
	offset := (page - 1) * pageSize
	return models.GetCallRecordingsByDevice(rm.db, userID, macAddress, pageSize, offset)
}

// GetRecordingFile 获取录音文件
func (rm *RecordingManager) GetRecordingFile(recordingID uint, userID uint) (io.ReadCloser, string, error) {
	var recording models.CallRecording
	err := rm.db.Where("id = ? AND user_id = ?", recordingID, userID).First(&recording).Error
	if err != nil {
		return nil, "", fmt.Errorf("录音记录不存在: %w", err)
	}

	file, err := os.Open(recording.AudioPath)
	if err != nil {
		return nil, "", fmt.Errorf("打开录音文件失败: %w", err)
	}

	return file, recording.AudioFormat, nil
}

// DeleteRecording 删除录音
func (rm *RecordingManager) DeleteRecording(recordingID uint, userID uint) error {
	var recording models.CallRecording
	err := rm.db.Where("id = ? AND user_id = ?", recordingID, userID).First(&recording).Error
	if err != nil {
		return fmt.Errorf("录音记录不存在: %w", err)
	}

	// 删除音频文件
	if err := os.Remove(recording.AudioPath); err != nil {
		rm.logger.Warn("删除录音文件失败",
			zap.String("path", recording.AudioPath),
			zap.Error(err))
	}

	// 从数据库删除记录
	return rm.db.Delete(&recording).Error
}
