# Phase 1: Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the TypeScript/Vite project, chunk data structures, Web Worker terrain generation pipeline, and chunk-batched WebGL rendering. By the end, opening the project in a browser shows procedural 3D terrain rendered with one BufferGeometry per chunk, terrain generated off the main thread.

</domain>

<decisions>
## Implementation Decisions

### Chunk Dimensions
- **D-01:** Claude's discretion on chunk shape — pick the best approach for browser performance (likely 16x16x16 cubes for faster individual rebuilds, or 16x16x256 columns for simpler neighbor logic)
- **D-02:** World height is 64 blocks — shorter world, less memory, faster loading

### Terrain Character
- **Claude's Discretion:** Terrain generation style (rolling hills, flatlands, etc.) — use standard simplex noise with octaves for natural-looking terrain. No caves for v1.

### Rendering Approach
- **Claude's Discretion:** Three.js vs raw WebGL, texture atlas strategy, UV mapping approach — research identified Three.js as the clear choice with BufferGeometry per chunk.

### Worker Threading
- **Claude's Discretion:** Single worker vs pool, postMessage transferables vs SharedArrayBuffer — pick the simplest approach that keeps the main thread unblocked.

### Claude's Discretion
The user delegated chunk shape, rendering approach, terrain character, and worker strategy to Claude. Research findings (STACK.md, ARCHITECTURE.md) provide strong guidance:
- Three.js with BufferGeometry per chunk
- simplex-noise 4.x + alea for seeded terrain
- Vite with vanilla-ts template
- Web Workers with postMessage transferables (simpler than SharedArrayBuffer)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research
- `.planning/research/STACK.md` — Technology choices with versions and rationale
- `.planning/research/ARCHITECTURE.md` — Component structure, data flow, build order
- `.planning/research/PITFALLS.md` — Critical mistakes to avoid (per-block meshes, main-thread gen, memory leaks)
- `.planning/research/SUMMARY.md` — Synthesized findings and phase implications

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — greenfield project.

### Established Patterns
None — this phase establishes the foundational patterns.

### Integration Points
None — first phase, no existing code to integrate with.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants classic Minecraft feel with 64-block world height.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-27*
