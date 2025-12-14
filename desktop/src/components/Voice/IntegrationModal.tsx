import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface IntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedMethod: string | null
  selectedAgent: number
  jsSourceId: string
}

const IntegrationModal: React.FC<IntegrationModalProps> = ({
  isOpen,
  onClose,
  selectedMethod,
  selectedAgent,
  jsSourceId
}) => {
  const [copied, setCopied] = useState(false)

  const codeExamples = {
    wechat: `
// 代码示例
const wx = require('weixin-sdk');
wx.config({
    appId: 'your-app-id',
    timestamp: 'timestamp',
    nonceStr: 'nonceStr',
    signature: 'signature'
});
    `,
    web: `
window.__AIPetConfig = {
  apiKey: "yourApiKey",
  apiSecret: "yourSecretKey",
  assistantId: ${selectedAgent},
  systemPrompt: "你是我的贴心语音助手",
  temperature: 0.5,
  personaTag: "cute",
  volume: 5
};
<script src="${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7072'}/api/assistant/lingecho/client/${jsSourceId === '' ? '未选择助手' : jsSourceId}/loader.js"></script>
    `,
    flutter: `
// pubspec.yaml 依赖
dependencies:
  flutter:
    sdk: flutter
  webview_flutter: ^4.4.2
  permission_handler: ^11.0.1
  http: ^1.1.0

// main.dart 集成代码
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';

class VoiceAssistantPage extends StatefulWidget {
  @override
  _VoiceAssistantPageState createState() => _VoiceAssistantPageState();
}

class _VoiceAssistantPageState extends State<VoiceAssistantPage> {
  late WebViewController _controller;
  
  @override
  void initState() {
    super.initState();
    _requestPermissions();
    _initWebView();
  }
  
  Future<void> _requestPermissions() async {
    await Permission.microphone.request();
  }
  
  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (String url) {
            _injectConfig();
          },
        ),
      )
      ..loadRequest(Uri.parse('${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7072'}/api/assistant/lingecho/client/${jsSourceId === '' ? '未选择助手' : jsSourceId}/loader.js'));
  }
  
  void _injectConfig() {
    final config = '''
      window.__AIPetConfig = {
        apiKey: "yourApiKey",
        apiSecret: "yourSecretKey", 
        assistantId: ${selectedAgent},
        systemPrompt: "你是我的贴心语音助手",
        temperature: 0.5,
        personaTag: "cute",
        volume: 5
      };
    ''';
    _controller.runJavaScript(config);
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('语音助手')),
      body: WebViewWidget(controller: _controller),
    );
  }
}
    `
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const CodeBlock = ({ code}: { code: string; language: string }) => {
    return (
      <div className="relative">
        <pre className="bg-gray-100 dark:bg-neutral-700 p-4 rounded-lg overflow-x-auto overflow-y-auto max-h-96 text-sm">
          <code className="language-javascript whitespace-pre-wrap">{code}</code>
        </pre>
        <button
          onClick={() => handleCopy(code)}
          className="absolute top-2 right-2 p-2 bg-gray-100 dark:bg-neutral-600 rounded-lg text-sm text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-500 transition-all duration-200"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
    )
  }

  const renderMethodDetails = () => {
    switch (selectedMethod) {
      case "wechat":
        return (
          <div>
            <h4 className="text-lg font-semibold mb-4">微信接入方法</h4>
            <div className="space-y-4">
              <p>步骤1: 获取你的微信应用ID。</p>
              <p>步骤2: 在你的代码中使用微信SDK进行接入。</p>
              <CodeBlock code={codeExamples.wechat} language="javascript" />
            </div>
          </div>
        )
      case "web":
        return (
          <div>
            <h4 className="text-lg font-semibold mb-4">Web应用嵌入方法</h4>
            <div className="space-y-4">
              <p>步骤1: 获取嵌入代码。</p>
              <p>步骤2: 将代码嵌入到你的Web页面中。</p>
              <CodeBlock code={codeExamples.web} language="javascript" />
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">💡 快速开始</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  下载完整的示例文件，直接运行测试语音助手功能：
                </p>
                <a
                  href="data:text/html;charset=utf-8,%3C!DOCTYPE%20html%3E%0A%3Chtml%20lang%3D%22zh-CN%22%3E%0A%3Chead%3E%0A%20%20%20%20%3Cmeta%20charset%3D%22UTF-8%22%3E%0A%20%20%20%20%3Cmeta%20name%3D%22viewport%22%20content%3D%22width%3Ddevice-width%2C%20initial-scale%3D1.0%22%3E%0A%20%20%20%20%3Ctitle%3E%E8%AF%AD%E9%9F%B3%E5%8A%A9%E6%89%8B%E6%B5%8B%E8%AF%95%3C%2Ftitle%3E%0A%20%20%20%20%3Cstyle%3E%0A%20%20%20%20%20%20%20%20body%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20font-family%3A%20Arial%2C%20sans-serif%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20margin%3A%200%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20padding%3A%2020px%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20background%3A%20linear-gradient(135deg%2C%20%23667eea%200%25%2C%20%23764ba2%20100%25)%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20min-height%3A%20100vh%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20.container%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20max-width%3A%20600px%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20margin%3A%200%20auto%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20background%3A%20white%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20padding%3A%2030px%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20border-radius%3A%2015px%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20box-shadow%3A%200%2010px%2030px%20rgba(0%2C0%2C0%2C0.2)%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20h1%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20color%3A%20%23333%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20text-align%3A%20center%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20margin-bottom%3A%2030px%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20.status%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20padding%3A%2015px%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20border-radius%3A%208px%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20margin%3A%2020px%200%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20text-align%3A%20center%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20.success%20%7B%20background%3A%20%23d4edda%3B%20color%3A%20%23155724%3B%20%7D%0A%20%20%20%20%20%20%20%20.error%20%7B%20background%3A%20%23f8d7da%3B%20color%3A%20%23721c24%3B%20%7D%0A%20%20%20%20%20%20%20%20.warning%20%7B%20background%3A%20%23fff3cd%3B%20color%3A%20%23856404%3B%20%7D%0A%20%20%20%20%3C%2Fstyle%3E%0A%3C%2Fhead%3E%0A%3Cbody%3E%0A%20%20%20%20%3Cdiv%20class%3D%22container%22%3E%0A%20%20%20%20%20%20%20%20%3Ch1%3E%F0%9F%8E%A4%20%E8%AF%AD%E9%9F%B3%E5%8A%A9%E6%89%8B%E6%B5%8B%E8%AF%95%3C%2Fh1%3E%0A%20%20%20%20%20%20%20%20%3Cdiv%20id%3D%22status%22%20class%3D%22status%20warning%22%3E%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Cstrong%3E%E7%8A%B6%E6%80%81%3A%3C%2Fstrong%3E%20%E6%AD%A3%E5%9C%A8%E5%8A%A0%E8%BD%BD%E8%AF%AD%E9%9F%B3%E5%8A%A9%E6%89%8B...%0A%20%20%20%20%20%20%20%20%3C%2Fdiv%3E%0A%20%20%20%20%3C%2Fdiv%3E%0A%0A%20%20%20%20%3C!--%20%E9%85%8D%E7%BD%AE%E8%84%9A%E6%9C%AC%20--%3E%0A%20%20%20%20%3Cscript%3E%0A%20%20%20%20%20%20%20%20window.__AIPetConfig%20%3D%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20apiKey%3A%20%22123456%22%2C%0A%20%20%20%20%20%20%20%20%20%20%20%20apiSecret%3A%20%22123456%22%2C%0A%20%20%20%20%20%20%20%20%20%20%20%20assistantId%3A%20${selectedAgent}%2C%0A%20%20%20%20%20%20%20%20%20%20%20%20systemPrompt%3A%20%22%E4%BD%A0%E6%98%AF%E6%88%91%E7%9A%84%E8%B4%B4%E5%BF%83%E8%AF%AD%E9%9F%B3%E5%8A%A9%E6%89%8B%22%2C%0A%20%20%20%20%20%20%20%20%20%20%20%20temperature%3A%200.6%2C%0A%20%20%20%20%20%20%20%20%20%20%20%20volume%3A%205%0A%20%20%20%20%20%20%20%20%7D%3B%0A%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%2F%2F%20%E7%9B%91%E5%90%AC%E5%8A%A0%E8%BD%BD%E7%8A%B6%E6%80%81%0A%20%20%20%20%20%20%20%20let%20loadCheckInterval%20%3D%20setInterval(function()%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20if%20(window.__AIPetLoaded)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20clearInterval(loadCheckInterval)%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20document.getElementById('status').className%20%3D%20'status%20success'%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20document.getElementById('status').innerHTML%20%3D%20'%3Cstrong%3E%E7%8A%B6%E6%80%81%3A%3C%2Fstrong%3E%20%E8%AF%AD%E9%9F%B3%E5%8A%A9%E6%89%8B%E5%B7%B2%E6%88%90%E5%8A%9F%E5%8A%A0%E8%BD%BD%EF%BC%81'%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%7D%2C%201000)%3B%0A%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%2F%2F%2010%E7%A7%92%E5%90%8E%E5%A6%82%E6%9E%9C%E8%BF%98%E6%B2%A1%E5%8A%A0%E8%BD%BD%E6%88%90%E5%8A%9F%EF%BC%8C%E6%98%BE%E7%A4%BA%E9%94%99%E8%AF%AF%0A%20%20%20%20%20%20%20%20setTimeout(function()%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20if%20(!window.__AIPetLoaded)%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20clearInterval(loadCheckInterval)%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20document.getElementById('status').className%20%3D%20'status%20error'%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20document.getElementById('status').innerHTML%20%3D%20'%3Cstrong%3E%E7%8A%B6%E6%80%81%3A%3C%2Fstrong%3E%20%E8%AF%AD%E9%9F%B3%E5%8A%A9%E6%89%8B%E5%8A%A0%E8%BD%BD%E5%A4%B1%E8%B4%A5%EF%BC%8C%E8%AF%B7%E6%A3%80%E6%9F%A5%E6%8E%A7%E5%88%B6%E5%8F%B0%E9%94%99%E8%AF%AF%E4%BF%A1%E6%81%AF'%3B%0A%20%20%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20%7D%2C%2010000)%3B%0A%20%20%20%20%3C%2Fscript%3E%0A%20%20%20%20%3Cscript%20src%3D%22http%3A//localhost%3A7072/api/assistant/lingecho/client/%7B%7BjsSourceId%7D%7D/loader.js%22%3E%3C%2Fscript%3E%0A%3C%2Fbody%3E%0A%3C%2Fhtml%3E"
                  download="voice-assistant-test.html"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  下载示例文件
                </a>
              </div>
            </div>
          </div>
        )
      case "flutter":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-2">步骤1: 添加依赖</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    在pubspec.yaml中添加必要的依赖包
                  </p>
                </div>
                
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h5 className="font-medium text-orange-700 dark:text-orange-300 mb-2">步骤2: 权限配置</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    配置麦克风权限（Android和iOS）
                  </p>
                </div>
                
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h5 className="font-medium text-purple-700 dark:text-purple-300 mb-2">步骤3: 集成代码</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    使用WebView加载语音助手
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-3">完整集成代码</h5>
              <CodeBlock code={codeExamples.flutter} language="dart" />
            </div>
            
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">⚠️ 注意事项</span>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>Android需要添加麦克风权限到AndroidManifest.xml</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>iOS需要添加麦克风权限到Info.plist</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>确保网络连接正常，WebView需要加载远程资源</span>
                </li>
              </ul>
            </div>
          </div>
        )
      default:
        return <p>请选择一种接入方式。</p>
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col"
          >
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl border dark:border-neutral-600 flex flex-col max-h-full">
              {/* 固定头部 */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
                <h2 className="text-xl font-semibold">接入方法</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* 可滚动内容区域 */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
                <div className="p-6">
                  {renderMethodDetails()}
                </div>
              </div>
              
              {/* 固定底部 */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-600 flex justify-end flex-shrink-0">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-700 transition-all duration-200"
                >
                  关闭
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default IntegrationModal
