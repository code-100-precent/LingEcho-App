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
	"github.com/code-100-precent/LingEcho/pkg/hardware/conversation"
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

	// 对话轮次跟踪
	conversationTurns []conversation.ConversationTurn
	currentTurnID     int
	interruptions     int
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

	// 自动创建用户对话轮次
	rs.createUserTurn(text)
}

// AddAIResponse 添加AI回复文本
func (rs *RecordingSession) AddAIResponse(text string) {
	if rs.aiResponse.Len() > 0 {
		rs.aiResponse.WriteString("\n")
	}
	rs.aiResponse.WriteString(fmt.Sprintf("[%s] %s",
		time.Now().Format("15:04:05"), text))

	// 自动创建AI对话轮次
	rs.createAITurn(text)
}

// createUserTurn 创建用户对话轮次
func (rs *RecordingSession) createUserTurn(content string) {
	rs.currentTurnID++
	now := time.Now()

	turn := conversation.ConversationTurn{
		TurnID:    rs.currentTurnID,
		Timestamp: now,
		Type:      "user",
		Content:   content,
		StartTime: now,
		EndTime:   now,
		Duration:  0, // 将通过RecordASRTiming更新
	}

	rs.conversationTurns = append(rs.conversationTurns, turn)
}

// createAITurn 创建AI对话轮次
func (rs *RecordingSession) createAITurn(content string) {
	rs.currentTurnID++
	now := time.Now()

	turn := conversation.ConversationTurn{
		TurnID:    rs.currentTurnID,
		Timestamp: now,
		Type:      "ai",
		Content:   content,
		StartTime: now,
		EndTime:   now,
		Duration:  0, // 将通过RecordTTSTiming更新
	}

	rs.conversationTurns = append(rs.conversationTurns, turn)
}

// StartUserTurn 开始用户对话轮次（无参数版本，供消息处理器调用）
func (rs *RecordingSession) StartUserTurn() {
	rs.currentTurnID++
	now := time.Now()

	turn := conversation.ConversationTurn{
		TurnID:    rs.currentTurnID,
		Timestamp: now,
		Type:      "user",
		Content:   "", // 内容将在EndUserTurn时设置
		StartTime: now,
		Duration:  0,
	}

	rs.conversationTurns = append(rs.conversationTurns, turn)
}

// StartUserTurnIfNeeded 如果需要的话开始用户对话轮次
func (rs *RecordingSession) StartUserTurnIfNeeded() {
	// 检查是否已经有进行中的用户轮次
	if len(rs.conversationTurns) > 0 {
		lastTurn := &rs.conversationTurns[len(rs.conversationTurns)-1]
		if lastTurn.Type == "user" && lastTurn.Content == "" {
			// 已经有进行中的用户轮次，不需要重复创建
			return
		}
	}
	rs.StartUserTurn()
}

// EndUserTurn 结束用户对话轮次（字符串参数版本，供消息处理器调用）
func (rs *RecordingSession) EndUserTurn(content string) {
	if len(rs.conversationTurns) == 0 {
		return
	}

	lastTurn := &rs.conversationTurns[len(rs.conversationTurns)-1]
	if lastTurn.Type != "user" {
		return
	}

	now := time.Now()
	lastTurn.Content = content
	lastTurn.EndTime = now
	lastTurn.Duration = now.Sub(lastTurn.StartTime).Milliseconds()

	// 同时添加到传统的userInput字段以保持兼容性
	rs.AddUserInput(content)
}

// StartAITurn 开始AI对话轮次（无参数版本，供消息处理器调用）
func (rs *RecordingSession) StartAITurn() {
	rs.currentTurnID++
	now := time.Now()

	turn := conversation.ConversationTurn{
		TurnID:    rs.currentTurnID,
		Timestamp: now,
		Type:      "ai",
		Content:   "", // 内容将在后续设置
		StartTime: now,
		Duration:  0,
	}

	rs.conversationTurns = append(rs.conversationTurns, turn)
}

// RecordLLMTiming 记录LLM处理时间
func (rs *RecordingSession) RecordLLMTiming(startTime, endTime time.Time) {
	if len(rs.conversationTurns) == 0 {
		return
	}

	// 查找最后一个AI轮次
	for i := len(rs.conversationTurns) - 1; i >= 0; i-- {
		turn := &rs.conversationTurns[i]
		if turn.Type == "ai" && turn.LLMStartTime == nil {
			// 记录LLM时间
			duration := endTime.Sub(startTime).Milliseconds()
			turn.LLMStartTime = &startTime
			turn.LLMEndTime = &endTime
			turn.LLMDuration = &duration

			// 计算响应延迟：从上一个用户轮次结束到LLM开始的时间
			if i > 0 {
				for j := i - 1; j >= 0; j-- {
					if rs.conversationTurns[j].Type == "user" {
						responseDelay := startTime.Sub(rs.conversationTurns[j].EndTime).Milliseconds()
						if responseDelay < 0 {
							responseDelay = 0
						}
						turn.ResponseDelay = &responseDelay
						break
					}
				}
			}
			break
		}
	}
}

// RecordTTSTiming 记录TTS处理时间（从LLM完成到TTS开始发送音频的时间）
func (rs *RecordingSession) RecordTTSTiming(startTime, endTime time.Time, text string) {
	if len(rs.conversationTurns) == 0 {
		return
	}

	// 查找最后一个AI轮次
	for i := len(rs.conversationTurns) - 1; i >= 0; i-- {
		turn := &rs.conversationTurns[i]
		if turn.Type == "ai" && turn.TTSStartTime == nil {
			// 记录TTS时间（这里应该是TTS准备时间，不是整个合成时间）
			duration := endTime.Sub(startTime).Milliseconds()
			turn.TTSStartTime = &startTime
			turn.TTSEndTime = &endTime
			turn.TTSDuration = &duration

			// 更新AI轮次的结束时间（TTS开始发送音频的时间）
			turn.EndTime = endTime
			turn.Duration = endTime.Sub(turn.StartTime).Milliseconds()

			// 计算总延迟：从用户说话结束到TTS开始发送音频的总时间
			if turn.ResponseDelay != nil && turn.LLMDuration != nil {
				totalDelay := *turn.ResponseDelay + *turn.LLMDuration + *turn.TTSDuration
				turn.TotalDelay = &totalDelay
			}

			// 设置内容
			if turn.Content == "" {
				turn.Content = text
			}
			break
		}
	}
}

// RecordASRTiming 记录ASR处理时间
func (rs *RecordingSession) RecordASRTiming(startTime, endTime time.Time, text string) {
	if len(rs.conversationTurns) == 0 {
		return
	}

	// 查找最后一个用户轮次
	for i := len(rs.conversationTurns) - 1; i >= 0; i-- {
		turn := &rs.conversationTurns[i]
		if turn.Type == "user" && turn.ASRStartTime == nil {
			// 记录ASR时间
			duration := endTime.Sub(startTime).Milliseconds()
			turn.ASRStartTime = &startTime
			turn.ASREndTime = &endTime
			turn.ASRDuration = &duration

			// 更新用户轮次的结束时间和总时长
			turn.EndTime = endTime
			turn.Duration = endTime.Sub(turn.StartTime).Milliseconds()

			// 设置内容
			if turn.Content == "" {
				turn.Content = text
			}
			break
		}
	}
}
func (rs *RecordingSession) RecordInterruption() {
	rs.interruptions++
}

// StopRecording 停止录音并保存记录
func (rs *RecordingSession) StopRecording(callStatus string) (*models.CallRecording, error) {
	if !rs.isRecording {
		return nil, fmt.Errorf("录音会话未激活")
	}

	rs.isRecording = false
	rs.endTime = time.Now()

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
	}

	// 生成并保存对话详情数据
	conversationDetails := rs.generateConversationDetails()
	if err := recording.SetConversationDetails(conversationDetails); err != nil {
		rs.manager.logger.Error("保存对话详情失败", zap.Error(err))
	}

	// 生成并保存时间指标数据
	timingMetrics := rs.generateTimingMetrics()
	if err := recording.SetTimingMetrics(timingMetrics); err != nil {
		rs.manager.logger.Error("保存时间指标失败", zap.Error(err))
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

// generateConversationDetails 生成对话详情数据
func (rs *RecordingSession) generateConversationDetails() *conversation.ConversationDetails {
	userTurns := 0
	aiTurns := 0

	for _, turn := range rs.conversationTurns {
		if turn.Type == "user" {
			userTurns++
		} else if turn.Type == "ai" {
			aiTurns++
		}
	}

	return &conversation.ConversationDetails{
		SessionID:     rs.config.SessionID,
		StartTime:     rs.startTime,
		EndTime:       rs.endTime,
		TotalTurns:    len(rs.conversationTurns),
		UserTurns:     userTurns,
		AITurns:       aiTurns,
		Turns:         rs.conversationTurns,
		Interruptions: rs.interruptions,
	}
}

// generateTimingMetrics 生成时间指标数据
func (rs *RecordingSession) generateTimingMetrics() *conversation.TimingMetrics {
	metrics := &conversation.TimingMetrics{
		SessionDuration: rs.endTime.Sub(rs.startTime).Milliseconds(),
	}

	// 统计ASR指标
	asrTimes := []int64{}
	for _, turn := range rs.conversationTurns {
		if turn.Type == "user" && turn.ASRDuration != nil {
			asrTimes = append(asrTimes, *turn.ASRDuration)
		}
	}

	if len(asrTimes) > 0 {
		metrics.ASRCalls = len(asrTimes)
		metrics.ASRTotalTime = sumInt64Slice(asrTimes)
		metrics.ASRAverageTime = metrics.ASRTotalTime / int64(len(asrTimes))
		metrics.ASRMinTime = minInt64Slice(asrTimes)
		metrics.ASRMaxTime = maxInt64Slice(asrTimes)
	}

	// 统计LLM指标
	llmTimes := []int64{}
	for _, turn := range rs.conversationTurns {
		if turn.Type == "ai" && turn.LLMDuration != nil {
			llmTimes = append(llmTimes, *turn.LLMDuration)
		}
	}

	if len(llmTimes) > 0 {
		metrics.LLMCalls = len(llmTimes)
		metrics.LLMTotalTime = sumInt64Slice(llmTimes)
		metrics.LLMAverageTime = metrics.LLMTotalTime / int64(len(llmTimes))
		metrics.LLMMinTime = minInt64Slice(llmTimes)
		metrics.LLMMaxTime = maxInt64Slice(llmTimes)
	}

	// 统计TTS指标
	ttsTimes := []int64{}
	for _, turn := range rs.conversationTurns {
		if turn.Type == "ai" && turn.TTSDuration != nil {
			ttsTimes = append(ttsTimes, *turn.TTSDuration)
		}
	}

	if len(ttsTimes) > 0 {
		metrics.TTSCalls = len(ttsTimes)
		metrics.TTSTotalTime = sumInt64Slice(ttsTimes)
		metrics.TTSAverageTime = metrics.TTSTotalTime / int64(len(ttsTimes))
		metrics.TTSMinTime = minInt64Slice(ttsTimes)
		metrics.TTSMaxTime = maxInt64Slice(ttsTimes)
	}

	// 统计响应延迟指标
	responseDelays := []int64{}
	for _, turn := range rs.conversationTurns {
		if turn.Type == "ai" && turn.ResponseDelay != nil {
			responseDelays = append(responseDelays, *turn.ResponseDelay)
		}
	}

	if len(responseDelays) > 0 {
		metrics.ResponseDelays = responseDelays
		metrics.AverageResponseDelay = sumInt64Slice(responseDelays) / int64(len(responseDelays))
		metrics.MinResponseDelay = minInt64Slice(responseDelays)
		metrics.MaxResponseDelay = maxInt64Slice(responseDelays)
	}

	// 统计总延迟指标
	totalDelays := []int64{}
	for _, turn := range rs.conversationTurns {
		if turn.Type == "ai" && turn.TotalDelay != nil {
			totalDelays = append(totalDelays, *turn.TotalDelay)
		}
	}

	if len(totalDelays) > 0 {
		metrics.TotalDelays = totalDelays
		metrics.AverageTotalDelay = sumInt64Slice(totalDelays) / int64(len(totalDelays))
		metrics.MinTotalDelay = minInt64Slice(totalDelays)
		metrics.MaxTotalDelay = maxInt64Slice(totalDelays)
	}

	return metrics
}

// 辅助函数
func sumInt64Slice(slice []int64) int64 {
	sum := int64(0)
	for _, v := range slice {
		sum += v
	}
	return sum
}

func minInt64Slice(slice []int64) int64 {
	if len(slice) == 0 {
		return 0
	}
	min := slice[0]
	for _, v := range slice[1:] {
		if v < min {
			min = v
		}
	}
	return min
}

func maxInt64Slice(slice []int64) int64 {
	if len(slice) == 0 {
		return 0
	}
	max := slice[0]
	for _, v := range slice[1:] {
		if v > max {
			max = v
		}
	}
	return max
}
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
