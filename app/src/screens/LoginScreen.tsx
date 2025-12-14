/**
 * 登录页面 - 参考 AuthModal 样式，优雅干练的淡紫色风格
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { Input, Button } from '../components';
import { Mail, Lock, Eye, EyeOff, Shield, User as UserIcon } from '../components/Icons';
import { getSystemInit } from '../services/api/system';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LoginScreenProps {
  onRegister?: () => void;
  onForgotPassword?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  onRegister,
  onForgotPassword,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const { login, loginWithEmailCode, sendEmailCode, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginType, setLoginType] = useState<'email' | 'password'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [showTwoFactorInput, setShowTwoFactorInput] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true); // 默认启用邮箱登录

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const modeSwitchAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;

  // 背景动画
  const backgroundAnim1 = useRef(new Animated.Value(0)).current;
  const backgroundAnim2 = useRef(new Animated.Value(0)).current;

  // 获取系统初始化信息
  useEffect(() => {
    getSystemInit().then(res => {
      if (res.code === 200 && res.data) {
        setEmailEnabled(res.data.email.configured);
        
        // 如果没有配置邮箱，默认使用密码登录
        if (!res.data.email.configured) {
          setLoginType('password');
        }
      }
    }).catch(err => {
      console.error('Failed to get system init info:', err);
      // 如果获取失败，默认启用邮箱登录
      setEmailEnabled(true);
    });
  }, []);

  useEffect(() => {
    // 启动动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // 背景浮动动画
    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim1, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim1, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim2, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundAnim2, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 倒计时效果
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // 模式切换动画
  useEffect(() => {
    Animated.spring(modeSwitchAnim, {
      toValue: mode === 'login' ? 0 : 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  // 成功状态动画
  useEffect(() => {
    if (isSuccess) {
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }
  }, [isSuccess]);

  const sendVerificationCode = async () => {
    if (!email) {
      setErrors({ ...errors, email: '请先输入邮箱' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors({ ...errors, email: '请输入有效的邮箱地址' });
      return;
    }

    setIsSendingCode(true);
    try {
      await sendEmailCode(email);
      setCountdown(60);
      const newErrors = { ...errors };
      delete newErrors.email;
      setErrors(newErrors);
    } catch (error: any) {
      setErrors({ ...errors, email: error.message || '验证码发送失败，请重试' });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async () => {
    const newErrors: { [key: string]: string } = {};

    // 验证邮箱
    if (!email) {
      newErrors.email = '请输入邮箱';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '邮箱格式不正确';
    }

    if (mode === 'login') {
      if (loginType === 'email') {
        if (!verificationCode) {
          newErrors.verificationCode = '请输入验证码';
        }
      } else {
        if (!password) {
          newErrors.password = '请输入密码';
        } else if (password.length < 6) {
          newErrors.password = '密码至少6位';
        }
      }
    } else {
      // 注册验证
      if (!displayName) {
        newErrors.displayName = '请输入显示名';
      }
      if (!password) {
        newErrors.password = '请输入密码';
      } else if (password.length < 6) {
        newErrors.password = '密码至少6位';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = '密码不匹配';
      }
      // 如果配置了邮箱，验证码和用户名是必需的
      if (emailEnabled) {
        if (!verificationCode) {
          newErrors.verificationCode = '请输入验证码';
        }
        if (!userName) {
          newErrors.userName = '请输入用户名';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      if (mode === 'register') {
        // 注册模式
        const registerData = await register(email, password, displayName, userName, verificationCode, emailEnabled);
        const finalDisplayName = registerData?.displayName || displayName || (email.includes('@') ? email.split('@')[0] : '用户');
        setSuccessData({
          email: registerData?.email || email,
          displayName: finalDisplayName,
          activation: registerData?.activation,
        });
        setIsSuccess(true);
        setTimeout(() => {
          setMode('login');
          setIsSuccess(false);
          setSuccessData(null);
          // 清空表单
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setUserName('');
          setDisplayName('');
          setVerificationCode('');
        }, 2000);
        return;
      } else {
        // 登录模式
        if (loginType === 'email') {
          // 邮箱验证码登录
          if (!verificationCode) {
            setErrors({ ...errors, verificationCode: '请输入验证码' });
            setIsLoading(false);
            return;
          }
          await loginWithEmailCode(email, verificationCode);
          // 登录成功后，AuthContext会更新isAuthenticated状态
          // AppNavigator会自动导航到Main页面
          navigation.replace('Main');
        } else {
          // 密码登录
          const result = await login(email, password);
          // 检查是否需要二级验证
          if (result.requiresTwoFactor) {
            setShowTwoFactorInput(true);
            setIsLoading(false);
            return;
          }
          // 登录成功后，AuthContext会更新isAuthenticated状态
          // AppNavigator会自动导航到Main页面
          navigation.replace('Main');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const errorMessage = error.message || (mode === 'login' ? '登录失败，请检查邮箱和密码' : '注册失败');
      setErrors({ email: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // 处理二级验证码提交
  const handleTwoFactorSubmit = async () => {
    if (!twoFactorCode.trim()) {
      setErrors({ ...errors, twoFactorCode: '请输入两步验证码' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password, twoFactorCode);
      if (result.requiresTwoFactor) {
        setErrors({ ...errors, twoFactorCode: '验证码错误，请重试' });
        setIsLoading(false);
        return;
      }
      // 登录成功
      navigation.replace('Main');
    } catch (error: any) {
      console.error('Two factor auth error:', error);
      setErrors({ ...errors, twoFactorCode: error.message || '验证失败' });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors({});
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setTwoFactorCode('');
    setUserName('');
    setDisplayName('');
    setShowTwoFactorInput(false);
  };

  const logoRotation = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const bgTranslateY1 = backgroundAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const bgTranslateY2 = backgroundAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  const modeSwitchTranslateX = modeSwitchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 50],
  });

  return (
    <View style={styles.container}>
      {/* 背景层 */}
      <View style={styles.gradientBackground}>
        {/* 渐变层叠效果 */}
        <View style={styles.gradientLayer1} />
        <View style={styles.gradientLayer2} />
        {/* 背景装饰元素 */}
        <Animated.View
          style={[
            styles.backgroundCircle1,
            {
              transform: [{ translateY: bgTranslateY1 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundCircle2,
            {
              transform: [{ translateY: bgTranslateY2 }],
            },
          ]}
        />
        <Animated.View style={[styles.backgroundCircle3]} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo 区域 */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [
                  { scale: logoScaleAnim },
                  { rotate: logoRotation },
                ],
              },
            ]}
          >
            <View style={styles.logoCircle}>
              <Image
                source={require('../../assets/logo192.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Text style={styles.title}>
            {mode === 'login' ? '欢迎回来' : '创建账户'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? '登录您的账户以继续'
              : '注册新账户开始使用'}
          </Text>

          {/* 成功状态显示 */}
          {isSuccess && successData && (
            <Animated.View
              style={[
                styles.successContainer,
                {
                  transform: [{ scale: successScaleAnim }],
                },
              ]}
            >
              <View style={styles.successIcon}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.successTitle}>注册成功！</Text>
              <Text style={styles.successText}>
                欢迎 {successData.displayName}，{successData.activation 
                  ? '您的账号已激活，可以立即使用。'
                  : '您的账号已创建，请等待管理员激活。'}
              </Text>
            </Animated.View>
          )}

          {/* 表单区域 */}
          {!isSuccess && (
            <View style={styles.form}>
              {/* 登录方式切换 - 仅在登录模式下显示，且邮箱已配置时显示 */}
              {mode === 'login' && emailEnabled && (
                <View style={styles.loginTypeSwitch}>
                  <TouchableOpacity
                    style={[
                      styles.switchButton,
                      loginType === 'email' && styles.switchButtonActive,
                    ]}
                    onPress={() => setLoginType('email')}
                  >
                    <Mail
                      size={16}
                      color={loginType === 'email' ? '#8b5cf6' : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.switchButtonText,
                        loginType === 'email' && styles.switchButtonTextActive,
                      ]}
                    >
                      邮箱验证码
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.switchButton,
                      loginType === 'password' && styles.switchButtonActive,
                    ]}
                    onPress={() => setLoginType('password')}
                  >
                    <Lock
                      size={16}
                      color={loginType === 'password' ? '#8b5cf6' : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.switchButtonText,
                        loginType === 'password' && styles.switchButtonTextActive,
                      ]}
                    >
                      密码登录
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 注册模式下的用户名和显示名 */}
              {mode === 'register' && (
                <View style={styles.nameRow}>
                  {emailEnabled && (
                    <View style={styles.nameInput}>
                      <Input
                        label="用户名"
                        placeholder="请输入用户名"
                        value={userName}
                        onChangeText={(text) => {
                          setUserName(text);
                          if (errors.userName) {
                            const newErrors = { ...errors };
                            delete newErrors.userName;
                            setErrors(newErrors);
                          }
                        }}
                        leftIcon={<UserIcon size={20} color="#a78bfa" />}
                        error={errors.userName}
                      />
                    </View>
                  )}
                  <View style={styles.nameInput}>
                    <Input
                      label="显示名"
                      placeholder="请输入显示名"
                      value={displayName}
                      onChangeText={(text) => {
                        setDisplayName(text);
                        if (errors.displayName) {
                          const newErrors = { ...errors };
                          delete newErrors.displayName;
                          setErrors(newErrors);
                        }
                      }}
                      leftIcon={<UserIcon size={20} color="#a78bfa" />}
                      error={errors.displayName}
                    />
                  </View>
                </View>
              )}

              {/* 邮箱输入 */}
              <Input
                label="邮箱"
                placeholder="请输入邮箱地址"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) {
                    const newErrors = { ...errors };
                    delete newErrors.email;
                    setErrors(newErrors);
                  }
                }}
                leftIcon={<Mail size={20} color="#a78bfa" />}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                wrapperStyle={styles.inputWrapper}
              />

              {/* 验证码输入 - 邮箱验证码登录时显示，且邮箱已配置 */}
              {mode === 'login' && loginType === 'email' && emailEnabled && (
                <Input
                  label="验证码"
                  placeholder="请输入验证码"
                  value={verificationCode}
                  onChangeText={(text) => {
                    setVerificationCode(text);
                    if (errors.verificationCode) {
                      const newErrors = { ...errors };
                      delete newErrors.verificationCode;
                      setErrors(newErrors);
                    }
                  }}
                  leftIcon={<Shield size={20} color="#a78bfa" />}
                  rightIcon={
                    <TouchableOpacity
                      onPress={sendVerificationCode}
                      disabled={isSendingCode || countdown > 0}
                      style={styles.sendCodeButton}
                    >
                      <Text
                        style={[
                          styles.sendCodeText,
                          (isSendingCode || countdown > 0) && styles.sendCodeTextDisabled,
                        ]}
                      >
                        {isSendingCode
                          ? '发送中...'
                          : countdown > 0
                          ? `${countdown}s`
                          : '发送验证码'}
                      </Text>
                    </TouchableOpacity>
                  }
                  error={errors.verificationCode}
                  keyboardType="number-pad"
                  wrapperStyle={styles.inputWrapper}
                />
              )}

              {/* 注册模式下的验证码输入 - 仅在配置了邮箱时显示 */}
              {mode === 'register' && emailEnabled && (
                <Input
                  label="验证码"
                  placeholder="请输入验证码"
                  value={verificationCode}
                  onChangeText={(text) => {
                    setVerificationCode(text);
                    if (errors.verificationCode) {
                      const newErrors = { ...errors };
                      delete newErrors.verificationCode;
                      setErrors(newErrors);
                    }
                  }}
                  leftIcon={<Shield size={20} color="#a78bfa" />}
                  rightIcon={
                    <TouchableOpacity
                      onPress={sendVerificationCode}
                      disabled={isSendingCode || countdown > 0}
                      style={styles.sendCodeButton}
                    >
                      <Text
                        style={[
                          styles.sendCodeText,
                          (isSendingCode || countdown > 0) && styles.sendCodeTextDisabled,
                        ]}
                      >
                        {isSendingCode
                          ? '发送中...'
                          : countdown > 0
                          ? `${countdown}s`
                          : '发送验证码'}
                      </Text>
                    </TouchableOpacity>
                  }
                  error={errors.verificationCode}
                  keyboardType="number-pad"
                  wrapperStyle={styles.inputWrapper}
                />
              )}

              {/* 密码输入 - 密码登录或注册时显示 */}
              {(loginType === 'password' || mode === 'register') && !showTwoFactorInput && (
                <>
                  <Input
                    label="密码"
                    placeholder="请输入密码"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) {
                        const newErrors = { ...errors };
                        delete newErrors.password;
                        setErrors(newErrors);
                      }
                    }}
                    leftIcon={<Lock size={20} color="#a78bfa" />}
                    rightIcon={
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        {showPassword ? (
                          <EyeOff size={20} color="#9ca3af" />
                        ) : (
                          <Eye size={20} color="#9ca3af" />
                        )}
                      </TouchableOpacity>
                    }
                    secureTextEntry={!showPassword}
                    error={errors.password}
                    wrapperStyle={styles.inputWrapper}
                  />

                  {/* 确认密码 - 仅注册时显示 */}
                  {mode === 'register' && (
                    <Input
                      label="确认密码"
                      placeholder="请再次输入密码"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errors.confirmPassword) {
                          const newErrors = { ...errors };
                          delete newErrors.confirmPassword;
                          setErrors(newErrors);
                        }
                      }}
                      leftIcon={<Lock size={20} color="#a78bfa" />}
                      rightIcon={
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={styles.eyeIcon}
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={20} color="#9ca3af" />
                          ) : (
                            <Eye size={20} color="#9ca3af" />
                          )}
                        </TouchableOpacity>
                      }
                      secureTextEntry={!showConfirmPassword}
                      error={errors.confirmPassword}
                      wrapperStyle={styles.inputWrapper}
                    />
                  )}
                </>
              )}

              {/* 二级验证码输入 - 仅在密码登录且需要二级验证时显示 */}
              {mode === 'login' && loginType === 'password' && showTwoFactorInput && (
                <>
                  <Input
                    label="两步验证码"
                    placeholder="请输入两步验证码"
                    value={twoFactorCode}
                    onChangeText={(text) => {
                      setTwoFactorCode(text);
                      if (errors.twoFactorCode) {
                        const newErrors = { ...errors };
                        delete newErrors.twoFactorCode;
                        setErrors(newErrors);
                      }
                    }}
                    leftIcon={<Shield size={20} color="#a78bfa" />}
                    error={errors.twoFactorCode}
                    keyboardType="number-pad"
                    wrapperStyle={styles.inputWrapper}
                  />
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleTwoFactorSubmit}
                    loading={isLoading}
                    style={styles.submitButton}
                  >
                    验证登录
                  </Button>
                  <TouchableOpacity
                    onPress={() => {
                      setShowTwoFactorInput(false);
                      setTwoFactorCode('');
                      setErrors({});
                    }}
                    style={styles.backButton}
                  >
                    <Text style={styles.backButtonText}>返回</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* 忘记密码 */}
              {mode === 'login' && loginType === 'password' && onForgotPassword && (
                <TouchableOpacity
                  onPress={onForgotPassword}
                  style={styles.forgotPassword}
                >
                  <Text style={styles.forgotPasswordText}>忘记密码？</Text>
                </TouchableOpacity>
              )}

              {/* 提交按钮 - 仅在非二级验证状态时显示 */}
              {!showTwoFactorInput && (
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleSubmit}
                    loading={isLoading}
                    style={styles.submitButton}
                  >
                    {mode === 'login' ? '登录' : '注册'}
                  </Button>
                </Animated.View>
              )}

              {/* 切换模式 */}
              <View style={styles.switchModeContainer}>
                <Text style={styles.switchModeText}>
                  {mode === 'login' ? '还没有账号？' : '已有账号？'}
                </Text>
                <TouchableOpacity onPress={switchMode}>
                  <Text style={styles.switchModeLink}>
                    {mode === 'login' ? '立即注册' : '立即登录'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3e8ff', // 确保容器背景是紫色
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f3e8ff',
  },
  gradientLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e9d5ff',
    opacity: 0.5,
  },
  gradientLayer2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ddd6fe',
    opacity: 0.3,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    justifyContent: 'center',
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a78bfa',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden', // 确保图片不会超出圆角
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  loginTypeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  switchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  switchButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  switchButtonTextActive: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    alignItems: 'flex-start', // 确保顶部对齐
  },
  nameInput: {
    flex: 1,
    minHeight: 80, // 为 label + input + error 预留空间，确保高度一致
  },
  inputWrapper: {
    marginBottom: 20,
  },
  sendCodeButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sendCodeText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  sendCodeTextDisabled: {
    color: '#9ca3af',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 24,
  },
  switchModeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  switchModeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  switchModeLink: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successCheck: {
    fontSize: 32,
    color: '#10b981',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  // 背景装饰
  backgroundCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    top: -50,
    right: -50,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    bottom: 100,
    left: -30,
  },
  backgroundCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(196, 181, 253, 0.2)',
    top: '40%',
    right: 20,
  },
});

export default LoginScreen;
