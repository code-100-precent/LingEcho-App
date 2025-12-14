# APK 打包指南

本指南将帮助你将 LingEcho App 打包为 Android APK 文件。

## 方法一：使用 EAS Build（推荐）

EAS Build 是 Expo 官方推荐的构建服务，支持云端构建，无需本地 Android 开发环境。

### 前置要求

1. **Expo 账号**
   - 访问 [expo.dev](https://expo.dev) 注册账号（免费）

2. **安装 EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

3. **登录 Expo 账号**
   ```bash
   eas login
   ```

### 步骤

#### 1. 初始化 EAS 配置

在项目根目录（`app/`）运行：

```bash
eas build:configure
```

这会创建 `eas.json` 配置文件。

#### 2. 配置构建选项

编辑 `eas.json`，确保 Android 配置正确：

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

#### 3. 开始构建 APK

**预览版本（用于测试）：**
```bash
eas build --platform android --profile preview
```

**生产版本：**
```bash
eas build --platform android --profile production
```

#### 4. 下载 APK

构建完成后，EAS 会提供一个下载链接，你可以：
- 在终端中点击链接下载
- 访问 [expo.dev](https://expo.dev) 的构建页面下载
- 使用命令：`eas build:list` 查看所有构建

---

## 方法二：本地构建（推荐用于网络问题）

如果你遇到 EAS Build 网络连接问题，或者有 Android 开发环境，可以使用本地构建。

### 前置要求

1. **Android Studio**
   - 下载并安装 [Android Studio](https://developer.android.com/studio)
   - 打开 Android Studio，安装 Android SDK（API Level 33+）
   - 在 Android Studio 中安装 "Android SDK Build-Tools"

2. **Java Development Kit (JDK)**
   - 安装 JDK 11 或更高版本
   - macOS 可以使用 Homebrew：`brew install openjdk@11`
   - 设置 JAVA_HOME：
     ```bash
     export JAVA_HOME=$(/usr/libexec/java_home -v 11)
     ```

3. **环境变量配置**

   在 `~/.zshrc` 或 `~/.bash_profile` 中添加：
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export JAVA_HOME=$(/usr/libexec/java_home -v 11)
   ```

   然后执行：
   ```bash
   source ~/.zshrc  # 或 source ~/.bash_profile
   ```

### 步骤

#### 1. 预构建 Android 项目

在项目根目录（`app/`）运行：

```bash
cd /Users/cetide/Documents/Ling-Yu/LingEcho/app
npx expo prebuild --platform android --clean
```

这会生成 `android/` 目录和原生 Android 项目文件。

#### 2. 构建 APK

**调试版本（用于测试）：**
```bash
cd android
./gradlew assembleDebug
```

**发布版本（用于分发）：**
```bash
cd android
./gradlew assembleRelease
```

**注意：** 如果 `./gradlew` 没有执行权限，使用：
```bash
chmod +x gradlew
./gradlew assembleDebug
```

#### 3. 找到 APK 文件

构建完成后，APK 文件位于：

- **调试版本：** `android/app/build/outputs/apk/debug/app-debug.apk`
- **发布版本：** `android/app/build/outputs/apk/release/app-release.apk`

#### 4. 安装到设备

**通过 ADB 安装：**
```bash
# 连接 Android 设备或启动模拟器
adb devices

# 安装 APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**或直接传输到设备：**
- 将 APK 文件传输到 Android 设备
- 在设备上打开文件管理器
- 点击 APK 文件安装（需要允许"未知来源"安装）

---

## 快速构建脚本

项目根目录提供了快速构建脚本 `build-apk.sh`，可以一键构建 APK：

```bash
# 构建调试版本（用于测试）
./build-apk.sh debug

# 构建发布版本（用于分发）
./build-apk.sh release
```

脚本会自动：
- 检查 Java 和 Android SDK 环境
- 如果没有 `android/` 目录，自动运行 `expo prebuild`
- 构建 APK 并显示文件位置

---

## 方法三：使用 Expo Go（仅开发测试）

Expo Go 只能用于开发测试，不能生成独立的 APK。

---

## 配置说明

### app.json 关键配置

当前配置已包含：
- **包名（package）**: `com.lingecho.app`
- **应用名称**: `LingEcho App`
- **版本**: `1.0.0`
- **图标**: `./assets/logo192.png`
- **启动画面**: 淡紫色背景

### 签名配置（生产版本）

生产版本 APK 需要签名。EAS Build 会自动处理，本地构建需要：

1. 生成密钥库：
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. 配置 `android/app/build.gradle`：
   ```gradle
   android {
       ...
       signingConfigs {
           release {
               storeFile file('my-upload-key.keystore')
               storePassword 'your-store-password'
               keyAlias 'my-key-alias'
               keyPassword 'your-key-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

---

## 常见问题

### 1. EAS Build 上传失败：网络连接问题

**错误信息：** `connect ECONNREFUSED` 或 `Failed to upload the project tarball to EAS Build`

**可能原因：**
- 网络连接不稳定
- 防火墙或代理阻止了 Google Cloud Storage 的访问
- 需要 VPN 或代理才能访问

**解决方案：**

**方案 A：检查网络连接**
```bash
# 测试 Google Cloud Storage 连接
ping storage.googleapis.com

# 检查代理设置
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

**方案 B：配置代理（如果使用）**
```bash
# 设置代理环境变量
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# 然后重试构建
eas build --platform android --profile production
```

**方案 C：使用本地构建（推荐）**
如果网络问题持续，使用本地构建方法（见下方"方法二"）。

**方案 D：重试构建**
有时是临时网络问题，可以稍后重试：
```bash
eas build --platform android --profile production
```

### 2. 构建失败：缺少依赖

```bash
cd app
npm install
# 或
yarn install
```

### 3. 构建失败：版本冲突

检查 `package.json` 中的依赖版本是否兼容。

### 4. APK 文件过大

- 使用 `expo-optimize` 优化资源
- 启用 ProGuard 代码混淆（生产版本）

### 5. 无法安装 APK

- 确保设备允许"未知来源"安装
- 检查 Android 版本兼容性（最低支持版本在 `app.json` 中配置）

---

## 推荐流程

1. **开发阶段**：使用 Expo Go 或开发构建
2. **测试阶段**：使用 EAS Build 构建预览版 APK
3. **发布阶段**：使用 EAS Build 构建生产版 APK

---

## 下一步

构建完成后，你可以：
- 将 APK 分发给测试用户
- 上传到 Google Play Store（需要 AAB 格式，使用 `buildType: "app-bundle"`）
- 使用应用内更新服务（Expo Updates）

---

## 参考资源

- [EAS Build 文档](https://docs.expo.dev/build/introduction/)
- [Expo 应用配置](https://docs.expo.dev/versions/latest/config/app/)
- [Android 打包指南](https://docs.expo.dev/distribution/building-standalone-apps/)

