'use client';

import GradientCanvas from '@/components/gradient-canvas';
import ControlPanel from '@/components/control-panel';
import { useGradient } from '@/hooks/use-gradient';

export default function Home() {
  const {
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
  } = useGradient();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      <GradientCanvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <ControlPanel
        isPlaying={isPlaying}
        config={config}
        activePresetId={activePresetId}
        onSetConfig={setConfig}
        onApplyPreset={applyPreset}
        onRandomize={randomize}
        onShuffleColors={shuffleColors}
        onReset={reset}
        onTogglePlay={togglePlay}
        onDownload={download}
      />
    </main>
  );
}
