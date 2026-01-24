<<<<<<< HEAD
package handlers

import (
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/middleware"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
)

// handleGetMiddlewareStats 获取中间件统计信息
func (h *Handlers) handleGetMiddlewareStats(c *gin.Context) {
	stats := middleware.GetGlobalMiddlewareStats()

	response.Success(c, "Middleware statistics retrieved successfully", gin.H{
		"stats": stats,
	})
}

// handleUpdateRateLimitConfig 更新限流配置
func (h *Handlers) handleUpdateRateLimitConfig(c *gin.Context) {
	var cfg config.RateLimiterConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.Fail(c, "Invalid configuration format", err)
		return
	}

	mgr := middleware.GetGlobalMiddlewareManager()
	mgr.UpdateRateLimitConfig(cfg)

	response.Success(c, "Rate limit configuration updated successfully", nil)
}

// handleUpdateTimeoutConfig 更新超时配置
func (h *Handlers) handleUpdateTimeoutConfig(c *gin.Context) {
	var cfg config.TimeoutConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.Fail(c, "Invalid configuration format", err)
		return
	}

	mgr := middleware.GetGlobalMiddlewareManager()
	mgr.UpdateTimeoutConfig(cfg)

	response.Success(c, "Timeout configuration updated successfully", nil)
}

// handleUpdateCircuitBreakerConfig 更新熔断器配置
func (h *Handlers) handleUpdateCircuitBreakerConfig(c *gin.Context) {
	var cfg config.CircuitBreakerConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.Fail(c, "Invalid configuration format", err)
		return
	}

	mgr := middleware.GetGlobalMiddlewareManager()
	mgr.UpdateCircuitBreakerConfig(cfg)

	response.Success(c, "Circuit breaker configuration updated successfully", nil)
}

// registerMiddlewareRoutes 注册中间件相关路由
func (h *Handlers) registerMiddlewareRoutes(r *gin.RouterGroup) {
	middleware := r.Group("/middleware")
	{
		// 获取中间件统计信息（需要管理员权限）
		middleware.GET("/stats", h.handleGetMiddlewareStats)

		// 动态更新配置（需要管理员权限）
		middleware.PUT("/rate-limit/config", h.handleUpdateRateLimitConfig)
		middleware.PUT("/timeout/config", h.handleUpdateTimeoutConfig)
		middleware.PUT("/circuit-breaker/config", h.handleUpdateCircuitBreakerConfig)
	}
}
=======
package handlers

import (
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/middleware"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
)

// handleGetMiddlewareStats retrieves middleware statistics
func (h *Handlers) handleGetMiddlewareStats(c *gin.Context) {
	stats := middleware.GetGlobalMiddlewareStats()

	response.Success(c, "Middleware statistics retrieved successfully", gin.H{
		"stats": stats,
	})
}

// handleUpdateRateLimitConfig updates rate limiting configuration
func (h *Handlers) handleUpdateRateLimitConfig(c *gin.Context) {
	var cfg config.RateLimiterConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.Fail(c, "Invalid configuration format", err)
		return
	}

	mgr := middleware.GetGlobalMiddlewareManager()
	mgr.UpdateRateLimitConfig(cfg)

	response.Success(c, "Rate limit configuration updated successfully", nil)
}

// handleUpdateTimeoutConfig updates timeout configuration
func (h *Handlers) handleUpdateTimeoutConfig(c *gin.Context) {
	var cfg config.TimeoutConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.Fail(c, "Invalid configuration format", err)
		return
	}

	mgr := middleware.GetGlobalMiddlewareManager()
	mgr.UpdateTimeoutConfig(cfg)

	response.Success(c, "Timeout configuration updated successfully", nil)
}

// handleUpdateCircuitBreakerConfig updates circuit breaker configuration
func (h *Handlers) handleUpdateCircuitBreakerConfig(c *gin.Context) {
	var cfg config.CircuitBreakerConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.Fail(c, "Invalid configuration format", err)
		return
	}

	mgr := middleware.GetGlobalMiddlewareManager()
	mgr.UpdateCircuitBreakerConfig(cfg)

	response.Success(c, "Circuit breaker configuration updated successfully", nil)
}

// registerMiddlewareRoutes registers middleware-related routes
func (h *Handlers) registerMiddlewareRoutes(r *gin.RouterGroup) {
	middleware := r.Group("/middleware")
	{
		// Get middleware statistics (requires admin privileges)
		middleware.GET("/stats", h.handleGetMiddlewareStats)

		// Dynamic configuration updates (requires admin privileges)
		middleware.PUT("/rate-limit/config", h.handleUpdateRateLimitConfig)
		middleware.PUT("/timeout/config", h.handleUpdateTimeoutConfig)
		middleware.PUT("/circuit-breaker/config", h.handleUpdateCircuitBreakerConfig)
	}
}
>>>>>>> 3dfadd85bd518bde3e99c3d51af6bb1fe0a2141c
