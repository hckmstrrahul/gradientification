'use client';

import { forwardRef } from 'react';

interface GradientCanvasProps {
  className?: string;
}

const GradientCanvas = forwardRef<HTMLCanvasElement, GradientCanvasProps>(
  ({ className }, ref) => (
    <canvas
      ref={ref}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  ),
);

GradientCanvas.displayName = 'GradientCanvas';
export default GradientCanvas;
