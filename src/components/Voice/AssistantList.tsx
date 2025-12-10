/**
 * AssistantList 组件 - React Native 版本
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Input from '../Input';
import Button from '../Button';
import { Users, Plus, Settings, X } from '../Icons';

interface Assistant {
  id: number;
  name: string;
  description: string;
  icon: string;
  active?: boolean;
}

interface AssistantListProps {
  assistants: Assistant[];
  selectedAssistant: number;
  onSelectAssistant: (id: number) => void;
  onAddAssistant: () => void;
  onConfigAssistant?: (id: number) => void;
  style?: ViewStyle;
}

const AssistantList: React.FC<AssistantListProps> = ({
  assistants,
  selectedAssistant,
  onSelectAssistant,
  onAddAssistant,
  onConfigAssistant,
  style,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤助手列表
  const filteredAssistants = useMemo(() => {
    if (!searchQuery.trim()) {
      return assistants;
    }

    const query = searchQuery.toLowerCase();
    return assistants.filter(
      (assistant) =>
        assistant.name.toLowerCase().includes(query) ||
        assistant.description.toLowerCase().includes(query)
    );
  }, [assistants, searchQuery]);

  const renderAssistant = ({ item }: { item: Assistant }) => {
    const isSelected = item.id === selectedAssistant;

    return (
      <TouchableOpacity
        onPress={() => onSelectAssistant(item.id)}
        style={[
          styles.assistantItem,
          isSelected && styles.assistantItemSelected,
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.assistantContent}>
          <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={styles.assistantInfo}>
            <Text style={[styles.assistantName, isSelected && styles.assistantNameSelected]}>
              {item.name}
            </Text>
            <Text style={styles.assistantDescription} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          {onConfigAssistant && (
            <TouchableOpacity
              onPress={() => onConfigAssistant(item.id)}
              style={styles.configButton}
            >
              <Settings size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
        {isSelected && <View style={styles.selectedIndicator} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* 标题栏 */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Users size={20} color="#1f2937" />
          <Text style={styles.title}>虚拟人物列表</Text>
        </View>
        <TouchableOpacity
          onPress={onAddAssistant}
          style={styles.addButton}
        >
          <Plus size={20} color="#7c3aed" />
        </TouchableOpacity>
      </View>

      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜索助手..."
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* 助手列表 */}
      <FlatList
        data={filteredAssistants}
        renderItem={renderAssistant}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        nestedScrollEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  searchInput: {
    marginBottom: 0,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 8,
  },
  assistantItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  assistantItemSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#faf5ff',
  },
  assistantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerSelected: {
    backgroundColor: '#ede9fe',
  },
  iconText: {
    fontSize: 24,
  },
  assistantInfo: {
    flex: 1,
  },
  assistantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  assistantNameSelected: {
    color: '#7c3aed',
  },
  assistantDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  configButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#7c3aed',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
});

export default AssistantList;
