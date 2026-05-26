import type { GradientPreset } from './types';

export const PRESETS: GradientPreset[] = [
  {
    id: 'default',
    name: 'Default',
    speed: 1.0,
    noiseDensity: 5,
    noiseOpacity: 0,
    blobs: [
      { color: '#000000', x: 0.5, y: 0.5, radius: 1.3, amplX: 0, amplY: 0, freqX: 0, freqY: 0, phaseX: 0, phaseY: 0 },
      { color: '#4794eb', x: 0.28, y: 0.35, radius: 0.75, amplX: 0.12, amplY: 0.12, freqX: 0.2, freqY: 0.17, phaseX: 0, phaseY: 1.2 },
      { color: '#38eba6', x: 0.72, y: 0.62, radius: 0.48, amplX: 0.1, amplY: 0.1, freqX: 0.27, freqY: 0.22, phaseX: 2.1, phaseY: 4.3 },
      { color: '#9efa52', x: 0.55, y: 0.78, radius: 0.28, amplX: 0.08, amplY: 0.08, freqX: 0.34, freqY: 0.28, phaseX: 4.5, phaseY: 2.0 },
    ],
  },
];

export const DEFAULT_PRESET = PRESETS[0];
