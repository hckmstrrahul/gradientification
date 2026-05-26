# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Next.js Version

This project uses Next.js 16 which has breaking changes from earlier versions. **Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`** — APIs, conventions, and file structure may differ from training data.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There is no test suite.

## Architecture

Single-page mesh gradient studio. All UI is client-side — no server components, no API routes.

**Data flow:**
```
page.tsx
  └── useGradient() hook          # owns all state + WebGL lifecycle
      ├── canvasRef → GradientCanvas (DOM element)
      └── engineRef → WebGLGradient class (WebGL2 animation engine)
          └── renderFrame(elapsed) → GLSL fragment shader
ControlPanel
  └── receives config + callbacks from useGradient(), manages only local UI state
```

**Key files:**
- `src/hooks/use-gradient.ts` — central state: config, isPlaying, preset system, download, animation timing
- `src/lib/webgl-gradient.ts` — `WebGLGradient` class: shader compilation, rAF loop, `captureDataURL()` for export
- `src/components/control-panel.tsx` — 538-line UI panel; inline sub-components (`BlobRow`, `SliderRow`, `PillToggle`, etc.)
- `src/lib/gradient-utils.ts` — color conversion (`hexToOklab()`), SVG export generation, randomization helpers
- `src/lib/types.ts` — `GradientBlob`, `GradientConfig` interfaces

## Color Pipeline

All blending happens in **OKLab** (perceptually uniform, no hue banding):

```
Hex → sRGB → Linear sRGB → OKLab  →  GPU uniform u_lab[8]
                                          ↓ Gaussian-weighted blend in shader
                                     OKLab → Linear sRGB → Gamma sRGB → screen
```

`hexToOklab()` runs on the CPU; the OKLab↔sRGB matrix transforms are hard-coded in the GLSL shader (`webgl-gradient.ts`).

## WebGL Shader Details

- GLSL ES 3.0 fragment shader, 8-blob limit enforced via `MAX_BLOBS` constant
- Uniforms: `u_res`, `u_time`, `u_count`, `u_pos[8]`, `u_lab[8]`, `u_rad[8]`, `u_noiseDensity`, `u_noiseOpacity`
- Grain uses Box-Muller Gaussian noise with Photoshop-style Overlay blend
- Canvas created with `preserveDrawingBuffer: true`; `gl.finish()` called before `toDataURL()` export

## State Management

No external state library. Pattern:
- **React state** (`useState`) — `config`, `isPlaying`, `activePresetId`, UI toggles
- **Refs** — WebGL engine (`engineRef`), elapsed animation time (`elapsedRef`), transient UI values (`savedNoiseOpacity` in ControlPanel)
- Heavy `useCallback` usage for handlers passed to ControlPanel

## Styling

Tailwind CSS v4 (PostCSS). Path alias `@/*` → `src/*`. Dark-first design (zinc-950 base). OKLab/oklch color tokens defined in `globals.css`. shadcn/ui components are built on Base UI headless primitives.
