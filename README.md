# Tseburek

Browser voxel engine built with TypeScript, Three.js, and Vite. It generates an effectively infinite block world in the browser, streams chunks around the player, and supports the classic break/place interaction loop with a pixel-art texture atlas.

## Public Demo

- GitHub Pages: `https://henno.github.io/minecraft/`

## Project Status

- v1 complete
- All three planned phases are finished
- Current build includes terrain streaming, first-person controls, collisions, textured blocks, water, and block editing
- Latest local validation recorded smooth 120 FPS in a Chromium dev session with roughly a 9x9 visible chunk area and draw calls in the low 50s

## Features

- Infinite procedural terrain generated from deterministic 2D simplex noise
- Chunk-based world streaming with worker-driven terrain generation
- Chunk-batched culled meshes for solid terrain and a separate transparent water pass
- First-person movement with pointer lock, mouse look, WASD movement, gravity, jumping, and voxel collision
- Break and place interactions with immediate chunk remeshing, including chunk-border edits
- Runtime-generated 16x16 pixel-art texture atlas
- Seven placeable block types: grass, dirt, stone, sand, water, wood, and leaves
- Fog, directional lighting, crosshair, status bar, hotbar, and dev-only FPS stats

## Tech Stack

- TypeScript
- Three.js on WebGL
- Vite
- simplex-noise + alea
- stats.js in development

## Requirements

- Node.js 20+ recommended
- npm 10+ recommended
- Modern desktop browser with WebGL support (Chrome, Firefox, or Safari)

## Setup

```bash
npm install
```

## Run Locally

Start the dev server:

```bash
npm run dev
```

Then open the local URL printed by Vite.

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Build with the GitHub Pages base path locally:

```bash
GITHUB_PAGES=true GITHUB_REPOSITORY=henno/minecraft npm run build
```

## Deployment

- Push to `main` to trigger `.github/workflows/deploy-pages.yml`
- The workflow installs dependencies, builds the Vite app, and publishes `dist/` to GitHub Pages
- The production build automatically uses the repository base path when `GITHUB_PAGES=true`

## Controls

- Click the canvas to lock the pointer and enter the game
- `W`, `A`, `S`, `D`: move
- Mouse: look around
- `Space`: jump
- Left click: break targeted block
- Right click: place selected block on the targeted face
- `1`-`7`: select block in the hotbar
- `Esc`: release pointer lock

## How It Works

- World data is stored in `16 x 64 x 16` chunks backed by flat `Uint8Array` voxel buffers
- Terrain generation runs in `src/terrain/TerrainWorker.ts`, keeping chunk generation off the main thread
- Meshing emits only visible faces and rebuilds edited chunks incrementally
- The renderer uses `THREE.WebGLRenderer` for broad browser compatibility

## Current Scope

Included in v1:

- Infinite terrain streaming around the player
- Textured voxel terrain with translucent water
- First-person exploration and block interaction
- Performance instrumentation through `window.__tseburekDebug`

Deliberately out of scope for v1:

- Multiplayer
- Crafting or inventory systems
- World save/load persistence
- Mobile/touch controls
- WebGPU

## Project Structure

```text
src/
  core/        Game loop and renderer setup
  input/       Keyboard, mouse, and interaction input
  meshing/     Chunk mesh generation
  player/      Camera and voxel collision physics
  rendering/   Materials and runtime texture atlas
  terrain/     Noise, terrain rules, and worker entry
  utils/       Coordinate helpers
  world/       Chunk storage, block registry, streaming
```

## Notes

- The world seed is currently fixed to `tseburek`
- Water is non-solid in v1 and renders in a dedicated transparent pass
- The FPS panel from `stats.js` is only attached in development builds
