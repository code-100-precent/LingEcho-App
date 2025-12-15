package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/code-100-precent/LingEcho/pkg/storage"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// UploadHandler file upload handler
type UploadHandler struct{}

// NewUploadHandler creates a new upload handler
func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// Register registers routes
func (h *UploadHandler) Register(r *gin.Engine) {
	// Audio file upload route
	r.POST("/api/upload/audio", h.UploadAudio)
}

// UploadAudio uploads audio file
func (h *UploadHandler) UploadAudio(c *gin.Context) {
	// Get uploaded file
	file, header, err := c.Request.FormFile("audio")
	if err != nil {
		response.Fail(c, "Failed to get uploaded file: "+err.Error(), nil)
		return
	}
	defer file.Close()

	// Check file type
	contentType := header.Header.Get("Content-Type")
	if contentType != "audio/webm" && contentType != "audio/wav" && contentType != "audio/mp3" {
		response.Fail(c, "Unsupported file type: "+contentType, nil)
		return
	}

	// Generate storage key (relative to storage root)
	timestamp := time.Now().Unix()
	randomStr := utils.RandString(8)
	fileName := fmt.Sprintf("audio_%d_%s.webm", timestamp, randomStr)
	storageKey := fmt.Sprintf("audio/%s", fileName)

	// Use unified storage layer
	store := stores.Default()
	if err := store.Write(storageKey, file); err != nil {
		response.Fail(c, "Failed to save file: "+err.Error(), nil)
		return
	}

	// Get file information from storage
	var fileSize int64
	if rc, size, err := store.Read(storageKey); err == nil && rc != nil {
		fileSize = size
		rc.Close()
	}

	// Record storage usage
	user := models.CurrentUser(c)
	if user != nil {
		// 从middleware获取数据库连接
		db, exists := c.Get("db")
		if exists {
			if gormDB, ok := db.(*gorm.DB); ok {
				// Try to get credential ID (from request parameters or user's default credential)
				var credentialID uint
				if credIDStr := c.Query("credentialId"); credIDStr != "" {
					if id, err := strconv.ParseUint(credIDStr, 10, 32); err == nil {
						credentialID = uint(id)
					}
				}
				// 如果没有提供凭证ID，尝试获取用户的第一个凭证
				if credentialID == 0 {
					credentials, err := models.GetUserCredentials(gormDB, user.ID)
					if err == nil && len(credentials) > 0 {
						credentialID = credentials[0].ID
					}
				}

				go func() {
					if err := models.RecordStorageUsage(
						gormDB,
						user.ID,
						credentialID,
						nil, // assistantID
						nil, // groupID
						fmt.Sprintf("upload_%d_%d", user.ID, time.Now().Unix()),
						fileSize,
						fmt.Sprintf("上传音频文件: %s", fileName),
					); err != nil {
						// Recording failure does not affect the upload process, only logs
						fmt.Printf("Failed to record storage usage: %v\n", err)
					}
				}()
			}
		}
	}

	fileURL := store.PublicURL(storageKey)

	// Return success response
	response.Success(c, "音频文件上传成功", map[string]interface{}{
		"fileName":   fileName,
		"filePath":   fileURL,
		"fileSize":   fileSize,
		"uploadTime": time.Now().Format(time.RFC3339),
		"url":        fileURL,
	})
}
