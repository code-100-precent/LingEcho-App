package llm

import (
	"context"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"go.uber.org/zap"
)

// MockLLMProvider 模拟一个会超时的LLM提供商
type MockLLMProvider struct {
	delay time.Duration
}

func (m *MockLLMProvider) Query(text, model string) (string, error) {
	time.Sleep(m.delay)
	return "mock response", nil
}

func (m *MockLLMProvider) QueryWithOptions(text string, options llm.QueryOptions) (string, error) {
	// 模拟长时间的LLM查询
	time.Sleep(m.delay)
	return "mock response", nil
}

func (m *MockLLMProvider) QueryStream(text string, options llm.QueryOptions, callback func(segment string, isComplete bool) error) (string, error) {
	time.Sleep(m.delay)
	return "mock response", nil
}

func (m *MockLLMProvider) RegisterFunctionTool(name, description string, parameters interface{}, callback llm.FunctionToolCallback) {
}
func (m *MockLLMProvider) RegisterFunctionToolDefinition(def *llm.FunctionToolDefinition) {}
func (m *MockLLMProvider) GetFunctionTools() []interface{}                                { return []interface{}{} }
func (m *MockLLMProvider) ListFunctionTools() []string                                    { return []string{} }
func (m *MockLLMProvider) GetLastUsage() (llm.Usage, bool)                                { return llm.Usage{}, false }
func (m *MockLLMProvider) ResetMessages()                                                 {}
func (m *MockLLMProvider) SetSystemPrompt(prompt string)                                  {}
func (m *MockLLMProvider) GetMessages() []llm.Message                                     { return []llm.Message{} }
func (m *MockLLMProvider) Interrupt()                                                     {}
func (m *MockLLMProvider) Hangup()                                                        {}

// TestLLMQueryTimeout 测试LLM查询超时机制（使用较短超时以便快速验证）
func TestLLMQueryTimeout(t *testing.T) {
	logger := zap.NewNop()
	errorHandler := errhandler.NewHandler(logger)

	// 创建一个会延迟2秒的mock provider
	mockProvider := &MockLLMProvider{delay: 2 * time.Second}

	service := NewService(
		context.Background(),
		&models.UserCredential{},
		"test prompt",
		"test-model",
		0.7,
		1000,
		mockProvider,
		errorHandler,
		logger,
	)

	// 使用1秒超时的上下文测试
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	response, err := service.Query(ctx, "test query")

	duration := time.Since(start)

	// 验证在1秒左右超时
	if duration < 900*time.Millisecond || duration > 1100*time.Millisecond {
		t.Errorf("超时时间不正确，期望约1秒，实际: %v", duration)
	}

	// 验证返回超时错误
	if err == nil {
		t.Error("期望返回超时错误，但没有错误")
	}

	// 验证响应为空
	if response != "" {
		t.Errorf("期望空响应，实际: %s", response)
	}

	t.Logf("超时测试通过，耗时: %v, 错误: %v", duration, err)
}

// TestLLMQueryNormal 测试正常的LLM查询
func TestLLMQueryNormal(t *testing.T) {
	logger := zap.NewNop()
	errorHandler := errhandler.NewHandler(logger)

	// 创建一个快速响应的mock provider
	mockProvider := &MockLLMProvider{delay: 100 * time.Millisecond}

	service := NewService(
		context.Background(),
		&models.UserCredential{},
		"test prompt",
		"test-model",
		0.7,
		1000,
		mockProvider,
		errorHandler,
		logger,
	)

	// 测试正常查询
	start := time.Now()
	ctx := context.Background()

	response, err := service.Query(ctx, "test query")

	duration := time.Since(start)

	// 验证快速响应
	if duration > 1*time.Second {
		t.Errorf("响应时间过长: %v", duration)
	}

	// 验证没有错误
	if err != nil {
		t.Errorf("不期望错误，但得到: %v", err)
	}

	// 验证有响应
	if response != "mock response" {
		t.Errorf("期望 'mock response'，实际: %s", response)
	}

	t.Logf("正常查询测试通过，耗时: %v, 响应: %s", duration, response)
}

// BenchmarkLLMQueryWithTimeout 基准测试带超时的LLM查询
func BenchmarkLLMQueryWithTimeout(b *testing.B) {
	logger := zap.NewNop()
	errorHandler := errhandler.NewHandler(logger)

	// 创建一个快速响应的mock provider
	mockProvider := &MockLLMProvider{delay: 10 * time.Millisecond}

	service := NewService(
		context.Background(),
		&models.UserCredential{},
		"test prompt",
		"test-model",
		0.7,
		1000,
		mockProvider,
		errorHandler,
		logger,
	)

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.Query(ctx, "benchmark query")
	}
}
