/**
 * Slider 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  PanResponder,
  Animated,
} from 'react-native';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  style?: ViewStyle;
}

const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  style,
}) => {
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const [thumbPosition] = React.useState(new Animated.Value(0));
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        // 开始拖动
      },
      onPanResponderMove: (_, gestureState) => {
        if (sliderWidth === 0) return;
        const newPosition = Math.max(
          0,
          Math.min(sliderWidth, gestureState.moveX - gestureState.x0)
        );
        const percentage = newPosition / sliderWidth;
        const newValue = min + percentage * (max - min);
        const steppedValue = Math.round(newValue / step) * step;
        const clampedValue = Math.max(min, Math.min(max, steppedValue));
        onValueChange([clampedValue]);
      },
      onPanResponderRelease: () => {
        // 结束拖动
      },
    })
  ).current;

  const percentage = ((value[0] - min) / (max - min)) * 100;

  React.useEffect(() => {
    if (sliderWidth > 0) {
      const position = (percentage / 100) * sliderWidth;
      thumbPosition.setValue(position);
    }
  }, [percentage, sliderWidth, thumbPosition]);

  return (
    <View
      style={[styles.container, style, disabled && styles.disabled]}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0) {
          setSliderWidth(width);
        }
      }}
      {...panResponder.panHandlers}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.trackFill,
            { width: `${percentage}%` },
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.thumb,
          {
            left: thumbPosition.interpolate({
              inputRange: [0, sliderWidth || 1],
              outputRange: [0, sliderWidth || 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    position: 'relative',
  },
  trackFill: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    position: 'absolute',
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export { Slider };
export default Slider;
