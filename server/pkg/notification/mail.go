package notification

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"

	"github.com/code-100-precent/LingEcho"
)

// MailConfig 邮件配置
type MailConfig struct {
	Host     string `json:"host"`     // SMTP 服务器地址
	Port     int64  `json:"port"`     // SMTP 服务器端口
	Username string `json:"username"` // SMTP 用户名
	Password string `json:"password"` // SMTP 密码
	From     string `json:"from"`     // 发件人邮箱
}

// MailNotification 邮件通知
type MailNotification struct {
	Config MailConfig
}

// NewMailNotification 创建邮件通知实例
func NewMailNotification(config MailConfig) *MailNotification {
	return &MailNotification{Config: config}
}

// Send 发送邮件
func (m *MailNotification) Send(to, subject, body string) error {
	// 邮件内容
	msg := fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", to, subject, body)

	// SMTP 认证
	auth := smtp.PlainAuth("", m.Config.Username, m.Config.Password, m.Config.Host)

	// 配置 TLS
	tlsConfig := &tls.Config{
		ServerName:         m.Config.Host, // 服务器名称
		InsecureSkipVerify: false,         // 不跳过证书验证
	}

	// 连接 SMTP 服务器
	addr := fmt.Sprintf("%s:%d", m.Config.Host, m.Config.Port)
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to dial SMTP server: %v", err)
	}
	defer conn.Close()

	// 创建 SMTP 客户端
	client, err := smtp.NewClient(conn, m.Config.Host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %v", err)
	}
	defer client.Close()

	// 认证
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("failed to authenticate: %v", err)
	}

	// 设置发件人和收件人
	if err = client.Mail(m.Config.From); err != nil {
		return fmt.Errorf("failed to set sender: %v", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %v", err)
	}

	// 发送邮件内容
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

	// smtp.SendMail 不支持 465（SSL），只能发给 STARTTLS 服务，或使用第三方库
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

// SendVerificationEmail 发送邮箱验证邮件
func (m *MailNotification) SendVerificationEmail(to, username, verifyURL string) error {
	// 使用简单的HTML模板
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>邮箱验证</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>邮箱验证</h1>
        </div>
        <div class="content">
            <p>亲爱的 %s，</p>
            <p>感谢您注册我们的服务！请点击下面的按钮验证您的邮箱地址：</p>
            <p style="text-align: center;">
                <a href="%s" class="button">验证邮箱</a>
            </p>
            <p>如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">%s</p>
            <p>此链接将在24小时后过期。</p>
        </div>
        <div class="footer">
            <p>如果您没有注册此服务，请忽略此邮件。</p>
        </div>
    </div>
</body>
</html>`, username, verifyURL, verifyURL)

	return m.SendHTML(to, "请验证您的邮箱地址", htmlBody)
}

// SendPasswordResetEmail 发送密码重置邮件
func (m *MailNotification) SendPasswordResetEmail(to, username, resetURL string) error {
	// 使用简单的HTML模板
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>密码重置</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e9ecef; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>密码重置</h1>
        </div>
        <div class="content">
            <p>亲爱的 %s，</p>
            <p>我们收到了您的密码重置请求。请点击下面的按钮重置您的密码：</p>
            <p style="text-align: center;">
                <a href="%s" class="button">重置密码</a>
            </p>
            <p>如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">%s</p>
            <div class="warning">
                <strong>安全提醒：</strong>
                <ul>
                    <li>此链接将在24小时后过期</li>
                    <li>如果您没有请求重置密码，请忽略此邮件</li>
                    <li>为了您的账户安全，请不要将重置链接分享给他人</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>如果您没有请求密码重置，请忽略此邮件。</p>
        </div>
    </div>
</body>
</html>`, username, resetURL, resetURL)

	return m.SendHTML(to, "密码重置请求", htmlBody)
}

// SendGroupInvitationEmail 发送组织邀请邮件
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
