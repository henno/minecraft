# Project Research Summary

**Project:** tseburek
**Domain:** Browser-based voxel engine (Minecraft-like)
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

A browser-based voxel engine in the Minecraft style is a well-studied problem domain with established, high-confidence patterns. The core insight that separates functional engines from broken demos is architectural: chunk-level batched rendering (one draw call per chunk, never one per block), flat typed arrays for voxel storage, and CPU-intensive work (terrain generation and mesh building) moved to Web Workers from the start. Experts build these systems in layers — data structures first, world management second, rendering third, interaction fourth — because every layer depends on a solid foundation beneath it. The recommended stack is TypeScript + Three.js + Vite + simplex-noise, all at stable current versions with no framework overhead.

The recommended approach is to build the chunk system as the absolute foundation before any other feature, because the feature dependency graph shows every major system (collision, interaction, rendering, meshing) routes through chunk data access. Greedy meshing should be the default meshing strategy — not an optimization added later — because retrofitting it after naive culled meshing requires co-designing texture UV tiling and ambient occlusion simultaneously. The three highest-priority architectural decisions (flat Uint8Array storage, worker-offloaded generation, chunk-batched geometry) must be correct from day one; all have HIGH recovery cost if deferred.

The primary risks are not conceptual but implementational: texture stretching on greedy-merged quads (requires fragment shader UV tiling from the start), GPU memory leaks from missing `.dispose()` calls (requires chunk lifecycle discipline), and blocking the main thread with synchronous generation (requires the worker boundary to be architectural, not bolted on). All six critical pitfalls identified in research are preventable if addressed in the correct phase and all have documented fixes. This is a buildable project with well-documented patterns — the research confidence is high enough to proceed directly to roadmap creation.

## Key Findings

### Recommended Stack

The stack is TypeScript 6.0.2 with Three.js 0.183.2 for WebGL rendering, Vite 8.0.3 as the dev server and bundler, and simplex-noise 4.0.3 (with alea 1.0.1 for seeded PRNG) for terrain generation. This combination is the dominant choice in production browser voxel engines and has no known conflicts. Three.js provides `BufferGeometry` which maps directly to the chunk mesh construction pattern — you build vertex attribute arrays and hand them to Three.js, which handles GPU uploads. Vite's native TypeScript support and sub-50ms HMR are particularly valuable when iterating on mesh generation code.

**Core technologies:**
- TypeScript 6.0.2: language — type safety for 3D coordinate math, chunk indexing, block type enums; catches off-by-one errors at compile time
- Three.js 0.183.2: WebGL rendering abstraction — provides Camera, BufferGeometry, and render loop; one-draw-call-per-chunk architecture maps cleanly to its API
- Vite 8.0.3: dev server and bundler — fast HMR for shader/geometry iteration; native Worker bundling with no config required
- simplex-noise 4.0.3 + alea 1.0.1: terrain generation — 70M calls/second, seeded for deterministic worlds, OpenSimplex patent-clear
- stats.js 0.17.0: development performance monitor — FPS/frame-time/memory overlay for catching meshing regressions

**Do not use:** BoxGeometry per block, InstancedMesh for terrain, React Three Fiber, WebGPU renderer, or the abandoned voxel.js library.

### Expected Features

The feature dependency graph converges on the chunk system as the universal prerequisite. Collision, interaction, meshing, and rendering all require chunk data access — this drives the phase ordering more than any other finding.

**Must have (table stakes):**
- Chunk-based world with load/unload — without this nothing else works
- Simplex noise terrain generation — flat terrain is not a voxel engine
- Face culling + chunk-level merged meshing — required for any usable framerate
- Texture atlas with 5-10 block types (grass, dirt, stone, sand, wood) — visual baseline
- First-person camera with WASD + mouse look (Pointer Lock API)
- Player collision detection (AABB sweep) + gravity
- Block placing and breaking via left/right click (DDA raycast)
- Fog at render distance boundary — hides missing chunks, mandatory for presentation quality
- Basic directional face shading (top=1.0, sides=0.7, bottom=0.5 brightness multiplier)

**Should have (competitive):**
- Greedy meshing — 10-18x vertex count reduction; enables longer render distances at 60fps
- Ambient occlusion (per-vertex, baked at mesh time) — the single largest visual upgrade
- Targeted block highlight (wireframe outline on aimed block) — low effort, high UX value
- Web Worker terrain and mesh generation — eliminates frame stutter on chunk load
- Biomes (2+ terrain types via noise blending)

**Defer (v2+):**
- Transparent water with separate render pass
- Day/night cycle
- Adjustable render distance UI
- Save/load world persistence (IndexedDB)
- Mobile/touch controls

**Anti-features (reject entirely):** Multiplayer, inventory/crafting, mobs/entity AI, WebGPU renderer, real-time global illumination.

### Architecture Approach

The canonical architecture separates the engine into five isolated layers: Game Loop (main thread coordinator), World Manager (chunk registry, load/unload orchestration), Terrain/Mesh Workers (CPU-intensive data generation off main thread), Render Layer (Three.js scene, one Mesh per chunk), and Player subsystems (physics, camera, interaction). Data flows in one direction: terrain workers produce Uint8Array chunk data, mesh workers consume chunk data and produce Float32Array geometry buffers (transferred zero-copy), the main thread applies finished geometry to Three.js Mesh objects. All block writes route through `World.setBlock()` — there is one owner of voxel data.

**Major components:**
1. World Manager — chunk registry (`Map<string, Chunk>`), load/unload queue, dirty set for remeshing; drives the entire data pipeline
2. Terrain Worker — receives chunk coordinates, runs simplex noise, returns Uint8Array via transferable postMessage; no Three.js imports
3. Mesh Worker — receives chunk data + 6 neighbour arrays, runs greedy meshing + AO bake, returns Float32Array geometry buffers; no Three.js imports
4. Render Layer — Three.js WebGLRenderer, one Mesh per chunk, texture atlas, ChunkMaterial; never touches raw voxel data
5. Player subsystems — InputManager, PlayerCamera (mouse look + pointer lock), PlayerPhysics (AABB collision vs World), BlockPicker (DDA raycast)
6. Block Registry — block type definitions, ID-to-UV mapping, properties; no runtime dependencies

**Build order:** `coords.ts + BlockRegistry` → `Chunk (data)` → `NoiseGenerator + TerrainRules` → `GreedyMesher + AoCalculator` → `World + worker wiring` → `Renderer + TextureAtlas` → `InputManager + PlayerCamera` → `PlayerPhysics + BlockPicker` → `Game (orchestration)`. Steps 3-4 and 6-7 can be developed in parallel.

### Critical Pitfalls

1. **Per-block draw calls** — never add individual block meshes to the scene; use one merged `BufferGeometry` per chunk from day one; recovery cost is HIGH (complete rewrite)
2. **Synchronous chunk generation on main thread** — move terrain generation to Web Workers before first render-distance test; causes multi-second freezes at realistic distances; retrofit cost is MEDIUM but requires rewriting the generation pipeline
3. **Nested array voxel storage (`blocks[x][y][z]`)** — use `new Uint8Array(W * H * D)` with index helpers from day one; 3-10x slower to iterate than typed arrays; recovery requires rewriting all voxel access code
4. **Texture stretching with greedy meshing** — design UV tiling strategy (fragment shader `fract(uv_scaled)` or `TEXTURE_2D_ARRAY`) before writing the greedy mesher; the meshing algorithm and shader UV approach must be co-designed
5. **Missing `.dispose()` on chunk unload** — implement chunk lifecycle (create → add → update → remove → dispose) from the first chunk unload; GPU memory leak causes progressive degradation after minutes of play; monitor `renderer.info.memory.geometries`
6. **AO quad orientation artifact** — when adding ambient occlusion, flip triangle winding based on diagonal AO sum comparison (Mikola Lysenko's formula); 3 lines of code that are nearly impossible to add cleanly after the fact

## Implications for Roadmap

Based on the feature dependency graph, architecture build order, and pitfall phase-mapping, four phases are suggested:

### Phase 1: Foundation — Data Structures, World System, and Core Rendering

**Rationale:** The chunk system is the dependency root for every other feature. The three highest-recovery-cost pitfalls (per-block draw calls, nested arrays, synchronous generation) must all be avoided here. Getting the data structures and worker boundary wrong requires rewriting the entire engine.

**Delivers:** A working voxel world rendered in the browser — procedural terrain, infinite chunk loading, first-person navigation — but without block interaction, textures, or lighting.

**Addresses (from FEATURES.md):** Chunk-based world with load/unload, simplex noise terrain, face culling + chunk meshing, basic camera, player gravity

**Avoids (from PITFALLS.md):** Per-block draw calls (P6), nested array storage (P4), synchronous generation (P2)

**Architecture components:** coords.ts, BlockRegistry, Chunk, NoiseGenerator, TerrainRules, GreedyMesher (face-culled, not yet greedy), World Manager, Worker wiring, Renderer, PlayerCamera, PlayerPhysics

**Note:** Use culled meshing (not greedy) in this phase to avoid the texture/AO co-design complexity. Greedy is a Phase 2 upgrade.

### Phase 2: Interaction and Visual Completeness

**Rationale:** Once the world renders and the player can navigate, add the interaction loop and visual baseline. Texture atlas design must happen here alongside chunk remeshing — the "looks done but isn't" checklist items (chunk boundary seams, texture bleeding, chunk dispose) all belong here.

**Delivers:** A playable demo — the player can walk around, place and break blocks, and the world looks like a Minecraft-style game with correct textures.

**Addresses (from FEATURES.md):** Block placing/breaking, texture atlas (5-10 types), fog at render boundary, directional face shading, targeted block highlight, chunk dispose on unload

**Avoids (from PITFALLS.md):** Missing `.dispose()` on unload (P3), chunk boundary seams, texture bleeding, right-click context menu (add `e.preventDefault()`), pointer lock UX issues

**Architecture components:** TextureAtlas, ChunkMaterial, BlockPicker (DDA raycast), World.setBlock() with dirty propagation to neighbour chunks, chunk lifecycle management

### Phase 3: Visual Upgrade — Greedy Meshing and Ambient Occlusion

**Rationale:** Greedy meshing and AO must be designed together because they have a known conflict (AO values break naive greedy merge). Implementing them in the same phase forces the co-design. This phase upgrades an already-working engine rather than building foundational systems, so failure here doesn't break Phase 1-2 functionality.

**Delivers:** A visually polished engine with dramatically lower triangle counts (4K vs 72K vertices per 32³ chunk) and soft shadowing that makes cubes read as solid 3D without dynamic lights.

**Addresses (from FEATURES.md):** Greedy meshing, ambient occlusion, fragment shader UV tiling (required for greedy + textured surfaces)

**Avoids (from PITFALLS.md):** Texture stretching on greedy quads (P1), AO quad orientation artifact (P5)

**Architecture components:** GreedyMesher (upgraded from culled-only), AoCalculator, ChunkMaterial (upgraded to ShaderMaterial with UV tiling)

**Note:** This phase benefits from moving mesh generation to a Web Worker (it becomes noticeably slower with greedy+AO). Web Worker meshing can be added here or pulled forward into Phase 1 architecture.

### Phase 4: Performance and Polish

**Rationale:** With a correct and visually complete engine, address the remaining differentiators and performance scaling. These features all depend on a stable Phase 1-3 foundation.

**Delivers:** An engine that performs at larger render distances and has world-richness features (biomes) and quality-of-life polish.

**Addresses (from FEATURES.md):** Web Worker terrain and mesh generation (if not done in Phase 1), biomes (2+ types via noise blending), adjustable render distance, day/night cycle (optional), transparent water (optional)

**Avoids (from PITFALLS.md):** Main-thread stutter at large render distances, chunk eviction LRU (memory growth), generating all chunks at startup (use spiral priority queue)

### Phase Ordering Rationale

- Phase 1 before everything: the chunk system is the dependency root; every other feature requires it; three critical pitfalls must be avoided here or recovery costs are HIGH
- Interaction (Phase 2) before visual upgrades (Phase 3): a working interaction loop validates the engine before investing in meshing complexity; it also forces correct chunk remeshing on edit before AO adds complexity
- Greedy meshing and AO together (Phase 3): they have a documented conflict (AO breaks naive greedy merge); designing them separately and then integrating is harder than designing them together
- Performance and polish last (Phase 4): these are improvements to an already-correct engine; none of them are prerequisite for demonstrating the engine concept

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Greedy Meshing + AO):** The UV tiling strategy (fragment shader fract() vs TEXTURE_2D_ARRAY) has browser support and GLSL complexity tradeoffs that should be validated before implementation begins. The AO quad-flip algorithm is well-documented but the integration with greedy merging needs careful design.
- **Phase 4 (Transparent Water):** Correct transparency requires a separate render pass and back-to-front sorting — the implementation details depend on how the render loop is structured in Phase 1-2 and may need research on Three.js transparency options.

Phases with standard patterns (skip research):
- **Phase 1:** Well-documented patterns from Three.js manual (voxel geometry tutorial), simplex-noise README, and multiple production engine post-mortems. No unknowns.
- **Phase 2:** Standard input patterns, DDA raycast is well-documented, texture atlas is a solved problem. No unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions confirmed via npm registry March 2026; official docs for all core libraries; no known conflicts between recommended versions |
| Features | HIGH (table stakes), MEDIUM (differentiators) | Table stakes from production engine analysis (noa, voxel.js) and three.js voxel tutorial; AO and biome details are MEDIUM — community consensus, not official spec |
| Architecture | HIGH | Multiple primary sources agree on chunk-based architecture; worker pattern validated by 0fps.net, vercidium, TypeScript production engine post-mortem |
| Pitfalls | HIGH | 0fps.net technical series is the authoritative source for voxel engine pitfalls; confirmed by real project post-mortems (voxel.js retrospective, Three.js forum posts) |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact chunk size (16x16 vs 32x32):** Research supports both; 16x16 columns (Minecraft-standard) or 32³ cubes. Decision affects memory, meshing time, and worker message frequency. Validate choice against target render distance before Phase 1 implementation.
- **UV tiling strategy for greedy meshing:** Fragment shader `fract()` approach vs `TEXTURE_2D_ARRAY`. The latter requires WebGL2 (universal in 2026) but adds texture management complexity. Decide before Phase 3 begins — this choice is baked into the ChunkMaterial shader.
- **Worker count and back-pressure strategy:** Research recommends limiting in-flight worker tasks (max 4 concurrent) but the optimal number depends on target hardware and chunk size. Validate empirically during Phase 1 performance testing.
- **Cave system scope:** 3D cave noise (simplex-noise 3D) is ~3x more noise calls than 2D height maps. If caves are in scope, terrain worker performance budget must account for this. Decide at Phase 1 planning time.

## Sources

### Primary (HIGH confidence)
- https://threejs.org/manual/en/voxel-geometry.html — Three.js official voxel geometry tutorial; chunk structure, face culling, BufferGeometry
- https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/ — canonical greedy meshing algorithm
- https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/ — canonical AO algorithm and quad orientation fix
- https://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/ — texture atlas pitfalls with greedy meshing
- https://0fps.net/2012/01/14/an-analysis-of-minecraft-like-engines/ — flat vs nested array performance analysis
- https://github.com/jwagner/simplex-noise.js — simplex-noise README; v4.x API, performance numbers, alea integration
- https://vite.dev/guide/ — Vite official docs; Worker bundling, HMR
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices — WebGL resource disposal, draw call limits
- npm registry (live query March 2026) — confirmed versions for all packages

### Secondary (MEDIUM confidence)
- https://vercidium.com/blog/voxel-world-optimisations/ — run-based merging, packed vertex data, 5.7x meshing speedup
- https://www.jameshylands.co.uk/2022/10/greedy-meshing-in-javascript.html — 72K vs 4K vertex reduction numbers for 32³ chunk
- https://github.com/fenomas/noa — noa engine; production voxel engine feature baseline (used by Minecraft Classic web)
- https://discourse.threejs.org/t/optimizing-my-minecraft-clone/82550 — real-world Three.js voxel performance problems
- https://medium.com/@deathcap1/six-months-of-voxel-js-494be64dd1cc — voxel.js post-mortem; texture stretching, architectural coupling
- https://dev.to/lucasdamianjohnson/how-i-made-multi-threaded-voxel-engine-in-typescript-1e8f — SharedArrayBuffer chunk approach, TypeScript multi-threaded voxel engine

### Tertiary (LOW confidence)
- https://discourse.threejs.org/t/how-to-make-a-ultra-optimized-voxel-terrain-like-this-in-a-html-file/83315 — instancing vs BufferGeometry tradeoffs (forum post, not verified)
- https://blog.adventurebox.com/2015/02/11/texturing-greedy-meshes-in-voxel-worlds/ — greedy mesh UV fragment shader approach (older post, technique still valid)

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
