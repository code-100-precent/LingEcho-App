package voice

import (
	"fmt"
	"strconv"
	"strings"

	"cloud.google.com/go/speech/apiv1/speechpb"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/utils"
)

// ConfigReader 配置读取器 - 简化配置读取逻辑
type ConfigReader struct {
	config map[string]interface{}
}

// NewConfigReader 创建配置读取器
func NewConfigReader(config map[string]interface{}) *ConfigReader {
	return &ConfigReader{config: config}
}

// String 获取字符串值，支持多个键名和默认值
// 用法: String("key1", "key2", "default_value")
func (r *ConfigReader) String(keysAndDefault ...string) string {
	if len(keysAndDefault) == 0 {
		return ""
	}

	// 最后一个可能是默认值
	defaultValue := ""
	keys := keysAndDefault
	if len(keysAndDefault) > 1 {
		// 如果最后一个不是key（可能是默认值），尝试获取
		lastKey := keysAndDefault[len(keysAndDefault)-1]
		if _, exists := r.config[lastKey]; !exists {
			// 最后一个不是配置中的key，作为默认值
			defaultValue = lastKey
			keys = keysAndDefault[:len(keysAndDefault)-1]
		}
	}

	for _, key := range keys {
		if val, ok := r.config[key].(string); ok && val != "" {
			return val
		}
	}
	return defaultValue
}

// Int 获取整数值，支持多个键名和默认值
// 用法: Int("key1", "key2", 100)
func (r *ConfigReader) Int(keys ...interface{}) int {
	var defaultValue int
	var keyStrings []string

	for _, k := range keys {
		switch v := k.(type) {
		case string:
			keyStrings = append(keyStrings, v)
		case int:
			defaultValue = v
		}
	}

	for _, key := range keyStrings {
		if val, ok := r.config[key]; ok {
			switch v := val.(type) {
			case int:
				return v
			case int64:
				return int(v)
			case float64:
				return int(v)
			case string:
				if intVal, err := strconv.Atoi(v); err == nil {
					return intVal
				}
			}
		}
	}
	return defaultValue
}

// ASRConfigParser ASR配置解析器接口
type ASRConfigParser interface {
	Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error)
}

// ASRConfigParserFactory ASR配置解析器工厂
type ASRConfigParserFactory struct {
	parsers map[string]ASRConfigParser
}

// NewASRConfigParserFactory 创建ASR配置解析器工厂
func NewASRConfigParserFactory() *ASRConfigParserFactory {
	factory := &ASRConfigParserFactory{
		parsers: make(map[string]ASRConfigParser),
	}

	// 注册各种解析器
	factory.Register(ProviderTencent, &TencentASRConfigParser{})
	factory.Register("qiniu", &QiniuASRConfigParser{})
	factory.Register("funasr", &FunASRConfigParser{})
	factory.Register("funasr_realtime", &FunASRRealtimeConfigParser{})
	factory.Register("google", &GoogleASRConfigParser{})
	factory.Register("volcengine", &VolcengineASRConfigParser{})
	factory.Register("volcllmasr", &VolcengineLLMASRConfigParser{})
	factory.Register("volcengine_llm", &VolcengineLLMASRConfigParser{})
	factory.Register("gladia", &GladiaASRConfigParser{})

	return factory
}

// Register 注册解析器
func (f *ASRConfigParserFactory) Register(provider string, parser ASRConfigParser) {
	f.parsers[provider] = parser
}

// Parse 解析配置
func (f *ASRConfigParserFactory) Parse(provider string, config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	parser, ok := f.parsers[provider]
	if !ok {
		return nil, fmt.Errorf("不支持的ASR provider: %s", provider)
	}
	return parser.Parse(config, language)
}

// TencentASRConfigParser 腾讯云ASR配置解析器
type TencentASRConfigParser struct{}

func (p *TencentASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)

	appID := cfg.String("app_id", "appId", utils.GetEnv("QCLOUD_APP_ID"))
	secretID := cfg.String("secret_id", "secretId", utils.GetEnv("QCLOUD_SECRET_ID"))
	secretKey := cfg.String("secret_key", "secretKey", utils.GetEnv("QCLOUD_SECRET"))

	if appID == "" || secretID == "" || secretKey == "" {
		return nil, fmt.Errorf("腾讯云ASR配置不完整：缺少appId、secretId或secretKey")
	}

	opt := recognizer.NewQcloudASROption(appID, secretID, secretKey)
	return &opt, nil
}

// QiniuASRConfigParser 七牛云ASR配置解析器
type QiniuASRConfigParser struct{}

func (p *QiniuASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)
	apiKey := cfg.String("apiKey", "api_key")
	if apiKey == "" {
		return nil, fmt.Errorf("七牛云ASR配置不完整：缺少apiKey")
	}
	opt := recognizer.NewQiniuASROption(apiKey)
	return &opt, nil
}

// FunASRConfigParser FunASR配置解析器
type FunASRConfigParser struct{}

func (p *FunASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)
	url := cfg.String("url", "wss://dashscope.aliyuncs.com/api-ws/v1/inference")
	opt := recognizer.NewFunASROption(url)
	return &opt, nil
}

// FunASRRealtimeConfigParser FunASR实时配置解析器
type FunASRRealtimeConfigParser struct{}

func (p *FunASRRealtimeConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)
	opt := recognizer.FunAsrRealtimeOption{
		Url:           cfg.String("url", "wss://dashscope.aliyuncs.com/api-ws/v1/inference"),
		ApiKey:        cfg.String("apiKey", "api_key"),
		Model:         cfg.String("model", "fun-asr-realtime"),
		SampleRate:    cfg.Int("sampleRate", "sample_rate", 16000),
		Format:        cfg.String("format", "pcm"),
		LanguageHints: cfg.String("languageHints", "language_hints", "zh"),
	}
	return &opt, nil
}

// GoogleASRConfigParser Google ASR配置解析器
type GoogleASRConfigParser struct{}

func (p *GoogleASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)

	encoding := cfg.String("encoding", "LINEAR16")
	sampleRate := cfg.Int("sampleRate", "sample_rate", 16000)
	languageCode := cfg.String("languageCode", "language_code", language)
	if languageCode == "" {
		languageCode = "zh-CN"
	}

	// 转换为Google编码类型
	var googleEncoding speechpb.RecognitionConfig_AudioEncoding
	switch strings.ToUpper(encoding) {
	case "LINEAR16", "PCM":
		googleEncoding = speechpb.RecognitionConfig_LINEAR16
	case "FLAC":
		googleEncoding = speechpb.RecognitionConfig_FLAC
	case "MULAW":
		googleEncoding = speechpb.RecognitionConfig_MULAW
	case "AMR":
		googleEncoding = speechpb.RecognitionConfig_AMR
	case "AMR_WB":
		googleEncoding = speechpb.RecognitionConfig_AMR_WB
	case "OGG_OPUS":
		googleEncoding = speechpb.RecognitionConfig_OGG_OPUS
	case "SPEEX_WITH_HEADER_BYTE":
		googleEncoding = speechpb.RecognitionConfig_SPEEX_WITH_HEADER_BYTE
	default:
		googleEncoding = speechpb.RecognitionConfig_LINEAR16
	}

	opt := recognizer.NewGoogleASROption(googleEncoding, int32(sampleRate), languageCode)
	return &opt, nil
}

// VolcengineASRConfigParser 火山引擎标准ASR配置解析器
type VolcengineASRConfigParser struct{}

func (p *VolcengineASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)

	url := cfg.String("url", "wss://openspeech.bytedance.com/api/v2/asr")
	appID := cfg.String("appId", "app_id")
	token := cfg.String("token")
	cluster := cfg.String("cluster", "volcano_tts")
	format := cfg.String("format", "raw")

	if appID == "" || token == "" {
		return nil, fmt.Errorf("火山引擎ASR配置不完整：缺少appId或token")
	}

	opt := recognizer.NewVolcengineOption(appID, token, cluster, format)
	opt.Url = url
	return &opt, nil
}

// VolcengineLLMASRConfigParser 火山引擎LLM ASR配置解析器
type VolcengineLLMASRConfigParser struct{}

func (p *VolcengineLLMASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)
	token := cfg.String("token")
	appID := cfg.String("appId", "app_id")
	if token == "" || appID == "" {
		return nil, fmt.Errorf("火山引擎LLM ASR配置不完整：缺少token或appId")
	}
	opt := recognizer.NewVolcengineLLMOption(token, appID)
	return &opt, nil
}

// GladiaASRConfigParser Gladia ASR配置解析器
type GladiaASRConfigParser struct{}

func (p *GladiaASRConfigParser) Parse(config map[string]interface{}, language string) (recognizer.TranscriberConfig, error) {
	cfg := NewConfigReader(config)
	apiKey := cfg.String("apiKey", "api_key")
	encoding := cfg.String("encoding", "WAV/PCM")
	if apiKey == "" {
		return nil, fmt.Errorf("Gladia ASR配置不完整：缺少apiKey")
	}
	opt := recognizer.NewGladiaASROption(apiKey, encoding)
	return &opt, nil
}

// normalizeProvider 标准化provider名称
func normalizeProvider(provider string) string {
	normalized := strings.ToLower(provider)
	if normalized == ProviderQCloud {
		return ProviderTencent
	}
	// voiceengine映射到volcengine
	if normalized == "voiceengine" {
		return "volcengine"
	}
	return normalized
}

// getVendor 获取vendor枚举值
func getVendor(provider string) recognizer.Vendor {
	if provider == ProviderTencent {
		return recognizer.VendorQCloud
	}
	return recognizer.Vendor(provider)
}
