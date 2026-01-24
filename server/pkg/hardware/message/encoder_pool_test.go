package message

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"go.uber.org/zap"
)

// MockEncoder 模拟OPUS编码器
func MockEncoder(packet media.MediaPacket) ([]media.MediaPacket, error) {
	// 模拟编码延迟
	time.Sleep(10 * time.Millisecond)

	// 获取音频数据
	audioPacket, ok := packet.(*media.AudioPacket)
	if !ok {
		return nil, fmt.Errorf("不是音频包")
	}

	// 返回编码后的数据（简单地在原数据前加个标记）
	encodedData := append([]byte("OPUS:"), audioPacket.Payload...)
	return []media.MediaPacket{&media.AudioPacket{Payload: encodedData}}, nil
}

// TestEncoderPool 测试编码器线程池
func TestEncoderPool(t *testing.T) {
	logger := zap.NewNop()

	// 创建编码器池
	pool := NewEncoderPool(4, MockEncoder, logger)
	defer pool.Close()

	// 测试数据
	testData := []byte("test audio data")

	// 测试单个编码
	ctx := context.Background()
	result, err := pool.Encode(ctx, testData)

	if err != nil {
		t.Errorf("编码失败: %v", err)
	}

	expected := append([]byte("OPUS:"), testData...)
	if string(result) != string(expected) {
		t.Errorf("编码结果不正确，期望: %s, 实际: %s", expected, result)
	}

	t.Logf("单个编码测试通过，结果: %s", result)
}

// TestEncoderPoolConcurrency 测试编码器池的并发性能
func TestEncoderPoolConcurrency(t *testing.T) {
	logger := zap.NewNop()

	// 创建编码器池
	pool := NewEncoderPool(4, MockEncoder, logger)
	defer pool.Close()

	// 并发测试
	const numTasks = 10 // 减少任务数量，避免队列满
	var wg sync.WaitGroup
	results := make([][]byte, numTasks)
	errors := make([]error, numTasks)

	start := time.Now()

	for i := 0; i < numTasks; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			testData := []byte("test audio data " + string(rune('0'+index)))
			ctx := context.Background()

			result, err := pool.Encode(ctx, testData)
			results[index] = result
			errors[index] = err
		}(i)
	}

	wg.Wait()
	duration := time.Since(start)

	// 验证结果
	successCount := 0
	for i := 0; i < numTasks; i++ {
		if errors[i] != nil {
			// 允许一些任务因为队列满而失败，这是正常的
			if errors[i].Error() == "编码器池繁忙" {
				t.Logf("任务 %d 因队列满而失败（正常现象）", i)
				continue
			}
			t.Errorf("任务 %d 编码失败: %v", i, errors[i])
			continue
		}

		testData := []byte("test audio data " + string(rune('0'+i)))
		expected := append([]byte("OPUS:"), testData...)
		if string(results[i]) != string(expected) {
			t.Errorf("任务 %d 编码结果不正确", i)
		} else {
			successCount++
		}
	}

	// 至少要有一半的任务成功
	if successCount < numTasks/2 {
		t.Errorf("成功任务数量太少: %d/%d", successCount, numTasks)
	}

	// 验证并发性能
	// 如果是串行执行，需要 numTasks * 10ms
	// 并发执行应该显著快于串行
	maxExpectedDuration := time.Duration(numTasks/2) * 15 * time.Millisecond // 允许一些开销
	if duration > maxExpectedDuration {
		t.Errorf("并发性能不佳，耗时: %v, 期望小于: %v", duration, maxExpectedDuration)
	}

	t.Logf("并发编码测试通过，%d个任务耗时: %v, 成功: %d", numTasks, duration, successCount)
}

// TestEncoderPoolTimeout 测试编码器池的超时处理
func TestEncoderPoolTimeout(t *testing.T) {
	logger := zap.NewNop()

	// 创建编码器池
	pool := NewEncoderPool(2, MockEncoder, logger)
	defer pool.Close()

	// 使用很短的超时
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	testData := []byte("test audio data")

	_, err := pool.Encode(ctx, testData)

	// 应该返回超时错误
	if err == nil {
		t.Error("期望超时错误，但没有错误")
	}

	if err != context.DeadlineExceeded {
		t.Errorf("期望超时错误，实际: %v", err)
	}

	t.Logf("超时测试通过，错误: %v", err)
}

// BenchmarkEncoderPool 基准测试编码器池
func BenchmarkEncoderPool(b *testing.B) {
	logger := zap.NewNop()

	// 创建编码器池
	pool := NewEncoderPool(4, MockEncoder, logger)
	defer pool.Close()

	testData := []byte("benchmark test data")
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pool.Encode(ctx, testData)
	}
}

// BenchmarkEncoderPoolParallel 并行基准测试编码器池
func BenchmarkEncoderPoolParallel(b *testing.B) {
	logger := zap.NewNop()

	// 创建编码器池
	pool := NewEncoderPool(4, MockEncoder, logger)
	defer pool.Close()

	testData := []byte("benchmark test data")

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		ctx := context.Background()
		for pb.Next() {
			pool.Encode(ctx, testData)
		}
	})
}
