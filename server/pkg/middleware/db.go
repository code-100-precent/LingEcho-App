package middleware

import (
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// InjectDB 注入数据库实例到 Gin 上下文
func InjectDB(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(constants.DbField, db)
		c.Next()
	}
}
