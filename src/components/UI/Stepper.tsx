/**
 * Stepper 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Check } from '../Icons';

interface Step {
  title: string;
  description?: string;
  content?: React.ReactNode;
  completed?: boolean;
  disabled?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  orientation?: 'horizontal' | 'vertical';
  style?: ViewStyle;
  showContent?: boolean;
}

const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  orientation = 'horizontal',
  style,
  showContent = false,
}) => {
  const isHorizontal = orientation === 'horizontal';

  const renderStep = (step: Step, index: number) => {
    const isActive = index === currentStep;
    const isCompleted = step.completed || index < currentStep;
    const isClickable = onStepClick && !step.disabled;

    return (
      <View
        key={index}
        style={[
          styles.stepContainer,
          isHorizontal && styles.stepContainerHorizontal,
          !isHorizontal && styles.stepContainerVertical,
        ]}
      >
        {/* 步骤圆圈 */}
        <TouchableOpacity
          onPress={() => isClickable && onStepClick?.(index)}
          disabled={!isClickable}
          style={[
            styles.stepCircle,
            isCompleted && styles.stepCircleCompleted,
            isActive && !isCompleted && styles.stepCircleActive,
            !isActive && !isCompleted && styles.stepCircleInactive,
            step.disabled && styles.stepCircleDisabled,
            isClickable && !step.disabled && styles.stepCircleClickable,
          ]}
          activeOpacity={0.7}
        >
          {isCompleted ? (
            <Check size={16} color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.stepNumber,
                isActive && styles.stepNumberActive,
              ]}
            >
              {index + 1}
            </Text>
          )}
        </TouchableOpacity>

        {/* 步骤信息 */}
        <View
          style={[
            styles.stepInfo,
            isHorizontal && styles.stepInfoHorizontal,
            !isHorizontal && styles.stepInfoVertical,
          ]}
        >
          <Text
            style={[
              styles.stepTitle,
              isActive && styles.stepTitleActive,
              isCompleted && styles.stepTitleCompleted,
              !isActive && !isCompleted && styles.stepTitleInactive,
            ]}
          >
            {step.title}
          </Text>
          {step.description && (
            <Text style={styles.stepDescription}>{step.description}</Text>
          )}
        </View>

        {/* 连接线 */}
        {index < steps.length - 1 && (
          <View
            style={[
              styles.connector,
              isHorizontal && styles.connectorHorizontal,
              !isHorizontal && styles.connectorVertical,
              isCompleted && styles.connectorCompleted,
            ]}
          />
        )}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        isHorizontal && styles.containerHorizontal,
        !isHorizontal && styles.containerVertical,
        style,
      ]}
    >
      {steps.map((step, index) => renderStep(step, index))}
      {showContent && steps[currentStep]?.content && (
        <View style={styles.content}>
          {steps[currentStep].content}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  containerHorizontal: {
    flexDirection: 'column',
  },
  containerVertical: {
    flexDirection: 'row',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepContainerHorizontal: {
    flexDirection: 'column',
    flex: 1,
  },
  stepContainerVertical: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  stepCircleCompleted: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  stepCircleActive: {
    borderColor: '#3b82f6',
  },
  stepCircleInactive: {
    borderColor: '#d1d5db',
  },
  stepCircleDisabled: {
    opacity: 0.5,
  },
  stepCircleClickable: {
    // 可点击样式
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberActive: {
    color: '#3b82f6',
  },
  stepInfo: {
    marginTop: 8,
  },
  stepInfoHorizontal: {
    alignItems: 'center',
  },
  stepInfoVertical: {
    marginLeft: 12,
    marginTop: 0,
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  stepTitleActive: {
    color: '#3b82f6',
  },
  stepTitleCompleted: {
    color: '#3b82f6',
  },
  stepTitleInactive: {
    color: '#9ca3af',
  },
  stepDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  connector: {
    backgroundColor: '#e5e7eb',
  },
  connectorHorizontal: {
    position: 'absolute',
    top: 16,
    left: '50%',
    right: '-50%',
    height: 2,
    zIndex: -1,
  },
  connectorVertical: {
    width: 2,
    height: 40,
    marginLeft: 15,
    marginTop: 8,
  },
  connectorCompleted: {
    backgroundColor: '#3b82f6',
  },
  content: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
});

export default Stepper;
