# Quinamp — Agent Handoff README

> **For AI agents picking up this project.** Last updated: 2026-03-09.

## What is Quinamp?

Quinamp is a **macOS-native Winamp 2.x clone** built with **Electron + Vite + Vanilla JS/CSS**. It plays local MP3/WAV/OGG files and supports classic Winamp `.wsz` skins — displaying their sprite graphics exactly as they appeared in the original Winamp 2 player.

## Technology Stack

| Layer | Technology |
|---|---|
| App Shell | Electron 29 (frameless, transparent window) |
| Build Tool | Vite 5 |
| Skin Parser | JSZip 3.x (browser-side `.wsz` extraction) |
| ID3 Tags | jsmediatags (browser-side, loaded via `<script>` tag) |
| Packaging | electron-builder (outputs `.dmg` + `.zip` for macOS arm64) |
| Styling | Vanilla CSS (no framework) |
| Language | Vanilla JS (ES modules, no framework) |

## Project Structure

```
quinamp/
├── main.js              # Electron main process — creates BrowserWindow, handles IPC (file dialogs)
├── preload.js           # Electron preload — exposes electronAPI to renderer via contextBridge
├── index.html           # UI markup — main player + playlist window (both in one page)
├── vite.config.js       # Vite config  
├── package.json         # Scripts: dev, build, start, dist
├── src/
│   ├── renderer.js      # All UI logic: audio playback, skin loading, custom sliders, ID3 tags
│   └── style.css        # All CSS — imported by renderer.js (NOT via link tag, important!)
├── skins/
│   └── winamp_classic.wsz  # Classic Winamp skin for testing
├── dist/                # Built macOS packages (generated)
└── build/               # Vite output (generated)
```

## Key Architecture Decisions

### 1. Window Layout
- Single Electron `BrowserWindow`, **frameless + transparent**, scaled `1.5x` via CSS `zoom` on `body`
- Window size: 413×348px (275×232 logical × 1.5)
- Two visual panels: `#player-container` (top) and `#playlist-container` (bottom), both 275×116px logical
- Dragging: uses `-webkit-app-region: drag` on title bar, `no-drag` on interactive elements

### 2. Winamp Skin System

When a `.wsz` file is dropped or opened:
1. `JSZip` parses the zip in the browser renderer
2. Key bitmaps are extracted (case-insensitive file matching) and converted to `blob:` Object URLs
3. CSS custom properties (`--skin-main-bg`, `--skin-titlebar-bg`, etc.) are set on `:root`
4. `document.body.classList.add('skin-active')` triggers all `body.skin-active` CSS overrides
5. The player background, title bar, and buttons now render from the skin sprites

**Key skin files and their CSS variables:**
| File | CSS Variable | Used for |
|---|---|---|
| `MAIN.BMP` | `--skin-main-bg` | `#player-container` background |
| `TITLEBAR.BMP` | `--skin-titlebar-bg` | `#title-bar` + window control buttons |
| `CBUTTONS.BMP` | `--skin-cbuttons-bg` | Play/Pause/Stop/Prev/Next/Eject buttons |
| `SHUFREP.BMP` | `--skin-shufrep-bg` | Shuffle + Repeat toggle buttons |
| `VOLUME.BMP` | `--skin-volume-bg` | Volume slider knob sprite |
| `BALANCE.BMP` | `--skin-balance-bg` | Pan slider knob sprite |
| `POSBAR.BMP` | `--skin-posbar-bg` | Seek bar thumb sprite |
| `PLEDIT.BMP` | `--skin-pledit-bg` | Playlist editor colors |

### 3. Absolute Positioning for Skin Mode

When `skin-active` is applied, **all UI elements use `position: absolute`** to align exactly with where the skin's `main.bmp` paints their respective backgrounds.

Key coordinates (CSS pixels, relative to `#player-container` top-left at 0,0):
- `#title-bar`: `top: 0`, height 14px
- `#main-display` (overlay): `top: 14px`, 275×102px, transparent background
- `#time-display`: `top: 24px, left: 42px`
- `#track-info`: `top: 26px, left: 112px`
- `#controls-panel`: `top: 88px, left: 16px`
- Volume slider: `top: 57px, left: 107px` (= controls top-31, left+91)
- Pan slider: `top: 57px, left: 177px`
- Seek bar: `top: 72px, left: 16px`

### 4. Custom Div Sliders (NOT native `<input type="range">`)

> **IMPORTANT:** Native `<input type="range">` sliders were replaced with custom div elements.

The volume and pan sliders are:
```html
<div id="volume-slider" class="custom-slider no-drag">
    <div class="slider-thumb" id="volume-thumb"></div>
</div>
```

The thumb position is controlled via `thumb.style.left` set by a JS drag handler (`makeDraggableSlider` in renderer.js). When a skin is loaded, the sprite background image + position is set **directly on the thumb div element** via `thumbElement.style.backgroundImage` and `thumbElement.style.backgroundPosition`.

**Why custom divs?** The `-webkit-slider-thumb` pseudo-element cannot reliably be targeted with `background-image` + `background-position` separately without the shorthand overriding the position. Div elements have no such limitation.

### 5. CSS Import
The `src/style.css` is imported **inside `renderer.js`** as an ES module import:
```js
import './style.css';
```
**Do NOT add a `<link>` tag back to `index.html`** — this causes Electron to cache the static file and ignore HMR updates.

### 6. ID3 Tag Reading
`jsmediatags` is loaded via a `<script>` tag pointing to `./node_modules/jsmediatags/dist/jsmediatags.min.js`. The `loadTrack()` function in `renderer.js` is `async` and calls `readID3Tags(filePath)` to extract artist/title after the track starts playing.

### 7. Canvas Sprite Extraction Toolkit (PLEDIT.BMP handling)
Winamp skin files generally use composite bitmaps. While many elements can be aligned visually via `-webkit-background-clip` or standard `background-position`, complex repeating frame borders (like the playlist window borders in `PLEDIT.BMP`) easily glitch or show cross-contamination artifacts (like a single pixel blue line) if not physically separated.
**Solution**: `renderer.js` implements a Canvas-based generic sprite extraction script (`extractSpriteRegion(url, x, y, width, height)`). This extracts strict mathematical portions of the original bitmap into isolated `data:` URI blobs. These isolated blobs can be safely `repeat-y` tiled the entire vertical height of the window natively without CSS leaking adjacent row data. 

### 8. Custom Sync-Driven DOM Scrollbar
The native CSS `::-webkit-scrollbar` drastically deviates from the Winamp design because standard browser interfaces scale the handle (thumb) size inversely proportional to the volume of the scrollable content, and automatically hide the track altogether if content doesn't overflow. 
**Solution**: The playlist uses a purely absolute-positioned custom DOM hierarchy (`#playlist-scrollbar` & `#playlist-scroll-thumb`). The JavaScript layer intercepts native DOM `scroll` events from `#playlist-box`, and dynamically maps ratios to exactly calculate the 18px tall sprite-graphic's top property coordinate, mirroring classic behavior.

### 9. Chromium VBR Duration Anomaly (The "Seekbar stops at 66%" Bug)
If the seekbar slider mathematically spans exactly 248px graphically, but visually comes to a halt roughly two-thirds across the screen at the exact second the song concludes naturally, **DO NOT change the CSS sizing**. 
This is a known Chromium VBR (Variable Bit Rate) MP3 metadata bug. Chromium natively inflates the HTML5 `<audio duration>` calculation significantly higher than the actual track footprint, meaning division operations fall drastically mathematically short of `1.0`.
**Solution**: Instead of relying on `audio.duration`, `music-metadata` provides flawless binary extraction via an IPC endpoint bridge across to Node environment in `main.js`. The UI stores that absolute integer locally in `renderer.js` and normalizes the slider against it.

## Current State / Known Issues

### Working:
- ✅ MP3/WAV/OGG playback
- ✅ Playlist with drag-and-drop and double-click to play
- ✅ Prev/Play/Pause/Stop/Next/Eject buttons
- ✅ Seek bar (posbar) with draggable thumb
- ✅ Track name marquee scrolling
- ✅ ID3 tag ARTIST - TITLE display
- ✅ `.wsz` skin loading via drag-and-drop
- ✅ Skin background maps to `#player-container` via `main.bmp`
- ✅ Skin titlebar sprite from `titlebar.bmp`
- ✅ QUINAMP title hidden when skin is active
- ✅ Shuffle/Repeat toggle sprites from `shufrep.bmp`
- ✅ Play button sprites from `cbuttons.bmp`
- ✅ Custom div-based volume and pan sliders

### Still Needs Work / ToDo:
- ⚠️ Volume/pan slider thumb sprite alignment may need fine-tuning (positions 0,-422 / -15,-422 in volume.bmp)
- 🔲 Equalizer (EQ) window — not implemented
- 🔲 Web Audio API StereoPanner for actual pan/mono control
- 🔲 Visualizer (canvas frequency bars)
- 🔲 Playlist save/load
- 🔲 Drag-reorder in playlist
- 🔲 App icon (place icon.png in project root and reference in electron-builder config)
- 🔲 Code signing for macOS distribution

## Running Locally

```bash
npm install
npm run dev    # Start Vite dev server (port 5173)
npm start      # Launch Electron, connects to Vite dev server
```

For a production build (macOS DMG):
```bash
npm run build
# outputs to dist/Quinamp-1.0.0-arm64.dmg
```

## Sprite Coordinate Reference

### `cbuttons.bmp` (playback buttons, normal/active states)
Row 0: Normal state | Row 1 (Y=-18): Active/pressed state

| Button | X offset |
|---|---|
| Prev | 0 |
| Play | -23 |
| Pause | -46 |
| Stop | -69 |
| Next | -92 |
| Eject | -114 |

### `shufrep.bmp` (shuffle/repeat)
| Button | X offset | Normal Y | Active Y | Enabled Y |
|---|---|---|---|---|
| Repeat | 0 | 0 | -15 | -30 |
| Shuffle | -28 | 0 | -15 | -30 |

### `titlebar.bmp` (window controls, 344×87px)
Minimize: X=-275, Y=-18 | Close: X=-293, Y=-18

### `volume.bmp` / `balance.bmp` (68×433px)
The knob sprite is at the **very bottom** of the image, approximately `Y=-422`. Volume knob at `X=0`, pan/balance knob at `X=-15`.
