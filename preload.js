const { contextBridge, ipcRenderer } = require('electron')

// 在这里暴露受保护的方法，允许渲染进程使用 ipcRenderer，同时不暴露整个对象
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  
  // 应用信息
  app: {
    getVersion: () => process.versions.electron,
    getName: () => 'Ink Heart Rate Monitor'
  },

  // 系统信息
  system: {
    getPlatform: () => process.platform,
    getArch: () => process.arch
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close')
  },

  // 文件系统操作
  fs: {
    selectFile: () => ipcRenderer.invoke('select-file'),
    saveFile: (data) => ipcRenderer.invoke('save-file', data)
  },

  // 蓝牙相关功能
  bluetooth: {
    // 检查蓝牙适配器状态
    getAdapterState: () => ipcRenderer.invoke('bluetooth-adapter-state'),
    
    // 检查蓝牙支持（Electron + Web Bluetooth API）
    isSupported: () => {
      // 在现代Electron版本中，Web Bluetooth API是支持的
      return process.versions && parseFloat(process.versions.electron) >= 13.0
    },

    // 获取Web Bluetooth API实例（用于兼容性）
    getWebBluetooth: () => {
      // 暴露navigator.bluetooth以保持API兼容性
      if (typeof window !== 'undefined' && window.navigator && window.navigator.bluetooth) {
        return window.navigator.bluetooth
      }
      return null
    },

    // 请求设备（使用Web Bluetooth API）
    requestDevice: (options) => {
      if (window.navigator && window.navigator.bluetooth) {
        return window.navigator.bluetooth.requestDevice(options)
      }
      return Promise.reject(new Error('Web Bluetooth API 不支持'))
    },

    // 获取已连接的设备
    getConnectedDevices: () => {
      if (window.navigator && window.navigator.bluetooth) {
        return window.navigator.bluetooth.getDevices()
      }
      return Promise.resolve([])
    },

    // 检查蓝牙权限
    requestLEScanPermission: () => {
      // 在Electron中，权限检查可能需要不同的处理方式
      return Promise.resolve({ granted: true })
    },
    
    // 选择蓝牙设备（由主进程调用）
    selectDevice: (deviceId) => ipcRenderer.invoke('select-bluetooth-device', deviceId),
    
    // 取消蓝牙设备选择
    cancelDeviceSelection: () => ipcRenderer.invoke('cancel-bluetooth-device-selection'),
    
    // 监听蓝牙设备检测事件
    onDevicesDetected: (callback) => {
      ipcRenderer.on('bluetooth-devices-detected', (event, devices) => {
        callback(devices)
      })
    },
    
    // 获取蓝牙设备列表
    getDevices: () => ipcRenderer.invoke('get-bluetooth-devices'),
    
    // 监听设备选择取消事件
    onSelectionCanceled: (callback) => {
      const handleSelectionCanceled = () => {
        callback()
      }
      ipcRenderer.on('bluetooth-selection-canceled', handleSelectionCanceled)
      return () => {
        ipcRenderer.removeListener('bluetooth-selection-canceled', handleSelectionCanceled)
      }
    },
    
    // 监听设备选择窗口可见性变化
    onSelectorWindowVisibility: (callback) => {
      const handleSelectorWindowVisibility = (event, isVisible) => {
        callback(isVisible)
      }
      ipcRenderer.on('bluetooth-selector-window-visibility', handleSelectorWindowVisibility)
      return () => {
        ipcRenderer.removeListener('bluetooth-selector-window-visibility', handleSelectorWindowVisibility)
      }
    },
    
    // 重置用户手动关闭窗口状态
    resetManualCloseState: () => {
      return ipcRenderer.invoke('reset-bluetooth-manual-close-state')
    }
  },

  // 通知
  notifications: {
    show: (title, body) => {
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        })
      }
    },
    
    // 检查通知权限
    getPermission: () => {
      return Notification.permission
    },
    
    // 请求通知权限
    requestPermission: () => {
      return Notification.requestPermission()
    }
  },

  // 数据存储
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key)
  },

  // 应用配置
  config: {
    // 获取应用配置
    getConfig: () => {
      return {
        version: '1.0.0',
        name: 'Ink Heart Rate Monitor',
        supports: {
          webBluetooth: process.versions && parseFloat(process.versions.electron) >= 13.0,
          notifications: true,
          fileSystem: true
        }
      }
    }
  }
})

// 在全局作用域中暴露一些变量，以便前端代码检查
window.process = {
  env: {
    NODE_ENV: process.env.NODE_ENV
  },
  versions: {
    electron: process.versions.electron
  }
}

// 为前端代码提供Electron API的类型检查
window.isElectron = true

// 确保Web Bluetooth API在Electron环境中可用
if (typeof window !== 'undefined') {
  // 检查是否在Electron环境中，并且版本支持Web Bluetooth
  if (window.isElectron && process.versions && parseFloat(process.versions.electron) >= 13.0) {
    // 在Electron中，Web Bluetooth API可能需要额外配置
    // 这里我们确保API可用，但不直接修改navigator对象
    console.log('Electron环境检测到，支持Web Bluetooth API')
  }
}