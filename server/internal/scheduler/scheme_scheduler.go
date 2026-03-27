package scheduler

import (
	"sync"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SchemeScheduler 代接方案自动切换调度器
type SchemeScheduler struct {
	db   *gorm.DB
	cron *cron.Cron
	mu   sync.RWMutex
}

var (
	schemeSchedulerInstance *SchemeScheduler
	schemeSchedulerOnce     sync.Once
)

// GetSchemeScheduler 获取全局调度器实例
func GetSchemeScheduler(db *gorm.DB) *SchemeScheduler {
	schemeSchedulerOnce.Do(func() {
		schemeSchedulerInstance = &SchemeScheduler{
			db:   db,
			cron: cron.New(),
		}
	})
	return schemeSchedulerInstance
}

// Start 启动调度器
func (s *SchemeScheduler) Start() error {
	logger.Info("Starting scheme auto-switch scheduler")

	// 每分钟检查一次是否需要切换方案
	_, err := s.cron.AddFunc("@every 1m", func() {
		s.checkAndSwitchSchemes()
	})

	if err != nil {
		return err
	}

	// 启动时立即执行一次
	go s.checkAndSwitchSchemes()

	s.cron.Start()
	logger.Info("Scheme auto-switch scheduler started")

	return nil
}

// Stop 停止调度器
func (s *SchemeScheduler) Stop() {
	s.cron.Stop()
	logger.Info("Scheme auto-switch scheduler stopped")
}

// checkAndSwitchSchemes 检查并切换所有用户的方案
func (s *SchemeScheduler) checkAndSwitchSchemes() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 获取所有有自动方案的用户
	var users []models.User
	err := s.db.
		Joins("JOIN sip_users ON sip_users.user_id = users.id").
		Where("sip_users.activation_mode = ? AND sip_users.enabled = ?", 
			models.ActivationModeAuto, true).
		Group("users.id").
		Find(&users).Error

	if err != nil {
		logger.Error("Failed to get users with auto schemes", zap.Error(err))
		return
	}

	logger.Debug("Checking schemes for auto-switch", zap.Int("userCount", len(users)))

	// 为每个用户检查并切换方案
	for _, user := range users {
		if err := models.AutoSwitchScheme(s.db, user.ID); err != nil {
			if err != gorm.ErrRecordNotFound {
				logger.Error("Failed to auto-switch scheme",
					zap.Uint("userId", user.ID),
					zap.Error(err))
			}
		} else {
			logger.Debug("Auto-switched scheme for user", zap.Uint("userId", user.ID))
		}
	}
}

// TriggerCheck 手动触发一次检查（用于测试或立即切换）
func (s *SchemeScheduler) TriggerCheck() {
	go s.checkAndSwitchSchemes()
}
