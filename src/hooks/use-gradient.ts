'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GradientConfig, DownloadFormat, DownloadScale } from '@/lib/types';
import { WebGLGradient } from '@/lib/webgl-gradient';
import { presetToConfig, randomizeLayout, randomizeColors, generateSVG } from '@/lib/gradient-utils';
import { DEFAULT_PRESET, PRESETS } from '@/lib/presets';

export function useGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLGradient | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [config, setConfigState] = useState<GradientConfig>(() => presetToConfig(DEFAULT_PRESET));
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_PRESET.id);
  const elapsedRef = useRef(0); // transient — not needed as React state

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: WebGLGradient;
    try {
      engine = new WebGLGradient(canvas, presetToConfig(DEFAULT_PRESET), (e) => {
        elapsedRef.current = e;
      });
      engine.start();
      engineRef.current = engine;
    } catch {
      // WebGL2 unavailable
    }
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // Run only once — config changes go through engineRef.setConfig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const next = presetToConfig(preset);
    setConfigState(next);
    engineRef.current?.setConfig(next);
    setActivePresetId(presetId);
  }, []);

  const setConfig = useCallback((updater: GradientConfig | ((prev: GradientConfig) => GradientConfig)) => {
    setConfigState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      engineRef.current?.setConfig(next);
      return next;
    });
    setActivePresetId('');
  }, []);

  const randomize = useCallback(() => {
    setConfigState(prev => {
      const next = randomizeLayout(prev);
      engineRef.current?.setConfig(next);
      return next;
    });
    setActivePresetId('');
  }, []);

  const shuffleColors = useCallback(() => {
    setConfigState(prev => {
      const next = randomizeColors(prev);
      engineRef.current?.setConfig(next);
      return next;
    });
    setActivePresetId('');
  }, []);

  const reset = useCallback(() => {
    const next = presetToConfig(DEFAULT_PRESET);
    setConfigState(next);
    engineRef.current?.setConfig(next);
    setActivePresetId(DEFAULT_PRESET.id);
  }, []);

  const play = useCallback(() => {
    engineRef.current?.start();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    // Read from ref to avoid stale closure
    if (engineRef.current) {
      const playing = !isPlaying;
      if (playing) {
        engineRef.current.start();
        setIsPlaying(true);
      } else {
        engineRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

  const download = useCallback(
    (format: DownloadFormat, scale: DownloadScale, quality = 1.0) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = Math.round(canvas.clientWidth * scale);
      const h = Math.round(canvas.clientHeight * scale);
      const name = `gradient-${Date.now()}`;

      if (format === 'svg') {
        const svg = generateSVG(config, elapsedRef.current, w, h);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${name}.svg`);
        URL.revokeObjectURL(url);
        return;
      }

      const dataUrl = engineRef.current?.captureDataURL(w, h, format, quality);
      if (dataUrl) triggerDownload(dataUrl, `${name}.${format}`);
    },
    [config],
  );

  return {
    canvasRef,
    isPlaying,
    config,
    setConfig,
    activePresetId,
    applyPreset,
    randomize,
    shuffleColors,
    reset,
    togglePlay,
    download,
  };
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}
