package handlers

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho"
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/captcha"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/middleware"
	"github.com/code-100-precent/LingEcho/pkg/notification"
	"github.com/code-100-precent/LingEcho/pkg/response"
	stores "github.com/code-100-precent/LingEcho/pkg/storage"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp/totp"
	"github.com/skip2/go-qrcode"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

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
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, err)
		return
	}

	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()
	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 1. IP限流检查
	if utils.GlobalLoginSecurityManager != nil {
		if err := utils.GlobalLoginSecurityManager.CheckIPRateLimit(clientIP); err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusTooManyRequests, err)
			return
		}
	}

	// 2. 账号锁定检查
	if utils.GlobalLoginSecurityManager != nil {
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
		if err := utils.GlobalLoginSecurityManager.CheckAccountLock(db, form.Email, 0, checkLockFunc); err != nil {
			LingEcho.AbortWithJSONError(c, http.StatusForbidden, err)
			return
		}
	}

	// 3. 图形验证码验证（邮箱验证码登录需要）
	if captcha.GlobalCaptchaManager != nil {
		if form.CaptchaID == "" || form.CaptchaCode == "" {
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("captcha is required"))
			return
		}

		valid, err := captcha.GlobalCaptchaManager.Verify(form.CaptchaID, form.CaptchaCode)
		if err != nil || !valid {
			if utils.GlobalLoginSecurityManager != nil {
				recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
					_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
					return err
				}
				utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, 0, clientIP, recordFunc)
			}
			LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("invalid captcha code"))
			return
		}
	}

	// 检查邮箱是否为空
	if form.Email == "" {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("email is required"))
		return
	}

	// 4. 获取用户
	user, err := models.GetUserByEmail(db, form.Email)
	if err != nil {
		if utils.GlobalLoginSecurityManager != nil {
			recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
				_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
				return err
			}
			utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, 0, clientIP, recordFunc)
		}
		response.Fail(c, "user not exists", errors.New("user not exists"))
		return
	}

	// 5. 校验验证码
	if form.Code == "" {
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("verification code is required"))
		return
	}

	// 从缓存中获取验证码
	cachedCode, ok := utils.GlobalCache.Get(form.Email)
	if !ok || cachedCode != form.Code {
		if utils.GlobalLoginSecurityManager != nil {
			recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
				_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
				return err
			}
			utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, user.ID, clientIP, recordFunc)
		}
		LingEcho.AbortWithJSONError(c, http.StatusBadRequest, errors.New("invalid verification code"))
		return
	}

	// 清除已用验证码
	utils.GlobalCache.Remove(form.Email)

	// 6. 检查用户是否允许登录（激活、启用等）
	err = models.CheckUserAllowLogin(db, user)
	if err != nil {
		if utils.GlobalLoginSecurityManager != nil {
			recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
				_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
				return err
			}
			utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, user.ID, clientIP, recordFunc)
		}
		LingEcho.AbortWithJSONError(c, http.StatusForbidden, err)
		return
	}

	// 7. 获取IP地理位置
	country, city, location := "Unknown", "Unknown", "Unknown"
	if h.ipLocationService != nil {
		country, city, location, _ = h.ipLocationService.GetLocation(clientIP)
	}

	// 8. 检测异地登录
	isSuspicious := false
	if utils.GlobalLoginSecurityManager != nil {
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
		isSuspicious, _ = utils.GlobalLoginSecurityManager.DetectSuspiciousLogin(db, user.ID, clientIP, location, country, getLocationsFunc)
		if isSuspicious {
			logger.Warn("Suspicious login detected",
				zap.Uint("userID", user.ID),
				zap.String("email", user.Email),
				zap.String("ip", clientIP),
				zap.String("location", location))
		}
	}

	// 9. 解析设备信息
	deviceType, os, browser := utils.ParseUserAgent(userAgent)
	deviceID := utils.GetDeviceID(userAgent, clientIP)

	// 10. 创建设备记录
	if _, err := models.CreateOrUpdateUserDevice(db, user.ID, deviceID, fmt.Sprintf("%s on %s", browser, os), deviceType, os, browser, userAgent, clientIP, location); err != nil {
		logger.Warn("Failed to create/update user device", zap.Error(err))
	}

	// 11. 记录登录历史
	if err := models.RecordLoginHistory(db, user.ID, form.Email, clientIP, location, country, city, userAgent, deviceID, "email", true, "", isSuspicious); err != nil {
		logger.Warn("Failed to record login history", zap.Error(err))
	}

	// 12. 清除失败登录计数
	if utils.GlobalLoginSecurityManager != nil {
		utils.GlobalLoginSecurityManager.ClearFailedLoginCount(form.Email)
	}

	// 设置时区（如果有的话）
	if form.Timezone != "" {
		models.InTimezone(c, form.Timezone)
	}

	// 登录用户，设置 Session
	models.Login(c, user)

	// 检查是否被中止
	if c.IsAborted() {
		return
	}

	// 重新从数据库加载用户信息，确保获取最新的LastLogin等信息
	updatedUser, err := models.GetUserByUID(db, user.ID)
	if err != nil {
		logger.Warn("Failed to reload user after login, using original user object", zap.Error(err))
		updatedUser = user // 如果加载失败，使用原始user对象
	} else {
		user = updatedUser // 使用更新后的用户信息
	}

	// 如果需要 Token，生成 AuthToken
	if form.AuthToken {
		val := utils.GetValue(db, constants.KEY_AUTH_TOKEN_EXPIRED)
		expired, _ := time.ParseDuration(val)
		if expired < 24*time.Hour {
			expired = 24 * time.Hour
		}
		user.AuthToken = models.BuildAuthToken(user, expired, false)
	}

	// 返回登录结果（包含可疑登录警告）
	responseData := gin.H{
		"user":  user,
		"token": user.AuthToken, // 为了兼容前端，同时返回token字段
	}
	if isSuspicious {
		responseData["suspiciousLogin"] = true
		responseData["message"] = "Login from new location detected. Please verify your identity."
	}

	response.Success(c, "login success", responseData)
}

// handleUserSignin handle user signin
func (h *Handlers) handleUserSigninByPassword(c *gin.Context) {
	var form models.LoginForm
	if err := c.BindJSON(&form); err != nil {
		logger.Error("Failed to bind login form", zap.Error(err))
		response.Fail(c, "login failed", err)
		return
	}

	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()
	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 1. IP限流检查
	if utils.GlobalLoginSecurityManager != nil {
		if err := utils.GlobalLoginSecurityManager.CheckIPRateLimit(clientIP); err != nil {
			response.Fail(c, "too many login attempts", err)
			return
		}
	}

	// 2. 代理IP检测
	if utils.GlobalLoginSecurityManager != nil {
		isProxy, err := utils.GlobalLoginSecurityManager.CheckProxyIP(clientIP)
		if err != nil {
			logger.Warn("Failed to check proxy IP", zap.String("ip", clientIP), zap.Error(err))
		}
		if isProxy {
			logger.Warn("Login attempt from proxy IP", zap.String("ip", clientIP), zap.String("email", form.Email))
		}
	}

	// 3. 账号锁定检查
	if utils.GlobalLoginSecurityManager != nil {
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
		if err := utils.GlobalLoginSecurityManager.CheckAccountLock(db, form.Email, 0, checkLockFunc); err != nil {
			response.Fail(c, "account is locked", err)
			return
		}
	}

	if form.AuthToken == "" && form.Email == "" {
		logger.Warn("Login attempt without email or token", zap.String("ip", clientIP))
		response.Fail(c, "login failed", errors.New("email is required"))
		return
	}

	if form.Password == "" && form.AuthToken == "" {
		logger.Warn("Login attempt without password or token", zap.String("ip", clientIP), zap.String("email", form.Email))
		response.Fail(c, "login failed", errors.New("empty password"))
		return
	}

	// 4. 获取用户
	var user *models.User
	var err error
	if form.Password != "" {
		user, err = models.GetUserByEmail(db, form.Email)
		if err != nil {
			logger.Warn("Login attempt with non-existent email", zap.String("email", form.Email), zap.String("ip", clientIP), zap.Error(err))
			// 记录失败登录
			if utils.GlobalLoginSecurityManager != nil {
				recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
					_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
					return err
				}
				utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, 0, clientIP, recordFunc)
			}
			response.Fail(c, "用户不存在，请检查邮箱地址", gin.H{
				"error":   "user_not_exists",
				"message": "用户不存在，请检查邮箱地址",
			})
			return
		}

		// 5. 检查密码登录次数限制（需要邮箱验证）
		if utils.GlobalLoginSecurityManager != nil {
			checkLimitFunc := func(db *gorm.DB, userID uint) (int64, error) {
				var count int64
				err := db.Table("login_histories").
					Where("user_id = ? AND login_type = ? AND success = ? AND created_at > ?",
						userID, "password", true, time.Now().AddDate(0, 0, -30)). // 最近30天
					Count(&count).Error
				return count, err
			}
			needsEmailVerification, err := utils.GlobalLoginSecurityManager.CheckPasswordLoginLimit(db, user.ID, form.Email, checkLimitFunc)
			if err != nil {
				logger.Warn("Failed to check password login limit", zap.Error(err))
			}
			if needsEmailVerification {
				// 需要邮箱验证码，但这里先检查密码是否正确
				if !models.CheckPassword(user, form.Password) {
					logger.Warn("Login failed: incorrect password (email verification required)", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP))
					if utils.GlobalLoginSecurityManager != nil {
						recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
							_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
							return err
						}
						utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, user.ID, clientIP, recordFunc)
					}
					response.Fail(c, "密码错误，请检查后重试", gin.H{
						"error":   "incorrect_password",
						"message": "密码错误，请检查后重试",
					})
					return
				}
				// 密码正确，但需要邮箱验证
				response.Success(c, "Email verification required", gin.H{
					"requiresEmailVerification": true,
					"message":                   "Password login limit reached. Please verify with email code.",
				})
				return
			}
		}

		// 6. 图形验证码验证（密码登录需要）
		if captcha.GlobalCaptchaManager != nil {
			if form.CaptchaID == "" || form.CaptchaCode == "" {
				logger.Warn("Login failed: captcha is required", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP))
				response.Fail(c, "请输入图形验证码", gin.H{
					"error":   "captcha_required",
					"message": "请输入图形验证码",
				})
				return
			}

			valid, err := captcha.GlobalCaptchaManager.Verify(form.CaptchaID, form.CaptchaCode)
			if err != nil || !valid {
				logger.Warn("Login failed: invalid captcha code", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP), zap.String("captchaID", form.CaptchaID), zap.Error(err))
				if utils.GlobalLoginSecurityManager != nil {
					recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
						_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
						return err
					}
					utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, user.ID, clientIP, recordFunc)
				}
				response.Fail(c, "验证码错误，请重新输入", gin.H{
					"error":   "invalid_captcha",
					"message": "验证码错误，请重新输入",
				})
				return
			}
		}

		// 7. 验证密码（支持加密密码和明文密码）
		passwordValid := false
		// 检查是否是加密密码格式（passwordHash:encryptedHash:salt:timestamp）
		if strings.Contains(form.Password, ":") && len(strings.Split(form.Password, ":")) == 4 {
			// 加密密码验证
			passwordValid = models.VerifyEncryptedPassword(form.Password, user.Password)
		} else {
			// 明文密码（向后兼容）
			passwordValid = models.CheckPassword(user, form.Password)
		}

		if !passwordValid {
			logger.Warn("Login failed: incorrect password", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP))
			// 记录失败登录
			if utils.GlobalLoginSecurityManager != nil {
				recordFunc := func(db *gorm.DB, email string, userID uint, ipAddress string, failedCount int) error {
					_, err := models.CreateOrUpdateAccountLock(db, email, userID, ipAddress, failedCount)
					return err
				}
				utils.GlobalLoginSecurityManager.RecordFailedLogin(db, form.Email, user.ID, clientIP, recordFunc)
			}
			response.Fail(c, "密码错误，请检查后重试", gin.H{
				"error":   "incorrect_password",
				"message": "密码错误，请检查后重试",
			})
			return
		}
	} else {
		user, err = models.DecodeHashToken(db, form.AuthToken, false)
		if err != nil {
			logger.Warn("Login failed: invalid auth token", zap.String("ip", clientIP), zap.Error(err))
			response.Fail(c, "login failed", err)
			return
		}
	}

	err = models.CheckUserAllowLogin(db, user)
	if err != nil {
		logger.Warn("Login failed: user not allowed to login", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP), zap.Error(err))
		response.Fail(c, "login failed", err)
		return
	}

	// 8. 获取IP地理位置
	country, city, location := "Unknown", "Unknown", "Unknown"
	if h.ipLocationService != nil {
		country, city, location, _ = h.ipLocationService.GetLocation(clientIP)
	}

	// 9. 检测异地登录
	isSuspicious := false
	if utils.GlobalLoginSecurityManager != nil {
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
		isSuspicious, _ = utils.GlobalLoginSecurityManager.DetectSuspiciousLogin(db, user.ID, clientIP, location, country, getLocationsFunc)
		if isSuspicious {
			logger.Warn("Suspicious login detected",
				zap.Uint("userID", user.ID),
				zap.String("email", user.Email),
				zap.String("ip", clientIP),
				zap.String("location", location))
		}
	}

	// 10. 解析设备信息
	deviceType, os, browser := utils.ParseUserAgent(userAgent)
	deviceID := utils.GetDeviceID(userAgent, clientIP)

	// 11. 创建设备记录
	if _, err := models.CreateOrUpdateUserDevice(db, user.ID, deviceID, fmt.Sprintf("%s on %s", browser, os), deviceType, os, browser, userAgent, clientIP, location); err != nil {
		logger.Warn("Failed to create/update user device", zap.Error(err))
	}

	// 12. 记录登录历史
	if err := models.RecordLoginHistory(db, user.ID, form.Email, clientIP, location, country, city, userAgent, deviceID, "password", true, "", isSuspicious); err != nil {
		logger.Warn("Failed to record login history", zap.Error(err))
	}

	// 13. 清除失败登录计数
	if utils.GlobalLoginSecurityManager != nil {
		utils.GlobalLoginSecurityManager.ClearFailedLoginCount(form.Email)
	}

	// 14. 检查是否启用了两步验证
	if user.TwoFactorEnabled {
		// 如果提供了两步验证码，验证它
		if form.TwoFactorCode != "" {
			valid := totp.Validate(form.TwoFactorCode, user.TwoFactorSecret)
			if !valid {
				response.Fail(c, "Invalid two-factor authentication code", errors.New("invalid 2fa code"))
				return
			}
		} else {
			// 需要两步验证码
			response.Success(c, "Two-factor authentication required", gin.H{
				"requiresTwoFactor": true,
				"message":           "Please enter your two-factor authentication code",
			})
			return
		}
	}

	if form.Timezone != "" {
		models.InTimezone(c, form.Timezone)
	}

	// 执行登录操作（设置session等）
	models.Login(c, user)

	// 检查是否被中止（models.Login内部可能出错并中止请求）
	if c.IsAborted() {
		logger.Error("Login failed: models.Login aborted the request", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP))
		return
	}

	// 重新从数据库加载用户信息，确保获取最新的LastLogin等信息
	updatedUser, err := models.GetUserByUID(db, user.ID)
	if err != nil {
		logger.Warn("Failed to reload user after login, using original user object", zap.Error(err))
		updatedUser = user // 如果加载失败，使用原始user对象
	} else {
		user = updatedUser // 使用更新后的用户信息
	}

	// 生成认证Token
	val := utils.GetValue(db, constants.KEY_AUTH_TOKEN_EXPIRED) // 7d
	expired, err := time.ParseDuration(val)
	if err != nil {
		logger.Warn("Failed to parse auth token expired duration, using default 7 days", zap.Error(err))
		// 7 days
		expired = 7 * 24 * time.Hour
	}
	user.AuthToken = models.BuildAuthToken(user, expired, false)

	// 15. 返回登录结果（包含可疑登录警告）
	responseData := gin.H{
		"user":  user,
		"token": user.AuthToken, // 为了兼容前端，同时返回token字段
	}
	if isSuspicious {
		responseData["suspiciousLogin"] = true
		responseData["message"] = "Login from new location detected. Please verify your identity."
	}

	logger.Info("Login successful", zap.String("email", form.Email), zap.Uint("userID", user.ID), zap.String("ip", clientIP))
	response.Success(c, "login successful", responseData)
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

	utils.Sig().Emit(models.SigUserCreate, user, c, db)

	r := gin.H{
		"email":      user.Email,
		"activation": user.Activated,
	}
	if !user.Activated && utils.GetBoolValue(db, constants.KEY_USER_ACTIVATED) {
		sendHashMail(db, user, models.SigUserVerifyEmail, constants.KEY_VERIFY_EMAIL_EXPIRED, "180d", c.ClientIP(), c.Request.UserAgent())
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
	utils.Sig().Emit(models.SigUserCreate, user, db)
	sendHashMail(db, user, models.SigUserVerifyEmail, constants.KEY_VERIFY_EMAIL_EXPIRED, "180d", c.ClientIP(), c.Request.UserAgent())
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
	if user.HasBasicInfo() {
		response.Fail(c, "user is already a basic info", nil)
		return
	}
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
	// 使用指针以检测字段是否存在，避免未提供字段被误设为 false
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
	utils.Sig().Emit(models.SigUserResetPassword, user, token, c.ClientIP(), c.Request.UserAgent())

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

	if user.EmailVerified {
		response.Fail(c, "Email already verified", errors.New("email already verified"))
		return
	}

	token, err := models.GenerateEmailVerifyToken(h.db, user)
	if err != nil {
		response.Fail(c, "Failed to generate verification token", err)
		return
	}

	// 发送邮箱验证邮件
	utils.Sig().Emit(models.SigUserVerifyEmail, user, token, c.ClientIP(), c.Request.UserAgent())

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

	// 获取存储实例 - 优先使用本地存储，避免七牛云配置问题
	store := stores.Default()

	// 如果用户已有头像且不是默认头像，删除旧头像
	if user.Avatar != "" && !isDefaultAvatar(user.Avatar) {
		// 从URL中提取文件路径
		oldKey := extractKeyFromURL(user.Avatar)
		if oldKey != "" {
			store.Delete(oldKey)
		}
	}

	// 上传新头像
	err = store.Write(fileName, file)
	if err != nil {
		response.Fail(c, "Failed to upload avatar", err)
		return
	}

	// 获取文件大小
	fileInfo, fileSize, err := store.Read(fileName)
	if err == nil && fileInfo != nil {
		fileInfo.Close()
	} else {
		// 如果无法读取文件大小，使用header中的大小
		fileSize = header.Size
	}

	// 记录存储使用量
	go func() {
		var credentialID uint
		credentials, err := models.GetUserCredentials(h.db, user.ID)
		if err == nil && len(credentials) > 0 {
			credentialID = credentials[0].ID
		}
		if fileSize > 0 {
			models.RecordStorageUsage(
				h.db,
				user.ID,
				credentialID,
				nil, // assistantID
				nil, // groupID
				fmt.Sprintf("avatar_%d_%d", user.ID, time.Now().Unix()),
				fileSize,
				fmt.Sprintf("上传头像: %s", fileName),
			)
		}
	}()

	// 更新用户头像URL
	avatarURL := store.PublicURL(fileName)

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
		store.Delete(fileName)
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
	// Send Mail
	mailer := notification.NewMailNotification(config.GlobalConfig.Mail)

	err = mailer.SendWelcomeEmail(
		user.Email,
		user.DisplayName,
		"https://yourapp.com/verify?token=abc123", // 验证链接
	)
	if err != nil {
		logger.Warn("send mail failed", zap.Error(err))
		return
	}
	utils.Sig().Emit(signame, user, hash, clientIp, useragent)
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
