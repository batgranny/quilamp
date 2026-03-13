# Quillamp

A modern, cross-platform clone of the classic Winamp media player built with Electron, Vite, and Vanilla JS/CSS. Designed to mimic the iconic late 90s digital interface natively on macOS.

## Features
- **Accurate Classic UI**: Mimics the classic layout (Main player and Playlist window).
- **Core Playback Controls**: Play, Pause, Stop, Previous, Next.
- **Playlist Management**: Eject (Open Dialog) to add `.mp3`, `.wav`, or `.ogg` files or drag & drop files directly onto the player.
- **Volume & Panning**: Volume slider (panning UI included, backend to be expanded).
- **Draggable Frameless Windows**: Fully native feel with invisible borders and a custom draggable titlebar.

## Quick Start (Development)

Ensure you have [Node.js](https://nodejs.org/) installed, then follow these steps:

1. Navigate to the repository:
   ```bash
   cd quillamp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and Start the application:
   ```bash
   npm run build
   npm start
   ```
   *Note: Using `npm run build` generates the required output in the `build/` directory, while `npm start` launches Electron pointing to that build folder.*

## Building / Packaging (macOS)

To build a distributable macOS Application (`.app` and `.dmg`), run the following command:

```bash
npm run dist
```

After the build completes, look in the `dist/` directory for the `Quillamp-1.0.0-mac.zip` or `Quillamp-1.0.0.dmg`. Build uses standard `electron-builder` Mac templates.

## Built With
- **Electron**
- **Vite**
- **Vanilla web tech**