package sip

import (
	"context"
	"fmt"
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
	if err := as.createAICallSession(callID, sipUser.ID, *sipUser.AssistantID); err != nil {
		logrus.WithError(err).Error("Failed to create AI call session")
	}

	// 7. 更新数据库中的通话状态
	if as.db != nil {
		now := time.Now()
		from := req.From()
		to := req.To()

		var fromUsername, fromURI, fromIP string
		var toUsername, toURI string

		if from != nil {
			fromUsername = from.Address.User
			fromURI = from.Address.String()
			if via := req.Via(); via != nil {
				fromIP = via.Host
			}
		}

		if to != nil {
			toUsername = to.Address.User
			toURI = to.Address.String()
		}

		localRTPAddr := fmt.Sprintf("%s:%d", serverIP, as.RPTPort)

		sipCall := &models.SipCall{
			CallID:        callID,
			Direction:     models.SipCallDirectionInbound,
			Status:        models.SipCallStatusRinging,
			FromUsername:  fromUsername,
			FromURI:       fromURI,
			FromIP:        fromIP,
			ToUsername:    toUsername,
			ToURI:         toURI,
			LocalRTPAddr:  localRTPAddr,
			RemoteRTPAddr: clientRTPAddr,
			StartTime:     now,
		}

		if err := as.db.Create(sipCall).Error; err != nil {
			logrus.WithError(err).WithField("call_id", callID).Error("Failed to create inbound call record")
		}
	}

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
	clientAddr, err := parseUDPAddr(clientRTPAddr)
	if err != nil {
		return fmt.Errorf("failed to parse client RTP address: %w", err)
	}

	// 4. 创建 RTP-WebSocket 桥接器
	bridge := NewRTPWebSocketBridge(
		callID,
		as.rtpConn,
		clientAddr,
		&assistant,
		credential,
		as.db,
	)

	// 5. 启动桥接器
	if err := bridge.Start(); err != nil {
		return fmt.Errorf("failed to start bridge: %w", err)
	}

	// 6. 保存桥接器到活跃会话
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

	// 7. 更新数据库状态为已接通
	if as.db != nil {
		now := time.Now()
		as.updateCallStatusInDB(callID, "answered", &now)
	}

	logrus.WithField("call_id", callID).Info("AI session started successfully")

	return nil
}

// 辅助函数：解析 UDP 地址
func parseUDPAddr(addr string) (*net.UDPAddr, error) {
	return net.ResolveUDPAddr("udp", addr)
}
