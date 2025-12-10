/**
 * Card 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated' | 'filled' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  onPress?: () => void;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  footer?: React.ReactNode;
  style?: ViewStyle;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  actions,
  variant = 'default',
  padding = 'md',
  hover = false,
  onPress,
  headerClassName,
  bodyClassName,
  footerClassName,
  footer,
  style,
}) => {
  const CardComponent = onPress ? TouchableOpacity : View;

  const variantStyle = variantStyles[variant];
  const paddingStyle = paddingStyles[padding];

  return (
    <CardComponent
      style={[
        styles.base,
        variantStyle,
        paddingStyle,
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {(title || subtitle || actions) && (
        <View style={[styles.header, headerClassName as ViewStyle]}>
          <View style={styles.headerContent}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
      )}

      <View style={[styles.body, bodyClassName as ViewStyle]}>{children}</View>

      {footer && (
        <View style={[styles.footer, footerClassName as ViewStyle]}>{footer}</View>
      )}
    </CardComponent>
  );
};

const CardHeader: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.header, style]}>{children}</View>;

const CardTitle: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <Text style={[styles.title, style]}>{children}</Text>;

const CardDescription: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => (
  <Text style={[styles.subtitle, style]}>{children}</Text>
);

const CardContent: React.FC<{ children: React.ReactNode; style?: ViewStyle }> =
  ({ children, style }) => (
    <View style={[styles.body, style]}>{children}</View>
  );

const CardFooter: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.footer, style]}>{children}</View>;

const variantStyles: Record<string, ViewStyle> = {
  default: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  elevated: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  filled: {
    backgroundColor: '#f9fafb',
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
};

const paddingStyles: Record<string, ViewStyle> = {
  none: {
    padding: 0,
  },
  sm: {
    padding: 12,
  },
  md: {
    padding: 16,
  },
  lg: {
      padding: 20,
    },
    xl: {
      padding: 24,
    },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  actions: {
    marginLeft: 16,
  },
  body: {
    flex: 1,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});

export default Card;
export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

