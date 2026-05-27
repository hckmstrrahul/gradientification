'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GradientBlob, GradientConfig, DownloadFormat, DownloadScale } from '@/lib/types';
import { WebGLGradient } from '@/lib/webgl-gradient';
import { presetToConfig, randomizeLayout, randomizeColors, generateSVG } from '@/lib/gradient-utils';
import { DEFAULT_PRESET, PRESETS } from '@/lib/presets';

export function useGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLGradient | null>(null);
  const [config, setConfigState] = useState<GradientConfig>(() => presetToConfig(DEFAULT_PRESET));
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_PRESET.id);
  const elapsedRef = useRef(0);

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

  // Pointer-driven blob drag. On pointerdown the nearest non-background blob
  // to the click is picked; while held it follows the cursor with a preserved
  // offset (so it doesn't jump). Pointer capture keeps the drag alive even if
  // the cursor leaves the canvas. Cursor styles signal the affordance.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let grabbedId: string | null = null;
    let lastGrabbedId: string | null = null;
    let activePointerId: number | null = null;
    let offsetX = 0;
    let offsetY = 0;

    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';

    const toUv = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        // Flip y: shader space has origin at bottom-left
        y: 1 - (clientY - rect.top) / rect.height,
        aspect: rect.width / rect.height,
      };
    };

    const handleDown = (e: PointerEvent) => {
      const { x, y, aspect } = toUv(e.clientX, e.clientY);
      setConfig(prev => {
        let bestDist = Infinity;
        let picked: GradientBlob | null = null;
        for (let i = 1; i < prev.blobs.length; i++) {
          const b = prev.blobs[i];
          const dx = (x - b.x) * aspect;
          const dy = y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDist) { bestDist = d2; picked = b; }
        }
        if (!picked) return prev;
        grabbedId = picked.id;
        lastGrabbedId = picked.id;
        activePointerId = e.pointerId;
        offsetX = picked.x - x;
        offsetY = picked.y - y;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        return prev;
      });
    };

    const handleMove = (e: PointerEvent) => {
      if (grabbedId === null || e.pointerId !== activePointerId) return;
      const { x, y } = toUv(e.clientX, e.clientY);
      const id = grabbedId;
      const targetX = Math.max(0, Math.min(1, x + offsetX));
      const targetY = Math.max(0, Math.min(1, y + offsetY));
      setConfig(prev => ({
        ...prev,
        blobs: prev.blobs.map(b => b.id === id ? { ...b, x: targetX, y: targetY } : b),
      }));
    };

    const release = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      grabbedId = null;
      activePointerId = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
    };

    // Scroll/swipe on the canvas resizes the most recently grabbed blob.
    // Multiplicative scaling so trackpad ticks and wheel clicks both feel
    // proportional regardless of the blob's current size. Scroll up = grow.
    const handleWheel = (e: WheelEvent) => {
      if (!lastGrabbedId) return;
      e.preventDefault();
      const id = lastGrabbedId;
      const factor = Math.exp(-e.deltaY * 0.002);
      setConfig(prev => ({
        ...prev,
        blobs: prev.blobs.map(b =>
          b.id === id
            ? { ...b, radius: Math.max(0.05, Math.min(2, b.radius * factor)) }
            : b,
        ),
      }));
    };

    canvas.addEventListener('pointerdown', handleDown);
    canvas.addEventListener('pointermove', handleMove);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [setConfig]);

  const download = useCallback(
    (format: DownloadFormat, scale: DownloadScale, quality = 1.0) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = Math.round(canvas.clientWidth * scale);
      const h = Math.round(canvas.clientHeight * scale);
      const name = `gradient-${Date.now()}`;

      if (format === 'svg') {
        const svg = generateSVG(config, w, h);
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
    config,
    setConfig,
    activePresetId,
    applyPreset,
    randomize,
    shuffleColors,
    reset,
    download,
  };
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}
