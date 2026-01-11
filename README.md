# Ink Heart Rate Monitor

一个由 Vite + React 开发的蓝牙心率监测器应用，基于Electron框架，可以连接智能手环或心率设备。目前已测试Huawei Band 10心率广播，并可实时显示心率数据。

## 已发布 v 1.0.1 版本，欢迎使用！
**注意：** 
1. 本版本出现有检索慢的问题，为Electron 框架更新问题，需要提前打开手环/手表的“心率广播”功能，等到显示心率后，再点击“连接设备”按钮，稍等片刻。
2. 如果显示“未找到心率设备”但已打开心率广播：
   - 尝试稍作等待
   - 可能会有弹窗显示你的设备，点击连接后，在原来的窗口点击确定即可。

## 功能特性

- 🔗 蓝牙设备连接
- 📊 实时心率监测
- 📱 响应式设计
- 🎨 美观的用户界面
- 💚 心率动画效果

## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **蓝牙通信**: Web Bluetooth API
- **样式**: CSS3 + 动画效果
- **开发语言**: JavaScript (ES6+)

## 项目结构

```
ink-heartrate/
├── index.html              # 主页面模板
├── vite.config.js          # Vite 配置文件
├── package.json            # 项目依赖配置
├── src/
│   ├── main.jsx            # 应用入口文件
│   ├── App.jsx             # 主应用组件
│   ├── App.css             # 应用样式
│   └── index.css           # 全局样式
└── README.md               # 项目说明
```

## 开发指南

### 安装依赖（注意，这通常不包括开发所使用的工具，如Vite、Electron及Electron Builder等）

```bash
npm install
```

### 开发模式下：

启动开发服务器：

```bash
npm run dev
```

开发服务器将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

## 使用说明

1. **准备设备**: 确保您的蓝牙心率设备已开启并处于配对模式（请注意，一般在设备的设置中，应用名称为“心率广播”）
2. **要求**: 建议使用已打包好的软件，无需WebView（支持 Web Bluetooth API）
3. **连接设备**: 点击"连接心率设备"按钮开始搜索并连接设备
4. **查看数据**: 连接成功后即可实时查看心率数据

## 兼容性

Electron已经支持Web Bluetooth API，因此在测试平台上（测试使用Windows 11 23H2 22631.6199）无需额外配置。


## 许可证

本项目采用 GPL-3.0-only 许可证。

## 作者

Ink-dark(墨染柒DarkSeven)

## 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！
