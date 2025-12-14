/**
 * 关于我们页面
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MainLayout, Card } from '../components';

const AboutScreen: React.FC = () => {
  const navigation = useNavigation();
  const stats = [
    { label: '免费API', value: '50+', desc: '集成50+免费API调用' },
    { label: '持续运行', value: '24/7', desc: 'AI助手7x24小时运行' },
    { label: '开源项目', value: '100%', desc: '完全开源，透明可信' },
    { label: '无限可能', value: '∞', desc: '支持自定义扩展' },
  ];

  const features = [
    {
      icon: 'target',
      title: '技术先进',
      desc: '采用最新的AI技术，提供智能、高效的语音交互体验。',
    },
    {
      icon: 'eye',
      title: '用户体验',
      desc: '注重用户体验设计，提供直观、美观、易用的界面。',
    },
    {
      icon: 'users',
      title: '功能完整',
      desc: '为用户提供完整的解决方案，支持工作流自动化、知识库管理等。',
    },
    {
      icon: 'award',
      title: '开源透明',
      desc: '完全开源，代码透明，社区驱动，持续改进。',
    },
  ];

  return (
    <MainLayout
      navBarProps={{
        title: '关于我们',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoInner}>
              <Feather name="message-circle" size={56} color="#a78bfa" />
            </View>
          </View>
          <Text style={styles.title}>LingEcho</Text>
          <Text style={styles.subtitle}>
            您的智能语音助手平台
          </Text>
          <View style={styles.versionContainer}>
            <Text style={styles.version}>版本 1.0.0</Text>
            <View style={styles.versionBadge}>
              <Feather name="check-circle" size={12} color="#10b981" />
              <Text style={styles.versionBadgeText}>稳定版</Text>
            </View>
          </View>
        </View>

        {/* Mission Section */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>我们的使命</Text>
          <Text style={styles.sectionText}>
            致力于为用户提供最先进、最易用的AI语音助手解决方案，让每个人都能轻松享受智能语音交互的便利。
          </Text>
          <View style={styles.missionList}>
            <View style={styles.missionItem}>
              <Feather name="check-circle" size={20} color="#a78bfa" />
              <Text style={styles.missionText}>
                提供高质量的AI语音交互体验
              </Text>
            </View>
            <View style={styles.missionItem}>
              <Feather name="check-circle" size={20} color="#a78bfa" />
              <Text style={styles.missionText}>
                持续优化产品功能和用户体验
              </Text>
            </View>
            <View style={styles.missionItem}>
              <Feather name="check-circle" size={20} color="#a78bfa" />
              <Text style={styles.missionText}>
                构建开放、透明的开源社区
              </Text>
            </View>
          </View>
        </Card>

        {/* Stats Section */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>项目数据</Text>
          <Text style={styles.sectionDesc}>
            用数据说话，展示我们的技术实力和项目成果
          </Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statDesc}>{stat.desc}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Features Section */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>核心特性</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Feather name={feature.icon as any} size={32} color="#a78bfa" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Links Section */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>相关链接</Text>
          <View style={styles.linksList}>
            <TouchableOpacity
              style={styles.linkItem}
              onPress={() => Linking.openURL('https://github.com/lingecho')}
              activeOpacity={0.7}
            >
              <Feather name="github" size={20} color="#64748b" />
              <Text style={styles.linkText}>GitHub 仓库</Text>
              <Feather name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkItem}
              onPress={() => Linking.openURL('https://docs.lingecho.com')}
              activeOpacity={0.7}
            >
              <Feather name="book" size={20} color="#64748b" />
              <Text style={styles.linkText}>使用文档</Text>
              <Feather name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkItem}
              onPress={() => Linking.openURL('mailto:support@lingecho.com')}
              activeOpacity={0.7}
            >
              <Feather name="mail" size={20} color="#64748b" />
              <Text style={styles.linkText}>联系我们</Text>
              <Feather name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Copyright */}
        <View style={styles.copyright}>
          <Text style={styles.copyrightText}>
            © 2024 LingEcho. All rights reserved.
          </Text>
          <Text style={styles.copyrightText}>
            Made with ❤️ by the LingEcho Team
          </Text>
        </View>
      </ScrollView>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#a78bfa',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logoInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  version: {
    fontSize: 14,
    color: '#94a3b8',
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 24,
    marginBottom: 16,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  missionList: {
    gap: 12,
  },
  missionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  missionText: {
    flex: 1,
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#a78bfa',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  statDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  linksList: {
    gap: 12,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  copyright: {
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 16,
  },
  copyrightText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
});

export default AboutScreen;

