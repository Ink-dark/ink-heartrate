import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [heartRate, setHeartRate] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [devices, setDevices] = useState([])
  const [isElectronApp, setIsElectronApp] = useState(false)
  const [isDemo, setIsDemo] = useState(false)

  // 检测是否在 Electron 环境中运行
  useEffect(() => {
    const electronCheck = window.isElectron || 
      (window.process && window.process.versions && window.process.versions.electron)
    setIsElectronApp(!!electronCheck)
  }, [])

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
    try {
      if (isElectronApp) {
        // Electron 环境
        // 简单的设备连接逻辑
        setIsConnected(true)
        setHeartRate(72) // 模拟连接后的默认心率
        
        // 开始模拟数据变化
        const interval = setInterval(() => {
          const newHeartRate = Math.floor(Math.random() * 40) + 60
          setHeartRate(newHeartRate)
        }, 1500)
        
        window.connectionInterval = interval
        
      } else {
        // 浏览器环境
        if (!navigator.bluetooth) {
          alert('您的浏览器不支持 Web Bluetooth API，请使用 Chrome 或 Edge 浏览器')
          return
        }

        // 请求蓝牙设备
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ['heart_rate'] },
            { namePrefix: 'Heart Rate' },
            { namePrefix: '心率' }
          ]
        })

        // 连接到 GATT 服务
        const server = await device.gatt.connect()
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

        setDevices([...devices, device])
      }
    } catch (error) {
      console.error('连接心率设备失败:', error)
      
      let errorMessage = '连接失败: '
      if (error.name === 'NotFoundError') {
        errorMessage += '未找到匹配的蓝牙设备'
      } else if (error.name === 'NetworkError') {
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
              >
                {isElectronApp ? '连接设备' : '连接设备'}
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