package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
)

const (
	VADServiceURL = "http://localhost:7073"
)

// VADRequest VAD 请求结构
type VADRequest struct {
	AudioData   string `json:"audio_data"`   // Base64 编码的音频数据
	AudioFormat string `json:"audio_format"` // "pcm" 或 "opus"
	SampleRate  int    `json:"sample_rate"`
	Channels    int    `json:"channels"`
}

// VADResponse VAD 响应结构
type VADResponse struct {
	HaveVoice  bool    `json:"have_voice"`
	VoiceStop  bool    `json:"voice_stop"`
	SpeechProb float64 `json:"speech_prob,omitempty"`
}

// VADClient VAD 服务客户端
type VADClient struct {
	BaseURL string
	Client  *http.Client
}

// NewVADClient 创建新的 VAD 客户端
func NewVADClient(baseURL string) *VADClient {
	return &VADClient{
		BaseURL: baseURL,
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// DetectVAD 检测音频中的语音活动（JSON 格式，Base64 编码）
func (c *VADClient) DetectVAD(
	audioData []byte,
	format string,
	sessionID string,
) (*VADResponse, error) {
	// Base64 编码音频数据
	audioBase64 := base64.StdEncoding.EncodeToString(audioData)

	req := VADRequest{
		AudioData:   audioBase64,
		AudioFormat: format,
		SampleRate:  16000,
		Channels:    1,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/vad?session_id=%s", c.BaseURL, sessionID)
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("VAD service error (status %d): %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var vadResp VADResponse
	if err := json.Unmarshal(body, &vadResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &vadResp, nil
}

// DetectVADFromFile 从文件检测语音活动（文件上传格式）
func (c *VADClient) DetectVADFromFile(
	filePath string,
	format string,
	sessionID string,
) (*VADResponse, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// 添加文件
	part, err := writer.CreateFormFile("file", filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, file); err != nil {
		return nil, fmt.Errorf("failed to copy file: %w", err)
	}

	// 添加其他字段
	writer.WriteField("audio_format", format)
	writer.WriteField("sample_rate", "16000")
	writer.WriteField("channels", "1")
	writer.WriteField("session_id", sessionID)

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close writer: %w", err)
	}

	url := fmt.Sprintf("%s/vad/upload", c.BaseURL)
	httpReq, err := http.NewRequest("POST", url, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("VAD service error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var vadResp VADResponse
	if err := json.Unmarshal(bodyBytes, &vadResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &vadResp, nil
}

// ResetSession 重置会话状态
func (c *VADClient) ResetSession(sessionID string) error {
	url := fmt.Sprintf("%s/vad/reset?session_id=%s", c.BaseURL, sessionID)
	resp, err := c.Client.Post(url, "application/json", nil)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("reset session failed with status %d", resp.StatusCode)
	}

	return nil
}

// HealthCheck 健康检查
func (c *VADClient) HealthCheck() error {
	url := fmt.Sprintf("%s/health", c.BaseURL)
	resp, err := c.Client.Get(url)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed with status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	fmt.Printf("Health check response: %s\n", string(body))
	return nil
}

// generateTestPCM 生成测试用的 PCM 音频数据（16kHz, 16-bit, 单声道）
func generateTestPCM(durationMs int, sampleRate int) []byte {
	numSamples := int(sampleRate * durationMs / 1000)
	// 生成静音（全0）或简单的正弦波用于测试
	audio := make([]byte, numSamples*2) // 16-bit = 2 bytes per sample
	// 这里生成静音，实际使用时可以生成有声音的测试数据
	return audio
}

func main() {
	fmt.Println("=== VAD Service Test Client ===")
	fmt.Println()

	client := NewVADClient(VADServiceURL)

	// 1. 健康检查
	fmt.Println("1. Testing health check...")
	if err := client.HealthCheck(); err != nil {
		fmt.Printf("❌ Health check failed: %v\n", err)
		fmt.Println("\n⚠️  Make sure VAD service is running on", VADServiceURL)
		os.Exit(1)
	}
	fmt.Println("✅ VAD service is healthy")
	fmt.Println()

	// 2. 测试 PCM 音频（静音）
	fmt.Println("2. Testing PCM audio (silence)...")
	sessionID := fmt.Sprintf("test_%d", time.Now().Unix())

	pcmData := generateTestPCM(100, 16000) // 100ms 静音
	result, err := client.DetectVAD(pcmData, "pcm", sessionID)
	if err != nil {
		fmt.Printf("❌ VAD detection failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("   Result: have_voice=%v, voice_stop=%v", result.HaveVoice, result.VoiceStop)
	if result.SpeechProb > 0 {
		fmt.Printf(", speech_prob=%.3f", result.SpeechProb)
	}
	fmt.Println()
	fmt.Println()

	// 3. 测试多次调用（模拟流式处理）
	fmt.Println("3. Testing multiple calls (streaming simulation)...")
	for i := 0; i < 5; i++ {
		pcmData := generateTestPCM(100, 16000) // 每帧 100ms
		result, err := client.DetectVAD(pcmData, "pcm", sessionID)
		if err != nil {
			fmt.Printf("❌ Call %d failed: %v\n", i+1, err)
			continue
		}
		fmt.Printf("   Call %d: have_voice=%v, voice_stop=%v", i+1, result.HaveVoice, result.VoiceStop)
		if result.SpeechProb > 0 {
			fmt.Printf(", prob=%.3f", result.SpeechProb)
		}
		fmt.Println()
		time.Sleep(100 * time.Millisecond)
	}
	fmt.Println()

	// 4. 重置会话
	fmt.Println("4. Testing session reset...")
	if err := client.ResetSession(sessionID); err != nil {
		fmt.Printf("❌ Reset session failed: %v\n", err)
	} else {
		fmt.Printf("✅ Session %s reset successfully\n", sessionID)
	}
	fmt.Println()

	// 5. 测试文件上传（如果提供了文件路径）
	if len(os.Args) > 1 {
		filePath := os.Args[1]
		fmt.Printf("5. Testing file upload: %s\n", filePath)
		result, err := client.DetectVADFromFile(filePath, "pcm", sessionID)
		if err != nil {
			fmt.Printf("❌ File upload test failed: %v\n", err)
		} else {
			fmt.Printf("✅ File upload test: have_voice=%v, voice_stop=%v\n", result.HaveVoice, result.VoiceStop)
		}
		fmt.Println()
	}

	fmt.Println("✅ All tests completed!")
}
