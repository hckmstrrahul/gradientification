# Gradientification

A browser-based mesh gradient studio for creating, animating, and exporting Stripe-style morphing gradients — built with Next.js 16, WebGL 2, and OKLab color science.

Live: [gradientification.vercel.app](https://gradientification.vercel.app)

---

## Features

### Rendering
- **WebGL 2 shader renderer** — Gaussian-weighted blob blending entirely on the GPU via a custom GLSL ES 3.0 fragment shader
- **OKLab color space** — all blending happens in perceptually uniform OKLab; eliminates hue banding and muddy midpoints that sRGB interpolation produces
- **Gaussian grain** — Box-Muller transform noise overlaid with Photoshop-style Overlay blend; frame-rate-independent lerp prevents flash when toggling
- **Aspect-correct blobs** — blobs remain circular on any canvas aspect ratio via aspect-scaled distance

### Animation
- Per-blob sinusoidal motion with independent X/Y frequency, amplitude, and phase offsets
- Play / Pause with accurate elapsed-time tracking across pause cycles

### Responsive UI
- **Mobile** — floating pill by default (color swatches + info + expand); tap to open a full-width bottom sheet
- **Tablet** — bottom sheet open by default
- **Desktop** — horizontal floating bar with collapsible blob editor panel above
- Tap outside the bottom sheet to dismiss; smooth ease-out open / ease-in close (no bounce)
- Two-view navigation in the sheet: main controls → Blobs editor (horizontal scroll) with back button

### Canvas interactions
- **Drag to move** — click-and-drag on the canvas grabs the nearest blob to the cursor; pointer capture keeps the drag alive even if the cursor leaves the canvas
- **Scroll to resize** — wheel / trackpad swipe over the canvas resizes the most recently grabbed blob (multiplicative, so it feels even at any size); scroll up to grow, down to shrink
- `cursor: grab` / `grabbing` for affordance; page scroll is only suppressed while resizing a blob

### Controls
- **Background** — native color picker for the base fill
- **Blobs** — add/remove (1 background + up to 7 colored); per-blob color picker, hex input, dice randomize, X / Y / Size sliders
- **Grain** — On / Off toggle with opacity fine-tuning; last value remembered on re-enable
- **Randomize** — reshuffles positions and sizes with a per-call spread (tight clusters to wider scatter) and a descending size hierarchy (prominent → subtle) to mirror the default aesthetic
- **Shuffle Colors** — randomises colors only; layout and grain untouched
- **Reset** — restores default preset

### Export
- Formats: PNG, WebP, JPG, SVG
- Resolution: 1×, 2×, 4× of the display canvas
- Correct-color GPU export: `preserveDrawingBuffer` + `gl.finish()` before `canvas.toDataURL`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `'use client'`) |
| Rendering | WebGL 2 — custom GLSL ES 3.0 fragment shader |
| Color science | OKLab (Björn Ottosson) — JS + GPU |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx            # Entry: GradientCanvas + ControlPanel via useGradient
│   └── globals.css         # Tailwind v4 base + scrollbar-hide utility
├── components/
│   ├── control-panel.tsx   # Responsive UI: pill / bottom sheet / desktop bar
│   └── gradient-canvas.tsx # Forwarded-ref <canvas> element
├── hooks/
│   └── use-gradient.ts     # WebGLGradient lifecycle, config state, download
└── lib/
    ├── types.ts            # GradientBlob, GradientConfig, GradientPreset
    ├── presets.ts          # Default preset
    ├── gradient-utils.ts   # Color conversion, randomize helpers, SVG export
    └── webgl-gradient.ts   # WebGLGradient class — shader, animation loop, capture
```

---

## Color Pipeline

```
Hex → sRGB → Linear sRGB → OKLab  →  GPU uniform u_lab[8]
                                          ↓ Gaussian-weighted blend in shader
                                     OKLab → Linear sRGB → Gamma sRGB → screen
```

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## License

MIT
