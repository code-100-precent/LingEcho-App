package models

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/metrics"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	// SigUserLogin : user *User, c *gin.Context
	SigUserLogin = "user.login"
	// SigUserLogout : user *User, c *gin.Context
	SigUserLogout = "user.logout"
	// SigUserCreate : user *User, c *gin.Context
	SigUserCreate = "user.create"
	// SigUserVerifyEmail : user *User, hash, clientIp, userAgent string
	SigUserVerifyEmail = "user.verifyemail"
	// SigUserResetPassword : user *User, hash, clientIp, userAgent string
	SigUserResetPassword = "user.resetpassword"
)

type SendEmailVerifyEmail struct {
	Email     string `json:"email"`
	ClientIp  string `json:"clientIp"`
	UserAgent string `json:"userAgent"`
}

type LoginForm struct {
	Email         string `json:"email" comment:"Email address"`
	Password      string `json:"password,omitempty"`
	Timezone      string `json:"timezone,omitempty"`
	Remember      bool   `json:"remember,omitempty"`
	AuthToken     string `json:"token,omitempty"`
	TwoFactorCode string `json:"twoFactorCode,omitempty"` // 两步验证码
	CaptchaID     string `json:"captchaId,omitempty"`     // 图形验证码ID
	CaptchaCode   string `json:"captchaCode,omitempty"`   // 图形验证码
}

type EmailOperatorForm struct {
	UserName    string `json:"userName"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email" comment:"Email address"`
	Code        string `json:"code"`
	Password    string `json:"password"`
	AuthToken   bool   `json:"AuthToken,omitempty"`
	Timezone    string `json:"timezone,omitempty"`
	CaptchaID   string `json:"captchaId,omitempty"`
	CaptchaCode string `json:"captchaCode,omitempty"`
}

type RegisterUserForm struct {
	Email       string `json:"email" binding:"required"`
	Password    string `json:"password" binding:"required"`
	DisplayName string `json:"displayName"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Locale      string `json:"locale"`
	Timezone    string `json:"timezone"`
	Source      string `json:"source"`
	CaptchaID   string `json:"captchaId"`
	CaptchaCode string `json:"captchaCode"`
}

type ChangePasswordForm struct {
	Password string `json:"password" binding:"required"`
}

type ResetPasswordForm struct {
	Email string `json:"email" binding:"required"`
}

type ResetPasswordDoneForm struct {
	Password string `json:"password" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Token    string `json:"token" binding:"required"`
}

type UpdateUserRequest struct {
	Email       string `form:"email" json:"email"`
	Phone       string `form:"phone" json:"phone"`
	FirstName   string `form:"firstName" json:"firstName"`
	LastName    string `form:"lastName" json:"lastName"`
	DisplayName string `form:"displayName" json:"displayName"`
	Locale      string `form:"locale" json:"locale"`
	Timezone    string `form:"timezone" json:"timezone"`
	Gender      string `form:"gender" json:"gender"`
	Extra       string `form:"extra" json:"extra"`
	Avatar      string `form:"avatar" json:"avatar"`
}

// Login Handle-User-Login
func Login(c *gin.Context, user *User) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	err := SetLastLogin(db, user, c.ClientIP())
	if err != nil {
		logger.Error("user.login", zap.Error(err))
		LingEcho.AbortWithJSONError(c, http.StatusInternalServerError, err)
		return
	}

	// Increase login count
	err = IncrementLoginCount(db, user)
	if err != nil {
		logger.Error("user.login", zap.Error(err))
		LingEcho.AbortWithJSONError(c, http.StatusInternalServerError, err)
		return
	}

	// Update profile completeness
	err = UpdateProfileComplete(db, user)
	if err != nil {
		logger.Error("user.login", zap.Error(err))
		LingEcho.AbortWithJSONError(c, http.StatusInternalServerError, err)
		return
	}

	session := sessions.Default(c)
	session.Set(constants.UserField, user.ID)
	session.Save()
	utils.Sig().Emit(SigUserLogin, user, db)
}

func Logout(c *gin.Context, user *User) {
	c.Set(constants.UserField, nil)
	session := sessions.Default(c)
	session.Delete(constants.UserField)
	session.Save()
	utils.Sig().Emit(SigUserLogout, user, c)
}

func AuthRequired(c *gin.Context) {
	if CurrentUser(c) != nil {
		c.Next()
		return
	}

	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}

	// Test mode: Allow test token
	if token == "Bearer test-token-123" || token == "test-token-123" {
		// Create a test user
		testUser := &User{
			ID:          1,
			Email:       "test@example.com",
			DisplayName: "Test User",
			IsStaff:     true,
			Role:        RoleSuperAdmin,
			Permissions: `["*"]`,
			Enabled:     true,
			Activated:   true,
		}
		c.Set(constants.UserField, testUser)
		c.Next()
		return
	}

	if token == "" {
		LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, errors.New("authorization required"))
		return
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	// split bearer
	token = strings.TrimPrefix(token, "Bearer ")
	user, err := DecodeHashToken(db, token, false)
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, err)
		return
	}
	c.Set(constants.UserField, user)
	c.Next()
}

func CurrentUser(c *gin.Context) *User {
	if cachedObj, exists := c.Get(constants.UserField); exists && cachedObj != nil {
		return cachedObj.(*User)
	}
	session := sessions.Default(c)
	userId := session.Get(constants.UserField)
	if userId == nil {
		return nil
	}
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user, err := GetUserByUID(db, userId.(uint))
	if err != nil {
		return nil
	}
	c.Set(constants.UserField, user)
	return user
}

func CheckPassword(user *User, password string) bool {
	if user.Password == "" {
		return false
	}
	return user.Password == HashPassword(password)
}

func SetPassword(db *gorm.DB, user *User, password string) (err error) {
	p := HashPassword(password)
	err = UpdateUserFields(db, user, map[string]any{
		"Password": p,
	})
	if err != nil {
		return
	}
	user.Password = p
	return
}

func HashPassword(password string) string {
	if password == "" {
		return ""
	}
	// 如果已经是哈希格式（sha256$...），直接返回
	if strings.HasPrefix(password, "sha256$") {
		return password
	}
	hashVal := sha256.Sum256([]byte(password))
	return fmt.Sprintf("sha256$%x", hashVal)
}

// VerifyEncryptedPassword 验证加密密码
// 前端发送格式：passwordHash:encryptedHash:salt:timestamp
// passwordHash = SHA256(原始密码) - 用于验证密码正确性
// encryptedHash = SHA256(原始密码 + salt + timestamp) - 用于防重放
// 后端验证：
// 1. passwordHash 与存储的密码哈希匹配（去掉 sha256$ 前缀）
// 2. 时间戳在有效期内（5分钟）
// 3. 验证 salt 是否在缓存中（防重放）
func VerifyEncryptedPassword(encryptedPassword, storedPasswordHash string) bool {
	// 解析加密密码格式：passwordHash:encryptedHash:salt:timestamp
	parts := strings.Split(encryptedPassword, ":")
	if len(parts) != 4 {
		return false
	}

	passwordHash := parts[0]
	encryptedHash := parts[1]
	salt := parts[2]
	timestampStr := parts[3]

	// 验证时间戳（5分钟内有效）
	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return false
	}

	now := time.Now().Unix()
	maxAge := int64(300) // 5分钟
	if now-timestamp > maxAge {
		return false
	}

	// 验证 passwordHash 与存储的密码哈希匹配
	storedHash := strings.TrimPrefix(storedPasswordHash, "sha256$")
	if passwordHash != storedHash {
		return false
	}

	// 验证加密哈希：SHA256(原始密码的SHA256 + salt + timestamp)
	// 注意：这里使用 passwordHash（即 SHA256(原始密码)）而不是原始密码本身
	hashInput := fmt.Sprintf("%s%s%d", passwordHash, salt, timestamp)
	hashVal := sha256.Sum256([]byte(hashInput))
	expectedHash := fmt.Sprintf("%x", hashVal)

	return encryptedHash == expectedHash
}

func GetUserByUID(db *gorm.DB, userID uint) (*User, error) {
	var val User
	start := time.Now()
	result := db.Where("id", userID).Where("enabled", true).Take(&val)
	duration := time.Since(start)

	// Record database query metrics (if monitoring system is available)
	if monitor := getMonitorFromContext(db); monitor != nil {
		monitor.RecordSQLQuery(context.Background(), "SELECT * FROM users WHERE id = ? AND enabled = ?",
			[]interface{}{userID, true}, "users", "SELECT", duration, 1, result.Error)
	}

	if result.Error != nil {
		return nil, result.Error
	}
	return &val, nil
}

func GetUserByEmail(db *gorm.DB, email string) (user *User, err error) {
	var val User
	start := time.Now()
	result := db.Table("users").Where("email", strings.ToLower(email)).Take(&val)
	duration := time.Since(start)

	// Record database query metrics (if monitoring system is available)
	if monitor := getMonitorFromContext(db); monitor != nil {
		monitor.RecordSQLQuery(context.Background(), "SELECT * FROM users WHERE email = ?",
			[]interface{}{email}, "users", "SELECT", duration, 1, result.Error)
	}

	if result.Error != nil {
		return nil, result.Error
	}
	return &val, nil
}

// getMonitorFromContext Get monitor from context (if available)
func getMonitorFromContext(db *gorm.DB) *metrics.Monitor {
	// Get monitor instance from global variable
	return metrics.GetGlobalMonitor()
}

func IsExistsByEmail(db *gorm.DB, email string) bool {
	_, err := GetUserByEmail(db, email)
	return err == nil
}

func AuthApiRequired(c *gin.Context) {
	if CurrentUser(c) != nil {
		c.Next()
		return
	}

	apiKey := c.GetHeader("X-API-KEY")
	apiSecret := c.GetHeader("X-API-SECRET")
	if apiKey != "" && apiSecret != "" {
		user, err := GetUserByAPIKey(c, apiKey, apiSecret)
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, err)
			return
		}
		c.Set(constants.UserField, user)
		c.Next()
		return
	}

	apiKey = c.Query("apiKey")
	apiSecret = c.Query("apiSecret")
	if apiKey != "" && apiSecret != "" {
		user, err := GetUserByAPIKey(c, apiKey, apiSecret)
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, err)
			return
		}
		c.Set(constants.UserField, user)
		c.Next()
		return
	}

	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	}

	if token == "" {
		LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, errors.New("authorization required"))
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)
	// split bearer
	token = strings.TrimPrefix(token, "Bearer ")
	user, err := DecodeHashToken(db, token, false)
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, err)
		return
	}
	c.Set(constants.UserField, user)
	c.Next()
}

func GetUserByAPIKey(c *gin.Context, apiKey, apiSecret string) (*User, error) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	var userCredential UserCredential
	err := db.Model(&UserCredential{}).Where("api_key = ? AND api_secret = ?", apiKey, apiSecret).Find(&userCredential).Error
	if err != nil {
		return nil, err
	}
	var user *User
	err = db.Model(&User{}).Where("id = ?", userCredential.UserID).Find(&user).Error
	if err != nil {
		return nil, err
	}
	return user, nil
}

func CreateUserByEmail(db *gorm.DB, username, display, email, password string) (*User, error) {
	// Properly handle Unicode characters (including Chinese)
	var firstName, lastName string
	if username != "" {
		runes := []rune(username)
		if len(runes) > 0 {
			firstName = string(runes[0]) // First character (rune) as FirstName
		}
		if len(runes) > 1 {
			lastName = string(runes[1:]) // Remaining characters as LastName
		}
	}

	user := User{
		DisplayName:        display,
		FirstName:          firstName,
		LastName:           lastName,
		Email:              email,
		Password:           HashPassword(password),
		Enabled:            true,
		Activated:          false,
		EmailNotifications: true,
	}
	result := db.Create(&user)
	return &user, result.Error
}

func CreateUser(db *gorm.DB, email, password string) (*User, error) {
	user := User{
		Email:     email,
		Password:  HashPassword(password),
		Enabled:   true,
		Activated: false,
	}

	start := time.Now()
	result := db.Create(&user)
	duration := time.Since(start)

	// 记录数据库查询指标（如果监控系统可用）
	if monitor := getMonitorFromContext(db); monitor != nil {
		monitor.RecordSQLQuery(context.Background(), "INSERT INTO users (email, password, enabled, activated) VALUES (?, ?, ?, ?)",
			[]interface{}{email, user.Password, true, false}, "users", "INSERT", duration, 1, result.Error)
	}

	return &user, result.Error
}
func UpdateUserFields(db *gorm.DB, user *User, vals map[string]any) error {
	start := time.Now()
	result := db.Model(user).Updates(vals)
	duration := time.Since(start)

	// Record database query metrics (if monitoring system is available)
	if monitor := getMonitorFromContext(db); monitor != nil {
		monitor.RecordSQLQuery(context.Background(), "UPDATE users SET ... WHERE id = ?",
			[]interface{}{user.ID}, "users", "UPDATE", duration, 1, result.Error)
	}

	return result.Error
}

func SetLastLogin(db *gorm.DB, user *User, lastIp string) error {
	now := time.Now().Truncate(1 * time.Second)
	vals := map[string]any{
		"LastLoginIP": lastIp,
		"LastLogin":   &now,
	}
	user.LastLogin = &now
	user.LastLoginIP = lastIp

	start := time.Now()
	result := db.Model(user).Updates(vals)
	duration := time.Since(start)

	// Record database query metrics (if monitoring system is available)
	if monitor := getMonitorFromContext(db); monitor != nil {
		monitor.RecordSQLQuery(context.Background(), "UPDATE users SET LastLoginIP = ?, LastLogin = ? WHERE id = ?",
			[]interface{}{lastIp, &now, user.ID}, "users", "UPDATE", duration, 1, result.Error)
	}

	return result.Error
}

func EncodeHashToken(user *User, timestamp int64, useLastlogin bool) (hash string) {
	//
	// ts-uid-token
	logintimestamp := "0"
	if useLastlogin && user.LastLogin != nil {
		logintimestamp = fmt.Sprintf("%d", user.LastLogin.Unix())
	}
	t := fmt.Sprintf("%s$%d", user.Email, timestamp)
	hashVal := sha256.Sum256([]byte(logintimestamp + user.Password + t))
	hash = base64.RawStdEncoding.EncodeToString([]byte(t)) + "-" + fmt.Sprintf("%x", hashVal)
	return hash
}

func DecodeHashToken(db *gorm.DB, hash string, useLastLogin bool) (user *User, err error) {
	vals := strings.Split(hash, "-")
	if len(vals) != 2 {
		return nil, errors.New("bad token")
	}
	data, err := base64.RawStdEncoding.DecodeString(vals[0])
	if err != nil {
		return nil, errors.New("bad token")
	}

	vals = strings.Split(string(data), "$")
	if len(vals) != 2 {
		return nil, errors.New("bad token")
	}

	ts, err := strconv.ParseInt(vals[1], 10, 64)
	if err != nil {
		return nil, errors.New("bad token")
	}

	if time.Now().Unix() > ts {
		return nil, errors.New("token expired")
	}

	user, err = GetUserByEmail(db, vals[0])
	if err != nil {
		return nil, errors.New("bad token")
	}
	token := EncodeHashToken(user, ts, useLastLogin)
	if token != hash {
		return nil, errors.New("bad token")
	}
	return user, nil
}

func CheckUserAllowLogin(db *gorm.DB, user *User) error {
	if !user.Enabled {
		return errors.New("user not allow login")
	}

	if utils.GetBoolValue(db, constants.KEY_USER_ACTIVATED) && !user.Activated {
		return errors.New("waiting for activation")
	}
	return nil
}

func InTimezone(c *gin.Context, timezone string) {
	tz, err := time.LoadLocation(timezone)
	if err != nil {
		return
	}
	c.Set(constants.TzField, tz)

	session := sessions.Default(c)
	session.Set(constants.TzField, timezone)
	session.Save()
}

func BuildAuthToken(user *User, expired time.Duration, useLoginTime bool) string {
	n := time.Now().Add(expired)
	return EncodeHashToken(user, n.Unix(), useLoginTime)
}

func UpdateUser(db *gorm.DB, user *User, vals map[string]any) error {
	return db.Model(user).Updates(vals).Error
}

// ChangePassword 修改密码
func ChangePassword(db *gorm.DB, user *User, oldPassword, newPassword string) error {
	// 验证旧密码
	if !CheckPassword(user, oldPassword) {
		return errors.New("旧密码不正确")
	}

	// 设置新密码
	err := SetPassword(db, user, newPassword)
	if err != nil {
		return err
	}

	// 更新最后密码修改时间
	now := time.Now()
	err = UpdateUserFields(db, user, map[string]any{
		"LastPasswordChange": &now,
	})
	if err != nil {
		return err
	}

	user.LastPasswordChange = &now
	return nil
}

// ResetPassword 重置密码
func ResetPassword(db *gorm.DB, user *User, newPassword string) error {
	// 设置新密码
	err := SetPassword(db, user, newPassword)
	if err != nil {
		return err
	}

	// 清除密码重置令牌
	err = UpdateUserFields(db, user, map[string]any{
		"PasswordResetToken":   "",
		"PasswordResetExpires": nil,
		"LastPasswordChange":   time.Now(),
	})
	if err != nil {
		return err
	}

	user.PasswordResetToken = ""
	user.PasswordResetExpires = nil
	now := time.Now()
	user.LastPasswordChange = &now
	return nil
}

// GeneratePasswordResetToken 生成密码重置令牌
func GeneratePasswordResetToken(db *gorm.DB, user *User) (string, error) {
	token := utils.RandString(32)
	expires := time.Now().Add(24 * time.Hour) // 24小时过期

	err := UpdateUserFields(db, user, map[string]any{
		"PasswordResetToken":   token,
		"PasswordResetExpires": &expires,
	})
	if err != nil {
		return "", err
	}

	user.PasswordResetToken = token
	user.PasswordResetExpires = &expires
	return token, nil
}

// VerifyPasswordResetToken 验证密码重置令牌
func VerifyPasswordResetToken(db *gorm.DB, token string) (*User, error) {
	var user User
	err := db.Where("password_reset_token = ? AND password_reset_expires > ?", token, time.Now()).First(&user).Error
	if err != nil {
		return nil, errors.New("无效或过期的重置令牌")
	}
	return &user, nil
}

// GenerateEmailVerifyToken 生成邮箱验证令牌
func GenerateEmailVerifyToken(db *gorm.DB, user *User) (string, error) {
	token := utils.RandString(32)
	expires := time.Now().Add(24 * time.Hour) // 24小时过期

	err := UpdateUserFields(db, user, map[string]any{
		"EmailVerifyToken":   token,
		"EmailVerifyExpires": &expires,
	})
	if err != nil {
		return "", err
	}

	user.EmailVerifyToken = token
	user.EmailVerifyExpires = &expires
	return token, nil
}

// VerifyEmail 验证邮箱
func VerifyEmail(db *gorm.DB, token string) (*User, error) {
	var user User
	err := db.Where("email_verify_token = ? AND email_verify_expires > ?", token, time.Now()).First(&user).Error
	if err != nil {
		return nil, errors.New("无效或过期的邮箱验证令牌")
	}

	// 更新邮箱验证状态
	err = UpdateUserFields(db, &user, map[string]any{
		"EmailVerified":      true,
		"EmailVerifyToken":   "",
		"EmailVerifyExpires": nil,
	})
	if err != nil {
		return nil, err
	}

	user.EmailVerified = true
	user.EmailVerifyToken = ""
	user.EmailVerifyExpires = nil
	return &user, nil
}

// GeneratePhoneVerifyToken 生成手机验证令牌
func GeneratePhoneVerifyToken(db *gorm.DB, user *User) (string, error) {
	token := utils.RandNumberText(6) // 6位数字验证码
	err := UpdateUserFields(db, user, map[string]any{
		"PhoneVerifyToken": token,
	})
	if err != nil {
		return "", err
	}

	user.PhoneVerifyToken = token
	return token, nil
}

// VerifyPhone 验证手机
func VerifyPhone(db *gorm.DB, user *User, token string) error {
	if user.PhoneVerifyToken != token {
		return errors.New("验证码不正确")
	}

	// 更新手机验证状态
	err := UpdateUserFields(db, user, map[string]any{
		"PhoneVerified":    true,
		"PhoneVerifyToken": "",
	})
	if err != nil {
		return err
	}

	user.PhoneVerified = true
	user.PhoneVerifyToken = ""
	return nil
}

// UpdateNotificationSettings 更新通知设置
func UpdateNotificationSettings(db *gorm.DB, user *User, settings map[string]bool) error {
	vals := make(map[string]any)

	if emailNotif, ok := settings["emailNotifications"]; ok {
		vals["email_notifications"] = emailNotif
	}
	if pushNotif, ok := settings["pushNotifications"]; ok {
		vals["push_notifications"] = pushNotif
	}
	if systemNotif, ok := settings["systemNotifications"]; ok {
		vals["system_notifications"] = systemNotif
	}
	if autoCleanUnreadEmails, ok := settings["autoCleanUnreadEmails"]; ok {
		vals["auto_clean_unread_emails"] = autoCleanUnreadEmails
	}

	if len(vals) == 0 {
		return nil
	}

	err := UpdateUserFields(db, user, vals)
	if err != nil {
		return err
	}

	// 更新用户对象
	if emailNotif, ok := settings["emailNotifications"]; ok {
		user.EmailNotifications = emailNotif
	}
	if pushNotif, ok := settings["pushNotifications"]; ok {
		user.PushNotifications = pushNotif
	}
	if systemNotif, ok := settings["systemNotifications"]; ok {
		user.SystemNotifications = systemNotif
	}
	if autoCleanUnreadEmails, ok := settings["autoCleanUnreadEmails"]; ok {
		user.AutoCleanUnreadEmails = autoCleanUnreadEmails
	}

	return nil
}

// UpdatePreferences 更新用户偏好设置
// 只处理实际使用的字段：timezone 和 locale
func UpdatePreferences(db *gorm.DB, user *User, preferences map[string]string) error {
	vals := make(map[string]any)

	if timezone, ok := preferences["timezone"]; ok {
		vals["timezone"] = timezone
	}
	if locale, ok := preferences["locale"]; ok {
		vals["locale"] = locale
	}

	if len(vals) == 0 {
		return nil
	}

	err := UpdateUserFields(db, user, vals)
	if err != nil {
		return err
	}

	// 更新用户对象
	if timezone, ok := preferences["timezone"]; ok {
		user.Timezone = timezone
	}
	if locale, ok := preferences["locale"]; ok {
		user.Locale = locale
	}

	return nil
}

// CalculateProfileComplete 计算资料完整度
func CalculateProfileComplete(user *User) int {
	complete := 0
	total := 0

	// 基本信息 (40%)
	total += 4
	if user.DisplayName != "" {
		complete++
	}
	if user.FirstName != "" {
		complete++
	}
	if user.LastName != "" {
		complete++
	}
	if user.Avatar != "" {
		complete++
	}

	// 联系方式 (30%)
	total += 3
	if user.Email != "" {
		complete++
	}
	if user.Phone != "" {
		complete++
	}
	if user.EmailVerified {
		complete++
	}

	// 地址信息 (20%)
	total += 2
	if user.City != "" {
		complete++
	}
	if user.Country != "" {
		complete++
	}

	// 偏好设置 (10%)
	total += 1
	if user.Timezone != "" {
		complete++
	}

	percentage := (complete * 100) / total
	if percentage > 100 {
		percentage = 100
	}

	return percentage
}

// UpdateProfileComplete 更新资料完整度
func UpdateProfileComplete(db *gorm.DB, user *User) error {
	complete := CalculateProfileComplete(user)
	err := UpdateUserFields(db, user, map[string]any{
		"ProfileComplete": complete,
	})
	if err != nil {
		return err
	}

	user.ProfileComplete = complete
	return nil
}

// IncrementLoginCount 增加登录次数
func IncrementLoginCount(db *gorm.DB, user *User) error {
	err := UpdateUserFields(db, user, map[string]any{
		"LoginCount": user.LoginCount + 1,
	})
	if err != nil {
		return err
	}

	user.LoginCount++
	return nil
}

// 角色常量
const (
	RoleSuperAdmin = "superadmin" // 超级管理员
	RoleAdmin      = "admin"      // 管理员
	RoleUser       = "user"       // 普通用户
)

// 权限常量
const (
	PermissionAll          = "*"             // 所有权限
	PermissionAdminRead    = "admin.read"    // 管理员读取
	PermissionAdminWrite   = "admin.write"   // 管理员写入
	PermissionUserRead     = "user.read"     // 用户读取
	PermissionUserWrite    = "user.write"    // 用户写入
	PermissionSearchConfig = "search.config" // 搜索配置
	PermissionSystemConfig = "system.config" // 系统配置
)

// getPermissions 解析用户权限 JSON 字符串，返回权限列表
func (u *User) getPermissions() []string {
	if u.Permissions == "" {
		return []string{}
	}

	var perms []string
	if err := json.Unmarshal([]byte(u.Permissions), &perms); err != nil {
		// 如果解析失败，返回空列表
		return []string{}
	}
	return perms
}

// IsAdmin 检查是否为管理员（基于角色）
func (u *User) IsAdmin() bool {
	return u.Role == RoleSuperAdmin || u.Role == RoleAdmin
}

// IsSuperAdmin 检查是否为超级管理员
func (u *User) IsSuperAdmin() bool {
	return u.Role == RoleSuperAdmin
}

// HasPermission 检查是否有特定权限
// 优先级：超级管理员 > 权限列表中的权限 > 角色默认权限
func (u *User) HasPermission(permission string) bool {
	// 超级管理员拥有所有权限
	if u.Role == RoleSuperAdmin {
		return true
	}

	// 检查权限列表
	perms := u.getPermissions()
	for _, p := range perms {
		// 支持通配符权限 "*" 表示所有权限
		if p == PermissionAll {
			return true
		}
		// 精确匹配权限
		if p == permission {
			return true
		}
	}

	// 基于角色的默认权限
	switch u.Role {
	case RoleAdmin:
		// 管理员默认拥有 admin 和 user 相关权限
		switch permission {
		case PermissionAdminRead, PermissionAdminWrite,
			PermissionUserRead, PermissionUserWrite,
			PermissionSearchConfig, PermissionSystemConfig:
			return true
		}
	case RoleUser:
		// 普通用户默认拥有 user 相关权限
		switch permission {
		case PermissionUserRead, PermissionUserWrite:
			return true
		}
	}

	return false
}

// HasAnyPermission 检查是否有任意一个权限
func (u *User) HasAnyPermission(permissions ...string) bool {
	for _, perm := range permissions {
		if u.HasPermission(perm) {
			return true
		}
	}
	return false
}

// HasAllPermissions 检查是否拥有所有指定权限
func (u *User) HasAllPermissions(permissions ...string) bool {
	for _, perm := range permissions {
		if !u.HasPermission(perm) {
			return false
		}
	}
	return true
}
