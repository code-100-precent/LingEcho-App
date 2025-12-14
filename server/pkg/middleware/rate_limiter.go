package middleware

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/ulule/limiter/v3"
	_ "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

// RateLimiterConfig 企业级限流配置
//
// 示例：
// Rate: "100-M"、Identifier: "ip"/"user"/"header"、HeaderName: "X-Client-ID"
// PerRouteRates: {"/api/v1/heavy": "10-S", "/api/v1/normal": "100-S"}
// WhitelistCIDRs/BlacklistCIDRs: ["10.0.0.0/8", "127.0.0.1/32"]
// WhitelistUsers/BlacklistUsers: ["admin", "ops-*"] 支持前缀匹配
// SkipPaths: ["/health", "/metrics", "/static/"] 前缀匹配
// AddHeaders: 是否写标准限流响应头；DenyStatus/DenyMessage: 自定义拒绝响应
//
// Store 采用内存，可通过 SetRateLimiterStore 注入外部存储（如 Redis）。
type RateLimiterConfig struct {
	Rate           string            `json:"rate"`            // e.g. "100-M", "1000-H"
	PerRouteRates  map[string]string `json:"per_route_rates"` // 路由覆盖速率
	Identifier     string            `json:"identifier"`      // ip|user|header|ip+route
	HeaderName     string            `json:"header_name"`     // 当 identifier=header 时使用
	WhitelistCIDRs []string          `json:"whitelist_cidrs"`
	BlacklistCIDRs []string          `json:"blacklist_cidrs"`
	WhitelistUsers []string          `json:"whitelist_users"`
	BlacklistUsers []string          `json:"blacklist_users"`
	SkipPaths      []string          `json:"skip_paths"`
	AddHeaders     bool              `json:"add_headers"`
	DenyStatus     int               `json:"deny_status"` // 默认 429
	DenyMessage    string            `json:"deny_message"`
}

// StoreFactory 用于按需创建 store（例如基于 Redis 客户端）
type StoreFactory interface {
	Create() limiter.Store
}

// PrebuiltStoreFactory 直接复用已有的 limiter.Store（例如外部创建的 Redis store）
type PrebuiltStoreFactory struct{ Store limiter.Store }

func (p *PrebuiltStoreFactory) Create() limiter.Store { return p.Store }

// MetricsObserver 指标上报接口
// 可接 Prometheus、StatsD 等
type MetricsObserver interface {
	OnAllow(route string, key string)
	OnDeny(route string, key string)
}

// PrometheusObserver 基于 Prometheus 的实现
type PrometheusObserver struct {
	allow *prometheus.CounterVec
	deny  *prometheus.CounterVec
}

// NewPrometheusObserver 创建 Prometheus 观察者
func NewPrometheusObserver() *PrometheusObserver {
	return &PrometheusObserver{
		allow: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "rate_limit_allow_total",
			Help: "Allowed requests by rate limiter",
		}, []string{"route"}),
		deny: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "rate_limit_deny_total",
			Help: "Denied requests by rate limiter",
		}, []string{"route"}),
	}
}

func (p *PrometheusObserver) OnAllow(route, key string) { p.allow.WithLabelValues(route).Inc() }
func (p *PrometheusObserver) OnDeny(route, key string)  { p.deny.WithLabelValues(route).Inc() }

// RateLimiter 面向实例的限流器，支持按路由缓存多个 limiter
type RateLimiter struct {
	cfg            *RateLimiterConfig
	store          limiter.Store
	storeFactory   StoreFactory
	observer       MetricsObserver
	limitersByRate map[string]*limiter.Limiter // rate字符串 -> limiter
	mu             sync.RWMutex
	whiteCIDRs     []*net.IPNet
	blackCIDRs     []*net.IPNet
}

// NewRateLimiter 构造函数（推荐使用），避免全局依赖
func NewRateLimiter(cfg RateLimiterConfig, store limiter.Store) *RateLimiter {
	if store == nil {
		store = memory.NewStore()
	}
	l := &RateLimiter{
		cfg:            &cfg,
		store:          store,
		limitersByRate: make(map[string]*limiter.Limiter),
	}
	l.compileCIDRs()
	return l
}

// WithStoreFactory 配置存储工厂
func (l *RateLimiter) WithStoreFactory(factory StoreFactory) *RateLimiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.storeFactory = factory
	if factory != nil {
		l.store = factory.Create()
		l.limitersByRate = make(map[string]*limiter.Limiter) // 重建缓存
	}
	return l
}

// WithObserver 配置指标观察者
func (l *RateLimiter) WithObserver(observer MetricsObserver) *RateLimiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.observer = observer
	return l
}

// Middleware 返回 Gin 中间件
func (l *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := l.getConfig()

		if pathSkipped(*cfg, c.FullPath(), c.Request.URL.Path) {
			c.Next()
			return
		}

		clientIP := clientIPFromRequest(c)
		if ipListed(clientIP, l.whiteCIDRs) {
			c.Next()
			return
		}
		if ipListed(clientIP, l.blackCIDRs) {
			l.reportDeny(c, "blacklist")
			denyTooMany(c, *cfg, 0, 0, time.Time{})
			return
		}
		userID := currentUserID(c)
		if userListed(userID, cfg.WhitelistUsers) {
			c.Next()
			return
		}
		if userListed(userID, cfg.BlacklistUsers) {
			l.reportDeny(c, "user_blacklist")
			denyTooMany(c, *cfg, 0, 0, time.Time{})
			return
		}

		key := buildLimitKey(*cfg, c, clientIP, userID)
		rateStr := l.pickRateForRoute(cfg, c)
		lim := l.getLimiter(rateStr)

		context, err := lim.Get(c, key)
		if err != nil {
			c.Next()
			return
		}
		if cfg.AddHeaders {
			setStandardHeaders(c, context)
		}
		if context.Reached {
			retry := time.Until(time.Unix(context.Reset, 0))
			setRetryAfter(c, retry)
			l.reportDeny(c, key)
			denyTooMany(c, *cfg, int(context.Limit), int(context.Remaining), time.Unix(context.Reset, 0))
			return
		}

		l.reportAllow(c, key)
		c.Next()
	}
}

func (l *RateLimiter) reportAllow(c *gin.Context, key string) {
	l.mu.RLock()
	obs := l.observer
	l.mu.RUnlock()
	if obs != nil {
		r := c.FullPath()
		if r == "" {
			r = c.Request.URL.Path
		}
		obs.OnAllow(r, key)
	}
}

func (l *RateLimiter) reportDeny(c *gin.Context, key string) {
	l.mu.RLock()
	obs := l.observer
	l.mu.RUnlock()
	if obs != nil {
		r := c.FullPath()
		if r == "" {
			r = c.Request.URL.Path
		}
		obs.OnDeny(r, key)
	}
}

func (l *RateLimiter) getLimiter(rateStr string) *limiter.Limiter {
	l.mu.RLock()
	lim, ok := l.limitersByRate[rateStr]
	l.mu.RUnlock()
	if ok {
		return lim
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if lim, ok = l.limitersByRate[rateStr]; ok {
		return lim
	}
	store := l.store
	if l.storeFactory != nil {
		store = l.storeFactory.Create()
	}
	r, err := limiter.NewRateFromFormatted(rateStr)
	if err != nil {
		r = limiter.Rate{Period: time.Second, Limit: 10}
	}
	lim = limiter.New(store, r)
	l.limitersByRate[rateStr] = lim
	return lim
}

func (l *RateLimiter) pickRateForRoute(cfg *RateLimiterConfig, c *gin.Context) string {
	if cfg.PerRouteRates != nil {
		if full := c.FullPath(); full != "" {
			if r, ok := cfg.PerRouteRates[full]; ok && r != "" {
				return r
			}
		}
		if raw := c.Request.URL.Path; raw != "" {
			if r, ok := cfg.PerRouteRates[raw]; ok && r != "" {
				return r
			}
		}
	}
	if cfg.Rate != "" {
		return cfg.Rate
	}
	return "10-S"
}

func (l *RateLimiter) getConfig() *RateLimiterConfig {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.cfg
}

func (l *RateLimiter) UpdateConfig(cfg RateLimiterConfig) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.cfg = &cfg
	l.compileCIDRs()
}

func (l *RateLimiter) compileCIDRs() {
	l.whiteCIDRs = l.whiteCIDRs[:0]
	l.blackCIDRs = l.blackCIDRs[:0]
	for _, c := range l.cfg.WhitelistCIDRs {
		if _, ipnet, err := net.ParseCIDR(strings.TrimSpace(c)); err == nil {
			l.whiteCIDRs = append(l.whiteCIDRs, ipnet)
		}
	}
	for _, c := range l.cfg.BlacklistCIDRs {
		if _, ipnet, err := net.ParseCIDR(strings.TrimSpace(c)); err == nil {
			l.blackCIDRs = append(l.blackCIDRs, ipnet)
		}
	}
}

// -------------------- 以下为向后兼容的全局封装 --------------------
var (
	rateLimiterMutex  sync.RWMutex
	rateLimiterConfig = &RateLimiterConfig{Rate: "10-S", Identifier: "ip", AddHeaders: true, DenyStatus: http.StatusTooManyRequests}
	rlStore           limiter.Store
	globalRL          *RateLimiter
	compiledWhiteCIDR []*net.IPNet
	compiledBlackCIDR []*net.IPNet
)

// SetRateLimiterStore 注入外部存储（如 Redis store）
func SetRateLimiterStore(store limiter.Store) {
	rateLimiterMutex.Lock()
	defer rateLimiterMutex.Unlock()
	rlStore = store
	globalRL = nil
}

// SetRateLimiterConfig 动态更新限流配置
func SetRateLimiterConfig(config RateLimiterConfig) {
	rateLimiterMutex.Lock()
	defer rateLimiterMutex.Unlock()
	rateLimiterConfig = &config
	globalRL = nil
}

// GetRateLimiterConfig 获取当前配置（拷贝）
func GetRateLimiterConfig() RateLimiterConfig {
	rateLimiterMutex.RLock()
	defer rateLimiterMutex.RUnlock()
	return *rateLimiterConfig
}

// RateLimiterMiddleware 企业级限流中间件（全局版，兼容原接口）
func RateLimiterMiddleware() gin.HandlerFunc {
	ensureInitialized()
	return globalRL.Middleware()
}

// gin 官方中间件在每次请求创建 store/limiter，开销较大；我们缓存实例并支持动态更新
func ensureInitialized() {
	rateLimiterMutex.Lock()
	defer rateLimiterMutex.Unlock()
	if globalRL != nil {
		return
	}
	if rlStore == nil {
		rlStore = memory.NewStore()
	}
	compiledWhiteCIDR = compiledWhiteCIDR[:0]
	compiledBlackCIDR = compiledBlackCIDR[:0]
	for _, c := range rateLimiterConfig.WhitelistCIDRs {
		if _, ipnet, err := net.ParseCIDR(strings.TrimSpace(c)); err == nil {
			compiledWhiteCIDR = append(compiledWhiteCIDR, ipnet)
		}
	}
	for _, c := range rateLimiterConfig.BlacklistCIDRs {
		if _, ipnet, err := net.ParseCIDR(strings.TrimSpace(c)); err == nil {
			compiledBlackCIDR = append(compiledBlackCIDR, ipnet)
		}
	}
	inst := NewRateLimiter(*rateLimiterConfig, rlStore)
	inst.whiteCIDRs = compiledWhiteCIDR
	inst.blackCIDRs = compiledBlackCIDR
	globalRL = inst
}

// 兼容函数，供旧逻辑使用
func pathSkipped(cfg RateLimiterConfig, fullPath, rawPath string) bool {
	if len(cfg.SkipPaths) == 0 {
		return false
	}
	p := fullPath
	if p == "" {
		p = rawPath
	}
	for _, pref := range cfg.SkipPaths {
		if pref == "" {
			continue
		}
		if strings.HasPrefix(p, pref) {
			return true
		}
	}
	return false
}

func clientIPFromRequest(c *gin.Context) string {
	ip := c.ClientIP()
	if strings.HasPrefix(ip, "::ffff:") {
		ip = strings.TrimPrefix(ip, "::ffff:")
	}
	return ip
}

func currentUserID(c *gin.Context) string {
	v, ok := c.Get("user_id")
	if !ok {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func ipListed(ip string, nets []*net.IPNet) bool {
	if ip == "" {
		return false
	}
	pip := net.ParseIP(ip)
	if pip == nil {
		return false
	}
	for _, n := range nets {
		if n.Contains(pip) {
			return true
		}
	}
	return false
}

func userListed(user string, patterns []string) bool {
	if user == "" || len(patterns) == 0 {
		return false
	}
	for _, p := range patterns {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if strings.HasSuffix(p, "*") {
			if strings.HasPrefix(user, strings.TrimSuffix(p, "*")) {
				return true
			}
			continue
		}
		if user == p {
			return true
		}
	}
	return false
}

func buildLimitKey(cfg RateLimiterConfig, c *gin.Context, ip, user string) string {
	switch cfg.Identifier {
	case "user":
		if user != "" {
			return "user:" + user
		}
		return "ip:" + ip
	case "header":
		hv := strings.TrimSpace(c.GetHeader(cfg.HeaderName))
		if hv != "" {
			return "hdr:" + cfg.HeaderName + ":" + hv
		}
		return "ip:" + ip
	case "ip+route":
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}
		return "iprt:" + ip + ":" + route
	default: // ip
		return "ip:" + ip
	}
}

func setStandardHeaders(c *gin.Context, ctx limiter.Context) {
	c.Header("X-RateLimit-Limit", int64ToString(ctx.Limit))
	c.Header("X-RateLimit-Remaining", int64ToString(ctx.Remaining))
	resetSec := int(time.Until(time.Unix(ctx.Reset, 0)).Seconds())
	if resetSec < 0 {
		resetSec = 0
	}
	c.Header("X-RateLimit-Reset", strconv.Itoa(resetSec))
}

func setRetryAfter(c *gin.Context, d time.Duration) {
	sec := int(d.Seconds())
	if sec < 0 {
		sec = 0
	}
	c.Header("Retry-After", strconv.Itoa(sec))
}

func int64ToString(v int64) string {
	return strconv.FormatInt(v, 10)
}

func denyTooMany(c *gin.Context, cfg RateLimiterConfig, limit, remaining int, reset time.Time) {
	status := cfg.DenyStatus
	if status == 0 {
		status = http.StatusTooManyRequests
	}
	msg := cfg.DenyMessage
	if msg == "" {
		msg = "Too Many Requests"
	}
	c.AbortWithStatusJSON(status, gin.H{"error": msg})
}
