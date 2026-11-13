const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FluidEngine } = require('../fluid-engine.js');

const rootDir = path.join(__dirname, '..');

class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    MockResizeObserver.latest = this;
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
}

function createMockGL(overrides) {
  const calls = { uniform1f: [], uniform2f: [], uniform4f: [], uniform1i: [], sources: [] };
  const locations = new Map();
  const gl = {
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    MAX_TEXTURE_SIZE: 0x0D33,
    calls,
    checkFramebufferStatus() {
      return gl.FRAMEBUFFER_COMPLETE;
    },
    getParameter(pname) {
      return pname === gl.MAX_TEXTURE_SIZE ? 16384 : 0;
    },
    getShaderParameter() {
      return true;
    },
    getProgramParameter() {
      return true;
    },
    getShaderInfoLog() {
      return '';
    },
    getProgramInfoLog() {
      return '';
    },
    getAttribLocation() {
      return 0;
    },
    getUniformLocation(_program, name) {
      if (!locations.has(name)) locations.set(name, { name });
      return locations.get(name);
    },
    shaderSource(_shader, src) {
      calls.sources.push(src);
    },
    uniform1f(loc, value) {
      calls.uniform1f.push([loc && loc.name, value]);
    },
    uniform2f(loc, x, y) {
      calls.uniform2f.push([loc && loc.name, x, y]);
    },
    uniform4f(loc, x, y, z, w) {
      calls.uniform4f.push([loc && loc.name, x, y, z, w]);
    },
    uniform1i(loc, value) {
      calls.uniform1i.push([loc && loc.name, value]);
    }
  };
  if (overrides) Object.assign(gl, overrides);
  return new Proxy(gl, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === 'symbol') return undefined;
      if (/^[A-Z0-9_]+$/.test(String(prop))) return 1;
      const fn = function () { return {}; };
      target[prop] = fn;
      return fn;
    }
  });
}

function createCanvas(gl, size) {
  const listeners = {};
  const rect = Object.assign({ width: 320, height: 180, left: 10, top: 20 }, size);
  return {
    width: 0,
    height: 0,
    style: {},
    listeners,
    getContext() {
      return gl;
    },
    getBoundingClientRect() {
      return rect;
    },
    addEventListener(type, fn) {
      (listeners[type] || (listeners[type] = [])).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners[type] || [];
      const index = list.indexOf(fn);
      if (index >= 0) list.splice(index, 1);
    }
  };
}

function installFrameLoop() {
  const state = { frames: [], cancelled: [] };
  global.requestAnimationFrame = (callback) => {
    state.frames.push(callback);
    return state.frames.length;
  };
  global.cancelAnimationFrame = (id) => {
    state.cancelled.push(id);
  };
  return state;
}

function boot(options, glOverrides, canvasSize) {
  const frames = installFrameLoop();
  const gl = createMockGL(glOverrides);
  const canvas = createCanvas(gl, canvasSize);
  const engine = new FluidEngine(canvas, options);
  return { gl, canvas, engine, frames };
}

function draw(frames) {
  const frame = frames.frames[frames.frames.length - 1];
  assert.equal(typeof frame, 'function');
  frame();
}

function dispatch(canvas, type, event) {
  (canvas.listeners[type] || []).slice().forEach((fn) => fn(event));
}

function read(name) {
  return fs.readFileSync(path.join(rootDir, name), 'utf8');
}

test.beforeEach(() => {
  global.ResizeObserver = MockResizeObserver;
  global.devicePixelRatio = 1;
  delete global.matchMedia;
});

test('rejects a missing canvas and a missing WebGL context', () => {
  const original = console.error;
  console.error = () => {};
  try {
    const missing = new FluidEngine(null);
    assert.equal(missing.ready, false);
    assert.match(missing.error, /canvas/i);
    missing.dispose();
    missing.dispose();

    const { engine } = boot();
    engine.dispose();
    const noGl = new FluidEngine({ getContext() { return null; } });
    assert.equal(noGl.ready, false);
    assert.match(noGl.error, /webgl/i);
    noGl.dispose();
  } finally {
    console.error = original;
  }
});

test('compiles the water shader, sizes the canvas, and uploads CSS pixels in WebGL space', () => {
  global.devicePixelRatio = 2;
  const { gl, canvas, engine, frames } = boot();
  assert.equal(engine.ready, true);
  assert.equal(engine.error, null);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 360);
  assert.equal(engine.dpr, 2);
  assert.ok(gl.calls.sources.some((src) => src.includes('uniform vec4 u_ripples[20]')));
  assert.ok(gl.calls.sources.some((src) => (
    src.includes('sin(d * 0.06 - age * 8.0) * exp(-d * 0.003) * exp(-age * 0.7)')
  )));

  engine.addRipple(30, 40, 1.5);
  engine.addRipple(Number.NaN, 1, 1);
  engine.addRipple(1, Number.POSITIVE_INFINITY, 1);
  engine.addRipple(4, 5, 0);
  engine.addRipple(6, 7, 'big');
  assert.equal(engine.ripples.length, 3);
  assert.equal(engine.ripples[1].strength, 0);
  assert.equal(engine.ripples[2].strength, 1);

  dispatch(canvas, 'mousemove', { clientX: 60, clientY: 50 });
  gl.calls.uniform2f.length = 0;
  gl.calls.uniform4f.length = 0;
  gl.calls.uniform1f.length = 0;
  draw(frames);

  const ripple = gl.calls.uniform4f.find((entry) => entry[0] === 'u_ripples[0]');
  assert.ok(ripple);
  assert.equal(ripple[1], 60);
  assert.equal(ripple[2], 280);
  assert.equal(ripple[3], engine.ripples[0].start);
  assert.equal(ripple[4], 1.5);

  const mouse = gl.calls.uniform2f.find((entry) => entry[0] === 'u_mousePos');
  assert.deepEqual(mouse.slice(1), [100, 300]);
  const inside = gl.calls.uniform1f.find((entry) => entry[0] === 'u_mouseInside');
  assert.equal(inside[1], 1);

  engine.dispose();
});

test('locks layout when the canvas size comes from its bitmap', () => {
  global.devicePixelRatio = 2;
  const frames = installFrameLoop();
  const gl = createMockGL();
  const canvas = createCanvas(gl);
  canvas.width = 300;
  canvas.height = 150;
  canvas.getBoundingClientRect = () => ({
    width: canvas.style.width ? Number.parseFloat(canvas.style.width) : canvas.width,
    height: canvas.style.height ? Number.parseFloat(canvas.style.height) : canvas.height,
    left: 0,
    top: 0
  });
  const engine = new FluidEngine(canvas, { interactive: false });
  assert.equal(canvas.style.width, '300px');
  assert.equal(canvas.style.height, '150px');
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 300);
  engine._resize();
  assert.equal(canvas.width, 600);
  assert.equal(canvas.height, 300);
  engine.dispose();
  assert.equal(frames.cancelled.length > 0, true);
});

test('caps device pixel ratio and the framebuffer size', () => {
  global.devicePixelRatio = 4;
  const capped = boot(undefined, undefined, { width: 100, height: 50, left: 0, top: 0 });
  assert.equal(capped.engine.dpr, 2);
  assert.equal(capped.canvas.width, 200);
  assert.equal(capped.canvas.height, 100);
  capped.engine.dispose();

  const fitted = boot({
    interactive: false
  }, {
    getParameter() { return 64; }
  });
  assert.equal(fitted.canvas.width, 64);
  assert.ok(fitted.canvas.height <= 64);
  assert.ok(fitted.engine.dpr < 1);
  fitted.engine.dispose();
});

test('keeps at most 20 live ripples and drops expired ones', () => {
  const original = performance.now.bind(performance);
  let now = 10_000;
  performance.now = () => now;
  try {
    const { engine, frames } = boot({ interactive: false });
    for (let i = 0; i < 25; i += 1) engine.addRipple(i, 1, 1);
    assert.equal(engine.ripples.length, 20);
    assert.equal(engine.ripples[0].x, 5);
    assert.equal(engine.ripples[19].x, 24);
    now += 6_000;
    draw(frames);
    assert.equal(engine.ripples.length, 0);
    engine.dispose();
  } finally {
    performance.now = original;
  }
});

test('tracks pointer ripples once, including the touch-generated click', () => {
  const { canvas, engine } = boot();
  dispatch(canvas, 'mousemove', { clientX: 10, clientY: 20 });
  dispatch(canvas, 'mousemove', { clientX: 20, clientY: 20 });
  assert.equal(engine.ripples.length, 1);
  assert.ok(Math.abs(engine.ripples[0].strength - (0.8 + 10 / 30)) < 1e-9);

  dispatch(canvas, 'click', { clientX: 20, clientY: 20 });
  assert.equal(engine.ripples.at(-1).strength, 3.5);

  const beforeTouch = engine.ripples.length;
  let prevented = false;
  dispatch(canvas, 'touchstart', { touches: [{ clientX: 40, clientY: 50 }] });
  dispatch(canvas, 'touchmove', {
    touches: [{ clientX: 48, clientY: 50 }],
    preventDefault() { prevented = true; }
  });
  dispatch(canvas, 'click', { clientX: 48, clientY: 50 });
  dispatch(canvas, 'mousemove', { clientX: 80, clientY: 50 });
  assert.equal(prevented, true);
  assert.equal(engine.ripples.length, beforeTouch + 2);
  assert.equal(engine.ripples[beforeTouch].strength, 2.5);
  assert.equal(engine.ripples[beforeTouch + 1].strength, 1.2);
  engine.dispose();
  assert.equal((canvas.listeners.click || []).length, 0);
});

test('validates params and effects, and can run without built-in listeners', () => {
  const { canvas, engine, frames, gl } = boot({
    effect: 'lava',
    interactive: false,
    params: { intensity: 3, waveSpeed: 'fast', unknown: 9 }
  });
  assert.equal(engine.effect, 'water');
  assert.equal(engine.getParam('intensity'), 3);
  assert.equal(engine.getParam('waveSpeed'), 0.2);
  assert.equal(engine.getParam('unknown'), undefined);
  assert.equal(canvas.listeners.click, undefined);

  engine.setParam('nope', 1);
  engine.setParam('waveSpeed', Number.NaN);
  assert.equal(engine.getParam('waveSpeed'), 0.2);
  engine.setParam('waveSpeed', 0.4);
  assert.equal(engine.getParam('waveSpeed'), 0.4);

  engine.setEffect('glass');
  assert.equal(engine.effect, 'glass');
  engine.setEffect('nope');
  assert.equal(engine.effect, 'glass');
  gl.calls.uniform1f.length = 0;
  draw(frames);
  const distort = gl.calls.uniform1f.find((entry) => entry[0] === 'u_distortStrength');
  assert.equal(distort[1], 0.15);

  engine.dispose();
  engine.setParam('waveSpeed', 0.9);
  engine.setEffect('water');
  engine.addRipple(1, 1, 1);
  assert.equal(engine.getParam('waveSpeed'), 0.4);
  assert.equal(engine.effect, 'glass');
  assert.equal(engine.ripples.length, 0);
  engine.destroy();
});

test('pauses wave motion when the user prefers reduced motion', () => {
  global.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {}
  });
  const { gl, engine, frames } = boot();
  gl.calls.uniform1f.length = 0;
  draw(frames);
  const wave = gl.calls.uniform1f.find((entry) => entry[0] === 'u_waveSpeed');
  assert.equal(wave[1], 0);
  assert.equal(engine.getParam('waveSpeed'), 0.2);
  engine.dispose();
  assert.equal(MockResizeObserver.latest.disconnected, true);
});

test('stops cleanly when shaders or the framebuffer cannot be created', () => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => { errors.push(args.join(' ')); };
  try {
    const compiled = boot(undefined, {
      getShaderParameter() { return false; },
      getShaderInfoLog() { return 'compile failed'; }
    });
    assert.equal(compiled.engine.ready, false);
    assert.match(compiled.engine.error, /shader/i);
    assert.equal(compiled.frames.frames.length, 0);
    compiled.engine.dispose();

    const framebuffer = boot(undefined, {
      checkFramebufferStatus() { return 0; }
    });
    assert.equal(framebuffer.engine.ready, false);
    assert.match(framebuffer.engine.error, /framebuffer/i);
    draw(framebuffer.frames);
    framebuffer.engine.dispose();
    assert.ok(errors.length >= 2);
  } finally {
    console.error = original;
  }
});

test('survives context loss and restores the render loop', () => {
  const { canvas, engine, frames } = boot({ interactive: false });
  let prevented = false;
  dispatch(canvas, 'webglcontextlost', {
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(engine.ready, false);
  draw(frames);

  dispatch(canvas, 'webglcontextrestored', {});
  assert.equal(engine._contextLost, false);
  assert.equal(engine.ready, true);
  draw(frames);
  engine.dispose();
  assert.equal(frames.cancelled.length > 0, true);
});

test('docs, demo, and package metadata match the engine', () => {
  const readme = read('README.md');
  const readmeZh = read('README.zh-CN.md');
  const html = read('index.html');
  const pkg = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/ci.yml');
  const formula = 'sin(d * 0.06 - age * 8.0) * exp(-d * 0.003) * exp(-age * 0.7)';

  for (const doc of [readme, readmeZh]) {
    assert.ok(doc.includes(formula));
    assert.equal(doc.includes('.workbuddy'), false);
    assert.equal(doc.includes('fluid-terminal.html'), false);
    assert.equal(doc.includes('exp(-d * 0.005)'), false);
    assert.match(doc, /dispose\(\)/);
    assert.match(doc, /top-left|左上角/);
  }

  assert.equal(html.includes('function FluidEngine'), false);
  assert.ok(html.indexOf('src="fluid-engine.js"') < html.indexOf('new FluidEngine'));
  assert.equal(pkg.dependencies, undefined);
  assert.match(pkg.scripts.test, /node --test/);
  assert.match(workflow, /npm test/);
});
