package sip

import (
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/emiago/sipgo/sip"
	"github.com/sirupsen/logrus"
)

// monitorCallSelection 监听用户的方案选择
// 轮询数据库检查用户是否已选择方案，或是否已超时
func (as *SipServer) monitorCallSelection(
	req *sip.Request,
	tx sip.ServerTransaction,
	callID string,
	selectionID uint,
	clientRTPAddr string,
	serverIP string,
) {
	logrus.WithFields(logrus.Fields{
		"call_id":      callID,
		"selection_id": selectionID,
	}).Info("🔍 开始监听用户方案选择")

	ticker := time.NewTicker(500 * time.Millisecond) // 每500毫秒检查一次
	defer ticker.Stop()

	timeout := time.After(9 * time.Second) // 9秒超时（给1秒缓冲）

	for {
		select {
		case <-timeout:
			// 超时处理
			logrus.WithField("call_id", callID).Warn("⏰ 用户选择超时，使用默认方案或拒接")
			as.handleSelectionTimeout(req, tx, callID, selectionID)
			return

		case <-ticker.C:
			// 查询数据库检查选择状态
			selection, err := models.GetPendingCallSelectionByID(as.db, selectionID)
			if err != nil {
				logrus.WithError(err).Error("Failed to query pending selection")
				continue
			}

			// 检查状态
			switch selection.Status {
			case "selected":
				// 用户已选择方案
				logrus.WithFields(logrus.Fields{
					"call_id":           callID,
					"selected_scheme_id": *selection.SelectedSchemeID,
				}).Info("✅ 用户已选择方案，继续接听流程")
				
				as.handleSelectionComplete(req, tx, callID, *selection.SelectedSchemeID, clientRTPAddr, serverIP)
				return

			case "cancelled":
				// 用户取消来电
				logrus.WithField("call_id", callID).Info("❌ 用户已取消来电")
				as.handleSelectionCancelled(req, tx, callID)
				return

			case "timeout":
				// 已超时
				logrus.WithField("call_id", callID).Warn("⏰ 选择已超时")
				as.handleSelectionTimeout(req, tx, callID, selectionID)
				return

			case "pending":
				// 继续等待
				continue

			default:
				logrus.WithFields(logrus.Fields{
					"call_id": callID,
					"status":  selection.Status,
				}).Warn("未知的选择状态")
				continue
			}
		}
	}
}

// handleSelectionComplete 处理用户选择完成
func (as *SipServer) handleSelectionComplete(
	req *sip.Request,
	tx sip.ServerTransaction,
	callID string,
	selectedSchemeID uint,
	clientRTPAddr string,
	serverIP string,
) {
	logrus.WithFields(logrus.Fields{
		"call_id":   callID,
		"scheme_id": selectedSchemeID,
	}).Info("🎯 处理用户选择的方案")

	// 查询选中的方案
	var sipUser models.SipUser
	if err := as.db.First(&sipUser, selectedSchemeID).Error; err != nil {
		logrus.WithError(err).Error("Failed to load selected scheme")
		as.handleSelectionCancelled(req, tx, callID)
		return
	}

	// 检查方案是否启用
	if !sipUser.Enabled {
		logrus.WithField("scheme_id", selectedSchemeID).Warn("Selected scheme is disabled")
		as.handleSelectionCancelled(req, tx, callID)
		return
	}

	// 激活选中的方案（如果需要）
	if !sipUser.IsActive {
		// 先停用同一用户的其他激活方案
		if sipUser.UserID != nil {
			as.db.Model(&models.SipUser{}).
				Where("user_id = ? AND is_active = ?", *sipUser.UserID, true).
				Update("is_active", false)
		}
		
		// 激活选中的方案
		sipUser.IsActive = true
		if err := as.db.Save(&sipUser).Error; err != nil {
			logrus.WithError(err).Error("Failed to activate selected scheme")
		} else {
			logrus.WithField("scheme_id", selectedSchemeID).Info("✅ 方案已激活")
		}
	}

	// 查询助手信息
	var assistant *models.Assistant
	if sipUser.AssistantID != nil && *sipUser.AssistantID > 0 {
		var asst models.Assistant
		if err := as.db.First(&asst, *sipUser.AssistantID).Error; err == nil {
			assistant = &asst
		}
	}

	// 检查是否需要启动 AI 代接
	shouldStartAI := sipUser.AutoAnswer && assistant != nil

	// 准备 RTP 地址
	rtpAddrToSave := clientRTPAddr
	if shouldStartAI {
		rtpAddrToSave = clientRTPAddr + "|AI"
		
		// 保存 AI 会话信息
		as.aiSessionMutex.Lock()
		as.aiSessionInfo[callID] = &AISessionInfo{
			SipUser:   &sipUser,
			Assistant: assistant,
		}
		as.aiSessionMutex.Unlock()
		
		logrus.WithFields(logrus.Fields{
			"call_id":   callID,
			"sip_user":  sipUser.Username,
			"assistant": assistant.Name,
		}).Info("🤖 AI 代接会话")
	}

	// 保存会话信息
	as.sessionsMutex.Lock()
	as.pendingSessions[callID] = rtpAddrToSave
	as.sessionsMutex.Unlock()

	// 生成 SDP
	sdp := generateSDP(serverIP, as.RPTPort)
	sdpBytes := []byte(sdp)

	// 发送 200 OK
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", sdpBytes)
	cl := sip.ContentLengthHeader(len(sdpBytes))
	res.AppendHeader(&cl)

	contentType := sip.ContentTypeHeader("application/sdp")
	res.AppendHeader(&contentType)

	contactURI := sip.Uri{
		Host: serverIP,
		Port: as.SipPort,
	}
	contact := &sip.ContactHeader{
		Address: contactURI,
	}
	res.AppendHeader(contact)

	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send 200 OK")
		return
	}

	logrus.WithField("call_id", callID).Info("✅ 200 OK sent after user selection")

	// 创建呼入通话记录
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

		localRTPAddr := serverIP + ":" + string(rune(as.RPTPort))

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
}

// handleSelectionTimeout 处理选择超时
func (as *SipServer) handleSelectionTimeout(
	req *sip.Request,
	tx sip.ServerTransaction,
	callID string,
	selectionID uint,
) {
	logrus.WithField("call_id", callID).Info("⏰ 处理选择超时")

	// 更新数据库状态为 timeout
	if err := models.UpdatePendingCallSelectionStatus(as.db, selectionID, "timeout"); err != nil {
		logrus.WithError(err).Error("Failed to update selection status to timeout")
	}

	// 发送 486 Busy Here 或 480 Temporarily Unavailable
	res := sip.NewResponseFromRequest(req, sip.StatusTemporarilyUnavailable, "Temporarily Unavailable", nil)
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send timeout response")
	}

	logrus.WithField("call_id", callID).Info("📞 已发送 480 响应（选择超时）")
}

// handleSelectionCancelled 处理用户取消来电
func (as *SipServer) handleSelectionCancelled(
	req *sip.Request,
	tx sip.ServerTransaction,
	callID string,
) {
	logrus.WithField("call_id", callID).Info("❌ 处理用户取消来电")

	// 发送 603 Decline
	res := sip.NewResponseFromRequest(req, 603, "Decline", nil)
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send decline response")
	}

	logrus.WithField("call_id", callID).Info("📞 已发送 603 Decline 响应")
}
