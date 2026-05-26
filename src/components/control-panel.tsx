'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { generateRandomBlob } from '@/lib/gradient-utils';
import type { GradientConfig, DownloadFormat, DownloadScale, GradientBlob } from '@/lib/types';

interface ControlPanelProps {
  isPlaying: boolean;
  config: GradientConfig;
  activePresetId: string;
  onSetConfig: (updater: GradientConfig | ((prev: GradientConfig) => GradientConfig)) => void;
  onApplyPreset: (id: string) => void;
  onRandomize: () => void;
  onShuffleColors: () => void;
  onReset: () => void;
  onTogglePlay: () => void;
  onDownload: (format: DownloadFormat, scale: DownloadScale, quality?: number) => void;
}
// activePresetId / onApplyPreset kept for hook compatibility but not used in UI

const FORMATS: { label: string; value: DownloadFormat }[] = [
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'JPG', value: 'jpg' },
  { label: 'SVG', value: 'svg' },
];

const SCALES: { label: string; value: DownloadScale }[] = [
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
];

export default function ControlPanel({
  isPlaying,
  config,
  activePresetId,
  onSetConfig,
  onApplyPreset,
  onRandomize,
  onShuffleColors,
  onReset,
  onTogglePlay,
  onDownload,
}: ControlPanelProps) {
  const [open, setOpen] = useState(true);
  const [format, setFormat] = useState<DownloadFormat>('png');
  const [scale, setScale] = useState<DownloadScale>(2);
  const [advanced, setAdvanced] = useState(false);
  const savedNoiseOpacity = useRef(0.4);

  const updateBlob = useCallback(
    (id: string, patch: Partial<GradientBlob>) => {
      onSetConfig(prev => ({
        ...prev,
        blobs: prev.blobs.map(b => (b.id === id ? { ...b, ...patch } : b)),
      }));
    },
    [onSetConfig],
  );

  const addBlob = useCallback(() => {
    onSetConfig(prev => ({
      ...prev,
      blobs: [...prev.blobs, generateRandomBlob(prev.blobs)],
    }));
  }, [onSetConfig]);

  const removeLastBlob = useCallback(() => {
    onSetConfig(prev =>
      prev.blobs.length > 2 ? { ...prev, blobs: prev.blobs.slice(0, -1) } : prev,
    );
  }, [onSetConfig]);

  const updateSpeed = useCallback(
    (v: number | readonly number[]) => {
      const val = Array.isArray(v) ? v[0] : v;
      onSetConfig(prev => ({ ...prev, speed: val }));
    },
    [onSetConfig],
  );

  const updateNoiseDensity = useCallback(
    (v: number | readonly number[]) => {
      const val = Array.isArray(v) ? v[0] : v;
      onSetConfig(prev => ({ ...prev, noiseDensity: val }));
    },
    [onSetConfig],
  );

  const updateNoiseOpacity = useCallback(
    (v: number | readonly number[]) => {
      const val = Array.isArray(v) ? v[0] : v;
      if (val > 0) savedNoiseOpacity.current = val;
      onSetConfig(prev => ({ ...prev, noiseOpacity: val }));
    },
    [onSetConfig],
  );

  const grainEnabled = config.noiseOpacity > 0;
  const toggleGrain = useCallback(() => {
    if (grainEnabled) {
      savedNoiseOpacity.current = config.noiseOpacity;
      onSetConfig(prev => ({ ...prev, noiseOpacity: 0 }));
    } else {
      onSetConfig(prev => ({ ...prev, noiseOpacity: savedNoiseOpacity.current }));
    }
  }, [grainEnabled, config.noiseOpacity, onSetConfig]);

  return (
    <>
      {/* Toggle button */}
      <button
        aria-label={open ? 'Collapse controls' : 'Expand controls'}
        onClick={() => setOpen(o => !o)}
        className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white hover:bg-white/20 transition-colors"
      >
        {open ? <ChevronRight /> : <ChevronLeft />}
      </button>

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full z-40 flex flex-col bg-zinc-950/90 backdrop-blur-xl border-l border-white/8 transition-all duration-300 ease-in-out overflow-hidden ${
          open ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden w-72 scrollbar-hide">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 pt-5 pb-4">
            <span className="text-white font-semibold tracking-tight text-sm">Gradientification</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-white/10 text-zinc-400 border-0">
              Beta
            </Badge>
          </div>
          <Separator className="bg-white/8 mx-5 w-auto" />

          <div className="flex flex-col gap-6 px-5 py-5">
            {/* Animation */}
            <section>
              <SectionLabel>Animation</SectionLabel>
              <div className="mt-3 space-y-4">
                <SliderRow
                  label="Speed"
                  value={config.speed}
                  min={0.1}
                  max={3}
                  step={0.05}
                  format={v => `${v.toFixed(2)}×`}
                  onChange={updateSpeed}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={onTogglePlay}
                  >
                    {isPlaying ? <><PauseIcon />Pause</> : <><PlayIcon />Play</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={onRandomize}
                  >
                    <DiceIcon />Randomize
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={onShuffleColors}
                  >
                    <SwatchIcon />Colors
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs bg-white/5 border-white/15 text-zinc-400 hover:bg-white/10 hover:text-white"
                    onClick={onReset}
                  >
                    <ResetIcon />Reset
                  </Button>
                </div>
              </div>
            </section>

            <Separator className="bg-white/8" />

            {/* Color blobs */}
            <section>
              <div className="flex items-center justify-between">
                <SectionLabel>Color Blobs</SectionLabel>
                <div className="flex items-center gap-2">
                  <PillToggle on={advanced} onToggle={() => setAdvanced(a => !a)} label="Params" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={removeLastBlob}
                      disabled={config.blobs.length <= 2}
                      className="h-5 w-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm leading-none"
                      aria-label="Remove blob"
                    >
                      −
                    </button>
                    <span className="text-[11px] font-mono text-zinc-400 w-5 text-center">
                      {config.blobs.length - 1}
                    </span>
                    <button
                      onClick={addBlob}
                      disabled={config.blobs.length >= 8}
                      className="h-5 w-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm leading-none"
                      aria-label="Add blob"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {config.blobs.map((blob, i) => (
                  <BlobRow
                    key={blob.id}
                    blob={blob}
                    label={i === 0 ? 'Background' : `Blob ${i}`}
                    isBackground={i === 0}
                    advanced={advanced}
                    onChange={patch => updateBlob(blob.id, patch)}
                  />
                ))}
              </div>
            </section>

            <Separator className="bg-white/8" />

            {/* Noise */}
            <section>
              <div className="flex items-center justify-between">
                <SectionLabel>Grain</SectionLabel>
                <PillToggle on={grainEnabled} onToggle={toggleGrain} />
              </div>
              {grainEnabled && (
                <div className="mt-3 space-y-4">
                  <SliderRow
                    label="Density"
                    value={config.noiseDensity}
                    min={1}
                    max={20}
                    step={0.5}
                    format={v => v.toFixed(1)}
                    onChange={updateNoiseDensity}
                  />
                  <SliderRow
                    label="Opacity"
                    value={config.noiseOpacity}
                    min={0.01}
                    max={1}
                    step={0.01}
                    format={v => `${Math.round(v * 100)}%`}
                    onChange={updateNoiseOpacity}
                  />
                </div>
              )}
            </section>

            <Separator className="bg-white/8" />

            {/* Download */}
            <section className="pb-4">
              <SectionLabel>Download</SectionLabel>
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-[11px] text-zinc-500 mb-1.5 block">Format</Label>
                  <div className="flex gap-1.5">
                    {FORMATS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setFormat(f.value)}
                        className={`flex-1 h-7 rounded text-[11px] font-medium transition-colors ${
                          format === f.value
                            ? 'bg-white text-black'
                            : 'bg-white/8 text-zinc-400 hover:bg-white/12 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-zinc-500 mb-1.5 block">Resolution</Label>
                  <div className="flex gap-1.5">
                    {SCALES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setScale(s.value)}
                        className={`flex-1 h-7 rounded text-[11px] font-medium transition-colors ${
                          scale === s.value
                            ? 'bg-white text-black'
                            : 'bg-white/8 text-zinc-400 hover:bg-white/12 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full h-9 text-xs font-medium bg-white text-black hover:bg-zinc-100"
                  onClick={() => onDownload(format, scale)}
                >
                  <DownloadIcon />
                  Download .{format}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{children}</p>
  );
}

interface PillToggleProps {
  on: boolean;
  onToggle: () => void;
  label?: string;
}

function PillToggle({ on, onToggle, label = 'On' }: PillToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`relative h-5 flex items-center rounded-full transition-colors duration-200 ${
        label ? 'gap-1.5 px-2' : 'w-8 justify-center'
      } ${on ? 'bg-white/20 text-white' : 'bg-white/6 text-zinc-500 hover:bg-white/10 hover:text-zinc-400'}`}
      aria-label={label ? `Toggle ${label}` : 'Toggle'}
    >
      <span className={`block h-1.5 w-1.5 rounded-full flex-shrink-0 transition-colors duration-200 ${on ? 'bg-white' : 'bg-zinc-600'}`} />
      {label && <span className="text-[10px] font-medium leading-none">{label}</span>}
    </button>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (value: number | readonly number[]) => void;
}

function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <Label className="text-[11px] text-zinc-400">{label}</Label>
        <span className="text-[11px] font-mono text-zinc-400">{format(value)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={onChange}
      />
    </div>
  );
}

interface BlobRowProps {
  blob: GradientBlob;
  label: string;
  isBackground: boolean;
  advanced: boolean;
  onChange: (patch: Partial<GradientBlob>) => void;
}

function BlobRow({ blob, label, isBackground, advanced, onChange }: BlobRowProps) {
  const [hexDraft, setHexDraft] = useState(blob.color);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setHexDraft(blob.color);
  }, [blob.color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val && !val.startsWith('#')) val = '#' + val;
    val = val.slice(0, 7);
    setHexDraft(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange({ color: val.toLowerCase() });
  };

  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ color: e.target.value });
    setHexDraft(e.target.value);
  };

  const sliderVal = (v: number | readonly number[]) => Array.isArray(v) ? v[0] : v;

  const seedBlob = () => {
    const rnd = (min: number, max: number) => min + Math.random() * (max - min);
    if (isBackground) {
      onChange({ x: rnd(0.1, 0.9), y: rnd(0.1, 0.9) });
    } else {
      const ampl = rnd(0.05, 0.2);
      onChange({
        x: rnd(0.1, 0.9),
        y: rnd(0.1, 0.9),
        radius: rnd(0.2, 1.5),
        amplX: ampl,
        amplY: ampl,
        phaseX: rnd(0, 6.28),
        phaseY: rnd(0, 6.28),
      });
    }
  };

  return (
    <div className="space-y-2 pb-2.5 border-b border-white/5 last:border-0">
      {/* Color row */}
      <div className="flex items-center gap-2">
        <label title="Open color picker" className="relative flex-shrink-0 h-6 w-6 rounded-full cursor-pointer overflow-hidden border border-white/15 hover:border-white/30 transition-colors">
          <span className="absolute inset-0 rounded-full" style={{ background: blob.color }} />
          <input type="color" value={blob.color} onChange={handleColorPicker} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </label>
        <input
          type="text"
          value={hexDraft}
          maxLength={7}
          spellCheck={false}
          onFocus={() => { isFocused.current = true; }}
          onBlur={() => { isFocused.current = false; if (!/^#[0-9A-Fa-f]{6}$/.test(hexDraft)) setHexDraft(blob.color); }}
          onChange={handleHexChange}
          className="w-20 h-6 bg-white/5 border border-white/10 rounded px-2 text-[11px] font-mono text-zinc-200 focus:border-white/30 focus:outline-none focus:bg-white/8 transition-colors"
        />
        <span className="text-[11px] text-zinc-500 flex-1 truncate">{label}</span>
        <button
          onClick={seedBlob}
          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/8 transition-colors"
          aria-label="Randomize blob position and size"
          title="Randomize placement"
        >
          <BlobDiceIcon />
        </button>
      </div>

      {/* Advanced: Position X/Y + Size/Move */}
      {advanced && (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-8">
            <MiniSlider label="X" value={blob.x} min={0} max={1} step={0.01}
              onChange={v => onChange({ x: sliderVal(v) })} />
            <MiniSlider label="Y" value={blob.y} min={0} max={1} step={0.01}
              onChange={v => onChange({ y: sliderVal(v) })} />
          </div>

          {!isBackground && (
            <div className="space-y-1.5 pl-8">
              <MiniSlider label="Size" value={blob.radius} min={0.05} max={2.0} step={0.05}
                onChange={v => onChange({ radius: sliderVal(v) })} />
              <MiniSlider label="Move" value={blob.amplX} min={0} max={0.4} step={0.01}
                onChange={v => { const val = sliderVal(v); onChange({ amplX: val, amplY: val }); }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface MiniSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number | readonly number[]) => void;
}

function MiniSlider({ label, value, min, max, step, onChange }: MiniSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <span className="text-[10px] font-mono text-zinc-600">{value.toFixed(2)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={onChange} />
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function PlayIcon() {
  return <svg className="mr-1.5 h-3 w-3" viewBox="0 0 12 12" fill="currentColor"><path d="M2.5 1.5l8 4.5-8 4.5V1.5z"/></svg>;
}
function PauseIcon() {
  return <svg className="mr-1.5 h-3 w-3" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="3" height="9" rx="0.5"/><rect x="7" y="1.5" width="3" height="9" rx="0.5"/></svg>;
}
function DiceIcon() {
  return <svg className="mr-1.5 h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="10" height="10" rx="2"/><circle cx="4" cy="4" r="0.7" fill="currentColor"/><circle cx="8" cy="4" r="0.7" fill="currentColor"/><circle cx="4" cy="8" r="0.7" fill="currentColor"/><circle cx="8" cy="8" r="0.7" fill="currentColor"/><circle cx="6" cy="6" r="0.7" fill="currentColor"/></svg>;
}
function BlobDiceIcon() {
  return <svg width="15" height="15" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="10" height="10" rx="2"/><circle cx="4" cy="4" r="0.75" fill="currentColor" stroke="none"/><circle cx="8" cy="4" r="0.75" fill="currentColor" stroke="none"/><circle cx="4" cy="8" r="0.75" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="0.75" fill="currentColor" stroke="none"/><circle cx="6" cy="6" r="0.75" fill="currentColor" stroke="none"/></svg>;
}
function SwatchIcon() {
  return <svg className="mr-1.5 h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="3.5" cy="8.5" r="2"/><path d="M5.5 6.5l4-4a1.414 1.414 0 0 1 2 2l-4 4"/></svg>;
}
function ResetIcon() {
  return <svg className="mr-1.5 h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6a4 4 0 1 0 1-2.46"/><path d="M2 2v2.5H4.5"/></svg>;
}
function DownloadIcon() {
  return <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v8M4 6l3 3 3-3M2 11h10"/></svg>;
}
