package filter

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"go.uber.org/zap"
)

// Manager 过滤词管理器
type Manager struct {
	blacklist      map[string]bool // 黑名单词集合
	counts         map[string]int  // 被过滤词的累计次数
	mu             sync.RWMutex
	logger         *zap.Logger
	dictionaryPath string
}

// NewManager 创建过滤词管理器
func NewManager(dictionaryPath string, logger *zap.Logger) (*Manager, error) {
	m := &Manager{
		blacklist:      make(map[string]bool),
		counts:         make(map[string]int),
		logger:         logger,
		dictionaryPath: dictionaryPath,
	}

	// 加载字典
	if err := m.LoadDictionary(); err != nil {
		return nil, fmt.Errorf("加载过滤词字典失败: %w", err)
	}

	return m, nil
}

// LoadDictionary 从文件加载过滤词字典
func (m *Manager) LoadDictionary() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 如果路径为空，使用默认路径
	if m.dictionaryPath == "" {
		// 尝试从 scripts 目录查找
		possiblePaths := []string{
			"scripts/filter_blacklist.txt",
			"./scripts/filter_blacklist.txt",
			"../scripts/filter_blacklist.txt",
		}

		for _, path := range possiblePaths {
			if _, err := os.Stat(path); err == nil {
				m.dictionaryPath = path
				break
			}
		}

		// 如果还是找不到，使用绝对路径
		if m.dictionaryPath == "" {
			// 获取当前工作目录
			wd, err := os.Getwd()
			if err == nil {
				absPath := filepath.Join(wd, "scripts", "filter_blacklist.txt")
				if _, err := os.Stat(absPath); err == nil {
					m.dictionaryPath = absPath
				}
			}
		}
	}

	// 如果仍然找不到文件，创建默认字典
	if m.dictionaryPath == "" || fileNotExists(m.dictionaryPath) {
		m.logger.Warn("过滤词字典文件不存在，使用默认黑名单",
			zap.String("path", m.dictionaryPath),
		)
		m.loadDefaultBlacklist()
		return nil
	}

	// 读取文件
	file, err := os.Open(m.dictionaryPath)
	if err != nil {
		m.logger.Warn("无法打开过滤词字典文件，使用默认黑名单",
			zap.String("path", m.dictionaryPath),
			zap.Error(err),
		)
		m.loadDefaultBlacklist()
		return nil
	}
	defer file.Close()

	// 清空现有黑名单
	m.blacklist = make(map[string]bool)

	// 逐行读取
	scanner := bufio.NewScanner(file)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())

		// 跳过空行和注释行（以 # 开头）
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// 添加到黑名单（转换为小写以便匹配）
		m.blacklist[strings.ToLower(line)] = true
		m.blacklist[line] = true // 同时保留原始大小写
	}

	if err := scanner.Err(); err != nil {
		m.logger.Warn("读取过滤词字典文件出错",
			zap.String("path", m.dictionaryPath),
			zap.Error(err),
		)
		m.loadDefaultBlacklist()
		return nil
	}

	m.logger.Info("过滤词字典加载成功",
		zap.String("path", m.dictionaryPath),
		zap.Int("count", len(m.blacklist)),
	)

	return nil
}

// loadDefaultBlacklist 加载默认黑名单
func (m *Manager) loadDefaultBlacklist() {
	defaultWords := []string{
		"嗯", "嗯。", "嗯嗯", "嗯嗯。",
		"啊", "啊。", "啊啊", "啊啊。",
		"呃", "呃。", "呃呃", "呃呃。",
		"额", "额。", "额额", "额额。",
		"哦", "哦。", "哦哦", "哦哦。",
		"噢", "噢。",
		"呀", "呀。",
		"哈", "哈。", "哈哈", "哈哈。",
		"嘿", "嘿。",
		"喂", "喂。",
		"哼", "哼。",
		"唉", "唉。",
		"哎", "哎。",
		"诶", "诶。",
		"欸", "欸。",
	}

	for _, word := range defaultWords {
		m.blacklist[word] = true
		m.blacklist[strings.ToLower(word)] = true
	}
}

// fileNotExists 检查文件是否存在
func fileNotExists(path string) bool {
	_, err := os.Stat(path)
	return os.IsNotExist(err)
}

// IsFiltered 检查文本是否应该被过滤
// 注意：只使用精确匹配（==），不使用包含匹配（contains）
func (m *Manager) IsFiltered(text string) bool {
	if text == "" {
		return true
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	// 去除首尾空白和标点符号
	cleaned := strings.TrimSpace(text)
	cleaned = strings.Trim(cleaned, "。，、；：？！\"\"''（）【】《》")

	// 只进行精确匹配（==），不进行包含匹配
	// 检查原始文本和小写文本
	if m.blacklist[cleaned] || m.blacklist[strings.ToLower(cleaned)] {
		return true
	}

	return false
}

// RecordFiltered 记录被过滤的词（累计计数）
func (m *Manager) RecordFiltered(text string) {
	if text == "" {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	cleaned := strings.TrimSpace(text)
	cleaned = strings.Trim(cleaned, "。，、；：？！\"\"''（）【】《》")

	m.counts[cleaned]++

	m.logger.Debug("记录被过滤的词",
		zap.String("text", cleaned),
		zap.Int("count", m.counts[cleaned]),
	)
}

// GetFilteredCount 获取被过滤词的累计次数
func (m *Manager) GetFilteredCount(text string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cleaned := strings.TrimSpace(text)
	cleaned = strings.Trim(cleaned, "。，、；：？！\"\"''（）【】《》")

	return m.counts[cleaned]
}

// GetAllCounts 获取所有被过滤词的累计次数
func (m *Manager) GetAllCounts() map[string]int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]int)
	for k, v := range m.counts {
		result[k] = v
	}
	return result
}

// Reload 重新加载字典
func (m *Manager) Reload() error {
	return m.LoadDictionary()
}
