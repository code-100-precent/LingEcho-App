package main

import (
	"fmt"
	"log"
	"os"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	fmt.Println("=== 数据库迁移工具 ===")
	
	// 加载 .env 文件
	if err := godotenv.Load("../../.env"); err != nil {
		log.Printf("警告: 无法加载 .env 文件: %v", err)
	}
	
	// 加载配置
	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	
	// 连接数据库
	dsn := os.Getenv("DSN")
	if dsn == "" {
		log.Fatal("DSN 环境变量未设置")
	}
	
	fmt.Printf("连接数据库: %s\n", maskDSN(dsn))
	
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	
	fmt.Println("✓ 数据库连接成功")
	
	// 执行自动迁移
	fmt.Println("\n开始迁移 SipUser 模型...")
	
	if err := db.AutoMigrate(&models.SipUser{}); err != nil {
		log.Fatalf("迁移失败: %v", err)
	}
	
	fmt.Println("✓ SipUser 模型迁移成功")
	
	// 验证字段
	fmt.Println("\n验证新字段...")
	
	var columns []struct {
		Field string
		Type  string
	}
	
	db.Raw("SHOW COLUMNS FROM sip_users").Scan(&columns)
	
	requiredFields := []string{
		"scheme_name",
		"description",
		"opening_message",
		"keyword_replies",
		"fallback_message",
		"recording_enabled",
		"recording_mode",
		"recording_path",
		"message_enabled",
		"message_duration",
		"message_prompt",
		"bound_phone_number",
		"message_count",
		"is_active",
	}
	
	foundFields := make(map[string]bool)
	for _, col := range columns {
		foundFields[col.Field] = true
	}
	
	allFound := true
	for _, field := range requiredFields {
		if foundFields[field] {
			fmt.Printf("  ✓ %s\n", field)
		} else {
			fmt.Printf("  ✗ %s (未找到)\n", field)
			allFound = false
		}
	}
	
	if allFound {
		fmt.Println("\n✅ 所有字段迁移成功！")
	} else {
		fmt.Println("\n⚠️  部分字段未成功添加，请检查日志")
	}
	
	// 更新现有记录的默认值
	fmt.Println("\n更新现有记录的默认值...")
	
	// 为空的 scheme_name 设置默认值
	result := db.Exec("UPDATE sip_users SET scheme_name = CONCAT('方案_', username) WHERE scheme_name = '' OR scheme_name IS NULL")
	if result.Error != nil {
		log.Printf("警告: 更新 scheme_name 失败: %v", result.Error)
	} else {
		fmt.Printf("  ✓ 更新了 %d 条记录的 scheme_name\n", result.RowsAffected)
	}
	
	// 为空的 recording_mode 设置默认值
	result = db.Exec("UPDATE sip_users SET recording_mode = 'full' WHERE recording_mode = '' OR recording_mode IS NULL")
	if result.Error != nil {
		log.Printf("警告: 更新 recording_mode 失败: %v", result.Error)
	} else {
		fmt.Printf("  ✓ 更新了 %d 条记录的 recording_mode\n", result.RowsAffected)
	}
	
	fmt.Println("\n✅ 迁移完成！")
}

// maskDSN 隐藏 DSN 中的密码
func maskDSN(dsn string) string {
	// 简单的密码隐藏，避免在日志中显示完整密码
	if len(dsn) > 50 {
		return dsn[:20] + "***" + dsn[len(dsn)-20:]
	}
	return "***"
}
