<<<<<<< HEAD
package middleware

import (
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/sessions/memstore"
	"github.com/gin-gonic/gin"
)

// CorsMiddleware 跨域处理中间件
func CorsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// 设置 CORS 头
		if origin != "" {
			// 允许具体的 Origin
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin") // 避免缓存污染
		} else {
			// 如果没有Origin头，允许所有来源（开发环境）
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true") // 允许携带 Cookie
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, X-API-KEY, X-API-SECRET, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")

		// 处理预检请求
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		// 继续处理请求，确保 CORS 头在所有响应中都存在
		c.Next()

		// 确保响应中也包含 CORS 头（处理重定向等情况）
		if c.Writer.Header().Get("Access-Control-Allow-Origin") == "" {
			if origin != "" {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			}
		}
	}
}

func WithMemSession(secret string) gin.HandlerFunc {
	store := memstore.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: 0})
	return sessions.Sessions(GetCarrotSessionField(), store)
}

func WithCookieSession(secret string, maxAge int) gin.HandlerFunc {
	store := cookie.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: maxAge})
	return sessions.Sessions(GetCarrotSessionField(), store)
}

func GetCarrotSessionField() string {
	v := utils.GetEnv(constants.ENV_SESSION_FIELD)
	if v == "" {
		return "lingecho"
	}
	return v
}

// SecurityMiddlewareChain 安全中间件链
func SecurityMiddlewareChain() []gin.HandlerFunc {
	config := DefaultSecurityConfig()

	return []gin.HandlerFunc{
		// 1. 基础安全头
		SecurityMiddleware(config),

		// 2. XSS防护
		XSSProtectionMiddleware(),

		// 3. 输入验证
		InputValidationMiddleware(),

		// 4. CSRF保护（仅对状态改变的操作）
		CSRFMiddleware(config),
	}
}

// ApplySecurityMiddleware 应用安全中间件到路由组
func ApplySecurityMiddleware(r *gin.RouterGroup) {
	middlewares := SecurityMiddlewareChain()
	for _, middleware := range middlewares {
		r.Use(middleware)
	}
}
=======
package middleware

import (
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-contrib/sessions/memstore"
	"github.com/gin-gonic/gin"
)

// CorsMiddleware handles cross-origin resource sharing
func CorsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Set CORS headers
		if origin != "" {
			// Allow specific Origin
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin") // Avoid cache pollution
		} else {
			// If no Origin header, allow all origins (development environment)
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true") // Allow cookies
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, X-API-KEY, X-API-SECRET, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		// Continue processing request, ensure CORS headers exist in all responses
		c.Next()

		// Ensure CORS headers are also included in response (handle redirects etc.)
		if c.Writer.Header().Get("Access-Control-Allow-Origin") == "" {
			if origin != "" {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			}
		}
	}
}

func WithMemSession(secret string) gin.HandlerFunc {
	store := memstore.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: 0})
	return sessions.Sessions(GetCarrotSessionField(), store)
}

func WithCookieSession(secret string, maxAge int) gin.HandlerFunc {
	store := cookie.NewStore([]byte(secret))
	store.Options(sessions.Options{Path: "/", MaxAge: maxAge})
	return sessions.Sessions(GetCarrotSessionField(), store)
}

func GetCarrotSessionField() string {
	v := utils.GetEnv(constants.ENV_SESSION_FIELD)
	if v == "" {
		return "lingecho"
	}
	return v
}

// SecurityMiddlewareChain returns security middleware chain
func SecurityMiddlewareChain() []gin.HandlerFunc {
	config := DefaultSecurityConfig()

	return []gin.HandlerFunc{
		// 1. Basic security headers
		SecurityMiddleware(config),

		// 2. XSS protection
		XSSProtectionMiddleware(),

		// 3. Input validation
		InputValidationMiddleware(),

		// 4. CSRF protection (only for state-changing operations)
		CSRFMiddleware(config),
	}
}

// ApplySecurityMiddleware applies security middleware to router group
func ApplySecurityMiddleware(r *gin.RouterGroup) {
	middlewares := SecurityMiddlewareChain()
	for _, middleware := range middlewares {
		r.Use(middleware)
	}
}
>>>>>>> 3dfadd85bd518bde3e99c3d51af6bb1fe0a2141c
