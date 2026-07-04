# 🌊 Awesome Fluid Web

**[中文](#中文) | [English](README.md)**

---

<a id="中文"></a>

> 基于 WebGL 的流体/液态终端网页效果 — 水面波纹、交互式涟漪、液态玻璃畸变。零依赖，兼容 WebGL1，支持 `file://` 直接打开。

移植自 [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm) 的 GLSL 着色器，适配浏览器环境。

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![WebGL1](https://img.shields.io/badge/WebGL-1.0-green.svg)
![No Dependencies](https://img.shields.io/badge/依赖-无-brightgreen.svg)

## ✨ 效果一览

| 效果 | 描述 |
|------|------|
| **水面波纹** | 多方向波模拟（8 步 × 7 角度），含折射、反射、光照和色调 |
| **交互式涟漪** | 鼠标/触摸产生扩散圆形涟漪，指数衰减（最多 20 个并发，5 秒衰减） |
| **液态玻璃** | 基于 SDF 的透镜畸变 + RGB 色差（iOS 风格毛玻璃） |
| **程序化背景** | 动画渐变色块渲染到离屏 FBO 纹理，供水面着色器采样 |

## 🚀 快速开始

### 方式一：直接打开演示

```bash
git clone https://github.com/sapsapshen/AwesomeFluidWeb.git
cd AwesomeFluidWeb
open index.html   # macOS  |  start index.html  # Windows  |  xdg-open index.html  # Linux
```

无需构建步骤，无需 npm install，直接用现代浏览器打开 `index.html` 即可。

### 方式二：在你的项目中使用引擎库

```html
<script src="fluid-engine.js"></script>
<canvas id="canvas" style="width:100%;height:400px"></canvas>
<script>
  var engine = new FluidEngine(document.getElementById('canvas'), {
    effect: 'water',   // 或 'glass'
    params: {
      waveSpeed: 0.2,
      intensity: 2.4,
      frequency: 6.0,
      refraction: 2.0
    }
  });

  // 鼠标交互
  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    engine.addRipple(e.clientX - rect.left, e.clientY - rect.top, 3.5);
  });
</script>
```

## 📁 项目结构

```
AwesomeFluidWeb/
├── index.html                  # 主演示页（终端 + 玻璃 + 控制面板）
├── fluid-engine.js             # 独立可复用引擎库
├── LICENSE                     # MIT 开源协议
├── README.md                   # 英文文档
├── README.zh-CN.md             # 中文文档
└── .workbuddy/skills/awesome-fluid-web/
    ├── SKILL.md                # WorkBuddy 技能清单
    ├── assets/
    │   ├── js/
    │   │   └── fluid-engine.js           # 引擎库副本
    │   └── templates/
    │       ├── fluid-showcase.html       # 完整演示（同 index.html）
    │       ├── fluid-terminal.html       # 终端窗口水面效果
    │       ├── fluid-glass.html          # 液态玻璃卡片效果
    │       ├── fluid-minimal.html        # 最小集成示例
    │       └── fluid-fullscreen.html     # 全屏水面背景
    └── references/
        ├── shader-params.md              # 着色器参数文档
        └── integration-guide.md          # 现有网站集成指南
```

## ⚙️ 参数配置

### 水面效果（`effect: 'water'`）

| 参数 | 默认值 | 范围 | 描述 |
|------|--------|------|------|
| `waveSpeed` | 0.2 | 0–1 | 整体波动速度 |
| `waveSpeedX` | 0.3 | 0–1 | 水平方向波速 |
| `waveSpeedY` | 0.3 | 0–1 | 垂直方向波速 |
| `intensity` | 2.4 | 0–5 | 波幅强度 |
| `frequency` | 6.0 | 1–15 | 波频率（越高波纹越密） |
| `emboss` | 0.5 | 0–2 | 高度梯度因子（影响折射） |
| `refraction` | 2.0 | 0–5 | UV 位移强度 |
| `reflGain` | 700 | 0–2000 | 反射增益倍数 |
| `reflCutoff` | 0.012 | 0–0.1 | 反射截止阈值 |
| `reflIntensity` | 200000 | 0–500000 | 反射强度指数 |
| `waterTint` | 0.92 | 0.5–1.5 | 水色调（越低越暗） |

### 液态玻璃（`effect: 'glass'`）

| 参数 | 默认值 | 范围 | 描述 |
|------|--------|------|------|
| `glassW` | 0 | 0 = 自动 | 玻璃区域宽度（像素） |
| `glassH` | 0 | 0 = 自动 | 玻璃区域高度（像素） |
| `glassR` | 12 | 0–50 | 圆角半径（像素） |
| `distortDepth` | 30 | 5–100 | 透镜畸变深度 |
| `distortStrength` | 0.15 | 0–0.5 | 畸变强度 |
| `chromaShift` | 1.5 | 0–5 | 色差偏移（像素） |
| `glassTint` | 1.0 | 0.5–1.5 | 玻璃色调 |

### 预设方案

| 预设 | waveSpeed | intensity | frequency | refraction | emboss | waterTint |
|------|-----------|-----------|-----------|------------|--------|-----------|
| 平静 | 0.1 | 1.5 | 4.0 | 1.0 | 0.3 | 0.95 |
| 默认 | 0.2 | 2.4 | 6.0 | 2.0 | 0.5 | 0.92 |
| 风暴 | 0.5 | 4.0 | 10.0 | 3.5 | 0.8 | 0.85 |
| 水晶 | 0.15 | 1.0 | 8.0 | 1.5 | 0.4 | 1.0 |
| 深海 | 0.08 | 3.0 | 3.0 | 2.5 | 0.6 | 0.8 |

## 🔧 API

### `new FluidEngine(canvas, options)`

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `effect` | `'water' \| 'glass'` | `'water'` | 效果类型 |
| `params` | `object` | `{}` | 着色器参数（见上表） |

### `engine.addRipple(x, y, strength)`

在指定像素坐标处添加涟漪。

| 参数 | 描述 |
|------|------|
| `x`, `y` | 相对于 canvas 的像素坐标 |
| `strength` | `0.3` = 轻微（鼠标移动），`1.0` = 中等，`1.5+` = 强烈（点击） |

### `engine.setParam(name, value)`

实时更新着色器参数。

### `engine.dispose()`

释放 WebGL 资源并停止渲染循环。

## 🏗️ 架构

```
[程序化背景] → FBO 纹理 → [水面/玻璃着色器] → Canvas → [DOM 内容叠加层]
```

1. **背景通道** — 将动画渐变色块渲染到离屏 FBO 纹理
2. **效果通道** — 通过水面或玻璃着色器采样背景纹理
3. **DOM 叠加层** — HTML 内容定位在 canvas 上方（设置 `pointer-events:none`）

### 关键实现细节

- **水面着色器** — 8 步 7 角度多方向波叠加，含折射、反射、光照
- **涟漪公式** — `sin(d · 0.05 - age · 8) · exp(-d · 0.005) · exp(-age · 0.9) · strength`
- **液态玻璃** — SDF 圆角矩形 + 透镜畸变 + RGB 通道分离
- **WebGL1** — 最大浏览器兼容性，无需 WebGL2
- **devicePixelRatio** — 自动处理，上限 2x 保证性能

## 🖱️ 交互方式

| 操作 | 效果 |
|------|------|
| 鼠标在 canvas 上移动 | 产生小涟漪拖尾 + 光晕跟随 |
| 点击 / 触摸 canvas | 产生强烈大波纹扩散 |
| 鼠标位置 | 水面着色器中产生可见光晕 |
| 参数控制面板（演示页） | 滑块实时调节所有参数 |

## 📦 模板文件

| 模板 | 描述 | 适用场景 |
|------|------|----------|
| `fluid-terminal.html` | 终端窗口水面效果 | 开发者作品集、技术演示 |
| `fluid-glass.html` | 液态玻璃卡片畸变 | 产品卡片、特性展示 |
| `fluid-minimal.html` | 最小集成代码 | 学习、快速上手 |
| `fluid-fullscreen.html` | 全屏水面背景 | 着陆页、首屏区域 |
| `fluid-showcase.html` | 完整功能演示 | 完整参考 |

## ⚡ 性能优化建议

- 限制 canvas 分辨率（引擎自动将 `devicePixelRatio` 上限设为 2x）
- 在低端设备上减少水面着色器中的 `STEPS` 和 `ANGLE` 常量
- 使用 `effect: 'glass'` 降低 GPU 负载（无波模拟循环）
- 避免在同一页面创建多个水面效果引擎
- 在叠加内容上设置 `pointer-events: none`，确保鼠标事件到达 canvas

## 🌐 浏览器支持

| 浏览器 | 支持 |
|--------|------|
| Chrome / Edge | ✅ 完全支持 |
| Firefox | ✅ 完全支持 |
| Safari | ✅ 完全支持 |
| 移动端 Safari | ✅ 完全支持（触摸涟漪） |
| Chrome 安卓 | ✅ 完全支持 |

需要 WebGL1 支持（99%+ 浏览器已支持）。

## 📄 开源协议

[MIT](LICENSE) — 个人和商业项目均可免费使用。

## 🙏 致谢

- 原始着色器来自 [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm)，作者 [@bea4dev](https://github.com/bea4dev)
- 灵感来源于 [ShojiWM](https://github.com/bea4dev/ShojiWM) Wayland 合成器项目
