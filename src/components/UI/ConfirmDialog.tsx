/**
 * ConfirmDialog 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Modal from '../Modal';
import Button from '../Button';
import { AlertTriangle, CheckCircle, Info } from '../Icons';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  icon?: React.ReactNode;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  icon,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIcon = () => {
    if (icon) return icon;

    switch (variant) {
      case 'danger':
        return <AlertTriangle size={24} color="#ef4444" />;
      case 'warning':
        return <AlertTriangle size={24} color="#f59e0b" />;
      case 'success':
        return <CheckCircle size={24} color="#10b981" />;
      default:
        return <Info size={24} color="#3b82f6" />;
    }
  };

  const getIconStyles = () => {
    switch (variant) {
      case 'danger':
        return styles.iconContainerDanger;
      case 'warning':
        return styles.iconContainerWarning;
      case 'success':
        return styles.iconContainerSuccess;
      default:
        return styles.iconContainerDefault;
    }
  };

  const getButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'primary';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, getIconStyles()]}>
            {getIcon()}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.description}>{description}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            variant="outline"
            onPress={onClose}
            style={styles.cancelButton}
          >
            {cancelText}
          </Button>
          <Button
            variant={getButtonVariant() as any}
            onPress={handleConfirm}
            style={styles.confirmButton}
          >
            {confirmText}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDefault: {
    backgroundColor: '#dbeafe',
  },
  iconContainerDanger: {
    backgroundColor: '#fee2e2',
  },
  iconContainerWarning: {
    backgroundColor: '#fef3c7',
  },
  iconContainerSuccess: {
    backgroundColor: '#d1fae5',
  },
  textContainer: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 24,
  },
  confirmButton: {
    paddingHorizontal: 24,
  },
});

export default ConfirmDialog;
