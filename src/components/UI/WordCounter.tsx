/**
 * WordCounter 组件 - React Native 版本
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Card from '../Card';
import ProgressBar from '../Data/ProgressBar';

interface WordCounterProps {
  content: string;
  targetWords?: number;
  style?: ViewStyle;
  showStats?: boolean;
  showProgress?: boolean;
  showSpeed?: boolean;
  onTargetReached?: () => void;
}

interface WritingStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  sentences: number;
  readingTime: number;
  writingSpeed: number;
  progress: number;
}

const WordCounter: React.FC<WordCounterProps> = ({
  content,
  targetWords = 1000,
  style,
  showStats = true,
  showProgress = true,
  showSpeed = false,
  onTargetReached,
}) => {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastWordCount, setLastWordCount] = useState(0);
  const [writingSpeed, setWritingSpeed] = useState(0);

  const stats = useMemo((): WritingStats => {
    const words = content.trim().split(/\s+/).filter((word) => word.length > 0).length;
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    const readingTime = Math.ceil(words / 200); // 假设每分钟阅读200字
    const progress = targetWords > 0 ? Math.min((words / targetWords) * 100, 100) : 0;

    return {
      words,
      characters,
      charactersNoSpaces,
      paragraphs,
      sentences,
      readingTime,
      writingSpeed,
      progress,
    };
  }, [content, targetWords, writingSpeed]);

  useEffect(() => {
    if (content.length > 0 && !startTime) {
      setStartTime(Date.now());
    }

    if (stats.words > lastWordCount && startTime) {
      const elapsed = (Date.now() - startTime) / 1000 / 60; // 分钟
      if (elapsed > 0) {
        const speed = (stats.words - lastWordCount) / elapsed;
        setWritingSpeed(speed);
      }
    }

    setLastWordCount(stats.words);

    if (stats.words >= targetWords && onTargetReached) {
      onTargetReached();
    }
  }, [content, stats.words, targetWords, startTime, lastWordCount, onTargetReached]);

  return (
    <Card padding="md" style={style}>
      <View style={styles.container}>
        {showProgress && (
          <View style={styles.progressSection}>
            <ProgressBar
              value={stats.words}
              max={targetWords}
              variant={stats.progress >= 100 ? 'success' : 'default'}
              showValue
              label={`${stats.words} / ${targetWords} 字`}
            />
          </View>
        )}

        {showStats && (
          <View style={styles.statsSection}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>字数</Text>
                <Text style={styles.statValue}>{stats.words}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>字符</Text>
                <Text style={styles.statValue}>{stats.characters}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>段落</Text>
                <Text style={styles.statValue}>{stats.paragraphs}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>句子</Text>
                <Text style={styles.statValue}>{stats.sentences}</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>阅读时间</Text>
                <Text style={styles.statValue}>{stats.readingTime} 分钟</Text>
              </View>
              {showSpeed && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>写作速度</Text>
                  <Text style={styles.statValue}>
                    {Math.round(stats.writingSpeed)} 字/分钟
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  progressSection: {
    marginBottom: 8,
  },
  statsSection: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
});

export default WordCounter;
