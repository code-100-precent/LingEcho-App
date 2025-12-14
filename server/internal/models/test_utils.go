package models

import (
	"io"
	"log"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	glog "gorm.io/gorm/logger"
)

// setupTestDBWithSilentLogger creates a test database with silent logger to suppress SQL logs
func setupTestDBWithSilentLogger(t *testing.T, models ...interface{}) *gorm.DB {
	silentLogger := glog.New(
		log.New(io.Discard, "", log.LstdFlags), // Discard all output
		glog.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  glog.Silent, // Silent mode - no logs
			IgnoreRecordNotFoundError: true,        // Ignore "record not found" errors
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: silentLogger,
	})
	if err != nil {
		t.Fatalf("Failed to open database: %v", err)
	}

	if len(models) > 0 {
		err = db.AutoMigrate(models...)
		if err != nil {
			t.Fatalf("Failed to migrate: %v", err)
		}
	}

	return db
}
