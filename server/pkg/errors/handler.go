package errors

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ErrorResponse 错误响应
type ErrorResponse struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// HandleError 处理错误并返回响应
func HandleError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	// 获取 logger
	logger := getLogger(c)

	if appErr, ok := err.(*AppError); ok {
		// 记录应用错误
		if appErr.StatusCode >= 500 {
			logger.Error("Application error",
				zap.String("code", string(appErr.Code)),
				zap.String("message", appErr.Message),
				zap.Error(appErr.Cause),
				zap.Any("details", appErr.Details))
		} else {
			logger.Warn("Application error",
				zap.String("code", string(appErr.Code)),
				zap.String("message", appErr.Message),
				zap.Error(appErr.Cause))
		}

		c.JSON(appErr.StatusCode, ErrorResponse{
			Code:    string(appErr.Code),
			Message: appErr.Message,
			Details: appErr.Details,
		})
	} else {
		// 记录未知错误
		logger.Error("Unexpected error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    string(ErrInternalServer),
			Message: "Internal server error",
		})
	}
}

// ErrorHandlingMiddleware 错误处理中间件
func ErrorHandlingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				logger := getLogger(c)
				logger.Error("Panic recovered", zap.Any("panic", r))

				c.JSON(http.StatusInternalServerError, ErrorResponse{
					Code:    string(ErrInternalServer),
					Message: "Internal server error",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// RespondSuccess 返回成功响应
func RespondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{
		"code": 200,
		"msg":  "success",
		"data": data,
	})
}

// RespondError 返回错误响应
func RespondError(c *gin.Context, err error) {
	HandleError(c, err)
}

// getLogger 获取 logger
func getLogger(c *gin.Context) *zap.Logger {
	if logger, exists := c.Get("logger"); exists {
		if zapLogger, ok := logger.(*zap.Logger); ok {
			return zapLogger
		}
	}
	return zap.L()
}

// 便捷的错误响应函数
func BadRequest(c *gin.Context, message string) {
	HandleError(c, New(ErrInvalidInput, message))
}

func Unauthorized(c *gin.Context, message string) {
	HandleError(c, New(ErrUnauthorized, message))
}

func Forbidden(c *gin.Context, message string) {
	HandleError(c, New(ErrForbidden, message))
}

func NotFound(c *gin.Context, message string) {
	HandleError(c, New(ErrNotFound, message))
}

func Conflict(c *gin.Context, message string) {
	HandleError(c, New(ErrConflict, message))
}

func InternalServerError(c *gin.Context, message string) {
	HandleError(c, New(ErrInternalServer, message))
}

func RateLimitExceeded(c *gin.Context, message string) {
	HandleError(c, New(ErrRateLimitExceeded, message))
}
