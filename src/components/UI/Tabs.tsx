/**
 * Tabs 组件 - React Native 版本
 */
import React, { createContext, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  children,
  style,
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <View style={[styles.container, style]}>
        {children}
      </View>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const TabsList: React.FC<TabsListProps> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.list, style]}>
      {children}
    </View>
  );
};

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  style,
}) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }

  const { value: selectedValue, onValueChange } = context;
  const isSelected = selectedValue === value;

  return (
    <TouchableOpacity
      onPress={() => onValueChange(value)}
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

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  style,
}) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within a Tabs component');
  }

  const { value: selectedValue } = context;
  if (selectedValue !== value) {
    return null;
  }

  return (
    <View style={[styles.content, style]}>
      {children}
    </View>
  );
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

export { Tabs, TabsList, TabsTrigger, TabsContent };
export default Tabs;
