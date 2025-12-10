# Expo SDK 52 升级说明

## 问题
项目使用的是 Expo SDK 50，但 Expo Go 应用是 SDK 52 版本，导致不兼容。

## 解决方案
已将项目升级到 Expo SDK 52。

## 升级步骤

### 1. 安装依赖
```bash
cd app
npm install
```

### 2. 修复依赖版本（推荐）
```bash
npx expo install --fix
```

这个命令会自动将所有 Expo 相关依赖升级到与 SDK 52 兼容的版本。

### 3. 清除缓存并重启
```bash
npx expo start -c
```

## 主要变更

### 依赖版本更新
- **expo**: ~50.0.0 → ~52.0.0
- **react**: 18.2.0 → 18.3.1
- **react-native**: 0.73.0 → 0.76.5
- **expo-status-bar**: ~1.11.1 → ~2.0.0
- **expo-constants**: ~15.4.0 → ~17.0.0
- **expo-secure-store**: ~12.8.0 → ~14.0.0
- **expo-linking**: ~6.2.0 → ~7.0.0
- **react-native-safe-area-context**: 4.8.2 → 4.12.0
- **react-native-screens**: ~3.29.0 → ~4.4.0
- **@react-native-async-storage/async-storage**: 1.21.0 → 2.1.0

## 注意事项

1. **首次运行**：升级后首次运行可能需要重新构建，请耐心等待
2. **API 兼容性**：代码层面通常不需要修改，但建议测试所有功能
3. **如果遇到问题**：可以运行 `npx expo-doctor` 检查项目配置

## 验证升级

运行以下命令验证升级是否成功：

```bash
npx expo --version
```

应该显示 Expo SDK 52 相关信息。

