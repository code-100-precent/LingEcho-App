package errors

import (
	"fmt"
	"net/http"
)

// ErrorCode 错误码
type ErrorCode string

const (
	// 通用错误
	ErrInvalidInput       ErrorCode = "INVALID_INPUT"
	ErrUnauthorized       ErrorCode = "UNAUTHORIZED"
	ErrForbidden          ErrorCode = "FORBIDDEN"
	ErrNotFound           ErrorCode = "NOT_FOUND"
	ErrConflict           ErrorCode = "CONFLICT"
	ErrInternalServer     ErrorCode = "INTERNAL_SERVER_ERROR"
	ErrServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"

	// 认证相关
	ErrInvalidCredentials ErrorCode = "INVALID_CREDENTIALS"
	ErrAccountLocked      ErrorCode = "ACCOUNT_LOCKED"
	ErrEmailNotVerified   ErrorCode = "EMAIL_NOT_VERIFIED"
	ErrTwoFactorRequired  ErrorCode = "TWO_FACTOR_REQUIRED"
	ErrDeviceNotTrusted   ErrorCode = "DEVICE_NOT_TRUSTED"

	// 业务相关
	ErrUserNotFound      ErrorCode = "USER_NOT_FOUND"
	ErrEmailExists       ErrorCode = "EMAIL_EXISTS"
	ErrRateLimitExceeded ErrorCode = "RATE_LIMIT_EXCEEDED"
	ErrCaptchaInvalid    ErrorCode = "CAPTCHA_INVALID"
	ErrCaptchaRequired   ErrorCode = "CAPTCHA_REQUIRED"

	// 数据库相关
	ErrDatabaseConnection ErrorCode = "DATABASE_CONNECTION_ERROR"
	ErrDatabaseQuery      ErrorCode = "DATABASE_QUERY_ERROR"
	ErrRecordNotFound     ErrorCode = "RECORD_NOT_FOUND"
	ErrDuplicateRecord    ErrorCode = "DUPLICATE_RECORD"
)

// AppError 应用错误
type AppError struct {
	Code       ErrorCode              `json:"code"`
	Message    string                 `json:"message"`
	StatusCode int                    `json:"-"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Cause      error                  `json:"-"`
}

// Error 实现 error 接口
func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// New 创建新的应用错误
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: getStatusCode(code),
		Details:    make(map[string]interface{}),
	}
}

// Wrap 包装错误
func Wrap(err error, code ErrorCode, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: getStatusCode(code),
		Cause:      err,
		Details:    make(map[string]interface{}),
	}
}

// WithDetails 添加错误详情
func (e *AppError) WithDetails(key string, value interface{}) *AppError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// WithCause 添加原因错误
func (e *AppError) WithCause(cause error) *AppError {
	e.Cause = cause
	return e
}

// getStatusCode 获取 HTTP 状态码
func getStatusCode(code ErrorCode) int {
	switch code {
	case ErrInvalidInput, ErrCaptchaInvalid, ErrCaptchaRequired:
		return http.StatusBadRequest
	case ErrUnauthorized, ErrInvalidCredentials:
		return http.StatusUnauthorized
	case ErrForbidden, ErrAccountLocked, ErrEmailNotVerified:
		return http.StatusForbidden
	case ErrNotFound, ErrUserNotFound, ErrRecordNotFound:
		return http.StatusNotFound
	case ErrConflict, ErrEmailExists, ErrDuplicateRecord:
		return http.StatusConflict
	case ErrRateLimitExceeded:
		return http.StatusTooManyRequests
	case ErrServiceUnavailable:
		return http.StatusServiceUnavailable
	case ErrTwoFactorRequired, ErrDeviceNotTrusted:
		return http.StatusPreconditionRequired
	default:
		return http.StatusInternalServerError
	}
}

// IsAppError 检查是否为应用错误
func IsAppError(err error) bool {
	_, ok := err.(*AppError)
	return ok
}

// GetAppError 获取应用错误
func GetAppError(err error) *AppError {
	if appErr, ok := err.(*AppError); ok {
		return appErr
	}
	return nil
}

// 预定义的常用错误
var (
	ErrUserNotFoundError      = New(ErrUserNotFound, "用户不存在")
	ErrInvalidPasswordError   = New(ErrInvalidCredentials, "密码错误")
	ErrEmailExistsError       = New(ErrEmailExists, "邮箱已存在")
	ErrAccountLockedError     = New(ErrAccountLocked, "账户已被锁定")
	ErrEmailNotVerifiedError  = New(ErrEmailNotVerified, "邮箱未验证")
	ErrTwoFactorRequiredError = New(ErrTwoFactorRequired, "需要两步验证")
	ErrDeviceNotTrustedError  = New(ErrDeviceNotTrusted, "设备未受信任")
	ErrCaptchaInvalidError    = New(ErrCaptchaInvalid, "验证码错误")
	ErrCaptchaRequiredError   = New(ErrCaptchaRequired, "需要验证码")
	ErrRateLimitError         = New(ErrRateLimitExceeded, "请求过于频繁")
)
