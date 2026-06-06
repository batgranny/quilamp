# Quilamp — AI Agent Guidelines

> **For AI agents picking up this project.** This file serves as the system prompt and architectural guide. 

## What is Quilamp?

Quilamp is a modern, cross-platform clone of the classic Winamp 2.x media player built with **Electron + Vite + Vanilla JS/CSS**. It plays local MP3/WAV/OGG files and supports classic Winamp `.wsz` skins, displaying their sprite graphics exactly as they appeared in the original Winamp 2 player. It also includes an immersive MilkDrop-compatible visualizer powered by ProjectM/Butterchurn.

## Technology Stack

| Layer | Technology |
|---|---|
| App Shell | Electron 29 (frameless, transparent window) |
| Build Tool | Vite 5 |
| Skin Parser | JSZip 3.x (browser-side `.wsz` extraction) |
| ID3 Tags | `music-metadata` (Node side via IPC) & `jsmediatags` (browser side) |
| Visualizer | Butterchurn / Butterchurn-Presets (MilkDrop compatible) |
| Packaging | electron-builder (outputs macOS `.dmg` and Windows `.exe`) |
| Styling | Vanilla CSS (no framework) |
| Language | Vanilla JS (ES modules, no framework) |
| Testing | Vitest |

## Project Structure

```
quilamp/
├── main.js              # Electron main process — creates BrowserWindow, handles IPC
├── preload.js           # Electron preload — exposes API to renderer via contextBridge
├── index.html           # UI markup — main player + playlist window
├── visualizer.html      # UI markup — visualizer window
├── vite.config.js       # Vite config  
├── package.json         # Scripts: dev, build, start, dist, pack, test
├── src/
│   ├── renderer.js      # All UI logic: audio playback, skin loading, ID3 tags, UI states
│   └── style.css        # All CSS — imported by renderer.js (NOT via link tag)
├── skins/               # Directory for .wsz skins
├── tests/               # Vitest unit test files
├── dist/                # Output directory for release builds (unpacked)
└── release/             # Output directory for packaged distributables (.dmg, .exe)
```

## Key Architecture Decisions & Quirks

### 1. Window Layout & Scaling
- Electron `BrowserWindow` instances are frameless and transparent.
- The UI is scaled `1.5x` via CSS `zoom` on the `body` tag to match modern DPI displays while preserving pixel art proportions.
- Dragging: uses `-webkit-app-region: drag` on title bars, and `no-drag` on interactive elements.

### 2. Winamp Skin System (`.wsz`)
When a `.wsz` file is dropped or opened:
1. `JSZip` parses the zip in the browser renderer.
2. Key bitmaps are extracted (case-insensitive) and converted to `blob:` Object URLs.
3. CSS custom properties (e.g., `--skin-main-bg`) are set on `:root`.
4. `document.body.classList.add('skin-active')` triggers all `body.skin-active` CSS overrides.
5. In `skin-active` mode, **all UI elements use `position: absolute`** to align exactly with where the skin's `main.bmp` paints their respective backgrounds. The default (non-skinned) UI uses normal flexbox/grid flows.

### 3. Sprite Extraction Toolkit (Canvas)
Winamp skin files use composite bitmaps (like `PLEDIT.BMP`). To prevent rendering artifacts and cross-contamination when tiling elements, `renderer.js` uses a Canvas-based extraction script (`extractSpriteRegion()`). This cuts out strict boundaries into isolated `data:` URI blobs.

### 4. Custom Div Sliders (NOT native `<input type="range">`)
> **IMPORTANT:** Native `<input type="range">` sliders are NOT used for core playback controls in skinned mode.
The volume, pan, and seek sliders use absolute positioned custom div elements. The thumb position is controlled via JS drag handlers (`thumb.style.left`). This allows us to apply complex background sprite mappings to the thumb exactly as Winamp intended.

### 5. Chromium VBR Duration Anomaly
Do not rely on standard HTML5 `<audio duration>` for precise duration on Variable Bit Rate (VBR) MP3s. Chromium natively inflates the duration. Instead, `music-metadata` provides binary extraction via an IPC endpoint in `main.js`. The UI stores that absolute integer in `renderer.js` and normalizes the slider against it.

### 6. CSS Import Mechanism
`src/style.css` is imported **inside `renderer.js`** as an ES module import: `import './style.css';`. **Do NOT add a `<link>` tag to HTML** — it causes Electron to cache static files and breaks Vite HMR.

## AI Agent Development Guidelines

1. **Verify UI Modes:** Always consider how changes affect both the default (modern) UI and the "skin-active" (classic Winamp) UI. Layouts behave fundamentally differently between the two.
2. **Vanilla JS/CSS Only:** Do not introduce UI frameworks, React, or Tailwind CSS. The app relies on pure DOM manipulation and native browser APIs.
3. **Keep Pixel Perfection:** Be extremely careful with CSS coordinate modifications in `.skin-active` selectors. Classic Winamp users expect the interface to map perfectly down to the single pixel.
4. **Use IPC for Heavy Lifting:** Use the Main process (`main.js`) via Preload IPC for filesystem operations, OS integrations, and metadata parsing (`music-metadata`). Leave the Renderer purely for UI and audio context.
5. **Running Tests:** If you modify core logic, ensure you run `npm test` to verify no regressions in utility functions.
