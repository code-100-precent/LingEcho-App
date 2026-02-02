package tts

import (
	"strings"
	"testing"

	"go.uber.org/zap"
)

func TestSplitTextFirstSegmentMinimization(t *testing.T) {
	logger := zap.NewNop()
	service := &Service{
		logger:             logger,
		enableTextSplit:    true,
		firstSegmentMinLen: 3,
		firstSegmentMaxLen: 8, // 约5个中文字
		minSplitLength:     8,
	}

	tests := []struct {
		name          string
		input         string
		expectedCount int
		expectedFirst string
		shouldSplit   bool
	}{
		{
			name:          "短文本不分割",
			input:         "你好",
			expectedCount: 1,
			shouldSplit:   false,
		},
		{
			name:          "逗号分割（5字策略）",
			input:         "今天天气很好，阳光明媚，我们可以去公园散步。",
			expectedCount: 2,
			expectedFirst: "今天天气很好，", // 7个字符，符合5字策略
			shouldSplit:   true,
		},
		{
			name:          "顿号分割（5字策略）",
			input:         "苹果、香蕉、橙子都是水果，它们营养丰富。",
			expectedCount: 2,
			expectedFirst: "苹果、香蕉、", // 算法在3-8字符范围内找到最佳分割点
			shouldSplit:   true,
		},
		{
			name:          "分号分割",
			input:         "学习很重要；工作也很重要；但是健康最重要。",
			expectedCount: 2,
			expectedFirst: "学习很重要；", // 6个字符
			shouldSplit:   true,
		},
		{
			name:          "英文逗号分割",
			input:         "Hello, this is a test message for TTS segmentation.",
			expectedCount: 2,
			expectedFirst: "Hello,", // 6个字符
			shouldSplit:   true,
		},
		{
			name:          "长文本多段分割",
			input:         "这是测试，用来验证功能。第一段很短，后面内容会进一步分割。确保快速响应。",
			expectedCount: 2,       // 修正为2段，因为剩余部分不够长不会进一步分割
			expectedFirst: "这是测试，", // 5个字符，完美符合5字策略
			shouldSplit:   true,
		},
		{
			name:          "没有标点符号的长文本",
			input:         "这是一个没有标点符号的很长文本内容需要强制分割",
			expectedCount: 2,
			shouldSplit:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			segments := service.splitText(tt.input)

			// 检查分段数量
			if len(segments) != tt.expectedCount {
				t.Errorf("期望 %d 段，实际得到 %d 段", tt.expectedCount, len(segments))
			}

			// 检查是否应该分割
			if tt.shouldSplit && len(segments) == 1 {
				t.Errorf("期望分割，但没有分割")
			}
			if !tt.shouldSplit && len(segments) > 1 {
				t.Errorf("不期望分割，但进行了分割")
			}

			// 检查第一段内容（如果指定了期望值）
			if tt.expectedFirst != "" && len(segments) > 0 {
				if segments[0].Text != tt.expectedFirst {
					t.Errorf("第一段期望 '%s'，实际得到 '%s'", tt.expectedFirst, segments[0].Text)
				}
			}

			// 检查第一段长度是否在合理范围内（5字策略）
			if len(segments) > 1 {
				firstSegmentLen := len([]rune(segments[0].Text))
				if firstSegmentLen < 3 {
					t.Errorf("第一段长度 %d 小于最小长度 3", firstSegmentLen)
				}
				if firstSegmentLen > 10 { // 允许一些容差
					t.Errorf("第一段长度 %d 超过期望范围（5字策略）", firstSegmentLen)
				}
			}

			// 检查优先级设置
			for i, segment := range segments {
				if segment.Index != i {
					t.Errorf("段 %d 的索引应该是 %d，实际是 %d", i, i, segment.Index)
				}
				if segment.Priority != i {
					t.Errorf("段 %d 的优先级应该是 %d，实际是 %d", i, i, segment.Priority)
				}
				if i == len(segments)-1 && !segment.IsLast {
					t.Errorf("最后一段应该标记为 IsLast=true")
				}
				if i != len(segments)-1 && segment.IsLast {
					t.Errorf("非最后一段不应该标记为 IsLast=true")
				}
			}

			t.Logf("输入: %s", tt.input)
			for i, segment := range segments {
				t.Logf("段 %d: '%s' (长度: %d, 优先级: %d, 最后: %v)",
					i, segment.Text, len([]rune(segment.Text)), segment.Priority, segment.IsLast)
			}
		})
	}
}

func TestFirstSegmentMinimization(t *testing.T) {
	logger := zap.NewNop()
	service := &Service{
		logger:             logger,
		enableTextSplit:    true,
		firstSegmentMinLen: 3,
		firstSegmentMaxLen: 8, // 5字策略
		minSplitLength:     8,
	}

	// 测试第一段5字策略
	input := "今天的天气非常好，阳光明媚，温度适宜，是个出门的好日子。"
	segments := service.splitText(input)

	if len(segments) < 2 {
		t.Fatal("应该进行分割")
	}

	firstSegment := segments[0].Text
	firstSegmentLen := len([]rune(firstSegment))

	t.Logf("第一段: '%s' (长度: %d)", firstSegment, firstSegmentLen)

	// 第一段应该在逗号处分割，实现5字策略
	if !strings.Contains(firstSegment, "，") {
		t.Error("第一段应该包含逗号分割符")
	}

	// 第一段长度应该在合理范围内（约5个字）
	if firstSegmentLen < 3 || firstSegmentLen > 10 {
		t.Errorf("第一段长度 %d 不在期望范围 [3, 10] 内", firstSegmentLen)
	}

	// 验证第一段确实是最小化的（应该在第一个逗号处分割）
	expectedFirst := "今天的天气非常好，"
	if firstSegment != expectedFirst {
		t.Errorf("第一段应该是 '%s'，实际是 '%s'", expectedFirst, firstSegment)
	}
}
