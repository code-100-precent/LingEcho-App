/**
 * PageHeader 组件 - React Native 版本
 */
import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface Breadcrumb {
  label: string;
  onPress?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  style?: ViewStyle;
  breadcrumbs?: Breadcrumb[];
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  children,
  style,
  breadcrumbs,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* 面包屑导航 */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <View style={styles.breadcrumbs}>
          {breadcrumbs.map((crumb, index) => (
            <View key={index} style={styles.breadcrumbItem}>
              {index > 0 && <Text style={styles.breadcrumbSeparator}>›</Text>}
              {crumb.onPress ? (
                <TouchableOpacity onPress={crumb.onPress}>
                  <Text style={styles.breadcrumbLink}>{crumb.label}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.breadcrumbText}>{crumb.label}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* 页面标题和副标题 */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* 右侧操作按钮 */}
        {children && <View style={styles.actions}>{children}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbSeparator: {
    fontSize: 16,
    color: '#9ca3af',
    marginHorizontal: 8,
  },
  breadcrumbLink: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default PageHeader;
