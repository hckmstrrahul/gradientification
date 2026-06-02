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

export function randomBlobColor(): string {
  return randomColorHex(0.55, 0.72, 0.12, 0.20);
}

export function presetToConfig(preset: GradientPreset): GradientConfig {
  return {
    blobs: preset.blobs.map(b => ({ ...b, id: String(++blobIdCounter) })),
    noiseDensity: preset.noiseDensity,
    noiseOpacity: preset.noiseOpacity,
  };
}

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// OKLab inverse: OKLCH polar → OKLab Cartesian → linear sRGB → gamma sRGB → hex.
// Same math as the WebGL shader, keeping CPU and GPU color science consistent.
function oklchToHex(L: number, C: number, H: number): string {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const lc = l_ * l_ * l_, mc = m_ * m_ * m_, sc = s_ * s_ * s_;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toGamma = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const r = toGamma(clamp(+4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc));
  const g = toGamma(clamp(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc));
  const bv = toGamma(clamp(-0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc));
  const hex2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex2(r)}${hex2(g)}${hex2(bv)}`;
}

function randomColorHex(minL: number, maxL: number, minC: number, maxC: number): string {
  return oklchToHex(randBetween(minL, maxL), randBetween(minC, maxC), Math.random() * 360);
}

export function randomizeConfig(): GradientConfig {
  const count = Math.floor(randBetween(4, 7));
  const phases = [0, 1.05, 2.09, 3.14, 4.19, 5.24];

  // Dark background blob — near-black with a faint hue tint
  const blobs: GradientBlob[] = [
    {
      id: String(++blobIdCounter),
      color: oklchToHex(randBetween(0.06, 0.12), randBetween(0, 0.03), Math.random() * 360),
      x: 0.5, y: 0.5,
      radius: 1.3,
      amplX: 0, amplY: 0,
      freqX: 0, freqY: 0,
      phaseX: 0, phaseY: 0,
    },
  ];

  // Blobs scatter around a shared centre; radius decreases with each blob
  // so the visual structure mirrors the default preset (prominent → subtle).
  // Centre kept close to mid-screen; spread tightened so blobs always cluster.
  const cx = randBetween(0.42, 0.58);
  const cy = randBetween(0.42, 0.58);
  const clamp01 = (v: number) => Math.max(0.15, Math.min(0.85, v));
  const colorBlobCount = count - 1;

  for (let i = 1; i < count; i++) {
    const t = (i - 1) / Math.max(colorBlobCount - 1, 1); // 0 → 1 across blobs
    const radius = 0.28 - t * 0.10 + randBetween(-0.02, 0.02); // 0.28 → 0.18, small jitter
    blobs.push({
      id: String(++blobIdCounter),
      color: randomColorHex(0.55, 0.72, 0.12, 0.20),
      x: clamp01(cx + randBetween(-0.16, 0.16)),
      y: clamp01(cy + randBetween(-0.16, 0.16)),
      radius,
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
    noiseDensity: randBetween(3, 10),
    noiseOpacity: randBetween(0.1, 0.4),
  };
}

export function randomizeLayout(config: GradientConfig): GradientConfig {
  const phases = [0, 1.05, 2.09, 3.14, 4.19, 5.24];
  // Mirror the default preset's aesthetic: cluster near a shared centre and
  // give blobs a descending size hierarchy (prominent → subtle) instead of a
  // flat random spread, which looks too sparse and uniform.
  const cx = randBetween(0.42, 0.58);
  const cy = randBetween(0.42, 0.58);
  const clamp01 = (v: number) => Math.max(0.15, Math.min(0.85, v));
  const colorBlobCount = Math.max(config.blobs.length - 1, 1);
  // Pick a spread per call so some randomizes are tight clusters and others
  // are loose spreads — variety beats a fixed scatter that always feels same.
  const spread = randBetween(0.14, 0.34);

  return {
    ...config,
    blobs: config.blobs.map((b, i) => {
      if (i === 0) return b;
      const t = (i - 1) / Math.max(colorBlobCount - 1, 1); // 0 → 1 across color blobs
      const radius = 0.28 - t * 0.10 + randBetween(-0.02, 0.02); // 0.28 → 0.18
      return {
        ...b,
        x: clamp01(cx + randBetween(-spread, spread)),
        y: clamp01(cy + randBetween(-spread, spread)),
        radius,
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
  // Recolor every blob. (Previously borrowed colors from a freshly generated
  // config that only had 4–6 blobs, so any blob past that index kept its old
  // color — leaving most blobs unchanged once you added more than ~5.)
  return {
    ...config,
    blobs: config.blobs.map((b, i) => ({
      ...b,
      color: i === 0
        // Background: near-black with a faint hue tint (matches randomizeConfig).
        ? oklchToHex(randBetween(0.06, 0.12), randBetween(0, 0.03), Math.random() * 360)
        : randomColorHex(0.55, 0.72, 0.12, 0.20),
    })),
  };
}

export function generateRandomBlob(existingBlobs: GradientBlob[]): GradientBlob {
  // Pick a hue near existing blob colors using OKLab hue (atan2 on a,b channels)
  const existingHues = existingBlobs.slice(1).map(b => {
    const [, a, bv] = hexToOklab(b.color);
    return (Math.atan2(bv, a) * 180 / Math.PI + 360) % 360;
  });
  const baseHue = existingHues.length
    ? existingHues[Math.floor(Math.random() * existingHues.length)]
    : Math.random() * 360;
  const hue = (baseHue + randBetween(-60, 60) + 360) % 360;

  const phases = [0, 1.05, 2.09, 3.14, 4.19, 5.24];
  const i = existingBlobs.length;
  return {
    id: String(++blobIdCounter),
    color: oklchToHex(randBetween(0.55, 0.72), randBetween(0.12, 0.20), hue),
    x: randBetween(0.1, 0.9),
    y: randBetween(0.1, 0.9),
    radius: randBetween(0.20, 0.38),
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
  return `linear-gradient(in oklch 135deg, ${colors.join(', ')})`;
}

export function generateSVG(
  config: GradientConfig,
  width: number,
  height: number,
): string {
  const blurStdDev = Math.round(Math.min(width, height) * 0.18);
  const bgBlob = config.blobs[0];
  const bgColor = bgBlob?.color ?? '#000';

  const circles = config.blobs.slice(1).map(b => {
    const cx = b.x * width;
    const cy = b.y * height;
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
