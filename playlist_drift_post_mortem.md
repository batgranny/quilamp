# Post-Mortem: The Playlist Drift Crisis

## Context
- **Project**: Quilamp (Winamp clone)
- **Environment**: Electron, Frameless Transparent Window, `zoom: 1.5` for High-DPI support.
- **Goal**: Maintain 1:1 pixel-perfect Winamp skin alignment during window resizing and movement.

## The Core Problem
In skinned mode, when the window is dragged or when tracks are added/removed (triggering a resize), the playlist content (the track list) "crawls" or "drifts" upward. 
- It eventually overlaps the playlist title bar graphics.
- The bottom of the window often clips the bottom bar graphics.
- This appears to be a **Chromium subpixel rounding error** triggered by the combination of `zoom: 1.5`, `transparent: true`, and `frame: false`.

## Approaches Attempted (and Why They Failed)

### 1. Robust Manual Dragging
- **Strategy**: Replaced `-webkit-app-region: drag` with custom `mousedown/mousemove/mouseup` logic using screen coordinates.
- **Result**: Fixed the *window position* jitter, but the *internal layout* still drifts relative to the window boundary.

### 2. "Atomic" Multiple-of-4 Sizing
- **Strategy**: Forced all logical dimensions (width/height) to be multiples of 4.
- **Theory**: [(Logical 276) * 1.5 = (Physical 414)](file:///Users/chrisconnolly/git/personal/quinamp/main.js#423-424). This ensures no fractional physical pixels.
- **Result**: Improved stability but did not eliminate the "upward creep" of the playlist items.

### 3. GPU Acceleration / Flex Alignment
- **Strategy**: Added `transform: translateZ(0)` and `justify-content: flex-start` to all containers.
- **Result**: No measurable effect. The drift persisted.

### 4. Hardware Scaling (`transform: scale`)
- **Strategy**: Removed `zoom: 1.5` and applied `transform: scale(1.5)` to the root container.
- **Result**: **FAILED MANGLED UI**. `transform: scale` does not affect the layout flow. The window dimensions (set via [resizeWindow](file:///Users/chrisconnolly/git/personal/quinamp/preload.js#5-6)) became disconnected from the visual scale, leading to massive clipping and broken hitboxes.

### 5. Absolute "Caging"
- **Strategy**: Used `position: absolute` with `top/bottom/left/right` for playlist title bar, box, and bottom bar.
- **Result**: **FAILED MANGLED UI**. In a zoomed environment, absolute positioning seems to recalculate inconsistently during window movement, causing the sub-regions to overlap or detach from the container.

## Key Observations for the Next Agent
1. **The "Crawl" is Real**: The drift isn't just a visual glitch; the elements' DOM positions actually seem to shift by fractions of a pixel that accumulate.
2. **Zoom is the Enemy**: `zoom` is a legacy property that Chromium handles poorly in frameless windows. However, reverting it requires a ground-up rework of the CSS to use physical-equivalent units.
3. **Flexbox is Suspect**: The vertical stack of `[Title | List | Bottom]` in the playlist seems to be where the rounding error originates. 
4. **Resizing Triggers It**: Calling `window.electronAPI.resizeWindow()` almost always induces a layout shift that doesn't perfectly reset.

## Recommendations
- Explore **`resize-observer`** for more reactive height syncing?
- Consider **Canvas-based rendering** for the playlist if DOM-based precision remains elusive?
- Rework the entire app to use **physical pixels natively** (pixel-precise CSS) and avoid `zoom` entirely at the cost of manual scaling logic.
