// Tauri API 导入（仅在 Tauri 环境中可用）
let invoke: any = null
let open: any = null
let save: any = null
let openFile: any = null
let writeTextFile: any = null
let readTextFile: any = null
let sendNotification: any = null

// 动态导入 Tauri API（仅在 Tauri 环境中）
if (typeof window !== 'undefined' && (window as any).__TAURI__) {
  try {
    const tauriApi = await import('@tauri-apps/api/tauri')
    const shellApi = await import('@tauri-apps/api/shell')
    const dialogApi = await import('@tauri-apps/api/dialog')
    const fsApi = await import('@tauri-apps/api/fs')
    const notificationApi = await import('@tauri-apps/api/notification')
    
    invoke = tauriApi.invoke
    open = shellApi.open
    save = dialogApi.save
    openFile = dialogApi.open
    writeTextFile = fsApi.writeTextFile
    readTextFile = fsApi.readTextFile
    sendNotification = notificationApi.sendNotification
  } catch (error) {
    console.warn('Tauri API not available:', error)
  }
}

// Tauri API 封装（仅提供基本的桌面功能）
export class TauriAPI {
  // 系统相关
  static async getSystemInfo() {
    if (invoke) {
      return invoke('get_system_info')
    }
    return null
  }

  static async getAppVersion() {
    if (invoke) {
      return invoke('get_app_version')
    }
    return '1.0.0'
  }

  static async openExternalUrl(url: string) {
    if (open) {
      return open(url)
    } else {
      // 在浏览器环境中打开
      window.open(url, '_blank')
    }
  }

  // 文件对话框
  static async saveFileDialog(options?: any) {
    if (save) {
      return save(options)
    }
    return null
  }

  static async openFileDialog(options?: any) {
    if (openFile) {
      return openFile(options)
    }
    return null
  }

  // 文件系统
  static async writeFile(path: string, content: string) {
    if (writeTextFile) {
      return writeTextFile(path, content)
    }
    return null
  }

  static async readFile(path: string) {
    if (readTextFile) {
      return readTextFile(path)
    }
    return null
  }

  // 通知
  static async showNotification(title: string, body: string) {
    if (sendNotification) {
      return sendNotification({ title, body })
    } else {
      // 在浏览器环境中使用 Web Notification API
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    }
  }
}

// 检测是否在 Tauri 环境中
export const isTauri = () => {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined
}

// 条件性 API 调用
export const callAPI = async (tauriMethod: () => Promise<any>, webMethod: () => Promise<any>) => {
  if (isTauri()) {
    return tauriMethod()
  } else {
    return webMethod()
  }
}
