package llm

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/hardware/speaker"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"go.uber.org/zap"
)

// Service LLM服务实现
type Service struct {
	ctx            context.Context
	credential     *models.UserCredential
	systemPrompt   string
	model          string
	temperature    float64
	maxTokens      int
	provider       llm.LLMProvider
	errorHandler   *errhandler.Handler
	logger         *zap.Logger
	speakerManager *speaker.Manager             // 新增：发音人管理器
	speakerConfig  *speaker.SpeakerConfig       // 新增：发音人配置
	switchCallback func(speakerID string) error // 新增：切换回调
	mu             sync.RWMutex
	closed         bool
}

// NewService 创建LLM服务
func NewService(
	ctx context.Context,
	credential *models.UserCredential,
	systemPrompt string,
	model string,
	temperature float64,
	maxTokens int,
	provider llm.LLMProvider,
	errorHandler *errhandler.Handler,
	logger *zap.Logger,
) *Service {
	service := &Service{
		ctx:          ctx,
		credential:   credential,
		systemPrompt: systemPrompt,
		model:        model,
		temperature:  temperature,
		maxTokens:    maxTokens,
		provider:     provider,
		errorHandler: errorHandler,
		logger:       logger,
	}

	return service
}

// SetSpeakerManager 设置发音人管理器和切换回调
func (s *Service) SetSpeakerManager(manager *speaker.Manager, switchCallback func(speakerID string) error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.speakerManager = manager
	s.speakerConfig = speaker.GetDefaultSpeakerConfig()
	s.switchCallback = switchCallback

	s.logger.Info("设置发音人管理器",
		zap.String("managerType", fmt.Sprintf("%T", manager)),
		zap.Bool("callbackIsNil", switchCallback == nil),
		zap.String("currentSpeaker", manager.GetCurrentSpeaker()),
	)

	// 注册发音人切换工具
	s.registerSpeakerSwitchTool()
}

// LLMStreamResponse 流式响应结构
type LLMStreamResponse struct {
	Text      string     `json:"text"`
	IsStart   bool       `json:"is_start"`
	IsEnd     bool       `json:"is_end"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
	Error     error      `json:"error,omitempty"`
}

// ToolCall 工具调用结构
type ToolCall struct {
	ID       string           `json:"id"`
	Function ToolCallFunction `json:"function"`
	Type     string           `json:"type"`
}

type ToolCallFunction struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// QueryStream 流式查询
func (s *Service) QueryStream(ctx context.Context, text string, onChunk func(chunk LLMStreamResponse)) error {
	s.mu.RLock()
	closed := s.closed
	provider := s.provider
	s.mu.RUnlock()

	if closed || provider == nil {
		return errhandler.NewRecoverableError("LLM", "服务已关闭", nil)
	}

	if text == "" {
		return errhandler.NewRecoverableError("LLM", "消息为空", nil)
	}

	// 设置系统提示
	enhancedSystemPrompt := s.buildEnhancedSystemPrompt()
	if enhancedSystemPrompt != "" {
		provider.SetSystemPrompt(enhancedSystemPrompt)
	}

	// 构建流式查询选项
	options := llm.QueryOptions{
		Model:       s.model,
		MaxTokens:   intPtr(s.maxTokens),
		Temperature: float32Ptr(s.temperature),
		Stream:      true, // 关键：启用流式
	}

	// 创建带超时的上下文
	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	s.logger.Info("开始流式LLM查询",
		zap.String("text", text),
		zap.String("model", s.model),
	)

	isFirst := true
	startTime := time.Now()

	// 使用LLMProvider的QueryStream方法
	_, err := provider.QueryStream(text, options, func(segment string, isComplete bool) error {
		// 检查context状态
		select {
		case <-queryCtx.Done():
			return queryCtx.Err()
		default:
		}

		if segment != "" {
			if isFirst {
				s.logger.Info("LLM首个流式响应",
					zap.String("segment", segment),
					zap.Duration("firstResponseTime", time.Since(startTime)),
				)
			}

			onChunk(LLMStreamResponse{
				Text:    segment,
				IsStart: isFirst,
				IsEnd:   isComplete,
			})

			isFirst = false
		}

		if isComplete {
			s.logger.Info("流式LLM查询完成",
				zap.Duration("duration", time.Since(startTime)),
			)
		}

		return nil
	})

	if err != nil {
		classified := s.errorHandler.Classify(err, "LLM")
		s.logger.Error("流式LLM查询失败", zap.Error(classified))
		onChunk(LLMStreamResponse{
			Error: classified,
			IsEnd: true,
		})
		return classified
	}

	return nil
}

// handleNonStreamResponse 处理非流式响应（降级方案）
func (s *Service) handleNonStreamResponse(
	ctx context.Context,
	provider llm.LLMProvider,
	text string,
	options llm.QueryOptions,
	onChunk func(chunk LLMStreamResponse),
) error {
	// 修改为非流式
	options.Stream = false

	response, err := provider.QueryWithOptions(text, options)
	if err != nil {
		classified := s.errorHandler.Classify(err, "LLM")
		s.logger.Error("LLM查询失败", zap.Error(classified))
		onChunk(LLMStreamResponse{
			Error: classified,
			IsEnd: true,
		})
		return classified
	}

	// 模拟流式响应，按句子分割
	sentences := s.splitIntoSentences(response)
	for i, sentence := range sentences {
		if sentence != "" {
			onChunk(LLMStreamResponse{
				Text:    sentence,
				IsStart: i == 0,
				IsEnd:   i == len(sentences)-1,
			})
		}
	}

	return nil
}

// splitIntoSentences 将文本分割为句子（降级方案）
func (s *Service) splitIntoSentences(text string) []string {
	if text == "" {
		return nil
	}

	separators := []string{"。", "！", "？", ".", "!", "?", "\n"}
	sentences := []string{text}

	for _, sep := range separators {
		var newSentences []string
		for _, sentence := range sentences {
			parts := strings.Split(sentence, sep)
			for i, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					if i < len(parts)-1 {
						newSentences = append(newSentences, part+sep)
					} else {
						newSentences = append(newSentences, part)
					}
				}
			}
		}
		sentences = newSentences
	}

	// 过滤空句子
	var result []string
	for _, sentence := range sentences {
		if strings.TrimSpace(sentence) != "" {
			result = append(result, strings.TrimSpace(sentence))
		}
	}

	return result
}

// Query 查询（使用最后一条消息）
func (s *Service) Query(ctx context.Context, text string) (string, error) {
	s.mu.RLock()
	closed := s.closed
	provider := s.provider
	speakerManager := s.speakerManager
	switchCallback := s.switchCallback
	s.mu.RUnlock()

	if closed || provider == nil {
		return "", errhandler.NewRecoverableError("LLM", "服务已关闭", nil)
	}

	if text == "" {
		return "", errhandler.NewRecoverableError("LLM", "消息为空", nil)
	}

	// 设置系统提示（追加最大token限制提示）
	enhancedSystemPrompt := s.buildEnhancedSystemPrompt()
	if enhancedSystemPrompt != "" {
		provider.SetSystemPrompt(enhancedSystemPrompt)
	}

	// 构建查询选项
	options := llm.QueryOptions{
		Model:       s.model,
		MaxTokens:   intPtr(s.maxTokens),
		Temperature: float32Ptr(s.temperature),
		Stream:      false,
	}
	if s.maxTokens > 0 {
		options.MaxTokens = intPtr(s.maxTokens)
	}

	// 创建带超时的上下文，防止LLM查询阻塞过久
	queryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	// 在独立的goroutine中执行LLM查询，支持超时控制
	type queryResult struct {
		response string
		err      error
	}

	resultChan := make(chan queryResult, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("LLM查询发生panic", zap.Any("panic", r))
				resultChan <- queryResult{"", fmt.Errorf("LLM查询内部错误")}
			}
		}()

		response, err := provider.QueryWithOptions(text, options)
		resultChan <- queryResult{response, err}
	}()

	// 等待查询结果或超时
	var response string
	var err error

	select {
	case <-queryCtx.Done():
		s.logger.Warn("LLM查询超时",
			zap.String("text", text),
			zap.Duration("timeout", 15*time.Second),
		)
		return "", errhandler.NewRecoverableError("LLM", "查询超时，请稍后重试", queryCtx.Err())

	case result := <-resultChan:
		response = result.response
		err = result.err
	}

	if err != nil {
		classified := s.errorHandler.Classify(err, "LLM")
		s.logger.Error("LLM查询失败", zap.Error(classified))
		return "", classified
	}

	// 检查是否有工具调用
	if provider != nil {
		registeredTools := provider.ListFunctionTools()
		s.logger.Debug("LLM查询完成",
			zap.String("query", text),
			zap.String("response", response),
			zap.Strings("availableTools", registeredTools),
			zap.Bool("hasSpeakerTool", contains(registeredTools, "switch_speaker")),
		)
	}

	// 如果Function Calling没有工作，使用关键词检测作为后备方案
	if speakerManager != nil && switchCallback != nil {
		s.tryKeywordBasedSpeakerSwitch(text, speakerManager, switchCallback)
	}

	return response, nil
}

// buildEnhancedSystemPrompt 构建增强的系统提示词（包含最大token限制和发音人切换功能）
func (s *Service) buildEnhancedSystemPrompt() string {
	basePrompt := s.systemPrompt

	// 导入发音人切换功能提示词
	speakerPrompt := getSpeakerSystemPrompt()

	// 构建完整的系统提示词
	var enhancedPrompt string
	if basePrompt != "" {
		enhancedPrompt = basePrompt + "\n\n" + speakerPrompt
	} else {
		enhancedPrompt = speakerPrompt
	}

	// 如果设置了最大token，追加限制提示
	if s.maxTokens > 0 {
		tokenLimitPrompt := fmt.Sprintf("\n\n重要提示：你的回复必须控制在%d个token以内。请确保回复简洁、完整，避免因超出限制而被截断。如果内容较长，请优先表达核心要点，保持回复的完整性和可理解性。请不要输出emoji或Markdown", s.maxTokens)
		enhancedPrompt += tokenLimitPrompt
	}

	return enhancedPrompt
}

// getSpeakerSystemPrompt 获取发音人相关的系统提示词
func getSpeakerSystemPrompt() string {
	return `
## 多平台发音人切换功能

你具备通过Function Calling智能切换发音人的能力。系统集成了多个TTS平台（腾讯云、Azure、百度、火山引擎等），提供丰富的音色选择。

### 可用发音人类型：

#### 标准普通话：
- **standard**: 晓晓（Azure 年轻女声）- 默认推荐
- **standard_male**: 云希（Azure 温暖男声）
- **baidu_female**: 度小美（百度 温柔知性女声）
- **baidu_male**: 度小宇（百度 温暖亲和男声）

#### 四川话/重庆话：
- **sichuan**: 四川甜妹儿（火山引擎）- 四川话女声
- **sichuan_male**: 重庆小伙（火山引擎）- 四川话男声
- **chongqing**: 重庆幺妹儿（火山引擎）- 重庆话女声
- **chengdu**: 方言灿灿（火山引擎 成都）- 成都话

#### 其他方言：
- **cantonese**: 智彤（腾讯云 粤语女声）
- **northeast**: 东北丫头（火山引擎）- 东北话女声
- **northeast_male**: 东北老铁（火山引擎）- 东北话男声

#### 英语：
- **english**: WeJack（腾讯云 英文男声）- 默认推荐
- **english_male**: WeJames（腾讯云 外语男声）
- **english_female**: WeWinny（腾讯云 外语女声）

#### 童声：
- **child**: 度丫丫（百度 活泼甜美童声）
- **child_male**: 智萌（腾讯云 男童声）

### 何时调用switch_speaker函数：

**应该调用的情况：**
- "请用四川话回答我的问题" → switch_speaker(speaker_type="sichuan")
- "换成东北话说" → switch_speaker(speaker_type="northeast")
- "用英语告诉我" → switch_speaker(speaker_type="english")
- "请讲粤语" → switch_speaker(speaker_type="cantonese")
- "用重庆话说" → switch_speaker(speaker_type="chongqing")
- "换个男声" → switch_speaker(speaker_type="standard_male")
- "用童声说话" → switch_speaker(speaker_type="child")

**不应该调用的情况：**
- "你觉得四川话怎么样？" （讨论语言，不是切换请求）
- "我不喜欢东北话" （表达观点，不是切换指令）
- "英语很难学" （谈论语言学习，不是要求用英语回答）
- "重庆火锅很好吃" （提到地名，不是要求切换方言）

### 智能选择策略：
- 用户要求"四川话"时，优先选择 **sichuan**（女声）
- 用户要求"男声"时，根据当前语言选择对应男声版本
- 用户要求"英语"时，优先选择 **english**（男声，较为标准）
- 用户要求"童声"时，优先选择 **child**（活泼甜美）

### 确认话术示例：
- 切换到四川话后："好的，我现在用四川话来回答你哈~"
- 切换到东北话后："好嘞，俺现在用东北话跟你唠嗑~"
- 切换到粤语后："好嘅，我而家用粤语同你讲"
- 切换到英语后："Sure, I'll answer in English now"
- 切换到童声后："好哒好哒，我现在用小朋友的声音跟你说话~"

请准确识别用户的真实意图，只在明确的切换请求时才调用switch_speaker函数。根据用户的具体要求选择最合适的发音人类型。
`
}

// float32Ptr 返回 float32 指针
func float32Ptr(f float64) *float32 {
	val := float32(f)
	return &val
}

// intPtr 返回 int 指针
func intPtr(i int) *int {
	return &i
}

// Close 关闭服务
func (s *Service) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return nil
	}

	if s.provider != nil {
		s.provider.Hangup()
	}

	s.closed = true
	return nil
}

// registerSpeakerSwitchTool 注册发音人切换工具
func (s *Service) registerSpeakerSwitchTool() {
	if s.provider == nil || s.speakerConfig == nil {
		s.logger.Warn("无法注册发音人切换工具：provider或speakerConfig为空",
			zap.Bool("providerIsNil", s.provider == nil),
			zap.Bool("speakerConfigIsNil", s.speakerConfig == nil),
		)
		return
	}

	// 从配置中获取支持的发音人类型
	supportedTypes := s.speakerConfig.GetAllSpeakerTypes()

	s.logger.Info("准备注册发音人切换工具",
		zap.Strings("supportedTypes", supportedTypes),
		zap.String("providerType", fmt.Sprintf("%T", s.provider)),
	)

	// 定义工具参数
	parameters := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"speaker_type": map[string]interface{}{
				"type":        "string",
				"description": "发音人类型，支持多平台音色",
				"enum":        supportedTypes,
			},
			"reason": map[string]interface{}{
				"type":        "string",
				"description": "切换原因（可选）",
			},
		},
		"required": []string{"speaker_type"},
	}

	// 定义回调函数
	callback := func(args map[string]interface{}) (string, error) {
		s.logger.Info("发音人切换工具被调用", zap.Any("args", args))
		return s.handleSpeakerSwitch(args)
	}

	// 注册工具
	s.provider.RegisterFunctionTool(
		"switch_speaker",
		"切换语音合成的发音人。支持多平台音色包括：标准普通话、四川话、粤语、东北话、英语、童声等。当用户明确要求使用特定语言、方言或音色时调用此函数。注意：只有在用户明确表达切换意图时才调用，如'请用四川话回答'、'换成东北话'、'用英语说'等。不要在用户只是讨论某种语言时调用。",
		parameters,
		callback,
	)

	// 验证工具是否注册成功
	registeredTools := s.provider.ListFunctionTools()
	s.logger.Info("已注册多平台发音人切换工具",
		zap.Strings("supportedTypes", supportedTypes),
		zap.Strings("allRegisteredTools", registeredTools),
		zap.Bool("switchSpeakerRegistered", contains(registeredTools, "switch_speaker")),
	)
}

// handleSpeakerSwitch 处理发音人切换
func (s *Service) handleSpeakerSwitch(args map[string]interface{}) (string, error) {
	s.mu.RLock()
	speakerManager := s.speakerManager
	switchCallback := s.switchCallback
	s.mu.RUnlock()

	if speakerManager == nil || switchCallback == nil {
		return "", fmt.Errorf("发音人管理器未初始化")
	}

	// 获取参数
	speakerType, ok := args["speaker_type"].(string)
	if !ok {
		return "", fmt.Errorf("speaker_type 参数无效")
	}

	reason, _ := args["reason"].(string)

	// 获取发音人信息
	speakerID, speakerName, err := s.getSpeakerInfo(speakerType)
	if err != nil {
		return "", err
	}

	// 检查是否需要切换
	currentID := speakerManager.GetCurrentSpeaker()
	if currentID == speakerID {
		return fmt.Sprintf("当前已经是%s，无需切换", speakerName), nil
	}

	// 执行切换
	err = switchCallback(speakerID)
	if err != nil {
		return "", fmt.Errorf("切换失败: %w", err)
	}

	// 记录日志
	s.logger.Info("AI请求切换发音人",
		zap.String("speakerType", speakerType),
		zap.String("speakerID", speakerID),
		zap.String("speakerName", speakerName),
		zap.String("reason", reason),
	)

	// 返回成功消息
	message := fmt.Sprintf("已成功切换到%s", speakerName)
	if reason != "" {
		message += fmt.Sprintf("（%s）", reason)
	}

	return message, nil
}

// getSpeakerInfo 根据类型获取发音人信息
func (s *Service) getSpeakerInfo(speakerType string) (string, string, error) {
	if s.speakerConfig == nil {
		return "", "", fmt.Errorf("发音人配置未初始化")
	}

	speakerID, exists := s.speakerConfig.GetSpeakerID(speakerType)
	if !exists {
		return "", "", fmt.Errorf("不支持的发音人类型: %s，支持的类型: %s", speakerType, s.getSupportedTypes())
	}

	// 从发音人管理器获取详细信息
	if s.speakerManager != nil {
		if speakerInfo := s.speakerManager.GetSpeaker(speakerID); speakerInfo != nil {
			return speakerID, speakerInfo.Name, nil
		}
	}

	// 如果管理器中没有找到，返回基本信息
	mapping := s.speakerConfig.Mappings[speakerType]
	return speakerID, fmt.Sprintf("%s (%s)", speakerID, mapping.Description), nil
}

// getSupportedTypes 获取支持的发音人类型列表
func (s *Service) getSupportedTypes() string {
	if s.speakerConfig == nil {
		return "[]"
	}

	types := s.speakerConfig.GetAllSpeakerTypes()
	return fmt.Sprintf("[%s]", strings.Join(types, ", "))
}

// contains 检查字符串切片是否包含指定字符串
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// tryKeywordBasedSpeakerSwitch 尝试基于关键词的发音人切换（Function Calling的后备方案）
func (s *Service) tryKeywordBasedSpeakerSwitch(text string, speakerManager *speaker.Manager, switchCallback func(speakerID string) error) {
	// 检查是否包含明确的切换指令
	text = strings.ToLower(text)

	var targetSpeakerType string

	// 检测四川话/重庆话
	if strings.Contains(text, "四川话") || strings.Contains(text, "川话") ||
		strings.Contains(text, "用四川话") || strings.Contains(text, "说四川话") {
		targetSpeakerType = "sichuan"
	} else if strings.Contains(text, "重庆话") || strings.Contains(text, "用重庆话") {
		targetSpeakerType = "sichuan" // 使用四川话发音人
	} else if strings.Contains(text, "东北话") || strings.Contains(text, "用东北话") || strings.Contains(text, "说东北话") {
		targetSpeakerType = "northeast"
	} else if strings.Contains(text, "粤语") || strings.Contains(text, "广东话") || strings.Contains(text, "用粤语") {
		targetSpeakerType = "cantonese"
	} else if strings.Contains(text, "英语") || strings.Contains(text, "用英语") || strings.Contains(text, "说英语") {
		targetSpeakerType = "english"
	} else if strings.Contains(text, "童声") || strings.Contains(text, "小孩") || strings.Contains(text, "用童声") {
		targetSpeakerType = "child"
	} else if strings.Contains(text, "男声") || strings.Contains(text, "换男声") {
		targetSpeakerType = "standard_male"
	} else if strings.Contains(text, "女声") || strings.Contains(text, "换女声") {
		targetSpeakerType = "standard"
	}

	// 如果检测到切换指令，执行切换
	if targetSpeakerType != "" {
		s.logger.Info("检测到关键词切换指令（Function Calling后备方案）",
			zap.String("userText", text),
			zap.String("targetSpeakerType", targetSpeakerType),
		)

		// 模拟Function Calling的参数
		args := map[string]interface{}{
			"speaker_type": targetSpeakerType,
			"reason":       "关键词检测后备方案",
		}

		// 调用切换处理函数
		result, err := s.handleSpeakerSwitch(args)
		if err != nil {
			s.logger.Error("关键词切换失败", zap.Error(err))
		} else {
			s.logger.Info("关键词切换成功", zap.String("result", result))
		}
	}
}
