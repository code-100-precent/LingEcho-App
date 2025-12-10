/**
 * Modal 组件 - React Native 版本
 */
import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  ScrollView,
} from 'react-native';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  style?: ViewStyle;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  showCloseButton = true,
  style,
}) => {
  return (
    <RNModal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.content, styles.size[size], style]}
          onStartShouldSetResponder={() => true}
        >
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <ScrollView style={styles.body}>{children}</ScrollView>
        </View>
      </TouchableOpacity>
    </RNModal>
  );
};

const ModalHeader: React.FC<{
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  style?: ViewStyle;
}> = ({ children, onClose, showCloseButton = true, style }) => (
  <View style={[styles.header, style]}>
    <View style={styles.headerContent}>{children}</View>
    {showCloseButton && onClose && (
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    )}
  </View>
);

const ModalTitle: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

const ModalContent: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => (
  <View style={[styles.body, style]}>{children}</View>
);

const ModalFooter: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: '90%',
  },
  size: {
    sm: {
      width: '90%',
      maxWidth: 400,
    },
    md: {
      width: '90%',
      maxWidth: 500,
    },
    lg: {
      width: '90%',
      maxWidth: 700,
    },
    xl: {
      width: '90%',
      maxWidth: 900,
    },
    full: {
      width: '100%',
      height: '100%',
      maxHeight: '100%',
    },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6b7280',
  },
  body: {
    padding: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
});

export default Modal;
export { ModalHeader, ModalTitle, ModalContent, ModalFooter };

