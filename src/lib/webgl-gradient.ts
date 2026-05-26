import type { GradientConfig } from './types';
import { hexToOklab } from './gradient-utils';

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform int u_count;
uniform vec2 u_pos[8];
uniform vec3 u_lab[8];  // OKLab: L, a, b
uniform float u_rad[8];
uniform float u_noiseDensity;
uniform float u_noiseOpacity;

out vec4 outColor;

// OKLab → linear sRGB (Björn Ottosson)
vec3 oklabToLinear(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_*l_*l_;
  float m = m_*m_*m_;
  float s = s_*s_*s_;
  return vec3(
    +4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
  );
}

// Linear sRGB → gamma sRGB (IEC 61966-2-1)
float toGamma(float v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * pow(max(v, 0.0), 1.0 / 2.4) - 0.055;
}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Box-Muller: two uniform → one Gaussian sample, mapped to [0,1]
float gaussianNoise(vec2 coord) {
  float u1 = rand(coord);
  float u2 = rand(coord * 1.6180339887 + vec2(47.53, 19.19));
  float g = sqrt(-2.0 * log(max(u1, 0.0001))) * cos(6.28318530718 * u2);
  return clamp(g * 0.25 + 0.5, 0.0, 1.0);
}

// Photoshop-style overlay blend (per channel)
vec3 overlay(vec3 base, vec3 blend) {
  vec3 dark  = 2.0 * base * blend;
  vec3 light = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
  return mix(dark, light, step(0.5, base));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;

  // Blend in OKLab — perceptually uniform, no banding
  vec3 totalLab = vec3(0.0);
  float totalWeight = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= u_count) break;
    vec2 d = vec2((uv.x - u_pos[i].x) * aspect, uv.y - u_pos[i].y);
    float dist2 = dot(d, d);
    float r = u_rad[i];
    float w = exp(-dist2 / (r * r));
    totalLab += u_lab[i] * w;
    totalWeight += w;
  }

  vec3 lab = totalWeight > 0.001 ? totalLab / totalWeight : vec3(0.0);

  // OKLab → linear sRGB → gamma sRGB
  vec3 linear = oklabToLinear(lab);
  vec3 color = vec3(toGamma(linear.r), toGamma(linear.g), toGamma(linear.b));

  // Gaussian noise — animated, density-scaled in pixel space
  vec2 noiseCoord = gl_FragCoord.xy * (u_noiseDensity * 0.1) + fract(u_time * 0.073);
  float g = gaussianNoise(noiseCoord);
  vec3 noised = overlay(color, vec3(g));
  color = mix(color, noised, u_noiseOpacity);

  color = clamp(color, 0.0, 1.0);
  outColor = vec4(color, 1.0);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
  }
  return shader;
}

function buildProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'Program link failed');
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

export class WebGLGradient {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private animId = 0;
  private startedAt = performance.now();
  private pausedElapsed = 0;
  private paused = false;
  private config: GradientConfig;
  private onFrame?: (elapsed: number) => void;

  constructor(canvas: HTMLCanvasElement, config: GradientConfig, onFrame?: (e: number) => void) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.config = config;
    this.onFrame = onFrame;

    this.prog = buildProgram(gl);

    // Fullscreen quad (two triangles)
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const loc = gl.getAttribLocation(this.prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  setConfig(config: GradientConfig) {
    this.config = config;
  }

  getElapsed(): number {
    if (this.paused) return this.pausedElapsed;
    return (performance.now() - this.startedAt) / 1000;
  }

  renderFrame(elapsed: number, explicitW?: number, explicitH?: number) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    let w: number, h: number;
    if (explicitW !== undefined && explicitH !== undefined) {
      w = explicitW;
      h = explicitH;
    } else {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      w = Math.round(canvas.clientWidth * dpr);
      h = Math.round(canvas.clientHeight * dpr);
    }
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);

    const { blobs, speed, noiseDensity, noiseOpacity } = this.config;
    const count = Math.min(blobs.length, 8);
    const t = elapsed * speed;

    const positions = new Float32Array(16);
    const colors = new Float32Array(24);
    const radii = new Float32Array(8);

    for (let i = 0; i < count; i++) {
      const b = blobs[i];
      positions[i * 2] = b.x + b.amplX * Math.sin(b.freqX * t + b.phaseX);
      positions[i * 2 + 1] = b.y + b.amplY * Math.cos(b.freqY * t + b.phaseY);
      const [L, a, bv] = hexToOklab(b.color);
      colors[i * 3] = L; colors[i * 3 + 1] = a; colors[i * 3 + 2] = bv;
      radii[i] = b.radius;
    }

    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);

    const u = (name: string) => gl.getUniformLocation(this.prog, name);
    gl.uniform2f(u('u_res'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(u('u_time'), elapsed);
    gl.uniform1i(u('u_count'), count);
    gl.uniform2fv(u('u_pos'), positions);
    gl.uniform3fv(u('u_lab'), colors);
    gl.uniform1fv(u('u_rad'), radii);
    gl.uniform1f(u('u_noiseDensity'), noiseDensity);
    gl.uniform1f(u('u_noiseOpacity'), noiseOpacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  start() {
    this.paused = false;
    this.startedAt = performance.now() - this.pausedElapsed * 1000;
    const loop = () => {
      if (this.paused) return;
      const elapsed = (performance.now() - this.startedAt) / 1000;
      this.renderFrame(elapsed);
      this.onFrame?.(elapsed);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  pause() {
    this.paused = true;
    this.pausedElapsed = (performance.now() - this.startedAt) / 1000;
    cancelAnimationFrame(this.animId);
  }

  destroy() {
    cancelAnimationFrame(this.animId);
    this.gl.deleteProgram(this.prog);
    this.gl.deleteVertexArray(this.vao);
  }

  captureDataURL(
    width: number,
    height: number,
    format: 'png' | 'webp' | 'jpg',
    quality: number,
  ): string {
    const canvas = this.gl.canvas as HTMLCanvasElement;

    // Render at target resolution on the same canvas (preserveDrawingBuffer = true).
    // The next animation frame restores display size automatically.
    this.renderFrame(this.getElapsed(), width, height);
    this.gl.finish(); // ensure GPU is done before readback

    const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    return canvas.toDataURL(mime, quality);
  }
}
