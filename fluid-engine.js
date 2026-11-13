/**
 * FluidEngine — WebGL1 water surface and liquid glass.
 *
 *   var engine = new FluidEngine(canvas, { effect: 'water', params: { intensity: 2.4 } });
 *   engine.addRipple(x, y, strength); // CSS pixels, origin at the top-left
 *   engine.dispose();
 *
 * Overlay elements must use pointer-events: none so the canvas receives the pointer.
 */
(function (root) {
'use strict';

var MAX_RIPPLES = 20;
var RIPPLE_LIFETIME = 5;
var MAX_DPR = 2;

var FRAG_PRECISION = [
'#ifdef GL_FRAGMENT_PRECISION_HIGH',
'precision highp float;',
'#else',
'precision mediump float;',
'#endif'
].join('\n');

var VERT_SRC = [
'attribute vec2 a_position;',
'varying vec2 v_uv;',
'void main(){',
'  v_uv = a_position * 0.5 + 0.5;',
'  gl_Position = vec4(a_position, 0.0, 1.0);',
'}'
].join('\n');

var BG_FRAG = [
FRAG_PRECISION,
'varying vec2 v_uv;',
'uniform float u_time;',
'uniform vec2 u_resolution;',
'',
'float hash(vec2 p){',
'  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);',
'}',
'float noise(vec2 p){',
'  vec2 i = floor(p);',
'  vec2 f = fract(p);',
'  f = f * f * (3.0 - 2.0 * f);',
'  return mix(',
'    mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),',
'    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x),',
'    f.y',
'  );',
'}',
'',
'void main(){',
'  vec2 uv = v_uv;',
'  float t = u_time * 0.12;',
'  vec3 color = vec3(0.03, 0.05, 0.10);',
'',
'  vec2 b1 = vec2(0.25 + sin(t) * 0.12, 0.35 + cos(t * 1.3) * 0.12);',
'  color += vec3(0.15, 0.08, 0.28) * smoothstep(0.55, 0.0, distance(uv, b1));',
'',
'  vec2 b2 = vec2(0.75 + cos(t * 0.7) * 0.12, 0.65 + sin(t * 1.1) * 0.12);',
'  color += vec3(0.05, 0.15, 0.22) * smoothstep(0.55, 0.0, distance(uv, b2));',
'',
'  vec2 b3 = vec2(0.50 + sin(t * 0.9) * 0.15, 0.30 + cos(t * 0.6) * 0.15);',
'  color += vec3(0.18, 0.05, 0.12) * smoothstep(0.45, 0.0, distance(uv, b3));',
'',
'  vec2 b4 = vec2(0.60 + sin(t * 1.2) * 0.10, 0.80 + cos(t * 0.8) * 0.10);',
'  color += vec3(0.08, 0.18, 0.12) * smoothstep(0.50, 0.0, distance(uv, b4));',
'',
'  float n = noise(uv * 4.0 + t) * 0.03;',
'  color += n;',
'',
'  float vig = smoothstep(1.3, 0.3, distance(uv, vec2(0.5)));',
'  color *= vig;',
'',
'  gl_FragColor = vec4(color, 1.0);',
'}'
].join('\n');

var WATER_FRAG = [
FRAG_PRECISION,
'varying vec2 v_uv;',
'uniform float u_time;',
'uniform float u_waveSpeed;',
'uniform float u_waveSpeedX;',
'uniform float u_waveSpeedY;',
'uniform float u_emboss;',
'uniform float u_intensity;',
'uniform float u_frequency;',
'uniform float u_refraction;',
'uniform float u_reflGain;',
'uniform float u_reflCutoff;',
'uniform float u_reflIntensity;',
'uniform float u_waterTint;',
'uniform vec2 u_resolution;',
'uniform sampler2D u_texture;',
'uniform int u_rippleCount;',
'uniform vec4 u_ripples[20];',
'uniform vec2 u_mousePos;',
'uniform float u_mouseInside;',
'',
'const float PI = 3.1415926535897932;',
'const int STEPS = 8;',
'const int ANGLE = 7;',
'const int MAX_RIPPLES = 20;',
'',
'float water_height(vec2 coord, float t){',
'  float dt = 2.0 * PI / float(ANGLE);',
'  float h = 0.0;',
'  for(int i = 0; i < STEPS; i++){',
'    float th = dt * float(i);',
'    vec2 a = coord;',
'    a.x += cos(th) * t * u_waveSpeed + t * u_waveSpeedX;',
'    a.y -= sin(th) * t * u_waveSpeed - t * u_waveSpeedY;',
'    h += cos((a.x * cos(th) - a.y * sin(th)) * u_frequency) * u_intensity;',
'  }',
'  return cos(h);',
'}',
'',
'float ripple_height(vec2 px, float t){',
'  float h = 0.0;',
'  for(int i = 0; i < MAX_RIPPLES; i++){',
'    if(i >= u_rippleCount) break;',
'    vec4 rp = u_ripples[i];',
'    float age = t - rp.z;',
'    if(age > 0.0 && age < 5.0){',
'      float d = distance(px, rp.xy);',
'      float w = sin(d * 0.06 - age * 8.0) * exp(-d * 0.003) * exp(-age * 0.7);',
'      h += w * rp.w;',
'    }',
'  }',
'  return h;',
'}',
'',
'void main(){',
'  vec2 uv = v_uv;',
'  vec2 sz = max(u_resolution, vec2(1.0));',
'  float t = u_time * 1.3;',
'  vec2 px = uv * sz;',
'',
'  float wc = water_height(uv, t);',
'  float rc = ripple_height(px, u_time);',
'',
'  vec2 sd = 1.0 / sz;',
'',
'  float wdx = u_emboss * (wc - water_height(uv + vec2(sd.x, 0.0), t));',
'  float wdy = u_emboss * (wc - water_height(uv + vec2(0.0, sd.y), t));',
'  float rdx = u_emboss * (rc - ripple_height(px + vec2(1.0, 0.0), u_time)) * 0.6;',
'  float rdy = u_emboss * (rc - ripple_height(px + vec2(0.0, 1.0), u_time)) * 0.6;',
'',
'  float dx = wdx + rdx;',
'  float dy = wdy + rdy;',
'',
'  vec2 ruv = uv + vec2(dx, dy) * u_refraction;',
'  ruv = clamp(ruv, vec2(0.0), vec2(1.0));',
'',
'  float alpha = max(0.0, 1.0 + dx * dy * u_reflGain);',
'  float rx = dx - u_reflCutoff;',
'  float ry = dy - u_reflCutoff;',
'  if(rx > 0.0 && ry > 0.0){',
'    alpha = pow(alpha, rx * ry * u_reflIntensity);',
'  }',
'',
'  vec4 color = texture2D(u_texture, ruv);',
'',
'  if(u_mouseInside > 0.5){',
'    float md = distance(px, u_mousePos);',
'    float glow = exp(-md * 0.008) * 0.25;',
'    color.rgb += vec3(0.15, 0.35, 0.55) * glow;',
'  }',
'',
'  float rg = abs(rc);',
'  color.rgb += vec3(0.1, 0.2, 0.3) * rg * 0.5;',
'',
'  vec2 lightDir = normalize(vec2(-0.35, -0.8));',
'  float rl = clamp(dot(normalize(vec2(dx, dy) + 0.0001), lightDir), 0.0, 1.0);',
'  vec3 tint = mix(vec3(u_waterTint), vec3(0.70, 0.88, 1.08), 0.25);',
'  color.rgb = color.rgb * tint * clamp(alpha, 0.72, 1.55);',
'  color.rgb += vec3(0.16, 0.24, 0.30) * rl * 0.22;',
'',
'  float vig = smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.72, uv.y);',
'  color.rgb *= mix(0.88, 1.04, vig);',
'',
'  gl_FragColor = vec4(color.rgb, color.a);',
'}'
].join('\n');

var GLASS_FRAG = [
FRAG_PRECISION,
'varying vec2 v_uv;',
'uniform vec2 u_resolution;',
'uniform sampler2D u_texture;',
'uniform float u_glassW;',
'uniform float u_glassH;',
'uniform float u_glassR;',
'uniform float u_distortDepth;',
'uniform float u_distortStrength;',
'uniform float u_chromaShift;',
'uniform float u_glassTint;',
'uniform vec2 u_mousePos;',
'uniform float u_mouseInside;',
'uniform float u_time;',
'',
'float sdf(vec2 p, vec2 b, float r){',
'  vec2 d = abs(p) - b + vec2(r);',
'  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;',
'}',
'vec2 safeNorm(vec2 v){',
'  float s = max(max(abs(v.x), abs(v.y)), 0.0001);',
'  vec2 sc = v / s;',
'  return sc / max(length(sc), 0.0001);',
'}',
'vec3 texAt(vec2 c, vec2 rs){',
'  vec2 uv = clamp(c / max(rs, vec2(1.0)), vec2(0.0), vec2(1.0));',
'  return texture2D(u_texture, uv).rgb;',
'}',
'',
'void main(){',
'  vec2 fc = v_uv * u_resolution;',
'  vec2 gs = vec2(',
'    u_glassW > 0.0 ? u_glassW : u_resolution.x,',
'    u_glassH > 0.0 ? u_glassH : u_resolution.y',
'  );',
'  vec2 gc = u_resolution * 0.5;',
'  vec2 gCoord = fc - gc;',
'',
'  float size = max(min(gs.x, gs.y), 1.0);',
'  float ss = max(max(gs.x, gs.y), 1.0);',
'  float inv = -sdf(gCoord / ss, gs * 0.5 / ss, u_glassR / ss) * ss / size;',
'',
'  if(inv < 0.0){',
'    gl_FragColor = vec4(texAt(fc, u_resolution), 1.0);',
'    return;',
'  }',
'',
'  float mouseEffect = 0.0;',
'  if(u_mouseInside > 0.5){',
'    float md = distance(fc, u_mousePos);',
'    mouseEffect = exp(-md * 0.01) * sin(u_time * 4.0) * 0.3;',
'  }',
'',
'  vec2 ngc = safeNorm(gCoord);',
'  float dfc = 1.0 - clamp(inv / max(u_distortDepth, 0.0001), 0.0, 1.0);',
'  float dist = 1.0 - sqrt(max(1.0 - pow(dfc, 2.0), 0.0));',
'  vec2 off = (dist + mouseEffect) * ngc * gs * 0.5 * u_distortStrength;',
'  vec2 gcc = fc - off;',
'',
'  float edge = smoothstep(0.0, 0.02, inv);',
'  vec2 sh = ngc * edge * u_chromaShift;',
'  vec3 col = vec3(',
'    texAt(gcc - sh, u_resolution).r,',
'    texAt(gcc, u_resolution).g,',
'    texAt(gcc + sh, u_resolution).b',
'  );',
'  col *= vec3(u_glassTint);',
'',
'  if(u_mouseInside > 0.5){',
'    float md = distance(fc, u_mousePos);',
'    float glow = exp(-md * 0.012) * 0.2;',
'    col += vec3(0.15, 0.3, 0.5) * glow;',
'  }',
'',
'  gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');

var DEFAULT_PARAMS = {
  waveSpeed: 0.2,
  waveSpeedX: 0.3,
  waveSpeedY: 0.3,
  emboss: 0.5,
  intensity: 2.4,
  frequency: 6.0,
  refraction: 2.0,
  reflGain: 700.0,
  reflCutoff: 0.012,
  reflIntensity: 200000.0,
  waterTint: 0.92,
  glassW: 0,
  glassH: 0,
  glassR: 12,
  distortDepth: 30,
  distortStrength: 0.15,
  chromaShift: 1.5,
  glassTint: 1.0
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function mergeParams(overrides) {
  var params = {};
  var key;
  for (key in DEFAULT_PARAMS) {
    if (hasOwn(DEFAULT_PARAMS, key)) params[key] = DEFAULT_PARAMS[key];
  }
  if (!overrides) return params;
  for (key in overrides) {
    if (!hasOwn(overrides, key) || !hasOwn(params, key)) continue;
    if (typeof overrides[key] !== 'number' || !isFinite(overrides[key])) continue;
    params[key] = overrides[key];
  }
  return params;
}

function normalizeStrength(strength) {
  if (typeof strength !== 'number' || !isFinite(strength)) return 1;
  return strength;
}

function createShader(gl, type, src) {
  var shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSrc, fsSrc) {
  var vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  var fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  var program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createTexture(gl, w, h) {
  var tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFBO(gl, tex) {
  var fb = gl.createFramebuffer();
  if (!fb) return null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}

function locations(gl, program, names) {
  var out = { _position: gl.getAttribLocation(program, 'a_position') };
  for (var i = 0; i < names.length; i++) {
    out[names[i]] = gl.getUniformLocation(program, names[i]);
  }
  return out;
}

function bindQuad(gl, buffer, attrib) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  if (attrib < 0) return;
  gl.enableVertexAttribArray(attrib);
  gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);
}

function FluidEngine(canvas, opts) {
  opts = opts || {};
  this.canvas = canvas || null;
  this.params = mergeParams(opts.params);
  this.effect = opts.effect === 'glass' ? 'glass' : 'water';
  this.interactive = opts.interactive !== false;
  this.ripples = [];
  this.mouseCssX = 0;
  this.mouseCssY = 0;
  this.lastMouseX = -1;
  this.lastMouseY = -1;
  this.mouseInside = false;
  this.fps = 0;
  this.error = null;
  this.ready = false;
  this.gl = null;
  this._destroyed = false;
  this._contextLost = false;
  this._listening = false;
  this._resourcesReady = false;
  this._frame = null;
  this._frameCount = 0;
  this._lastFpsTime = 0;
  this._suppressClickUntil = 0;
  this._reduceMotion = false;
  this.dpr = 1;
  this.cssWidth = 0;
  this.cssHeight = 0;
  this.width = 0;
  this.height = 0;

  if (!canvas || typeof canvas.getContext !== 'function') {
    this._fail('A canvas element is required');
    return;
  }

  var attrs = {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: false
  };
  this.gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
  if (!this.gl) {
    this._fail('WebGL is not supported');
    return;
  }

  this._bindContextEvents();
  this._bindMotionPreference();
  if (!this._initResources()) return;
  if (this.interactive) this._setupInteraction();
  this._listenResize();
  this._resize();
  this._loopBound = this._loop.bind(this);
  this._scheduleNext();
}

FluidEngine.prototype._fail = function (message) {
  this.error = message;
  this.ready = false;
  console.error(message);
};

FluidEngine.prototype._now = function () {
  return performance.now() / 1000;
};

FluidEngine.prototype._devicePoint = function (x, y) {
  var scale = this.dpr > 0 ? this.dpr : 1;
  var height = this.cssHeight > 0 ? this.cssHeight : 0;
  return {
    x: x * scale,
    y: (height - y) * scale
  };
};

FluidEngine.prototype._bindMotionPreference = function () {
  if (typeof root.matchMedia !== 'function') return;
  var mq = root.matchMedia('(prefers-reduced-motion: reduce)');
  var self = this;
  this._reduceMotionMq = mq;
  this._reduceMotion = !!mq.matches;
  this._onReduceMotion = function () {
    self._reduceMotion = !!mq.matches;
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', this._onReduceMotion);
  else if (typeof mq.addListener === 'function') mq.addListener(this._onReduceMotion);
};

FluidEngine.prototype._bindContextEvents = function () {
  var self = this;
  this._onContextLost = function (event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    self._contextLost = true;
    self.ready = false;
    self.bgTexture = null;
    self.bgFBO = null;
    self.buffer = null;
    self.bgProgram = null;
    self.waterProgram = null;
    self.glassProgram = null;
  };
  this._onContextRestored = function () {
    if (self._destroyed) return;
    self._contextLost = false;
    if (!self._initResources()) return;
    self._resize();
  };
  this.canvas.addEventListener('webglcontextlost', this._onContextLost);
  this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
};

FluidEngine.prototype._deleteGLResources = function () {
  var gl = this.gl;
  if (!gl || this._contextLost) {
    this.bgTexture = null;
    this.bgFBO = null;
    this.buffer = null;
    this.bgProgram = null;
    this.waterProgram = null;
    this.glassProgram = null;
    return;
  }
  if (this.bgTexture) gl.deleteTexture(this.bgTexture);
  if (this.bgFBO) gl.deleteFramebuffer(this.bgFBO);
  if (this.buffer) gl.deleteBuffer(this.buffer);
  if (this.bgProgram) gl.deleteProgram(this.bgProgram);
  if (this.waterProgram) gl.deleteProgram(this.waterProgram);
  if (this.glassProgram) gl.deleteProgram(this.glassProgram);
  this.bgTexture = null;
  this.bgFBO = null;
  this.buffer = null;
  this.bgProgram = null;
  this.waterProgram = null;
  this.glassProgram = null;
};

FluidEngine.prototype._initResources = function () {
  var gl = this.gl;
  if (!gl || this._contextLost) return false;
  this._deleteGLResources();

  this.bgProgram = createProgram(gl, VERT_SRC, BG_FRAG);
  this.waterProgram = createProgram(gl, VERT_SRC, WATER_FRAG);
  this.glassProgram = createProgram(gl, VERT_SRC, GLASS_FRAG);

  var activeOk = this.effect === 'glass' ? this.glassProgram : this.waterProgram;
  if (!this.bgProgram || !activeOk) {
    this._resourcesReady = false;
    this.ready = false;
    this._fail(!this.bgProgram
      ? 'Failed to compile the background shader'
      : (this.effect === 'glass'
        ? 'Failed to compile the glass shader'
        : 'Failed to compile the water shader'));
    this._deleteGLResources();
    return false;
  }
  if (!this.waterProgram) console.error('Failed to compile the water shader');
  if (!this.glassProgram) console.error('Failed to compile the glass shader');

  this.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  this._cacheLocations();
  this._resourcesReady = true;
  this.ready = true;
  this.error = null;
  return true;
};

FluidEngine.prototype._cacheLocations = function () {
  var gl = this.gl;
  this._bgLoc = locations(gl, this.bgProgram, ['u_time', 'u_resolution']);
  this._waterLoc = this.waterProgram ? locations(gl, this.waterProgram, [
    'u_time', 'u_resolution', 'u_waveSpeed', 'u_waveSpeedX', 'u_waveSpeedY',
    'u_emboss', 'u_intensity', 'u_frequency', 'u_refraction', 'u_reflGain',
    'u_reflCutoff', 'u_reflIntensity', 'u_waterTint', 'u_texture',
    'u_rippleCount', 'u_mousePos', 'u_mouseInside'
  ]) : null;
  this._rippleLocs = [];
  if (this.waterProgram) {
    for (var i = 0; i < MAX_RIPPLES; i++) {
      this._rippleLocs.push(gl.getUniformLocation(this.waterProgram, 'u_ripples[' + i + ']'));
    }
  }
  this._glassLoc = this.glassProgram ? locations(gl, this.glassProgram, [
    'u_resolution', 'u_texture', 'u_glassW', 'u_glassH', 'u_glassR',
    'u_distortDepth', 'u_distortStrength', 'u_chromaShift', 'u_glassTint',
    'u_mousePos', 'u_mouseInside', 'u_time'
  ]) : null;
};

FluidEngine.prototype._listenResize = function () {
  var self = this;
  this._resizeBound = function () { self._resize(); };
  if (typeof root.ResizeObserver === 'function') {
    this._resizeObserver = new root.ResizeObserver(this._resizeBound);
    this._resizeObserver.observe(this.canvas);
    return;
  }
  if (typeof root.addEventListener === 'function') {
    this._usingWindowResize = true;
    root.addEventListener('resize', this._resizeBound);
  }
};

FluidEngine.prototype._resize = function () {
  if (this._destroyed || !this.gl || this._contextLost) return;
  var rect = this.canvas.getBoundingClientRect();
  var maxTex = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) || 4096;
  var dpr = Math.min(root.devicePixelRatio || 1, MAX_DPR);
  var cssW = rect.width > 0 ? rect.width : 1;
  var cssH = rect.height > 0 ? rect.height : 1;
  var w = Math.max(1, Math.floor(cssW * dpr));
  var h = Math.max(1, Math.floor(cssH * dpr));
  if (w > maxTex || h > maxTex) {
    dpr *= Math.min(maxTex / w, maxTex / h);
    w = Math.max(1, Math.min(maxTex, Math.floor(cssW * dpr)));
    h = Math.max(1, Math.min(maxTex, Math.floor(cssH * dpr)));
  }
  if (this.bgTexture && w === this.width && h === this.height && dpr === this.dpr) return;

  this.dpr = dpr;
  this.cssWidth = cssW;
  this.cssHeight = cssH;
  this.canvas.width = w;
  this.canvas.height = h;
  this.width = w;
  this.height = h;
  // A canvas with no CSS size uses its bitmap as its layout size. Changing the
  // bitmap would then change the next measurement and grow without bound.
  if (rect.width > 0 && rect.height > 0) {
    var laidOut = this.canvas.getBoundingClientRect();
    if (Math.abs(laidOut.width - rect.width) > 0.5 || Math.abs(laidOut.height - rect.height) > 0.5) {
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
    }
  }

  var gl = this.gl;
  if (this.bgTexture) gl.deleteTexture(this.bgTexture);
  if (this.bgFBO) gl.deleteFramebuffer(this.bgFBO);
  this.bgTexture = createTexture(gl, w, h);
  this.bgFBO = this.bgTexture ? createFBO(gl, this.bgTexture) : null;
  if (!this.bgFBO) {
    this._fail('Failed to create the framebuffer');
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.bgFBO);
  var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) {
    this._fail('Failed to create the framebuffer');
    return;
  }
  if (this._resourcesReady) {
    this.ready = true;
    this.error = null;
  }
};

FluidEngine.prototype._cssPos = function (event) {
  var point = event;
  if (event.touches && event.touches.length > 0) point = event.touches[0];
  if (!point || typeof point.clientX !== 'number' || typeof point.clientY !== 'number') return null;
  var rect = this.canvas.getBoundingClientRect();
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top
  };
};

FluidEngine.prototype._markTouch = function () {
  this._suppressClickUntil = performance.now() + 800;
};

FluidEngine.prototype._isGhostMouse = function () {
  return performance.now() < this._suppressClickUntil;
};

FluidEngine.prototype._setupInteraction = function () {
  var self = this;

  this._mousemove = function (event) {
    if (self._isGhostMouse()) return;
    var p = self._cssPos(event);
    if (!p) return;
    self.mouseCssX = p.x;
    self.mouseCssY = p.y;
    self.mouseInside = true;
    if (self.lastMouseX >= 0) {
      var dist = Math.hypot(p.x - self.lastMouseX, p.y - self.lastMouseY);
      if (dist > 4) self.addRipple(p.x, p.y, 0.8 + Math.min(dist / 30, 1.5));
    }
    self.lastMouseX = p.x;
    self.lastMouseY = p.y;
  };
  this._mouseenter = function () {
    if (self._isGhostMouse()) return;
    self.mouseInside = true;
  };
  this._mouseleave = function () {
    self.mouseInside = false;
    self.lastMouseX = -1;
    self.lastMouseY = -1;
  };
  this._click = function (event) {
    if (self._isGhostMouse()) return;
    var p = self._cssPos(event);
    if (!p) return;
    self.addRipple(p.x, p.y, 3.5);
  };
  this._touchmove = function (event) {
    self._markTouch();
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    var p = self._cssPos(event);
    if (!p) return;
    self.mouseCssX = p.x;
    self.mouseCssY = p.y;
    self.mouseInside = true;
    self.addRipple(p.x, p.y, 1.2);
  };
  this._touchstart = function (event) {
    self._markTouch();
    var p = self._cssPos(event);
    if (!p) return;
    self.mouseCssX = p.x;
    self.mouseCssY = p.y;
    self.mouseInside = true;
    self.addRipple(p.x, p.y, 2.5);
  };
  this._touchend = function () {
    self._markTouch();
    self.mouseInside = false;
    self.lastMouseX = -1;
    self.lastMouseY = -1;
  };

  this.canvas.addEventListener('mousemove', this._mousemove);
  this.canvas.addEventListener('mouseenter', this._mouseenter);
  this.canvas.addEventListener('mouseleave', this._mouseleave);
  this.canvas.addEventListener('click', this._click);
  this.canvas.addEventListener('touchmove', this._touchmove, { passive: false });
  this.canvas.addEventListener('touchstart', this._touchstart);
  this.canvas.addEventListener('touchend', this._touchend);
  this._listening = true;
};

FluidEngine.prototype._removeInteraction = function () {
  if (!this.canvas || !this._listening) return;
  this.canvas.removeEventListener('mousemove', this._mousemove);
  this.canvas.removeEventListener('mouseenter', this._mouseenter);
  this.canvas.removeEventListener('mouseleave', this._mouseleave);
  this.canvas.removeEventListener('click', this._click);
  this.canvas.removeEventListener('touchmove', this._touchmove);
  this.canvas.removeEventListener('touchstart', this._touchstart);
  this.canvas.removeEventListener('touchend', this._touchend);
  this._listening = false;
};

FluidEngine.prototype.addRipple = function (x, y, strength) {
  if (this._destroyed) return;
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return;
  var now = this._now();
  var kept = [];
  for (var i = 0; i < this.ripples.length; i++) {
    if (now - this.ripples[i].start < RIPPLE_LIFETIME) kept.push(this.ripples[i]);
  }
  kept.push({
    x: x,
    y: y,
    start: now,
    strength: normalizeStrength(strength)
  });
  if (kept.length > MAX_RIPPLES) kept = kept.slice(kept.length - MAX_RIPPLES);
  this.ripples = kept;
};

FluidEngine.prototype._pruneRipples = function (now) {
  var next = [];
  for (var i = 0; i < this.ripples.length; i++) {
    if (now - this.ripples[i].start < RIPPLE_LIFETIME) next.push(this.ripples[i]);
  }
  this.ripples = next.length === this.ripples.length ? this.ripples : next;
};

FluidEngine.prototype._renderBackground = function (time) {
  var gl = this.gl;
  var loc = this._bgLoc;
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.bgFBO);
  gl.viewport(0, 0, this.width, this.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(this.bgProgram);
  bindQuad(gl, this.buffer, loc._position);
  gl.uniform1f(loc.u_time, time);
  gl.uniform2f(loc.u_resolution, this.width, this.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

FluidEngine.prototype._uploadPointer = function (gl, loc) {
  var pointer = this._devicePoint(this.mouseCssX, this.mouseCssY);
  gl.uniform2f(loc.u_mousePos, pointer.x, pointer.y);
  gl.uniform1f(loc.u_mouseInside, this.mouseInside ? 1 : 0);
};

FluidEngine.prototype._renderWater = function (time) {
  var gl = this.gl;
  var loc = this._waterLoc;
  var params = this.params;
  if (!loc) return;
  var waveScale = this._reduceMotion ? 0 : 1;

  gl.viewport(0, 0, this.width, this.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(this.waterProgram);
  bindQuad(gl, this.buffer, loc._position);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
  gl.uniform1i(loc.u_texture, 0);
  gl.uniform1f(loc.u_time, time);
  gl.uniform2f(loc.u_resolution, this.width, this.height);
  gl.uniform1f(loc.u_waveSpeed, params.waveSpeed * waveScale);
  gl.uniform1f(loc.u_waveSpeedX, params.waveSpeedX * waveScale);
  gl.uniform1f(loc.u_waveSpeedY, params.waveSpeedY * waveScale);
  gl.uniform1f(loc.u_emboss, params.emboss);
  gl.uniform1f(loc.u_intensity, params.intensity);
  gl.uniform1f(loc.u_frequency, params.frequency);
  gl.uniform1f(loc.u_refraction, params.refraction);
  gl.uniform1f(loc.u_reflGain, params.reflGain);
  gl.uniform1f(loc.u_reflCutoff, params.reflCutoff);
  gl.uniform1f(loc.u_reflIntensity, params.reflIntensity);
  gl.uniform1f(loc.u_waterTint, params.waterTint);
  this._uploadPointer(gl, loc);

  var count = Math.min(this.ripples.length, MAX_RIPPLES);
  gl.uniform1i(loc.u_rippleCount, count);
  for (var i = 0; i < MAX_RIPPLES; i++) {
    var rippleLoc = this._rippleLocs[i];
    if (i < count) {
      var ripple = this.ripples[i];
      var point = this._devicePoint(ripple.x, ripple.y);
      gl.uniform4f(rippleLoc, point.x, point.y, ripple.start, ripple.strength);
    } else {
      gl.uniform4f(rippleLoc, 0, 0, -100, 0);
    }
  }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

FluidEngine.prototype._renderGlass = function (time) {
  var gl = this.gl;
  var loc = this._glassLoc;
  var params = this.params;
  if (!loc) return;

  gl.viewport(0, 0, this.width, this.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(this.glassProgram);
  bindQuad(gl, this.buffer, loc._position);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
  gl.uniform1i(loc.u_texture, 0);
  gl.uniform2f(loc.u_resolution, this.width, this.height);
  gl.uniform1f(loc.u_glassW, params.glassW);
  gl.uniform1f(loc.u_glassH, params.glassH);
  gl.uniform1f(loc.u_glassR, params.glassR);
  gl.uniform1f(loc.u_distortDepth, params.distortDepth);
  gl.uniform1f(loc.u_distortStrength, params.distortStrength);
  gl.uniform1f(loc.u_chromaShift, params.chromaShift);
  gl.uniform1f(loc.u_glassTint, params.glassTint);
  this._uploadPointer(gl, loc);
  gl.uniform1f(loc.u_time, this._reduceMotion ? 0 : time);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

FluidEngine.prototype._drawFrame = function () {
  if (!this.bgFBO || !this.bgTexture || !this.buffer) return;
  var time = this._now();
  this._pruneRipples(time);
  this._renderBackground(time);
  if (this.effect === 'glass') this._renderGlass(time);
  else this._renderWater(time);

  this._frameCount++;
  var now = performance.now();
  if (!this._lastFpsTime) this._lastFpsTime = now;
  if (now - this._lastFpsTime >= 1000) {
    this.fps = Math.round(this._frameCount * 1000 / (now - this._lastFpsTime));
    this._frameCount = 0;
    this._lastFpsTime = now;
  }
};

FluidEngine.prototype._scheduleNext = function () {
  if (this._destroyed || typeof root.requestAnimationFrame !== 'function') return;
  this._frame = root.requestAnimationFrame(this._loopBound);
};

FluidEngine.prototype._loop = function () {
  if (this._destroyed) return;
  if (!this._contextLost && this.ready) this._drawFrame();
  this._scheduleNext();
};

FluidEngine.prototype.setParam = function (name, value) {
  if (this._destroyed) return;
  if (!hasOwn(this.params, name)) return;
  if (typeof value !== 'number' || !isFinite(value)) return;
  this.params[name] = value;
};

FluidEngine.prototype.getParam = function (name) {
  return this.params[name];
};

FluidEngine.prototype.setEffect = function (effect) {
  if (this._destroyed) return;
  if (effect !== 'water' && effect !== 'glass') return;
  if (effect === 'water' && !this.waterProgram) return;
  if (effect === 'glass' && !this.glassProgram) return;
  this.effect = effect;
};

FluidEngine.prototype.dispose = function () {
  if (this._destroyed) return;
  this._destroyed = true;
  this.ready = false;
  if (this._frame != null && typeof root.cancelAnimationFrame === 'function') {
    root.cancelAnimationFrame(this._frame);
  }
  if (this._resizeObserver) {
    this._resizeObserver.disconnect();
    this._resizeObserver = null;
  }
  if (this._usingWindowResize && typeof root.removeEventListener === 'function') {
    root.removeEventListener('resize', this._resizeBound);
  }
  if (this._reduceMotionMq && this._onReduceMotion) {
    if (typeof this._reduceMotionMq.removeEventListener === 'function') {
      this._reduceMotionMq.removeEventListener('change', this._onReduceMotion);
    } else if (typeof this._reduceMotionMq.removeListener === 'function') {
      this._reduceMotionMq.removeListener(this._onReduceMotion);
    }
  }
  if (this.canvas && this._onContextLost) {
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
  }
  this._removeInteraction();
  this._deleteGLResources();
  this.ripples = [];
};

FluidEngine.prototype.destroy = function () {
  this.dispose();
};

root.FluidEngine = FluidEngine;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FluidEngine: FluidEngine };
}
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
