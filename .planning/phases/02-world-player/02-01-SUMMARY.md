---
phase: 02-world-player
plan: "01"
subsystem: rendering
tags: [texture-atlas, voxel, uv, shading]
completed: 2026-03-28
---

# Phase 2 Plan 01 Summary

- Added `src/rendering/TextureAtlas.ts` with a runtime canvas atlas for `grass-top`, `grass-side`, `dirt`, `stone`, `sand`, and `water` tiles.
- Atlas tiles use 16x16 pixel-art patterns, nearest-neighbour filtering, disabled mipmaps, and 1px edge bleeding inside padded cells to avoid texture bleed.
- Extended `src/world/BlockRegistry.ts` so blocks can map different tiles per face; grass now uses top/side/dirt face splits.
- Updated `src/meshing/CulledMesher.ts` to emit atlas UVs and per-face vertex colors for directional shading while preserving hidden-face culling.
- Wired a shared textured material through `src/rendering/ChunkMaterial.ts` and `src/core/Game.ts`.
