/**
 * NavBar 组件 - React Native 版本
 * 移动 App 的顶部导航栏
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export interface NavBarProps {
  title?: string;
  leftIcon?: string;
  leftIconColor?: string;
  onLeftPress?: () => void;
  rightIcon?: string;
  rightIconColor?: string;
  onRightPress?: () => void;
  rightComponent?: React.ReactNode;
  showBack?: boolean;
  backgroundColor?: string;
  titleColor?: string;
  style?: any;
}

const NavBar: React.FC<NavBarProps> = ({
  title,
  leftIcon,
  leftIconColor = '#1f2937',
  onLeftPress,
  rightIcon,
  rightIconColor = '#1f2937',
  onRightPress,
  rightComponent,
  showBack = false,
  backgroundColor = '#ffffff',
  titleColor = '#1f2937',
  style,
}) => {
  const navigation = useNavigation();

  const handleLeftPress = () => {
    if (onLeftPress) {
      onLeftPress();
    } else if (showBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }, style]} edges={['top']}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
        backgroundColor={backgroundColor}
        translucent={false}
      />
      <View style={[styles.container, { backgroundColor }]}>
        {/* 左侧按钮 */}
        <View style={styles.left}>
          {(showBack || leftIcon || onLeftPress) && (
            <TouchableOpacity
              onPress={handleLeftPress}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              {leftIcon ? (
                <Feather
                  name={leftIcon as any}
                  size={24}
                  color={leftIconColor}
                />
              ) : showBack ? (
                <Feather name="arrow-left" size={24} color={leftIconColor} />
              ) : null}
            </TouchableOpacity>
          )}
        </View>

        {/* 标题 */}
        <View style={styles.center}>
          {title && (
            <Text
              style={[styles.title, { color: titleColor }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
        </View>

        {/* 右侧按钮 */}
        <View style={styles.right}>
          {rightComponent ? (
            rightComponent
          ) : rightIcon ? (
            <TouchableOpacity
              onPress={onRightPress}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Feather name={rightIcon as any} size={24} color={rightIconColor} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 1000,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default NavBar;

