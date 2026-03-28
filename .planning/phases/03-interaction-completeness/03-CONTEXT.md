# Phase 3: Interaction & Completeness - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the exploration build into a complete browser voxel engine demo. By the end of this phase, the player should be able to target blocks precisely, break them, place from a small placeable palette, see water as a translucent material, and demonstrate stable 60fps performance at a reasonable render distance.

Explicitly in scope:
- Precise block targeting from the first-person camera (voxel raycast / face hit resolution)
- Left-click break and right-click place interaction loop
- Chunk remesh propagation when edits touch chunk borders
- Remaining placeable block palette completion for the 5-10 block target
- Transparent/translucent water rendering with visible tint
- Performance measurement and tuning to validate the v1 framerate target

Explicitly out of scope for this phase:
- Greedy meshing or ambient occlusion
- Inventory/crafting, survival mechanics, persistence, settings UI
- Biomes, caves, entities, sound, mobile/touch support

</domain>

<decisions>
## Implementation Decisions

### Interaction Strategy
- **D-01:** Use a deterministic voxel traversal raycast from the camera rather than Three.js mesh raycasting so targeting stays authoritative to world data.
- **D-02:** All edits must continue to route through `World.setBlock()`; interaction code may compute targets, but `World` remains the single owner of voxel state.
- **D-03:** Breaking/placing must mark neighbour chunks dirty when the edited voxel lies on a chunk edge so visible seams update immediately.

### Rendering Strategy
- **D-04:** Keep Phase 1/2 culled meshing architecture for opaque terrain; do not widen this phase into greedy meshing.
- **D-05:** Render water as a separate transparent path/material so opacity and depth handling do not regress opaque chunk rendering.

### UX / Validation Strategy
- **D-06:** Keep block-selection UX intentionally small: minimal hotbar or number-key cycle is enough if all required placeable types are reachable.
- **D-07:** Performance validation must be empirical: use the existing Stats overlay, record the tested render distance, and capture the conditions under which 60fps is considered met.

### Claude's Discretion
The user did not constrain the exact target highlight style, hotbar presentation, or transparency implementation. Claude should choose the smallest implementation that preserves current architecture and browser compatibility:
- DDA/grid traversal raycast against `World.getBlock()`
- Edge-triggered remesh dirtying inside `World`
- Separate water geometry/material path if needed rather than overloading the opaque material
- Minimal DOM HUD for selected block feedback if selection is not otherwise obvious

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

### Prior phase outputs
- `.planning/phases/01-foundation/01-03-SUMMARY.md`
- `.planning/phases/01-foundation/01-04-SUMMARY.md`
- `.planning/phases/02-world-player/02-CONTEXT.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/world/World.ts` already owns chunk streaming, block reads, and writes.
- `src/core/Game.ts` already owns player updates, HUD wiring, mesh rebuild pacing, and chunk mesh disposal.
- `src/player/Player.ts`, `src/player/PlayerCamera.ts`, and `src/input/InputManager.ts` already define the first-person control loop.
- `src/meshing/CulledMesher.ts` already separates transparent vs solid visibility rules and emits atlas-aware UVs for opaque terrain.
- `src/world/BlockRegistry.ts` already distinguishes solid vs transparent blocks and includes `WATER` in the registry.

### Established Patterns
- One authoritative `World` registry for voxel data and chunk dirtiness
- One merged geometry per chunk for solid terrain
- Browser HUD elements are created directly in `Game` without a UI framework
- Resource disposal on unload/remesh is explicit and mandatory

### Integration Points
- Phase 3 interaction should extend the existing `Player`/`Game` loop, not replace it with scene-mesh picking.
- Transparent water likely needs dedicated geometry/material handling in `Game` and/or meshing output.
- Performance validation should use the existing Stats.js overlay plus browser build checks rather than adding heavyweight tooling.

</code_context>

<specifics>
## Specific Ideas

- Keep the loop legible: aim at block, click to break, right-click to place on the clicked face, immediate remesh.
- If target highlighting is added, keep it cheap and obvious (wireframe outline or face marker); do not let it grow into a full selection system.
- Water should read as water instantly: blue tint, translucency, and visible submerged terrain.
- Use a repeatable performance scene for validation: spawn area, fixed render distance, stable camera motion or idle viewpoint.

</specifics>

<deferred>
## Deferred Ideas

- Greedy meshing and ambient occlusion remain future work after v1.
- Save/load, adjustable render distance UI, and inventory remain out of scope.
- Fancy water effects (waves, refraction, reflections) are unnecessary for this phase.

</deferred>

---

*Phase: 03-interaction-completeness*
*Context gathered: 2026-03-28*
