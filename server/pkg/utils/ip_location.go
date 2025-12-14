package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// IPLocationResponse IP地理位置查询响应结构
type IPLocationResponse struct {
	Pro  string `json:"pro"`  // 省份
	City string `json:"city"` // 城市
}

const (
	// IP地址查询API
	IP_URL = "http://whois.pconline.com.cn/ipJson.jsp"

	// 未知地址
	UNKNOWN = "XX XX"

	// 内网IP标识
	INTERNAL_IP = "内网IP"
)

// IsInternalIP 判断是否为内网IP
func IsInternalIP(ip string) bool {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	// 检查是否为回环地址
	if parsedIP.IsLoopback() {
		return true
	}

	// 检查是否为私有地址
	if parsedIP.IsPrivate() {
		return true
	}

	// 检查是否为本地地址
	if parsedIP.IsLinkLocalUnicast() || parsedIP.IsLinkLocalMulticast() {
		return true
	}

	return false
}

// GetRealAddressByIP 根据IP获取真实地址
func GetRealAddressByIP(ip string) string {
	// 内网不查询
	if IsInternalIP(ip) {
		return INTERNAL_IP
	}

	// 创建HTTP客户端
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	// 构建请求URL
	url := fmt.Sprintf("%s?ip=%s&json=true", IP_URL, ip)

	// 发送GET请求
	resp, err := client.Get(url)
	if err != nil {
		fmt.Printf("获取地理位置异常 %s: %v\n", ip, err)
		return UNKNOWN
	}
	defer resp.Body.Close()

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("读取响应体异常 %s: %v\n", ip, err)
		return UNKNOWN
	}

	// 解析响应
	var locationResp IPLocationResponse
	err = json.Unmarshal(body, &locationResp)
	if err != nil {
		fmt.Printf("解析地理位置响应异常 %s: %v\n", ip, err)
		return UNKNOWN
	}

	// 检查是否获取到有效数据
	if locationResp.Pro == "" && locationResp.City == "" {
		fmt.Printf("获取地理位置异常 %s: 响应数据为空\n", ip)
		return UNKNOWN
	}

	// 格式化返回地址
	region := strings.TrimSpace(locationResp.Pro)
	city := strings.TrimSpace(locationResp.City)

	if region == "" {
		region = "未知"
	}
	if city == "" {
		city = "未知"
	}

	return fmt.Sprintf("%s %s", region, city)
}

// TestIPLocation 测试IP地理位置查询功能
func TestIPLocation() {
	// 测试内网IP
	internalIP := "192.168.1.100"
	internalAddress := GetRealAddressByIP(internalIP)
	fmt.Printf("Internal IP (%s): %s\n", internalIP, internalAddress)

	// 测试本地IP
	localIP := "127.0.0.1"
	localAddress := GetRealAddressByIP(localIP)
	fmt.Printf("Local IP (%s): %s\n", localIP, localAddress)

	// 测试外网IP（使用一个示例IP）
	externalIP := "8.8.8.8"
	externalAddress := GetRealAddressByIP(externalIP)
	fmt.Printf("External IP (%s): %s\n", externalIP, externalAddress)
}
