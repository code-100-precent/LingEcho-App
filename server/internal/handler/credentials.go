package handlers

import (
	"fmt"

	"github.com/code-100-precent/LingEcho/internal/models"
	apperrors "github.com/code-100-precent/LingEcho/pkg/errors"
	"github.com/gin-gonic/gin"
)

// handleCreateCredential creates a new user credential
func (h *Handlers) handleCreateCredential(c *gin.Context) {
	var credential models.UserCredentialRequest
	if err := c.ShouldBindJSON(&credential); err != nil {
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrInvalidInput, "Invalid request"))
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrUnauthorized, "User is not logged in"))
		return
	}

	userCredential, err := models.CreateUserCredential(h.db, user.ID, &credential)
	if err != nil {
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrInternalServer, "create user credential failed"))
		return
	}

	apperrors.RespondSuccess(c, gin.H{
		"apiKey":    userCredential.APIKey,
		"apiSecret": userCredential.APISecret,
		"name":      credential.Name,
	})
}

func (h *Handlers) handleGetCredential(c *gin.Context) {
	user := models.CurrentUser(c)
	credentials, err := models.GetUserCredentials(h.db, user.ID)
	if err != nil {
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrInternalServer, "get user credentials failed"))
		return
	}
	apperrors.RespondSuccess(c, credentials)
}

// handleDeleteCredential 删除用户凭证
func (h *Handlers) handleDeleteCredential(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrUnauthorized, "User is not logged in"))
		return
	}

	// Get credential ID from path parameter
	idStr := c.Param("id")
	var credentialID uint
	_, err := fmt.Sscanf(idStr, "%d", &credentialID)
	if err != nil {
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrInvalidInput, "Invalid credential ID"))
		return
	}

	// Delete credential
	err = models.DeleteUserCredential(h.db, user.ID, credentialID)
	if err != nil {
		apperrors.HandleError(c, apperrors.Wrap(err, apperrors.ErrInternalServer, "Failed to delete credential"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}
