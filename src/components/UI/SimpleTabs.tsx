/**
 * SimpleTabs 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface SimpleTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

interface SimpleTabsListProps {
  children: React.ReactNode;
  style?: ViewStyle;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

interface SimpleTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

interface SimpleTabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
  currentValue?: string;
}

const SimpleTabs: React.FC<SimpleTabsProps> = ({
  value,
  onValueChange,
  children,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            currentValue: value,
            onValueChange,
          } as any);
        }
        return child;
      })}
    </View>
  );
};

const SimpleTabsList: React.FC<SimpleTabsListProps> = ({
  children,
  style,
  currentValue,
  onValueChange,
}) => {
  return (
    <View style={[styles.list, style]}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            currentValue,
            onValueChange,
          } as any);
        }
        return child;
      })}
    </View>
  );
};

const SimpleTabsTrigger: React.FC<SimpleTabsTriggerProps> = ({
  value,
  children,
  style,
  currentValue,
  onValueChange,
}) => {
  const isSelected = currentValue === value;

  return (
    <TouchableOpacity
      onPress={() => onValueChange?.(value)}
      style={[
        styles.trigger,
        isSelected && styles.triggerSelected,
        style,
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.triggerText,
          isSelected && styles.triggerTextSelected,
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
};

const SimpleTabsContent: React.FC<SimpleTabsContentProps> = ({
  value,
  children,
  style,
  currentValue,
}) => {
  if (currentValue !== value) {
    return null;
  }

  return <View style={[styles.content, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  list: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  trigger: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  triggerSelected: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  triggerTextSelected: {
    color: '#1f2937',
  },
  content: {
    marginTop: 16,
  },
});

export { SimpleTabs, SimpleTabsList, SimpleTabsTrigger, SimpleTabsContent };
export default SimpleTabs;
