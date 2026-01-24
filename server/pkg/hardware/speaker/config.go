package speaker

// SpeakerConfig 发音人配置
type SpeakerConfig struct {
	Platforms map[string]PlatformConfig `json:"platforms"`
	Mappings  map[string]SpeakerMapping `json:"mappings"`
}

// PlatformConfig 平台配置
type PlatformConfig struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

// SpeakerMapping 发音人映射配置
type SpeakerMapping struct {
	Primary      string   `json:"primary"`      // 主要推荐的发音人ID
	Alternatives []string `json:"alternatives"` // 备选发音人ID列表
	Description  string   `json:"description"`
}

// GetDefaultSpeakerConfig 获取默认发音人配置
func GetDefaultSpeakerConfig() *SpeakerConfig {
	return &SpeakerConfig{
		Platforms: map[string]PlatformConfig{
			"azure": {
				Name:        "Azure Cognitive Services",
				Description: "微软Azure语音服务",
				Enabled:     true,
			},
			"tencent": {
				Name:        "Tencent Cloud TTS",
				Description: "腾讯云语音合成",
				Enabled:     true,
			},
			"baidu": {
				Name:        "Baidu AI Speech",
				Description: "百度AI语音技术",
				Enabled:     true,
			},
			"volcengine": {
				Name:        "ByteDance VolcEngine",
				Description: "火山引擎语音服务",
				Enabled:     true,
			},
			"xunfei": {
				Name:        "iFlytek Speech",
				Description: "科大讯飞语音",
				Enabled:     true,
			},
			"qiniu": {
				Name:        "Qiniu Speech",
				Description: "七牛云语音服务",
				Enabled:     true,
			},
		},
		Mappings: map[string]SpeakerMapping{
			"standard": {
				Primary:      "zh-CN-XiaoxiaoNeural",                             // Azure 晓晓
				Alternatives: []string{"1", "xiaoyan", "qiniu_zh_female_tmjxxy"}, // 百度度小美、讯飞小燕、七牛甜美女声
				Description:  "标准普通话女声",
			},
			"standard_male": {
				Primary:      "zh-CN-YunxiNeural",                               // Azure 云希
				Alternatives: []string{"0", "aisjiuxu", "qiniu_zh_male_tmjxxy"}, // 百度度小宇、讯飞许久、七牛浑厚男声
				Description:  "标准普通话男声",
			},
			"sichuan": {
				Primary:      "101040",                                                          // 腾讯云 智川（四川话）
				Alternatives: []string{"BV221_streaming", "BV423_streaming", "BV704_streaming"}, // 火山引擎备选：四川甜妹儿、重庆幺妹儿、方言灿灿
				Description:  "四川话女声",
			},
			"sichuan_male": {
				Primary:      "BV019_streaming", // 火山引擎 重庆小伙
				Alternatives: []string{},
				Description:  "四川话/重庆话男声",
			},
			"cantonese": {
				Primary:      "101019", // 腾讯云 智彤
				Alternatives: []string{},
				Description:  "粤语女声",
			},
			"northeast": {
				Primary:      "BV020_streaming", // 火山引擎 东北丫头
				Alternatives: []string{},
				Description:  "东北话女声",
			},
			"northeast_male": {
				Primary:      "BV021_streaming", // 火山引擎 东北老铁
				Alternatives: []string{},
				Description:  "东北话男声",
			},
			"english": {
				Primary:      "101050",                     // 腾讯云 WeJack
				Alternatives: []string{"501008", "501009"}, // WeJames、WeWinny
				Description:  "英语发音人",
			},
			"child": {
				Primary:      "4",                          // 百度 度丫丫
				Alternatives: []string{"101015", "101016"}, // 腾讯云 智萌、智甜
				Description:  "童声发音人",
			},
		},
	}
}

// GetSpeakerID 根据类型获取发音人ID（支持降级策略）
func (c *SpeakerConfig) GetSpeakerID(speakerType string) (string, bool) {
	mapping, exists := c.Mappings[speakerType]
	if !exists {
		return "", false
	}

	// 优先返回主要推荐的发音人
	if mapping.Primary != "" {
		return mapping.Primary, true
	}

	// 如果主要发音人不可用，尝试备选方案
	if len(mapping.Alternatives) > 0 {
		return mapping.Alternatives[0], true
	}

	return "", false
}

// GetAllSpeakerTypes 获取所有支持的发音人类型
func (c *SpeakerConfig) GetAllSpeakerTypes() []string {
	types := make([]string, 0, len(c.Mappings))
	for speakerType := range c.Mappings {
		types = append(types, speakerType)
	}
	return types
}
