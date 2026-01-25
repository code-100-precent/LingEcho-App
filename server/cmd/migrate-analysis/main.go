package main

import (
	"fmt"
	"log"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	// 加载配置
	cfg := config.GetConfig()

	// 连接数据库
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	fmt.Println("开始添加AI分析相关字段...")

	// 添加AI分析相关字段到call_recordings表
	if err := addAnalysisFields(db); err != nil {
		log.Fatalf("添加AI分析字段失败: %v", err)
	}

	fmt.Println("AI分析字段添加完成!")
}

func addAnalysisFields(db *gorm.DB) error {
	// 检查字段是否已存在，如果不存在则添加
	fields := []struct {
		name string
		sql  string
	}{
		{
			name: "ai_analysis",
			sql:  "ALTER TABLE call_recordings ADD COLUMN ai_analysis TEXT COMMENT 'AI分析结果'",
		},
		{
			name: "analysis_status",
			sql:  "ALTER TABLE call_recordings ADD COLUMN analysis_status VARCHAR(32) DEFAULT 'pending' COMMENT '分析状态: pending, analyzing, completed, failed'",
		},
		{
			name: "analysis_error",
			sql:  "ALTER TABLE call_recordings ADD COLUMN analysis_error TEXT COMMENT '分析错误信息'",
		},
		{
			name: "analyzed_at",
			sql:  "ALTER TABLE call_recordings ADD COLUMN analyzed_at TIMESTAMP NULL COMMENT '分析完成时间'",
		},
		{
			name: "auto_analyzed",
			sql:  "ALTER TABLE call_recordings ADD COLUMN auto_analyzed BOOLEAN DEFAULT FALSE COMMENT '是否自动分析'",
		},
		{
			name: "analysis_version",
			sql:  "ALTER TABLE call_recordings ADD COLUMN analysis_version INT DEFAULT 1 COMMENT '分析版本号'",
		},
	}

	for _, field := range fields {
		// 检查字段是否存在
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'call_recordings' AND COLUMN_NAME = ?", field.name).Scan(&count).Error
		if err != nil {
			return fmt.Errorf("检查字段 %s 是否存在失败: %w", field.name, err)
		}

		if count == 0 {
			// 字段不存在，添加字段
			fmt.Printf("添加字段: %s\n", field.name)
			if err := db.Exec(field.sql).Error; err != nil {
				return fmt.Errorf("添加字段 %s 失败: %w", field.name, err)
			}
		} else {
			fmt.Printf("字段 %s 已存在，跳过\n", field.name)
		}
	}

	// 添加索引
	indexes := []struct {
		name string
		sql  string
	}{
		{
			name: "idx_call_recordings_analysis_status",
			sql:  "CREATE INDEX idx_call_recordings_analysis_status ON call_recordings(analysis_status)",
		},
	}

	for _, index := range indexes {
		// 检查索引是否存在
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'call_recordings' AND INDEX_NAME = ?", index.name).Scan(&count).Error
		if err != nil {
			return fmt.Errorf("检查索引 %s 是否存在失败: %w", index.name, err)
		}

		if count == 0 {
			// 索引不存在，创建索引
			fmt.Printf("创建索引: %s\n", index.name)
			if err := db.Exec(index.sql).Error; err != nil {
				return fmt.Errorf("创建索引 %s 失败: %w", index.name, err)
			}
		} else {
			fmt.Printf("索引 %s 已存在，跳过\n", index.name)
		}
	}

	return nil
}
