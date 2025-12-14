package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/code-100-precent/LingEcho"
	"github.com/code-100-precent/LingEcho/cmd/bootstrap"
	handlers "github.com/code-100-precent/LingEcho/internal/handler"
	"github.com/code-100-precent/LingEcho/internal/listeners"
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/internal/task"
	workflowdef "github.com/code-100-precent/LingEcho/internal/workflow"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/metrics"
	"github.com/code-100-precent/LingEcho/pkg/middleware"
	"github.com/code-100-precent/LingEcho/pkg/prompt"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/code-100-precent/LingEcho/pkg/utils/backup"
	"github.com/code-100-precent/LingEcho/pkg/utils/search"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type LingEchoApp struct {
	db       *gorm.DB
	handlers *handlers.Handlers
}

func NewLingEchoApp(db *gorm.DB) *LingEchoApp {
	return &LingEchoApp{
		db:       db,
		handlers: handlers.NewHandlers(db),
	}
}

func (app *LingEchoApp) RegisterRoutes(r *gin.Engine) {
	// Register system routes (with /api prefix)
	app.handlers.Register(r)

	// Register file upload handler
	handlers.NewUploadHandler().Register(r)
}

func main() {
	// 1. Print Banner
	if err := bootstrap.PrintBannerFromFile("banner.txt"); err != nil {
		log.Fatalf("unload banner: %v", err)
	}

	// 2. Parse Command Line Parameters
	mode := flag.String("mode", "", "running environment (development, test, production)")
	initSQL := flag.String("init-sql", "", "path to database init .sql script (optional)")
	flag.Parse()

	// 3. Set Environment Variables
	if *mode != "" {
		os.Setenv("APP_ENV", *mode)
	}

	// 4. Load Global Configuration
	if err := config.Load(); err != nil {
		panic("config load failed: " + err.Error())
	}

	// 5. Load Log Configuration
	err := logger.Init(&config.GlobalConfig.Log, config.GlobalConfig.Mode)
	if err != nil {
		panic(err)
	}

	// 6. Print Configuration
	bootstrap.LogConfigInfo()

	// 7. Load Data Source
	db, err := bootstrap.SetupDatabase(os.Stdout, &bootstrap.Options{
		InitSQLPath: *initSQL,                             // Can be specified via --init-sql
		AutoMigrate: false,                                // Whether to migrate entities
		SeedNonProd: os.Getenv("APP_ENV") != "production", // Non-production default configuration
	})
	if err != nil {
		logger.Error("database setup failed", zap.Error(err))
		return
	}

	// 8. Load Base Configs
	var addr = config.GlobalConfig.Addr
	if addr == "" {
		addr = ":8000"
	}

	var DBDriver = config.GlobalConfig.DBDriver
	if DBDriver == "" {
		DBDriver = "sqlite"
	}

	var DSN = config.GlobalConfig.DSN
	if DSN == "" {
		DSN = "file::memory:?cache=shared"
	}
	flag.StringVar(&addr, "addr", addr, "HTTP Serve address")
	flag.StringVar(&DBDriver, "db-driver", DBDriver, "database driver")
	flag.StringVar(&DSN, "dsn", DSN, "database source name")

	logger.Info("checked config -- addr: ", zap.String("addr", addr))
	logger.Info("checked config -- db-driver: ", zap.String("db-driver", DBDriver), zap.String("dsn", DSN))
	logger.Info("checked config -- mode: ", zap.String("mode", config.GlobalConfig.Mode))

	// 9. Load Global Cache (new cache system)
	if err := cache.InitGlobalCache(config.GlobalConfig.Cache); err != nil {
		logger.Error("failed to initialize cache", zap.Error(err))
		logger.Info("falling back to default local cache")
	}
	utils.InitGlobalCache(1024, 5*time.Minute)

	// 10. Load Prompt System
	err = prompt.InitPromptSystem(db)
	if err != nil {
		logger.Error("init prompt system failed: ", zap.Error(err))
	}

	//// 11. New App
	app := NewLingEchoApp(db)

	// 12. Initialize Monitoring System
	// Optimized for small memory servers: Reduce monitoring system memory usage
	// Can be overridden via environment variables, default values suitable for 2GB memory servers
	maxSpansEnv := utils.GetIntEnv("METRICS_MAX_SPANS")
	maxQueriesEnv := utils.GetIntEnv("METRICS_MAX_QUERIES")
	maxStatsEnv := utils.GetIntEnv("METRICS_MAX_STATS")

	maxSpans := int(maxSpansEnv)
	if maxSpans == 0 {
		maxSpans = 500 // Default 500 (originally 10000), reducing 95% memory usage
	}

	maxQueries := int(maxQueriesEnv)
	if maxQueries == 0 {
		maxQueries = 500 // Default 500 (originally 10000), reducing 95% memory usage
	}

	maxStats := int(maxStatsEnv)
	if maxStats == 0 {
		maxStats = 100 // Default 100 (originally 1000), reducing 90% memory usage
	}

	// Tracing feature consumes the most memory, disabled by default
	enableTracing := utils.GetBoolEnv("METRICS_ENABLE_TRACING")
	enableSQLAnalysis := utils.GetBoolEnv("METRICS_ENABLE_SQL_ANALYSIS")
	if !enableSQLAnalysis && utils.GetEnv("METRICS_ENABLE_SQL_ANALYSIS") == "" {
		enableSQLAnalysis = true // Enable SQL analysis by default
	}
	enableSystemMonitor := utils.GetBoolEnv("METRICS_ENABLE_SYSTEM_MONITOR")
	if !enableSystemMonitor && utils.GetEnv("METRICS_ENABLE_SYSTEM_MONITOR") == "" {
		enableSystemMonitor = true // Enable system monitoring by default
	}

	monitor := metrics.NewMonitor(&metrics.MonitorConfig{
		EnableMetrics:       true,
		EnableTracing:       enableTracing,
		MaxSpans:            maxSpans,
		EnableSQLAnalysis:   enableSQLAnalysis,
		MaxQueries:          maxQueries,
		SlowThreshold:       100 * time.Millisecond,
		EnableSystemMonitor: enableSystemMonitor,
		MaxStats:            maxStats,
		MonitorInterval:     30 * time.Second,
	})

	// 13. Set Global Monitor
	metrics.SetGlobalMonitor(monitor)

	monitor.Start()
	defer monitor.Stop()

	// 14. Start Timed task
	go task.StartOfflineChecker(db)
	// Start Email Cleaner Task
	task.StartEmailCleaner(db)
	// Start Quota Alert Checker
	task.StartQuotaAlertChecker(db)
	// Start Backup Data
	if config.GlobalConfig.BackupEnabled {
		backup.StartBackupScheduler()
	}

	// 15. Initialize Gin Routing
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()        // Use gin.New() instead of gin.Default() to avoid automatic redirects
	r.Use(gin.Recovery()) // Manually add Recovery middleware
	r.LoadHTMLGlob("templates/**/**")

	// Disable automatic redirects to avoid CORS issues caused by 307 redirects
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false

	// Set maximum memory limit for multipart forms (32MB)
	r.MaxMultipartMemory = 32 << 20 // 32 MB

	// 16. use middleware
	// Monitoring Middleware
	r.Use(metrics.MonitorMiddleware(monitor))

	// Cookie Register
	secret := utils.GetEnv(constants.ENV_SESSION_SECRET)
	if secret != "" {
		expireDays := utils.GetIntEnv(constants.ENV_SESSION_EXPIRE_DAYS)
		if expireDays <= 0 {
			expireDays = 7
		}
		r.Use(middleware.WithCookieSession(secret, int(expireDays)*24*3600))
	} else {
		r.Use(middleware.WithMemSession(utils.RandText(32)))
	}

	// Cors Handle Middleware
	r.Use(middleware.CorsMiddleware())

	// Logger Handle Middleware
	r.Use(middleware.LoggerMiddleware(zap.L()))

	// RateLimit Middleware - Loosen rate limiting configuration
	middleware.SetRateLimiterConfig(middleware.RateLimiterConfig{
		Rate:        "1000-M", // 1000 requests per minute, much more relaxed than the default 10 per second
		Identifier:  "ip",
		AddHeaders:  true,
		DenyStatus:  429,
		DenyMessage: "Requests too frequent, please try again later",
		PerRouteRates: map[string]string{
			"/api/voice/oneshot": "100-M", // Voice interface slightly stricter
			"/api/chat/call":     "50-M",  // Real-time call interface
			"/api/assistant":     "200-M", // Assistant-related interface
		},
		SkipPaths: []string{
			"/health",
			"/metrics",
			"/static/",
			"/media/",
		},
	})
	r.Use(middleware.RateLimiterMiddleware())

	// Assets Middleware
	r.Use(LingEcho.WithStaticAssets(r, utils.GetEnv(constants.ENV_STATIC_PREFIX), utils.GetEnv(constants.ENV_STATIC_ROOT)))

	// Static service for uploaded files
	uploadDir := utils.GetEnv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	// 同时注册 /media 和 /api/media 以支持反向代理
	r.Static("/media", uploadDir)
	apiPrefix := config.GlobalConfig.APIPrefix
	if apiPrefix == "" {
		apiPrefix = "/api"
	}
	r.Static(apiPrefix+"/media", uploadDir)

	// Add /api/static route to serve static files under API prefix
	// This is needed for SDK files accessed via /api/static/js/lingecho-sdk.js
	staticRootDir := utils.GetEnv(constants.ENV_STATIC_ROOT)
	if staticRootDir == "" {
		staticRootDir = "static"
	}
	staticAssets := LingEcho.NewCombineEmbedFS(LingEcho.HintAssetsRoot(staticRootDir), LingEcho.EmbedFS{"static", LingEcho.EmbedStaticAssets})
	apiPrefix = config.GlobalConfig.APIPrefix
	if apiPrefix == "" {
		apiPrefix = "/api"
	}
	r.StaticFS(apiPrefix+"/static", http.FS(staticAssets))

	// 18. Register Routes
	app.RegisterRoutes(r)

	// 18.6. Register Metrics Monitor Routes
	// Get API prefix from config (default: /api)
	apiPrefix = config.GlobalConfig.APIPrefix
	if apiPrefix == "" {
		apiPrefix = "/api"
	}
	// Get monitor prefix from config (default: /metrics)
	monitorPrefix := config.GlobalConfig.MonitorPrefix
	if monitorPrefix == "" {
		monitorPrefix = "/metrics"
	}
	// Combine API prefix with monitor prefix: /api/metrics
	fullMonitorPrefix := apiPrefix + monitorPrefix
	monitorGroup := r.Group(fullMonitorPrefix)
	monitorAPI := metrics.NewMonitorAPI(monitor)
	monitorAPI.RegisterRoutes(monitorGroup)
	logger.Info("Metrics monitor routes registered", zap.String("prefix", fullMonitorPrefix))

	// 19. Initialize System Listener
	// Initialize system listener (pass in database connection)
	listeners.InitLLMListenerWithDB(db)
	listeners.InitBillingListenerWithDB(db)
	listeners.InitSystemListeners()

	// 20. Start Search Indexer (if enabled)
	searchEnabled := utils.GetBoolValue(db, constants.KEY_SEARCH_ENABLED)
	if !searchEnabled && config.GlobalConfig != nil {
		searchEnabled = config.GlobalConfig.SearchEnabled
	}

	if searchEnabled {
		// Get search engine instance
		var searchEngine search.Engine
		if app.handlers.GetSearchHandler() != nil {
			searchEngine = app.handlers.GetSearchHandler().GetEngine()
		}
		if searchEngine != nil {
			// Start scheduled task
			task.StartSearchIndexer(db, searchEngine)
			// Asynchronously execute initial indexing (delayed execution to avoid memory spikes at startup)
			// For small memory servers, you can set environment variable SEARCH_DELAY_INDEX=true to delay indexing
			delayIndex := utils.GetBoolEnv("SEARCH_DELAY_INDEX")
			if delayIndex {
				// Delay 30 seconds before executing indexing, giving time for system startup
				go func() {
					time.Sleep(30 * time.Second)
					task.IndexUserDataAsync(db, searchEngine)
				}()
			} else {
				// Execute immediately by default (maintain original behavior)
				task.IndexUserDataAsync(db, searchEngine)
			}
		}
	}

	// 21. Emit system initialization signal
	utils.Sig().Emit(models.SigInitSystemConfig, nil)

	// 21.5. Start Workflow Event Listener and Scheduler
	// Start workflow event listener
	eventListener := workflowdef.NewWorkflowEventListener(db)
	if err := eventListener.Start(); err != nil {
		logger.Error("Failed to start workflow event listener", zap.Error(err))
	} else {
		logger.Info("Workflow event listener started")
	}

	// Start workflow scheduler
	scheduler := workflowdef.GetWorkflowScheduler(db)
	if err := scheduler.Start(); err != nil {
		logger.Error("Failed to start workflow scheduler", zap.Error(err))
	} else {
		logger.Info("Workflow scheduler started")
	}

	// 22. Start HTTP/HTTPS Server
	httpServer := &http.Server{
		Addr:           addr,
		Handler:        r,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1MB
	}

	// Check if SSL is enabled
	if config.GlobalConfig.SSLEnabled && listeners.IsSSLEnabled() {
		tlsConfig, err := listeners.GetTLSConfig()
		if err != nil {
			logger.Error("failed to get TLS config", zap.Error(err))
			return
		}

		if tlsConfig != nil {
			httpServer.TLSConfig = tlsConfig
			logger.Info("Starting HTTPS server", zap.String("addr", addr))
			if err := httpServer.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
				logger.Error("HTTPS server run failed", zap.Error(err))
			}
		} else {
			logger.Warn("SSL enabled but TLS config is nil, falling back to HTTP")
			if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				logger.Error("HTTP server run failed", zap.Error(err))
			}
		}
	} else {
		logger.Info("Starting HTTP server", zap.String("addr", addr))
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("HTTP server run failed", zap.Error(err))
		}
	}
}
