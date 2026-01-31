package sip

import (
	"context"
	"encoding/binary"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/emiago/sipgo"
	"github.com/emiago/sipgo/sip"
	"github.com/pion/rtp"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	wavFile     = "ringing.wav"
	ringingFile = "ringing.wav"
)

type SipServer struct {
	SipPort          int
	RPTPort          int
	client           *sipgo.Client
	ua               *sipgo.UserAgent
	server           *sipgo.Server
	rtpConn          *net.UDPConn
	pendingSessions  map[string]string       // Call-ID -> client RTP address
	sessionsMutex    sync.RWMutex            // Protects concurrent access to pendingSessions
	activeSessions   map[string]*SessionInfo // Call-ID -> session info
	activeMutex      sync.RWMutex
	outgoingSessions map[string]*OutgoingSession // Call-ID -> outgoing session info
	outgoingMutex    sync.RWMutex
	registeredUsers  map[string]string // username -> Contact address (从 REGISTER 请求中获取)
	registerMutex    sync.RWMutex
	voiceHandlers    map[string]*VoiceConversationHandler // Call-ID -> AI voice handler
	voiceHandlersMu  sync.RWMutex
	aiSessionInfo    map[string]*AISessionInfo // Call-ID -> AI session info
	aiSessionMutex   sync.RWMutex
	db               *gorm.DB
}

// AISessionInfo 存储 AI 会话信息
type AISessionInfo struct {
	SipUser   *models.SipUser
	Assistant *models.Assistant
}

type OutgoingSession struct {
	RemoteRTPAddr string
	CallID        string
	TargetURI     string
	Status        string // calling, ringing, answered, failed, cancelled, ended
	StartTime     time.Time
	AnswerTime    *time.Time
	EndTime       *time.Time
	CancelFunc    context.CancelFunc
	Error         string
	InviteReq     *sip.Request          // 保存INVITE请求，用于发送BYE
	LastResponse  *sip.Response         // 保存最后的响应，用于发送BYE
	Transaction   sip.ClientTransaction // 保存事务，用于发送CANCEL
	RecordingFile string                // 录音文件路径
}

type SessionInfo struct {
	ClientRTPAddr *net.UDPAddr
	StopRecording chan bool
	DTMFChannel   chan string // DTMF 按键通道
	CancelCtx     context.Context
	CancelFunc    context.CancelFunc
	RecordingFile string // 录音文件路径
}

func (as *SipServer) SetDBConfig(db *gorm.DB) {
	as.db = db
}

func NewSipServer(rptPort int) *SipServer {
	// Create SIP server
	ua, err := sipgo.NewUA()
	if err != nil {
		logrus.WithError(err).Fatal("Failed to create UA")
	}

	server, err := sipgo.NewServer(ua)
	if err != nil {
		logrus.WithError(err).Fatal("Failed to create SIP server")
	}

	// Create RTP UDP connection
	rtpAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("0.0.0.0:%d", rptPort))
	if err != nil {
		logrus.WithError(err).Fatal("Failed to resolve RTP address")
	}

	rtpConn, err := net.ListenUDP("udp", rtpAddr)
	if err != nil {
		logrus.WithError(err).Fatal("Failed to create RTP UDP connection")
	}

	client, err := sipgo.NewClient(ua)
	if err != nil {
		logrus.WithError(err).Fatal("Create SIP Client Failed")
	}

	return &SipServer{
		RPTPort:          rptPort,
		server:           server,
		rtpConn:          rtpConn,
		client:           client,
		ua:               ua,
		pendingSessions:  make(map[string]string),
		activeSessions:   make(map[string]*SessionInfo),
		outgoingSessions: make(map[string]*OutgoingSession),
		registeredUsers:  make(map[string]string),
		voiceHandlers:    make(map[string]*VoiceConversationHandler),
		aiSessionInfo:    make(map[string]*AISessionInfo),
	}
}

func (as *SipServer) Close() {
	as.server.Close()
	as.rtpConn.Close()
}

func (as *SipServer) Start(sipPort int, targetURI string) {
	ctx := context.Background()
	as.SipPort = sipPort
	as.RegisterFunc()

	// Only make outgoing call if targetURI is provided
	if targetURI != "" {
		go func() {
			time.Sleep(10 * time.Second)
			as.makeOutgoingCall(targetURI, as.SipPort, as.RPTPort)
		}()
	}

	if err := as.server.ListenAndServe(ctx, "udp", fmt.Sprintf("0.0.0.0:%d", sipPort)); err != nil {
		logrus.WithError(err).Fatal("Failed to start server")
	}
}

// makeOutgoingCall 发起呼出呼叫
func (as *SipServer) makeOutgoingCall(targetURI string, sipPort int, rtpPort int) {
	log.Printf("=== 开始发起呼叫到: %s ===", targetURI)

	// 解析目标 URI
	uri := &sip.Uri{}
	if err := sip.ParseUri(targetURI, uri); err != nil {
		log.Printf("解析目标 URI 失败: %v", err)
		return
	}

	// 获取本地 IP
	localIP := getLocalIP()
	if localIP == "" {
		localIP = "127.0.0.1"
	}

	// 检查是否在呼叫自己
	targetHost := uri.Host
	targetPort := uri.Port
	if targetPort == 0 {
		targetPort = 5060 // 默认 SIP 端口
	}

	if targetHost == localIP && targetPort == sipPort {
		log.Printf("错误: 不能呼叫自己！目标地址 %s:%d 就是服务器地址", targetHost, targetPort)
		log.Printf("提示: 请呼叫另一个 SIP 客户端（如另一个 Linphone 实例）")
		log.Printf("示例: sip:user@192.168.1.100:5060 （使用其他设备的 IP 地址）")
		return
	}

	log.Printf("目标地址: %s:%d (服务器地址: %s:%d)", targetHost, targetPort, localIP, sipPort)

	// 检查用户是否已注册，如果已注册则使用注册的地址
	targetUsername := uri.User
	if targetUsername != "" {
		as.registerMutex.RLock()
		if registeredAddr, exists := as.registeredUsers[targetUsername]; exists {
			log.Printf("用户 %s 已注册，使用注册地址: %s", targetUsername, registeredAddr)
			// 解析注册地址
			if addr, err := net.ResolveUDPAddr("udp", registeredAddr); err == nil {
				uri.Host = addr.IP.String()
				if addr.Port > 0 {
					uri.Port = addr.Port
				} else {
					uri.Port = 5060
				}
				targetHost = uri.Host
				targetPort = uri.Port
				log.Printf("更新目标地址为: %s:%d", targetHost, targetPort)
			}
		} else {
			log.Printf("用户 %s 未注册，使用原始地址: %s:%d", targetUsername, targetHost, targetPort)
		}
		as.registerMutex.RUnlock()
	}

	// 生成 SDP offer
	sdpOffer := generateSDP(localIP, rtpPort)
	sdpBytes := []byte(sdpOffer)

	log.Printf("生成的 SDP Offer:\n%s", sdpOffer)

	// 创建 INVITE 请求
	inviteReq := sip.NewRequest(sip.INVITE, uri)

	// 设置 From 头
	fromURI := &sip.Uri{
		User: "server",
		Host: localIP,
		Port: sipPort,
	}
	from := &sip.FromHeader{
		DisplayName: "SIP Server",
		Address:     *fromURI,
		Params:      sip.NewParams(),
	}
	from.Params.Add("tag", generateTag())
	inviteReq.AppendHeader(from)

	// 设置 To 头
	to := &sip.ToHeader{
		Address: *uri,
		Params:  sip.NewParams(),
	}
	inviteReq.AppendHeader(to)

	// 设置 Call-ID
	callID := sip.CallIDHeader(generateCallID())
	inviteReq.AppendHeader(&callID)

	// 设置 CSeq
	cseq := &sip.CSeqHeader{
		SeqNo:      1,
		MethodName: sip.INVITE,
	}
	inviteReq.AppendHeader(cseq)

	// 设置 Contact 头
	contactURI := sip.Uri{
		Host: localIP,
		Port: sipPort,
	}
	contact := &sip.ContactHeader{
		Address: contactURI,
	}
	inviteReq.AppendHeader(contact)

	// 设置 Content-Type
	contentType := sip.ContentTypeHeader("application/sdp")
	inviteReq.AppendHeader(&contentType)

	// 设置 Content-Length
	cl := sip.ContentLengthHeader(len(sdpBytes))
	inviteReq.AppendHeader(&cl)

	// 设置请求体
	inviteReq.SetBody(sdpBytes)

	// 发送 INVITE 请求并等待响应
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	log.Printf("正在发送 INVITE 请求到 %s:%d...", uri.Host, targetPort)
	tx, err := as.client.TransactionRequest(ctx, inviteReq)
	if err != nil {
		log.Printf("发送 INVITE 请求失败: %v", err)
		return
	}
	log.Printf("INVITE 请求已发送，等待响应...")

	// 等待响应
	var remoteRTPAddr string
	var callIDStr string

	// 添加超时检查
	timeout := time.NewTimer(30 * time.Second)
	defer timeout.Stop()

	for {
		select {
		case res, ok := <-tx.Responses():
			if !ok {
				log.Printf("响应通道已关闭")
				return
			}
			log.Printf("收到响应: %d %s", res.StatusCode, res.Reason)

			// 处理不同的响应
			if res.StatusCode == sip.StatusTrying {
				log.Println("收到 100 Trying，继续等待...")
				continue
			}

			if res.StatusCode == sip.StatusRinging {
				log.Println("收到 180 Ringing，播放响铃音...")
				// 在收到 180 Ringing 时播放 ringing.wav（但此时还没有 RTP 地址，需要先解析）
				// 实际上，180 Ringing 可能不包含 SDP，所以我们需要等待 200 OK
				// 但可以先准备播放响铃音的逻辑
				continue
			}

			if res.StatusCode == sip.StatusOK {
				log.Println("收到 200 OK，呼叫已接通")

				// 解析响应中的 SDP 获取远程 RTP 地址
				remoteSDP := string(res.Body())
				log.Printf("远程 SDP:\n%s", remoteSDP)

				var err error
				remoteRTPAddr, err = parseSDPForRTPAddress(remoteSDP)
				if err != nil {
					log.Printf("解析远程 SDP 失败: %v", err)
					return
				}

				log.Printf("远程 RTP 地址: %s", remoteRTPAddr)

				// 保存呼出会话信息
				callIDStr = callID.Value()
				as.outgoingMutex.Lock()
				as.outgoingSessions[callIDStr] = &OutgoingSession{
					RemoteRTPAddr: remoteRTPAddr,
					CallID:        callIDStr,
				}
				as.outgoingMutex.Unlock()

				// 发送 ACK
				ackReq := sip.NewAckRequest(inviteReq, res, nil)
				if err := as.client.WriteRequest(ackReq); err != nil {
					log.Printf("发送 ACK 失败: %v", err)
					return
				}

				log.Println("已发送 ACK，开始发送音频...")

				// 呼出模式：直接播放 ringing.wav
				go as.sendAudioForOutgoing(remoteRTPAddr, callIDStr)
				return
			} else {
				log.Printf("呼叫失败: %d %s", res.StatusCode, res.Reason)
				return
			}

		case <-timeout.C:
			log.Printf("等待响应超时（30秒），可能目标 SIP 客户端未响应")
			log.Printf("请检查:")
			log.Printf("  1. 目标 SIP 客户端（%s:%d）是否正在运行", uri.Host, targetPort)
			log.Printf("  2. 网络连接是否正常")
			log.Printf("  3. 防火墙是否阻止了 SIP 流量")
			return
		case <-ctx.Done():
			log.Printf("上下文已取消")
			return
		}
	}
}

// MakeOutgoingCall 发起呼出呼叫（公共方法，供API调用）
func (as *SipServer) MakeOutgoingCall(targetURI string) (string, error) {
	callID := generateCallID()

	// 创建呼出会话记录
	now := time.Now()
	session := &OutgoingSession{
		CallID:    callID,
		TargetURI: targetURI,
		Status:    "calling",
		StartTime: now,
	}

	as.outgoingMutex.Lock()
	as.outgoingSessions[callID] = session
	as.outgoingMutex.Unlock()

	// 异步发起呼叫
	go func() {
		as.makeOutgoingCallWithID(targetURI, as.SipPort, as.RPTPort, callID)
	}()

	return callID, nil
}

// makeOutgoingCallWithID 发起呼出呼叫（带CallID）
func (as *SipServer) makeOutgoingCallWithID(targetURI string, sipPort int, rtpPort int, callID string) {
	logrus.WithField("call_id", callID).Info("=== 开始发起呼叫 ===")

	// 更新会话状态
	as.outgoingMutex.Lock()
	if session, exists := as.outgoingSessions[callID]; exists {
		session.Status = "calling"
	}
	as.outgoingMutex.Unlock()

	// 解析目标 URI
	uri := &sip.Uri{}
	if err := sip.ParseUri(targetURI, uri); err != nil {
		logrus.WithError(err).Error("解析目标 URI 失败")
		as.updateOutgoingSessionStatus(callID, "failed", err.Error())
		return
	}

	// 获取本地 IP
	localIP := getLocalIP()
	if localIP == "" {
		localIP = "127.0.0.1"
	}

	// 检查是否在呼叫自己
	targetHost := uri.Host
	targetPort := uri.Port
	if targetPort == 0 {
		targetPort = 5060
	}

	if targetHost == localIP && targetPort == sipPort {
		errMsg := fmt.Sprintf("不能呼叫自己: %s:%d", targetHost, targetPort)
		logrus.Warn(errMsg)
		as.updateOutgoingSessionStatus(callID, "failed", errMsg)
		return
	}

	// 检查用户是否已注册
	targetUsername := uri.User
	if targetUsername != "" {
		as.registerMutex.RLock()
		if registeredAddr, exists := as.registeredUsers[targetUsername]; exists {
			if addr, err := net.ResolveUDPAddr("udp", registeredAddr); err == nil {
				uri.Host = addr.IP.String()
				if addr.Port > 0 {
					uri.Port = addr.Port
				} else {
					uri.Port = 5060
				}
				targetHost = uri.Host
				targetPort = uri.Port
			}
		}
		as.registerMutex.RUnlock()
	}

	// 生成 SDP offer
	sdpOffer := generateSDP(localIP, rtpPort)
	sdpBytes := []byte(sdpOffer)

	// 创建 INVITE 请求
	inviteReq := sip.NewRequest(sip.INVITE, uri)

	// 设置 From 头
	fromURI := &sip.Uri{
		User: "server",
		Host: localIP,
		Port: sipPort,
	}
	from := &sip.FromHeader{
		DisplayName: "SIP Server",
		Address:     *fromURI,
		Params:      sip.NewParams(),
	}
	from.Params.Add("tag", generateTag())
	inviteReq.AppendHeader(from)

	// 设置 To 头
	to := &sip.ToHeader{
		Address: *uri,
		Params:  sip.NewParams(),
	}
	inviteReq.AppendHeader(to)

	// 设置 Call-ID（使用传入的callID）
	callIDHeader := sip.CallIDHeader(callID)
	inviteReq.AppendHeader(&callIDHeader)

	// 设置 CSeq
	cseq := &sip.CSeqHeader{
		SeqNo:      1,
		MethodName: sip.INVITE,
	}
	inviteReq.AppendHeader(cseq)

	// 设置 Contact 头
	contactURI := sip.Uri{
		Host: localIP,
		Port: sipPort,
	}
	contact := &sip.ContactHeader{
		Address: contactURI,
	}
	inviteReq.AppendHeader(contact)

	// 设置 Content-Type
	contentType := sip.ContentTypeHeader("application/sdp")
	inviteReq.AppendHeader(&contentType)

	// 设置 Content-Length
	cl := sip.ContentLengthHeader(len(sdpBytes))
	inviteReq.AppendHeader(&cl)

	// 设置请求体
	inviteReq.SetBody(sdpBytes)

	// 创建可取消的上下文
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

	// 保存取消函数和INVITE请求到会话
	as.outgoingMutex.Lock()
	if session, exists := as.outgoingSessions[callID]; exists {
		session.CancelFunc = cancel
		session.InviteReq = inviteReq // 保存INVITE请求用于后续发送BYE
	}
	as.outgoingMutex.Unlock()

	// 发送 INVITE 请求并等待响应
	tx, err := as.client.TransactionRequest(ctx, inviteReq)
	if err != nil {
		logrus.WithError(err).Error("发送 INVITE 请求失败")
		as.updateOutgoingSessionStatus(callID, "failed", err.Error())
		return
	}

	// 等待响应
	timeout := time.NewTimer(30 * time.Second)
	defer timeout.Stop()

	for {
		select {
		case res, ok := <-tx.Responses():
			if !ok {
				logrus.Info("响应通道已关闭")
				return
			}

			logrus.WithFields(logrus.Fields{
				"call_id":     callID,
				"status_code": res.StatusCode,
				"reason":      res.Reason,
			}).Info("收到响应")

			if res.StatusCode == sip.StatusTrying {
				continue
			}

			if res.StatusCode == sip.StatusRinging {
				as.updateOutgoingSessionStatus(callID, "ringing", "")
				continue
			}

			if res.StatusCode == sip.StatusOK {
				// 解析响应中的 SDP 获取远程 RTP 地址
				remoteSDP := string(res.Body())
				remoteRTPAddr, err := parseSDPForRTPAddress(remoteSDP)
				if err != nil {
					logrus.WithError(err).Error("解析远程 SDP 失败")
					as.updateOutgoingSessionStatus(callID, "failed", err.Error())
					return
				}

				// 更新会话信息
				now := time.Now()

				// 创建录音文件路径
				recordDir := "uploads/audio"
				if err := os.MkdirAll(recordDir, 0755); err != nil {
					logrus.WithError(err).Error("Failed to create audio directory")
				}
				recordingFile := fmt.Sprintf("%s/recorded_%s.wav", recordDir, callID)

				as.outgoingMutex.Lock()
				if session, exists := as.outgoingSessions[callID]; exists {
					session.RemoteRTPAddr = remoteRTPAddr
					session.Status = "answered"
					session.AnswerTime = &now
					session.LastResponse = res            // 保存响应用于发送BYE
					session.RecordingFile = recordingFile // 保存录音文件路径
				}
				as.outgoingMutex.Unlock()

				// 更新数据库状态
				as.updateCallStatusInDB(callID, "answered", nil)

				// 发送 ACK
				ackReq := sip.NewAckRequest(inviteReq, res, nil)
				if err := as.client.WriteRequest(ackReq); err != nil {
					logrus.WithError(err).Error("发送 ACK 失败")
					return
				}

				// 启动录音（持续录音直到通话结束）
				go as.recordAudioContinuous(remoteRTPAddr, callID, recordingFile, ctx)

				// 开始发送音频
				go as.sendAudioForOutgoing(remoteRTPAddr, callID)
				return
			} else {
				errMsg := fmt.Sprintf("呼叫失败: %d %s", res.StatusCode, res.Reason)
				logrus.Warn(errMsg)
				as.updateOutgoingSessionStatus(callID, "failed", errMsg)
				return
			}

		case <-timeout.C:
			errMsg := "等待响应超时（30秒）"
			logrus.Warn(errMsg)
			as.updateOutgoingSessionStatus(callID, "failed", errMsg)
			return
		case <-ctx.Done():
			logrus.Info("上下文已取消")
			return
		}
	}
}

// updateOutgoingSessionStatus 更新呼出会话状态
func (as *SipServer) updateOutgoingSessionStatus(callID, status, errorMsg string) {
	as.outgoingMutex.Lock()
	var endTime *time.Time
	if session, exists := as.outgoingSessions[callID]; exists {
		session.Status = status
		if errorMsg != "" {
			session.Error = errorMsg
		}
		if status == "failed" || status == "cancelled" || status == "ended" {
			now := time.Now()
			session.EndTime = &now
			endTime = &now
		}
	}
	as.outgoingMutex.Unlock()

	// 更新数据库状态
	if endTime != nil || status == "ringing" || status == "answered" {
		as.updateCallStatusInDB(callID, status, endTime)
	}
}

// updateCallStatusInDB 更新数据库中的通话状态
func (as *SipServer) updateCallStatusInDB(callID string, status string, endTime *time.Time) {
	if as.db == nil {
		return
	}

	var sipCall models.SipCall
	if err := as.db.Where("call_id = ?", callID).First(&sipCall).Error; err != nil {
		// 如果记录不存在，不报错（可能是历史记录）
		return
	}

	sipCall.Status = models.SipCallStatus(status)
	if endTime != nil {
		sipCall.EndTime = endTime
		if sipCall.AnswerTime != nil {
			duration := int(endTime.Sub(*sipCall.AnswerTime).Seconds())
			if duration > 0 {
				sipCall.Duration = duration
			}
		}
	}

	if status == "answered" && sipCall.AnswerTime == nil {
		now := time.Now()
		sipCall.AnswerTime = &now
	}

	if err := as.db.Save(&sipCall).Error; err != nil {
		logrus.WithError(err).WithField("call_id", callID).Error("Failed to update call status in database")
	}
}

// saveRecordingURL 保存录音URL到数据库
func (as *SipServer) saveRecordingURL(callID string, recordingFile string) {
	if as.db == nil {
		logrus.WithField("call_id", callID).Warn("Database not configured, skipping recording URL save")
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(recordingFile); os.IsNotExist(err) {
		logrus.WithField("call_id", callID).WithField("file", recordingFile).Warn("Recording file does not exist")
		return
	}

	// 生成录音URL（相对路径，前端可以通过API访问）
	recordURL := fmt.Sprintf("/api/uploads/audio/%s", strings.TrimPrefix(recordingFile, "uploads/audio/"))

	// 更新数据库记录
	var sipCall models.SipCall
	if err := as.db.Where("call_id = ?", callID).First(&sipCall).Error; err != nil {
		logrus.WithError(err).WithField("call_id", callID).Error("Failed to find call record for recording URL")
		return
	}

	sipCall.RecordURL = recordURL
	if err := as.db.Save(&sipCall).Error; err != nil {
		logrus.WithError(err).WithField("call_id", callID).Error("Failed to save recording URL")
	} else {
		logrus.WithFields(logrus.Fields{
			"call_id":    callID,
			"record_url": recordURL,
		}).Info("Recording URL saved to database")
	}
}

// GetOutgoingSession 获取呼出会话信息
func (as *SipServer) GetOutgoingSession(callID string) (interface{}, bool) {
	as.outgoingMutex.RLock()
	defer as.outgoingMutex.RUnlock()

	session, exists := as.outgoingSessions[callID]
	if !exists {
		return nil, false
	}

	// 返回副本以避免并发问题
	return &OutgoingSession{
		RemoteRTPAddr: session.RemoteRTPAddr,
		CallID:        session.CallID,
		TargetURI:     session.TargetURI,
		Status:        session.Status,
		StartTime:     session.StartTime,
		AnswerTime:    session.AnswerTime,
		EndTime:       session.EndTime,
		Error:         session.Error,
	}, true
}

// CancelOutgoingCall 取消呼出呼叫
func (as *SipServer) CancelOutgoingCall(callID string) error {
	as.outgoingMutex.Lock()
	session, exists := as.outgoingSessions[callID]
	if !exists {
		as.outgoingMutex.Unlock()
		return fmt.Errorf("call not found: %s", callID)
	}

	status := session.Status
	inviteReq := session.InviteReq
	lastResponse := session.LastResponse

	// 获取录音文件路径
	recordingFile := session.RecordingFile

	// 如果通话已接通，需要发送BYE请求
	if status == "answered" {
		as.outgoingMutex.Unlock()
		// 发送BYE请求来终止通话
		if err := as.sendByeRequest(callID, inviteReq, lastResponse); err != nil {
			logrus.WithError(err).Error("发送BYE请求失败")
			return err
		}
		as.outgoingMutex.Lock()
		// 取消上下文以停止录音
		if session.CancelFunc != nil {
			session.CancelFunc()
		}
	} else if status == "ended" || status == "failed" || status == "cancelled" {
		// 如果已经结束、失败或已取消，直接返回成功
		as.outgoingMutex.Unlock()
		return nil
	} else {
		// 未接通时，发送CANCEL请求
		as.outgoingMutex.Unlock()

		// 先取消上下文，停止等待响应
		if session.CancelFunc != nil {
			session.CancelFunc()
			logrus.WithField("call_id", callID).Info("已取消上下文")
		}

		// 发送CANCEL请求
		if inviteReq == nil {
			logrus.WithField("call_id", callID).Warn("INVITE请求为空，无法发送CANCEL")
		} else {
			cancelReq := as.createCancelRequest(inviteReq)
			if cancelReq == nil {
				logrus.WithField("call_id", callID).Warn("创建CANCEL请求失败")
			} else {
				// CANCEL请求必须使用与INVITE相同的Via头，确保路由正确
				// 直接通过client发送，但确保Via头正确
				logrus.WithField("call_id", callID).Info("准备发送CANCEL请求")
				if err := as.client.WriteRequest(cancelReq); err != nil {
					logrus.WithError(err).WithField("call_id", callID).Error("发送CANCEL请求失败")
				} else {
					logrus.WithField("call_id", callID).Info("CANCEL请求已发送")
					// 等待一小段时间确保CANCEL请求已发送
					time.Sleep(100 * time.Millisecond)
				}
			}
		}

		as.outgoingMutex.Lock()
	}

	// 更新状态
	now := time.Now()
	session.Status = "cancelled"
	session.EndTime = &now
	as.outgoingMutex.Unlock()

	// 更新数据库状态
	as.updateCallStatusInDB(callID, "cancelled", &now)

	// 如果通话已接通，保存录音URL
	if status == "answered" && recordingFile != "" {
		time.Sleep(500 * time.Millisecond)
		as.saveRecordingURL(callID, recordingFile)
	}

	return nil
}

// HangupOutgoingCall 挂断呼出呼叫（发送BYE请求）
func (as *SipServer) HangupOutgoingCall(callID string) error {
	as.outgoingMutex.Lock()
	session, exists := as.outgoingSessions[callID]
	if !exists {
		as.outgoingMutex.Unlock()
		return fmt.Errorf("call not found: %s", callID)
	}

	status := session.Status

	// 如果已经结束，直接返回成功
	if status == "ended" || status == "cancelled" || status == "failed" {
		as.outgoingMutex.Unlock()
		return nil
	}

	// 如果未接通，不能挂断，应该使用取消
	if status != "answered" {
		as.outgoingMutex.Unlock()
		return fmt.Errorf("cannot hangup call in status: %s (only answered calls can be hung up)", status)
	}

	inviteReq := session.InviteReq
	lastResponse := session.LastResponse
	as.outgoingMutex.Unlock()

	// 获取录音文件路径
	var recordingFile string
	as.outgoingMutex.Lock()
	if session, exists := as.outgoingSessions[callID]; exists {
		recordingFile = session.RecordingFile
	}
	as.outgoingMutex.Unlock()

	// 发送BYE请求
	if err := as.sendByeRequest(callID, inviteReq, lastResponse); err != nil {
		logrus.WithError(err).Error("发送BYE请求失败")
		return err
	}

	// 更新状态
	now := time.Now()
	as.outgoingMutex.Lock()
	if session, exists := as.outgoingSessions[callID]; exists {
		session.Status = "ended"
		session.EndTime = &now
		// 取消上下文以停止录音
		if session.CancelFunc != nil {
			session.CancelFunc()
		}
	}
	as.outgoingMutex.Unlock()

	// 更新数据库状态
	as.updateCallStatusInDB(callID, "ended", &now)

	// 保存录音URL
	if recordingFile != "" {
		time.Sleep(500 * time.Millisecond)
		as.saveRecordingURL(callID, recordingFile)
	}

	return nil
}

// createCancelRequest 创建CANCEL请求
func (as *SipServer) createCancelRequest(inviteReq *sip.Request) *sip.Request {
	if inviteReq == nil {
		return nil
	}

	// 从INVITE请求中获取目标URI（Recipient是字段，不是方法）
	targetURI := inviteReq.Recipient
	if targetURI == nil {
		// 如果Recipient为空，尝试从To头获取
		if to := inviteReq.To(); to != nil {
			targetURI = &to.Address
			logrus.Info("使用To头的地址作为目标URI")
		} else {
			logrus.Warn("无法获取目标URI，Recipient和To都为空")
			return nil
		}
	}

	// 创建CANCEL请求
	cancelReq := sip.NewRequest(sip.CANCEL, targetURI)

	// 复制INVITE请求的头信息
	if from := inviteReq.From(); from != nil {
		cancelReq.AppendHeader(from)
	}
	if to := inviteReq.To(); to != nil {
		cancelReq.AppendHeader(to)
	}
	if callID := inviteReq.CallID(); callID != nil {
		cancelReq.AppendHeader(callID)
	}
	if cseq := inviteReq.CSeq(); cseq != nil {
		// CANCEL请求的CSeq与INVITE相同，但方法名是CANCEL
		cancelCSeq := &sip.CSeqHeader{
			SeqNo:      cseq.SeqNo,
			MethodName: sip.CANCEL,
		}
		cancelReq.AppendHeader(cancelCSeq)
	}
	// 复制所有Via头（CANCEL必须使用与INVITE相同的Via头）
	// 先尝试获取所有Via头
	if vias := inviteReq.GetHeaders("Via"); len(vias) > 0 {
		for _, viaHeader := range vias {
			cancelReq.AppendHeader(viaHeader)
		}
	} else if via := inviteReq.Via(); via != nil {
		// 如果没有多个Via头，使用单个Via头
		cancelReq.AppendHeader(via)
	}
	if contact := inviteReq.Contact(); contact != nil {
		cancelReq.AppendHeader(contact)
	}

	// 设置Content-Length为0
	cl := sip.ContentLengthHeader(0)
	cancelReq.AppendHeader(&cl)

	return cancelReq
}

// sendByeRequest 发送BYE请求
func (as *SipServer) sendByeRequest(callID string, inviteReq *sip.Request, lastResponse *sip.Response) error {
	if inviteReq == nil || lastResponse == nil {
		return fmt.Errorf("missing INVITE request or response for BYE")
	}

	// 从INVITE请求中获取To和From头
	from := inviteReq.From()
	to := inviteReq.To()
	if from == nil || to == nil {
		return fmt.Errorf("missing From or To header in INVITE request")
	}

	// 获取目标URI（从To头获取）
	targetURI := to.Address

	// 创建BYE请求
	byeReq := sip.NewRequest(sip.BYE, &targetURI)

	// 设置From头（使用INVITE请求的From头）
	byeReq.AppendHeader(from)

	// 设置To头（使用INVITE请求的To头，如果响应中有tag则使用响应的tag）
	toHeader := &sip.ToHeader{
		Address: to.Address,
		Params:  sip.NewParams(),
	}
	if to.Params != nil {
		if tag, exists := to.Params.Get("tag"); exists {
			toHeader.Params.Add("tag", tag)
		}
	}
	// 如果响应中有To tag，使用响应的tag
	if lastResponse.To() != nil && lastResponse.To().Params != nil {
		if tag, exists := lastResponse.To().Params.Get("tag"); exists {
			toHeader.Params.Add("tag", tag)
		}
	}
	byeReq.AppendHeader(toHeader)

	// 设置Call-ID
	callIDHeader := sip.CallIDHeader(callID)
	byeReq.AppendHeader(&callIDHeader)

	// 设置CSeq（使用INVITE的CSeq号+1，方法改为BYE）
	cseq := inviteReq.CSeq()
	if cseq != nil {
		byeCSeq := &sip.CSeqHeader{
			SeqNo:      cseq.SeqNo + 1,
			MethodName: sip.BYE,
		}
		byeReq.AppendHeader(byeCSeq)
	} else {
		byeCSeq := &sip.CSeqHeader{
			SeqNo:      2,
			MethodName: sip.BYE,
		}
		byeReq.AppendHeader(byeCSeq)
	}

	// 设置Contact头（使用INVITE请求的Contact头）
	if contact := inviteReq.Contact(); contact != nil {
		byeReq.AppendHeader(contact)
	}

	// 设置Via头（使用INVITE请求的Via头）
	if via := inviteReq.Via(); via != nil {
		byeReq.AppendHeader(via)
	}

	// 设置Content-Length为0
	cl := sip.ContentLengthHeader(0)
	byeReq.AppendHeader(&cl)

	// 发送BYE请求
	if err := as.client.WriteRequest(byeReq); err != nil {
		return fmt.Errorf("failed to send BYE request: %w", err)
	}

	logrus.WithField("call_id", callID).Info("BYE request sent")
	return nil
}

// sendAudioForOutgoing 呼出时发送音频（只播放 ringing.wav）
func (as *SipServer) sendAudioForOutgoing(clientAddr string, callID string) {
	// 呼出时只播放 ringing.wav
	log.Println("呼出模式：播放 ringing.wav")
	as.sendAudioFromFile(clientAddr, ringingFile, 160)

	// 播放完成后，开始录音
	log.Println("音频发送完成，开始录音...")
	recordedFile := fmt.Sprintf("recorded_%s.wav", callID)
	as.recordAudio(clientAddr, recordedFile, 5*time.Second, 8000)

	// 等待录音完成后播放
	log.Printf("录音完成，开始播放录音文件: %s", recordedFile)
	as.sendAudioFromFile(clientAddr, recordedFile, 160)

	// 播放完录音后，进入 DTMF 监听模式
	log.Println("录音播放完成，进入 DTMF 按键监听模式...")
	log.Println("按 1 播放 output.wav，按 2 播放 ringing.wav")
	go as.listenDTMF(clientAddr, callID)
}

// generateTag 生成 SIP tag
func generateTag() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// generateCallID 生成 Call-ID
func generateCallID() string {
	return fmt.Sprintf("%d@%s", time.Now().UnixNano(), getLocalIP())
}

func (as *SipServer) RegisterFunc() {
	as.server.OnInvite(as.handleInvite)
	as.server.OnRegister(as.handleRegister)
	as.server.OnOptions(as.handleOptions)
	as.server.OnAck(as.handleAck)
	as.server.OnBye(as.handleBye)
	as.server.OnCancel(as.handleCancel)
	as.server.OnPublish(as.handlePublish)
	as.server.OnNoRoute(as.handleNoRoute)
	as.server.OnInfo(as.handleInfo)
}

func (as *SipServer) handleInvite(req *sip.Request, tx sip.ServerTransaction) {
	logrus.WithField("start_line", req.StartLine()).Info("Received INVITE request")

	// Parse SDP to get client RTP address
	sdpBody := string(req.Body())
	clientRTPAddr, err := parseSDPForRTPAddress(sdpBody)
	if err != nil {
		logrus.WithError(err).Error("Failed to parse SDP")
		// Send 500 error response
		res := sip.NewResponseFromRequest(req, sip.StatusInternalServerError, "Internal Server Error", nil)
		tx.Respond(res)
		return
	}

	logrus.WithField("client_rtp_addr", clientRTPAddr).Info("Client RTP address")

	// Generate SDP response (use request source address to determine server IP)
	serverIP := getServerIPFromRequest(req)
	sdp := generateSDP(serverIP, as.RPTPort)
	sdpBytes := []byte(sdp)

	// Log SDP content for debugging
	logrus.WithField("sdp", sdp).Debug("Generated SDP")

	// Create 200 OK response
	// 先检查是否需要启动 AI 代接（在发送 200 OK 之前）
	callID := req.CallID().Value()
	shouldStartAI, sipUser, assistant, err := as.checkAIAutoAnswer(req)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"call_id": callID,
			"error":   err,
		}).Warn("Failed to check AI auto-answer")
	}

	// 根据 AI 检查结果决定保存的地址格式
	rtpAddrToSave := clientRTPAddr
	if shouldStartAI && sipUser != nil && assistant != nil {
		// 添加 AI 标记
		rtpAddrToSave = clientRTPAddr + "|AI"

		// 保存 AI 会话信息
		as.aiSessionMutex.Lock()
		as.aiSessionInfo[callID] = &AISessionInfo{
			SipUser:   sipUser,
			Assistant: assistant,
		}
		as.aiSessionMutex.Unlock()

		logrus.WithFields(logrus.Fields{
			"call_id":   callID,
			"sip_user":  sipUser.Username,
			"assistant": assistant.Name,
		}).Info("🤖 标记为 AI 代接会话")
	}

	// Save session information BEFORE sending 200 OK
	as.sessionsMutex.Lock()
	as.pendingSessions[callID] = rtpAddrToSave
	as.sessionsMutex.Unlock()
	logrus.WithFields(logrus.Fields{
		"call_id":     callID,
		"rtp_address": rtpAddrToSave,
	}).Info("Session information saved")

	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", sdpBytes)
	cl := sip.ContentLengthHeader(len(sdpBytes))
	res.AppendHeader(&cl)

	// Add Content-Type header
	contentType := sip.ContentTypeHeader("application/sdp")
	res.AppendHeader(&contentType)

	// Add Contact header (some clients need this to send ACK correctly)
	// Create a Contact header using server IP and port
	contactURI := sip.Uri{
		Host: serverIP,
		Port: as.SipPort,
	}
	contact := &sip.ContactHeader{
		Address: contactURI,
	}
	res.AppendHeader(contact)
	logrus.WithField("contact", contact.String()).Debug("Contact header")

	// Send 200 OK response
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send response")
		return
	}

	logrus.Info("200 OK response sent with SDP and Contact header")
	logrus.Info("200 OK response sent, waiting for ACK...")

	// 创建呼入通话的数据库记录
	if as.db != nil {
		now := time.Now()
		from := req.From()
		to := req.To()

		var fromUsername, fromURI, fromIP string
		var toUsername, toURI string

		if from != nil {
			fromUsername = from.Address.User
			fromURI = from.Address.String()
			// 从请求中获取源IP
			if via := req.Via(); via != nil {
				fromIP = via.Host
			}
		}

		if to != nil {
			toUsername = to.Address.User
			toURI = to.Address.String()
		}

		// 获取服务器IP和RTP端口
		serverIP := getServerIPFromRequest(req)
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
		} else {
			logrus.WithField("call_id", callID).Info("Inbound call record created")
		}
	}
}

func (as *SipServer) sendAudio(clientAddr string, sampleRate uint32, samplesPerPacket int) {
	// Parse client address
	addr, err := net.ResolveUDPAddr("udp", clientAddr)
	if err != nil {
		logrus.WithError(err).WithField("client_addr", clientAddr).Error("Failed to resolve client address")
		return
	}

	// Read WAV file
	wavData, err := os.ReadFile(wavFile)
	if err != nil {
		logrus.WithError(err).WithField("wav_file", wavFile).Error("Failed to read WAV file")
		return
	}

	// Parse WAV file header
	if len(wavData) < 44 {
		logrus.WithField("size", len(wavData)).Error("WAV file is too small")
		return
	}

	// Check WAV file format
	if string(wavData[0:4]) != "RIFF" || string(wavData[8:12]) != "WAVE" {
		logrus.Error("Invalid WAV file format")
		return
	}

	// Find data chunk
	dataOffset := 44
	for i := 0; i < len(wavData)-8; i++ {
		if string(wavData[i:i+4]) == "data" {
			dataOffset = i + 8
			break
		}
	}

	audioData := wavData[dataOffset:]

	logrus.WithField("size", len(audioData)).Info("Starting to send audio data")

	// Create RTP packet
	packet := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    0, // PCMU (G.711 μ-law)
			SequenceNumber: 0,
			Timestamp:      0,
			SSRC:           12345678,
		},
		Payload: make([]byte, samplesPerPacket),
	}

	sequenceNumber := uint16(0)
	timestamp := uint32(0)

	// Send audio data
	for i := 0; i < len(audioData); i += samplesPerPacket * 2 { // *2 because 16-bit samples
		end := i + samplesPerPacket*2
		if end > len(audioData) {
			end = len(audioData)
		}

		chunk := audioData[i:end]

		// Convert 16-bit PCM to G.711 μ-law
		payload := make([]byte, samplesPerPacket)
		for j := 0; j < samplesPerPacket && j*2+1 < len(chunk); j++ {
			// Read 16-bit little-endian PCM sample
			sample := int16(binary.LittleEndian.Uint16(chunk[j*2 : j*2+2]))
			// Convert to G.711 μ-law
			payload[j] = linearToMulaw(sample)
		}

		// If data is insufficient, fill with silence
		if len(chunk) < samplesPerPacket*2 {
			for j := len(chunk) / 2; j < samplesPerPacket; j++ {
				payload[j] = 0xFF // μ-law silence value
			}
		}

		packet.Header.SequenceNumber = sequenceNumber
		packet.Header.Timestamp = timestamp
		packet.Payload = payload

		// Serialize RTP packet
		packetBytes, err := packet.Marshal()
		if err != nil {
			logrus.WithError(err).Error("Failed to serialize RTP packet")
			continue
		}

		// Send RTP packet
		_, err = as.rtpConn.WriteToUDP(packetBytes, addr)
		if err != nil {
			logrus.WithError(err).Error("Failed to send RTP packet")
			continue
		}

		sequenceNumber++
		timestamp += uint32(samplesPerPacket)

		// Wait 20ms (corresponds to 160 samples)
		time.Sleep(20 * time.Millisecond)

		// Limit sending time (optional, send for 30 seconds)
		if timestamp > sampleRate*30 {
			break
		}
	}

	logrus.Info("Audio sending completed")
}

// sendAudioWithContext sends audio with cancellation support
func (as *SipServer) sendAudioWithContext(clientAddr string, sampleRate uint32, samplesPerPacket int, ctx context.Context) {
	// Parse client address
	addr, err := net.ResolveUDPAddr("udp", clientAddr)
	if err != nil {
		logrus.WithError(err).WithField("client_addr", clientAddr).Error("Failed to resolve client address")
		return
	}

	// Read WAV file
	wavData, err := os.ReadFile(wavFile)
	if err != nil {
		logrus.WithError(err).WithField("wav_file", wavFile).Error("Failed to read WAV file")
		return
	}

	// Parse WAV file header
	if len(wavData) < 44 {
		logrus.WithField("size", len(wavData)).Error("WAV file is too small")
		return
	}

	// Check WAV file format
	if string(wavData[0:4]) != "RIFF" || string(wavData[8:12]) != "WAVE" {
		logrus.Error("Invalid WAV file format")
		return
	}

	// Find data chunk
	dataOffset := 44
	for i := 0; i < len(wavData)-8; i++ {
		if string(wavData[i:i+4]) == "data" {
			dataOffset = i + 8
			break
		}
	}

	audioData := wavData[dataOffset:]
	logrus.WithField("size", len(audioData)).Info("Starting to send audio data")

	// Create RTP packet
	packet := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    0, // PCMU (G.711 μ-law)
			SequenceNumber: 0,
			Timestamp:      0,
			SSRC:           12345678,
		},
		Payload: make([]byte, samplesPerPacket),
	}

	sequenceNumber := uint16(0)
	timestamp := uint32(0)

	// Send audio data with cancellation check
	for i := 0; i < len(audioData); i += samplesPerPacket * 2 {
		// Check if cancelled
		select {
		case <-ctx.Done():
			logrus.Info("Audio sending cancelled")
			return
		default:
		}

		end := i + samplesPerPacket*2
		if end > len(audioData) {
			end = len(audioData)
		}

		chunk := audioData[i:end]

		// Convert 16-bit PCM to G.711 μ-law
		payload := make([]byte, samplesPerPacket)
		for j := 0; j < samplesPerPacket && j*2+1 < len(chunk); j++ {
			sample := int16(binary.LittleEndian.Uint16(chunk[j*2 : j*2+2]))
			payload[j] = linearToMulaw(sample)
		}

		// If data is insufficient, fill with silence
		if len(chunk) < samplesPerPacket*2 {
			for j := len(chunk) / 2; j < samplesPerPacket; j++ {
				payload[j] = 0xFF // μ-law silence value
			}
		}

		packet.Header.SequenceNumber = sequenceNumber
		packet.Header.Timestamp = timestamp
		packet.Payload = payload

		// Serialize RTP packet
		packetBytes, err := packet.Marshal()
		if err != nil {
			logrus.WithError(err).Error("Failed to serialize RTP packet")
			continue
		}

		// Send RTP packet
		_, err = as.rtpConn.WriteToUDP(packetBytes, addr)
		if err != nil {
			logrus.WithError(err).Error("Failed to send RTP packet")
			continue
		}

		sequenceNumber++
		timestamp += uint32(samplesPerPacket)

		// Wait 20ms with cancellation check
		select {
		case <-ctx.Done():
			logrus.Info("Audio sending cancelled")
			return
		case <-time.After(20 * time.Millisecond):
		}

		// Limit sending time (optional, send for 30 seconds)
		if timestamp > sampleRate*30 {
			break
		}
	}

	logrus.Info("Audio sending completed")
}

func (as *SipServer) handleRegister(req *sip.Request, tx sip.ServerTransaction) {
	logrus.WithField("start_line", req.StartLine()).Info("Received REGISTER request")

	// Extract username from From header
	var username string
	if from := req.From(); from != nil {
		username = from.Address.User
	}

	// If db is configured, validate user
	if as.db != nil {
		if username == "" {
			logrus.Warn("REGISTER request missing username in From header")
			res := sip.NewResponseFromRequest(req, sip.StatusUnauthorized, "Unauthorized", nil)
			if err := tx.Respond(res); err != nil {
				logrus.WithError(err).Error("Failed to send 401 response")
			}
			return
		}

		// Query user from database
		var sipUser models.SipUser
		err := as.db.Where("username = ?", username).First(&sipUser).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				logrus.WithField("username", username).Warn("SIP user not found in database")
				res := sip.NewResponseFromRequest(req, sip.StatusUnauthorized, "Unauthorized", nil)
				if err := tx.Respond(res); err != nil {
					logrus.WithError(err).Error("Failed to send 401 response")
				}
				return
			}
			logrus.WithError(err).Error("Database query failed")
			res := sip.NewResponseFromRequest(req, sip.StatusInternalServerError, "Internal Server Error", nil)
			if err := tx.Respond(res); err != nil {
				logrus.WithError(err).Error("Failed to send 500 response")
			}
			return
		}

		// Check if user is enabled
		if !sipUser.Enabled {
			logrus.WithField("username", username).Warn("SIP user is disabled")
			res := sip.NewResponseFromRequest(req, sip.StatusForbidden, "Forbidden", nil)
			if err := tx.Respond(res); err != nil {
				logrus.WithError(err).Error("Failed to send 403 response")
			}
			return
		}

		// Extract registration information from request
		contact := req.Contact()
		var contactStr string
		var contactIP string
		var contactPort int

		if contact != nil {
			contactStr = contact.Address.String()
			contactIP = contact.Address.Host
			contactPort = contact.Address.Port
			if contactPort == 0 {
				contactPort = 5060 // Default SIP port
			}
		}

		// Extract expires from request or use default
		expires := 3600 // Default 1 hour
		if expiresHeader := req.GetHeader("Expires"); expiresHeader != nil {
			if expiresValue, err := strconv.Atoi(expiresHeader.Value()); err == nil {
				expires = expiresValue
			}
		}

		// Extract User-Agent
		userAgent := ""
		if uaHeader := req.GetHeader("User-Agent"); uaHeader != nil {
			userAgent = uaHeader.Value()
		}

		// Extract remote IP from Via header or request source
		remoteIP := ""
		if via := req.Via(); via != nil {
			if received, exists := via.Params.Get("received"); exists && received != "" {
				remoteIP = received
			} else if via.Host != "" {
				remoteIP = via.Host
			}
		}

		// Update user information
		now := time.Now()
		sipUser.Contact = contactStr
		sipUser.ContactIP = contactIP
		sipUser.ContactPort = contactPort
		sipUser.Expires = expires
		sipUser.Status = models.SipUserStatusRegistered
		sipUser.LastRegister = &now
		sipUser.RegisterCount++
		sipUser.UserAgent = userAgent
		sipUser.RemoteIP = remoteIP
		sipUser.UpdateExpiresAt()

		// Save to database
		if err := as.db.Save(&sipUser).Error; err != nil {
			logrus.WithError(err).Error("Failed to update SIP user in database")
			res := sip.NewResponseFromRequest(req, sip.StatusInternalServerError, "Internal Server Error", nil)
			if err := tx.Respond(res); err != nil {
				logrus.WithError(err).Error("Failed to send 500 response")
			}
			return
		}

		// Update in-memory registered users map
		if contactStr != "" {
			as.registerMutex.Lock()
			as.registeredUsers[username] = fmt.Sprintf("%s:%d", contactIP, contactPort)
			as.registerMutex.Unlock()
		}

		logrus.WithFields(logrus.Fields{
			"username":       username,
			"contact":        contactStr,
			"expires":        expires,
			"register_count": sipUser.RegisterCount,
		}).Info("SIP user registered successfully")
	} else {
		// If db is nil, allow all registrations (no validation)
		logrus.Info("Database not configured, allowing registration without validation")

		// Still extract username and update in-memory map if possible
		if username != "" {
			contact := req.Contact()
			if contact != nil {
				contactIP := contact.Address.Host
				contactPort := contact.Address.Port
				if contactPort == 0 {
					contactPort = 5060
				}
				as.registerMutex.Lock()
				as.registeredUsers[username] = fmt.Sprintf("%s:%d", contactIP, contactPort)
				as.registerMutex.Unlock()
			}
		}
	}

	// Accept registration, return 200 OK
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)

	// Add Contact header (optional)
	if contact := req.Contact(); contact != nil {
		res.AppendHeader(contact)
	}

	// Add Expires header
	expiresValue := 3600 // Default 1 hour
	if expiresHeader := req.GetHeader("Expires"); expiresHeader != nil {
		if val, err := strconv.Atoi(expiresHeader.Value()); err == nil {
			expiresValue = val
		}
	}
	expires := sip.ExpiresHeader(expiresValue)
	res.AppendHeader(&expires)

	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send REGISTER response")
		return
	}

	logrus.Info("REGISTER 200 OK response sent")
}

func (as *SipServer) handleOptions(req *sip.Request, tx sip.ServerTransaction) {
	logrus.WithField("start_line", req.StartLine()).Info("Received OPTIONS request")

	// Return 200 OK, indicating support for these methods
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)

	// Add Allow header, list supported methods
	allow := sip.NewHeader("Allow", "INVITE, ACK, CANCEL, BYE, OPTIONS, REGISTER")
	res.AppendHeader(allow)

	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send OPTIONS response")
		return
	}

	logrus.Info("OPTIONS 200 OK response sent")
}

func (as *SipServer) handleAck(req *sip.Request, tx sip.ServerTransaction) {
	callID := req.CallID().Value()
	logrus.WithFields(logrus.Fields{
		"start_line": req.StartLine(),
		"call_id":    callID,
	}).Info("Received ACK request")

	// ACK request doesn't need a response, but receiving ACK means session is established, can start sending audio
	// Find corresponding session information
	as.sessionsMutex.Lock()
	clientRTPAddr, exists := as.pendingSessions[callID]
	// 不要立即删除，先检查是否是 AI 会话
	as.sessionsMutex.Unlock()

	logrus.WithFields(logrus.Fields{
		"call_id":       callID,
		"exists":        exists,
		"clientRTPAddr": clientRTPAddr,
	}).Debug("Pending session info")

	if !exists {
		logrus.WithField("call_id", callID).Warn("Received ACK but could not find corresponding session")
		logrus.Debug("Current pending sessions list:")
		as.sessionsMutex.RLock()
		for id, addr := range as.pendingSessions {
			logrus.WithFields(logrus.Fields{
				"call_id":     id,
				"rtp_address": addr,
			}).Debug("Pending session")
		}
		as.sessionsMutex.RUnlock()
		return
	}

	// 检查是否是 AI 代接会话（在删除之前检查！）
	isAISession := false
	actualRTPAddr := clientRTPAddr

	logrus.WithFields(logrus.Fields{
		"call_id":       callID,
		"clientRTPAddr": clientRTPAddr,
		"length":        len(clientRTPAddr),
		"has_AI_suffix": len(clientRTPAddr) > 3 && clientRTPAddr[len(clientRTPAddr)-3:] == "|AI",
	}).Info("🔍 检查 AI 会话标记")

	if len(clientRTPAddr) > 3 && clientRTPAddr[len(clientRTPAddr)-3:] == "|AI" {
		isAISession = true
		actualRTPAddr = clientRTPAddr[:len(clientRTPAddr)-3]
		logrus.WithField("call_id", callID).Info("🤖 检测到 AI 代接会话")

		// 等待 handleInvite 完成 AI 会话信息的保存（最多等待 500ms）
		maxWait := 10 // 最多等待 10 次，每次 50ms
		for i := 0; i < maxWait; i++ {
			as.aiSessionMutex.RLock()
			_, hasAIInfo := as.aiSessionInfo[callID]
			as.aiSessionMutex.RUnlock()

			if hasAIInfo {
				break
			}

			// 等待 50ms 后重试
			time.Sleep(50 * time.Millisecond)
		}
	}

	// 现在可以安全地删除 pending session 了
	as.sessionsMutex.Lock()
	delete(as.pendingSessions, callID)
	as.sessionsMutex.Unlock()

	// Save active session information
	clientAddr, err := net.ResolveUDPAddr("udp", actualRTPAddr)
	if err != nil {
		logrus.WithError(err).Error("Failed to resolve client address")
		return
	}
	logrus.WithField("client_rtp_addr", actualRTPAddr).Info("Session established, starting to send audio")

	// 如果是 AI 代接会话，启动 AI 语音处理
	if isAISession {
		// 从 aiSessionInfo 中获取 AI 会话信息
		as.aiSessionMutex.RLock()
		aiInfo, hasAIInfo := as.aiSessionInfo[callID]
		as.aiSessionMutex.RUnlock()

		if !hasAIInfo || aiInfo == nil || aiInfo.SipUser == nil || aiInfo.Assistant == nil {
			logrus.WithField("call_id", callID).Warn("无法找到 AI 会话信息，回退到普通模式")
			isAISession = false
		} else {
			// 启动 AI 语音会话
			if err := as.startAIVoiceSession(callID, clientAddr, aiInfo.SipUser, aiInfo.Assistant); err != nil {
				logrus.WithFields(logrus.Fields{
					"call_id": callID,
					"error":   err,
				}).Error("Failed to start AI voice session, falling back to normal mode")
				isAISession = false
			} else {
				// AI 会话启动成功，直接返回
				logrus.WithField("call_id", callID).Info("✅ AI 语音会话已启动，跳过普通音频发送")
				return
			}
		}
	}

	// 普通模式：创建会话并发送音频
	// Create context for session cancellation
	ctx, cancel := context.WithCancel(context.Background())

	// 创建录音文件路径
	recordDir := "uploads/audio"
	if err := os.MkdirAll(recordDir, 0755); err != nil {
		logrus.WithError(err).Error("Failed to create audio directory")
	}
	recordingFile := fmt.Sprintf("%s/recorded_%s.wav", recordDir, callID)

	as.activeMutex.Lock()
	as.activeSessions[callID] = &SessionInfo{
		ClientRTPAddr: clientAddr,
		StopRecording: make(chan bool, 1),
		DTMFChannel:   make(chan string, 10), // DTMF channel
		CancelCtx:     ctx,
		CancelFunc:    cancel,
		RecordingFile: recordingFile,
	}
	as.activeMutex.Unlock()

	// 更新数据库状态为已接通（呼入通话）
	if as.db != nil {
		now := time.Now()
		as.updateCallStatusInDB(callID, "answered", &now)
	}

	// 启动录音（持续录音直到通话结束）
	go as.recordAudioContinuous(actualRTPAddr, callID, recordingFile, ctx)

	// Send audio in goroutine
	go as.sendAudioWithCallback(actualRTPAddr, callID)
}

func (as *SipServer) sendAudioWithCallback(clientAddr string, callID string) {
	// Get session context for cancellation check
	as.activeMutex.RLock()
	session, exists := as.activeSessions[callID]
	as.activeMutex.RUnlock()

	if !exists {
		logrus.WithField("call_id", callID).Warn("Session not found, aborting audio callback")
		return
	}

	// Create event processor
	processor := NewEventProcessor(as)

	// Build event sequence
	recordedFile := fmt.Sprintf("recorded_%s.wav", callID)
	events := []SipEvent{
		// 2. Record audio
		NewRecordAudioEvent(callID, session.CancelCtx, clientAddr, recordedFile, 5*time.Second, 8000, session.StopRecording),
		// 3. Play recorded audio
		NewPlayAudioEvent(callID, session.CancelCtx, clientAddr, recordedFile, 0, 160),
		// 1. Play initial audio
		NewPlayAudioEvent(callID, session.CancelCtx, clientAddr, "", 8000, 160),
	}

	// Process event sequence
	if err := processor.ProcessSequence(events); err != nil {
		logrus.WithError(err).WithField("call_id", callID).Error("Event sequence processing failed")
		return
	}

	// After playing recording, enter DTMF listening mode
	logrus.Info("Recording playback completed, entering DTMF listening mode...")
	logrus.Info("Press 1 to play output.wav, press 2 to play ringing.wav")
	as.listenDTMFWithContext(clientAddr, callID, session.CancelCtx)
}

// handleInfo handles SIP INFO request (for receiving DTMF)
func (as *SipServer) handleInfo(req *sip.Request, tx sip.ServerTransaction) {
	callID := req.CallID().Value()
	logrus.WithFields(logrus.Fields{
		"start_line": req.StartLine(),
		"call_id":    callID,
	}).Info("Received INFO request")

	// Parse DTMF information
	body := string(req.Body())
	logrus.WithField("body", body).Debug("INFO request body")

	// Find DTMF signal (usually in Signal or Key parameter)
	dtmfDigit := ""
	if strings.Contains(body, "Signal=") {
		// Parse Signal=1 format
		parts := strings.Split(body, "Signal=")
		if len(parts) > 1 {
			dtmfDigit = strings.TrimSpace(strings.Split(parts[1], "\r\n")[0])
			dtmfDigit = strings.Trim(dtmfDigit, "\"")
		}
	} else if strings.Contains(body, "key=") {
		// Parse key=1 format
		parts := strings.Split(body, "key=")
		if len(parts) > 1 {
			dtmfDigit = strings.TrimSpace(strings.Split(parts[1], "\r\n")[0])
			dtmfDigit = strings.Trim(dtmfDigit, "\"")
		}
	}

	// If not found, try to parse from Content-Type and body
	if dtmfDigit == "" && body != "" {
		// Try to extract digit directly
		for _, char := range body {
			if char >= '0' && char <= '9' {
				dtmfDigit = string(char)
				break
			}
		}
	}

	if dtmfDigit != "" {
		logrus.WithFields(logrus.Fields{
			"dtmf":    dtmfDigit,
			"call_id": callID,
		}).Info("Detected DTMF key")

		// Send DTMF to session channel
		as.activeMutex.RLock()
		if session, exists := as.activeSessions[callID]; exists {
			select {
			case session.DTMFChannel <- dtmfDigit:
				logrus.WithField("dtmf", dtmfDigit).Debug("DTMF key sent to session channel")
			default:
				logrus.WithField("dtmf", dtmfDigit).Warn("DTMF channel full, dropping key")
			}
		}
		as.activeMutex.RUnlock()
	}

	// Return 200 OK
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send INFO response")
		return
	}

	logrus.Info("INFO 200 OK response sent")
}

// listenDTMF 监听 DTMF 按键（保留原函数以兼容）
func (as *SipServer) listenDTMF(clientAddr string, callID string) {
	as.activeMutex.RLock()
	session, exists := as.activeSessions[callID]
	as.activeMutex.RUnlock()

	if !exists {
		logrus.WithField("call_id", callID).Warn("Session not found")
		return
	}

	as.listenDTMFWithContext(clientAddr, callID, session.CancelCtx)
}

// listenDTMFWithContext listens for DTMF keys with cancellation support
func (as *SipServer) listenDTMFWithContext(clientAddr string, callID string, ctx context.Context) {
	as.activeMutex.RLock()
	session, exists := as.activeSessions[callID]
	as.activeMutex.RUnlock()

	if !exists {
		logrus.WithField("call_id", callID).Warn("Session not found")
		return
	}

	// Create event processor
	processor := NewEventProcessor(as)

	// Set timeout (exit if no key pressed within 60 seconds)
	timeout := time.NewTimer(60 * time.Second)
	defer timeout.Stop()

	// DTMF key to filename mapping
	dtmfMap := map[string]string{
		"1": wavFile,
		"2": ringingFile,
	}

	for {
		select {
		case <-ctx.Done():
			logrus.Info("DTMF listening cancelled")
			return
		case dtmf, ok := <-session.DTMFChannel:
			if !ok {
				// Channel closed, exit listening mode
				logrus.Info("DTMF channel closed, exiting listening mode")
				return
			}

			logrus.WithField("dtmf", dtmf).Info("Received DTMF key")

			// Reset timeout
			timeout.Reset(60 * time.Second)

			// Process DTMF event
			if filename, exists := dtmfMap[dtmf]; exists {
				dtmfEvent := NewDTMFEvent(callID, ctx, clientAddr, dtmf).WithAction(filename)
				if err := processor.Process(dtmfEvent); err != nil {
					logrus.WithError(err).WithField("dtmf", dtmf).Error("Failed to process DTMF event")
				}
			} else {
				logrus.WithField("dtmf", dtmf).Warn("Unknown DTMF key")
			}

		case <-timeout.C:
			logrus.Info("DTMF listening timeout, exiting listening mode")
			return
		}
	}
}

// recordAudio 录音功能（保留原函数以兼容）
func (as *SipServer) recordAudio(clientAddr string, filename string, duration time.Duration, sampleRate int) {
	as.recordAudioWithContext(clientAddr, filename, duration, sampleRate, context.Background(), nil)
}

// recordAudioWithContext 录音功能（带取消支持）
func (as *SipServer) recordAudioWithContext(clientAddr string, filename string, duration time.Duration, sampleRate int, ctx context.Context, stopChan chan bool) {
	addr, err := net.ResolveUDPAddr("udp", clientAddr)
	if err != nil {
		logrus.WithError(err).Error("Failed to resolve client address")
		return
	}

	logrus.WithFields(logrus.Fields{
		"filename": filename,
		"duration": duration,
		"address":  addr.String(),
	}).Info("Starting recording")

	// 创建缓冲区存储 PCM 数据
	var pcmData []int16
	startTime := time.Now()
	buffer := make([]byte, 1500)
	packetCount := 0

	// 设置读取超时（每次读取单独设置）
	deadline := time.Now().Add(duration + 2*time.Second)
	as.rtpConn.SetReadDeadline(deadline)

	for time.Since(startTime) < duration {
		// Check if cancelled
		select {
		case <-ctx.Done():
			logrus.Info("Recording cancelled")
			as.rtpConn.SetReadDeadline(time.Time{}) // Clear timeout
			return
		case <-stopChan:
			logrus.Info("Recording stopped via stop channel")
			as.rtpConn.SetReadDeadline(time.Time{}) // Clear timeout
			return
		default:
		}

		// 动态更新超时
		remaining := duration - time.Since(startTime)
		if remaining > 0 {
			as.rtpConn.SetReadDeadline(time.Now().Add(remaining + 1*time.Second))
		}

		n, receivedAddr, err := as.rtpConn.ReadFromUDP(buffer)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				logrus.WithField("packet_count", packetCount).Info("Recording timeout")
				break
			}
			logrus.WithError(err).Error("Failed to read RTP data")
			continue
		}

		logrus.WithFields(logrus.Fields{
			"from": receivedAddr.String(),
			"size": n,
		}).Debug("Received RTP packet")

		// Check if from target client (allow different ports, as client may use different port to send)
		if !receivedAddr.IP.Equal(addr.IP) {
			logrus.WithFields(logrus.Fields{
				"received": receivedAddr.IP.String(),
				"expected": addr.IP.String(),
			}).Debug("Ignoring packet from different IP")
			continue
		}

		// Parse RTP packet
		packet := &rtp.Packet{}
		if err := packet.Unmarshal(buffer[:n]); err != nil {
			logrus.WithError(err).Error("Failed to parse RTP packet")
			continue
		}

		logrus.WithFields(logrus.Fields{
			"payload_type":    packet.PayloadType,
			"sequence_number": packet.SequenceNumber,
			"timestamp":       packet.Timestamp,
			"payload_size":    len(packet.Payload),
		}).Debug("RTP packet details")

		// Only process PCMU (payload type 0)
		if packet.PayloadType != 0 {
			logrus.WithField("payload_type", packet.PayloadType).Debug("Ignoring non-PCMU packet")
			continue
		}

		packetCount++

		// 解码 μ-law 为 PCM
		for _, mulawByte := range packet.Payload {
			pcm := mulawToLinear(mulawByte)
			pcmData = append(pcmData, pcm)
		}
	}

	as.rtpConn.SetReadDeadline(time.Time{}) // 清除超时

	if len(pcmData) == 0 {
		logrus.WithField("packet_count", packetCount).Warn("Recording failed: no audio data received")
		logrus.Warn("Please ensure client is sending audio data to server")
		return
	}

	logrus.WithFields(logrus.Fields{
		"samples":      len(pcmData),
		"packet_count": packetCount,
	}).Info("Recording completed")

	// Save as WAV file
	if err := saveWAV(filename, pcmData, sampleRate); err != nil {
		logrus.WithError(err).Error("Failed to save WAV file")
		return
	}

	logrus.WithField("filename", filename).Info("Recording saved")
}

// recordAudioContinuous 持续录音（不限制时长，直到收到停止信号）
func (as *SipServer) recordAudioContinuous(clientAddr string, callID string, filename string, ctx context.Context) {
	addr, err := net.ResolveUDPAddr("udp", clientAddr)
	if err != nil {
		logrus.WithError(err).WithField("call_id", callID).Error("Failed to resolve client address")
		return
	}

	logrus.WithFields(logrus.Fields{
		"call_id":  callID,
		"filename": filename,
		"address":  addr.String(),
	}).Info("Starting continuous recording")

	// 创建缓冲区存储 PCM 数据
	var pcmData []int16
	buffer := make([]byte, 1500)
	packetCount := 0
	sampleRate := 8000

	// 设置读取超时（用于定期检查取消信号）
	as.rtpConn.SetReadDeadline(time.Now().Add(1 * time.Second))

	for {
		// 检查是否取消
		select {
		case <-ctx.Done():
			logrus.WithField("call_id", callID).Info("Recording cancelled")
			as.rtpConn.SetReadDeadline(time.Time{}) // Clear timeout
			// 保存录音
			if len(pcmData) > 0 {
				if err := saveWAV(filename, pcmData, sampleRate); err != nil {
					logrus.WithError(err).WithField("call_id", callID).Error("Failed to save WAV file")
				} else {
					logrus.WithFields(logrus.Fields{
						"call_id":      callID,
						"filename":     filename,
						"samples":      len(pcmData),
						"packet_count": packetCount,
					}).Info("Recording saved")
				}
			}
			return
		default:
		}

		// 动态更新超时（用于定期检查取消信号）
		as.rtpConn.SetReadDeadline(time.Now().Add(1 * time.Second))

		n, receivedAddr, err := as.rtpConn.ReadFromUDP(buffer)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				// 超时是正常的，继续循环检查取消信号
				continue
			}
			logrus.WithError(err).WithField("call_id", callID).Error("Failed to read RTP data")
			continue
		}

		// 检查是否来自目标客户端
		if !receivedAddr.IP.Equal(addr.IP) {
			continue
		}

		// 解析 RTP 包
		packet := &rtp.Packet{}
		if err := packet.Unmarshal(buffer[:n]); err != nil {
			logrus.WithError(err).WithField("call_id", callID).Error("Failed to parse RTP packet")
			continue
		}

		// 只处理 PCMU (payload type 0)
		if packet.PayloadType != 0 {
			continue
		}

		packetCount++

		// 解码 μ-law 为 PCM
		for _, mulawByte := range packet.Payload {
			pcm := mulawToLinear(mulawByte)
			pcmData = append(pcmData, pcm)
		}
	}
}

// sendAudioFromFile 从文件发送音频（保留原函数以兼容）
func (as *SipServer) sendAudioFromFile(clientAddr string, filename string, samplesPerPacket int) {
	as.sendAudioFromFileWithContext(clientAddr, filename, samplesPerPacket, context.Background())
}

// sendAudioFromFileWithContext 从文件发送音频（带取消支持）
func (as *SipServer) sendAudioFromFileWithContext(clientAddr string, filename string, samplesPerPacket int, ctx context.Context) {
	// Check if file exists
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		logrus.WithField("filename", filename).Warn("Recording file does not exist, skipping playback")
		return
	}

	// Parse client address
	addr, err := net.ResolveUDPAddr("udp", clientAddr)
	if err != nil {
		logrus.WithError(err).Error("Failed to resolve client address")
		return
	}

	// Read WAV file
	wavData, err := os.ReadFile(filename)
	if err != nil {
		logrus.WithError(err).Error("Failed to read recording file")
		return
	}

	// 查找 data chunk
	dataOffset := 44
	for i := 0; i < len(wavData)-8; i++ {
		if string(wavData[i:i+4]) == "data" {
			dataOffset = i + 8
			break
		}
	}

	audioData := wavData[dataOffset:]
	logrus.WithField("size", len(audioData)).Info("Starting to play recording file")

	// 创建 RTP 包
	packet := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    0,
			SequenceNumber: 0,
			Timestamp:      0,
			SSRC:           12345678,
		},
		Payload: make([]byte, samplesPerPacket),
	}

	sequenceNumber := uint16(0)
	timestamp := uint32(0)

	// 发送音频数据（带取消检查）
	for i := 0; i < len(audioData); i += samplesPerPacket * 2 {
		// Check if cancelled
		select {
		case <-ctx.Done():
			logrus.Info("Audio playback from file cancelled")
			return
		default:
		}

		end := i + samplesPerPacket*2
		if end > len(audioData) {
			end = len(audioData)
		}

		chunk := audioData[i:end]

		// 转换为 μ-law
		payload := make([]byte, samplesPerPacket)
		for j := 0; j < samplesPerPacket && j*2+1 < len(chunk); j++ {
			sample := int16(binary.LittleEndian.Uint16(chunk[j*2 : j*2+2]))
			payload[j] = linearToMulaw(sample)
		}

		if len(chunk) < samplesPerPacket*2 {
			for j := len(chunk) / 2; j < samplesPerPacket; j++ {
				payload[j] = 0xFF
			}
		}

		packet.Header.SequenceNumber = sequenceNumber
		packet.Header.Timestamp = timestamp
		packet.Payload = payload

		packetBytes, err := packet.Marshal()
		if err != nil {
			continue
		}

		_, err = as.rtpConn.WriteToUDP(packetBytes, addr)
		if err != nil {
			logrus.WithError(err).Error("Failed to send RTP packet")
			continue
		}

		sequenceNumber++
		timestamp += uint32(samplesPerPacket)

		// Wait with cancellation check
		select {
		case <-ctx.Done():
			logrus.Info("Audio playback from file cancelled")
			return
		case <-time.After(20 * time.Millisecond):
		}
	}

	logrus.Info("Recording playback completed")
}

// saveWAV 将 PCM 数据保存为 WAV 文件
func saveWAV(filename string, pcmData []int16, sampleRate int) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	// WAV 文件头
	dataSize := uint32(len(pcmData) * 2) // 每个样本 2 字节
	fileSize := 36 + dataSize

	// RIFF 头
	file.WriteString("RIFF")
	binary.Write(file, binary.LittleEndian, uint32(fileSize))
	file.WriteString("WAVE")

	// fmt chunk
	file.WriteString("fmt ")
	binary.Write(file, binary.LittleEndian, uint32(16)) // fmt chunk size
	binary.Write(file, binary.LittleEndian, uint16(1))  // audio format (PCM)
	binary.Write(file, binary.LittleEndian, uint16(1))  // num channels
	binary.Write(file, binary.LittleEndian, uint32(sampleRate))
	binary.Write(file, binary.LittleEndian, uint32(sampleRate*2)) // byte rate
	binary.Write(file, binary.LittleEndian, uint16(2))            // block align
	binary.Write(file, binary.LittleEndian, uint16(16))           // bits per sample

	// data chunk
	file.WriteString("data")
	binary.Write(file, binary.LittleEndian, dataSize)

	// 写入 PCM 数据
	for _, sample := range pcmData {
		binary.Write(file, binary.LittleEndian, sample)
	}

	return nil
}

func (as *SipServer) handleBye(req *sip.Request, tx sip.ServerTransaction) {
	callID := req.CallID().Value()
	logrus.WithFields(logrus.Fields{
		"start_line": req.StartLine(),
		"call_id":    callID,
	}).Info("Received BYE request")

	// 停止 AI 语音会话（如果存在）
	as.stopAIVoiceSession(callID)

	// 清理 AI 会话信息
	as.aiSessionMutex.Lock()
	delete(as.aiSessionInfo, callID)
	as.aiSessionMutex.Unlock()

	// 更新呼出会话状态（如果存在）
	now := time.Now()
	var recordingFile string
	as.outgoingMutex.Lock()
	if session, exists := as.outgoingSessions[callID]; exists {
		if session.Status == "answered" {
			session.Status = "ended"
			session.EndTime = &now
			recordingFile = session.RecordingFile
			logrus.WithField("call_id", callID).Info("Outgoing call ended by remote party")
		}
	}
	as.outgoingMutex.Unlock()

	// 更新数据库状态
	as.updateCallStatusInDB(callID, "ended", &now)

	// 保存录音URL（呼出通话）
	if recordingFile != "" {
		time.Sleep(500 * time.Millisecond)
		as.saveRecordingURL(callID, recordingFile)
	}

	// Clean up pending session
	as.sessionsMutex.Lock()
	if clientRTPAddr, exists := as.pendingSessions[callID]; exists {
		logrus.WithFields(logrus.Fields{
			"call_id":     callID,
			"rtp_address": clientRTPAddr,
		}).Warn("Found pending session when receiving BYE, client may have hung up early")
		delete(as.pendingSessions, callID)
	}
	as.sessionsMutex.Unlock()

	// Clean up active session and stop all operations
	var inboundRecordingFile string
	as.activeMutex.Lock()
	if session, exists := as.activeSessions[callID]; exists {
		logrus.WithField("call_id", callID).Info("Terminating active session")

		// 保存录音文件路径（呼入通话）
		inboundRecordingFile = session.RecordingFile

		// Cancel context to stop all goroutines (这会停止录音)
		if session.CancelFunc != nil {
			session.CancelFunc()
		}

		// Signal stop recording
		select {
		case session.StopRecording <- true:
		default:
		}

		// Close DTMF channel
		close(session.DTMFChannel)

		// Remove from active sessions
		delete(as.activeSessions, callID)
		logrus.WithField("call_id", callID).Info("Active session terminated and cleaned up")
	}
	as.activeMutex.Unlock()

	// 等待一小段时间确保录音已保存（呼入通话）
	if inboundRecordingFile != "" {
		time.Sleep(500 * time.Millisecond)
		// 生成录音URL并保存到数据库
		as.saveRecordingURL(callID, inboundRecordingFile)
	}

	// Return 200 OK
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send BYE response")
		return
	}

	logrus.Info("BYE 200 OK response sent")
}

func (as *SipServer) handleCancel(req *sip.Request, tx sip.ServerTransaction) {
	callID := req.CallID().Value()
	logrus.WithFields(logrus.Fields{
		"start_line": req.StartLine(),
		"call_id":    callID,
	}).Info("Received CANCEL request")

	// Clean up pending session (CANCEL is sent before ACK)
	as.sessionsMutex.Lock()
	if clientRTPAddr, exists := as.pendingSessions[callID]; exists {
		logrus.WithFields(logrus.Fields{
			"call_id":     callID,
			"rtp_address": clientRTPAddr,
		}).Warn("Found pending session when receiving CANCEL, call was cancelled before ACK")
		delete(as.pendingSessions, callID)
	}
	as.sessionsMutex.Unlock()

	// Also check active sessions (in case ACK was already received)
	as.activeMutex.Lock()
	if session, exists := as.activeSessions[callID]; exists {
		logrus.WithField("call_id", callID).Info("Terminating active session due to CANCEL")

		// Cancel context to stop all goroutines
		if session.CancelFunc != nil {
			session.CancelFunc()
		}

		// Signal stop recording
		select {
		case session.StopRecording <- true:
		default:
		}

		// Close DTMF channel
		close(session.DTMFChannel)

		// Remove from active sessions
		delete(as.activeSessions, callID)
		logrus.WithField("call_id", callID).Info("Active session terminated due to CANCEL")
	}
	as.activeMutex.Unlock()

	// Return 200 OK for CANCEL
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send CANCEL response")
		return
	}

	logrus.Info("CANCEL 200 OK response sent")
}

func (as *SipServer) handlePublish(req *sip.Request, tx sip.ServerTransaction) {
	logrus.WithField("start_line", req.StartLine()).Info("Received PUBLISH request")

	// Return 200 OK (accept PUBLISH request)
	res := sip.NewResponseFromRequest(req, sip.StatusOK, "OK", nil)
	if err := tx.Respond(res); err != nil {
		logrus.WithError(err).Error("Failed to send PUBLISH response")
		return
	}

	logrus.Info("PUBLISH 200 OK response sent")
}

func (as *SipServer) handleNoRoute(req *sip.Request, tx sip.ServerTransaction) {
	logrus.WithFields(logrus.Fields{
		"start_line": req.StartLine(),
		"method":     req.Method,
		"call_id":    req.CallID().Value(),
	}).Info("Received unmatched request")

	// If it's an ACK request but wasn't caught by OnAck, handle it manually
	if req.IsAck() {
		logrus.Info("Detected ACK request (via NoRoute), attempting to handle...")
		as.handleAck(req, tx)
		return
	}

	// For other unmatched requests, return 501 Not Implemented
	res := sip.NewResponseFromRequest(req, sip.StatusNotImplemented, "Not Implemented", nil)
	tx.Respond(res)
}
