/**
 * FluidEngine — WebGL Liquid Terminal Effect Engine
 * Ported from bea4dev/liquid-terminal-config-shojiwm GLSL shaders
 *
 * Usage:
 *   var engine = new FluidEngine(canvas, { effect: 'water', params: {...} });
 *   engine.addRipple(x, y, strength);
 *   engine.setParam('waveSpeed', 0.3);
 *
 * Effects: 'water' (water surface with waves + ripples), 'glass' (liquid glass distortion)
 *
 * IMPORTANT: For mouse interaction to work, ensure the canvas is not covered by
 * elements with pointer-events:auto. Set pointer-events:none on overlay content.
 */
(function(global){
'use strict';

// ═══════════════════════════════════════════════════════════════════════
//  SHADER SOURCES
// ═══════════════════════════════════════════════════════════════════════

var VERT_SRC = [
'attribute vec2 a_position;',
'varying vec2 v_uv;',
'void main(){',
'  v_uv = a_position * 0.5 + 0.5;',
'  gl_Position = vec4(a_position, 0.0, 1.0);',
'}'
].join('\n');

var BG_FRAG = [
'precision highp float;',
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
'precision highp float;',
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
'uniform vec2 u_ripplePos[20];',
'uniform float u_rippleStart[20];',
'uniform float u_rippleStrength[20];',
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
'    float d = distance(px, u_ripplePos[i]);',
'    float age = t - u_rippleStart[i];',
'    if(age > 0.0 && age < 5.0){',
'      float w = sin(d * 0.06 - age * 8.0) * exp(-d * 0.003) * exp(-age * 0.7);',
'      h += w * u_rippleStrength[i];',
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
'  float center = wc + rc * 0.6;',
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
'precision highp float;',
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

// ═══════════════════════════════════════════════════════════════════════
//  WEBGL UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function createShader(gl, type, src){
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.error('Shader compile error:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function createProgram(gl, vsSrc, fsSrc){
  var vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  var fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if(!vs || !fs) return null;
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
    console.error('Program link error:', gl.getProgramInfoLog(p));
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return p;
}

function createTexture(gl, w, h){
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFBO(gl, tex){
  var fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}

// ═══════════════════════════════════════════════════════════════════════
//  FLUID ENGINE
// ═══════════════════════════════════════════════════════════════════════

var MAX_RIPPLES = 20;

var DEFAULT_PARAMS = {
  // Water surface
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
  // Liquid glass
  glassW: 0,
  glassH: 0,
  glassR: 12,
  distortDepth: 30,
  distortStrength: 0.15,
  chromaShift: 1.5,
  glassTint: 1.0
};

function FluidEngine(canvas, opts){
  opts = opts || {};
  this.canvas = canvas;
  this.gl = canvas.getContext('webgl', {premultipliedAlpha:false, antialias:true, alpha:true})
         || canvas.getContext('experimental-webgl', {premultipliedAlpha:false, antialias:true, alpha:true});
  if(!this.gl){ console.error('WebGL not supported'); return; }

  var gl = this.gl;
  this.bgProgram = createProgram(gl, VERT_SRC, BG_FRAG);
  this.waterProgram = createProgram(gl, VERT_SRC, WATER_FRAG);
  this.glassProgram = createProgram(gl, VERT_SRC, GLASS_FRAG);

  this.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

  this.params = {};
  for(var k in DEFAULT_PARAMS) this.params[k] = DEFAULT_PARAMS[k];
  if(opts.params){
    for(var k2 in opts.params){
      if(this.params.hasOwnProperty(k2)) this.params[k2] = opts.params[k2];
    }
  }

  // FIX: no rippleStartTime offset — use absolute time
  this.ripples = [];
  this.effect = opts.effect || 'water';
  this.mouseInside = false;
  this.mouseX = 0;
  this.mouseY = 0;
  this.lastMouseX = -1;
  this.lastMouseY = -1;
  this._destroyed = false;

  this._setupInteraction();
  this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  this._resize();
  this._resizeBound = this._resize.bind(this);
  window.addEventListener('resize', this._resizeBound);

  this._loopBound = this._loop.bind(this);
  requestAnimationFrame(this._loopBound);

  this._frameCount = 0;
  this._lastFpsTime = performance.now();
  this.fps = 0;
}

FluidEngine.prototype._resize = function(){
  var rect = this.canvas.getBoundingClientRect();
  var w = Math.max(1, Math.floor(rect.width * this.dpr));
  var h = Math.max(1, Math.floor(rect.height * this.dpr));
  this.canvas.width = w;
  this.canvas.height = h;
  this.width = w;
  this.height = h;
  var gl = this.gl;
  if(this.bgTexture) gl.deleteTexture(this.bgTexture);
  if(this.bgFBO) gl.deleteFramebuffer(this.bgFBO);
  this.bgTexture = createTexture(gl, w, h);
  this.bgFBO = createFBO(gl, this.bgTexture);
};

FluidEngine.prototype._setupInteraction = function(){
  var self = this;
  function getPos(e){
    var rect = self.canvas.getBoundingClientRect();
    var x, y;
    if(e.touches && e.touches.length > 0){
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    return { x: x * self.dpr, y: y * self.dpr };
  }

  this._mousemove = function(e){
    var p = getPos(e);
    self.mouseX = p.x;
    self.mouseY = p.y;
    self.mouseInside = true;
    if(self.lastMouseX >= 0){
      var dist = Math.hypot(p.x - self.lastMouseX, p.y - self.lastMouseY);
      if(dist > 4) self.addRipple(p.x, p.y, 0.8 + Math.min(dist / 30, 1.5));
    }
    self.lastMouseX = p.x;
    self.lastMouseY = p.y;
  };
  this._mouseenter = function(){ self.mouseInside = true; };
  this._mouseleave = function(){ self.mouseInside = false; self.lastMouseX = -1; self.lastMouseY = -1; };
  this._click = function(e){ var p = getPos(e); self.addRipple(p.x, p.y, 3.5); };
  this._touchmove = function(e){ e.preventDefault(); var p = getPos(e); self.mouseX = p.x; self.mouseY = p.y; self.mouseInside = true; self.addRipple(p.x, p.y, 1.2); };
  this._touchstart = function(e){ var p = getPos(e); self.mouseX = p.x; self.mouseY = p.y; self.mouseInside = true; self.addRipple(p.x, p.y, 2.5); };
  this._touchend = function(){ self.mouseInside = false; };

  this.canvas.addEventListener('mousemove', this._mousemove);
  this.canvas.addEventListener('mouseenter', this._mouseenter);
  this.canvas.addEventListener('mouseleave', this._mouseleave);
  this.canvas.addEventListener('click', this._click);
  this.canvas.addEventListener('touchmove', this._touchmove, {passive:false});
  this.canvas.addEventListener('touchstart', this._touchstart);
  this.canvas.addEventListener('touchend', this._touchend);
};

// FIX: absolute time — no offset
FluidEngine.prototype.addRipple = function(x, y, strength){
  if(this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
  this.ripples.push({ x: x, y: y, start: performance.now() / 1000, strength: strength || 1.0 });
  var now = performance.now() / 1000;
  this.ripples = this.ripples.filter(function(r){ return now - r.start < 5.0; });
};

FluidEngine.prototype._renderBackground = function(time){
  var gl = this.gl, prog = this.bgProgram;
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.bgFBO);
  gl.viewport(0, 0, this.width, this.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  var posLoc = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), time);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.width, this.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

FluidEngine.prototype._renderWater = function(time){
  var gl = this.gl, prog = this.waterProgram, p = this.params;
  gl.viewport(0, 0, this.width, this.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  var posLoc = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), time);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.width, this.height);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_waveSpeed'), p.waveSpeed);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_waveSpeedX'), p.waveSpeedX);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_waveSpeedY'), p.waveSpeedY);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_emboss'), p.emboss);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_intensity'), p.intensity);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_frequency'), p.frequency);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_refraction'), p.refraction);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_reflGain'), p.reflGain);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_reflCutoff'), p.reflCutoff);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_reflIntensity'), p.reflIntensity);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_waterTint'), p.waterTint);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_mousePos'), this.mouseX, this.mouseY);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_mouseInside'), this.mouseInside ? 1.0 : 0.0);

  var rc = Math.min(this.ripples.length, MAX_RIPPLES);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_rippleCount'), rc);
  for(var i = 0; i < rc; i++){
    var r = this.ripples[i];
    gl.uniform2f(gl.getUniformLocation(prog, 'u_ripplePos[' + i + ']'), r.x, r.y);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_rippleStart[' + i + ']'), r.start);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_rippleStrength[' + i + ']'), r.strength);
  }
  for(var j = rc; j < MAX_RIPPLES; j++){
    gl.uniform2f(gl.getUniformLocation(prog, 'u_ripplePos[' + j + ']'), 0, 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_rippleStart[' + j + ']'), -100);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_rippleStrength[' + j + ']'), 0);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

FluidEngine.prototype._renderGlass = function(time){
  var gl = this.gl, prog = this.glassProgram, p = this.params;
  gl.viewport(0, 0, this.width, this.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  var posLoc = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.width, this.height);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_glassW'), p.glassW);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_glassH'), p.glassH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_glassR'), p.glassR);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_distortDepth'), p.distortDepth);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_distortStrength'), p.distortStrength);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_chromaShift'), p.chromaShift);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_glassTint'), p.glassTint);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_mousePos'), this.mouseX, this.mouseY);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_mouseInside'), this.mouseInside ? 1.0 : 0.0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), time);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

// FIX: absolute time — no startTime, no rippleStartTime
FluidEngine.prototype._loop = function(){
  if(this._destroyed) return;
  var time = performance.now() / 1000;
  this._renderBackground(time);
  if(this.effect === 'water') this._renderWater(time);
  else if(this.effect === 'glass') this._renderGlass(time);

  this._frameCount++;
  var now = performance.now();
  if(now - this._lastFpsTime >= 1000){
    this.fps = Math.round(this._frameCount * 1000 / (now - this._lastFpsTime));
    this._frameCount = 0;
    this._lastFpsTime = now;
  }

  requestAnimationFrame(this._loopBound);
};

FluidEngine.prototype.setParam = function(name, value){
  if(this.params.hasOwnProperty(name)) this.params[name] = value;
};

FluidEngine.prototype.getParam = function(name){
  return this.params[name];
};

FluidEngine.prototype.setEffect = function(effect){
  this.effect = effect;
};

FluidEngine.prototype.destroy = function(){
  this._destroyed = true;
  window.removeEventListener('resize', this._resizeBound);
  this.canvas.removeEventListener('mousemove', this._mousemove);
  this.canvas.removeEventListener('mouseenter', this._mouseenter);
  this.canvas.removeEventListener('mouseleave', this._mouseleave);
  this.canvas.removeEventListener('click', this._click);
  this.canvas.removeEventListener('touchmove', this._touchmove);
  this.canvas.removeEventListener('touchstart', this._touchstart);
  this.canvas.removeEventListener('touchend', this._touchend);
  var gl = this.gl;
  if(gl){
    if(this.bgTexture) gl.deleteTexture(this.bgTexture);
    if(this.bgFBO) gl.deleteFramebuffer(this.bgFBO);
    if(this.buffer) gl.deleteBuffer(this.buffer);
    if(this.bgProgram) gl.deleteProgram(this.bgProgram);
    if(this.waterProgram) gl.deleteProgram(this.waterProgram);
    if(this.glassProgram) gl.deleteProgram(this.glassProgram);
  }
};

// Expose
global.FluidEngine = FluidEngine;
global.FluidEngineDefaults = DEFAULT_PARAMS;

})(typeof window !== 'undefined' ? window : this);
