import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [heartRate, setHeartRate] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false) // 添加连接中状态
  const [devices, setDevices] = useState([])
  const [detectedDevices, setDetectedDevices] = useState([]) // 记录已检测设备
  const [isElectronApp, setIsElectronApp] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [isSelectorWindowVisible, setIsSelectorWindowVisible] = useState(false) // 连接窗口可见性

  // 检测是否在 Electron 环境中运行
  useEffect(() => {
    const electronCheck = window.isElectron || 
      (window.process && window.process.versions && window.process.versions.electron)
    setIsElectronApp(!!electronCheck)
    
    // 清理函数集合
    const cleanupFunctions = []
    
    // 在Electron环境中，设置事件监听
    if (window.isElectron && window.electronAPI && window.electronAPI.bluetooth) {
      // 监听设备选择取消事件
      const selectionCanceledCleanup = window.electronAPI.bluetooth.onSelectionCanceled(() => {
        console.log('设备选择已取消')
        setIsConnecting(false)
        setIsSelectorWindowVisible(false)
      })
      cleanupFunctions.push(selectionCanceledCleanup)
      
      // 监听设备选择窗口可见性变化
      const selectorWindowVisibilityCleanup = window.electronAPI.bluetooth.onSelectorWindowVisibility((isVisible) => {
        console.log('设备选择窗口可见性变化:', isVisible)
        setIsSelectorWindowVisible(isVisible)
        // 如果窗口打开，设置连接中状态
        if (isVisible) {
          setIsConnecting(true)
        } else {
          // 窗口关闭时，只有在用户取消选择时才重置连接中状态
          // 连接成功时会单独重置状态
          if (!isConnected) {
            setIsConnecting(false)
          }
        }
      })
      cleanupFunctions.push(selectorWindowVisibilityCleanup)
    }
    
    // 清理函数
    return () => {
      // 调用所有清理函数
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup()
        }
      })
      
      // 清理演示模式的定时器
      if (window.demoInterval) {
        clearInterval(window.demoInterval)
        window.demoInterval = null
      }
      
      // 清理连接间隔
      if (window.connectionInterval) {
        clearInterval(window.connectionInterval)
        window.connectionInterval = null
      }
    }
  }, [isConnected])

  // 模拟心率数据的函数
  const startDemo = () => {
    setIsDemo(true)
    setIsConnected(true)
    
    // 模拟心率数据变化
    const demoInterval = setInterval(() => {
      // 生成60-120之间的随机心率
      const demoHeartRate = Math.floor(Math.random() * 60) + 60
      setHeartRate(demoHeartRate)
      
      // 在 Electron 中显示通知
      if (isElectronApp && window.electronAPI && window.electronAPI.notifications) {
        if (demoHeartRate > 100) {
          window.electronAPI.notifications.show('心率提醒', `当前心率: ${demoHeartRate} BPM，注意休息！`)
        }
      }
    }, 2000)

    // 存储 interval ID 以便清理
    window.demoInterval = demoInterval
  }

  const stopDemo = () => {
    setIsDemo(false)
    setIsConnected(false)
    setHeartRate(0)
    
    // 清理 demo interval
    if (window.demoInterval) {
      clearInterval(window.demoInterval)
      window.demoInterval = null
    }
  }

  const connectToDevice = async () => {
    // 防止重复连接
    if (isConnecting || isConnected || isSelectorWindowVisible) {
      return
    }
    
    // 如果是Electron环境，重置用户手动关闭窗口的状态
    if (isElectronApp && window.electronAPI && window.electronAPI.bluetooth) {
      // 重置用户手动关闭窗口状态
      // 这里需要在preload.js中添加相应的方法
      try {
        await window.electronAPI.bluetooth.resetManualCloseState()
        console.log('已重置用户手动关闭窗口状态')
      } catch (error) {
        console.error('重置手动关闭状态失败:', error)
      }
    }
    
    try {
      setIsConnecting(true)
      
      if (isElectronApp) {
        // Electron 环境
        try {
          // 检查是否有可用的蓝牙模块
          // 这里可以添加实际的Electron蓝牙连接逻辑
          setIsConnected(true)
          setHeartRate(72) // 模拟连接后的默认心率
          
          // 开始模拟数据变化
          const interval = setInterval(() => {
            const newHeartRate = Math.floor(Math.random() * 40) + 60
            setHeartRate(newHeartRate)
          }, 1500)
          
          window.connectionInterval = interval
        } catch (error) {
          console.error('Electron蓝牙连接失败:', error)
          alert('蓝牙连接失败: ' + error.message)
          throw error
        }
        
      } else {
        // 浏览器环境
        if (!navigator.bluetooth) {
          alert('您安装的版本不支持 Web Bluetooth API，请更新至Ink-Heartrate最新版本或使用带有Chromium的浏览器')
          return
        }

        // 设备连接逻辑
        let deviceToConnect = null
        
        // 先检查是否有已检测过的设备
        if (detectedDevices.length > 0) {
          deviceToConnect = detectedDevices[0]
        } else {
          // 只在没有已检测设备时才请求新设备
          try {
            deviceToConnect = await navigator.bluetooth.requestDevice({
              filters: [
                { services: ['heart_rate'] },
                { namePrefix: 'Heart Rate' },
                { namePrefix: '心率' }
              ],
              optionalServices: ['heart_rate']
            })
            
            // 记录已检测设备，使用函数式更新避免竞态条件
            setDetectedDevices(prevDevices => {
              if (!prevDevices.some(d => d.id === deviceToConnect.id)) {
                return [...prevDevices, deviceToConnect]
              }
              return prevDevices
            })
          } catch (requestError) {
            console.error('设备请求失败:', requestError)
            // 只在用户没有主动取消时抛出错误
            if (requestError.name !== 'NotFoundError' && requestError.name !== 'AbortError') {
              throw requestError
            }
            return // 用户取消了设备选择，直接返回
          }
        }
        
        // 如果没有找到设备（用户取消），直接返回
        if (!deviceToConnect) {
          return
        }
        
        // 连接到 GATT 服务
        const server = await deviceToConnect.gatt.connect()
        const service = await server.getPrimaryService('heart_rate')
        const characteristic = await service.getCharacteristic('heart_rate_measurement')

        // 监听心率数据
        await characteristic.startNotifications()
        characteristic.addEventListener('characteristicvaluechanged', (event) => {
          const value = event.target.value
          const heartRateValue = parseHeartRate(value)
          setHeartRate(heartRateValue)
          setIsConnected(true)
        })

        // 监听设备断开事件
        deviceToConnect.addEventListener('gattserverdisconnected', () => {
          setIsConnected(false)
          setHeartRate(0)
          setDevices(prevDevices => prevDevices.filter(d => d.id !== deviceToConnect.id))
        })

        // 使用函数式更新避免竞态条件
        setDevices(prevDevices => {
          if (!prevDevices.some(d => d.id === deviceToConnect.id)) {
            return [...prevDevices, deviceToConnect]
          }
          return prevDevices
        })
      }
    } catch (error) {
      console.error('连接心率设备失败:', error)
      
      // 只在特定错误情况下显示消息，避免重复弹出窗口
      if (error.name !== 'NotFoundError' && error.name !== 'AbortError') {
        let errorMessage = '连接失败: '
        if (error.name === 'NetworkError') {
          errorMessage += '网络连接错误，请检查设备是否在范围内'
        } else if (error.name === 'NotSupportedError') {
          errorMessage += '设备不支持心率服务'
        } else if (error.name === 'SecurityError') {
          errorMessage += '安全错误，请确保应用有蓝牙权限'
        } else {
          errorMessage += error.message
        }
        
        alert(errorMessage)
      }
    } finally {
      // 无论连接成功或失败，都重置连接中状态
      setIsConnecting(false)
    }
  }

  const parseHeartRate = (dataView) => {
    // 解析心率数据的辅助函数
    const flags = dataView.getUint8(0)
    const rate16Bits = flags & 0x1
    let hr

    if (rate16Bits) {
      hr = dataView.getUint16(1, /*littleEndian=*/true)
    } else {
      hr = dataView.getUint8(1)
    }
    return hr
  }

  const disconnectDevice = () => {
    if (isDemo) {
      stopDemo()
    } else if (isElectronApp) {
      // Electron 环境断开
      if (window.connectionInterval) {
        clearInterval(window.connectionInterval)
        window.connectionInterval = null
      }
      setIsConnected(false)
      setHeartRate(0)
    } else {
      // 浏览器环境断开
      devices.forEach(device => {
        if (device.gatt && device.gatt.connected) {
          device.gatt.disconnect()
        }
      })
      setIsConnected(false)
      setHeartRate(0)
      setDevices([])
    }
  }

  return (
    <div className="App">
      <div className="minimal-container">
        <div className="heart-display">
          <div className="heart-icon">❤️</div>
          <div className="heart-rate-value">
            {heartRate || '--'}
          </div>
          <div className="heart-rate-unit">BPM</div>
        </div>
        
        <div className="control-status-container">
          <div className="minimal-controls">
            {!isConnected ? (
              <button 
                className="minimal-btn connect"
                onClick={connectToDevice}
                disabled={isConnecting || isSelectorWindowVisible} // 连接过程中或窗口打开时禁用按钮
                title={isSelectorWindowVisible ? '设备选择窗口已打开' : '连接到心率设备'}
              >
                {isConnecting ? '连接中...' : (isElectronApp ? '连接设备' : '连接设备')}
              </button>
            ) : (
              <button 
                className="minimal-btn disconnect"
                onClick={disconnectDevice}
              >
                断开
              </button>
            )}
            
            {isElectronApp && !isConnected && (
              <button 
                className="minimal-btn demo"
                onClick={startDemo}
              >
                演示
              </button>
            )}
          </div>
          
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App