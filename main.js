const { app, BrowserWindow, Menu, ipcMain, dialog, webContents } = require('electron')
const path = require('path')
const fs = require('fs')
const isDev = process.env.NODE_ENV === 'development'

// 简单的数据存储
let dataStore = {}

// 保持对窗口对象的全局引用，如果不这么做的话，当 JavaScript 对象被垃圾回收的时候，窗口将会自动地关闭
let mainWindow

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
    
    // 显示设备选择对话框
    const deviceList = devices.map(device => `${device.deviceName || '未知设备'} (${device.deviceId})`).join('\n')
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '选择蓝牙设备',
      message: '请选择要连接的心率设备:',
      detail: deviceList || '未找到蓝牙设备',
      buttons: devices.map(device => device.deviceName || '未知设备')
    }).then(result => {
      if (result.response >= 0 && result.response < devices.length) {
        callback(devices[result.response].deviceId)
      } else {
        callback('')
      }
    })
  })
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