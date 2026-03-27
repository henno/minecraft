# Roadmap: Tseburek

## Overview

Three phases from nothing to a playable browser voxel engine. Phase 1 establishes the technical foundation — the data structures, chunk system, terrain generation, and rendering pipeline that everything else depends on. Phase 2 makes the world visible and navigable — textures, lighting, fog, and a player who can walk around. Phase 3 delivers the complete engine — block breaking and placing, transparent water, and 60fps performance validation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - TypeScript project, chunk data structures, Web Worker terrain generation, and chunk-batched rendering pipeline
- [ ] **Phase 2: World & Player** - Textured visible world with lighting and fog, first-person player with physics and controls
- [ ] **Phase 3: Interaction & Completeness** - Block breaking/placing, water rendering, 60fps performance target met

## Phase Details

### Phase 1: Foundation
**Goal**: A TypeScript/Vite project exists that generates procedural terrain in chunks, stores voxel data in flat typed arrays, offloads generation to Web Workers, and renders chunk-batched geometry in a browser
**Depends on**: Nothing (first phase)
**Requirements**: TECH-01, TECH-02, TECH-03, TECH-04, TERR-01, TERR-02, TERR-03
**Success Criteria** (what must be TRUE):
  1. Opening the project in a browser shows procedural 3D terrain with hills and valleys (no flat plane)
  2. The browser console shows no errors; the renderer uses one draw call per chunk, not one per block
  3. Terrain data is generated in a Web Worker — the main thread does not freeze during chunk generation
  4. Voxel data is stored as Uint8Array flat arrays; chunk geometry uses a single BufferGeometry per chunk
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Vite scaffold + shared types (ChunkCoord, BlockIds) + coords utils + BlockRegistry + Chunk data class
- [x] 01-02-PLAN.md — Terrain Web Worker: NoiseGenerator (4-octave FBM) + TerrainRules (block placement) + TerrainWorker entry point
- [ ] 01-03-PLAN.md — World Manager (chunk registry, worker orchestration, back-pressure) + CulledMesher (face-culled geometry builder)
- [ ] 01-04-PLAN.md — Three.js Renderer + Game loop (wires everything) + human verification: browser shows terrain

### Phase 2: World & Player
**Goal**: The world looks like a Minecraft-style game and the player can freely explore it — chunks load and unload as the player moves, textures and lighting are visible, fog hides the render boundary, and the player has gravity, collision, and jump
**Depends on**: Phase 1
**Requirements**: TERR-04, TERR-05, REND-01, REND-02, REND-03, PLYR-01, PLYR-02, PLYR-03, PLYR-04, PLYR-05
**Success Criteria** (what must be TRUE):
  1. Blocks render with correct 16x16 pixel art textures drawn from a texture atlas; block faces are identifiable (grass, dirt, stone, etc.)
  2. Walking toward the world horizon loads new chunks progressively without hard pop-in; walking away unloads distant chunks
  3. Fog fades the terrain at the render distance boundary so chunk edges are never visible
  4. The player can look around with the mouse, move with WASD, falls off edges, lands on terrain, and can jump
  5. Adjacent solid blocks do not render shared faces; directional shading makes top faces brighter than sides
**Plans**: TBD
**UI hint**: yes

### Phase 3: Interaction & Completeness
**Goal**: The engine is complete — the player can break and place blocks, water renders as translucent, and the engine maintains 60fps at a reasonable render distance on modern hardware
**Depends on**: Phase 2
**Requirements**: BLCK-01, BLCK-02, BLCK-03, BLCK-04, REND-04, REND-05
**Success Criteria** (what must be TRUE):
  1. Left-clicking a block removes it; the chunk remeshes immediately and the gap is visible
  2. Right-clicking an adjacent block face places the selected block type; all 5-10 block types can be placed
  3. Water blocks render as translucent with a visible blue tint; blocks below water are visible through it
  4. The engine runs at 60fps with a reasonable render distance (8+ chunks) on a modern desktop GPU
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/4 | In Progress|  |
| 2. World & Player | 0/TBD | Not started | - |
| 3. Interaction & Completeness | 0/TBD | Not started | - |
