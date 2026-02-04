package sip

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/emiago/sipgo/sip"
	"github.com/sirupsen/logrus"
)

// handleAIAutoAnswerV2 处理 AI 自动接听（基于 RTP-WebSocket 桥接）
func (as *SipServer) handleAIAutoAnswerV2(req *sip.Request, tx sip.ServerTransaction, sipUser *models.SipUser) {
	logrus.WithFields(logrus.Fields{
		"sip_user":     sipUser.Username,
		"assistant_id": *sipUser.AssistantID,
	}).Info("Processing AI auto-answer (v2 with bridge)")

	// 1. 解析客户端 RTP 地址
	sdpBody := string(req.Body())
	clientRTPAddr, err := parseSDPForRTPAddress(sdpBody)
	if err != nil {
		logrus.WithError(err).Error("Failed to parse SDP")
		res := sip.NewResponseFromRequest(req, sip.StatusInternalServerError, "Internal Server Error", nil)
		tx.Respond(res)
		return
	}

	logrus.WithField("client_rtp_addr", clientRTPAddr).Info("Client RTP address parsed")

	// 2. 生成 SDP 响应
	serverIP := getServerIPFromRequest(req)
	sdp := generateSDP(serverIP, as.RPTPort)
	sdpBytes := []byte(sdp)

	// 3. 发送 180 Ringing（如果配置了延迟）
	if sipUser.AutoAnswerDelay > 0 {
		ringingRes := sip.NewResponseFromRequest(req, sip.StatusRinging, "Ringing", nil)
		if err := tx.Respond(ringingRes); err != nil {
			logrus.WithError(err).Error("Failed to send 180 Ringing")
		} else {
			logrus.WithField("delay", sipUser.AutoAnswerDelay).Info("Sent 180 Ringing, waiting...")
			time.Sleep(time.Duration(sipUser.AutoAnswerDelay) * time.Second)
		}
	}

	// 4. 发送 200 OK
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", sdpBytes)
	cl := sip.ContentLengthHeader(len(sdpBytes))
	res.AppendHeader(&cl)

	contentType := sip.ContentTypeHeader("application/sdp")
	res.AppendHeader(&contentType)

	contactURI := sip.Uri{Host: serverIP, Port: as.SipPort}
	contact := &sip.ContactHeader{Address: contactURI}
	res.AppendHeader(contact)

	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send 200 OK")
		return
	}

	logrus.Info("200 OK sent, AI auto-answer activated")

	// 5. 保存会话信息（等待 ACK）
	callID := req.CallID().Value()
	as.sessionsMutex.Lock()
	as.pendingSessions[callID] = clientRTPAddr
	as.sessionsMutex.Unlock()

	// 6. 创建 AI 通话会话记录
	aiSession := &models.AICallSession{
		CallID:      callID,
		SipUserID:   sipUser.ID,
		AssistantID: int64(*sipUser.AssistantID),
		Status:      "active",
		StartTime:   time.Now(),
	}
	if err := models.CreateAICallSession(as.db, aiSession); err != nil {
		logrus.WithError(err).Error("Failed to create AI call session")
	}

	// 7. 不需要在这里创建数据库记录，因为 handleInvite 已经创建了
	// 这里只需要等待 ACK 后更新状态即可
	logrus.WithField("call_id", callID).Info("AI auto-answer record will be created by handleInvite")

	logrus.WithField("call_id", callID).Info("Waiting for ACK to start AI session")
}

// handleAIAutoAnswerACK 处理 AI 自动接听的 ACK（启动桥接器）
func (as *SipServer) handleAIAutoAnswerACK(callID, clientRTPAddr string, sipUser *models.SipUser) error {
	logrus.WithField("call_id", callID).Info("Starting AI session after ACK")

	// 1. 获取 AI 助手配置
	var assistant models.Assistant
	if err := as.db.First(&assistant, sipUser.AssistantID).Error; err != nil {
		return fmt.Errorf("failed to load assistant: %w", err)
	}

	// 2. 获取用户凭证（使用助手的 API Key）
	var credential *models.UserCredential
	if assistant.ApiKey != "" && assistant.ApiSecret != "" {
		cred, err := models.GetUserCredentialByApiSecretAndApiKey(as.db, assistant.ApiKey, assistant.ApiSecret)
		if err != nil {
			return fmt.Errorf("failed to get credential: %w", err)
		}
		credential = cred
	} else {
		// 如果助手没有配置凭证，使用 SIP 用户关联的用户凭证
		if sipUser.UserID != nil {
			var creds []models.UserCredential
			if err := as.db.Where("user_id = ?", *sipUser.UserID).First(&creds).Error; err == nil && len(creds) > 0 {
				credential = &creds[0]
			}
		}
	}

	if credential == nil {
		return fmt.Errorf("no valid credential found")
	}

	// 3. 解析客户端 RTP 地址
	clientAddr, err := net.ResolveUDPAddr("udp", clientRTPAddr)
	if err != nil {
		return fmt.Errorf("failed to parse client RTP address: %w", err)
	}

	// 4. 创建 AI 语音对话处理器（使用 VoiceConversationHandler）
	// 注意：这里简化处理，实际应该从配置中获取服务实例
	// TODO: 从全局服务池或配置中获取 ASR、TTS、LLM 实例
	_ = credential // 避免未使用变量警告
	
	logrus.WithField("call_id", callID).Warn("AI auto-answer v2 需要完整的 ASR/TTS/LLM 服务配置")

	// 5. 保存会话到活跃会话
	ctx, cancel := context.WithCancel(context.Background())
	as.activeMutex.Lock()
	as.activeSessions[callID] = &SessionInfo{
		ClientRTPAddr: clientAddr,
		StopRecording: make(chan bool, 1),
		DTMFChannel:   make(chan string, 10),
		CancelCtx:     ctx,
		CancelFunc:    cancel,
		RecordingFile: fmt.Sprintf("uploads/audio/ai_call_%s.wav", callID),
	}
	as.activeMutex.Unlock()

	// 6. 更新数据库状态为已接通
	if as.db != nil {
		now := time.Now()
		as.updateCallStatusInDB(callID, "answered", &now)
	}

	logrus.WithField("call_id", callID).Info("AI session started successfully")

	return nil
}
