package voicev2

import "sync/atomic"

// SetActive 设置客户端活跃状态（并发安全）
func (c *VoiceClient) SetActive(active bool) {
	if active {
		atomic.StoreInt32(&c.isActive, 1)
	} else {
		atomic.StoreInt32(&c.isActive, 0)
	}
}

// GetActive 获取客户端活跃状态（并发安全）
func (c *VoiceClient) GetActive() bool {
	return atomic.LoadInt32(&c.isActive) == 1
}
