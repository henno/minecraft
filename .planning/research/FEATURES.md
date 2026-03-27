# Feature Research

**Domain:** Browser-based voxel engine (Minecraft-like)
**Researched:** 2026-03-27
**Confidence:** HIGH (core rendering/table stakes), MEDIUM (differentiators), LOW (advanced visual features)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| First-person camera with mouse look | Every 3D game in this genre uses first-person WASD + mouse look; anything else feels alien | LOW | Pointer Lock API; pitch/yaw clamping required |
| Chunk-based infinite terrain | "Infinite world" is Minecraft's core promise; finite terrain breaks immersion immediately | HIGH | 16x16 or 32x32 columns; chunk load/unload as player moves |
| Procedural terrain generation | Flat worlds feel like demos, not engines; noise-based landscape is the baseline | MEDIUM | Perlin/simplex noise with octaves for realistic hills |
| Block placing (right-click) | Core interaction loop; without it you have a viewer, not a game | LOW | Raycast to find target face, then place on adjacent voxel |
| Block breaking (left-click) | Core interaction loop paired with placing | LOW | Raycast + voxel deletion + chunk remesh |
| Player collision detection | Without it the player falls through the world | MEDIUM | AABB sweep against solid voxels; common source of bugs |
| Basic block types (5-10 types) | Users expect visual variety: grass, dirt, stone, sand, water minimum | LOW | Texture atlas; block ID → UV lookup |
| 16x16 pixel art block textures | The aesthetic is the expectation for this genre; photo-real or flat-color feel wrong | LOW | Single texture atlas PNG; UV per block face |
| Render distance with fog | Without fog, missing chunks are visible as hard edges; fog hides the seam | LOW | Distance-based fog in fragment shader; short render distance is acceptable |
| Gravity / falling | Player should fall when in the air; otherwise exploration feels floaty and broken | LOW | Simple Y-axis acceleration; stop on solid block below |
| Face culling (hidden face removal) | Without this, performance collapses at even modest render distances | MEDIUM | Do not emit faces between two solid adjacent voxels |
| Smooth chunk loading (no pop-in) | Hard pop-in as chunks appear is jarring; even basic async loading reduces this | MEDIUM | Load chunks progressively; prioritize by distance to player |
| Basic directional lighting / shading | Flat-shaded cubes with no light variation look wrong; even simple top-face brightening reads as 3D | LOW | Multiply vertex color by face-normal factor; top=1.0, sides=0.7, bottom=0.5 |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for basic viability, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Greedy meshing | Dramatically reduces vertex/triangle count (often 10x) by merging coplanar same-type faces; enables longer render distances at 60fps | HIGH | More complex than simple culled meshing; requires careful handling at chunk borders and with AO |
| Ambient occlusion (AO) per vertex | Makes cubes look solid and 3D without dynamic lights; the single biggest visual upgrade over flat shading | HIGH | Sample 3 neighbors per vertex corner; encode as vertex color; see 0fps.net article for canonical algorithm |
| Web Worker terrain generation | Moves noise computation off the main thread; eliminates frame stutter when new chunks load | MEDIUM | postMessage chunk data back to main thread; SharedArrayBuffer optional but beneficial |
| Transparent / translucent water | Water that you can see through and that renders differently (tint, alpha, no top-face cull) is a major visual differentiator | MEDIUM | Requires separate render pass for transparent geometry; sorting by distance from camera |
| Biomes (2+ terrain types) | Multiple terrain characters (plains, desert, ocean, hills) dramatically increases perceived world richness | MEDIUM | Blend noise maps or use temperature/humidity axes to select terrain style per column |
| Adjustable render distance setting | Users vary widely in hardware; a slider or keyboard shortcut lets the engine show off on fast machines and stay playable on slow ones | LOW | Dynamic chunk load radius; regenerate chunk ring on change |
| Sky with day/night cycle | Moving sun and color-shifting sky transforms a demo into a world | MEDIUM | Three.js sky shader or gradient background; rotate directional light over time |
| Highlight targeted block | A wireframe or tinted outline on the block the cursor is aimed at is ubiquitous in the genre and dramatically improves UX | LOW | Raycast result → render a slightly expanded cube wireframe at that position |
| Sub-chunk or per-column height map optimization | Skip generating air-only chunks above terrain; speeds up initial world load significantly | MEDIUM | Precompute max height per column; don't allocate chunk above it |
| TypeScript types for block/chunk API | For an engine intended to be extended, typed APIs make it far easier to build on top of | LOW | Minimal runtime cost; high developer experience value |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this scope.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multiplayer / networking | "Let me show my friend my world" is a natural ask | Requires authoritative server, anti-cheat, latency compensation, persistent world storage — a separate project of equal size | Single-player demo is a complete deliverable; multiplayer can be a separate milestone with its own phase plan |
| Inventory and crafting system | Minecraft has it; people assume it belongs | These are game mechanics, not engine features; implementing them before the engine is stable inverts priorities and creates scope creep | Defer entirely; place/break interaction demonstrates the engine without game-layer complexity |
| Mobs / entity system | Adds life to the world | Requires pathfinding, AI state machines, physics for moving objects, animation — each a non-trivial sub-system | Out of scope; the terrain and interaction loop are the deliverable |
| Save / load world persistence | Users want to return to their world | IndexedDB or server storage adds complexity; browser storage limits are real; debugging persistence adds a testing dimension | Skip for engine demo; add as a later milestone if validated |
| Mobile / touch controls | Wider reach | Touch input for a first-person 3D engine requires virtual joystick, gyroscope look, or both — major UX work for a different interaction paradigm | Desktop browsers (Chrome, Firefox, Safari) cover the target audience |
| Infinite vertical terrain (caves, deep stone) | Adds depth and exploration | Chunk columns that extend to arbitrary Y depth multiply chunk count, memory, and meshing work dramatically | Fixed world height (e.g. 64-128 blocks) + simple cave noise achieves the aesthetic without the cost |
| WebGPU rendering | "Newer = better" | WebGPU has incomplete Safari support as of 2026; switching from WebGL raises the compatibility floor significantly | Stay on WebGL; greedy meshing and worker-based generation solve the bottlenecks without requiring WebGPU |
| Real-time global illumination | Looks impressive in demos | Computationally prohibitive in a voxel world at browser performance budgets; even baked approaches are complex | Vertex AO + directional light with face-normal shading gives 90% of the perceptual depth at 1% of the cost |
| Occlusion culling (hardware) | Sounds like a free win | WebGL occlusion queries introduce GPU pipeline stalls; the round-trip latency (query → wait → cull) often costs more than just rendering the geometry | Frustum culling + face culling covers the main cases; greedy meshing reduces geometry enough that occlusion queries rarely pay off in voxel worlds |

---

## Feature Dependencies

```
[Infinite Terrain]
    └──requires──> [Chunk System]
                       └──requires──> [Procedural Noise Generation]
                       └──requires──> [Chunk Load/Unload]

[Block Placing / Breaking]
    └──requires──> [Raycast (block targeting)]
                       └──requires──> [Chunk System]
    └──requires──> [Chunk Remesh on Edit]

[Player Movement]
    └──requires──> [Collision Detection]
                       └──requires──> [Chunk System] (need voxel data to test against)
    └──requires──> [Gravity]

[Rendering]
    └──requires──> [Face Culling] (for any viable performance)
    └──requires──> [Chunk Meshing]
                       └──enhances──> [Greedy Meshing] (optional upgrade path)
    └──requires──> [Texture Atlas]

[Ambient Occlusion]
    └──requires──> [Chunk Meshing] (AO is baked per vertex at mesh-build time)
    └──conflicts──> [Greedy Meshing] (naively; requires AO-aware greedy merge that groups by AO value)

[Water / Transparency]
    └──requires──> [Separate Render Pass for Transparency]
    └──requires──> [Chunk System]

[Biomes]
    └──requires──> [Procedural Noise Generation]
    └──enhances──> [Infinite Terrain]

[Web Worker Terrain Gen]
    └──requires──> [Chunk System]
    └──enhances──> [Infinite Terrain] (removes stutter on chunk load)

[Day/Night Cycle]
    └──requires──> [Directional Light]
    └──enhances──> [Sky rendering]
```

### Dependency Notes

- **Chunk System is the foundation:** Everything else depends on it. It must be designed well before anything else is built on top.
- **Collision detection requires chunk data:** Player movement can't be implemented correctly without access to voxel occupancy data from the chunk system.
- **Ambient occlusion conflicts with naive greedy meshing:** The canonical solution is to include AO values as part of the face-identity check during greedy merge — faces only merge if they share the same AO corner values. This is well-documented (see 0fps.net) but requires care.
- **Greedy meshing and Web Workers pair well:** Meshing is the most CPU-intensive task in a voxel engine; moving it to a worker is a natural optimization path once greedy meshing is working.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to demonstrate the engine concept.

- [ ] Chunk-based world system with load/unload — without this nothing else works
- [ ] Simplex/Perlin noise terrain generation — flat terrain is not a voxel engine
- [ ] Face culling + basic chunked meshing — required for any usable framerate
- [ ] Texture atlas with 5-10 block types (grass, dirt, stone, sand, wood, water) — visual completeness
- [ ] First-person camera (WASD + mouse look) — the only sensible control scheme
- [ ] Player collision detection + gravity — without it the world is unnavigable
- [ ] Block placing and breaking (left/right click) — the core interaction loop
- [ ] Fog at render distance boundary — hides missing chunks, mandatory for presentation quality
- [ ] Basic directional shading (face-normal brightness multiplier) — minimal depth cue

### Add After Validation (v1.x)

Features to add once core is solid and performing well.

- [ ] Greedy meshing — add when baseline is working and profiling shows vertex count is the bottleneck
- [ ] Ambient occlusion — largest single visual upgrade; add after greedy meshing (they must be co-designed)
- [ ] Targeted block highlight — low effort, high UX improvement
- [ ] Web Worker for terrain/mesh generation — add when main thread frame stutter becomes noticeable during chunk loading
- [ ] Biomes (2 types minimum) — once world generation is stable, extend with biome selection

### Future Consideration (v2+)

Features to defer until the engine is proven.

- [ ] Transparent water with separate render pass — correct but adds rendering complexity
- [ ] Day/night cycle — nice world-feel upgrade, no gameplay dependency
- [ ] Adjustable render distance UI — polish feature; hard-code a reasonable default for v1
- [ ] Sub-column height map optimization — micro-optimization for later
- [ ] Save/load persistence — separate milestone with its own scope definition

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Chunk system | HIGH | HIGH | P1 |
| Noise terrain generation | HIGH | MEDIUM | P1 |
| Face culling | HIGH | MEDIUM | P1 |
| First-person camera | HIGH | LOW | P1 |
| Collision detection + gravity | HIGH | MEDIUM | P1 |
| Block place/break | HIGH | LOW | P1 |
| Texture atlas | HIGH | LOW | P1 |
| Directional face shading | HIGH | LOW | P1 |
| Fog at render boundary | MEDIUM | LOW | P1 |
| Targeted block highlight | MEDIUM | LOW | P2 |
| Greedy meshing | HIGH | HIGH | P2 |
| Ambient occlusion | HIGH | HIGH | P2 |
| Web Worker terrain gen | MEDIUM | MEDIUM | P2 |
| Biomes | MEDIUM | MEDIUM | P2 |
| Transparent water | MEDIUM | MEDIUM | P2 |
| Day/night cycle | LOW | MEDIUM | P3 |
| Adjustable render distance | LOW | LOW | P3 |
| Save/load | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — engine is not demonstrable without these
- P2: Should have — add when core is stable and performing well
- P3: Nice to have — future iteration

---

## Competitor Feature Analysis

Surveyed: voxel.js, noa-engine, Refloow/Minecraft-Like-Voxel-Game, MarcellPerger1/minecraft_clone_1, BLK game demo, voxelengine3

| Feature | voxel.js (2013-era) | noa-engine (active) | Typical hobbyist clone | Our Approach |
|---------|---------------------|---------------------|------------------------|--------------|
| Chunk system | Yes (32x32x32) | Yes, configurable | Usually 16x16 columns | 16x16 columns, standard Minecraft dimensions |
| Noise terrain | Yes | Client-provided | Yes | Simplex noise, 4-6 octaves |
| Greedy meshing | Optional module | Built-in | Rarely | Build greedy from start — it is the correct default |
| Ambient occlusion | Experimental module | Limited | Rarely | Target v1.x; major visual payoff |
| Physics / collision | Module (voxel-physics-engine) | Built-in | AABB, varies | AABB sweep; use noa's voxel-physics-engine as reference |
| Rendering library | Three.js | Babylon.js | Three.js or raw WebGL | Three.js — wider community, more examples |
| Block targeting raycast | Module | Built-in | Yes | Implement directly; simple DDA raycast |
| Web Workers | Some support | Partial | Rare | Target v1.x when stutter is measurable |
| Biomes | Not standard | Not standard | Sometimes | Target v1.x |
| TypeScript | No (original) | Yes | Varies | TypeScript from day one |

---

## Sources

- [voxel.js project site](https://voxel.github.io/voxeljs-site/) — original browser voxel engine, feature set baseline
- [noa voxel engine (fenomas/noa)](https://github.com/fenomas/noa) — production-used browser voxel engine; used by Minecraft Classic web version and bloxd.io
- [0fps.net — Ambient Occlusion for Minecraft-like Worlds](https://0fps.net/category/programming/voxels/) — canonical AO algorithm, lighting techniques, LOD discussion
- [Voxel meshing performance — Spacefarer blog](https://playspacefarer.com/voxel-meshing-performance/) — greedy meshing tradeoffs and chunk boundary issues
- [Faster WebGL with OffscreenCanvas and Web Workers — Evil Martians](https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers) — Web Worker architecture for Three.js; OffscreenCanvas browser support notes
- [Ben Coveney WebGL Voxel Experiments](https://bencoveney.com/posts/voxels.html) — first-person engine implementation notes, octree vs array tradeoffs
- [Refloow/Minecraft-Like-Voxel-Game](https://github.com/Refloow/Minecraft-Like-Voxel-Game) — JS voxel clone feature set reference
- [Greedy Meshing in JavaScript — James Hylands](https://www.jameshylands.co.uk/2022/10/greedy-meshing-in-javascript.html) — JS implementation of greedy meshing
- [High Performance Voxel Engine: Vertex Pooling — Nick McD](https://nickmcd.me/2021/04/04/high-performance-voxel-engine/) — advanced rendering optimizations

---
*Feature research for: Browser voxel engine (Minecraft-like)*
*Researched: 2026-03-27*
