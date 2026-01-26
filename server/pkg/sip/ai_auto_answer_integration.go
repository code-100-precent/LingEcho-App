package sip

import (
	"context"
	"fmt"
	"net"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/voice/factory"
	"github.com/emiago/sipgo/sip"
	"github.com/pion/rtp"
	"github.com/sirupsen/logrus"
	"go.uber.org/zap"
)

// checkAIAutoAnswer 检查是否需要启动 AI 代接
// 返回值：(是否启动AI代接, SipUser, Assistant, error)
func (as *SipServer) checkAIAutoAnswer(req *sip.Request) (bool, *models.SipUser, *models.Assistant, error) {
	if as.db == nil {
		return false, nil, nil, nil
	}
	
	// 获取被叫号码（To 头中的用户名）
	to := req.To()
	if to == nil {
		return false, nil, nil, nil
	}
	
	toUsername := to.Address.User
	if toUsername == "" {
		return false, nil, nil, nil
	}
	
	// 查询 SipUser
	var sipUser models.SipUser
	err := as.db.Where("username = ? AND enabled = ?", toUsername, true).First(&sipUser).Error
	if err != nil {
		// 用户不存在或未启用，不启动 AI 代接
		return false, nil, nil, nil
	}
	
	// 检查是否绑定了 AI 助手
	if sipUser.AssistantID == nil || *sipUser.AssistantID == 0 {
		return false, &sipUser, nil, nil
	}
	
	// 检查是否启用了自动接听
	if !sipUser.AutoAnswer {
		return false, &sipUser, nil, nil
	}
	
	// 查询 Assistant
	var assistant models.Assistant
	err = as.db.First(&assistant, *sipUser.AssistantID).Error
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"sip_user":     toUsername,
			"assistant_id": *sipUser.AssistantID,
			"error":        err,
		}).Warn("Failed to load assistant for AI auto-answer")
		return false, &sipUser, nil, err
	}
	
	logrus.WithFields(logrus.Fields{
		"sip_user":     toUsername,
		"assistant_id": assistant.ID,
		"assistant":    assistant.Name,
	}).Info("✅ AI 代接条件满足")
	
	return true, &sipUser, &assistant, nil
}

// startAIVoiceSession 启动 AI 语音会话
func (as *SipServer) startAIVoiceSession(
	callID string,
	clientRTPAddr *net.UDPAddr,
	sipUser *models.SipUser,
	assistant *models.Assistant,
) error {
	logrus.WithFields(logrus.Fields{
		"call_id":      callID,
		"sip_user":     sipUser.Username,
		"assistant":    assistant.Name,
		"client_addr":  clientRTPAddr.String(),
	}).Info("🤖 启动 AI 语音会话")
	
	// 获取用户凭证（如果有关联的系统用户）
	var credential *models.UserCredential
	if sipUser.UserID != nil {
		var user models.User
		if err := as.db.First(&user, *sipUser.UserID).Error; err == nil {
			// 查询用户凭证
			var cred models.UserCredential
			if err := as.db.Where("user_id = ?", user.ID).First(&cred).Error; err == nil {
				credential = &cred
			}
		}
	}
	
	// 如果没有凭证，使用默认凭证或创建临时凭证
	if credential == nil {
		// 查询默认凭证或第一个可用凭证
		var cred models.UserCredential
		if err := as.db.First(&cred).Error; err == nil {
			credential = &cred
		} else {
			return fmt.Errorf("no credential available for AI session")
		}
	}
	
	// 创建服务工厂
	transcriberFactory := recognizer.GetGlobalFactory()
	
	// 创建 zap logger（使用 nop logger 或从配置获取）
	zapLogger, _ := zap.NewProduction()
	if zapLogger == nil {
		zapLogger = zap.NewNop()
	}
	
	serviceFactory := factory.NewServiceFactory(transcriberFactory, zapLogger)
	
	// 创建 ASR 服务
	asrTranscriber, err := serviceFactory.CreateASR(credential, assistant.Language)
	if err != nil {
		return fmt.Errorf("failed to create ASR service: %w", err)
	}
	
	// 创建 TTS 服务
	ttsService, err := serviceFactory.CreateTTS(credential, assistant.Speaker)
	if err != nil {
		return fmt.Errorf("failed to create TTS service: %w", err)
	}
	
	// 创建 LLM Provider
	// 注意：需要将助手的模型配置传递给 LLM Provider
	llmProvider, err := serviceFactory.CreateLLM(
		context.Background(),
		credential,
		assistant.SystemPrompt,
	)
	if err != nil {
		return fmt.Errorf("failed to create LLM provider: %w", err)
	}
	
	// 如果助手配置了特定的模型，需要设置到 LLM Provider
	// 这里需要检查 LLM Provider 的类型并设置模型
	if assistant.LLMModel != "" {
		// 尝试设置模型（如果 LLM Provider 支持）
		if openaiProvider, ok := llmProvider.(*llm.OpenAIProvider); ok {
			openaiProvider.SetModel(assistant.LLMModel)
			logrus.WithFields(logrus.Fields{
				"call_id": callID,
				"model":   assistant.LLMModel,
			}).Info("🤖 设置 LLM 模型")
		}
	}
	
	// 创建 VoiceConversationHandler
	handler := NewVoiceConversationHandler(
		callID,
		clientRTPAddr,
		as.rtpConn,
		credential,
		asrTranscriber,
		ttsService,
		llmProvider,
		sipUser, // 传递 SipUser 配置
	)
	
	// 保存 handler
	as.voiceHandlersMu.Lock()
	as.voiceHandlers[callID] = handler
	as.voiceHandlersMu.Unlock()
	
	// 启动 handler
	handler.Start()
	
	// 启动 RTP 接收协程
	go as.receiveRTPForAI(callID, clientRTPAddr, handler)
	
	logrus.WithField("call_id", callID).Info("✅ AI 语音会话已启动")
	
	return nil
}

// receiveRTPForAI 接收 RTP 包并转发给 AI handler
func (as *SipServer) receiveRTPForAI(callID string, clientAddr *net.UDPAddr, handler *VoiceConversationHandler) {
	buffer := make([]byte, 1500)
	
	logrus.WithFields(logrus.Fields{
		"call_id":     callID,
		"client_addr": clientAddr.String(),
	}).Info("📡 开始接收 RTP 包")
	
	for {
		// 检查 handler 是否还在运行
		select {
		case <-handler.ctx.Done():
			logrus.WithField("call_id", callID).Info("AI handler 已停止，退出 RTP 接收")
			return
		default:
		}
		
		// 设置读取超时
		// as.rtpConn.SetReadDeadline(time.Now().Add(1 * time.Second))
		
		n, receivedAddr, err := as.rtpConn.ReadFromUDP(buffer)
		if err != nil {
			// 超时是正常的，继续循环
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			logrus.WithFields(logrus.Fields{
				"call_id": callID,
				"error":   err,
			}).Error("Failed to read RTP data")
			continue
		}
		
		// 检查是否来自目标客户端
		if !receivedAddr.IP.Equal(clientAddr.IP) {
			continue
		}
		
		// 解析 RTP 包
		packet := &rtp.Packet{}
		if err := packet.Unmarshal(buffer[:n]); err != nil {
			continue
		}
		
		// 只处理 PCMU (payload type 0)
		if packet.PayloadType != 0 {
			continue
		}
		
		// 转发给 handler
		handler.ProcessAudioPacket(packet.Payload)
	}
}

// stopAIVoiceSession 停止 AI 语音会话
func (as *SipServer) stopAIVoiceSession(callID string) {
	as.voiceHandlersMu.Lock()
	handler, exists := as.voiceHandlers[callID]
	if exists {
		delete(as.voiceHandlers, callID)
	}
	as.voiceHandlersMu.Unlock()
	
	if exists {
		handler.Stop()
		logrus.WithField("call_id", callID).Info("✅ AI 语音会话已停止")
	}
}
