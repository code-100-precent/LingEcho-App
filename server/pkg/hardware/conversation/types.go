package conversation

import "time"

// ConversationTurn 对话轮次记录
type ConversationTurn struct {
	TurnID    int       `json:"turnId"`    // 轮次ID
	Timestamp time.Time `json:"timestamp"` // 全局时间戳
	Type      string    `json:"type"`      // 类型: "user" 或 "ai"
	Content   string    `json:"content"`   // 内容
	StartTime time.Time `json:"startTime"` // 开始时间
	EndTime   time.Time `json:"endTime"`   // 结束时间
	Duration  int64     `json:"duration"`  // 持续时间(毫秒)

	// 用户输入特有字段
	ASRStartTime *time.Time `json:"asrStartTime,omitempty"` // ASR开始时间
	ASREndTime   *time.Time `json:"asrEndTime,omitempty"`   // ASR结束时间
	ASRDuration  *int64     `json:"asrDuration,omitempty"`  // ASR处理时间(毫秒)

	// AI回复特有字段
	LLMStartTime *time.Time `json:"llmStartTime,omitempty"` // LLM开始时间
	LLMEndTime   *time.Time `json:"llmEndTime,omitempty"`   // LLM结束时间
	LLMDuration  *int64     `json:"llmDuration,omitempty"`  // LLM处理时间(毫秒)
	TTSStartTime *time.Time `json:"ttsStartTime,omitempty"` // TTS开始时间
	TTSEndTime   *time.Time `json:"ttsEndTime,omitempty"`   // TTS结束时间
	TTSDuration  *int64     `json:"ttsDuration,omitempty"`  // TTS处理时间(毫秒)

	// 延迟指标
	ResponseDelay *int64 `json:"responseDelay,omitempty"` // 从用户说话结束到AI开始回复的延迟(毫秒)
	TotalDelay    *int64 `json:"totalDelay,omitempty"`    // 从用户说话结束到AI回复完成的总延迟(毫秒)
}

// ConversationDetails 详细对话记录
type ConversationDetails struct {
	SessionID     string             `json:"sessionId"`     // 会话ID
	StartTime     time.Time          `json:"startTime"`     // 会话开始时间
	EndTime       time.Time          `json:"endTime"`       // 会话结束时间
	TotalTurns    int                `json:"totalTurns"`    // 总轮次数
	UserTurns     int                `json:"userTurns"`     // 用户发言轮次
	AITurns       int                `json:"aiTurns"`       // AI回复轮次
	Turns         []ConversationTurn `json:"turns"`         // 对话轮次列表
	Interruptions int                `json:"interruptions"` // 中断次数
}

// TimingMetrics 时间指标统计
type TimingMetrics struct {
	// 全局指标
	SessionDuration int64 `json:"sessionDuration"` // 会话总时长(毫秒)

	// ASR指标
	ASRCalls       int   `json:"asrCalls"`       // ASR调用次数
	ASRTotalTime   int64 `json:"asrTotalTime"`   // ASR总处理时间(毫秒)
	ASRAverageTime int64 `json:"asrAverageTime"` // ASR平均处理时间(毫秒)
	ASRMinTime     int64 `json:"asrMinTime"`     // ASR最短处理时间(毫秒)
	ASRMaxTime     int64 `json:"asrMaxTime"`     // ASR最长处理时间(毫秒)

	// LLM指标
	LLMCalls       int   `json:"llmCalls"`       // LLM调用次数
	LLMTotalTime   int64 `json:"llmTotalTime"`   // LLM总处理时间(毫秒)
	LLMAverageTime int64 `json:"llmAverageTime"` // LLM平均处理时间(毫秒)
	LLMMinTime     int64 `json:"llmMinTime"`     // LLM最短处理时间(毫秒)
	LLMMaxTime     int64 `json:"llmMaxTime"`     // LLM最长处理时间(毫秒)

	// TTS指标
	TTSCalls       int   `json:"ttsCalls"`       // TTS调用次数
	TTSTotalTime   int64 `json:"ttsTotalTime"`   // TTS总处理时间(毫秒)
	TTSAverageTime int64 `json:"ttsAverageTime"` // TTS平均处理时间(毫秒)
	TTSMinTime     int64 `json:"ttsMinTime"`     // TTS最短处理时间(毫秒)
	TTSMaxTime     int64 `json:"ttsMaxTime"`     // TTS最长处理时间(毫秒)

	// 响应延迟指标
	ResponseDelays       []int64 `json:"responseDelays"`       // 所有响应延迟列表(毫秒)
	AverageResponseDelay int64   `json:"averageResponseDelay"` // 平均响应延迟(毫秒)
	MinResponseDelay     int64   `json:"minResponseDelay"`     // 最短响应延迟(毫秒)
	MaxResponseDelay     int64   `json:"maxResponseDelay"`     // 最长响应延迟(毫秒)

	// 总延迟指标
	TotalDelays       []int64 `json:"totalDelays"`       // 所有总延迟列表(毫秒)
	AverageTotalDelay int64   `json:"averageTotalDelay"` // 平均总延迟(毫秒)
	MinTotalDelay     int64   `json:"minTotalDelay"`     // 最短总延迟(毫秒)
	MaxTotalDelay     int64   `json:"maxTotalDelay"`     // 最长总延迟(毫秒)
}
