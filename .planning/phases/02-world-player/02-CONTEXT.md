# Phase 2: World & Player - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the Phase 1 terrain demo into a playable exploration build. By the end of this phase, the world should look like a Minecraft-style game: textured blocks, basic face-direction lighting, fog at the render edge, and a first-person player who can mouse-look, walk, fall, collide, and jump while chunks load/unload around them.

Explicitly in scope:
- Textured opaque terrain blocks using a 16x16 pixel-art atlas
- Directional shading and fog for readability/presentation
- First-person controls with pointer lock, crosshair, and click-to-play affordance
- Gravity, collision, and jump against voxel terrain
- Player-driven chunk streaming and chunk unload/dispose lifecycle

Explicitly out of scope for this phase:
- Breaking/placing blocks
- Water transparency / separate transparent pass
- Greedy meshing or ambient occlusion
- Save/load, settings UI, mobile controls, inventory, entities

</domain>

<decisions>
## Implementation Decisions

### Texture Strategy
- **D-01:** Use a runtime-generated atlas (CanvasTexture) with nearest-neighbour filtering and padded tiles rather than introducing external image assets mid-phase.
- **D-02:** Keep culled meshing for v1; add atlas-aware UVs per face and directional shading without switching to greedy meshing yet.

### Player Control Strategy
- **D-03:** Use browser pointer lock with a visible click-to-play overlay and centered crosshair; Esc must release cleanly.
- **D-04:** Movement remains fully custom and data-oriented: input intent -> player controller -> voxel collision queries through `World.getBlock()`.

### Streaming Strategy
- **D-05:** Chunk loading must be prioritized by distance from the player's current chunk (closest first), not a static origin-centered loop.
- **D-06:** Chunk unload must dispose geometry immediately when chunks leave the retention radius to avoid GPU leaks.

### Claude's Discretion
The user did not constrain the exact atlas implementation, camera wrapper, or collision shape. Claude should choose the simplest approach that preserves Phase 1 patterns and meets the browser/performance constraints:
- Runtime atlas via Three.js `CanvasTexture`
- First-person camera/controller wrapper over existing renderer camera
- Axis-separated AABB collision against voxel solidity via `World.getBlock()`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project docs
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`

### Research
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/FEATURES.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/STACK.md`

### Phase 1 outputs
- `.planning/phases/01-foundation/01-03-SUMMARY.md`
- `.planning/phases/01-foundation/01-04-SUMMARY.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/world/World.ts` already owns chunk data, worker results, and block reads/writes.
- `src/meshing/CulledMesher.ts` already emits one face-culled merged mesh per chunk.
- `src/core/Renderer.ts` already owns the Three.js renderer, scene, and camera.
- `src/core/Game.ts` already owns the render loop and chunk mesh lifecycle.
- `src/world/BlockRegistry.ts` already defines the Phase 1 block IDs (AIR, GRASS, DIRT, STONE, SAND, WATER).

### Established Patterns
- One authoritative `World` registry for voxel data
- One `THREE.Mesh` / `BufferGeometry` per chunk
- Web Worker terrain generation only; main thread handles GPU uploads
- Shared render resources should be disposed explicitly on unload/remesh

### Integration Points
- Phase 2 should extend, not replace, the Phase 1 `Game` loop.
- Player physics must query `World.getBlock()` only; do not read chunk internals directly.
- Texturing should slot into the current mesh/material path without changing worker boundaries.

</code_context>

<specifics>
## Specific Ideas

- Keep the Minecraft feel: crisp nearest-filtered textures, centered crosshair, click-to-play overlay, and obvious top/side/bottom brightness differences.
- Prefer a spawn near the origin terrain surface so verification is immediate.
- Keep render distance modest for this phase and let fog hide the streaming boundary.

</specifics>

<deferred>
## Deferred Ideas

- Transparent water rendering remains Phase 3.
- Greedy meshing and AO remain deferred; Phase 2 should not redesign around them.
- Block targeting highlight is optional polish and should not block this phase.

</deferred>

---

*Phase: 02-world-player*
*Context gathered: 2026-03-28*
