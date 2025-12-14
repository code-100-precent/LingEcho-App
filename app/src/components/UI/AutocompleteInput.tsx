/**
 * AutocompleteInput 组件 - React Native 版本
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ViewStyle,
} from 'react-native';
import Input from '../Input';
import { ChevronDown, Check } from '../Icons';

interface AutocompleteOption {
  value: string;
  label: string;
  description?: string;
}

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: AutocompleteOption[];
  leftIcon?: React.ReactNode;
  helperText?: string;
  error?: string;
  style?: ViewStyle;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  value,
  onChange,
  placeholder = '输入或选择...',
  options,
  leftIcon,
  helperText,
  error,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // 同步外部value变化
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 过滤选项
  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.value.toLowerCase().includes(inputValue.toLowerCase()) ||
      option.description?.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(newValue.length > 0 && filteredOptions.length > 0);
  };

  const handleSelectOption = (option: AutocompleteOption) => {
    setInputValue(option.value);
    onChange(option.value);
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (inputValue && filteredOptions.length > 0) {
      setIsOpen(true);
    }
  };

  const renderOption = ({ item }: { item: AutocompleteOption }) => {
    const isSelected = item.value === inputValue;
    return (
      <TouchableOpacity
        onPress={() => handleSelectOption(item)}
        style={[
          styles.option,
          isSelected && styles.optionSelected,
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.optionContent}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionLabel}>{item.label}</Text>
            {isSelected && <Check size={16} color="#3b82f6" />}
          </View>
          {item.description && (
            <Text style={styles.optionDescription}>{item.description}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Input
        label={label}
        value={inputValue}
        onChangeText={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        helperText={helperText}
        error={error}
        rightIcon={
          <View style={isOpen && { transform: [{ rotate: '180deg' }] }}>
            <ChevronDown size={16} color="#9ca3af" />
          </View>
        }
      />

      {/* 下拉建议列表 */}
      {isOpen && inputValue && filteredOptions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={filteredOptions}
            renderItem={renderOption}
            keyExtractor={(item) => item.value}
            style={styles.list}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    zIndex: 1000,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 240,
    zIndex: 1001,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
  checkIcon: {
    fontSize: 16,
    color: '#3b82f6',
    marginLeft: 8,
  },
  optionDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  chevron: {
    fontSize: 12,
    color: '#9ca3af',
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
});

export default AutocompleteInput;
