/**
 * Grid 组件 - React Native 版本
 */
import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface GridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

interface GridItemProps {
  children: ReactNode;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  style?: ViewStyle;
}

const Grid: React.FC<GridProps> = ({
  children,
  cols = 3,
  gap = 'md',
  style,
}) => {
  const gapStyles = {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  };

  const colWidths = {
    1: '100%',
    2: '50%',
    3: '33.33%',
    4: '25%',
    5: '20%',
    6: '16.66%',
    12: '8.33%',
  };

  return (
    <View
      style={[
        {
          gap: gapStyles[gap],
          flexWrap: 'wrap',
          flexDirection: 'row',
        },
        style,
      ]}
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement<GridItemProps>(child) && child.type === GridItem) {
          const span = child.props.span || 1;
          const itemWidth = `${(span / cols) * 100}%`;
          return (
            <View
              key={index}
              style={[
                {
                  width: itemWidth,
                  minWidth: itemWidth,
                },
              ]}
            >
              {child}
            </View>
          );
        }
        return child;
      })}
    </View>
  );
};

const GridItem: React.FC<GridItemProps> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

export { Grid, GridItem };
export default Grid;
