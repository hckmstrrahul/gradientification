export interface GradientBlob {
  id: string;
  color: string;
  x: number;      // 0–1 base position
  y: number;
  radius: number; // blob spread, 0.05–2.0
  amplX: number;  // movement amplitude (same value used for Y)
  amplY: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
}

export interface GradientConfig {
  blobs: GradientBlob[];
  speed: number;
  noiseDensity: number; // 1–20, grain cell size
  noiseOpacity: number; // 0–1
}

export type DownloadFormat = 'png' | 'webp' | 'jpg' | 'svg';
export type DownloadScale = 1 | 2 | 4;

export interface GradientPreset {
  id: string;
  name: string;
  blobs: Omit<GradientBlob, 'id'>[];
  speed: number;
  noiseDensity: number;
  noiseOpacity: number;
}
