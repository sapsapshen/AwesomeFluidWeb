# Awesome Fluid Web

**[中文](#中文) | [English](README.md)**

---

<a id="中文"></a>

> 浏览器里的 WebGL 水面、涟漪和液态玻璃。没有运行时依赖，使用 WebGL1，演示页可以直接用 `file://` 打开。

移植自 [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm) 的 GLSL 着色器。

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![WebGL1](https://img.shields.io/badge/WebGL-1.0-green.svg)
![No Dependencies](https://img.shields.io/badge/依赖-无-brightgreen.svg)

## 效果

| 效果 | 描述 |
|------|------|
| **水面** | 8 步 × 7 角度的波形叠加，带折射、反射、光照和色调 |
| **交互涟漪** | 指数衰减的扩散圆环。同时最多 20 个，每个持续 5 秒 |
| **液态玻璃** | SDF 圆角透镜，带 RGB 色差 |
| **程序化背景** | 动画渐变色块先画到离屏帧缓冲，再由效果着色器采样 |

## 快速开始

直接打开演示，不需要安装或构建：

```bash
git clone https://github.com/sapsapshen/AwesomeFluidWeb.git
cd AwesomeFluidWeb
# macOS: open index.html
# Windows: start index.html
# Linux: xdg-open index.html
```

在页面里使用引擎。指针跟踪默认开启。`addRipple` 的坐标是相对 canvas **左上角** 的 CSS 像素；引擎会处理 `devicePixelRatio`（上限 2）和 WebGL 以左下角为原点的坐标。

```html
<canvas id="canvas" style="width:100%;height:400px"></canvas>
<script src="fluid-engine.js"></script>
<script>
  var canvas = document.getElementById('canvas');
  var engine = new FluidEngine(canvas, {
    effect: 'water', // 或 'glass'
    params: {
      waveSpeed: 0.2,
      intensity: 2.4,
      frequency: 6.0,
      refraction: 2.0
    }
  });

  engine.addRipple(canvas.clientWidth * 0.5, canvas.clientHeight * 0.5, 2);
</script>
```

盖在 canvas 上的内容必须设置 `pointer-events: none`，否则事件到不了 canvas。页面自己处理指针时，传入 `interactive: false`。

## 项目结构

```
AwesomeFluidWeb/
├── index.html                 # 演示页：终端、玻璃卡片、滑块和预设
├── fluid-engine.js            # 演示页和其他页面共用的引擎
├── test/fluid-engine.test.js  # Node.js 测试（模拟 WebGL）
├── .github/workflows/ci.yml   # 在 Node 20 和 22 上运行 npm test
├── package.json
├── LICENSE
├── README.md
└── README.zh-CN.md
```

## 参数

### 水面（`effect: 'water'`）

| 参数 | 默认值 | 范围 | 描述 |
|------|--------|------|------|
| `waveSpeed` | 0.2 | 0–1 | 整体波动速度 |
| `waveSpeedX` | 0.3 | 0–1 | 水平漂移 |
| `waveSpeedY` | 0.3 | 0–1 | 垂直漂移 |
| `intensity` | 2.4 | 0–5 | 波幅 |
| `frequency` | 6.0 | 1–15 | 波频率 |
| `emboss` | 0.5 | 0–2 | 用于折射的高度梯度 |
| `refraction` | 2.0 | 0–5 | UV 位移强度 |
| `reflGain` | 700 | 0–2000 | 反射增益 |
| `reflCutoff` | 0.012 | 0–0.1 | 反射截止 |
| `reflIntensity` | 200000 | 0–500000 | 反射指数 |
| `waterTint` | 0.92 | 0.5–1.5 | 水色（越低越暗） |

### 液态玻璃（`effect: 'glass'`）

| 参数 | 默认值 | 范围 | 描述 |
|------|--------|------|------|
| `glassW` | 0 | 0 = 自动 | 玻璃宽度（像素） |
| `glassH` | 0 | 0 = 自动 | 玻璃高度（像素） |
| `glassR` | 12 | 0–50 | 圆角半径（像素） |
| `distortDepth` | 30 | 5–100 | 透镜深度 |
| `distortStrength` | 0.15 | 0–0.5 | 畸变强度 |
| `chromaShift` | 1.5 | 0–5 | 色差（像素） |
| `glassTint` | 1.0 | 0.5–1.5 | 玻璃色调 |

未知参数名和非有限数字会被忽略。

### 预设

| 预设 | waveSpeed | intensity | frequency | refraction | emboss | waterTint |
|------|-----------|-----------|-----------|------------|--------|-----------|
| 平静 | 0.1 | 1.5 | 4.0 | 1.0 | 0.3 | 0.95 |
| 默认 | 0.2 | 2.4 | 6.0 | 2.0 | 0.5 | 0.92 |
| 风暴 | 0.5 | 4.0 | 10.0 | 3.5 | 0.8 | 0.85 |
| 水晶 | 0.15 | 1.0 | 8.0 | 1.5 | 0.4 | 1.0 |
| 深海 | 0.08 | 3.0 | 3.0 | 2.5 | 0.6 | 0.8 |

## API

### `new FluidEngine(canvas, options)`

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `effect` | `'water'` 或 `'glass'` | `'water'` | 绘制的效果。其他取值会使用水面 |
| `params` | object | `{}` | 上表中的着色器参数 |
| `interactive` | boolean | `true` | 在 canvas 上监听鼠标和触摸 |

构造成功后 `engine.ready` 为 `true`。失败时 `engine.error` 是一段短说明。`engine.gl` 是 WebGL 上下文，失败时为 `null`。

`engine.ripples` 是当前涟漪（`x`、`y`、`start`、`strength`）。`engine.fps` 大约每秒更新一次。

### `engine.addRipple(x, y, strength)`

`x` 和 `y` 是相对 canvas 左上角的 CSS 像素。缺省或非有限的 `strength` 会变成 `1`，`0` 会保留。非有限坐标会被忽略。

### `engine.setParam(name, value)` / `engine.getParam(name)`

更新或读取一个参数，下一帧生效。

### `engine.setEffect('water' | 'glass')`

在对应着色器已编译时切换效果。非法名称不会改变当前效果。

### `engine.dispose()`

停止动画循环，移除监听器，并删除 WebGL 资源。`engine.destroy()` 是同一方法的别名。第二次调用不会做事。销毁之后不会再新增涟漪或修改参数。

## 行为

```
[程序化背景] → 帧缓冲纹理 → [水面或玻璃着色器] → canvas
```

- 涟漪高度为 `sin(d * 0.06 - age * 8.0) * exp(-d * 0.003) * exp(-age * 0.7) * strength`。`d` 是设备像素距离，`age` 是秒。
- 每个涟漪打包成一个 `vec4`（x、y、start、strength）再上传，以便留在常见的 WebGL1 uniform 上限之内。
- 内置指针强度：鼠标移动超过 4 个 CSS 像素后为 `0.8 + min(distance / 30, 1.5)`，点击 `3.5`，触摸开始 `2.5`，触摸移动 `1.2`。触摸之后浏览器补发的 click 会被忽略。
- `prefers-reduced-motion: reduce` 会停住环境波浪（以及玻璃晃动），交互涟漪仍然绘制。
- `devicePixelRatio` 上限为 2；如果帧缓冲超过 `MAX_TEXTURE_SIZE`，会再把比例降下来。
- 请给 canvas 设置 CSS 尺寸。如果没有，引擎会钉住当前布局尺寸，避免高分屏位图在下一次 resize 时把元素越撑越大。

## 性能

- 演示页有一个水面引擎和两个玻璃引擎。额外的水面引擎各自占用一张全尺寸帧缓冲。
- 玻璃效果更轻，没有波浪循环。
- 叠加层需要 `pointer-events: none`。
- 在很慢的 GPU 上可以降低水面着色器里的 `STEPS` 和 `ANGLE`。

## 浏览器

需要 WebGL1。当前的 Chrome、Edge、Firefox、Safari、移动端 Safari 和 Android 版 Chrome 都可以。WebGL 无法启动时，演示页会显示错误，而不是抛出未捕获异常。

## 开发

```bash
npm test
```

需要 Node.js 18 或更新版本，没有依赖。CI 在 Node 20 和 22 上运行同一条命令。

## 许可证

[MIT](LICENSE)

## 致谢

- 着色器改编自 [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm)，作者 [@bea4dev](https://github.com/bea4dev)
- 灵感来自 [ShojiWM](https://github.com/bea4dev/ShojiWM)
