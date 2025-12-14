package voicev2

import (
	"testing"
)

func TestExtractIncrementalSentence_SimilarText(t *testing.T) {
	state := NewClientState()

	// 设置初始处理的文本
	state.SetLastProcessedCumulativeText("喂喂可以听到吗")

	// 测试场景1：相同文本（只有标点不同）
	testCases := []struct {
		name     string
		current  string
		expected string // 空字符串表示应该被识别为相同，不处理
	}{
		{
			name:     "相同文本",
			current:  "喂喂可以听到吗",
			expected: "",
		},
		{
			name:     "添加标点",
			current:  "喂喂可以听到吗？",
			expected: "",
		},
		{
			name:     "添加逗号和问号",
			current:  "喂喂喂，可以听到吗？",
			expected: "",
		},
		{
			name:     "重复字符",
			current:  "喂喂喂可以听到吗",
			expected: "",
		},
		{
			name:     "完全不同",
			current:  "你好，今天天气怎么样",
			expected: "你好，今天天气怎么样",
		},
		{
			name:     "有增量",
			current:  "喂喂可以听到吗，你好",
			expected: "，你好",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := state.ExtractIncrementalSentence(tc.current)
			if result != tc.expected {
				t.Errorf("测试 '%s' 失败: 期望 '%s', 得到 '%s'", tc.name, tc.expected, result)
			}
		})
	}
}

func TestNormalizeTextForComparison(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"喂喂可以听到吗", "喂可以听到吗"},
		{"喂喂喂可以听到吗", "喂可以听到吗"},
		{"喂喂喂，可以听到吗？", "喂可以听到吗"},
		{"喂 喂 可以 听到 吗", "喂可以听到吗"},
		{"喂喂喂，可以听到吗？", "喂可以听到吗"},
		{"hello world", "heloworld"},
		{"hello, world!", "heloworld"},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result := normalizeTextForComparison(tc.input)
			if result != tc.expected {
				t.Errorf("输入 '%s': 期望 '%s', 得到 '%s'", tc.input, tc.expected, result)
			}
		})
	}
}

func TestRemoveRepeatedChars(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"喂喂喂", "喂"},
		{"喂喂可以听到吗", "喂可以听到吗"},
		{"喂喂喂可以听到吗", "喂可以听到吗"},
		{"可以听到吗", "可以听到吗"},
		{"aaa", "a"},
		{"abc", "abc"},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result := removeRepeatedChars(tc.input)
			if result != tc.expected {
				t.Errorf("输入 '%s': 期望 '%s', 得到 '%s'", tc.input, tc.expected, result)
			}
		})
	}
}

func TestCalculateTextSimilarity(t *testing.T) {
	testCases := []struct {
		text1    string
		text2    string
		expected float64 // 期望的最小相似度
	}{
		{"喂可以听到吗", "喂可以听到吗", 1.0},
		{"喂可以听到吗", "喂喂可以听到吗", 0.85},  // 应该高度相似
		{"喂可以听到吗", "喂喂喂可以听到吗", 0.85}, // 应该高度相似
		{"喂可以听到吗", "你好", 0.0},        // 完全不同
		{"hello", "hello", 1.0},
		{"hello", "hell", 0.8}, // 应该相似
	}

	for _, tc := range testCases {
		t.Run(tc.text1+"_vs_"+tc.text2, func(t *testing.T) {
			result := calculateTextSimilarity(tc.text1, tc.text2)
			if result < tc.expected {
				t.Errorf("文本1 '%s' 和文本2 '%s': 期望相似度 >= %.2f, 得到 %.2f", tc.text1, tc.text2, tc.expected, result)
			}
		})
	}
}
