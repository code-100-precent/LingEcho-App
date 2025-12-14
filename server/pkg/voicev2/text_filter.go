package voicev2

import (
	"strings"
)

// isCompleteSentence 判断是否是完整句子（包含句号、问号、感叹号等结束标记）
func isCompleteSentence(text string) bool {
	if text == "" {
		return false
	}
	// 检查是否包含句子结束标记
	endMarkers := []string{"。", "？", "！", ".", "?", "!"}
	for _, marker := range endMarkers {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
}

// isMeaninglessText 判断文本是否是无意义的（应该被过滤）
// 过滤单字语气词、无意义的短词等
func isMeaninglessText(text string) bool {
	if text == "" {
		return true
	}

	// 去除标点符号和空白字符后检查
	cleanedText := strings.TrimSpace(text)
	cleanedText = strings.Trim(cleanedText, "。，、；：？！\"\"''（）【】《》")

	// 如果清理后为空，认为是无意义的
	if cleanedText == "" {
		return true
	}

	// 定义无意义的词列表（常见的语气词、单字等）
	meaninglessWords := []string{
		"嗯", "啊", "呃", "额", "哦", "噢", "哦", "呀", "哈", "嘿",
		"喂", "哼", "唉", "哎", "唉", "诶", "诶", "欸",
		"嗯嗯", "啊啊", "呃呃", "哦哦", "呵呵", "哈哈",
		"什么", "啥", "咋", "哪", "那个", "这个",
		"额", "额额", "呃呃", "啊这", "啊这这",
	}

	// 检查是否完全匹配无意义词
	for _, word := range meaninglessWords {
		if cleanedText == word {
			return true
		}
	}

	// 检查文本长度（如果只有1-2个字符，且不是常见有意义的词，则认为是无意义的）
	if len([]rune(cleanedText)) <= 2 {
		// 检查是否是常见的有意义单字词（可根据需要扩展）
		meaningfulSingleChars := []string{"行", "可", "不", "否", "要"}
		isMeaningful := false
		for _, char := range meaningfulSingleChars {
			if cleanedText == char {
				isMeaningful = true
				break
			}
		}
		if !isMeaningful {
			return true
		}
	}

	return false
}

// filterText 过滤文本，去除无意义内容和前缀语气词
// 返回空字符串表示文本应该被过滤掉
func filterText(text string) string {
	if text == "" {
		return ""
	}

	// 如果整个文本都是无意义的，返回空字符串
	if isMeaninglessText(text) {
		return ""
	}

	// 去除前缀的常见语气词
	cleaned := strings.TrimSpace(text)

	// 定义需要去除的前缀语气词
	prefixes := []string{"嗯", "啊", "呃", "额", "哦", "噢", "呀", "哈", "嘿", "喂", "哼", "唉", "哎", "诶", "欸"}

	for _, prefix := range prefixes {
		if strings.HasPrefix(cleaned, prefix) {
			cleaned = strings.TrimPrefix(cleaned, prefix)
			cleaned = strings.TrimSpace(cleaned)
		}
	}

	// 去除前缀后，再次检查是否变成无意义的文本
	if cleaned != "" && isMeaninglessText(cleaned) {
		return ""
	}

	return cleaned
}

// extractCompleteSentence 提取完整句子（从开头到第一个句子结束符）
func extractCompleteSentence(text string) string {
	runes := []rune(text)
	for i, char := range runes {
		if char == '。' || char == '！' || char == '？' ||
			char == '.' || char == '!' || char == '?' {
			return string(runes[:i+1])
		}
	}
	return ""
}

// filterEmojiText 过滤文本中的 emoji，只移除 emoji 但保留文本内容
func filterEmojiText(text string) string {
	if text == "" {
		return ""
	}
	// 移除文本中的 emoji，只保留文字部分
	var result strings.Builder
	for _, char := range text {
		// 检查是否是 emoji 范围
		isEmoji := (char >= 0x1F300 && char <= 0x1F9FF) || // Emoticons, Symbols, Pictographs
			(char >= 0x2600 && char <= 0x26FF) || // Miscellaneous Symbols
			(char >= 0x2700 && char <= 0x27BF) || // Dingbats
			(char >= 0xFE00 && char <= 0xFE0F) || // Variation Selectors
			(char == 0x200D) // Zero Width Joiner

		// 保留非 emoji 字符
		if !isEmoji {
			result.WriteRune(char)
		}
	}
	filtered := strings.TrimSpace(result.String())
	return filtered
}
