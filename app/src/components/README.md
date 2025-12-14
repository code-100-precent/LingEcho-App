# Components 目录说明

## React Native 组件

以下组件已经适配为 React Native 版本，位于 `components` 根目录：

- ✅ **Button.tsx** - 按钮组件
- ✅ **Input.tsx** - 输入框组件
- ✅ **Card.tsx** - 卡片组件
- ✅ **Badge.tsx** - 徽章组件
- ✅ **Avatar.tsx** - 头像组件
- ✅ **Select.tsx** - 选择器组件
- ✅ **Modal.tsx** - 模态框组件
- ✅ **Switch.tsx** - 开关组件
- ✅ **EmptyState.tsx** - 空状态组件
- ✅ **CallAudioPlayer.tsx** - 音频播放器（需要 expo-av）
- ✅ **VoicePlayer.tsx** - 语音播放器（需要 expo-av）
- ✅ **VoiceRecorder.tsx** - 语音录制器（需要 expo-av）

## UI 组件（已适配）

`UI/` 目录下的以下组件已适配为 React Native 版本：

- ✅ **Slider.tsx** - 滑块组件
- ✅ **Tabs.tsx** - 标签页组件
- ✅ **AutocompleteInput.tsx** - 自动完成输入
- ✅ **DatePicker.tsx** - 日期选择器
- ✅ **Stepper.tsx** - 步骤条
- ✅ **ConfirmDialog.tsx** - 确认对话框
- ✅ **SimpleTabs.tsx** - 简单标签页
- ✅ **SimpleSelect.tsx** - 简单选择器
- ✅ **IconText.tsx** - 图标文本
- ✅ **WordCounter.tsx** - 字数统计

## Voice 组件（已适配）

- ✅ **TextInputBox.tsx** - 文本输入框
- ✅ **VoiceBall.tsx** - 语音球
- ✅ **AssistantList.tsx** - 助手列表

## Data 组件（已适配）

- ✅ **ProgressBar.tsx** - 进度条
- ✅ **StatCard.tsx** - 统计卡片

## Layout 组件（已适配）

- ✅ **PageHeader.tsx** - 页面标题
- ✅ **PageContainer.tsx** - 页面容器
- ✅ **Grid.tsx** - 网格布局

## 图标库

项目使用 `@expo/vector-icons` 图标库，提供了丰富的图标集：

- **Feather** - 简洁的线性图标（推荐）
- **MaterialIcons** - Material Design 图标
- **Ionicons** - Ionic 图标
- **FontAwesome** - Font Awesome 图标
- 等等...

### 使用方式

```typescript
// 导入图标
import { Mic, Phone, Users, Settings, Icon } from '../components/Icons';

// 使用预定义图标
<Mic size={24} color="#3b82f6" />

// 使用通用图标组件
<Icon name="heart" library="Feather" size={24} color="#ec4899" />
```

## 安装依赖

### 音频依赖（已安装）

```bash
cd app
npx expo install expo-av
```

### 图标库（已安装）

```bash
cd app
npx expo install @expo/vector-icons
```

## 使用方式

```typescript
import {
  Button,
  Input,
  Card,
  Badge,
  Avatar,
  Select,
  Modal,
  Switch,
  EmptyState,
  // ... 其他组件
} from '../components';

// 导入图标
import { Mic, Phone, Users } from '../components/Icons';
```

