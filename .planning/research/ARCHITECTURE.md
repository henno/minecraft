# Architecture Research

**Domain:** Browser-based voxel engine (Minecraft-like)
**Researched:** 2026-03-27
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Game Loop (main thread)                     │
│   Input → Physics → World Update → Render Commands                  │
├─────────────────────────────────────────────────────────────────────┤
│                         Subsystem Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  Input   │  │  Camera  │  │  Player  │  │  Block Interact  │    │
│  │ Manager  │  │ (FP view)│  │ Physics  │  │ (raycast pick)   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘    │
│       │             │             │                  │               │
├───────┴─────────────┴─────────────┴──────────────────┴──────────────┤
│                         World Manager                                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Chunk Registry (Map<ChunkKey, Chunk>)                         │  │
│  │  Load Queue  │  Unload Queue  │  Dirty Set (needs remesh)      │  │
│  └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│               Terrain Generation (Web Worker)                        │
│  ┌──────────────┐   ┌────────────────┐   ┌───────────────────────┐  │
│  │  Noise Gen   │ → │ Block Placement│ → │ Chunk Data (Uint8Array)│  │
│  │ (simplex/    │   │ (biome rules,  │   │  (flat 3D array,      │  │
│  │  perlin)     │   │  surface/cave) │   │   16×16×256 or 32³)   │  │
│  └──────────────┘   └────────────────┘   └───────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                     Mesh Builder (Web Worker)                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Face Culling → Greedy Meshing → BufferGeometry attributes     │  │
│  │  (position, uv, normal, ao baked per-vertex)                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      Render Layer (Three.js)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │  Chunk   │  │  Atlas   │  │ Lighting │  │   Scene / Camera   │   │
│  │  Meshes  │  │ Texture  │  │ (ambient │  │   (PerspectiveCam) │   │
│  │(THREE.   │  │(16×16 px │  │ + AO)    │  │                    │   │
│  │  Mesh)   │  │ sprites) │  │          │  │                    │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Input Manager | Captures keyboard/mouse, pointer lock, maps to actions | Event listeners, action flag map |
| Camera | First-person perspective, yaw/pitch from mouse delta | THREE.PerspectiveCamera, Euler rotation |
| Player Physics | AABB collision vs. voxel world, gravity, movement | Custom AABB vs chunk lookup, no physics lib |
| Block Interaction | Raycasting to find targeted block, place/break | DDA ray-march through chunk grid |
| World Manager | Tracks loaded chunks, drives load/unload by player position | Map<string, Chunk>, distance check each frame |
| Terrain Generator | Produces voxel data arrays for a given chunk coordinate | Web Worker, simplex-noise, returns Uint8Array |
| Mesh Builder | Converts voxel data to renderable geometry | Web Worker, greedy meshing, returns Float32Array |
| Render Layer | Takes finished geometry, puts it on screen | Three.js scene graph, one Mesh per chunk |
| Texture Atlas | Packs all block face sprites into one texture | Canvas 2D or OffscreenCanvas, UV lookup table |

## Recommended Project Structure

```
src/
├── core/                   # Bootstrap, game loop, engine entry
│   ├── Game.ts             # Top-level coordinator, owns the render loop
│   └── GameLoop.ts         # requestAnimationFrame wrapper, delta-time
│
├── world/                  # Everything about what exists in the world
│   ├── World.ts            # Chunk registry, load/unload orchestration
│   ├── Chunk.ts            # Data container: Uint8Array + position metadata
│   ├── ChunkMesh.ts        # Wraps THREE.Mesh, owns geometry lifecycle
│   └── BlockRegistry.ts    # Block type definitions, ID → properties map
│
├── terrain/                # Procedural generation (runs in worker)
│   ├── TerrainWorker.ts    # Worker entry point (receives coord, posts data)
│   ├── NoiseGenerator.ts   # Wraps simplex-noise, layered octaves
│   └── TerrainRules.ts     # Block placement logic (surface, cave, water)
│
├── meshing/                # Geometry construction (runs in worker)
│   ├── MeshWorker.ts       # Worker entry point (receives chunk data, posts geometry)
│   ├── GreedyMesher.ts     # Face culling + greedy quad merging
│   └── AoCalculator.ts     # Per-vertex ambient occlusion bake
│
├── player/                 # First-person player system
│   ├── Player.ts           # Aggregates camera, physics, interaction
│   ├── PlayerPhysics.ts    # AABB movement, gravity, collision vs. world
│   ├── PlayerCamera.ts     # Mouse look, pointer lock, view matrix
│   └── BlockPicker.ts      # DDA raycast → targeted block coords
│
├── input/                  # Raw input normalisation
│   └── InputManager.ts     # Keyboard state map, mouse delta accumulator
│
├── rendering/              # Three.js scene wiring
│   ├── Renderer.ts         # WebGLRenderer init, resize, render call
│   ├── TextureAtlas.ts     # Pack sprites, compute UV rects per block face
│   └── ChunkMaterial.ts    # THREE.ShaderMaterial or MeshLambertMaterial
│
└── utils/                  # Shared helpers
    ├── coords.ts           # World ↔ chunk ↔ local coord math
    └── pool.ts             # Object/buffer reuse pools
```

### Structure Rationale

- **terrain/ and meshing/**: Isolated because they run in Web Workers. No DOM or Three.js imports allowed here — pure data in, pure data out.
- **world/**: Owns the authoritative block data. All reads and writes to the voxel grid go through here, never bypassing to the render layer directly.
- **player/**: Depends on World for collision queries but never mutates world data directly — routes block edits through World's API.
- **rendering/**: Depends on meshed geometry only, not raw chunk data. The rest of the engine is rendering-library agnostic.
- **core/**: Thin orchestration. Game.ts wires components together and owns the loop; it should have no voxel logic of its own.

## Architectural Patterns

### Pattern 1: Worker-Offloaded Generation Pipeline

**What:** Terrain generation and mesh building run in separate Web Workers. The main thread only receives completed data via `postMessage` + transferable buffers (`ArrayBuffer`).

**When to use:** Always — mesh building for a 32³ chunk takes several milliseconds on the main thread and will cause visible frame drops. Web Workers prevent this.

**Trade-offs:** Adds message-passing complexity; eliminates main-thread stalls; SharedArrayBuffer can be used for chunk data shared across workers (requires COOP/COEP headers).

**Example:**
```typescript
// MeshWorker.ts (worker side)
self.onmessage = ({ data }) => {
  const { chunkData, position } = data;
  const geometry = buildGreedyMesh(chunkData);
  // Transfer ownership — zero-copy
  self.postMessage({ position, geometry }, [geometry.positions.buffer]);
};

// World.ts (main thread)
const worker = new Worker(new URL('./meshing/MeshWorker.ts', import.meta.url));
worker.postMessage({ chunkData, position });
worker.onmessage = ({ data }) => {
  applyGeometryToChunkMesh(data.position, data.geometry);
};
```

### Pattern 2: Chunk-Keyed Registry with Priority Ordering

**What:** The World Manager keeps a `Map<string, Chunk>` (key = `"x,z"` or `"x,y,z"`). Each frame it computes spiral-ordered chunk coordinates relative to the player and enqueues missing chunks for generation, unqueuing distant ones.

**When to use:** Always — naive "generate everything" causes CPU spikes; priority ordering by distance ensures nearest chunks load first.

**Trade-offs:** Requires a sorted priority queue; limits in-flight worker tasks (e.g. max 4 concurrent) to prevent memory pressure.

**Example:**
```typescript
// Spiral iteration outward from player chunk position
function* spiralChunkCoords(center: ChunkCoord, radius: number) {
  for (let r = 0; r <= radius; r++) {
    for (const offset of ringOffsets(r)) {
      yield { x: center.x + offset.x, z: center.z + offset.z };
    }
  }
}
```

### Pattern 3: Greedy Meshing with Baked Ambient Occlusion

**What:** Instead of emitting one quad per visible face, greedy meshing merges coplanar adjacent faces of the same block type into larger quads. Ambient occlusion is computed at mesh-build time by sampling the 4 diagonal neighbours of each vertex and encoding the darkening factor into vertex color or a custom attribute.

**When to use:** For all chunk mesh generation. The vertex reduction from greedy meshing is dramatic: a 32³ chunk drops from ~72K vertices (naive) to ~4K vertices (greedy). AO is nearly free to add here.

**Trade-offs:** Greedy quads break if block damage or per-block-face variation is needed (requires splitting merged quads); AO makes meshes slightly more expensive to build but eliminates need for dynamic lighting for the "Minecraft feel."

## Data Flow

### Terrain Load Flow

```
Player moves → World Manager detects uncovered chunks
    ↓
Priority sort (closest first) → TerrainWorker.postMessage({ chunkCoord })
    ↓ (async, worker thread)
NoiseGenerator samples 2D + 3D noise → TerrainRules places blocks
    ↓
Uint8Array chunk data transferred back → Chunk stored in registry
    ↓
MeshWorker.postMessage({ chunkData, neighbours })
    ↓ (async, worker thread)
GreedyMesher produces Float32Array positions/uvs/normals
    ↓
Main thread receives geometry → ChunkMesh.updateGeometry()
    ↓
THREE.Mesh added to scene → visible next frame
```

### Block Edit Flow

```
Player left/right click → BlockPicker DDA raycast
    ↓
Target voxel coordinate resolved → World.setBlock(coord, id)
    ↓
Chunk data mutated in registry → Chunk added to dirty set
    ↓
Affected neighbour chunks also dirtied (face-sharing boundary)
    ↓
MeshWorker invoked for each dirty chunk (same pipeline as above)
    ↓
Existing THREE.Mesh geometry replaced → visual update ~1-2 frames later
```

### Per-Frame State Flow

```
requestAnimationFrame
    ↓
InputManager.flush() → collect pending keyboard/mouse deltas
    ↓
PlayerPhysics.update(dt) → integrate velocity, resolve AABB collisions
    ↓
Camera.update() → apply mouse delta, compute view matrix
    ↓
World.update() → check load/unload radius, drain worker result queue
    ↓
renderer.render(scene, camera)
```

### Key Data Flows

1. **Voxel data ownership:** Flows from TerrainWorker (creates) → World registry (stores) → MeshWorker (reads only) → Three.js scene (never touches raw data).
2. **Block edits:** Flow through World.setBlock() only — player, console, and any future editor all use the same API, maintaining a single source of truth.
3. **Geometry buffers:** Cross the worker boundary as transferable ArrayBuffers (zero-copy). After transfer, the worker no longer holds the buffer, preventing accidental mutation.

## Scaling Considerations

This is a single-player browser engine with no backend, so "scaling" means performance as world size and render distance grow, not server scaling.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Render distance 4 chunks | Single worker for terrain, single for meshing — sequential is fine |
| Render distance 8-12 chunks | Worker pool (2-4 terrain workers, 2-4 mesh workers) with task queue |
| Render distance 16+ chunks | LOD system: full meshing near player, coarser meshes at edge; chunk data streaming from IndexedDB |

### Scaling Priorities

1. **First bottleneck — meshing speed:** At >8 chunk render distance, a single mesh worker cannot keep up with player movement. Fix: worker pool with round-robin or priority-queue dispatch.
2. **Second bottleneck — draw calls:** Each chunk is one draw call. At 16+ chunk radius (hundreds of chunks), draw calls exceed 200+ and GPU overhead mounts. Fix: frustum culling of chunks (Three.js built-in, enable on chunk meshes), occlusion culling for underground chunks, or merging static chunks at distance.
3. **Third bottleneck — memory:** Each Uint8Array chunk is ~16KB (16×16×256×1 byte). At 400 loaded chunks that is ~6MB for data alone, plus geometry. Fix: LRU eviction of distant chunk data; geometry disposal when chunks leave render distance.

## Anti-Patterns

### Anti-Pattern 1: One Object Per Voxel

**What people do:** Create a `THREE.Mesh` (or `InstancedMesh` entry) for every individual block.
**Why it's wrong:** A single 16³ chunk has 4096 blocks; even a modest 8-chunk radius means hundreds of thousands of draw calls or instanced matrix updates per frame — GPU driver overhead crushes framerate.
**Do this instead:** Build a single merged `BufferGeometry` per chunk via greedy meshing. One draw call per chunk.

### Anti-Pattern 2: Generating and Meshing on the Main Thread

**What people do:** Call terrain generation and mesh building synchronously inside the game loop for simplicity.
**Why it's wrong:** Both operations take several milliseconds each. Blocking the main thread causes visible frame drops and jank whenever new chunks load.
**Do this instead:** Move both to Web Workers and apply results in the next frame via a worker message queue.

### Anti-Pattern 3: Rebuilding All Neighbours on Block Edit

**What people do:** When a block is placed/removed, re-mesh every adjacent chunk unconditionally.
**Why it's wrong:** A single block edit deep inside a chunk affects at most 1 chunk mesh. Only edits on a chunk boundary affect the neighbouring chunk. Rebuilding 6 neighbours for every edit is 6× unnecessary work.
**Do this instead:** Dirty only the edited chunk. Dirty a neighbour only when the edited block is on that chunk's face boundary (local x/y/z === 0 or chunkSize-1).

### Anti-Pattern 4: Storing Chunk Position Inside Voxel Data

**What people do:** Include world-space coordinates in every voxel's data structure or in the chunk array elements.
**Why it's wrong:** Chunk-local indices already imply world position when combined with the chunk's coordinate. Duplicating this wastes memory and creates synchronisation bugs.
**Do this instead:** Use a flat Uint8Array indexed by `(y * SIZE * SIZE + z * SIZE + x)`. Derive world coords on demand from chunk position + local index.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main thread ↔ TerrainWorker | `postMessage` (ChunkCoord) / `postMessage` (Uint8Array transferable) | One message per chunk; back-pressure via in-flight counter |
| Main thread ↔ MeshWorker | `postMessage` (chunk data + neighbours) / `postMessage` (Float32Array transferable) | Pass all 6 neighbour chunks so mesher can cull boundary faces |
| World ↔ Player (physics) | Direct method call: `World.getBlock(x, y, z): number` | Read-only from physics; hot path — must be O(1) with array index math |
| Player ↔ World (block edits) | `World.setBlock(coord, id)` then event/callback to dirty mesh | Keeps world as single owner of voxel data |
| World ↔ Renderer | `ChunkMesh.applyGeometry(buffers)` called from main thread after worker result | Renderer only sees finished geometry, never raw voxel data |

### External Dependencies

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| simplex-noise (npm) | Imported into TerrainWorker only | Keeps noise code worker-side; zero main-thread cost |
| Three.js | Used only in rendering/ and core/ | Mesh builders and terrain workers must not import Three.js |
| Pointer Lock API | `canvas.requestPointerLock()` in InputManager | Required for mouse-look; handle `pointerlockchange` for pause |

## Build Order Implications

The component dependency graph dictates this build order. Each layer depends only on layers built before it:

```
1. coords.ts + BlockRegistry     (no dependencies — pure data/math)
         ↓
2. Chunk (data container)        (depends on: coords)
         ↓
3. NoiseGenerator + TerrainRules (depends on: BlockRegistry, Chunk shape)
         ↓
4. GreedyMesher + AoCalculator   (depends on: Chunk shape, BlockRegistry)
         ↓
5. World + worker wiring          (depends on: Chunk, workers above)
         ↓
6. Renderer + TextureAtlas        (depends on: World for mesh data)
         ↓
7. InputManager + PlayerCamera    (depends on: Renderer canvas)
         ↓
8. PlayerPhysics + BlockPicker    (depends on: World for collision/raycast)
         ↓
9. Game (orchestration)           (depends on: all above)
```

**Key constraint:** Steps 3 and 4 (terrain gen and meshing) can be developed in parallel with steps 6-7 (rendering setup) because they communicate only through data contracts (Uint8Array in, Float32Array out). Wire them together in step 9.

## Sources

- [An Analysis of Minecraft-like Engines (0fps.net)](https://0fps.net/2012/01/14/an-analysis-of-minecraft-like-engines/) — chunk data structure analysis, industry-standard virtualized-array approach
- [Voxel World Optimisations — Sector's Edge (vercidium.com)](https://vercidium.com/blog/voxel-world-optimisations/) — run-based merging, packed vertex data, 5.7× meshing speedup
- [How I Made a Multi-Threaded Voxel Engine in TypeScript (dev.to)](https://dev.to/lucasdamianjohnson/how-i-made-multi-threaded-voxel-engine-in-typescript-1e8f) — SharedArrayBuffer chunk storage, Constructor/Render thread separation
- [Greedy Meshing in JavaScript (jameshylands.co.uk)](https://www.jameshylands.co.uk/2022/10/greedy-meshing-in-javascript.html) — 72K → 4K vertex reduction numbers
- [High Performance Voxel Engine: Vertex Pooling (nickmcd.me)](https://nickmcd.me/2021/04/04/high-performance-voxel-engine/) — face-bucket vertex pooling for rendering
- [Let's Make a Voxel Engine — Chunk Management (sites.google.com)](https://sites.google.com/site/letsmakeavoxelengine/home/chunk-management) — priority-based chunk loading
- [100 Three.js Tips That Actually Improve Performance (utsubo.com)](https://www.utsubo.com/blog/threejs-best-practices-100-tips) — Three.js-specific culling and draw call guidance
- [Voxel Engine in a Weekend — daymare.net](https://daymare.net/blogs/voxel-engine-in-a-weekend/) — single-weekend scope validation

---
*Architecture research for: Browser voxel engine (Minecraft-like)*
*Researched: 2026-03-27*
