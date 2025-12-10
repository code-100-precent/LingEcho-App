/**
 * EmptyState 组件 - React Native 版本
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Button from './Button';

export interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  style?: ViewStyle;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={styles.iconContainer}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconEmoji}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {action && (
        <Button
          variant="primary"
          size="md"
          onPress={action.onPress}
          style={styles.actionButton}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  actionButton: {
    minWidth: 120,
  },
});

export default EmptyState;

