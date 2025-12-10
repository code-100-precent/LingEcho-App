/**
 * StatCard 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Card from '../Card';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  iconColor?: string;
  description?: string;
  style?: ViewStyle;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  iconColor = '#3b82f6',
  description,
  style,
  onClick,
}) => {
  const getChangeColor = (type: string) => {
    switch (type) {
      case 'increase':
        return styles.changeIncrease;
      case 'decrease':
        return styles.changeDecrease;
      case 'neutral':
      default:
        return styles.changeNeutral;
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'increase':
        return '↗';
      case 'decrease':
        return '↘';
      case 'neutral':
      default:
        return '→';
    }
  };

  const content = (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
            {icon}
          </View>
        )}
      </View>

      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
        {change && (
          <View style={[styles.changeContainer, getChangeColor(change.type)]}>
            <Text style={styles.changeIcon}>{getChangeIcon(change.type)}</Text>
            <Text style={styles.changeText}>{Math.abs(change.value)}%</Text>
          </View>
        )}
      </View>

      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
    </View>
  );

  if (onClick) {
    return (
      <TouchableOpacity
        onPress={onClick}
        activeOpacity={0.7}
        style={style}
      >
        <Card padding="md" style={styles.card}>
          {content}
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <Card padding="md" style={[styles.card, style]}>
      {content}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeIcon: {
    fontSize: 14,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  changeIncrease: {
    color: '#10b981',
  },
  changeDecrease: {
    color: '#ef4444',
  },
  changeNeutral: {
    color: '#6b7280',
  },
  description: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});

export default StatCard;
