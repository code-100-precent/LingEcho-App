package listeners

import (
	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/notification"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func InitUserListeners() {
	// Handle after user registration success
	utils.Sig().Connect(models.SigUserCreate, func(sender any, params ...any) {
		if len(params) < 2 {
			return
		}
		user, ok := sender.(*models.User)
		if !ok {
			return
		}

		db, ok := params[0].(*gorm.DB)
		if !ok {
			return
		}

		logger.Info("User registered successfully", zap.Uint("userId", user.ID), zap.String("email", user.Email))

		// Send welcome email
		go sendWelcomeEmail(user, db)

		// Log user registration event
		go logUserEvent(user, "user_created", "User registered successfully")
	})

	// Handle after user login
	utils.Sig().Connect(models.SigUserLogin, func(sender any, params ...any) {
		user, ok := sender.(*models.User)
		if !ok {
			return
		}

		logger.Info("User logged in", zap.Uint("userId", user.ID), zap.String("email", user.Email))

		// Send login notification
		go sendWelcomeEmail(user, params[0].(*gorm.DB))

		notification.NewInternalNotificationService(params[0].(*gorm.DB)).Send(user.ID,
			"Welcome back",
			"Dear "+user.DisplayName+", welcome back to LingEcho AI voice platform! You have successfully logged into the system.")

		// Log login event
		go logUserEvent(user, "user_login", "User login")
	})

	// Handle after user logout
	utils.Sig().Connect(models.SigUserLogout, func(sender any, params ...any) {
		if len(params) < 1 {
			return
		}
		user, ok := params[0].(*models.User)
		if !ok {
			return
		}

		logger.Info("User logged out", zap.Uint("userId", user.ID), zap.String("email", user.Email))

		// Log logout event
		go logUserEvent(user, "user_logout", "User logout")
	})

	// User email verification
	utils.Sig().Connect(models.SigUserVerifyEmail, func(sender any, params ...any) {
		if len(params) < 3 {
			return
		}
		user, ok := params[0].(*models.User)
		if !ok {
			return
		}
		hash, ok := params[1].(string)
		if !ok {
			return
		}
		clientIp, ok := params[2].(string)
		if !ok {
			return
		}
		userAgent, ok := params[3].(string)
		if !ok {
			return
		}

		logger.Info("Sending email verification", zap.Uint("userId", user.ID), zap.String("email", user.Email))

		// Send email verification
		go sendEmailVerification(user, hash, clientIp, userAgent)
	})

	// User password reset
	utils.Sig().Connect(models.SigUserResetPassword, func(sender any, params ...any) {
		if len(params) < 3 {
			return
		}
		user, ok := params[0].(*models.User)
		if !ok {
			return
		}
		hash, ok := params[1].(string)
		if !ok {
			return
		}
		clientIp, ok := params[2].(string)
		if !ok {
			return
		}
		userAgent, ok := params[3].(string)
		if !ok {
			return
		}

		logger.Info("Sending password reset email", zap.Uint("userId", user.ID), zap.String("email", user.Email))

		// Send password reset email
		go sendPasswordResetEmail(user, hash, clientIp, userAgent)
	})

	logger.Info("user module listener is already")
}

// sendWelcomeEmail sends welcome email
func sendWelcomeEmail(user *models.User, db *gorm.DB) {
	if config.GlobalConfig.Mail.Host == "" || config.GlobalConfig.Mail.From == "" || config.GlobalConfig.Mail.Username == "" {
		logger.Warn("Mail configuration not set, skipping sending login notification")
		return
	}

	if user.EmailNotifications {
		mailer := notification.NewMailNotification(config.GlobalConfig.Mail)
		err := mailer.SendWelcomeEmail(
			user.Email,
			user.DisplayName,
			utils.GetValue(db, constants.KEY_SITE_URL), // Welcome page link
		)

		if err != nil {
			logger.Error("Failed to send welcome email", zap.Error(err), zap.String("email", user.Email))
		} else {
			logger.Info("Welcome email sent successfully", zap.String("email", user.Email))
		}
	}
}

// sendEmailVerification sends email verification
func sendEmailVerification(user *models.User, hash, clientIp, userAgent string) {
	if config.GlobalConfig.Mail.Host == "" {
		logger.Warn("Mail configuration not set, skipping sending email verification")
		return
	}

	mailer := notification.NewMailNotification(config.GlobalConfig.Mail)
	verifyUrl := "https://yourapp.com/verify?token=" + hash
	err := mailer.SendVerificationEmail(user.Email, user.DisplayName, verifyUrl)
	if err != nil {
		logger.Error("Failed to send email verification", zap.Error(err), zap.String("email", user.Email))
	} else {
		logger.Info("Email verification sent successfully", zap.String("email", user.Email))
	}
}

// sendPasswordResetEmail sends password reset email
func sendPasswordResetEmail(user *models.User, hash, clientIp, userAgent string) {
	if config.GlobalConfig.Mail.Host == "" {
		logger.Warn("Mail configuration not set, skipping sending password reset email")
		return
	}

	mailer := notification.NewMailNotification(config.GlobalConfig.Mail)
	resetUrl := "https://yourapp.com/reset-password?token=" + hash
	err := mailer.SendPasswordResetEmail(user.Email, user.DisplayName, resetUrl)
	if err != nil {
		logger.Error("Failed to send password reset email", zap.Error(err), zap.String("email", user.Email))
	} else {
		logger.Info("Password reset email sent successfully", zap.String("email", user.Email))
	}
}

// logUserEvent logs user events
func logUserEvent(user *models.User, eventType, description string) {
	// Here you can log user events to database or logging system
	logger.Info("User event recorded",
		zap.Uint("userId", user.ID),
		zap.String("eventType", eventType),
		zap.String("description", description),
	)
}
