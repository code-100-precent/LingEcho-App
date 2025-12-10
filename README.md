# LingEcho React Native App

这是 LingEcho 平台的移动端应用，使用 React Native 和 Expo 构建。

## 快速开始

### 前置要求

- Node.js (推荐使用 v18 或更高版本)
- npm 或 yarn
- Expo CLI (会自动安装)
- Expo Go 应用 (SDK 52 版本)

### 安装依赖

```bash
cd app
npm install
```

### 修复依赖版本（重要）

升级到 SDK 52 后，建议运行以下命令确保所有依赖版本正确：

```bash
npx expo install --fix
```

或者使用 yarn:

```bash
cd app
yarn install
```

### 运行应用

#### 在 iOS 模拟器上运行

```bash
npm run ios
```

#### 在 Android 模拟器上运行

```bash
npm run android
```

#### 在 Web 浏览器上运行

```bash
npm run web
```

#### 启动开发服务器

```bash
npm start
```

然后：
- 按 `i` 在 iOS 模拟器上运行
- 按 `a` 在 Android 模拟器上运行
- 按 `w` 在 Web 浏览器上运行
- 扫描二维码在真实设备上运行（需要安装 Expo Go 应用）

### 使用 Expo Go 在真实设备上运行

1. 在 iOS App Store 或 Google Play Store 下载 **Expo Go** 应用
2. 确保手机和电脑在同一 WiFi 网络下
3. 运行 `npm start`
4. 使用 Expo Go 扫描终端中显示的二维码

## 项目结构

```
app/
├── App.tsx                    # 主应用入口
├── package.json               # 项目依赖配置
├── tsconfig.json              # TypeScript 配置
├── app.json                   # Expo 配置
├── babel.config.js            # Babel 配置
└── src/
    ├── config/                # 配置文件
    │   └── api.ts             # API配置
    ├── context/               # React Context
    │   └── AuthContext.tsx    # 认证上下文
    ├── navigation/            # 导航配置
    │   └── AppNavigator.tsx   # 主导航器
    ├── screens/               # 页面组件
    │   ├── HomeScreen.tsx     # 首页
    │   ├── AssistantsScreen.tsx # 助手列表
    │   ├── ChatScreen.tsx     # 聊天页面
    │   ├── SettingsScreen.tsx # 设置页面
    │   └── LoginScreen.tsx    # 登录页面
    ├── services/              # API服务
    │   ├── auth.ts            # 认证服务
    │   └── assistant.ts      # 助手服务
    └── utils/                 # 工具函数
        └── request.ts         # HTTP请求封装
```

## 开发说明

这是一个功能完整的 React Native 应用，包含：

- ✅ 完整的导航系统（底部标签 + 堆栈导航）
- ✅ 用户认证（登录/注册）
- ✅ 助手管理（列表、创建、查看）
- ✅ 聊天功能（实时对话界面）
- ✅ 设置页面（用户信息、偏好设置）
- ✅ API服务层（与后端集成）
- ✅ 状态管理（Context API）
- ✅ TypeScript 支持
- ✅ Expo 框架集成

## 功能特性

### 已实现
- ✅ 用户认证（登录/注册）
- ✅ 助手列表和管理
- ✅ 聊天界面
- ✅ 设置页面
- ✅ API集成
- ✅ 导航系统

### 待实现
- [ ] WebSocket实时通信
- [ ] 语音输入/输出
- [ ] 语音克隆功能
- [ ] 工作流管理
- [ ] 知识库管理
- [ ] 推送通知
- [ ] 离线支持

## 技术栈

- **React Native**: 跨平台移动应用框架
- **Expo**: React Native 开发工具链
- **TypeScript**: 类型安全的 JavaScript
- **React Navigation**: 导航库（已配置但未使用）

## 配置说明

### API地址配置

API地址在 `src/config/api.ts` 中配置：

- 开发环境：默认使用 `http://localhost:7072/api`
- 生产环境：需要修改为实际的API地址

如果后端运行在不同的地址，请修改 `src/config/api.ts` 中的配置。

### 认证Token存储

应用使用 `@react-native-async-storage/async-storage` 存储认证token和用户信息。

## 缓存清理和热更新

### 为什么 Expo Go 显示旧版本？

如果更新代码后 Expo Go 还是显示旧版本，可能是缓存问题。以下是几种解决方案：

#### 方法 1: 清除缓存启动（推荐）

```bash
npm run start:clear
# 或
npm start -- --clear
```

#### 方法 2: 完全清理缓存

```bash
# 清理 Expo 和 Metro 缓存
npm run clean

# 完全清理（包括 watchman，如果已安装）
npm run clean:all

# 清理后重新启动
npm run reset
```

#### 方法 3: 在 Expo Go 中手动重新加载

1. 在 Expo Go 应用中，**摇一摇手机**（或按快捷键）
2. 选择 **"Reload"** 或 **"重新加载"**
3. 或者按 `Cmd+R` (iOS) / `R+R` (Android) 在开发菜单中

#### 方法 4: 清除 Expo Go 应用缓存

**iOS:**
- 长按 Expo Go 应用图标
- 选择 "卸载应用" 或删除后重新安装

**Android:**
- 设置 → 应用 → Expo Go → 存储 → 清除缓存

#### 方法 5: 使用开发菜单强制刷新

在 Expo Go 中：
1. 摇一摇手机打开开发菜单
2. 选择 **"Enable Fast Refresh"**（如果未启用）
3. 选择 **"Reload"**

### 热更新说明

Expo 支持 Fast Refresh（快速刷新）：
- **自动刷新**: 修改代码后会自动刷新（需要启用 Fast Refresh）
- **手动刷新**: 摇一摇手机 → Reload
- **清除缓存刷新**: 使用 `npm run start:clear` 启动

### 常见问题排查

1. **代码更新但界面没变化**
   - 运行 `npm run start:clear` 清除缓存
   - 在 Expo Go 中手动 Reload

2. **Metro bundler 报错**
   - 运行 `npm run clean` 清理缓存
   - 重启开发服务器

3. **依赖问题**
   - 删除 `node_modules` 和 `yarn.lock`/`package-lock.json`
   - 重新运行 `yarn install` 或 `npm install`

## 注意事项

- 确保已安装 Xcode (macOS) 或 Android Studio 用于模拟器
- 首次运行可能需要下载一些依赖，请耐心等待
- 如果遇到问题，可以尝试清除缓存：`npm run start:clear`
- 确保后端API服务正在运行（默认端口7072）
- 如果使用真实设备测试，确保手机和电脑在同一WiFi网络下
- **开发时建议使用 `npm run start:clear` 启动，避免缓存问题**

