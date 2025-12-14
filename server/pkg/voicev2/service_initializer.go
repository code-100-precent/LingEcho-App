package voicev2

import (
	"context"
	"fmt"

	"github.com/code-100-precent/LingEcho/internal/models"
	v2 "github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
)

// ServiceInitializer service initializer
type ServiceInitializer struct {
}

// NewServiceInitializer creates a service initializer
func NewServiceInitializer() *ServiceInitializer {
	return &ServiceInitializer{}
}

// InitializeASR initializes ASR service
func (si *ServiceInitializer) InitializeASR(
	credential *models.UserCredential,
	language string,
	factory *transcribers.DefaultTranscriberFactory,
) (transcribers.TranscribeService, error) {
	asrProvider := credential.GetASRProvider()
	if asrProvider == "" {
		return nil, fmt.Errorf("ASR provider not configured")
	}

	normalizedProvider := transcribers.NormalizeProvider(asrProvider)

	// Build configuration
	asrConfig := make(map[string]interface{})
	asrConfig["provider"] = normalizedProvider
	asrConfig["language"] = language

	if credential.AsrConfig != nil {
		for key, value := range credential.AsrConfig {
			asrConfig[key] = value
		}
	}

	// Validate vendor support
	vendor := transcribers.GetVendor(normalizedProvider)
	if !factory.IsVendorSupported(vendor) {
		supported := factory.GetSupportedVendors()
		return nil, fmt.Errorf("unsupported ASR provider: %s, supported vendors: %v", asrProvider, supported)
	}

	// Parse configuration using transcribers package
	config, err := transcribers.NewTranscriberConfigFromMap(normalizedProvider, asrConfig, language)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ASR configuration: %w", err)
	}

	// Create service
	asrService, err := factory.CreateTranscriber(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create ASR service: %w", err)
	}

	return asrService, nil
}

// InitializeTTS initializes TTS service
func (si *ServiceInitializer) InitializeTTS(
	credential *models.UserCredential,
	speaker string,
) (synthesis.SynthesisService, error) {
	ttsProvider := credential.GetTTSProvider()
	if ttsProvider == "" {
		return nil, fmt.Errorf("TTS provider not configured")
	}

	normalizedProvider := transcribers.NormalizeProvider(ttsProvider)

	ttsConfig := make(synthesis.TTSCredentialConfig)
	ttsConfig["provider"] = normalizedProvider

	if credential.TtsConfig != nil {
		for key, value := range credential.TtsConfig {
			ttsConfig[key] = value
		}
	}

	if _, exists := ttsConfig["voiceType"]; !exists && speaker != "" {
		ttsConfig["voiceType"] = speaker
	}
	if _, exists := ttsConfig["voice_type"]; !exists && speaker != "" {
		ttsConfig["voice_type"] = speaker
	}

	// Set default speech rate (if not configured): speed up, default 1.2 (20% speed increase)
	if _, exists := ttsConfig["speedRatio"]; !exists {
		if _, exists = ttsConfig["speed_ratio"]; !exists {
			if _, exists = ttsConfig["speed"]; !exists {
				// Set default speech rate based on provider
				switch normalizedProvider {
				case "tencent", "qcloud":
					ttsConfig["speedRatio"] = 1.2
				case "minimax":
					ttsConfig["speedRatio"] = 1.2
				case "volcengine":
					ttsConfig["speedRatio"] = 1.2
				case "openai":
					ttsConfig["speed"] = 1.2
				default:
					ttsConfig["speedRatio"] = 1.2 // Default 20% speed increase
				}
			}
		}
	}

	ttsService, err := synthesis.NewSynthesisServiceFromCredential(ttsConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create TTS service: %w", err)
	}

	return ttsService, nil
}

// InitializeLLM initializes LLM processor
// 现在支持多种 LLM 提供者（OpenAI、Coze 等）
func InitializeLLM(ctx context.Context, credential *models.UserCredential, systemPrompt string) (v2.LLMProvider, error) {
	return v2.NewLLMProvider(ctx, credential, systemPrompt)
}
