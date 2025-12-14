package listeners

import (
	"fmt"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/notification"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func InitAssistantListener() {
	utils.Sig().Connect(constants.AssistantCreate, func(sender any, params ...any) {
		user, ok := sender.(*models.User)
		if !ok {
			return
		}

		db, ok := params[0].(*gorm.DB)
		if !ok {
			return
		}

		assistant, ok := params[1].(*models.Assistant)
		if !ok {
			return
		}
		logger.Info("user create a assistant", zap.Uint("userId", user.ID), zap.String("assistantName", assistant.Name))

		// Optimize notification content display
		title := "New Assistant Created Successfully"
		content := fmt.Sprintf("Dear %s, you have successfully created a new AI assistant:\n\n"+
			"Assistant Name: %s\n"+
			"Assistant Description: %s\n\n"+
			"You can further configure the assistant's detailed functions and behaviors on the assistant management page.\n"+
			"Go to the assistant management page now to start using it!",
			user.DisplayName, assistant.Name, assistant.Description)

		notification.NewInternalNotificationService(db).Send(user.ID, title, content)
	})
}
