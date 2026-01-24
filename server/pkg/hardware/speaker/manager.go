package speaker

import (
	"fmt"
	"strings"
	"sync"

	"go.uber.org/zap"
)

// SpeakerInfo 发音人信息
type SpeakerInfo struct {
	ID          string   `json:"id"`          // 发音人ID
	Name        string   `json:"name"`        // 发音人名称
	Language    string   `json:"language"`    // 语言代码 (zh-CN, zh-TW, en-US等)
	Dialect     string   `json:"dialect"`     // 方言 (sichuan, cantonese, etc.)
	Gender      string   `json:"gender"`      // 性别 (male, female)
	Description string   `json:"description"` // 描述
	Keywords    []string `json:"keywords"`    // 关键词（用于AI识别）
}

// Manager 发音人管理器
type Manager struct {
	speakers       map[string]*SpeakerInfo   // ID -> SpeakerInfo
	languageMap    map[string][]*SpeakerInfo // 语言 -> 发音人列表
	dialectMap     map[string][]*SpeakerInfo // 方言 -> 发音人列表
	keywordMap     map[string][]*SpeakerInfo // 关键词 -> 发音人列表
	currentSpeaker string                    // 当前发音人ID
	mu             sync.RWMutex
	logger         *zap.Logger
}

// NewManager 创建发音人管理器
func NewManager(logger *zap.Logger) *Manager {
	mgr := &Manager{
		speakers:    make(map[string]*SpeakerInfo),
		languageMap: make(map[string][]*SpeakerInfo),
		dialectMap:  make(map[string][]*SpeakerInfo),
		keywordMap:  make(map[string][]*SpeakerInfo),
		logger:      logger,
	}

	// 初始化默认发音人配置
	mgr.initDefaultSpeakers()

	return mgr
}

// initDefaultSpeakers 初始化默认发音人配置
func (m *Manager) initDefaultSpeakers() {
	defaultSpeakers := []*SpeakerInfo{
		// 标准普通话发音人（多平台）
		{
			ID:          "zh-CN-XiaoxiaoNeural", // Azure
			Name:        "晓晓",
			Language:    "zh-CN",
			Dialect:     "standard",
			Gender:      "female",
			Description: "Azure 年轻女声",
			Keywords:    []string{"普通话", "标准", "正常", "默认", "晓晓"},
		},
		{
			ID:          "zh-CN-YunxiNeural", // Azure
			Name:        "云希",
			Language:    "zh-CN",
			Dialect:     "standard",
			Gender:      "male",
			Description: "Azure 温暖男声",
			Keywords:    []string{"普通话", "标准", "男声", "云希"},
		},
		{
			ID:          "1", // 百度
			Name:        "度小美",
			Language:    "zh-CN",
			Dialect:     "standard",
			Gender:      "female",
			Description: "百度 温柔知性女声",
			Keywords:    []string{"普通话", "标准", "度小美"},
		},
		{
			ID:          "0", // 百度
			Name:        "度小宇",
			Language:    "zh-CN",
			Dialect:     "standard",
			Gender:      "male",
			Description: "百度 温暖亲和男声",
			Keywords:    []string{"普通话", "标准", "男声", "度小宇"},
		},

		// 四川话发音人
		{
			ID:          "101040", // 腾讯云
			Name:        "智川",
			Language:    "zh-CN",
			Dialect:     "sichuan",
			Gender:      "female",
			Description: "腾讯云 四川话女声",
			Keywords:    []string{"四川话", "川话", "四川", "方言", "智川"},
		},
		{
			ID:          "BV221_streaming", // 火山引擎
			Name:        "四川甜妹儿",
			Language:    "zh-CN",
			Dialect:     "sichuan",
			Gender:      "female",
			Description: "火山引擎 四川甜妹儿",
			Keywords:    []string{"四川话", "川话", "四川", "方言", "甜妹儿"},
		},
		{
			ID:          "BV019_streaming", // 火山引擎
			Name:        "重庆小伙",
			Language:    "zh-CN",
			Dialect:     "sichuan",
			Gender:      "male",
			Description: "火山引擎 重庆小伙",
			Keywords:    []string{"四川话", "川话", "重庆话", "方言", "小伙"},
		},
		{
			ID:          "BV423_streaming", // 火山引擎
			Name:        "重庆幺妹儿",
			Language:    "zh-CN",
			Dialect:     "sichuan",
			Gender:      "female",
			Description: "火山引擎 重庆幺妹儿",
			Keywords:    []string{"四川话", "川话", "重庆话", "方言", "幺妹儿"},
		},
		{
			ID:          "BV704_streaming", // 火山引擎
			Name:        "方言灿灿（成都）",
			Language:    "zh-CN",
			Dialect:     "sichuan",
			Gender:      "female",
			Description: "火山引擎 成都方言",
			Keywords:    []string{"四川话", "川话", "成都话", "方言", "灿灿"},
		},

		// 粤语发音人（腾讯云）
		{
			ID:          "101019", // 腾讯云
			Name:        "智彤",
			Language:    "zh-HK",
			Dialect:     "cantonese",
			Gender:      "female",
			Description: "腾讯云 粤语女声",
			Keywords:    []string{"粤语", "广东话", "香港话", "cantonese", "智彤"},
		},

		// 东北话发音人（火山引擎）
		{
			ID:          "BV020_streaming", // 火山引擎
			Name:        "东北丫头",
			Language:    "zh-CN",
			Dialect:     "northeast",
			Gender:      "female",
			Description: "火山引擎 东北丫头",
			Keywords:    []string{"东北话", "东北", "方言", "丫头"},
		},
		{
			ID:          "BV021_streaming", // 火山引擎
			Name:        "东北老铁",
			Language:    "zh-CN",
			Dialect:     "northeast",
			Gender:      "male",
			Description: "火山引擎 东北老铁",
			Keywords:    []string{"东北话", "东北", "方言", "老铁"},
		},

		// 英语发音人
		{
			ID:          "101050", // 腾讯云
			Name:        "WeJack",
			Language:    "en-US",
			Dialect:     "american",
			Gender:      "male",
			Description: "腾讯云 英文男声",
			Keywords:    []string{"英语", "english", "美式", "wejack"},
		},
		{
			ID:          "501008", // 腾讯云
			Name:        "WeJames",
			Language:    "en-US",
			Dialect:     "american",
			Gender:      "male",
			Description: "腾讯云 外语男声",
			Keywords:    []string{"英语", "english", "美式", "wejames"},
		},
		{
			ID:          "501009", // 腾讯云
			Name:        "WeWinny",
			Language:    "en-US",
			Dialect:     "american",
			Gender:      "female",
			Description: "腾讯云 外语女声",
			Keywords:    []string{"英语", "english", "美式", "wewinny"},
		},

		// 童声发音人
		{
			ID:          "4", // 百度
			Name:        "度丫丫",
			Language:    "zh-CN",
			Dialect:     "standard",
			Gender:      "child",
			Description: "百度 活泼甜美童声",
			Keywords:    []string{"童声", "小孩", "度丫丫"},
		},
		{
			ID:          "101015", // 腾讯云
			Name:        "智萌",
			Language:    "zh-CN",
			Dialect:     "standard",
			Gender:      "child",
			Description: "腾讯云 男童声",
			Keywords:    []string{"童声", "小孩", "智萌"},
		},
	}

	for _, speaker := range defaultSpeakers {
		m.AddSpeaker(speaker)
	}

	// 设置默认发音人（Azure 晓晓）
	m.currentSpeaker = "zh-CN-XiaoxiaoNeural"
}

// AddSpeaker 添加发音人
func (m *Manager) AddSpeaker(speaker *SpeakerInfo) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.speakers[speaker.ID] = speaker

	// 更新语言映射
	m.languageMap[speaker.Language] = append(m.languageMap[speaker.Language], speaker)

	// 更新方言映射
	if speaker.Dialect != "" {
		m.dialectMap[speaker.Dialect] = append(m.dialectMap[speaker.Dialect], speaker)
	}

	// 更新关键词映射
	for _, keyword := range speaker.Keywords {
		keyword = strings.ToLower(keyword)
		m.keywordMap[keyword] = append(m.keywordMap[keyword], speaker)
	}
}

// FindSpeakerByKeywords 根据关键词查找发音人
func (m *Manager) FindSpeakerByKeywords(text string) *SpeakerInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	text = strings.ToLower(text)

	// 遍历所有关键词，找到匹配的发音人
	for keyword, speakers := range m.keywordMap {
		if strings.Contains(text, keyword) {
			if len(speakers) > 0 {
				m.logger.Debug("根据关键词找到发音人",
					zap.String("keyword", keyword),
					zap.String("speakerID", speakers[0].ID),
					zap.String("speakerName", speakers[0].Name),
				)
				return speakers[0]
			}
		}
	}

	return nil
}

// GetSpeaker 获取发音人信息
func (m *Manager) GetSpeaker(id string) *SpeakerInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.speakers[id]
}

// GetCurrentSpeaker 获取当前发音人
func (m *Manager) GetCurrentSpeaker() string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.currentSpeaker
}

// SetCurrentSpeaker 设置当前发音人
func (m *Manager) SetCurrentSpeaker(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.speakers[id]; !exists {
		return fmt.Errorf("发音人ID不存在: %s", id)
	}

	m.currentSpeaker = id
	return nil
}

// GetAllSpeakers 获取所有发音人
func (m *Manager) GetAllSpeakers() map[string]*SpeakerInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]*SpeakerInfo)
	for id, speaker := range m.speakers {
		result[id] = speaker
	}

	return result
}

// AnalyzeAndSwitchSpeaker 分析文本并智能切换发音人
func (m *Manager) AnalyzeAndSwitchSpeaker(text string) (bool, string, string) {
	// 查找匹配的发音人
	targetSpeaker := m.FindSpeakerByKeywords(text)
	if targetSpeaker == nil {
		return false, "", ""
	}

	// 检查是否需要切换
	currentID := m.GetCurrentSpeaker()
	if currentID == targetSpeaker.ID {
		return false, targetSpeaker.ID, "发音人未变化"
	}

	// 执行切换
	err := m.SetCurrentSpeaker(targetSpeaker.ID)
	if err != nil {
		return false, "", fmt.Sprintf("切换失败: %v", err)
	}

	return true, targetSpeaker.ID, fmt.Sprintf("已切换到%s(%s)", targetSpeaker.Name, targetSpeaker.Description)
}
