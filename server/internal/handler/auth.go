package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/lingstorage-sdk-go"
	"github.com/code-100-precent/LingEcho"
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/captcha"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	apperrors "github.com/code-100-precent/LingEcho/pkg/errors"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/middleware"
	"github.com/code-100-precent/LingEcho/pkg/notification"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"github.com/skip2/go-qrcode"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// AuthHandler 认证处理器 - 整合所有认证相关逻辑
type AuthHandler struct {
	db                *gorm.DB
	ipLocationService *utils.IPLocationService
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(db *gorm.DB, ipLocationService *utils.IPLocationService) *AuthHandler {
	return &AuthHandler{
		db:                db,
		ipLocationService: ipLocationService,
	}
}

// LoginRequest 登录请求结构
type LoginRequest struct {
	Email         string `json:"email"`
	Password      string `json:"password"`
	Code          string `json:"code"`
	CaptchaID     string `json:"captcha_id"`
	CaptchaCode   string `json:"captcha_code"`
	TwoFactorCode string `json:"two_factor_code"`
	Timezone      string `json:"timezone"`
	AuthToken     string `json:"auth_token"`
	Remember      bool   `json:"remember"`
}

// executeLogin 执行登录的核心逻辑
func (h *AuthHandler) executeLogin(c *gin.Context, req LoginRequest, loginType string) {
	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()

	// 1. 安全检查
	if err := h.performSecurityChecks(clientIP, req.Email); err != nil {
		apperrors.HandleError(c, err)
		return
	}

	// 2. 验证验证码
	if err := h.verifyCaptcha(req.CaptchaID, req.CaptchaCode); err != nil {
		h.recordFailedLogin(clientIP, req.Email, 0, "captcha_invalid")
		apperrors.HandleError(c, err)
		return
	}

	// 3. 获取并验证用户
	user, err := h.getUserAndVerifyCredentials(req, loginType)
	if err != nil {
		h.recordFailedLogin(clientIP, req.Email, 0, "invalid_credentials")
		apperrors.HandleError(c, err)
		return
	}

	// 4. 检查用户状态
	if err := models.CheckUserAllowLogin(h.db, user); err != nil {
		h.recordFailedLogin(clientIP, req.Email, user.ID, "user_not_allowed")
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrForbidden, "用户不允许登录"))
		return
	}

	// 5. 两步验证检查
	if user.TwoFactorEnabled && req.TwoFactorCode == "" {
		apperrors.RespondSuccess(c, gin.H{
			"requiresTwoFactor": true,
			"message":           "需要两步验证",
		})
		return
	}

	if user.TwoFactorEnabled && req.TwoFactorCode != "" {
		if !totp.Validate(req.TwoFactorCode, user.TwoFactorSecret) {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInvalidCredentials, "两步验证码错误"))
			return
		}
	}

	// 6. 设备和位置检查
	country, city, location := h.getLocationInfo(clientIP)
	deviceType, os, browser := utils.ParseUserAgent(userAgent)
	deviceID := utils.GetDeviceID(userAgent, clientIP)

	// 7. 设备信任检查
	isTrusted, _ := models.CheckDeviceTrust(h.db, user.ID, deviceID)
	if !isTrusted && loginType == "password" {
		apperrors.RespondSuccess(c, gin.H{
			"requiresDeviceVerification": true,
			"deviceId":                   deviceID,
			"message":                    "需要设备验证",
		})
		return
	}

	// 8. 检测异地登录
	isSuspicious := h.detectSuspiciousLogin(user.ID, clientIP, location, country)

	// 9. 记录成功登录
	h.recordSuccessfulLogin(user.ID, req.Email, clientIP, location, country, city, userAgent, deviceID, loginType, isSuspicious)

	// 10. 更新设备信息
	models.CreateOrUpdateUserDevice(h.db, user.ID, deviceID, fmt.Sprintf("%s on %s", browser, os), deviceType, os, browser, userAgent, clientIP, location)

	// 11. 设置会话和返回响应
	h.completeLogin(c, user, req, isSuspicious)
}

// performSecurityChecks 执行安全检查
func (h *AuthHandler) performSecurityChecks(clientIP, email string) error {
	if utils.GlobalLoginSecurityManager != nil {
		if err := utils.GlobalLoginSecurityManager.CheckIPRateLimit(clientIP); err != nil {
			return apperrors.Wrap(err, apperrors.ErrRateLimitExceeded, "登录尝试过于频繁")
		}

		checkLockFunc := func(db *gorm.DB, email string, userID uint) (*utils.AccountLockInfo, error) {
			lock, err := models.GetAccountLock(db, email, userID)
			if err != nil {
				return nil, err
			}
			if lock == nil {
				return nil, nil
			}
			return &utils.AccountLockInfo{
				IsLocked: lock.IsLocked(),
				UnlockAt: lock.UnlockAt,
			}, nil
		}

		if err := utils.GlobalLoginSecurityManager.CheckAccountLock(h.db, email, 0, checkLockFunc); err != nil {
			return apperrors.Wrap(err, apperrors.ErrAccountLocked, "账户已被锁定")
		}
	}
	return nil
}

// verifyCaptcha 验证图形验证码
func (h *AuthHandler) verifyCaptcha(captchaID, captchaCode string) error {
	if captcha.GlobalCaptchaManager != nil {
		if captchaID == "" || captchaCode == "" {
			return apperrors.New(apperrors.ErrCaptchaRequired, "需要验证码")
		}
		valid, err := captcha.GlobalCaptchaManager.Verify(captchaID, captchaCode)
		if err != nil || !valid {
			return apperrors.New(apperrors.ErrCaptchaInvalid, "验证码错误")
		}
	}
	return nil
}

// getUserAndVerifyCredentials 获取用户并验证凭证
func (h *AuthHandler) getUserAndVerifyCredentials(req LoginRequest, loginType string) (*models.User, error) {
	var user *models.User
	var err error

	// 获取用户
	if req.AuthToken != "" {
		user, err = models.DecodeHashToken(h.db, req.AuthToken, false)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrInvalidCredentials, "认证令牌无效")
		}
	} else {
		user, err = models.GetUserByEmail(h.db, req.Email)
		if err != nil {
			return nil, apperrors.Wrap(err, apperrors.ErrUserNotFound, "用户不存在")
		}
	}

	// 验证凭证
	if loginType == "password" && req.Password != "" {
		passwordValid := false
		if strings.Contains(req.Password, ":") && len(strings.Split(req.Password, ":")) == 4 {
			passwordValid = models.VerifyEncryptedPassword(req.Password, user.Password)
		} else {
			passwordValid = models.CheckPassword(user, req.Password)
		}
		if !passwordValid {
			return nil, apperrors.New(apperrors.ErrInvalidCredentials, "密码错误")
		}
	}

	if loginType == "email" && req.Code != "" {
		cachedCode, ok := utils.GlobalCache.Get(req.Email)
		if !ok || cachedCode != req.Code {
			return nil, apperrors.New(apperrors.ErrInvalidCredentials, "验证码错误")
		}
		utils.GlobalCache.Remove(req.Email)
	}

	return user, nil
}

// getLocationInfo 获取位置信息
func (h *AuthHandler) getLocationInfo(clientIP string) (country, city, location string) {
	country, city, location = "Unknown", "Unknown", "Unknown"
	if h.ipLocationService != nil {
		country, city, location, _ = h.ipLocationService.GetLocation(clientIP)
	}
	return
}

// detectSuspiciousLogin 检测可疑登录
func (h *AuthHandler) detectSuspiciousLogin(userID uint, clientIP, location, country string) bool {
	if utils.GlobalLoginSecurityManager == nil {
		return false
	}

	getLocationsFunc := func(db *gorm.DB, userID uint, limit int) ([]utils.LoginLocation, error) {
		histories, err := models.GetRecentLoginLocations(db, userID, limit)
		if err != nil {
			return nil, err
		}
		locations := make([]utils.LoginLocation, len(histories))
		for i, h := range histories {
			locations[i] = utils.LoginLocation{
				Country: h.Country,
				City:    h.City,
			}
		}
		return locations, nil
	}

	isSuspicious, _ := utils.GlobalLoginSecurityManager.DetectSuspiciousLogin(h.db, userID, clientIP, location, country, getLocationsFunc)
	if isSuspicious {
		logger.Warn("Suspicious login detected",
			zap.Uint("userID", userID),
			zap.String("ip", clientIP),
			zap.String("location", location))
	}
	return isSuspicious
}

// recordSuccessfulLogin 记录成功登录
func (h *AuthHandler) recordSuccessfulLogin(userID uint, email, clientIP, location, country, city, userAgent, deviceID, loginType string, isSuspicious bool) {
	if err := models.RecordLoginHistory(h.db, userID, email, clientIP, location, country, city, userAgent, deviceID, loginType, true, "", isSuspicious); err != nil {
		logger.Warn("Failed to record login history", zap.Error(err))
	}

	if utils.GlobalLoginSecurityManager != nil {
		utils.GlobalLoginSecurityManager.ClearFailedLoginCount(email)
	}
}

// recordFailedLogin 记录失败登录
func (h *AuthHandler) recordFailedLogin(clientIP, email string, userID uint, reason string) {
	if err := models.RecordLoginHistory(h.db, userID, email, clientIP, "Unknown", "Unknown", "Unknown", "", "", "password", false, reason, false); err != nil {
		logger.Warn("Failed to record failed login", zap.Error(err))
	}

	if utils.GlobalLoginSecurityManager != nil {
		recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
			_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
			return err
		}
		utils.GlobalLoginSecurityManager.RecordFailedLogin(h.db, email, userID, clientIP, recordFunc)
	}
}

// completeLogin 完成登录流程
func (h *AuthHandler) completeLogin(c *gin.Context, user *models.User, req LoginRequest, isSuspicious bool) {
	if req.Timezone != "" {
		models.InTimezone(c, req.Timezone)
	}

	models.Login(c, user)

	if c.IsAborted() {
		return
	}

	// 重新加载用户信息
	updatedUser, err := models.GetUserByUID(h.db, user.ID)
	if err != nil {
		logger.Warn("Failed to reload user after login", zap.Error(err))
		updatedUser = user
	}

	// 生成Token
	tokenDuration := 24 * time.Hour
	if req.Remember {
		tokenDuration = 7 * 24 * time.Hour
	}
	updatedUser.AuthToken = models.BuildAuthToken(updatedUser, tokenDuration, false)

	responseData := gin.H{
		"user":  updatedUser,
		"token": updatedUser.AuthToken,
	}
	if isSuspicious {
		responseData["suspiciousLogin"] = true
		responseData["message"] = "检测到异地登录，请验证身份"
	}

	logger.Info("Login successful",
		zap.String("email", req.Email),
		zap.Uint("userID", updatedUser.ID))
	apperrors.RespondSuccess(c, responseData)
}

// handleUserSignupPage handle user signup page
func (h *Handlers) handleUserSignupPage(c *gin.Context) {
	ctx := LingEcho.GetRenderPageContext(c)
	ctx["SignupText"] = "Sign Up Now"
	ctx["Site.SignupApi"] = utils.GetValue(h.db, constants.KEY_SITE_SIGNUP_API)
	c.HTML(http.StatusOK, "signup.html", ctx)
}

// handleUserResetPasswordPage handle user reset password page
func (h *Handlers) handleUserResetPasswordPage(c *gin.Context) {
	c.HTML(http.StatusOK, "reset_password.html", LingEcho.GetRenderPageContext(c))
}

// handleUserSigninPage handle user signin page
func (h *Handlers) handleUserSigninPage(c *gin.Context) {
	ctx := LingEcho.GetRenderPageContext(c)
	ctx["SignupText"] = "Sign Up Now"
	c.HTML(http.StatusOK, "signin.html", ctx)
}

// handleUserLogout handle user logout
func (h *Handlers) handleUserLogout(c *gin.Context) {
	user := models.CurrentUser(c)
	if user != nil {
		models.Logout(c, user)
	}
	next := c.Query("next")
	if next != "" {
		c.Redirect(http.StatusFound, next)
		return
	}
	response.Success(c, "Logout Success", nil)
}

// handleUserInfo handle user info
func (h *Handlers) handleUserInfo(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.AbortWithStatus(c, http.StatusUnauthorized)
		return
	}
	withToken := c.Query("with_token")
	if withToken != "" {
		expired, err := time.ParseDuration(withToken)
		if err == nil {
			if expired >= 24*time.Hour {
				expired = 24 * time.Hour
			}
			user.AuthToken = models.BuildAuthToken(user, expired, false)
		}
	}
	response.Success(c, "success", user)
}

// handleUserSigninByEmail handle user signin by email
func (h *Handlers) handleUserSigninByEmail(c *gin.Context) {
	var form models.EmailOperatorForm
	if err := c.BindJSON(&form); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInvalidInput, "Invalid request format"))
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 创建认证处理器
	authHandler := NewAuthHandler(db, h.ipLocationService)

	// 构建登录请求
	loginReq := LoginRequest{
		Email:       form.Email,
		Code:        form.Code,
		CaptchaID:   form.CaptchaID,
		CaptchaCode: form.CaptchaCode,
		Timezone:    form.Timezone,
		Remember:    form.AuthToken, // 使用 AuthToken 字段表示是否记住登录
	}

	// 执行登录
	authHandler.executeLogin(c, loginReq, "email")
}

// handleUserSigninByPassword handle user signin by password
func (h *Handlers) handleUserSigninByPassword(c *gin.Context) {
	var form models.LoginForm
	if err := c.BindJSON(&form); err != nil {
		logger.Error("Failed to bind login form", zap.Error(err))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInvalidInput, "Invalid request format"))
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 创建认证处理器
	authHandler := NewAuthHandler(db, h.ipLocationService)

	// 构建登录请求
	loginReq := LoginRequest{
		Email:         form.Email,
		Password:      form.Password,
		CaptchaID:     form.CaptchaID,
		CaptchaCode:   form.CaptchaCode,
		TwoFactorCode: form.TwoFactorCode,
		Timezone:      form.Timezone,
		AuthToken:     form.AuthToken,
		Remember:      form.Remember,
	}

	// 执行登录
	authHandler.executeLogin(c, loginReq, "password")
}

// handleUserSignin handle user signin
func (h *Handlers) handleUserSignin(c *gin.Context) {
	var form models.LoginForm
	if err := c.BindJSON(&form); err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	if form.AuthToken == "" && form.Email == "" {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("email is required"))
		return
	}

	if form.Password == "" && form.AuthToken == "" {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("empty password"))
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)
	var user *models.User
	var err error
	if form.Password != "" {
		user, err = models.GetUserByEmail(db, form.Email)
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("user not exists"))
			return
		}
		if !models.CheckPassword(user, form.Password) {
			LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, errors.New("unauthorized"))
			return
		}
	} else {
		user, err = models.DecodeHashToken(db, form.AuthToken, false)
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, err)
			return
		}
	}

	err = models.CheckUserAllowLogin(db, user)
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusForbidden, err)
		return
	}

	// 检查是否启用了两步验证
	if user.TwoFactorEnabled {
		// 如果提供了两步验证码，验证它
		if form.TwoFactorCode != "" {
			valid := totp.Validate(form.TwoFactorCode, user.TwoFactorSecret)
			if !valid {
				LingEcho.AbortWithJSONError(c, http.StatusUnauthorized, errors.New("invalid 2fa code"))
				return
			}
		} else {
			// 需要两步验证码
			c.JSON(http.StatusOK, gin.H{
				"code": 200,
				"msg":  "Two-factor authentication required",
				"data": gin.H{
					"requiresTwoFactor": true,
					"message":           "Please enter your two-factor authentication code",
				},
			})
			return
		}
	}

	if form.Timezone != "" {
		models.InTimezone(c, form.Timezone)
	}

	models.Login(c, user)

	if form.Remember {
		val := utils.GetValue(db, constants.KEY_AUTH_TOKEN_EXPIRED) // 7d
		expired, err := time.ParseDuration(val)
		if err != nil {
			// 7 days
			expired = 7 * 24 * time.Hour
		}
		user.AuthToken = models.BuildAuthToken(user, expired, false)
	}
	c.JSON(http.StatusOK, user)
}

// handleUserSignup handle user signup
func (h *Handlers) handleUserSignup(c *gin.Context) {
	var form models.RegisterUserForm
	if err := c.BindJSON(&form); err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	clientIP := c.ClientIP()

	// 1. 输入清理和验证
	var err error
	form.Email, err = utils.SanitizeAndValidate(form.Email, "email")
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	form.Password, err = utils.SanitizeAndValidate(form.Password, "password")
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	if form.DisplayName != "" {
		form.DisplayName, err = utils.SanitizeAndValidate(form.DisplayName, "displayname")
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
			return
		}
	}

	// 2. 智能风控检查
	if utils.GlobalIntelligentRiskControl != nil {
		// 解析行为数据
		var mouseTrack []utils.MouseTrackPoint
		if form.MouseTrack != "" {
			if err := json.Unmarshal([]byte(form.MouseTrack), &mouseTrack); err != nil {
				logger.Warn("Failed to parse mouse track data", zap.Error(err))
			}
		}

		// 准备表单数据用于分析
		formData := map[string]string{
			"email":       form.Email,
			"displayName": form.DisplayName,
			"firstName":   form.FirstName,
			"lastName":    form.LastName,
		}

		// 执行智能风控检查
		if err := utils.GlobalIntelligentRiskControl.CheckRegistrationRisk(
			mouseTrack,
			form.FormFillTime,
			form.KeystrokePattern,
			formData,
		); err != nil {
			if utils.GlobalRegistrationGuard != nil {
				utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "intelligent risk control blocked")
			}
			logger.Warn("Registration blocked by intelligent risk control",
				zap.String("email", form.Email),
				zap.String("ip", clientIP),
				zap.Error(err))
			LingEcho.AbortWithJSONError(c, http.StatusForbidden, errors.New("registration blocked due to suspicious behavior"))
			return
		}
	}

	// 3. 图形验证码验证
	if captcha.GlobalCaptchaManager != nil {
		if form.CaptchaID == "" || form.CaptchaCode == "" {
			if utils.GlobalRegistrationGuard != nil {
				utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "captcha required")
			}
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("captcha is required"))
			return
		}

		valid, err := captcha.GlobalCaptchaManager.Verify(form.CaptchaID, form.CaptchaCode)
		if err != nil || !valid {
			if utils.GlobalRegistrationGuard != nil {
				utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "invalid captcha")
			}
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("invalid captcha code"))
			return
		}
	}

	// 4. 获取并发注册锁
	lockAcquired, err := utils.AcquireRegistrationLock(form.Email)
	if err != nil || !lockAcquired {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "registration in progress")
		}
		LingEcho.AbortWithJSONError(c, http.StatusConflict, errors.New("registration in progress for this email, please try again later"))
		return
	}
	defer utils.ReleaseRegistrationLock(form.Email)

	// 5. 注册防护检查
	if utils.GlobalRegistrationGuard != nil {
		if err := utils.GlobalRegistrationGuard.CheckRegistrationAllowed(clientIP, form.Email, form.Password); err != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, err.Error())
			LingEcho.AbortWithJSONError(c, http.StatusTooManyRequests, err)
			return
		}
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)
	if models.IsExistsByEmail(db, form.Email) {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "email already exists")
		}
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("email has exists"))
		return
	}

	// 处理加密密码：如果是加密格式，提取原始密码哈希
	passwordToStore := form.Password
	if strings.Contains(form.Password, ":") && len(strings.Split(form.Password, ":")) == 4 {
		// 加密密码格式：passwordHash:encryptedHash:salt:timestamp
		parts := strings.Split(form.Password, ":")
		passwordHash := parts[0]
		// 提取原始密码的哈希，加上 sha256$ 前缀
		passwordToStore = fmt.Sprintf("sha256$%s", passwordHash)
	}

	user, err := models.CreateUser(db, form.Email, passwordToStore)
	if err != nil {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, err.Error())
		}
		logger.Warn("create user failed", zap.Any("email", form.Email), zap.Error(err))
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	// 记录成功注册
	if utils.GlobalRegistrationGuard != nil {
		utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, true, "registration successful")
	}

	vals := utils.StructAsMap(form, []string{
		"DisplayName",
		"FirstName",
		"LastName",
		"Locale",
		"Timezone",
		"Source"})

	n := time.Now().Truncate(1 * time.Second)
	vals["LastLogin"] = &n
	vals["LastLoginIP"] = c.ClientIP()

	user.DisplayName = form.DisplayName
	user.FirstName = form.FirstName
	user.LastName = form.LastName
	user.Locale = form.Locale
	user.Source = "ADMIN"
	user.Timezone = form.Timezone
	user.LastLogin = &n
	user.LastLoginIP = c.ClientIP()

	err = models.UpdateUserFields(db, user, vals)
	if err != nil {
		logger.Warn("update user fields fail id:", zap.Uint("userId", user.ID), zap.Any("vals", vals), zap.Error(err))
	}

	utils.Sig().Emit(constants.SigUserCreate, user, c, db)

	r := gin.H{
		"email":      user.Email,
		"activation": user.Activated,
	}
	if !user.Activated && utils.GetBoolValue(db, constants.KEY_USER_ACTIVATED) {
		sendHashMail(db, user, constants.SigUserVerifyEmail, constants.KEY_VERIFY_EMAIL_EXPIRED, "180d", c.ClientIP(), c.Request.UserAgent())
		r["expired"] = "180d"
	} else {
		models.Login(c, user) //Login now
	}
	c.JSON(http.StatusOK, r)
}

// handleUserSignupByEmail email register email activation
func (h *Handlers) handleUserSignupByEmail(c *gin.Context) {
	var form models.EmailOperatorForm
	if err := c.BindJSON(&form); err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	clientIP := c.ClientIP()

	// 1. 输入清理和验证
	var err error
	form.Email, err = utils.SanitizeAndValidate(form.Email, "email")
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	form.Password, err = utils.SanitizeAndValidate(form.Password, "password")
	if err != nil {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	if form.UserName != "" {
		form.UserName, err = utils.SanitizeAndValidate(form.UserName, "username")
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
			return
		}
	}

	if form.DisplayName != "" {
		form.DisplayName, err = utils.SanitizeAndValidate(form.DisplayName, "displayname")
		if err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
			return
		}
	}

	// 2. 图形验证码验证
	if captcha.GlobalCaptchaManager != nil {
		if form.CaptchaID == "" || form.CaptchaCode == "" {
			if utils.GlobalRegistrationGuard != nil {
				utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "captcha required")
			}
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("captcha is required"))
			return
		}

		valid, err := captcha.GlobalCaptchaManager.Verify(form.CaptchaID, form.CaptchaCode)
		if err != nil || !valid {
			if utils.GlobalRegistrationGuard != nil {
				utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "invalid captcha")
			}
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("invalid captcha code"))
			return
		}
	}

	// 3. 获取并发注册锁
	lockAcquired, err := utils.AcquireRegistrationLock(form.Email)
	if err != nil || !lockAcquired {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "registration in progress")
		}
		LingEcho.AbortWithJSONError(c, http.StatusConflict, errors.New("registration in progress for this email, please try again later"))
		return
	}
	defer utils.ReleaseRegistrationLock(form.Email)

	// 4. 注册防护检查
	if utils.GlobalRegistrationGuard != nil {
		if err := utils.GlobalRegistrationGuard.CheckRegistrationAllowed(clientIP, form.Email, form.Password); err != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, err.Error())
			LingEcho.AbortWithJSONError(c, http.StatusTooManyRequests, err)
			return
		}
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)
	if models.IsExistsByEmail(db, form.Email) {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "email already exists")
		}
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("email has exists"))
		return
	}
	// 从缓存中获取验证码（假设你使用的是 util.GlobalCache）
	cachedCode, ok := utils.GlobalCache.Get(form.Email)
	if !ok || cachedCode != form.Code {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, "invalid verification code")
		}
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("invalid verification code"))
		return
	}

	// 清除已用验证码
	utils.GlobalCache.Remove(form.Email)

	// 处理加密密码：如果是加密格式，提取原始密码哈希
	passwordToStore := form.Password
	if strings.Contains(form.Password, ":") && len(strings.Split(form.Password, ":")) == 4 {
		// 加密密码格式：passwordHash:encryptedHash:salt:timestamp
		parts := strings.Split(form.Password, ":")
		passwordHash := parts[0]
		// 提取原始密码的哈希，加上 sha256$ 前缀（HashPassword 会检查并直接返回）
		passwordToStore = fmt.Sprintf("sha256$%s", passwordHash)
	}

	user, err := models.CreateUserByEmail(db, form.UserName, form.DisplayName, form.Email, passwordToStore)
	if err != nil {
		if utils.GlobalRegistrationGuard != nil {
			utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, false, err.Error())
		}
		logger.Warn("create user failed", zap.Any("email", form.Email), zap.Error(err))
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	// 记录成功注册
	if utils.GlobalRegistrationGuard != nil {
		utils.GlobalRegistrationGuard.RecordRegistrationAttempt(clientIP, form.Email, true, "registration successful")
	}
	vals := utils.StructAsMap(form, []string{
		"DisplayName",
		"FirstName",
		"LastName",
		"Locale",
		"Timezone",
		"Source"})
	user.Source = "ADMIN"
	user.Timezone = form.Timezone
	err = models.UpdateUserFields(db, user, vals)
	if err != nil {
		logger.Warn("update user fields fail id:", zap.Uint("userId", user.ID), zap.Any("vals", vals), zap.Error(err))
	}
	utils.Sig().Emit(constants.SigUserCreate, user, db)
	sendHashMail(db, user, constants.SigUserVerifyEmail, constants.KEY_VERIFY_EMAIL_EXPIRED, "180d", c.ClientIP(), c.Request.UserAgent())
	response.Success(c, "signup success", user)
}

// handleUserUpdate Update User Info
func (h *Handlers) handleUserUpdate(c *gin.Context) {
	var req models.UpdateUserRequest
	if err := c.ShouldBind(&req); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user := models.CurrentUser(c)
	vals := make(map[string]interface{})

	if req.Email != "" {
		vals["email"] = req.Email
	}
	if req.Phone != "" {
		vals["phone"] = req.Phone
	}
	if req.FirstName != "" {
		vals["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		vals["last_name"] = req.LastName
	}
	if req.DisplayName != "" {
		vals["display_name"] = req.DisplayName
	}
	if req.Locale != "" {
		vals["locale"] = req.Locale
	}
	if req.Timezone != "" {
		vals["timezone"] = req.Timezone
	}
	if req.Gender != "" {
		vals["gender"] = req.Gender
	}
	if req.Extra != "" {
		vals["extra"] = req.Extra
	}
	if req.Avatar != "" {
		vals["avatar"] = req.Avatar
	}
	if req.City != "" {
		vals["city"] = req.City
	}
	if req.Region != "" {
		vals["region"] = req.Region
	}

	err := models.UpdateUser(h.db, user, vals)
	if err != nil {
		response.Fail(c, "update user failed", err)
		return
	}

	// 重新获取更新后的用户信息
	updatedUser, err := models.GetUserByUID(h.db, user.ID)
	if err != nil {
		response.Fail(c, "failed to get updated user", err)
		return
	}
	cache.Delete(c, constants.CacheKeyUserByID+strconv.Itoa(int(user.ID)))
	response.Success(c, "update user success", updatedUser)
}

// handleUserUpdate Update User Info
func (h *Handlers) handleUserUpdateBasicInfo(c *gin.Context) {
	var req models.UserBasicInfoUpdate
	if err := c.ShouldBind(&req); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}
	user := models.CurrentUser(c)
	vals := make(map[string]interface{})

	if req.WifiName != "" {
		vals["wifiName"] = req.WifiName
	}
	if req.WifiPassword != "" {
		vals["wifiPassword"] = req.WifiPassword
	}
	if req.FatherCallName != "" {
		vals["fatherCallName"] = req.FatherCallName
	}
	if req.MotherCallName != "" {
		vals["motherCallName"] = req.MotherCallName
	}
	err := models.UpdateUser(h.db, user, vals)
	if err != nil {
		response.Fail(c, "update user failed", err)
		return
	}
	response.Success(c, "handle update user success", nil)
}

func (h *Handlers) handleUserUpdatePreferences(c *gin.Context) {
	var preferences struct {
		EmailNotifications    *bool `json:"emailNotifications"`
		PushNotifications     *bool `json:"pushNotifications"`
		SystemNotifications   *bool `json:"systemNotifications"`
		AutoCleanUnreadEmails *bool `json:"autoCleanUnreadEmails"`
	}
	if err := c.ShouldBindJSON(&preferences); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	vals := make(map[string]any)
	if preferences.EmailNotifications != nil {
		vals["email_notifications"] = *preferences.EmailNotifications
	}
	if preferences.PushNotifications != nil {
		vals["push_notifications"] = *preferences.PushNotifications
	}
	if preferences.SystemNotifications != nil {
		vals["system_notifications"] = *preferences.SystemNotifications
	}
	if preferences.AutoCleanUnreadEmails != nil {
		vals["auto_clean_unread_emails"] = *preferences.AutoCleanUnreadEmails
	}
	if len(vals) == 0 {
		response.Success(c, "No preferences changed", nil)
		return
	}

	user := models.CurrentUser(c)
	if err := models.UpdateUser(h.db, user, vals); err != nil {
		response.Fail(c, "update user failed", err)
		return
	}
	response.Success(c, "Update user preferences successfully", nil)
}

// handleChangePassword 修改密码
func (h *Handlers) handleChangePassword(c *gin.Context) {
	// 兼容前端字段：currentPassword/newPassword/confirmPassword
	// 以及旧字段：oldPassword/newPassword
	var form struct {
		OldPassword     string `json:"oldPassword"`
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
		ConfirmPassword string `json:"confirmPassword"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	// 归一化旧密码字段
	oldPassword := form.OldPassword
	if oldPassword == "" {
		oldPassword = form.CurrentPassword
	}

	// 校验必填与确认密码一致
	if oldPassword == "" {
		response.Fail(c, "Old password is required", errors.New("old password is required"))
		return
	}
	if form.NewPassword == "" {
		response.Fail(c, "New password is required", errors.New("new password is required"))
		return
	}
	if len(form.NewPassword) < 6 {
		response.Fail(c, "New password must be at least 6 characters", errors.New("password too short"))
		return
	}
	if form.ConfirmPassword != "" && form.ConfirmPassword != form.NewPassword {
		response.Fail(c, "Confirm password does not match", errors.New("confirm password mismatch"))
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	if err := models.ChangePassword(h.db, user, oldPassword, form.NewPassword); err != nil {
		response.Fail(c, "Change password failed", err)
		return
	}

	// 修改密码成功后强制下线，要求重新登录
	models.Logout(c, user)
	response.Success(c, "Password changed successfully", map[string]any{"logout": true})
}

// handleChangePasswordByEmail 通过邮箱验证码修改密码
func (h *Handlers) handleChangePasswordByEmail(c *gin.Context) {
	var form struct {
		EmailCode       string `json:"emailCode" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required"`
		ConfirmPassword string `json:"confirmPassword"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	// 校验必填与确认密码一致
	if form.NewPassword == "" {
		response.Fail(c, "新密码不能为空", errors.New("new password is required"))
		return
	}
	if len(form.NewPassword) < 6 {
		response.Fail(c, "新密码至少需要6个字符", errors.New("password too short"))
		return
	}
	if form.ConfirmPassword != "" && form.ConfirmPassword != form.NewPassword {
		response.Fail(c, "确认密码不匹配", errors.New("confirm password mismatch"))
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未找到", errors.New("user not found"))
		return
	}

	// 验证邮箱验证码
	if form.EmailCode == "" {
		response.Fail(c, "邮箱验证码不能为空", errors.New("email code is required"))
		return
	}

	// 从缓存中获取验证码
	cachedCode, ok := utils.GlobalCache.Get(user.Email)
	if !ok || cachedCode != form.EmailCode {
		response.Fail(c, "邮箱验证码无效或已过期", errors.New("invalid or expired email code"))
		return
	}

	// 清除已用验证码
	utils.GlobalCache.Remove(user.Email)

	// 设置新密码（不验证旧密码）
	err := models.SetPassword(h.db, user, form.NewPassword)
	if err != nil {
		response.Fail(c, "密码修改失败", err)
		return
	}

	// 更新最后密码修改时间
	now := time.Now()
	err = models.UpdateUserFields(h.db, user, map[string]any{
		"LastPasswordChange": &now,
	})
	if err != nil {
		response.Fail(c, "更新密码修改时间失败", err)
		return
	}

	user.LastPasswordChange = &now

	// 修改密码成功后强制下线，要求重新登录
	models.Logout(c, user)
	response.Success(c, "密码修改成功", map[string]any{"logout": true})
}

// handleGetUserDevices 获取用户的登录设备列表
func (h *Handlers) handleGetUserDevices(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未找到", errors.New("user not found"))
		return
	}

	devices, err := models.GetUserDevices(h.db, user.ID)
	if err != nil {
		response.Fail(c, "获取设备列表失败", err)
		return
	}

	response.Success(c, "获取设备列表成功", gin.H{
		"devices": devices,
	})
}

// handleDeleteUserDevice 删除用户设备
func (h *Handlers) handleDeleteUserDevice(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未找到", errors.New("user not found"))
		return
	}

	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "设备ID不能为空", errors.New("deviceId is required"))
		return
	}

	err := models.DeleteUserDevice(h.db, user.ID, deviceID)
	if err != nil {
		response.Fail(c, "删除设备失败", err)
		return
	}

	response.Success(c, "删除设备成功", nil)
}

// handleTrustUserDevice 信任用户设备
func (h *Handlers) handleTrustUserDevice(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未找到", errors.New("user not found"))
		return
	}

	var form struct {
		DeviceID string `json:"deviceId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	err := models.TrustUserDevice(h.db, user.ID, form.DeviceID)
	if err != nil {
		response.Fail(c, "信任设备失败", err)
		return
	}

	response.Success(c, "信任设备成功", nil)
}

// handleUntrustUserDevice 取消信任用户设备
func (h *Handlers) handleUntrustUserDevice(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未找到", errors.New("user not found"))
		return
	}

	var form struct {
		DeviceID string `json:"deviceId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	err := models.UntrustUserDevice(h.db, user.ID, form.DeviceID)
	if err != nil {
		response.Fail(c, "取消信任设备失败", err)
		return
	}

	response.Success(c, "取消信任设备成功", nil)
}

// handleVerifyDeviceForLogin 验证设备用于登录（无需认证）
func (h *Handlers) handleVerifyDeviceForLogin(c *gin.Context) {
	var form struct {
		Email      string `json:"email" binding:"required"`
		DeviceID   string `json:"deviceId" binding:"required"`
		VerifyCode string `json:"verifyCode" binding:"required"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 验证邮箱验证码
	cachedCode, ok := utils.GlobalCache.Get(form.Email + ":device_verify")
	if !ok || cachedCode != form.VerifyCode {
		response.Fail(c, "验证码无效或已过期", errors.New("invalid or expired verification code"))
		return
	}

	// 清除验证码
	utils.GlobalCache.Remove(form.Email + ":device_verify")

	// 获取用户
	user, err := models.GetUserByEmail(db, form.Email)
	if err != nil {
		response.Fail(c, "用户不存在", err)
		return
	}

	// 信任设备
	err = models.TrustUserDevice(db, user.ID, form.DeviceID)
	if err != nil {
		response.Fail(c, "信任设备失败", err)
		return
	}

	logger.Info("Device verified and trusted for login",
		zap.Uint("userID", user.ID),
		zap.String("email", user.Email),
		zap.String("deviceID", form.DeviceID))

	response.Success(c, "设备验证成功，现在可以使用此设备登录", nil)
}

// handleSendDeviceVerificationCode 发送设备验证码
func (h *Handlers) handleSendDeviceVerificationCode(c *gin.Context) {
	var form struct {
		Email    string `json:"email" binding:"required"`
		DeviceID string `json:"deviceId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 验证用户存在
	user, err := models.GetUserByEmail(db, form.Email)
	if err != nil {
		response.Fail(c, "用户不存在", err)
		return
	}

	// 生成验证码
	code := utils.RandNumberText(6)
	cacheKey := form.Email + ":device_verify"
	utils.GlobalCache.Add(cacheKey, code)

	// 发送邮件
	go func() {
		err := notification.NewMailNotification(config.GlobalConfig.Mail).SendDeviceVerificationCode(user.Email, user.DisplayName, code, form.DeviceID)
		if err != nil {
			logger.Error("Failed to send device verification email", zap.Error(err), zap.String("email", user.Email))
		}
	}()

	logger.Info("Device verification code sent",
		zap.Uint("userID", user.ID),
		zap.String("email", user.Email),
		zap.String("deviceID", form.DeviceID))

	response.Success(c, "设备验证码已发送到您的邮箱", nil)
}

// handleResetPassword 重置密码请求
func (h *Handlers) handleResetPassword(c *gin.Context) {
	var form struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user, err := models.GetUserByEmail(h.db, form.Email)
	if err != nil {
		// 为了安全，不暴露用户是否存在
		response.Success(c, "If the email exists, a reset link has been sent", nil)
		return
	}

	token, err := models.GeneratePasswordResetToken(h.db, user)
	if err != nil {
		response.Fail(c, "Failed to generate reset token", err)
		return
	}

	// 发送密码重置邮件
	utils.Sig().Emit(constants.SigUserResetPassword, user, token, c.ClientIP(), c.Request.UserAgent(), h.db)

	response.Success(c, "If the email exists, a reset link has been sent", nil)
}

// handleResetPasswordConfirm 确认重置密码
func (h *Handlers) handleResetPasswordConfirm(c *gin.Context) {
	var form struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user, err := models.VerifyPasswordResetToken(h.db, form.Token)
	if err != nil {
		response.Fail(c, "Invalid or expired token", err)
		return
	}

	err = models.ResetPassword(h.db, user, form.Password)
	if err != nil {
		response.Fail(c, "Reset password failed", err)
		return
	}

	response.Success(c, "Password reset successfully", nil)
}

// handleVerifyEmail 验证邮箱
func (h *Handlers) handleVerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		response.Fail(c, "Token is required", errors.New("token is required"))
		return
	}

	user, err := models.VerifyEmail(h.db, token)
	if err != nil {
		response.Fail(c, "Invalid or expired token", err)
		return
	}

	response.Success(c, "Email verified successfully", user)
}

// handleSendEmailVerification 发送邮箱验证邮件
func (h *Handlers) handleSendEmailVerification(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	logger.Info("Email verification request",
		zap.Uint("userId", user.ID),
		zap.String("email", user.Email),
		zap.Bool("emailVerified", user.EmailVerified))

	if user.EmailVerified {
		response.Fail(c, "Email already verified", errors.New("email already verified"))
		return
	}

	token, err := models.GenerateEmailVerifyToken(h.db, user)
	if err != nil {
		logger.Error("Failed to generate verification token", zap.Error(err))
		response.Fail(c, "Failed to generate verification token", err)
		return
	}

	logger.Info("Generated email verification token",
		zap.String("token", token),
		zap.String("email", user.Email))

	// 发送邮箱验证邮件
	utils.Sig().Emit(constants.SigUserVerifyEmail, user, token, c.ClientIP(), c.Request.UserAgent(), h.db)

	logger.Info("Email verification signal emitted",
		zap.String("email", user.Email),
		zap.String("token", token))

	response.Success(c, "Verification email sent", nil)
}

// handleVerifyPhone 验证手机
func (h *Handlers) handleVerifyPhone(c *gin.Context) {
	var form struct {
		Code string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&form); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	err := models.VerifyPhone(h.db, user, form.Code)
	if err != nil {
		response.Fail(c, "Invalid verification code", err)
		return
	}

	response.Success(c, "Phone verified successfully", nil)
}

// handleGetSalt 获取随机盐（用于密码加密）
func (h *Handlers) handleGetSalt(c *gin.Context) {
	// 生成随机盐（32字符）
	salt := utils.GenerateRandomString(32)
	timestamp := time.Now().Unix()
	expiresIn := int64(300) // 5分钟有效期

	// 将盐和时间戳存储到缓存中，用于验证
	key := fmt.Sprintf("password_salt:%s", salt)
	if utils.GlobalCache != nil {
		utils.GlobalCache.Add(key, timestamp)
	}

	response.Success(c, "success", gin.H{
		"salt":      salt,
		"timestamp": timestamp,
		"expiresIn": expiresIn,
	})
}

// handleSendPhoneVerification 发送手机验证码
func (h *Handlers) handleSendPhoneVerification(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	if user.Phone == "" {
		response.Fail(c, "Phone number not set", errors.New("phone number not set"))
		return
	}

	if user.PhoneVerified {
		response.Fail(c, "Phone already verified", errors.New("phone already verified"))
		return
	}

	token, err := models.GeneratePhoneVerifyToken(h.db, user)
	if err != nil {
		response.Fail(c, "Failed to generate verification code", err)
		return
	}

	// 这里可以集成短信服务发送验证码
	// 目前只是记录日志
	logger.Info("Phone verification code", zap.String("phone", user.Phone), zap.String("code", token))

	response.Success(c, "Verification code sent", nil)
}

// handleUpdateNotificationSettings 更新通知设置
func (h *Handlers) handleUpdateNotificationSettings(c *gin.Context) {
	var settings map[string]bool

	if err := c.ShouldBindJSON(&settings); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	err := models.UpdateNotificationSettings(h.db, user, settings)
	if err != nil {
		response.Fail(c, "Update notification settings failed", err)
		return
	}

	response.Success(c, "Notification settings updated successfully", nil)
}

// handleUpdateUserPreferences 更新用户偏好设置
func (h *Handlers) handleUpdateUserPreferences(c *gin.Context) {
	var preferences map[string]string

	if err := c.ShouldBindJSON(&preferences); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	err := models.UpdatePreferences(h.db, user, preferences)
	if err != nil {
		response.Fail(c, "Update preferences failed", err)
		return
	}

	// 更新资料完整度
	err = models.UpdateProfileComplete(h.db, user)
	if err != nil {
		logger.Warn("Failed to update profile complete", zap.Error(err))
	}

	response.Success(c, "Preferences updated successfully", nil)
}

// handleGetUserStats 获取用户统计信息
func (h *Handlers) handleGetUserStats(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	// 更新资料完整度
	err := models.UpdateProfileComplete(h.db, user)
	if err != nil {
		logger.Warn("Failed to update profile complete", zap.Error(err))
	}

	stats := map[string]interface{}{
		"loginCount":         user.LoginCount,
		"profileComplete":    user.ProfileComplete,
		"emailVerified":      user.EmailVerified,
		"phoneVerified":      user.PhoneVerified,
		"twoFactorEnabled":   user.TwoFactorEnabled,
		"lastLogin":          user.LastLogin,
		"lastPasswordChange": user.LastPasswordChange,
		"createdAt":          user.CreatedAt,
	}

	response.Success(c, "User stats retrieved successfully", stats)
}

// handleUploadAvatar 处理用户头像上传
func (h *Handlers) handleUploadAvatar(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	// 获取上传的文件
	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		response.Fail(c, "Failed to get uploaded file", err)
		return
	}
	defer file.Close()

	// 验证文件类型
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}

	// 从文件头获取Content-Type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		// 如果header中没有Content-Type，尝试从文件扩展名判断
		fileExt := strings.ToLower(filepath.Ext(header.Filename))
		extToType := map[string]string{
			".jpg":  "image/jpeg",
			".jpeg": "image/jpeg",
			".png":  "image/png",
			".gif":  "image/gif",
			".webp": "image/webp",
		}
		if mappedType, exists := extToType[fileExt]; exists {
			contentType = mappedType
		}
	}

	if !allowedTypes[contentType] {
		response.Fail(c, "Invalid file type", errors.New("only jpeg, jpg, png, gif, webp files are allowed"))
		return
	}

	// 验证文件大小 (最大5MB)
	maxSize := int64(5 * 1024 * 1024)
	if header.Size > maxSize {
		response.Fail(c, "File too large", errors.New("file size must be less than 5MB"))
		return
	}

	// 生成文件名
	fileExt := getFileExtension(header.Filename)
	fileName := fmt.Sprintf("avatars/%d_%d%s", user.ID, time.Now().Unix(), fileExt)

	//// 如果用户已有头像且不是默认头像，删除旧头像
	//if user.Avatar != "" && !isDefaultAvatar(user.Avatar) {
	//	// 从URL中提取文件路径
	//	oldKey := extractKeyFromURL(user.Avatar)
	//	if oldKey != "" {
	//		store.Delete(oldKey)
	//	}
	//}
	reader, err := config.GlobalStore.UploadFromReader(&lingstorage.UploadFromReaderRequest{
		Reader:   file,
		Bucket:   config.GlobalConfig.LingstorageBucket,
		Filename: fileName,
		Key:      fileName,
	})
	if err != nil {
		response.Fail(c, "Failed to upload avatar", err)
		return
	}
	// 更新用户头像URL
	avatarURL := reader.URL

	// 保存相对路径用于返回
	avatarRelativePath := avatarURL

	// 如果是相对路径，转换为完整URL用于数据库存储
	if strings.HasPrefix(avatarURL, "/") {
		// 获取请求的Host和Scheme
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		host := c.Request.Host
		if host == "" {
			host = "localhost:7072" // 默认host
		}
		avatarURL = fmt.Sprintf("%s://%s%s", scheme, host, avatarURL)
	}

	err = models.UpdateUser(h.db, user, map[string]any{
		"avatar": avatarURL,
	})
	if err != nil {
		// 如果数据库更新失败，删除已上传的文件
		//store.Delete(fileName)
		response.Fail(c, "Failed to update user avatar", err)
		return
	}

	// 更新用户对象
	user.Avatar = avatarURL

	// 更新资料完整度
	err = models.UpdateProfileComplete(h.db, user)
	if err != nil {
		logger.Warn("Failed to update profile complete", zap.Error(err))
	}

	// 返回相对路径，方便反向代理
	response.Success(c, "Avatar uploaded successfully", gin.H{
		"avatar": avatarRelativePath,
	})
}

// getFileExtension 获取文件扩展名
func getFileExtension(filename string) string {
	ext := filepath.Ext(filename)
	if ext == "" {
		return ".jpg" // 默认扩展名
	}
	return ext
}

// isDefaultAvatar 检查是否为默认头像
func isDefaultAvatar(avatarURL string) bool {
	// 检查是否包含默认头像的标识
	return strings.Contains(avatarURL, "default") ||
		strings.Contains(avatarURL, "placeholder") ||
		strings.Contains(avatarURL, "gravatar")
}

func sendHashMail(db *gorm.DB, user *models.User, signame, expireKey, defaultExpired, clientIp, useragent string) {
	d, err := time.ParseDuration(utils.GetValue(db, expireKey))
	if err != nil {
		d, _ = time.ParseDuration(defaultExpired)
	}
	n := time.Now().Add(d)
	hash := models.EncodeHashToken(user, n.Unix(), true)

	// 发送信号，让监听器处理邮件发送
	utils.Sig().Emit(signame, user, hash, clientIp, useragent, db)
}

// handleSendEmailCode Send Email Code
func (h *Handlers) handleSendEmailCode(context *gin.Context) {
	var req models.SendEmailVerifyEmail
	if err := context.BindJSON(&req); err != nil {
		LingEcho.AbortWithJSONError(context, http.StatusBadRequest, err)
		return
	}
	req.UserAgent = context.Request.UserAgent()
	req.ClientIp = context.ClientIP()
	text := utils.RandNumberText(6)
	utils.GlobalCache.Add(req.Email, text)
	go func() {
		err := notification.NewMailNotification(config.GlobalConfig.Mail).SendVerificationCode(req.Email, text)
		if err != nil {
			LingEcho.AbortWithJSONError(context, http.StatusBadRequest, err)
			return
		}
	}()
	response.Success(context, "success", "Send Email Successful, Must be verified within the valid time [5 minutes]")
	return
}

// handleTwoFactorSetup 设置两步验证
func (h *Handlers) handleTwoFactorSetup(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	// 如果已经启用两步验证，返回错误
	if user.TwoFactorEnabled {
		response.Fail(c, "Two-factor authentication is already enabled", errors.New("two-factor already enabled"))
		return
	}

	// 生成新的密钥
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "LingEcho",
		AccountName: user.Email,
		SecretSize:  32,
	})
	if err != nil {
		response.Fail(c, "Failed to generate two-factor secret", err)
		return
	}

	// 保存密钥到数据库（不启用）
	err = models.UpdateUser(h.db, user, map[string]interface{}{
		"two_factor_secret": key.Secret(),
	})
	if err != nil {
		response.Fail(c, "Failed to save two-factor secret", err)
		return
	}

	// 生成QR码
	qrCode, err := qrcode.New(key.URL(), qrcode.Medium)
	if err != nil {
		response.Fail(c, "Failed to generate QR code", err)
		return
	}

	// 将QR码转换为PNG图片的base64编码
	png, err := qrCode.PNG(256)
	if err != nil {
		response.Fail(c, "Failed to generate QR code image", err)
		return
	}

	// 转换为base64字符串
	qrCodeBase64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)

	response.Success(c, "Two-factor setup initiated", gin.H{
		"secret": key.Secret(),
		"qrCode": qrCodeBase64,
		"url":    key.URL(),
	})
}

// handleTwoFactorEnable 启用两步验证
func (h *Handlers) handleTwoFactorEnable(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	// 验证TOTP代码
	valid := totp.Validate(req.Code, user.TwoFactorSecret)
	if !valid {
		response.Fail(c, "Invalid verification code", errors.New("invalid code"))
		return
	}

	// 启用两步验证
	err := models.UpdateUser(h.db, user, map[string]interface{}{
		"two_factor_enabled": true,
	})
	if err != nil {
		response.Fail(c, "Failed to enable two-factor authentication", err)
		return
	}

	response.Success(c, "Two-factor authentication enabled successfully", nil)
}

// handleTwoFactorDisable 禁用两步验证
func (h *Handlers) handleTwoFactorDisable(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	// 验证TOTP代码
	valid := totp.Validate(req.Code, user.TwoFactorSecret)
	if !valid {
		response.Fail(c, "Invalid verification code", errors.New("invalid code"))
		return
	}

	// 禁用两步验证并清除密钥
	err := models.UpdateUser(h.db, user, map[string]interface{}{
		"two_factor_enabled": false,
		"two_factor_secret":  "",
	})
	if err != nil {
		response.Fail(c, "Failed to disable two-factor authentication", err)
		return
	}

	response.Success(c, "Two-factor authentication disabled successfully", nil)
}

// handleTwoFactorStatus 获取两步验证状态
func (h *Handlers) handleTwoFactorStatus(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	response.Success(c, "Two-factor status retrieved", gin.H{
		"enabled":   user.TwoFactorEnabled,
		"hasSecret": user.TwoFactorSecret != "",
	})
}

// handleGetCaptcha 获取图形验证码
func (h *Handlers) handleGetCaptcha(c *gin.Context) {
	if captcha.GlobalCaptchaManager == nil {
		response.Fail(c, "Captcha service not available", errors.New("captcha service not initialized"))
		return
	}

	capt, err := captcha.GlobalCaptchaManager.Generate()
	if err != nil {
		response.Fail(c, "Failed to generate captcha", err)
		return
	}

	// 不返回验证码内容，只返回ID和图片
	response.Success(c, "Captcha generated", gin.H{
		"id":    capt.ID,
		"image": capt.Image,
	})
}

// handleVerifyCaptcha 验证图形验证码
func (h *Handlers) handleVerifyCaptcha(c *gin.Context) {
	var req struct {
		ID   string `json:"id" binding:"required"`
		Code string `json:"code" binding:"required"`
	}

	if err := c.BindJSON(&req); err != nil {
		response.Fail(c, "Invalid request", err)
		return
	}

	if captcha.GlobalCaptchaManager == nil {
		response.Fail(c, "Captcha service not available", errors.New("captcha service not initialized"))
		return
	}

	valid, err := captcha.GlobalCaptchaManager.Verify(req.ID, req.Code)
	if err != nil {
		response.Fail(c, "Failed to verify captcha", err)
		return
	}

	if valid {
		response.Success(c, "Captcha verified", gin.H{"valid": true})
	} else {
		response.Fail(c, "Invalid captcha code", errors.New("invalid captcha code"))
	}
}

// handleGetUserActivity 获取用户活动记录
func (h *Handlers) handleGetUserActivity(c *gin.Context) {
	user, exists := c.Get(constants.UserField)
	if !exists {
		response.Fail(c, "User not found", errors.New("user not found"))
		return
	}

	// 获取查询参数
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "20")
	action := c.Query("action") // 可选：按操作类型筛选

	// 转换分页参数
	pageInt, err := strconv.Atoi(page)
	if err != nil || pageInt < 1 {
		pageInt = 1
	}
	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt < 1 || limitInt > 100 {
		limitInt = 20
	}

	// 计算偏移量
	offset := (pageInt - 1) * limitInt

	// 构建查询
	query := h.db.Model(&middleware.OperationLog{}).Where("user_id = ?", user.(*models.User).ID)

	// 按操作类型筛选
	if action != "" {
		query = query.Where("action = ?", action)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		response.Fail(c, "Failed to count activities", err)
		return
	}

	// 获取活动记录
	var activities []middleware.OperationLog
	if err := query.Order("created_at DESC").Limit(limitInt).Offset(offset).Find(&activities).Error; err != nil {
		response.Fail(c, "Failed to get activities", err)
		return
	}

	// 格式化响应数据
	activityList := make([]gin.H, 0) // 初始化为空切片，确保JSON序列化为[]
	if len(activities) > 0 {
		activityList = make([]gin.H, 0, len(activities)) // 预分配容量
		for _, activity := range activities {
			activityList = append(activityList, gin.H{
				"id":        activity.ID,
				"action":    activity.Action,
				"target":    activity.Target,
				"details":   activity.Details,
				"ipAddress": activity.IPAddress,
				"userAgent": activity.UserAgent,
				"device":    activity.Device,
				"browser":   activity.Browser,
				"os":        activity.OperatingSystem,
				"location":  activity.Location,
				"createdAt": activity.CreatedAt,
			})
		}
	}

	response.Success(c, "Activities retrieved", gin.H{
		"activities": activityList,
		"pagination": gin.H{
			"page":       pageInt,
			"limit":      limitInt,
			"total":      total,
			"totalPages": (total + int64(limitInt) - 1) / int64(limitInt),
		},
	})
}
