# Assets 目录

这个目录用于存放应用的静态资源文件。

## 需要的资源文件

根据 `app.json` 配置，你需要准备以下文件：

- `icon.png` - 应用图标 (1024x1024)
- `splash.png` - 启动画面 (1242x2436 或类似比例)
- `adaptive-icon.png` - Android 自适应图标 (1024x1024)
- `favicon.png` - Web 图标 (48x48)

## 临时解决方案

如果暂时没有这些资源文件，Expo 会使用默认图标。你可以：

1. 使用 Expo 的默认资源（应用可以正常运行）
2. 稍后添加自定义资源文件

## 生成资源

你也可以使用 Expo 的工具生成基础资源：

```bash
npx expo install expo-asset
```

或者使用在线工具创建图标和启动画面。

