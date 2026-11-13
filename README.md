# Awesome Fluid Web

**[English](#english) | [中文](README.zh-CN.md)**

---

<a id="english"></a>

> WebGL water, ripples, and liquid glass for the browser. No runtime dependencies, WebGL1, and the demo opens from `file://`.

Ported from the [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm) GLSL shaders.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![WebGL1](https://img.shields.io/badge/WebGL-1.0-green.svg)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-brightgreen.svg)

## Effects

| Effect | Description |
|--------|-------------|
| **Water surface** | 8-step, 7-angle wave sum with refraction, reflection, lighting, and tint |
| **Interactive ripples** | Expanding rings, exponentially damped. At most 20 at once, each lasting 5 seconds |
| **Liquid glass** | SDF rounded lens with RGB chromatic aberration |
| **Procedural background** | Animated gradient blobs rendered to an offscreen framebuffer and sampled by the effect |

## Quick start

Open the demo (no install, no build):

```bash
git clone https://github.com/sapsapshen/AwesomeFluidWeb.git
cd AwesomeFluidWeb
# macOS: open index.html
# Windows: start index.html
# Linux: xdg-open index.html
```

Use the engine on a page. Pointer tracking is on by default. `addRipple` takes CSS pixels with the origin at the **top-left** of the canvas; the engine applies `devicePixelRatio` (capped at 2) and WebGL's bottom-left axis.

```html
<canvas id="canvas" style="width:100%;height:400px"></canvas>
<script src="fluid-engine.js"></script>
<script>
  var canvas = document.getElementById('canvas');
  var engine = new FluidEngine(canvas, {
    effect: 'water', // or 'glass'
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

Cover the canvas with `pointer-events: none` on any overlay, otherwise the canvas never sees the pointer. Pass `interactive: false` when the page supplies its own pointer handling.

## Project structure

```
AwesomeFluidWeb/
├── index.html                 # Demo: terminal, glass cards, sliders, presets
├── fluid-engine.js            # Engine used by the demo and by other pages
├── test/fluid-engine.test.js  # Node.js tests (mocked WebGL)
├── .github/workflows/ci.yml   # Runs npm test on Node 20 and 22
├── package.json
├── LICENSE
├── README.md
└── README.zh-CN.md
```

## Parameters

### Water (`effect: 'water'`)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `waveSpeed` | 0.2 | 0–1 | Overall wave animation speed |
| `waveSpeedX` | 0.3 | 0–1 | Horizontal wave drift |
| `waveSpeedY` | 0.3 | 0–1 | Vertical wave drift |
| `intensity` | 2.4 | 0–5 | Wave amplitude |
| `frequency` | 6.0 | 1–15 | Wave frequency |
| `emboss` | 0.5 | 0–2 | Height-gradient factor for refraction |
| `refraction` | 2.0 | 0–5 | UV displacement strength |
| `reflGain` | 700 | 0–2000 | Reflection gain |
| `reflCutoff` | 0.012 | 0–0.1 | Reflection cutoff |
| `reflIntensity` | 200000 | 0–500000 | Reflection exponent |
| `waterTint` | 0.92 | 0.5–1.5 | Water tint (lower is darker) |

### Liquid glass (`effect: 'glass'`)

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `glassW` | 0 | 0 = auto | Glass width in pixels |
| `glassH` | 0 | 0 = auto | Glass height in pixels |
| `glassR` | 12 | 0–50 | Corner radius in pixels |
| `distortDepth` | 30 | 5–100 | Lens depth |
| `distortStrength` | 0.15 | 0–0.5 | Distortion amount |
| `chromaShift` | 1.5 | 0–5 | Chromatic aberration in pixels |
| `glassTint` | 1.0 | 0.5–1.5 | Glass tint |

Unknown parameter names and non-finite numbers are ignored.

### Presets

| Preset | waveSpeed | intensity | frequency | refraction | emboss | waterTint |
|--------|-----------|-----------|-----------|------------|--------|-----------|
| Calm | 0.1 | 1.5 | 4.0 | 1.0 | 0.3 | 0.95 |
| Default | 0.2 | 2.4 | 6.0 | 2.0 | 0.5 | 0.92 |
| Storm | 0.5 | 4.0 | 10.0 | 3.5 | 0.8 | 0.85 |
| Crystal | 0.15 | 1.0 | 8.0 | 1.5 | 0.4 | 1.0 |
| Deep Ocean | 0.08 | 3.0 | 3.0 | 2.5 | 0.6 | 0.8 |

## API

### `new FluidEngine(canvas, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `effect` | `'water'` or `'glass'` | `'water'` | Effect to draw. Any other value uses water |
| `params` | object | `{}` | Shader parameters above |
| `interactive` | boolean | `true` | Listen for mouse and touch on the canvas |

After construction, `engine.ready` is `true` when the context and shaders started. `engine.error` is a short string when they did not. `engine.gl` is the WebGL context, or `null`.

`engine.ripples` is the live ripple list (`x`, `y`, `start`, `strength`). `engine.fps` updates about once a second.

### `engine.addRipple(x, y, strength)`

`x` and `y` are CSS pixels relative to the canvas, origin at the top-left. Omitted or non-finite `strength` becomes `1`. `0` is kept. Non-finite coordinates are ignored.

### `engine.setParam(name, value)` / `engine.getParam(name)`

Update or read one parameter. Values take effect on the next frame.

### `engine.setEffect('water' | 'glass')`

Switches the effect when that shader compiled. Invalid names leave the current effect in place.

### `engine.dispose()`

Stops the frame loop, removes listeners, and deletes WebGL resources. `engine.destroy()` is the same method's alias. A second call does nothing. Calls after dispose do not recreate ripples or change parameters.

## Behavior

```
[procedural background] → framebuffer texture → [water or glass shader] → canvas
```

- Ripple height is `sin(d * 0.06 - age * 8.0) * exp(-d * 0.003) * exp(-age * 0.7) * strength`, where `d` is distance in device pixels and `age` is seconds.
- Ripple positions are uploaded as one `vec4` each (x, y, start, strength) so the shader stays within typical WebGL1 uniform limits.
- Built-in pointer strengths: mouse move `0.8 + min(distance / 30, 1.5)` after moving more than 4 CSS pixels, click `3.5`, touch start `2.5`, touch move `1.2`. A click synthesized from a touch is ignored.
- `prefers-reduced-motion: reduce` stops the ambient wave (and the glass wobble) and still draws interaction ripples.
- `devicePixelRatio` is capped at 2 and, if needed, reduced so the framebuffer fits `MAX_TEXTURE_SIZE`.
- Give the canvas a CSS size. If it has none, the engine pins the current layout size so the high-DPI bitmap cannot stretch the element on the next resize.

## Performance

- The demo runs one water engine and two glass engines. Extra water engines each allocate a full-size framebuffer.
- Glass is the lighter effect: it does not run the wave loop.
- Overlay content needs `pointer-events: none`.
- Lower `STEPS` and `ANGLE` in the water shader on very slow GPUs.

## Browser support

Requires WebGL1. Current Chrome, Edge, Firefox, Safari, Mobile Safari, and Chrome for Android are supported. If WebGL cannot start, the demo shows an error instead of throwing.

## Development

```bash
npm test
```

Node.js 18 or newer. There are no dependencies. CI runs the same command on Node 20 and 22.

## License

[MIT](LICENSE)

## Credits

- Shaders adapted from [liquid-terminal-config-shojiwm](https://github.com/bea4dev/liquid-terminal-config-shojiwm) by [@bea4dev](https://github.com/bea4dev)
- Inspired by [ShojiWM](https://github.com/bea4dev/ShojiWM)
