/**
 * DatePicker 组件 - React Native 版本
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Modal from '../Modal';
import Button from '../Button';
import { Calendar, ChevronLeft, ChevronRight } from '../Icons';

interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: ViewStyle;
  label?: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = '选择日期',
  disabled = false,
  style,
  label,
  error,
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(value ?? new Date());

  const today = new Date();
  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
  ];
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

  useEffect(() => {
    if (value instanceof Date) {
      setCurrentMonth(value);
    }
  }, [value]);

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    return !!(maxDate && date > maxDate);
  };

  const isDateSelected = (date: Date) => {
    if (!value) return false;
    return date.toDateString() === value.toDateString();
  };

  const isToday = (date: Date) => date.toDateString() === today.toDateString();

  const handleDateSelect = (date: Date) => {
    if (!isDateDisabled(date)) {
      onChange(date);
      setIsOpen(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1));
      return newMonth;
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonthIndex);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonthIndex);
    const days: JSX.Element[] = [];

    // 空白天数
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // 日期天数
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonthIndex, day);
      const disabled = isDateDisabled(date);
      const selected = isDateSelected(date);
      const isTodayDate = isToday(date);

      days.push(
        <TouchableOpacity
          key={day}
          onPress={() => handleDateSelect(date)}
          disabled={disabled}
          style={[
            styles.dayCell,
            styles.dayButton,
            selected && styles.daySelected,
            isTodayDate && !selected && styles.dayToday,
            disabled && styles.dayDisabled,
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.dayText,
              selected && styles.dayTextSelected,
              disabled && styles.dayTextDisabled,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        style={[
          styles.trigger,
          disabled && styles.triggerDisabled,
          error && styles.triggerError,
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            !value && styles.triggerTextPlaceholder,
          ]}
        >
          {value ? value.toLocaleDateString('zh-CN') : placeholder}
        </Text>
        <Calendar size={18} color="#9ca3af" />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="选择日期"
        size="sm"
      >
        <View style={styles.calendar}>
          {/* 月份导航 */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => navigateMonth('prev')}
              style={styles.navButton}
            >
              <ChevronLeft size={20} color="#6b7280" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentYear}年 {monthNames[currentMonthIndex]}
            </Text>
            <TouchableOpacity
              onPress={() => navigateMonth('next')}
              style={styles.navButton}
            >
              <ChevronRight size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* 星期标题 */}
          <View style={styles.weekHeader}>
            {dayNames.map((day) => (
              <View key={day} style={styles.weekDay}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* 日期网格 */}
          <View style={styles.daysGrid}>{renderCalendar()}</View>

          {/* 操作按钮 */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={() => {
                onChange(null);
                setIsOpen(false);
              }}
              style={styles.clearButton}
            >
              清除
            </Button>
            <Button
              variant="primary"
              onPress={() => setIsOpen(false)}
              style={styles.confirmButton}
            >
              确定
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    minHeight: 44,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerError: {
    borderColor: '#ef4444',
  },
  triggerText: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  triggerTextPlaceholder: {
    color: '#9ca3af',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
  calendar: {
    padding: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    borderRadius: 20,
  },
  daySelected: {
    backgroundColor: '#3b82f6',
  },
  dayToday: {
    backgroundColor: '#f3f4f6',
  },
  dayDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: '#1f2937',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: '#9ca3af',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  clearButton: {
    paddingHorizontal: 16,
  },
  confirmButton: {
    paddingHorizontal: 16,
  },
});

export default DatePicker;
