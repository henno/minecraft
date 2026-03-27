---
phase: 01-foundation
plan: "02"
subsystem: terrain
tags: [simplex-noise, alea, web-worker, terrain-generation, voxel, noise, chunk]

# Dependency graph
requires:
  - phase: 01-01
    provides: "src/types.ts (CHUNK_SIZE, CHUNK_HEIGHT, BlockIds), src/utils/coords.ts (localIndex, chunkOrigin), src/world/BlockRegistry.ts (isSolid)"
provides:
  - NoiseGenerator class with seeded 4-octave 2D simplex FBM noise (sample2D returns [0,1])
  - generateChunk(cx, cz, noise) fills Uint8Array with GRASS/DIRT/STONE/WATER block IDs
  - TerrainWorker Web Worker entry point — receives {cx,cz}, posts {cx,cz,data:Uint8Array} transferable
affects: [01-03, 01-04, all downstream chunk/mesh plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Worker message protocol: request {cx,cz}, response {cx,cz,data} with data.buffer transferred as Transferable"
    - "NoiseGenerator singleton per worker — instantiated once, reused for all chunk messages"
    - "4-octave FBM: amplitudes sum to 1.0 for normalised [0,1] output after (sum + 1.0) * 0.5 remap"
    - "SEA_LEVEL=20 constant controls ocean fill in generateChunk"

key-files:
  created:
    - src/terrain/NoiseGenerator.ts
    - src/terrain/TerrainRules.ts
    - src/terrain/TerrainWorker.ts
  modified: []

key-decisions:
  - "2D simplex noise only (no createNoise3D) — no caves in v1 per CONTEXT.md; 2D is ~3x faster per sample"
  - "SEA_LEVEL=20: gives ~20 blocks of ocean depth and ~44 blocks of above-sea-level height range in CHUNK_HEIGHT=64"
  - "NoiseGenerator instantiated once per worker lifetime, not per message — avoids PRNG re-init overhead"
  - "data.buffer cast to ArrayBuffer for Transferable — TypeScript strict mode requires explicit cast from ArrayBufferLike"

patterns-established:
  - "Worker terrain pipeline: TerrainWorker.ts → generateChunk() → NoiseGenerator.sample2D() — no Three.js in any terrain file"
  - "Block column logic: GRASS at surface (ly==h), DIRT at h-3 to h-1, STONE below, WATER fills air below SEA_LEVEL"

requirements-completed: [TERR-01, TERR-03, TECH-04]

# Metrics
duration: 2min
completed: "2026-03-27"
---

# Phase 01 Plan 02: Terrain Generation Pipeline Summary

**4-octave 2D simplex FBM terrain generator running in a Web Worker — posts Uint8Array chunk data with GRASS/DIRT/STONE/WATER layering via zero-copy ArrayBuffer transfer**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T18:34:00Z
- **Completed:** 2026-03-27T18:35:26Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- NoiseGenerator with seeded alea('tseburek') PRNG and 4-octave FBM returning deterministic [0,1] height values
- generateChunk fills flat Uint8Array with GRASS surface, 3-layer DIRT, STONE bedrock, and WATER ocean fill below SEA_LEVEL=20
- TerrainWorker handles {cx,cz} message and posts {cx,cz,data:Uint8Array} response with buffer transferred zero-copy — no Three.js imports anywhere in terrain/

## Task Commits

Each task was committed atomically:

1. **Task 1: NoiseGenerator — layered 2D simplex noise** - `b38803a` (feat)
2. **Task 2: TerrainRules — block placement from height map** - `a41481d` (feat)
3. **Task 3: TerrainWorker — Web Worker entry point** - `afb538f` (feat)

## Files Created/Modified

- `src/terrain/NoiseGenerator.ts` - NoiseGenerator class: alea-seeded createNoise2D, 4-octave FBM sample2D(wx,wz) returning [0,1]
- `src/terrain/TerrainRules.ts` - generateChunk(cx,cz,noise): fills Uint8Array with GRASS/DIRT/STONE/WATER per column height
- `src/terrain/TerrainWorker.ts` - Web Worker entry point: onmessage handler, noise singleton, postMessage with Transferable

## Worker Message Protocol

**Request (main thread → worker):**
```typescript
{ cx: number, cz: number }
```

**Response (worker → main thread):**
```typescript
{ cx: number, cz: number, data: Uint8Array }
// data.buffer is transferred (zero-copy) — neutered in worker after postMessage
```

**Usage in Plan 03:**
```typescript
const worker = new Worker(new URL('./terrain/TerrainWorker.ts', import.meta.url), { type: 'module' });
worker.postMessage({ cx: 0, cz: 0 });
worker.onmessage = (e) => {
  const { cx, cz, data } = e.data; // data is Uint8Array, buffer transferred
};
```

## Terrain Rules Summary

- **SEA_LEVEL = 20** (constant in TerrainRules.ts)
- **Height mapping:** `h = Math.floor(noise.sample2D(wx, wz) * (CHUNK_HEIGHT - 1))` → range [0, 63]
- **Block placement per column:**
  - `ly === h` → GRASS (1)
  - `ly >= h-3 && ly < h` → DIRT (2), 3 layers
  - `ly < h-3` → STONE (3)
  - `ly > h && ly < SEA_LEVEL` → WATER (5), ocean fill
  - otherwise → AIR (0)

## Decisions Made

- **2D noise only:** `createNoise2D` used exclusively — no caves in v1 per CONTEXT.md decision; 3D noise is ~3x slower per sample
- **SEA_LEVEL=20:** Places ocean at roughly the bottom third of the 64-block world height, leaving adequate above-sea terrain range
- **NoiseGenerator singleton:** One instance per worker lifetime avoids repeated PRNG re-initialization cost

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict literal type inference for blockId**
- **Found during:** Task 2 (TerrainRules block placement)
- **Issue:** `let blockId = BlockIds.AIR` inferred type as `0` (literal) due to `as const` on BlockIds object; assigning `BlockIds.GRASS` (type `1`) to a `Uint8Array` element via `data[idx] = blockId` caused TS2322 errors
- **Fix:** Explicitly typed `let blockId: number = BlockIds.AIR` to widen the type to number
- **Files modified:** src/terrain/TerrainRules.ts
- **Verification:** `tsc --noEmit` exits 0
- **Committed in:** a41481d (Task 2 commit)

**2. [Rule 1 - Bug] ArrayBufferLike vs ArrayBuffer for Transferable**
- **Found during:** Task 3 (TerrainWorker postMessage call)
- **Issue:** `data.buffer` has type `ArrayBufferLike` (union of `ArrayBuffer | SharedArrayBuffer`) in TypeScript; `Transferable[]` only accepts `ArrayBuffer`, causing TS2769 overload error
- **Fix:** Cast to `data.buffer as ArrayBuffer` — safe because Uint8Array always uses a plain ArrayBuffer
- **Files modified:** src/terrain/TerrainWorker.ts
- **Verification:** `tsc --noEmit` exits 0
- **Committed in:** afb538f (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 TypeScript strict mode type bugs)
**Impact on plan:** Both fixes are trivially correct — the logic matches the plan exactly. No scope creep.

## Issues Encountered

None beyond the two TypeScript strict-mode type annotation issues documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TerrainWorker is ready to be wired in Plan 03 using `new Worker(new URL('./terrain/TerrainWorker.ts', import.meta.url), { type: 'module' })`
- Worker message protocol documented above (request/response shapes)
- `tsc --noEmit` exits 0, no three.js imports in terrain/ directory
- No blockers

---
*Phase: 01-foundation*
*Completed: 2026-03-27*
