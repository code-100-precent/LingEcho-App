<<<<<<< HEAD
package utils

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
)

// SanitizeInput 清理输入，去除首尾空格和特殊字符
func SanitizeInput(input string) string {
	// 去除首尾空格
	input = strings.TrimSpace(input)
	// 去除控制字符
	input = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, input)
	return input
}

// SanitizeEmail 清理邮箱地址
func SanitizeEmail(email string) string {
	email = strings.TrimSpace(email)
	email = strings.ToLower(email)
	// 去除邮箱中的多余空格
	email = strings.ReplaceAll(email, " ", "")
	return email
}

// SanitizePassword 清理密码（保留空格，但去除首尾空格）
func SanitizePassword(password string) string {
	return strings.TrimSpace(password)
}

// ValidateSQLInjection 检查SQL注入风险
func ValidateSQLInjection(input string) error {
	if input == "" {
		return nil
	}

	// SQL注入常见关键词和字符
	sqlKeywords := []string{
		"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_",
		"exec", "execute", "select", "insert", "update", "delete",
		"drop", "create", "alter", "union", "script", "<script",
		"javascript:", "onerror", "onload", "onclick",
	}

	inputLower := strings.ToLower(input)

	// 检查是否包含SQL注入关键词
	for _, keyword := range sqlKeywords {
		if strings.Contains(inputLower, keyword) {
			// 允许正常的单引号在邮箱地址中（如 o'brien@example.com）
			if keyword == "'" && isValidEmailQuote(input) {
				continue
			}
			return errors.New("input contains potentially dangerous characters")
		}
	}

	// 检查是否包含SQL注释
	if strings.Contains(inputLower, "--") || strings.Contains(inputLower, "/*") {
		return errors.New("input contains SQL comment characters")
	}

	return nil
}

// isValidEmailQuote 检查单引号是否在有效的邮箱地址中
func isValidEmailQuote(input string) bool {
	// 简单的邮箱格式检查
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-']+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(input)
}

// ValidateXSS 检查XSS攻击风险
func ValidateXSS(input string) error {
	if input == "" {
		return nil
	}

	// XSS常见关键词
	xssPatterns := []string{
		"<script", "</script>", "javascript:", "onerror=",
		"onload=", "onclick=", "<iframe", "<img", "onmouseover=",
		"<svg", "<object", "<embed",
	}

	inputLower := strings.ToLower(input)

	for _, pattern := range xssPatterns {
		if strings.Contains(inputLower, pattern) {
			return errors.New("input contains potentially dangerous script tags")
		}
	}

	return nil
}

// ValidateEmailFormat 验证邮箱格式
func ValidateEmailFormat(email string) error {
	if email == "" {
		return errors.New("email is required")
	}

	// 邮箱格式正则
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email format")
	}

	// 长度检查
	if len(email) > 254 {
		return errors.New("email address too long")
	}

	return nil
}

// ValidatePasswordFormat 验证密码格式
func ValidatePasswordFormat(password string) error {
	if password == "" {
		return errors.New("password is required")
	}

	// 使用字符数而不是字节数来检查密码长度
	passwordLength := len([]rune(password))
	
	// 密码长度检查
	if passwordLength < 8 {
		return errors.New("password must be at least 8 characters long")
	}
    
	// 增加最大长度以支持加密后的密码格式
	// 格式: hash1(64):hash2(64):salt(24):timestamp(13) = 约165字符
	if passwordLength > 256 {
		return errors.New("password too long")
	}

	return nil
}

// ValidateDisplayName 验证显示名称
func ValidateDisplayName(name string) error {
	if name == "" {
		return nil // 显示名称可以为空
	}

	// 长度检查
	if len(name) > 50 {
		return errors.New("display name too long")
	}

	// 检查是否包含危险字符
	if err := ValidateXSS(name); err != nil {
		return err
	}

	return nil
}

// ValidateUserName 验证用户名
func ValidateUserName(username string) error {
	if username == "" {
		return errors.New("username is required")
	}

	// 长度检查
	if len(username) < 3 {
		return errors.New("username must be at least 3 characters long")
	}

	if len(username) > 30 {
		return errors.New("username too long")
	}

	// 只允许字母、数字、下划线和连字符
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !usernameRegex.MatchString(username) {
		return errors.New("username can only contain letters, numbers, underscores and hyphens")
	}

	return nil
}

// SanitizeAndValidate 清理并验证输入
func SanitizeAndValidate(input string, inputType string) (string, error) {
	var sanitized string

	switch inputType {
	case "email":
		sanitized = SanitizeEmail(input)
		if err := ValidateEmailFormat(sanitized); err != nil {
			return "", err
		}
	case "password":
		sanitized = SanitizePassword(input)
		if err := ValidatePasswordFormat(sanitized); err != nil {
			return "", err
		}
	case "username":
		sanitized = SanitizeInput(input)
		if err := ValidateUserName(sanitized); err != nil {
			return "", err
		}
	case "displayname":
		sanitized = SanitizeInput(input)
		if err := ValidateDisplayName(sanitized); err != nil {
			return "", err
		}
	default:
		sanitized = SanitizeInput(input)
	}

	// SQL注入检查
	if err := ValidateSQLInjection(sanitized); err != nil {
		return "", err
	}

	// XSS检查
	if err := ValidateXSS(sanitized); err != nil {
		return "", err
	}

	return sanitized, nil
}
=======
package utils

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
)

// SanitizeInput cleans input by removing leading/trailing spaces and special characters
func SanitizeInput(input string) string {
	// Remove leading and trailing spaces
	input = strings.TrimSpace(input)
	// Remove control characters
	input = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, input)
	return input
}

// SanitizeEmail cleans email address
func SanitizeEmail(email string) string {
	email = strings.TrimSpace(email)
	email = strings.ToLower(email)
	// Remove extra spaces in email
	email = strings.ReplaceAll(email, " ", "")
	return email
}

// SanitizePassword cleans password (preserves spaces but removes leading/trailing spaces)
func SanitizePassword(password string) string {
	return strings.TrimSpace(password)
}

// ValidateSQLInjection checks for SQL injection risks
func ValidateSQLInjection(input string) error {
	if input == "" {
		return nil
	}

	// Common SQL injection keywords and characters
	sqlKeywords := []string{
		"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_",
		"exec", "execute", "select", "insert", "update", "delete",
		"drop", "create", "alter", "union", "script", "<script",
		"javascript:", "onerror", "onload", "onclick",
	}

	inputLower := strings.ToLower(input)

	// Check if contains SQL injection keywords
	for _, keyword := range sqlKeywords {
		if strings.Contains(inputLower, keyword) {
			// Allow normal single quotes in email addresses (e.g. o'brien@example.com)
			if keyword == "'" && isValidEmailQuote(input) {
				continue
			}
			return errors.New("input contains potentially dangerous characters")
		}
	}

	// Check if contains SQL comments
	if strings.Contains(inputLower, "--") || strings.Contains(inputLower, "/*") {
		return errors.New("input contains SQL comment characters")
	}

	return nil
}

// isValidEmailQuote checks if single quote is in a valid email address
func isValidEmailQuote(input string) bool {
	// Simple email format check
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-']+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(input)
}

// ValidateXSS checks for XSS attack risks
func ValidateXSS(input string) error {
	if input == "" {
		return nil
	}

	// Common XSS keywords
	xssPatterns := []string{
		"<script", "</script>", "javascript:", "onerror=",
		"onload=", "onclick=", "<iframe", "<img", "onmouseover=",
		"<svg", "<object", "<embed",
	}

	inputLower := strings.ToLower(input)

	for _, pattern := range xssPatterns {
		if strings.Contains(inputLower, pattern) {
			return errors.New("input contains potentially dangerous script tags")
		}
	}

	return nil
}

// ValidateEmailFormat validates email format
func ValidateEmailFormat(email string) error {
	if email == "" {
		return errors.New("email is required")
	}

	// Email format regex
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email format")
	}

	// Length check
	if len(email) > 254 {
		return errors.New("email address too long")
	}

	return nil
}

// ValidatePasswordFormat validates password format
func ValidatePasswordFormat(password string) error {
	if password == "" {
		return errors.New("password is required")
	}

	// Password length check
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters long")
	}

	if len(password) > 128 {
		return errors.New("password too long")
	}

	return nil
}

// ValidateDisplayName validates display name
func ValidateDisplayName(name string) error {
	if name == "" {
		return nil // Display name can be empty
	}

	// Length check
	if len(name) > 50 {
		return errors.New("display name too long")
	}

	// Check for dangerous characters
	if err := ValidateXSS(name); err != nil {
		return err
	}

	return nil
}

// ValidateUserName validates username
func ValidateUserName(username string) error {
	if username == "" {
		return errors.New("username is required")
	}

	// Length check
	if len(username) < 3 {
		return errors.New("username must be at least 3 characters long")
	}

	if len(username) > 30 {
		return errors.New("username too long")
	}

	// Only allow letters, numbers, underscores and hyphens
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !usernameRegex.MatchString(username) {
		return errors.New("username can only contain letters, numbers, underscores and hyphens")
	}

	return nil
}

// SanitizeAndValidate cleans and validates input
func SanitizeAndValidate(input string, inputType string) (string, error) {
	var sanitized string

	switch inputType {
	case "email":
		sanitized = SanitizeEmail(input)
		if err := ValidateEmailFormat(sanitized); err != nil {
			return "", err
		}
	case "password":
		sanitized = SanitizePassword(input)
		if err := ValidatePasswordFormat(sanitized); err != nil {
			return "", err
		}
	case "username":
		sanitized = SanitizeInput(input)
		if err := ValidateUserName(sanitized); err != nil {
			return "", err
		}
	case "displayname":
		sanitized = SanitizeInput(input)
		if err := ValidateDisplayName(sanitized); err != nil {
			return "", err
		}
	default:
		sanitized = SanitizeInput(input)
	}

	// SQL injection check
	if err := ValidateSQLInjection(sanitized); err != nil {
		return "", err
	}

	// XSS check
	if err := ValidateXSS(sanitized); err != nil {
		return "", err
	}

	return sanitized, nil
}
>>>>>>> 3dfadd85bd518bde3e99c3d51af6bb1fe0a2141c
