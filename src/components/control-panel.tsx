'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { generateRandomBlob, randomBlobColor } from '@/lib/gradient-utils';
import type { GradientConfig, DownloadFormat, DownloadScale, GradientBlob } from '@/lib/types';

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

// Total blob capacity: 1 background + 10 color blobs. Must match the WebGL
// shader's uniform array size in webgl-gradient.ts.
const MAX_BLOBS = 11;

interface ControlPanelProps {
  config: GradientConfig;
  activePresetId: string;
  onSetConfig: (updater: GradientConfig | ((prev: GradientConfig) => GradientConfig)) => void;
  onApplyPreset: (id: string) => void;
  onRandomize: () => void;
  onShuffleColors: () => void;
  onReset: () => void;
  onDownload: (format: DownloadFormat, scale: DownloadScale, quality?: number) => void;
}

export default function ControlPanel({
  config,
  onSetConfig,
  onRandomize,
  onShuffleColors,
  onReset,
  onDownload,
}: ControlPanelProps) {
  const [format, setFormat] = useState<DownloadFormat>('png');
  const [scale, setScale] = useState<DownloadScale>(2);
  const [editorOpen, setEditorOpen] = useState(false);
  // Start collapsed (pill) — safe for SSR. useEffect expands on desktop.
  const [collapsed, setCollapsed] = useState(true);
  // Whether to use sheet layout (< 1024px) vs horizontal bar (≥ 1024px)
  const [useSheet, setUseSheet] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const savedNoiseOpacity = useRef(0.4);
  const panelRef = useRef<HTMLDivElement>(null);
  const grainEnabled = config.noiseOpacity > 0;

  // One-time screen-size boot + resize listener for layout switching
  useEffect(() => {
    const w = window.innerWidth;
    setUseSheet(w < 1024);
    if (w >= 640) setCollapsed(false); // tablet + desktop start expanded

    const onResize = () => setUseSheet(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Outside-click closes editor panel (desktop only)
  useEffect(() => {
    if (!editorOpen || useSheet) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setEditorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editorOpen, useSheet]);

  const updateBlob = useCallback(
    (id: string, patch: Partial<GradientBlob>) =>
      onSetConfig(prev => ({ ...prev, blobs: prev.blobs.map(b => b.id === id ? { ...b, ...patch } : b) })),
    [onSetConfig],
  );

  const randomizeColor = useCallback(
    (id: string) => updateBlob(id, { color: randomBlobColor() }),
    [updateBlob],
  );

  // Capacity is 1 background + 10 color blobs (mirrors the shader's 11 slots).
  const addBlob = useCallback(() => {
    onSetConfig(prev => prev.blobs.length >= MAX_BLOBS ? prev : { ...prev, blobs: [...prev.blobs, generateRandomBlob(prev.blobs)] });
  }, [onSetConfig]);

  const removeLastBlob = useCallback(() => {
    onSetConfig(prev => prev.blobs.length > 2 ? { ...prev, blobs: prev.blobs.slice(0, -1) } : prev);
  }, [onSetConfig]);

  // Delete a specific blob by id. Keeps at least the background + one blob.
  const removeBlob = useCallback((id: string) => {
    onSetConfig(prev => prev.blobs.length > 2 ? { ...prev, blobs: prev.blobs.filter(b => b.id !== id) } : prev);
  }, [onSetConfig]);

  // Background (index 0) can't be removed; one color blob must always remain.
  const canDeleteBlob = config.blobs.length > 2;

  const toggleGrain = useCallback(() => {
    if (grainEnabled) {
      savedNoiseOpacity.current = config.noiseOpacity;
      onSetConfig(prev => ({ ...prev, noiseOpacity: 0 }));
    } else {
      onSetConfig(prev => ({ ...prev, noiseOpacity: savedNoiseOpacity.current }));
    }
  }, [grainEnabled, config.noiseOpacity, onSetConfig]);

  // ── Shared sheet props ─────────────────────────────────────────────────────
  const sheetProps = {
    config, format, onFormat: setFormat, scale, onScale: setScale,
    grainEnabled, savedNoiseOpacity, onSetConfig, onRandomize,
    onShuffleColors, onReset, onDownload,
    onCollapse: () => setCollapsed(true),
    onAbout: () => setAboutOpen(true),
    updateBlob, addBlob, removeLastBlob, toggleGrain, randomizeColor,
    removeBlob, canDeleteBlob,
  };

  // ── Collapsed pill ─────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
          <SpringMount>
            <div className="flex items-center gap-2 bg-zinc-950/90 backdrop-blur-xl rounded-full border border-white/[0.06] pl-2.5 pr-2 py-2 shadow-xl">
              <div className="flex items-center gap-1.5 px-1">
                {config.blobs.slice(1).map(b => (
                  <div key={b.id} className="h-[18px] w-[18px] rounded-full border border-white/15 flex-shrink-0" style={{ background: b.color }} />
                ))}
              </div>
              <div className="w-px h-3.5 bg-white/10" />
              <IconBtn onClick={() => setAboutOpen(true)} title="About"><InfoIcon /></IconBtn>
              <button type="button" onClick={() => setCollapsed(false)} title="Expand controls"
                className="h-7 w-7 rounded-full flex items-center justify-center bg-white/[0.10] hover:bg-white/[0.18] text-zinc-300 hover:text-white transition-[background-color,color] duration-150 border-none cursor-pointer">
                <ExpandIcon />
              </button>
            </div>
          </SpringMount>
        </div>
      </>
    );
  }

  // ── Mobile / Tablet: bottom sheet ─────────────────────────────────────────
  if (useSheet) {
    return (
      <>
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        <BottomSheet {...sheetProps} />
      </>
    );
  }

  // ── Desktop: horizontal bar ────────────────────────────────────────────────
  return (
    <>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <div ref={panelRef} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col w-max max-w-[calc(100vw-32px)]">
        {/* Blob editor panel — snaps instantly. 6px gap to the bar when open. */}
        <div className="grid w-full" style={{ gridTemplateRows: editorOpen ? '1fr' : '0fr', marginBottom: editorOpen ? 6 : 0 }}>
          <div className="overflow-hidden min-h-0">
            <div className="bg-zinc-950/90 backdrop-blur-xl rounded-xl border border-white/[0.06] overflow-x-auto scrollbar-hide">
              <div className="flex gap-[26px] sm:gap-7 px-4 pt-3.5 pb-3.5 w-max min-w-full">
                {config.blobs.map((blob, index) => (
                  <BlobColumn key={blob.id} blob={blob} index={index} isBackground={index === 0} isOpen={editorOpen}
                    onChange={p => updateBlob(blob.id, p)} onRandomize={() => randomizeColor(blob.id)}
                    onDelete={() => removeBlob(blob.id)} canDelete={canDeleteBlob} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Canvas gesture hint — sits above the bar; hidden when the editor
            is open (it would otherwise crowd the 6px gap) and when collapsed. */}
        {!editorOpen && <GestureHint className="mb-2" />}

        {/* Main bar */}
        <SpringMount>
          <div className="flex items-end gap-5 bg-zinc-950/90 backdrop-blur-xl rounded-xl border border-white/[0.06] px-4 py-3 overflow-x-auto scrollbar-hide">
            <CtrlGroup label="Background">
              <SwatchCircle color={config.blobs[0]?.color ?? '#000000'} active={editorOpen} onClick={() => setEditorOpen(o => !o)} />
            </CtrlGroup>
            <Sep />
            <CtrlGroup label="Blobs">
              <CircleBtn onClick={removeLastBlob} disabled={config.blobs.length <= 2} title="Remove blob"><MinusIcon /></CircleBtn>
              {config.blobs.slice(1).map(b => (
                <SwatchCircle key={b.id} color={b.color} active={editorOpen} onClick={() => setEditorOpen(o => !o)} />
              ))}
              <CircleBtn onClick={addBlob} disabled={config.blobs.length >= MAX_BLOBS} title="Add blob"><PlusIcon /></CircleBtn>
            </CtrlGroup>
            <Sep />
            <CtrlGroup label="Grain">
              <Tab active={!grainEnabled} onClick={() => grainEnabled && toggleGrain()}>Off</Tab>
              <Tab active={grainEnabled} onClick={() => !grainEnabled && toggleGrain()}>On</Tab>
              {grainEnabled && (
                <FilledSlider title="Opacity" value={config.noiseOpacity} min={0.01} max={1} step={0.01}
                  display={v => `${Math.round(v * 100)}%`}
                  onChange={v => { if (v > 0) savedNoiseOpacity.current = v; onSetConfig(prev => ({ ...prev, noiseOpacity: v })); }} />
              )}
            </CtrlGroup>
            <Sep />
            <CtrlGroup label="Layout">
              <Tab onClick={onRandomize}>Randomize</Tab>
              <Tab onClick={onShuffleColors}>Colors</Tab>
              <div className="w-px self-stretch bg-white/[0.06] mx-0.5" />
              <Tab onClick={onReset}><ResetIcon />Reset</Tab>
            </CtrlGroup>
            <Sep />
            <CtrlGroup label="Export">
              {FORMATS.map(f => <Tab key={f.value} active={format === f.value} onClick={() => setFormat(f.value)}>{f.label}</Tab>)}
              <div className="w-px self-stretch bg-white/[0.06] mx-0.5" />
              {SCALES.map(s => <Tab key={s.value} active={scale === s.value} onClick={() => setScale(s.value)}>{s.label}</Tab>)}
              <div className="w-px self-stretch bg-white/[0.06] mx-0.5" />
              <Tab active onClick={() => onDownload(format, scale)}><DownloadIcon />Save</Tab>
            </CtrlGroup>
            <Sep />
            <div className="flex items-center gap-1.5 self-end pb-0.5 flex-shrink-0">
              <IconBtn onClick={() => setAboutOpen(true)} title="About"><InfoIcon /></IconBtn>
              <IconBtn onClick={() => { setEditorOpen(false); setCollapsed(true); }} title="Collapse"><CollapseIcon /></IconBtn>
            </div>
          </div>
        </SpringMount>
      </div>
    </>
  );
}

/* ─── Bottom sheet (mobile + tablet) ────────────────────────────────────── */

interface BottomSheetProps {
  config: GradientConfig;
  format: DownloadFormat; onFormat: (f: DownloadFormat) => void;
  scale: DownloadScale; onScale: (s: DownloadScale) => void;
  grainEnabled: boolean;
  savedNoiseOpacity: React.MutableRefObject<number>;
  onSetConfig: (u: GradientConfig | ((prev: GradientConfig) => GradientConfig)) => void;
  onRandomize: () => void; onShuffleColors: () => void; onReset: () => void;
  onDownload: (format: DownloadFormat, scale: DownloadScale) => void;
  onCollapse: () => void; onAbout: () => void;
  updateBlob: (id: string, patch: Partial<GradientBlob>) => void;
  addBlob: () => void; removeLastBlob: () => void;
  toggleGrain: () => void;
  randomizeColor: (id: string) => void;
  removeBlob: (id: string) => void;
  canDeleteBlob: boolean;
}

function BottomSheet({
  config, format, onFormat, scale, onScale, grainEnabled, savedNoiseOpacity,
  onSetConfig, onRandomize, onShuffleColors, onReset, onDownload,
  onCollapse, onAbout, updateBlob, addBlob, removeLastBlob, toggleGrain, randomizeColor,
  removeBlob, canDeleteBlob,
}: BottomSheetProps) {
  const [view, setView] = useState<'main' | 'editor'>('main');
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const bgBlob = config.blobs[0];
  const safeBottom = 'max(20px, env(safe-area-inset-bottom, 0px))';
  const contentMaxH = 'calc(90svh - 44px)';

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const dismiss = useCallback(() => setExiting(true), []);

  const handleTransitionEnd = useCallback(() => {
    if (exiting) onCollapse();
  }, [exiting, onCollapse]);

  // Pull-down-to-collapse: drag the handle down; past the threshold the sheet
  // dismisses, otherwise it springs back. Pointer capture keeps the drag alive
  // even if the finger leaves the small handle target.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startY: 0, pointerId: -1 });
  const DRAG_DISMISS_PX = 90;

  const onHandleDown = (e: React.PointerEvent) => {
    dragRef.current = { active: true, startY: e.clientY, pointerId: e.pointerId };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    setDragY(Math.max(0, e.clientY - d.startY)); // downward only
  };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    d.active = false;
    setDragging(false);
    const dist = Math.max(0, e.clientY - d.startY);
    try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (dist > DRAG_DISMISS_PX) dismiss();
    else setDragY(0); // spring back
  };

  const ty = !ready || exiting ? '100%' : '0';
  const transform = dragging ? `translateY(${dragY}px)` : `translateY(${ty})`;
  const sheetTransition = dragging
    ? 'none'
    : exiting
      ? 'transform 240ms cubic-bezier(0.4, 0, 1, 1)'
      : ready ? 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';

  return (
    <>
      {/* Tap-outside backdrop — transparent, sits below the sheet */}
      <div className="fixed inset-0 z-40" onClick={dismiss} />

      <div
        className="fixed inset-x-0 bottom-0 z-50"
        style={{ transform, transition: sheetTransition }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="bg-zinc-950 border-t border-white/[0.08] rounded-t-2xl overflow-hidden"
          style={{ maxHeight: '90svh' }}>
          {/* Drag handle — drag down to collapse */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            <div className="w-8 h-[3px] rounded-full bg-white/[0.14]" />
          </div>

          {/* Canvas gesture hint */}
          <GestureHint className="pb-1.5" />


          {/* Two-view horizontal slider */}
          <div className="overflow-hidden">
            <div
              className="flex flex-row"
              style={{
                width: '200%',
                transform: view === 'main' ? 'translateX(0)' : 'translateX(-50%)',
                transition: 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* ── Main view ─────────────────────────────────── */}
              <div className="w-1/2 overflow-y-auto" style={{ maxHeight: contentMaxH, paddingBottom: safeBottom }}>
                <div className="px-4">
                  {bgBlob && (
                    <>
                      <SheetRow label="Background">
                        <ColorPickerLabel blob={bgBlob} onChange={p => updateBlob(bgBlob.id, p)} />
                      </SheetRow>
                      <SheetDivider />
                    </>
                  )}

                  <SheetRow label="Blobs">
                    <CircleBtn onClick={removeLastBlob} disabled={config.blobs.length <= 2} title="Remove blob" className="h-8 w-8"><MinusIcon /></CircleBtn>
                    {config.blobs.slice(1).map(b => (
                      <ColorPickerLabel key={b.id} blob={b} onChange={p => updateBlob(b.id, p)} />
                    ))}
                    <CircleBtn onClick={addBlob} disabled={config.blobs.length >= MAX_BLOBS} title="Add blob" className="h-8 w-8"><PlusIcon /></CircleBtn>
                    <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
                    <button
                      type="button"
                      onClick={() => setView('editor')}
                      className="flex items-center justify-center h-8 px-3 rounded-lg text-[12px] font-normal border-none cursor-pointer transition-[background-color,color] duration-150 bg-white/[0.07] text-zinc-400 hover:bg-white/[0.12] hover:text-zinc-200"
                    >
                      <EditIcon />Edit
                    </button>
                  </SheetRow>

                  <SheetDivider />

                  <SheetRow label="Grain">
                    <Tab active={!grainEnabled} onClick={() => grainEnabled && toggleGrain()}>Off</Tab>
                    <Tab active={grainEnabled} onClick={() => !grainEnabled && toggleGrain()}>On</Tab>
                    {grainEnabled && (
                      <FilledSlider title="Opacity" value={config.noiseOpacity} min={0.01} max={1} step={0.01}
                        display={v => `${Math.round(v * 100)}%`}
                        onChange={v => { if (v > 0) savedNoiseOpacity.current = v; onSetConfig(prev => ({ ...prev, noiseOpacity: v })); }} />
                    )}
                  </SheetRow>

                  <SheetDivider />

                  <SheetRow label="Layout">
                    <Tab onClick={onRandomize}>Randomize</Tab>
                    <Tab onClick={onShuffleColors}>Colors</Tab>
                    <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
                    <Tab onClick={onReset}><ResetIcon />Reset</Tab>
                  </SheetRow>

                  <SheetDivider />

                  {/* Export split across three rows so nothing wraps awkwardly. */}
                  <SheetRow label="Format">
                    {FORMATS.map(f => <Tab key={f.value} active={format === f.value} onClick={() => onFormat(f.value)}>{f.label}</Tab>)}
                  </SheetRow>

                  <SheetRow label="Scale">
                    {SCALES.map(s => <Tab key={s.value} active={scale === s.value} onClick={() => onScale(s.value)}>{s.label}</Tab>)}
                  </SheetRow>

                  <SheetRow label="">
                    <Tab active onClick={() => onDownload(format, scale)}><DownloadIcon />Save</Tab>
                  </SheetRow>

                  <SheetDivider />

                  <div className="flex items-center justify-between py-2.5">
                    <IconBtn onClick={onAbout} title="About"><InfoIcon /></IconBtn>
                    <button
                      type="button"
                      onClick={dismiss}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-[background-color,color] duration-150 border-none cursor-pointer"
                    >
                      <CollapseIcon />
                      Collapse
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Editor view ───────────────────────────────── */}
              <div className="w-1/2 flex flex-col" style={{ maxHeight: contentMaxH }}>
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setView('main')}
                    className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.07] hover:bg-white/[0.13] text-zinc-400 hover:text-zinc-200 transition-[background-color,color] duration-150 border-none cursor-pointer"
                  >
                    <BackIcon />
                  </button>
                  <span className="text-[13px] text-zinc-300">Blobs</span>
                </div>
                <div
                  className="overflow-x-auto overflow-y-auto flex-1 scrollbar-hide px-4 py-4"
                  style={{ paddingBottom: safeBottom }}
                >
                  <div className="flex gap-7 w-max">
                    {config.blobs.map((blob, i) => (
                      <BlobColumn key={blob.id} blob={blob} index={i} isBackground={i === 0}
                        isOpen={view === 'editor'} onChange={p => updateBlob(blob.id, p)} onRandomize={() => randomizeColor(blob.id)}
                        onDelete={() => removeBlob(blob.id)} canDelete={canDeleteBlob} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Sheet helpers ──────────────────────────────────────────────────────── */

function SheetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2.5 min-h-[48px]">
      <span className="text-[12px] text-zinc-500 w-[76px] flex-shrink-0 leading-none">{label}</span>
      <div className="flex-1 flex items-center flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function SheetDivider() {
  return <div className="h-px bg-white/[0.06]" />;
}

function ColorPickerLabel({ blob, onChange }: { blob: GradientBlob; onChange: (p: Partial<GradientBlob>) => void }) {
  return (
    <label
      className="relative h-8 w-8 rounded-full border border-white/15 cursor-pointer overflow-hidden flex-shrink-0 hover:border-white/30 transition-[border-color] duration-150"
      title="Pick color"
    >
      <span className="absolute inset-0" style={{ background: blob.color }} />
      <input type="color" value={blob.color} onChange={e => onChange({ color: e.target.value })}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
    </label>
  );
}

/* ─── Blob editor column ─────────────────────────────────────────────────── */

interface BlobColumnProps {
  blob: GradientBlob; index: number; isBackground: boolean;
  isOpen: boolean;
  onChange: (patch: Partial<GradientBlob>) => void;
  onRandomize: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function BlobColumn({ blob, index, isBackground, isOpen, onChange, onRandomize, onDelete, canDelete }: BlobColumnProps) {
  const delay = index * 35;
  return (
    <div
      className="flex flex-col gap-0 w-[128px] sm:w-[138px] flex-shrink-0"
      style={{
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0px)' : 'translateY(8px)',
        transition: isOpen
          ? `opacity 220ms ease-out ${delay}ms, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`
          : 'opacity 120ms ease-out, transform 120ms ease-out',
      }}
    >
      <span className="text-[11px] font-normal leading-[14px] text-zinc-500 select-none mb-4">
        {isBackground ? 'Background' : `Blob ${index}`}
      </span>
      <div className="flex items-center gap-2 mb-4">
        <label title="Pick color" className="relative h-8 w-8 rounded-full border border-white/15 cursor-pointer overflow-hidden flex-shrink-0 hover:border-white/30 transition-[border-color] duration-150">
          <span className="absolute inset-0" style={{ background: blob.color }} />
          <input type="color" value={blob.color} onChange={e => onChange({ color: e.target.value })} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </label>
        {!isBackground && (
          <button type="button" onClick={onRandomize} title="Random color"
            className="h-8 w-8 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] text-zinc-400 hover:text-zinc-200 transition-[background-color,color] duration-150 flex items-center justify-center border-none cursor-pointer flex-shrink-0 outline-none">
            <DiceIcon />
          </button>
        )}
        {!isBackground && (
          <button type="button" onClick={onDelete} disabled={!canDelete} title="Delete blob"
            className="h-8 w-8 rounded-lg bg-white/[0.07] hover:bg-red-500/15 text-zinc-400 hover:text-red-400 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white/[0.07] disabled:hover:text-zinc-400 transition-[background-color,color] duration-150 flex items-center justify-center border-none cursor-pointer flex-shrink-0 outline-none">
            <TrashIcon />
          </button>
        )}
      </div>
      <div className="mb-4">
        <HexInput color={blob.color} onChange={c => onChange({ color: c })} />
      </div>
      {!isBackground && (
        <div className="flex flex-col gap-4">
          <PopSlider label="X" value={blob.x} min={0} max={1} step={0.01} fmt={v => v.toFixed(2)} onChange={v => onChange({ x: v })} />
          <PopSlider label="Y" value={blob.y} min={0} max={1} step={0.01} fmt={v => v.toFixed(2)} onChange={v => onChange({ y: v })} />
          <PopSlider label="Size" value={blob.radius} min={0.05} max={2} step={0.01} fmt={v => v.toFixed(2)} onChange={v => onChange({ radius: v })} />
        </div>
      )}
    </div>
  );
}

/* ─── About modal ────────────────────────────────────────────────────────── */

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ pointerEvents: open ? 'auto' : 'none', opacity: open ? 1 : 0, transition: 'opacity 200ms ease-out' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-950/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        style={{
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          transition: open ? 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)' : 'transform 180ms ease-in',
        }}>
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-zinc-500 hover:text-zinc-300 transition-[background-color,color] duration-150 border-none cursor-pointer">
          <CloseIcon />
        </button>
        <div className="flex items-center gap-1.5 mb-5">
          {[0, 1, 2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-white/20" />)}
        </div>
        <h2 className="text-[15px] font-medium text-white leading-snug mb-1.5">Gradient Studio</h2>
        <p className="text-[13px] text-zinc-400 leading-relaxed mb-6">
          A mesh gradient studio powered by WebGL 2 and OKLab color science. Design and export beautiful gradients.
        </p>
        <div className="flex flex-col gap-2.5 pt-4 border-t border-white/[0.06]">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-zinc-500">Last updated</span>
            <span className="text-[12px] text-zinc-300 tabular-nums">May 2026</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-zinc-500">Built by</span>
            <a href="https://x.com/hckmstrrahul" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white transition-colors duration-150 no-underline">
              <XIcon />hckmstrrahul
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Primitives ─────────────────────────────────────────────────────────── */

function GestureHint({ className = '' }: { className?: string }) {
  // Floats over the live gradient, so a dark text-shadow keeps it legible on
  // bright backgrounds without an opaque pill stealing focus from the canvas.
  return (
    <div
      className={`flex items-center justify-center gap-2 select-none text-zinc-300/90 ${className}`}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
    >
      <span className="flex items-center gap-1.5 text-[11px] leading-none">
        <HandIcon />
        Drag a blob to move
      </span>
      <span className="opacity-50">·</span>
      <span className="flex items-center gap-1.5 text-[11px] leading-none">
        <ScrollIcon />
        Scroll to resize
      </span>
    </div>
  );
}

function CtrlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[9px] min-w-0 flex-shrink-0">
      <span className="text-[11px] font-normal leading-[14px] text-zinc-500 select-none">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Sep() {
  return <div className="self-stretch w-px bg-white/[0.06] my-0.5 flex-shrink-0" />;
}

function Tab({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center h-8 px-3 rounded-lg text-[13px] font-normal leading-[14px] cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap border-none outline-none ${
        active ? 'bg-white text-black' : 'bg-white/[0.07] text-zinc-400 hover:bg-white/[0.12] hover:text-zinc-200'
      }`}>
      {children}
    </button>
  );
}

function CircleBtn({ onClick, disabled, title, children, className = 'h-9 w-9' }: {
  onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`${className} rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.07] text-zinc-400 hover:bg-white/[0.13] hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white/[0.07] disabled:hover:text-zinc-400 transition-[background-color,color] duration-150 border-none cursor-pointer outline-none`}>
      {children}
    </button>
  );
}

function SwatchCircle({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-9 w-9 rounded-full flex-shrink-0 border transition-all duration-200 outline-none ${
        active ? 'border-white/50 ring-2 ring-white/15 scale-90' : 'border-white/15 hover:border-white/30 hover:scale-95'
      }`}
      style={{ background: color }} />
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="h-8 w-8 rounded-lg flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.10] text-zinc-500 hover:text-zinc-300 transition-[background-color,color] duration-150 border-none cursor-pointer flex-shrink-0 outline-none">
      {children}
    </button>
  );
}

function FilledSlider({ title, value, min, max, step, display, onChange }: {
  title: string; value: number; min: number; max: number; step: number;
  display: (v: number) => string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative h-8 w-20 sm:w-24 rounded-lg overflow-hidden flex-shrink-0 cursor-ew-resize" title={title}>
      <div className="absolute inset-0 bg-white/[0.07]" />
      <div className="absolute inset-y-0 left-0 bg-white/[0.14]" style={{ width: `${pct}%` }} />
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 opacity-0 w-full h-full cursor-ew-resize" />
      <span className="absolute inset-0 flex items-center justify-end pr-2.5 text-[12px] text-zinc-400 pointer-events-none select-none tabular-nums">
        {display(value)}
      </span>
    </div>
  );
}

function PopSlider({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{fmt(value)}</span>
      </div>
      <div className="relative h-7 rounded-md overflow-hidden cursor-ew-resize">
        <div className="absolute inset-0 bg-white/[0.07]" />
        <div className="absolute inset-y-0 left-0 bg-white/[0.14]" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 opacity-0 w-full h-full cursor-ew-resize" />
      </div>
    </div>
  );
}

function HexInput({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [draft, setDraft] = useState(color);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(color); }, [color]);
  return (
    <input type="text" value={draft} maxLength={7} spellCheck={false}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; if (!/^#[0-9A-Fa-f]{6}$/.test(draft)) setDraft(color); }}
      onChange={e => {
        let v = e.target.value;
        if (v && !v.startsWith('#')) v = '#' + v;
        v = v.slice(0, 7);
        setDraft(v);
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v.toLowerCase());
      }}
      className="w-full h-8 bg-white/[0.07] rounded-lg px-2.5 text-[12px] font-mono text-zinc-300 border-none outline-none focus:bg-white/[0.12] transition-colors duration-150" />
  );
}

/* ─── Animation helpers ──────────────────────────────────────────────────── */

function SpringMount({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div style={{
      transform: ready ? 'scale(1) translateY(0px)' : 'scale(0.93) translateY(5px)',
      opacity: ready ? 1 : 0,
      transition: ready ? 'transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease-out' : 'none',
    }}>
      {children}
    </div>
  );
}

function SpringSlideUp({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div style={{
      transform: ready ? 'translateY(0)' : 'translateY(100%)',
      transition: ready ? 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
    }}>
      {children}
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */

function DownloadIcon() {
  return (
    <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2 2l8 8M10 2l-8 8" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 7a4.5 4.5 0 1 1-1.32-3.18" />
      <path d="M11 1.5v2.5H8.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3.5 8h9" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7V3.4a1 1 0 0 1 2 0V6m0 0V2.6a1 1 0 0 1 2 0V6m0 0V3.4a1 1 0 0 1 2 0V8.5c0 2.2-1.5 4-3.8 4-1.5 0-2.4-.6-3.2-1.7L2 8.4a1 1 0 0 1 1.6-1.2L4.5 8" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="1.5" width="6" height="11" rx="3" />
      <path d="M7 4v2" />
      <path d="M7 9.5l-1.2 1.2M7 9.5l1.2 1.2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5h9M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8M6 6v4M8 6v4" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" />
      <circle cx="4.75" cy="4.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.25" cy="4.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4.75" cy="9.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.25" cy="9.25" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 6.5v4" />
      <circle cx="7" cy="4.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l4-4 4 4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M9.16 1h1.72L7.12 5.42 11.5 11H8.04L5.3 7.44 2.15 11H.43l4-4.7L.5 1h3.56l2.48 3.23L9.16 1zm-.6 9h.95L3.5 2H2.48L8.56 10z" />
    </svg>
  );
}
