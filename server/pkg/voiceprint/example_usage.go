package voiceprint

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/config"
)

// ExampleUsage 展示如何使用声纹识别服务
func ExampleUsage() {
	// 1. 从全局配置获取声纹配置
	voiceprintConfig := &Config{
		Enabled:             config.GlobalConfig.Services.Voice.Voiceprint.Enabled,
		BaseURL:             config.GlobalConfig.Services.Voice.Voiceprint.BaseURL,
		APIKey:              config.GlobalConfig.Services.Voice.Voiceprint.APIKey,
		Timeout:             config.GlobalConfig.Services.Voice.Voiceprint.Timeout,
		ConnectTimeout:      config.GlobalConfig.Services.Voice.Voiceprint.ConnectTimeout,
		MaxRetries:          config.GlobalConfig.Services.Voice.Voiceprint.MaxRetries,
		RetryInterval:       config.GlobalConfig.Services.Voice.Voiceprint.RetryInterval,
		SimilarityThreshold: config.GlobalConfig.Services.Voice.Voiceprint.SimilarityThreshold,
		MaxCandidates:       config.GlobalConfig.Services.Voice.Voiceprint.MaxCandidates,
		CacheEnabled:        config.GlobalConfig.Services.Voice.Voiceprint.CacheEnabled,
		CacheTTL:            config.GlobalConfig.Services.Voice.Voiceprint.CacheTTL,
		LogEnabled:          config.GlobalConfig.Services.Voice.Voiceprint.LogEnabled,
		LogLevel:            config.GlobalConfig.Services.Voice.Voiceprint.LogLevel,
	}

	// 2. 创建缓存客户端（假设已有全局缓存）
	var cacheClient cache.Cache // 这里应该使用你的缓存实例

	// 3. 创建声纹识别服务
	service, err := NewService(voiceprintConfig, cacheClient)
	if err != nil {
		log.Fatalf("Failed to create voiceprint service: %v", err)
	}
	defer service.Close()

	// 4. 检查服务是否启用
	if !service.IsEnabled() {
		log.Println("Voiceprint service is disabled")
		return
	}

	ctx := context.Background()

	// 5. 健康检查
	health, err := service.HealthCheck(ctx)
	if err != nil {
		log.Printf("Health check failed: %v", err)
		return
	}
	fmt.Printf("Service status: %s, Total voiceprints: %d\n", health.Status, health.TotalVoiceprints)

	// 6. 加载音频文件
	audioData, err := LoadAudioFile("path/to/audio.wav")
	if err != nil {
		log.Printf("Failed to load audio file: %v", err)
		return
	}

	// 7. 注册声纹
	registerReq := &RegisterRequest{
		SpeakerID: "user_001",
		AudioData: audioData,
		Metadata: map[string]interface{}{
			"user_name":     "张三",
			"register_time": time.Now(),
		},
	}

	registerResp, err := service.RegisterVoiceprint(ctx, registerReq)
	if err != nil {
		log.Printf("Registration failed: %v", err)
		return
	}
	fmt.Printf("Registration result: %s\n", registerResp.Message)

	// 8. 识别声纹
	identifyReq := &IdentifyRequest{
		CandidateIDs: []string{"user_001", "user_002"},
		AudioData:    audioData,
		Threshold:    0.6,
	}

	identifyResult, err := service.IdentifyVoiceprint(ctx, identifyReq)
	if err != nil {
		log.Printf("Identification failed: %v", err)
		return
	}

	fmt.Printf("Identification result:\n")
	fmt.Printf("  Speaker ID: %s\n", identifyResult.SpeakerID)
	fmt.Printf("  Score: %.4f\n", identifyResult.Score)
	fmt.Printf("  Confidence: %s\n", identifyResult.Confidence)
	fmt.Printf("  Is Match: %t\n", identifyResult.IsMatch)
	fmt.Printf("  Process Time: %v\n", identifyResult.ProcessTime)

	// 9. 带置信度检查的识别
	highConfidenceResult, err := service.IdentifyWithConfidence(ctx, identifyReq, "high")
	if err != nil {
		log.Printf("High confidence identification failed: %v", err)
	} else {
		fmt.Printf("High confidence identification successful: %s\n", highConfidenceResult.SpeakerID)
	}

	// 10. 获取统计信息
	stats := service.GetStatistics()
	fmt.Printf("Statistics:\n")
	fmt.Printf("  Total Identifications: %d\n", stats.TotalIdentifications)
	fmt.Printf("  Success Rate: %.2f%%\n", stats.SuccessRate)
	fmt.Printf("  Average Score: %.4f\n", stats.AverageScore)

	// 11. 删除声纹（可选）
	// deleteResp, err := service.DeleteVoiceprint(ctx, "user_001")
	// if err != nil {
	//     log.Printf("Deletion failed: %v", err)
	// } else {
	//     fmt.Printf("Deletion result: %s\n", deleteResp.Message)
	// }
}

// ExampleBatchOperations 展示批量操作
func ExampleBatchOperations() {
	// 创建服务（省略配置步骤）
	config := DefaultConfig()
	config.Enabled = true
	config.BaseURL = "http://localhost:8005"
	config.APIKey = "your-api-key"

	var cacheClient cache.Cache
	service, err := NewService(config, cacheClient)
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// 批量注册
	requests := []RegisterRequest{
		{
			SpeakerID: "user_001",
			AudioData: []byte("audio_data_1"), // 实际应该是WAV数据
		},
		{
			SpeakerID: "user_002",
			AudioData: []byte("audio_data_2"),
		},
	}

	batchResp, err := service.BatchRegister(ctx, requests)
	if err != nil {
		log.Printf("Batch registration failed: %v", err)
		return
	}

	fmt.Printf("Batch registration completed:\n")
	fmt.Printf("  Success: %d\n", batchResp.Success)
	fmt.Printf("  Failed: %d\n", batchResp.Failed)
	fmt.Printf("  Total: %d\n", batchResp.Total)
}

// ExampleErrorHandling 展示错误处理
func ExampleErrorHandling() {
	config := DefaultConfig()
	config.Enabled = true
	config.BaseURL = "http://localhost:8005"
	config.APIKey = "invalid-key"

	var cacheClient cache.Cache
	service, err := NewService(config, cacheClient)
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}
	defer service.Close()

	ctx := context.Background()

	// 尝试注册（会失败）
	registerReq := &RegisterRequest{
		SpeakerID: "test_user",
		AudioData: []byte("invalid_audio_data"),
	}

	_, err = service.RegisterVoiceprint(ctx, registerReq)
	if err != nil {
		// 检查错误类型
		if IsVoiceprintError(err) {
			fmt.Printf("Voiceprint error: %s\n", GetErrorCode(err))
		}

		// 根据错误类型处理
		switch {
		case err == ErrServiceDisabled:
			fmt.Println("Service is disabled")
		case err == ErrInvalidAudioFormat:
			fmt.Println("Invalid audio format")
		case err == ErrSpeakerExists:
			fmt.Println("Speaker already exists")
		default:
			fmt.Printf("Other error: %v\n", err)
		}
	}
}

// ExampleAudioProcessing 展示音频处理功能
func ExampleAudioProcessing() {
	// 加载音频文件
	audioData, err := LoadAudioFile("test.wav")
	if err != nil {
		log.Printf("Failed to load audio: %v", err)
		return
	}

	// 获取音频信息
	info, err := GetAudioInfo(audioData)
	if err != nil {
		log.Printf("Failed to get audio info: %v", err)
		return
	}

	fmt.Printf("Audio Info:\n")
	fmt.Printf("  Format: %s\n", info.Format)
	fmt.Printf("  Sample Rate: %d Hz\n", info.SampleRate)
	fmt.Printf("  Channels: %d\n", info.Channels)
	fmt.Printf("  Bits Per Sample: %d\n", info.BitsPerSample)
	fmt.Printf("  Duration: %s\n", FormatDuration(info.Duration))
	fmt.Printf("  File Size: %s\n", FormatFileSize(info.FileSize))

	// 验证音频质量
	if err := ValidateAudioQuality(audioData); err != nil {
		log.Printf("Audio quality validation failed: %v", err)
		return
	}

	// 验证音频时长
	minDuration := 3 * time.Second
	maxDuration := 30 * time.Second
	if err := ValidateAudioDuration(audioData, minDuration, maxDuration); err != nil {
		log.Printf("Audio duration validation failed: %v", err)
		return
	}

	// 转换为单声道（如果需要）
	if info.Channels > 1 {
		monoData, err := ConvertToMono(audioData)
		if err != nil {
			log.Printf("Failed to convert to mono: %v", err)
			return
		}
		fmt.Printf("Converted to mono, new size: %s\n", FormatFileSize(int64(len(monoData))))
	}

	// 计算音频哈希
	hash := CalculateAudioHash(audioData)
	fmt.Printf("Audio hash: %s\n", hash)
}
