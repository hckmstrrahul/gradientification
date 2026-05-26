import type { GradientBlob, GradientConfig, GradientPreset } from './types';
import { PRESETS } from './presets';

let blobIdCounter = 0;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function hexToOklab(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const rl = toLinear((n >> 16 & 255) / 255);
  const gl = toLinear((n >> 8  & 255) / 255);
  const bl = toLinear((n       & 255) / 255);

  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function presetToConfig(preset: GradientPreset): GradientConfig {
  return {
    blobs: preset.blobs.map(b => ({ ...b, id: String(++blobIdCounter) })),
    speed: preset.speed,
    noiseDensity: preset.noiseDensity,
    noiseOpacity: preset.noiseOpacity,
  };
}

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomHex(): string {
  const hue = Math.floor(Math.random() * 360);
  const sat = Math.floor(randBetween(50, 90));
  const light = Math.floor(randBetween(40, 80));
  return hslToHex(hue, sat, light);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function randomizeConfig(): GradientConfig {
  const count = Math.floor(randBetween(4, 7));
  const phases = [0, 1.05, 2.09, 3.14, 4.19, 5.24];

  // Dark background blob
  const bgHue = Math.floor(Math.random() * 360);
  const blobs: GradientBlob[] = [
    {
      id: String(++blobIdCounter),
      color: hslToHex(bgHue, 60, 8),
      x: 0.5, y: 0.5,
      radius: 1.3,
      amplX: 0, amplY: 0,
      freqX: 0, freqY: 0,
      phaseX: 0, phaseY: 0,
    },
  ];

  for (let i = 1; i < count; i++) {
    blobs.push({
      id: String(++blobIdCounter),
      color: randomHex(),
      x: randBetween(0.1, 0.9),
      y: randBetween(0.1, 0.9),
      radius: randBetween(0.35, 0.55),
      amplX: randBetween(0.07, 0.14),
      amplY: randBetween(0.07, 0.14),
      freqX: randBetween(0.15, 0.32),
      freqY: randBetween(0.15, 0.32),
      phaseX: phases[i % phases.length] + randBetween(-0.3, 0.3),
      phaseY: phases[(i + 2) % phases.length] + randBetween(-0.3, 0.3),
    });
  }

  return {
    blobs,
    speed: randBetween(0.7, 1.2),
    noiseDensity: randBetween(3, 10),
    noiseOpacity: randBetween(0.1, 0.4),
  };
}

export function randomizeLayout(config: GradientConfig): GradientConfig {
  const phases = [0, 1.05, 2.09, 3.14, 4.19, 5.24];
  return {
    ...config,
    blobs: config.blobs.map((b, i) => {
      if (i === 0) return b;
      return {
        ...b,
        x: randBetween(0.1, 0.9),
        y: randBetween(0.1, 0.9),
        radius: randBetween(0.35, 0.55),
        amplX: randBetween(0.07, 0.14),
        amplY: randBetween(0.07, 0.14),
        freqX: randBetween(0.15, 0.32),
        freqY: randBetween(0.15, 0.32),
        phaseX: phases[i % phases.length] + randBetween(-0.3, 0.3),
        phaseY: phases[(i + 2) % phases.length] + randBetween(-0.3, 0.3),
      };
    }),
  };
}

export function randomizeColors(config: GradientConfig): GradientConfig {
  const newFull = randomizeConfig();
  return {
    ...config,
    blobs: config.blobs.map((b, i) => ({
      ...b,
      color: newFull.blobs[i]?.color ?? b.color,
    })),
  };
}

export function generateRandomBlob(existingBlobs: GradientBlob[]): GradientBlob {
  // Pick a hue near existing blob colors for visual harmony
  const existingHues = existingBlobs.slice(1).map(b => {
    const n = parseInt(b.color.replace('#', ''), 16);
    const r = (n >> 16 & 255) / 255;
    const g = (n >> 8 & 255) / 255;
    const bv = (n & 255) / 255;
    const max = Math.max(r, g, bv);
    const min = Math.min(r, g, bv);
    const d = max - min;
    if (d === 0) return 0;
    let h = max === r ? ((g - bv) / d) % 6 : max === g ? (bv - r) / d + 2 : (r - g) / d + 4;
    return Math.round(h * 60 + 360) % 360;
  });
  const baseHue = existingHues.length
    ? existingHues[Math.floor(Math.random() * existingHues.length)]
    : Math.floor(Math.random() * 360);
  const hue = (baseHue + randBetween(-60, 60) + 360) % 360;

  const phases = [0, 1.05, 2.09, 3.14, 4.19, 5.24];
  const i = existingBlobs.length;
  return {
    id: String(++blobIdCounter),
    color: hslToHex(Math.round(hue), Math.floor(randBetween(55, 85)), Math.floor(randBetween(45, 75))),
    x: randBetween(0.1, 0.9),
    y: randBetween(0.1, 0.9),
    radius: randBetween(0.35, 0.55),
    amplX: randBetween(0.07, 0.14),
    amplY: randBetween(0.07, 0.14),
    freqX: randBetween(0.15, 0.32),
    freqY: randBetween(0.15, 0.32),
    phaseX: phases[i % phases.length] + randBetween(-0.3, 0.3),
    phaseY: phases[(i + 2) % phases.length] + randBetween(-0.3, 0.3),
  };
}

export function presetCSSGradient(preset: GradientPreset): string {
  const colors = preset.blobs.slice(1, 4).map(b => b.color);
  if (colors.length < 2) return preset.blobs[0]?.color ?? '#000';
  return `linear-gradient(135deg, ${colors.join(', ')})`;
}

export function generateSVG(
  config: GradientConfig,
  elapsed: number,
  width: number,
  height: number,
): string {
  const blurStdDev = Math.round(Math.min(width, height) * 0.18);
  const bgBlob = config.blobs[0];
  const bgColor = bgBlob?.color ?? '#000';

  const circles = config.blobs.slice(1).map(b => {
    const t = elapsed * config.speed;
    const cx = (b.x + b.amplX * Math.sin(b.freqX * t + b.phaseX)) * width;
    const cy = (b.y + b.amplY * Math.cos(b.freqY * t + b.phaseY)) * height;
    const r = b.radius * Math.min(width, height) * 0.6;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${b.color}" opacity="0.85"/>`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${blurStdDev}"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <g filter="url(#blur)">
    ${circles}
  </g>
</svg>`;
}
