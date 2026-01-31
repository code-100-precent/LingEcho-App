/**
 * 外呼中心页面 - 主页面
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MainLayout } from '../components';
import CallTab from './CallCenter/CallTab';
import SchemeTab from './CallCenter/SchemeTab';
import NumbersTab from './CallCenter/NumbersTab';
import VoicemailTab from './CallCenter/VoicemailTab';
import CallHistoryTab from './CallCenter/CallHistoryTab';

// 标签页类型
type TabType = 'call' | 'schemes' | 'numbers' | 'voicemail' | 'history';

const CallCenterScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('call');

  // 标签页配置
  const tabs = [
    { id: 'call' as TabType, name: '通话控制', icon: 'phone-call' },
    { id: 'history' as TabType, name: '通话记录', icon: 'clock' },
    { id: 'schemes' as TabType, name: '代接方案', icon: 'settings' },
    { id: 'numbers' as TabType, name: '号码管理', icon: 'smartphone' },
    { id: 'voicemail' as TabType, name: '留言箱', icon: 'mail' },
  ];

  return (
    <MainLayout
      navBarProps={{
        title: '外呼中心',
        showBack: true,
      }}
      backgroundColor="#f8fafc"
    >
      {/* 标签页切换 */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Feather
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? '#a855f7' : '#64748b'}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 标签页内容 */}
      <View style={styles.tabContent}>
        {activeTab === 'call' && <CallTab />}
        {activeTab === 'history' && <CallHistoryTab />}
        {activeTab === 'schemes' && <SchemeTab />}
        {activeTab === 'numbers' && <NumbersTab />}
        {activeTab === 'voicemail' && <VoicemailTab />}
      </View>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#a855f7',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#a855f7',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
});

export default CallCenterScreen;
