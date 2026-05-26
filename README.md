# Gradientification

A browser-based mesh gradient studio for creating, animating, and exporting Stripe-style morphing gradients — built with Next.js, WebGL 2, and OKLCH color science.

---

## Features

### Rendering
- **WebGL 2 shader renderer** — Gaussian-weighted blob blending entirely on the GPU via a custom GLSL ES 3.0 fragment shader
- **OKLab color space** — all blending happens in perceptually uniform OKLab (Björn Ottosson); eliminates hue banding and muddy midpoints that sRGB interpolation produces
- **Gaussian grain** — Box-Muller transform noise overlaid with Photoshop-style Overlay blend mode; togglable with density and opacity controls
- **Aspect-correct blobs** — blobs remain circular on any canvas aspect ratio via aspect-scaled distance

### Animation
- Per-blob sinusoidal motion with independent X/Y frequency, amplitude, and phase offsets
- Global animation speed multiplier
- Play / Pause with accurate elapsed-time tracking across pause cycles (no time jump on resume)

### Control Panel (collapsible)
- **Color blobs** — color swatch (native picker) + hex text input per blob; add/remove blobs (1 background + up to 7 colored)
- **Per-blob seed** — dice button randomises position, size, and movement for that blob only, keeping its color
- **Params toggle** — pill toggle reveals fine-grained X, Y, Size, Move sliders per blob
- **Randomize** — shuffles all blob positions, sizes, and movement phases; preserves colors and grain settings
- **Shuffle Colors** — randomises colors only; preserves layout and grain
- **Reset** — restores the default preset
- **Grain toggle** — pill toggle enables/disables Gaussian noise; remembers last opacity value when re-enabled

### Export
- Formats: PNG (lossless), WebP, JPG, SVG
- Resolution: 1×, 2×, 4× of the display canvas
- Quality: 1.0 maximum for all lossy formats
- Correct-color export: renders the WebGL canvas at target resolution with `preserveDrawingBuffer` + `gl.finish()` before `canvas.toDataURL` to guarantee GPU sync

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `'use client'`) |
| Rendering | WebGL 2 — custom GLSL ES 3.0 fragment shader |
| Color science | OKLab (Björn Ottosson) — JS conversion + GPU blending |
| UI components | shadcn/ui on Base UI primitives |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Dark-mode root layout, TooltipProvider
│   ├── page.tsx            # Entry: composes GradientCanvas + ControlPanel via useGradient
│   └── globals.css         # Tailwind v4 base + scrollbar-hide utility
├── components/
│   ├── control-panel.tsx   # Full UI: blobs, grain, actions, download
│   └── gradient-canvas.tsx # Forwarded-ref <canvas> element
├── hooks/
│   └── use-gradient.ts     # WebGLGradient lifecycle, config state, randomize, download
└── lib/
    ├── types.ts            # GradientBlob, GradientConfig, GradientPreset, DownloadFormat
    ├── presets.ts          # Default preset (black bg + blue/teal/green)
    ├── gradient-utils.ts   # hexToOklab, randomizeLayout, randomizeColors, generateSVG
    └── webgl-gradient.ts   # WebGLGradient class — shader compile, animation loop, capture
```

---

## Color Pipeline

```
Hex string
  → sRGB [0–1]
  → Linear sRGB      (gamma decode via IEC 61966-2-1 EOTF)
  → OKLab [L, a, b]  (M1 matrix → cbrt → M2 matrix, Björn Ottosson 2020)

GPU uniforms: u_lab[8]  (OKLab per blob)

In shader:
  Gaussian-weighted blend in OKLab
  → Linear sRGB      (M2⁻¹ → cube → M1⁻¹)
  → Gamma sRGB       (inverse EOTF)
  → outColor
```

Blending in OKLab means hue transitions stay vivid, lightness stays perceptually constant,
and no grey mudding occurs between complementary colors.

---

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Export Quality Notes

| Format | Notes |
|---|---|
| PNG | Lossless — quality parameter has no effect |
| WebP | Quality 1.0 — maximum, visually indistinguishable from lossless |
| JPG | Quality 1.0 — maximum; file size larger but no perceptible compression |
| SVG | Vector approximation: `feGaussianBlur` on circles; colors snapshot current animation frame |

---

## License

MIT
