package main

import (
	"fmt"
	"log"
	"os"

	"github.com/code-100-precent/LingEcho/pkg/config"
	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	// 加载 .env 文件
	godotenv.Load("../../.env")
	
	// 加载配置
	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}
	
	// 连接数据库
	dsn := os.Getenv("DSN")
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	
	// 查询表
	var tables []string
	db.Raw("SHOW TABLES").Scan(&tables)
	
	fmt.Println("数据库中的表:")
	for _, table := range tables {
		fmt.Printf("  - %s\n", table)
	}
	
	// 检查特定表
	checkTable := func(name string) {
		var count int64
		db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", name).Scan(&count)
		if count > 0 {
			fmt.Printf("\n✓ 表 %s 存在\n", name)
		} else {
			fmt.Printf("\n✗ 表 %s 不存在\n", name)
		}
	}
	
	checkTable("phone_numbers")
	checkTable("voicemails")
}
