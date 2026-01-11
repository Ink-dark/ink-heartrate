const { app, BrowserWindow, Menu, ipcMain, dialog, webContents } = require('electron')
const path = require('path')
const fs = require('fs')
const isDev = process.env.NODE_ENV === 'development'

// 简单的数据存储
let dataStore = {}

// 保持对窗口对象的全局引用，如果不这么做的话，当 JavaScript 对象被垃圾回收的时候，窗口将会自动地关闭
let mainWindow
let deviceSelectorWindow // 设备选择窗口
let isProcessingBluetoothDeviceSelection = false // 是否正在处理蓝牙设备选择事件
let isDeviceSelectorVisible = false // 设备选择窗口是否可见
let hasUserManuallyClosedWindow = false // 用户是否手动关闭过窗口

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 600,
    height: 300,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // 启用Web Bluetooth API支持
      experimentalFeatures: true
    },
    icon: path.join(__dirname, 'build', 'icon.png'), // 图标文件
    show: false, // 先不显示，等加载完成后再显示
    titleBarStyle: 'default'
  })

  // 加载应用的 index.html
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, './dist/index.html')}`
  mainWindow.loadURL(startUrl)

  // 当 window 被关闭，这个事件会被触发
  mainWindow.on('closed', () => {
    // 解除对窗口对象的引用，如果你的应用支持多窗口的话，通常会把多个窗口对象存储在一个数组里面，与此同时，你应该删除相应的元素
    mainWindow = null
  })

  // 当页面加载完成后再显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    // 在开发模式下打开开发者工具
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // 设置菜单栏（已注释掉，不显示菜单栏）
  // createMenu()
  // 完全移除菜单栏
  Menu.setApplicationMenu(null)
  
  // Web Bluetooth API 设备选择事件处理
  mainWindow.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    
    // 防止重复处理
    if (isProcessingBluetoothDeviceSelection) {
      return
    }
    
    // 如果用户手动关闭过窗口，不再自动创建窗口
    if (hasUserManuallyClosedWindow) {
      console.log('用户已手动关闭窗口，不再自动创建')
      if (global.bluetoothDeviceCallback) {
        global.bluetoothDeviceCallback('')
        global.bluetoothDeviceCallback = null
      }
      return
    }
    
    // 设置处理中标志
    isProcessingBluetoothDeviceSelection = true
    
    // 更新回调函数和设备列表
    global.bluetoothDeviceCallback = callback
    global.bluetoothDevices = devices
    
    try {
      // 如果窗口已存在，直接更新设备列表
      if (deviceSelectorWindow && !deviceSelectorWindow.isDestroyed()) {
        // 重新加载窗口以获取最新设备列表
        deviceSelectorWindow.reload()
      } else {
        // 创建设备选择窗口
        createDeviceSelectorWindow()
      }
      
      // 设置窗口可见状态
      isDeviceSelectorVisible = true
      
      // 通知渲染进程窗口已打开
      mainWindow.webContents.send('bluetooth-selector-window-visibility', isDeviceSelectorVisible)
    } finally {
      // 无论成功与否，都要清除处理中标志
      setTimeout(() => {
        isProcessingBluetoothDeviceSelection = false
      }, 1000)
    }
  })
  
  // 处理设备选择窗口发送的设备选择结果
  ipcMain.handle('select-bluetooth-device', (event, deviceId) => {
    if (global.bluetoothDeviceCallback) {
      global.bluetoothDeviceCallback(deviceId)
      global.bluetoothDeviceCallback = null
    }
    if (deviceSelectorWindow) {
      deviceSelectorWindow.close()
      deviceSelectorWindow = null
    }
    
    // 更新窗口可见状态
    isDeviceSelectorVisible = false
    
    // 通知渲染进程窗口已关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bluetooth-selector-window-visibility', isDeviceSelectorVisible)
    }
    
    return { success: true }
  })
  
  // 取消蓝牙设备选择
  ipcMain.handle('cancel-bluetooth-device-selection', () => {
    if (global.bluetoothDeviceCallback) {
      global.bluetoothDeviceCallback('')
      global.bluetoothDeviceCallback = null
    }
    if (deviceSelectorWindow) {
      deviceSelectorWindow.close()
      deviceSelectorWindow = null
    }
    
    // 更新窗口可见状态
    isDeviceSelectorVisible = false
    
    // 通知渲染进程窗口已关闭和选择已取消
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bluetooth-selector-window-visibility', isDeviceSelectorVisible)
      mainWindow.webContents.send('bluetooth-selection-canceled')
    }
    
    return { success: true }
  })
  
  // 发送设备列表到设备选择窗口
  ipcMain.handle('get-bluetooth-devices', () => {
    return global.bluetoothDevices || []
  })
  
  // 重置用户手动关闭窗口状态
  ipcMain.handle('reset-bluetooth-manual-close-state', () => {
    hasUserManuallyClosedWindow = false
    console.log('已重置用户手动关闭窗口状态')
    return { success: true }
  })
}

// 创建设备选择窗口
function createDeviceSelectorWindow() {
  // 如果窗口已存在，先关闭
  if (deviceSelectorWindow && !deviceSelectorWindow.isDestroyed()) {
    deviceSelectorWindow.close()
    deviceSelectorWindow = null
  }
  
  // 创建设备选择窗口
  deviceSelectorWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // 启用Web Bluetooth API支持
      experimentalFeatures: true
    },
    icon: path.join(__dirname, 'build', 'icon.png'), // 图标文件
    show: true,
    title: '选择心率设备',
    parent: mainWindow, // 设置主窗口为父窗口
    modal: true // 模态窗口
  })
  
  // 加载设备选择窗口的HTML文件
  deviceSelectorWindow.loadFile('device-selector.html')
  
  // 当窗口关闭时，清理引用和状态
  deviceSelectorWindow.on('closed', () => {
    // 设置窗口不可见状态
    isDeviceSelectorVisible = false
    
    // 通知渲染进程窗口已关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bluetooth-selector-window-visibility', isDeviceSelectorVisible)
    }
    
    // 如果用户手动关闭窗口，设置标记
    if (!global.bluetoothDeviceCallback) {
      hasUserManuallyClosedWindow = true
    }
    
    deviceSelectorWindow = null
  })
  
  // 窗口显示时更新状态
  deviceSelectorWindow.on('show', () => {
    isDeviceSelectorVisible = true
    // 通知渲染进程窗口已打开
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bluetooth-selector-window-visibility', isDeviceSelectorVisible)
    }
  })
  
  // 窗口隐藏时更新状态
  deviceSelectorWindow.on('hide', () => {
    isDeviceSelectorVisible = false
    // 通知渲染进程窗口已隐藏
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bluetooth-selector-window-visibility', isDeviceSelectorVisible)
    }
  })
  
  // 在开发模式下打开开发者工具
  if (isDev) {
    deviceSelectorWindow.webContents.openDevTools()
  }
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Ink Heart Rate Monitor',
              message: 'Ink Heart Rate Monitor v1.0.0',
              detail: '一个基于 Electron + React 的蓝牙心率监测器应用\n作者: Ink-dark(墨染柒DarkSeven)\n许可证:GPL-3.0-only\n相信你不会看到这里来的吧？\nCiallo~☆⌒(∠・ω< )'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// IPC 处理程序
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result
})

ipcMain.handle('save-file', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'heart-rate-data.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Text Files', extensions: ['txt'] }
    ]
  })
  
  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  return { success: false, error: '用户取消保存' }
})

// 数据存储 IPC 处理程序
ipcMain.handle('store-get', (event, key) => {
  return dataStore[key] || null
})

ipcMain.handle('store-set', (event, key, value) => {
  dataStore[key] = value
  return true
})

ipcMain.handle('store-delete', (event, key) => {
  delete dataStore[key]
  return true
})

// 蓝牙适配器状态检查
ipcMain.handle('bluetooth-adapter-state', async () => {
  try {
    // 检查蓝牙适配器状态
    // 在Electron中，我们可以尝试通过系统调用检查蓝牙状态
    // 这里返回一个模拟的状态，实际项目中需要集成具体的蓝牙适配器检查逻辑
    return {
      available: true,
      powered: true,
      discovering: false
    }
  } catch (error) {
    return {
      available: false,
      powered: false,
      discovering: false,
      error: error.message
    }
  }
})

// Electron 会在初始化后并准备创建浏览器窗口的时候，调用这个函数
app.whenReady().then(createWindow)

// 当全部窗口关闭时退出
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户使用 Cmd + Q 确定地退出
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，通常在应用程序中重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 在这个文件中，你可以包含应用程序的主进程代码
// 也可以将它们分别放在不同的文件中，然后 import 过来