# Requirements: Tseburek

**Defined:** 2026-03-27
**Core Value:** Performant infinite terrain generation and rendering in the browser

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Terrain & World

- [ ] **TERR-01**: Procedural terrain generates infinite landscape using simplex/Perlin noise with octaves
- [ ] **TERR-02**: World is divided into chunks that load/unload as the player moves
- [ ] **TERR-03**: Terrain includes varied elevation (hills, valleys, flat areas)
- [ ] **TERR-04**: Chunks load progressively by distance to player (no hard pop-in)
- [ ] **TERR-05**: Fog hides chunk boundaries at render distance edge

### Rendering

- [ ] **REND-01**: Blocks render with 16x16 pixel art textures via a texture atlas
- [ ] **REND-02**: Hidden faces between adjacent solid blocks are culled (not emitted)
- [ ] **REND-03**: Basic directional lighting using face-normal shading (top bright, sides mid, bottom dark)
- [ ] **REND-04**: Engine maintains 60fps at reasonable render distance on modern hardware
- [ ] **REND-05**: Water blocks render as transparent/translucent with visible tint

### Player & Controls

- [ ] **PLYR-01**: First-person camera with mouse look (Pointer Lock API)
- [ ] **PLYR-02**: WASD movement relative to camera direction
- [ ] **PLYR-03**: Player has gravity and falls when not on solid ground
- [ ] **PLYR-04**: Player collides with solid blocks (AABB collision detection)
- [ ] **PLYR-05**: Player can jump

### Block Interaction

- [ ] **BLCK-01**: Player can break blocks with left click (raycast to target)
- [ ] **BLCK-02**: Player can place blocks with right click on adjacent face
- [ ] **BLCK-03**: 5-10 block types available: grass, dirt, stone, sand, water, wood, leaves
- [ ] **BLCK-04**: Breaking/placing triggers chunk remesh for affected chunk

### Technical Foundation

- [ ] **TECH-01**: TypeScript codebase with Vite build tooling
- [ ] **TECH-02**: Chunk data stored as flat typed arrays (Uint8Array) for performance
- [ ] **TECH-03**: One BufferGeometry per chunk (not per block) for draw call efficiency
- [ ] **TECH-04**: Web Worker(s) for terrain generation to avoid main thread blocking

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Visual Enhancements

- **VIS-01**: Greedy meshing to reduce vertex count (~10x improvement)
- **VIS-02**: Per-vertex ambient occlusion for depth perception
- **VIS-03**: Day/night cycle with moving sun and sky color changes
- **VIS-04**: Biomes with 2+ distinct terrain types (plains, desert, ocean)

### Quality of Life

- **QOL-01**: Wireframe highlight on targeted block
- **QOL-02**: Adjustable render distance setting
- **QOL-03**: Save/load world to browser storage (IndexedDB)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multiplayer / networking | Separate project of equal size — requires server, anti-cheat, latency compensation |
| Inventory / crafting | Game mechanics, not engine features — inverts priorities |
| Mobs / entity system | Requires pathfinding, AI, animation — each a non-trivial sub-system |
| Sound / music | Visual engine focus only |
| Mobile / touch controls | Different interaction paradigm — desktop browsers cover target audience |
| WebGPU rendering | Incomplete Safari support; WebGL + optimizations sufficient |
| Real-time global illumination | Computationally prohibitive in browser; face-normal shading + AO (v2) covers 90% |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TECH-01 | Phase 1 | Pending |
| TECH-02 | Phase 1 | Pending |
| TECH-03 | Phase 1 | Pending |
| TECH-04 | Phase 1 | Pending |
| TERR-01 | Phase 1 | Pending |
| TERR-02 | Phase 1 | Pending |
| TERR-03 | Phase 1 | Pending |
| TERR-04 | Phase 2 | Pending |
| TERR-05 | Phase 2 | Pending |
| REND-01 | Phase 2 | Pending |
| REND-02 | Phase 2 | Pending |
| REND-03 | Phase 2 | Pending |
| PLYR-01 | Phase 2 | Pending |
| PLYR-02 | Phase 2 | Pending |
| PLYR-03 | Phase 2 | Pending |
| PLYR-04 | Phase 2 | Pending |
| PLYR-05 | Phase 2 | Pending |
| BLCK-01 | Phase 3 | Pending |
| BLCK-02 | Phase 3 | Pending |
| BLCK-03 | Phase 3 | Pending |
| BLCK-04 | Phase 3 | Pending |
| REND-04 | Phase 3 | Pending |
| REND-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
