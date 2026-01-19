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

// 预定义的常用错误 - 认证相关
var (
	// 用户认证错误
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

	// 参数验证错误
	ErrInvalidParameterError = New(ErrInvalidInput, "参数错误")
	ErrMissingParameterError = New(ErrInvalidInput, "缺少必要参数")
	ErrInvalidFormatError    = New(ErrInvalidInput, "参数格式错误")
	ErrInvalidIDError        = New(ErrInvalidInput, "无效的ID")

	// 权限相关错误
	ErrUnauthorizedError     = New(ErrUnauthorized, "未授权")
	ErrForbiddenError        = New(ErrForbidden, "权限不足")
	ErrInsufficientPermError = New(ErrForbidden, "权限不足")

	// 资源相关错误
	ErrResourceNotFoundError = New(ErrNotFound, "资源不存在")
	ErrResourceExistsError   = New(ErrConflict, "资源已存在")
	ErrResourceLockedError   = New(ErrConflict, "资源被锁定")

	// 业务逻辑错误
	ErrOperationFailedError = New(ErrInternalServer, "操作失败")
	ErrCreateFailedError    = New(ErrInternalServer, "创建失败")
	ErrUpdateFailedError    = New(ErrInternalServer, "更新失败")
	ErrDeleteFailedError    = New(ErrInternalServer, "删除失败")
	ErrQueryFailedError     = New(ErrInternalServer, "查询失败")

	// 文件相关错误
	ErrFileNotFoundError     = New(ErrNotFound, "文件不存在")
	ErrFileUploadFailedError = New(ErrInternalServer, "文件上传失败")
	ErrFileFormatError       = New(ErrInvalidInput, "文件格式错误")
	ErrFileSizeError         = New(ErrInvalidInput, "文件大小超限")

	// 网络相关错误
	ErrNetworkError            = New(ErrServiceUnavailable, "网络错误")
	ErrTimeoutError            = New(ErrServiceUnavailable, "请求超时")
	ErrServiceUnavailableError = New(ErrServiceUnavailable, "服务不可用")

	// 数据库相关错误
	ErrDatabaseError           = New(ErrInternalServer, "数据库错误")
	ErrDatabaseConnectionError = New(ErrInternalServer, "数据库连接失败")
	ErrRecordNotFoundError     = New(ErrNotFound, "记录不存在")
	ErrDuplicateRecordError    = New(ErrConflict, "记录已存在")

	// 配置相关错误
	ErrConfigError         = New(ErrInternalServer, "配置错误")
	ErrConfigNotFoundError = New(ErrNotFound, "配置不存在")
	ErrConfigInvalidError  = New(ErrInvalidInput, "配置无效")
)

// 便捷的错误创建函数
func NewUserNotFoundError(details ...string) *AppError {
	err := New(ErrUserNotFound, "用户不存在")
	if len(details) > 0 {
		err = err.WithDetails("reason", details[0])
	}
	return err
}

func NewInvalidCredentialsError(details ...string) *AppError {
	err := New(ErrInvalidCredentials, "认证失败")
	if len(details) > 0 {
		err = err.WithDetails("reason", details[0])
	}
	return err
}

func NewParameterError(field string, reason ...string) *AppError {
	err := New(ErrInvalidInput, "参数错误").WithDetails("field", field)
	if len(reason) > 0 {
		err = err.WithDetails("reason", reason[0])
	}
	return err
}

func NewUnauthorizedError(reason ...string) *AppError {
	err := New(ErrUnauthorized, "未授权")
	if len(reason) > 0 {
		err = err.WithDetails("reason", reason[0])
	}
	return err
}

func NewResourceNotFoundError(resource string, id ...string) *AppError {
	err := New(ErrNotFound, "资源不存在").WithDetails("resource", resource)
	if len(id) > 0 {
		err = err.WithDetails("id", id[0])
	}
	return err
}
