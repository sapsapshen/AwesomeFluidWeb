# 🌊 Awesome Fluid Web

**[English](#english) | [中文](README.zh-CN.md)**

---

<a id="english"></a>

> WebGL-based fluid/liquid terminal effects for the web — water surface waves, interactive ripples, and liquid glass distortion. Zero dependencies, WebGL1 compatible, works with `file://`.

Ported from the [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm) GLSL shaders for browser use.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![WebGL1](https://img.shields.io/badge/WebGL-1.0-green.svg)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-brightgreen.svg)

## ✨ Effects

| Effect | Description |
|--------|-------------|
| **Water Surface** | Multi-directional wave simulation (8 steps × 7 angles) with refraction, reflection, lighting, and color tint |
| **Interactive Ripples** | Mouse/touch creates expanding circular ripples with exponential damping (max 20 concurrent, 5s decay) |
| **Liquid Glass** | SDF-based lens distortion with RGB chromatic aberration (iOS-style frosted glass) |
| **Procedural Background** | Animated gradient blobs rendered to an offscreen FBO texture, sampled by the water shader |

## 🚀 Quick Start

### Option A: Open the demo directly

```bash
git clone https://github.com/sapsapshen/AwesomeFluidWeb.git
cd AwesomeFluidWeb
open index.html   # macOS  |  start index.html  # Windows  |  xdg-open index.html  # Linux
```

No build step. No npm install. Just open `index.html` in any modern browser.

### Option B: Use the engine in your project

```html
<script src="fluid-engine.js"></script>
<canvas id="canvas" style="width:100%;height:400px"></canvas>
<script>
  var engine = new FluidEngine(document.getElementById('canvas'), {
    effect: 'water',   // or 'glass'
    params: {
      waveSpeed: 0.2,
      intensity: 2.4,
      frequency: 6.0,
      refraction: 2.0
    }
  });

  // Mouse interaction
  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    engine.addRipple(e.clientX - rect.left, e.clientY - rect.top, 3.5);
  });
</script>
```

## 📁 Project Structure

```
AwesomeFluidWeb/
├── index.html                  # Main showcase demo (terminal + glass + controls)
├── fluid-engine.js             # Standalone reusable engine library
├── LICENSE                     # MIT License
├── README.md                   # English documentation
├── README.zh-CN.md             # Chinese documentation
└── .workbuddy/skills/awesome-fluid-web/
    ├── SKILL.md                # WorkBuddy skill manifest
    ├── assets/
    │   ├── js/
    │   │   └── fluid-engine.js           # Engine library copy
    │   └── templates/
    │       ├── fluid-showcase.html       # Full demo (same as index.html)
    │       ├── fluid-terminal.html       # Terminal window with water effect
    │       ├── fluid-glass.html          # Liquid glass card effect
    │       ├── fluid-minimal.html        # Minimal integration example
    │       └── fluid-fullscreen.html     # Fullscreen water background
    └── references/
        ├── shader-params.md              # All shader uniform parameters
        └── integration-guide.md          # Integration guide for existing sites
```

## ⚙️ Parameters

### Water Surface (`effect: 'water'`)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `waveSpeed` | 0.2 | 0–1 | Overall wave animation speed |
| `waveSpeedX` | 0.3 | 0–1 | Horizontal wave drift speed |
| `waveSpeedY` | 0.3 | 0–1 | Vertical wave drift speed |
| `intensity` | 2.4 | 0–5 | Wave amplitude |
| `frequency` | 6.0 | 1–15 | Wave frequency (higher = tighter waves) |
| `emboss` | 0.5 | 0–2 | Height gradient factor for refraction |
| `refraction` | 2.0 | 0–5 | UV displacement strength |
| `reflGain` | 700 | 0–2000 | Reflection gain multiplier |
| `reflCutoff` | 0.012 | 0–0.1 | Reflection cutoff threshold |
| `reflIntensity` | 200000 | 0–500000 | Reflection intensity exponent |
| `waterTint` | 0.92 | 0.5–1.5 | Water color tint (lower = darker) |

### Liquid Glass (`effect: 'glass'`)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `glassW` | 0 | 0 = auto | Glass area width in pixels |
| `glassH` | 0 | 0 = auto | Glass area height in pixels |
| `glassR` | 12 | 0–50 | Corner radius in pixels |
| `distortDepth` | 30 | 5–100 | Lens distortion depth |
| `distortStrength` | 0.15 | 0–0.5 | Distortion amount |
| `chromaShift` | 1.5 | 0–5 | Chromatic aberration in pixels |
| `glassTint` | 1.0 | 0.5–1.5 | Glass color tint |

### Presets

| Preset | waveSpeed | intensity | frequency | refraction | emboss | waterTint |
|--------|-----------|-----------|-----------|------------|--------|-----------|
| Calm | 0.1 | 1.5 | 4.0 | 1.0 | 0.3 | 0.95 |
| Default | 0.2 | 2.4 | 6.0 | 2.0 | 0.5 | 0.92 |
| Storm | 0.5 | 4.0 | 10.0 | 3.5 | 0.8 | 0.85 |
| Crystal | 0.15 | 1.0 | 8.0 | 1.5 | 0.4 | 1.0 |
| Deep Ocean | 0.08 | 3.0 | 3.0 | 2.5 | 0.6 | 0.8 |

## 🔧 API

### `new FluidEngine(canvas, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `effect` | `'water' \| 'glass'` | `'water'` | Effect type |
| `params` | `object` | `{}` | Shader parameters (see above) |

### `engine.addRipple(x, y, strength)`

Add a ripple at pixel coordinates relative to the canvas.

| Parameter | Description |
|-----------|-------------|
| `x`, `y` | Pixel coordinates relative to canvas |
| `strength` | `0.3` = subtle (mouse move), `1.0` = medium, `1.5+` = strong (click) |

### `engine.setParam(name, value)`

Update a shader parameter in real time.

### `engine.dispose()`

Clean up WebGL resources and stop the render loop.

## 🏗️ Architecture

```
[Procedural BG] → FBO Texture → [Water/Glass Shader] → Canvas → [DOM Content overlay]
```

1. **Background Pass** — Render animated gradient blobs to an offscreen FBO texture
2. **Effect Pass** — Sample the background texture through the water or glass shader
3. **DOM Overlay** — HTML content positioned on top of the canvas (with `pointer-events:none`)

### Key Implementation Details

- **Water shader** — 8-step, 7-angle multi-directional wave summation with refraction, reflection, and lighting
- **Ripple formula** — `sin(d · 0.05 - age · 8) · exp(-d · 0.005) · exp(-age · 0.9) · strength`
- **Liquid glass** — SDF rounded rectangle + lens distortion + RGB channel split
- **WebGL1** — Maximum browser compatibility, no WebGL2 required
- **devicePixelRatio** — Auto-handled, capped at 2x for performance

## 🖱️ Interaction

| Action | Effect |
|--------|--------|
| Mouse move over canvas | Small ripples trail the cursor + glow halo |
| Click / tap on canvas | Large expanding ripple wave |
| Mouse position | Light glow follows cursor in water shader |
| Parameter panel (demo) | Real-time slider controls for all parameters |

## 📦 Templates

| Template | Description | Use Case |
|----------|-------------|----------|
| `fluid-terminal.html` | Terminal window with water effect | Developer portfolios, tech demos |
| `fluid-glass.html` | Liquid glass card with distortion | Product cards, feature highlights |
| `fluid-minimal.html` | Minimal code integration | Learning, quick start |
| `fluid-fullscreen.html` | Fullscreen water background | Landing pages, hero sections |
| `fluid-showcase.html` | Full demo with all features | Complete reference |

## ⚡ Performance Tips

- Cap canvas resolution (engine auto-caps `devicePixelRatio` at 2x)
- Reduce `STEPS` and `ANGLE` constants in the water shader for low-end devices
- Use `effect: 'glass'` for lighter GPU load (no wave simulation loop)
- Avoid multiple water-effect engines on the same page
- Set `pointer-events: none` on overlay content so mouse events reach the canvas

## 🌐 Browser Support

| Browser | Support |
|---------|---------|
| Chrome / Edge | ✅ Full |
| Firefox | ✅ Full |
| Safari | ✅ Full |
| Mobile Safari | ✅ Full (touch ripples) |
| Chrome Android | ✅ Full |

Requires WebGL1 support (99%+ of browsers).

## 📄 License

[MIT](LICENSE) — free for personal and commercial use.

## 🙏 Credits

- Original shaders from [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm) by [@bea4dev](https://github.com/bea4dev)
- Inspired by the [ShojiWM](https://github.com/bea4dev/ShojiWM) Wayland compositor project
