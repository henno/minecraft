---
phase: 01-foundation
plan: 03
subsystem: world
tags: [typescript, voxel, chunk, worker, meshing, buffergeometry]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: "Chunk class, BlockRegistry, types (CHUNK_SIZE, CHUNK_HEIGHT, BlockId), coord utils"
  - phase: 01-foundation/01-02
    provides: "TerrainWorker with postMessage protocol (cx, cz, data: Uint8Array)"
provides:
  - "World class: chunk registry, worker pool, requestChunk(), getChunk(), getBlock(), setBlock(), needsMesh, loadedChunks"
  - "CulledMesher: buildChunkMesh() returning MeshBuffers (positions, normals, uvs, indices typed arrays)"
  - "MeshBuffers interface: Float32Array positions/normals/uvs + Uint32Array indices"
affects: [01-04, renderer, meshing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "World as single owner of all voxel data — all reads/writes route through World"
    - "Back-pressure limiting: MAX_IN_FLIGHT=4 concurrent worker tasks"
    - "Transferable ownership: data.buffer transferred from worker, new Uint8Array created in chunk"
    - "Face culling: solid-adjacent-to-transparent emits face; solid-solid interior skipped"
    - "Neighbour chunk lookup via px/nx/pz/nz keys for cross-boundary seam elimination"
    - "Pre-allocate typed array buffers, slice to exact size before return"

key-files:
  created:
    - src/world/World.ts
    - src/meshing/CulledMesher.ts
  modified: []

key-decisions:
  - "CulledMesher is Three.js-agnostic (zero three imports in src/meshing/ or src/world/) — renderer wires BufferGeometry in Plan 04"
  - "MeshBuffers includes uvs field (simple [0,1] per face) to prepare for Plan 04 texture atlas without redesign"
  - "Boundary face culling: emit face when no neighbour chunk loaded (conservative, avoids holes at chunk edge)"

patterns-established:
  - "Data pipeline: chunk coords -> World.requestChunk -> TerrainWorker -> World.onWorkerMessage -> Chunk -> needsMesh -> buildChunkMesh -> MeshBuffers -> renderer (Plan 04)"
  - "World.needsMesh Set: chunks that have new data requiring mesh rebuild; renderer consumes and clears"

requirements-completed: [TERR-02, TECH-02, TECH-03]

# Metrics
duration: 8min
completed: 2026-03-27
---

# Phase 01 Plan 03: World Manager and CulledMesher Summary

**World chunk registry with MAX_IN_FLIGHT=4 back-pressure worker orchestration, and face-culled chunk mesher returning typed-array MeshBuffers ready for GPU upload**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-27T18:37:37Z
- **Completed:** 2026-03-27T18:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- World class: authoritative chunk registry, TerrainWorker dispatch with 4-task back-pressure, O(1) getBlock/setBlock via worldToChunk + worldToLocal
- CulledMesher: iterates all solid voxels in a chunk, emits quads only for faces adjacent to transparent blocks (air/water)
- Cross-chunk boundary seam elimination by reading px/nx/pz/nz neighbour chunks during meshing
- Zero Three.js dependencies in the data layer — pure typed-array output ready for Plan 04 BufferGeometry wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: World Manager — chunk registry and worker orchestration** - `e7daedf` (feat)
2. **Task 2: CulledMesher — face-culled chunk geometry builder** - `bcf209e` (feat)

## API Reference

### World class (`src/world/World.ts`)

```typescript
export class World {
  readonly needsMesh: Set<string>;                          // chunks awaiting mesh rebuild
  requestChunk(cx: number, cz: number): void;              // dispatches to TerrainWorker (back-pressure applied)
  getChunk(cx: number, cz: number): Chunk | undefined;     // lookup loaded chunk by grid coords
  getBlock(wx: number, wy: number, wz: number): BlockId;   // O(1) world-space voxel read
  setBlock(wx: number, wy: number, wz: number, id: BlockId): void; // marks chunk dirty + needsMesh
  get loadedChunks(): IterableIterator<Chunk>;              // iterate all loaded chunks
}
```

### MeshBuffers interface (`src/meshing/CulledMesher.ts`)

```typescript
export interface MeshBuffers {
  positions: Float32Array;  // 3 floats/vertex (x, y, z) world-space
  normals: Float32Array;    // 3 floats/vertex (nx, ny, nz)
  uvs: Float32Array;        // 2 floats/vertex (u, v) simple [0,1] per face
  indices: Uint32Array;     // 3 ints/triangle
  vertexCount: number;
  indexCount: number;
}

export function buildChunkMesh(
  chunk: Chunk,
  neighbours?: Partial<Record<'px' | 'nx' | 'pz' | 'nz', Chunk>>
): MeshBuffers;
```

## Files Created/Modified

- `src/world/World.ts` — World class: chunk Map registry, TerrainWorker dispatch, back-pressure (MAX_IN_FLIGHT=4), needsMesh tracking, getBlock/setBlock
- `src/meshing/CulledMesher.ts` — buildChunkMesh() with face culling + cross-chunk neighbour reads, MeshBuffers interface

## Decisions Made

- CulledMesher has zero Three.js imports — pure typed-array data layer. Plan 04 (renderer) creates BufferGeometry from MeshBuffers.
- MeshBuffers includes `uvs` field now (simple per-face [0,1]) so Plan 04 can wire texture atlas UVs without changing the interface.
- Conservative boundary handling: when a neighbour chunk is not loaded, treat as AIR and emit the boundary face (avoids black holes at chunk edges).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- World and CulledMesher form the complete data pipeline from chunk coords to GPU-ready geometry buffers
- Plan 04 (renderer) can import World and buildChunkMesh directly
- needsMesh Set drives the renderer's per-frame remesh decisions
- No blockers

---
*Phase: 01-foundation*
*Completed: 2026-03-27*
