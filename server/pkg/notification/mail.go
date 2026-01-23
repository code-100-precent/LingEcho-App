package notification

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"

	"github.com/code-100-precent/LingEcho"
)

// MailConfig email configuration
type MailConfig struct {
	Host     string `json:"host"`     // SMTP server address
	Port     int64  `json:"port"`     // SMTP server port
	Username string `json:"username"` // SMTP username
	Password string `json:"password"` // SMTP password
	From     string `json:"from"`     // Sender email address
}

// MailNotification email notification service
type MailNotification struct {
	Config MailConfig
}

// NewMailNotification creates email notification instance
func NewMailNotification(config MailConfig) *MailNotification {
	return &MailNotification{Config: config}
}

// Send sends email
func (m *MailNotification) Send(to, subject, body string) error {
	// Email content
	msg := fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", to, subject, body)

	// SMTP authentication
	auth := smtp.PlainAuth("", m.Config.Username, m.Config.Password, m.Config.Host)

	// Configure TLS
	tlsConfig := &tls.Config{
		ServerName:         m.Config.Host, // Server name
		InsecureSkipVerify: false,         // Don't skip certificate verification
	}

	// Connect to SMTP server
	addr := fmt.Sprintf("%s:%d", m.Config.Host, m.Config.Port)
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to dial SMTP server: %v", err)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, m.Config.Host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %v", err)
	}
	defer client.Close()

	// Authentication
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("failed to authenticate: %v", err)
	}

	// Set sender and recipient
	if err = client.Mail(m.Config.From); err != nil {
		return fmt.Errorf("failed to set sender: %v", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %v", err)
	}

	// Send email content
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to prepare data: %v", err)
	}
	defer w.Close()

	_, err = w.Write([]byte(msg))
	if err != nil {
		return fmt.Errorf("failed to write email content: %v", err)
	}

	return nil
}

func (m *MailNotification) SendHTML(to, subject, htmlBody string) error {
	msg := "MIME-Version: 1.0\r\n"
	msg += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
	msg += fmt.Sprintf("From: %s\r\n", m.Config.From)
	msg += fmt.Sprintf("To: %s\r\n", to)
	msg += fmt.Sprintf("Subject: %s\r\n", subject)
	msg += "\r\n" + htmlBody

	addr := fmt.Sprintf("%s:%d", m.Config.Host, m.Config.Port)

	auth := smtp.PlainAuth("", m.Config.Username, m.Config.Password, m.Config.Host)

	// smtp.SendMail doesn't support 465 (SSL), can only send to STARTTLS services, or use third-party libraries
	return smtp.SendMail(addr, auth, m.Config.From, []string{to}, []byte(msg))
}

// SendHTML sends an HTML email using the embedded welcome template
func (m *MailNotification) SendWelcomeEmail(to string, username string, verifyURL string) error {
	// Parse the embedded template
	tmpl, err := template.New("welcome").Parse(LingEcho.WelcomeHTML)
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}

	data := struct {
		Username  string
		VerifyURL string
	}{
		Username:  username,
		VerifyURL: verifyURL,
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render email body: %w", err)
	}

	// Build MIME email message
	msg := "MIME-Version: 1.0\r\n"
	msg += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
	msg += fmt.Sprintf("From: %s\r\n", m.Config.From)
	msg += fmt.Sprintf("To: %s\r\n", to)
	msg += fmt.Sprintf("Subject: %s\r\n", "Welcome to Join LingEcho！")
	msg += "\r\n" + body.String()

	// Zoho SMTP uses SSL (port 465), but net/smtp only supports STARTTLS (usually port 587)
	addr := fmt.Sprintf("%s:%d", m.Config.Host, m.Config.Port)
	auth := smtp.PlainAuth("", m.Config.Username, m.Config.Password, m.Config.Host)

	return smtp.SendMail(addr, auth, m.Config.From, []string{to}, []byte(msg))
}

func (m *MailNotification) SendVerificationCode(to, code string) error {
	tmpl, err := template.New("verification").Parse(LingEcho.VerificationHTML)
	if err != nil {
		return fmt.Errorf("failed to parse verification template: %w", err)
	}
	data := struct {
		Code string
	}{
		Code: code,
	}
	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render verification email: %w", err)
	}

	msg := "MIME-Version: 1.0\r\n"
	msg += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
	msg += fmt.Sprintf("From: %s\r\n", m.Config.From)
	msg += fmt.Sprintf("To: %s\r\n", to)
	msg += fmt.Sprintf("Subject: %s\r\n", "Your LingEcho Verification Code")
	msg += "\r\n" + body.String()

	addr := fmt.Sprintf("%s:%d", m.Config.Host, m.Config.Port)
	auth := smtp.PlainAuth("", m.Config.Username, m.Config.Password, m.Config.Host)

	return smtp.SendMail(addr, auth, m.Config.From, []string{to}, []byte(msg))
}

// SendVerificationEmail sends email verification email
func (m *MailNotification) SendVerificationEmail(to, username, verifyURL string) error {
	// Use embedded template
	tmpl, err := template.New("email_verification").Parse(LingEcho.EmailVerificationHTML)
	if err != nil {
		return fmt.Errorf("failed to parse email verification template: %w", err)
	}

	data := struct {
		Username  string
		VerifyURL string
	}{
		Username:  username,
		VerifyURL: verifyURL,
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render email verification body: %w", err)
	}

	return m.SendHTML(to, "请验证您的邮箱地址", body.String())
}

// SendPasswordResetEmail sends password reset email
func (m *MailNotification) SendPasswordResetEmail(to, username, resetURL string) error {
	// Use embedded template
	tmpl, err := template.New("password_reset").Parse(LingEcho.PasswordResetHTML)
	if err != nil {
		return fmt.Errorf("failed to parse password reset template: %w", err)
	}

	data := struct {
		Username string
		ResetURL string
	}{
		Username: username,
		ResetURL: resetURL,
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render password reset body: %w", err)
	}

	return m.SendHTML(to, "密码重置请求", body.String())
}

// SendDeviceVerificationCode sends device verification code email
func (m *MailNotification) SendDeviceVerificationCode(to, username, code, deviceID string) error {
	// Use embedded template
	tmpl, err := template.New("device_verification").Parse(LingEcho.DeviceVerificationHTML)
	if err != nil {
		return fmt.Errorf("failed to parse device verification template: %w", err)
	}

	data := struct {
		Username string
		Code     string
		DeviceID string
	}{
		Username: username,
		Code:     code,
		DeviceID: deviceID,
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render device verification body: %w", err)
	}

	return m.SendHTML(to, "设备验证码", body.String())
}

// SendGroupInvitationEmail sends organization invitation email
func (m *MailNotification) SendGroupInvitationEmail(to, inviteeName, inviterName, groupName, groupType, groupDescription, acceptURL string) error {
	// Parse the embedded template
	tmpl, err := template.New("group_invitation").Parse(LingEcho.GroupInvitationHTML)
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}

	data := struct {
		InviteeName      string
		InviterName      string
		GroupName        string
		GroupType        string
		GroupDescription string
		AcceptURL        string
	}{
		InviteeName:      inviteeName,
		InviterName:      inviterName,
		GroupName:        groupName,
		GroupType:        groupType,
		GroupDescription: groupDescription,
		AcceptURL:        acceptURL,
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render email body: %w", err)
	}

	// Build MIME email message
	msg := "MIME-Version: 1.0\r\n"
	msg += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
	msg += fmt.Sprintf("From: %s\r\n", m.Config.From)
	msg += fmt.Sprintf("To: %s\r\n", to)
	msg += fmt.Sprintf("Subject: %s\r\n", fmt.Sprintf("您收到了来自 %s 的组织邀请", inviterName))
	msg += "\r\n" + body.String()

	addr := fmt.Sprintf("%s:%d", m.Config.Host, m.Config.Port)
	auth := smtp.PlainAuth("", m.Config.Username, m.Config.Password, m.Config.Host)

	return smtp.SendMail(addr, auth, m.Config.From, []string{to}, []byte(msg))
}

// SendNewDeviceLoginAlert sends new device login alert email
func (m *MailNotification) SendNewDeviceLoginAlert(to, username, loginTime, ipAddress, location, deviceType, os, browser string, isSuspicious bool, securityURL, changePasswordURL string) error {
	// Use embedded template
	tmpl, err := template.New("new_device_login").Parse(LingEcho.NewDeviceLoginHTML)
	if err != nil {
		return fmt.Errorf("failed to parse new device login template: %w", err)
	}

	data := struct {
		Username          string
		LoginTime         string
		IPAddress         string
		Location          string
		DeviceType        string
		OS                string
		Browser           string
		IsSuspicious      bool
		SecurityURL       string
		ChangePasswordURL string
	}{
		Username:          username,
		LoginTime:         loginTime,
		IPAddress:         ipAddress,
		Location:          location,
		DeviceType:        deviceType,
		OS:                os,
		Browser:           browser,
		IsSuspicious:      isSuspicious,
		SecurityURL:       securityURL,
		ChangePasswordURL: changePasswordURL,
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render new device login body: %w", err)
	}

	subject := "新设备登录提醒"
	if isSuspicious {
		subject = "⚠️ 可疑登录警告"
	}

	return m.SendHTML(to, subject, body.String())
}
