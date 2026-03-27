/**
 * 测试来电选择弹窗页面
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import IncomingCallModal from '../components/CallSelection/IncomingCallModal';

const TestCallModal: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const handleShowModal = () => {
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    console.log('用户关闭了弹窗');
  };

  const handleSchemeSelected = (schemeId: number) => {
    console.log('用户选择了方案:', schemeId);
    setShowModal(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>来电选择弹窗测试</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleShowModal}>
        <Text style={styles.buttonText}>显示来电弹窗</Text>
      </TouchableOpacity>

      <IncomingCallModal
        visible={showModal}
        callId="test-call-123"
        callerNumber="13800138000"
        calledNumber="18358932557"
        onClose={handleClose}
        onSchemeSelected={handleSchemeSelected}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TestCallModal;
