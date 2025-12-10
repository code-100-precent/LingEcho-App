/**
 * 图标组件统一导出
 * 使用 @expo/vector-icons 提供丰富的图标库
 */
import React from 'react';
import {
  MaterialIcons,
  MaterialCommunityIcons,
  Ionicons,
  Feather,
  FontAwesome,
  FontAwesome5,
  AntDesign,
  Entypo,
  SimpleLineIcons,
  Octicons,
  Zocial,
  Foundation,
} from '@expo/vector-icons';

// 图标组件类型
export type IconLibrary =
  | 'MaterialIcons'
  | 'MaterialCommunityIcons'
  | 'Ionicons'
  | 'Feather'
  | 'FontAwesome'
  | 'FontAwesome5'
  | 'AntDesign'
  | 'Entypo'
  | 'SimpleLineIcons'
  | 'Octicons'
  | 'Zocial'
  | 'Foundation';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  library?: IconLibrary;
}

/**
 * 通用图标组件
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#1f2937',
  library = 'MaterialIcons',
}) => {
  const iconProps: any = { name: name as any, size, color };

  switch (library) {
    case 'MaterialIcons':
      return <MaterialIcons {...iconProps} />;
    case 'MaterialCommunityIcons':
      return <MaterialCommunityIcons {...iconProps} />;
    case 'Ionicons':
      return <Ionicons {...iconProps} />;
    case 'Feather':
      return <Feather {...iconProps} />;
    case 'FontAwesome':
      return <FontAwesome {...iconProps} />;
    case 'FontAwesome5':
      return <FontAwesome5 {...iconProps} />;
    case 'AntDesign':
      return <AntDesign {...iconProps} />;
    case 'Entypo':
      return <Entypo {...iconProps} />;
    case 'SimpleLineIcons':
      return <SimpleLineIcons {...iconProps} />;
    case 'Octicons':
      return <Octicons {...iconProps} />;
    case 'Zocial':
      return <Zocial {...iconProps} />;
    case 'Foundation':
      return <Foundation {...iconProps} />;
    default:
      return <MaterialIcons {...iconProps} />;
  }
};

// 常用图标快捷导出
export const Mic = (props: Omit<IconProps, 'name'>) => (
  <Feather name="mic" {...props} />
);

export const PhoneOff = (props: Omit<IconProps, 'name'>) => (
  <Feather name="phone-off" {...props} />
);

export const Phone = (props: Omit<IconProps, 'name'>) => (
  <Feather name="phone" {...props} />
);

export const CheckCircle = (props: Omit<IconProps, 'name'>) => (
  <Feather name="check-circle" {...props} />
);

export const AlertTriangle = (props: Omit<IconProps, 'name'>) => (
  <Feather name="alert-triangle" {...props} />
);

export const Info = (props: Omit<IconProps, 'name'>) => (
  <Feather name="info" {...props} />
);

export const Users = (props: Omit<IconProps, 'name'>) => (
  <Feather name="users" {...props} />
);

export const Plus = (props: Omit<IconProps, 'name'>) => (
  <Feather name="plus" {...props} />
);

export const Settings = (props: Omit<IconProps, 'name'>) => (
  <Feather name="settings" {...props} />
);

export const Search = (props: Omit<IconProps, 'name'>) => (
  <Feather name="search" {...props} />
);

export const X = (props: Omit<IconProps, 'name'>) => (
  <Feather name="x" {...props} />
);

export const XCircle = (props: Omit<IconProps, 'name'>) => (
  <Feather name="x-circle" {...props} />
);

export const Smartphone = (props: Omit<IconProps, 'name'>) => (
  <Feather name="smartphone" {...props} />
);

export const ChevronDown = (props: Omit<IconProps, 'name'>) => (
  <Feather name="chevron-down" {...props} />
);

export const ChevronLeft = (props: Omit<IconProps, 'name'>) => (
  <Feather name="chevron-left" {...props} />
);

export const ChevronRight = (props: Omit<IconProps, 'name'>) => (
  <Feather name="chevron-right" {...props} />
);

export const Check = (props: Omit<IconProps, 'name'>) => (
  <Feather name="check" {...props} />
);

export const Calendar = (props: Omit<IconProps, 'name'>) => (
  <Feather name="calendar" {...props} />
);

export const Play = (props: Omit<IconProps, 'name'>) => (
  <Feather name="play" {...props} />
);

export const Pause = (props: Omit<IconProps, 'name'>) => (
  <Feather name="pause" {...props} />
);

export const Volume2 = (props: Omit<IconProps, 'name'>) => (
  <Feather name="volume-2" {...props} />
);

export const VolumeX = (props: Omit<IconProps, 'name'>) => (
  <Feather name="volume-x" {...props} />
);

export const Download = (props: Omit<IconProps, 'name'>) => (
  <Feather name="download" {...props} />
);

export const RotateCcw = (props: Omit<IconProps, 'name'>) => (
  <Feather name="rotate-ccw" {...props} />
);

export const Square = (props: Omit<IconProps, 'name'>) => (
  <Feather name="square" {...props} />
);

export const User = (props: Omit<IconProps, 'name'>) => (
  <Feather name="user" {...props} />
);

export const Bot = (props: Omit<IconProps, 'name'>) => (
  <MaterialCommunityIcons name="robot" {...props} />
);

export const MessageCircle = (props: Omit<IconProps, 'name'>) => (
  <Feather name="message-circle" {...props} />
);

export const Zap = (props: Omit<IconProps, 'name'>) => (
  <Feather name="zap" {...props} />
);

export const Circle = (props: Omit<IconProps, 'name'>) => (
  <Feather name="circle" {...props} />
);

export const DollarSign = (props: Omit<IconProps, 'name'>) => (
  <Feather name="dollar-sign" {...props} />
);

export const TrendingUp = (props: Omit<IconProps, 'name'>) => (
  <Feather name="trending-up" {...props} />
);

export const BarChart = (props: Omit<IconProps, 'name'>) => (
  <Feather name="bar-chart-2" {...props} />
);

