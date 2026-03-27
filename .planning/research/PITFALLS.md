# Pitfalls Research

**Domain:** Browser-based voxel engine (Minecraft-like), WebGL, Three.js, TypeScript
**Researched:** 2026-03-27
**Confidence:** HIGH — multiple primary sources (0fps.net technical series, Three.js forum post-mortems, voxel.js retrospective, MDN WebGL best practices)

---

## Critical Pitfalls

### Pitfall 1: Texture Stretching with Greedy Meshing

**What goes wrong:**
When greedy meshing merges adjacent same-type faces into a single large quad, standard UV mapping stretches the texture across the entire merged quad instead of tiling it per-block. A 1x8 strip of grass becomes one enormous stretched grass texture instead of 8 tiled grass textures. This affects every textured surface and makes the world look visually broken.

**Why it happens:**
Developers implement greedy meshing first and then apply texture coordinates naively — a single [0,1] UV range across the whole merged quad. The stretch only becomes visible once real textures are applied, by which point the meshing architecture is locked in.

**How to avoid:**
Pass the quad's world dimensions (number of blocks wide/tall) as vertex attributes to the shader and compute UV tiling in the fragment shader using modular arithmetic: `uv_tiled = fract(uv_scaled)`. Alternatively, use WebGL2 array textures (`gl.TEXTURE_2D_ARRAY`) which support per-layer wrap modes independent of quad size. Do NOT use a simple texture atlas with greedy meshing without fragment shader tiling — this combination is broken by design.

**Warning signs:**
- Textures look "big" and blurry on long horizontal surfaces (dirt paths, stone floors)
- Grass side texture appears once across an entire row of blocks rather than once per block
- Checkerboard patterns appear normal but photographic textures look stretched

**Phase to address:**
Meshing phase (Phase 2 or 3) — decide texture approach before writing greedy meshing. The meshing algorithm and shader UV strategy must be designed together.

---

### Pitfall 2: Blocking the Main Thread with Chunk Generation

**What goes wrong:**
Terrain generation for a new chunk runs synchronously on the main thread. When the player approaches new territory, the game freezes for 50-500ms per chunk while noise functions compute terrain heights and populate voxel arrays. With a typical 16-chunk render distance, loading a new row of chunks causes multi-second freezes.

**Why it happens:**
Simplex noise terrain generation is CPU-intensive. Developers start with synchronous generation because it is simple to implement and works fine for the first few chunks in development. The problem only becomes visible at realistic render distances or when moving fast enough to trigger multiple chunk loads per second.

**How to avoid:**
Move chunk data generation to Web Workers from the start. Keep the architecture clean: the worker receives chunk coordinates, computes terrain data, returns a transferable `Uint8Array` via `postMessage`. The main thread picks results off a queue each frame and uploads geometry to the GPU. Limit chunk rebuilds to 1-2 per frame to maintain frame pacing. Note: WebGL calls cannot be made from workers — only data generation moves off-thread; buffer uploads stay on the main thread.

**Warning signs:**
- Frame time spikes visible in Chrome DevTools Performance tab when approaching unloaded areas
- requestAnimationFrame callbacks taking >16ms during movement
- Game "hitches" at regular intervals corresponding to chunk boundaries

**Phase to address:**
Foundation phase (Phase 1) — the worker/main-thread boundary must be decided in the architecture before terrain generation is written. Retrofitting workers into synchronous code requires rewriting the entire generation pipeline.

---

### Pitfall 3: Not Disposing Three.js Geometries on Chunk Unload

**What goes wrong:**
When chunks move out of render distance and are removed from the scene, their `BufferGeometry`, `Material`, and any associated textures are not explicitly disposed. Three.js does not garbage-collect GPU resources automatically. Over time, VRAM fills up with orphaned geometry buffers from every chunk the player has ever visited. This causes progressive performance degradation or GPU out-of-memory crashes after minutes of play.

**Why it happens:**
JavaScript garbage collection removes the JavaScript object, but the associated WebGL buffer objects on the GPU side are not freed until `.dispose()` is explicitly called. Developers from non-WebGL backgrounds expect normal JS GC to handle cleanup.

**How to avoid:**
Any time a chunk mesh is removed from the scene, immediately call `mesh.geometry.dispose()` and `mesh.material.dispose()` (if the material is per-chunk). Use a chunk lifecycle pattern: `create → add → update → remove → dispose`. Monitor `renderer.info.memory.geometries` and `renderer.info.memory.textures` during development — if these numbers grow indefinitely during exploration, there is a leak.

**Warning signs:**
- `renderer.info.memory.geometries` increases as player explores and never decreases
- Chrome Task Manager shows steadily growing GPU Memory over minutes of play
- Performance degrades noticeably after 10-20 minutes without any obvious cause

**Phase to address:**
Chunk management phase (Phase 2) — implement dispose in the chunk unload path at the same time as chunk loading. Never defer this.

---

### Pitfall 4: Using Nested Arrays for Voxel Data Instead of Flat Typed Arrays

**What goes wrong:**
Voxel data stored as `blocks[x][y][z]` (nested JavaScript arrays) is 3-10x slower to iterate than a flat `Uint8Array` with index calculation `index = x + y*W + z*W*H`. For a 16x16x256 chunk, meshing must iterate all 65,536 voxels. With nested arrays this generates enormous GC pressure from temporary objects and kills cache locality. Meshing becomes the frame-rate bottleneck even before render distance grows.

**Why it happens:**
Nested arrays match the mental model of 3D coordinates and are simpler to prototype. The performance difference is invisible for tiny worlds (8x8x8 chunks) and only becomes critical at realistic Minecraft-scale chunk heights and render distances.

**How to avoid:**
From day one, store chunk data as `new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_D)`. Write helper functions `getBlock(x, y, z)` and `setBlock(x, y, z, type)` that compute the flat index internally. This keeps calling code readable while preserving cache-friendly memory layout. Use `Uint8Array` for up to 255 block types; `Uint16Array` if more types are anticipated.

**Warning signs:**
- Profiler shows heavy GC activity during meshing
- Meshing time per chunk increases superlinearly as chunk size grows
- Heap allocations spike during terrain generation

**Phase to address:**
Foundation phase (Phase 1) — data structure choice is foundational. Changing from nested arrays to typed arrays later requires rewriting all code that touches voxel data.

---

### Pitfall 5: Ambient Occlusion Quad Orientation Bug

**What goes wrong:**
Ambient occlusion (AO) in voxel worlds requires assigning per-vertex darkness values (0-3) based on neighboring solid blocks. When a quad is split into two triangles, the interpolation path depends on which diagonal is used. If the quad is always split the same way, faces with non-coplanar AO values produce an obvious visual seam — adjacent quads shade differently despite identical geometry, creating a "checkerboard shadow" artifact that makes the world look broken.

**Why it happens:**
Developers implement AO, see it mostly working, and ship without testing the edge case where AO values differ across all four vertices of a face (common at concave corners). The artifact is subtle in flat terrain but highly visible on irregular surfaces.

**How to avoid:**
When generating quads, compare the two possible diagonal sums: `(ao[0][0] + ao[1][1])` vs `(ao[0][1] + ao[1][0])`. Flip the triangle winding order based on which sum is larger (Mikola Lysenko's formula from the 0fps.net AO article). This single comparison costs almost nothing but eliminates the artifact entirely.

**Warning signs:**
- Shadow lines visible at concave block corners that don't match the lighting direction
- Diagonal "stripes" of dark/light appearing on walls or floors of enclosed spaces
- AO looks correct in flat terrain but wrong in caves or interior spaces

**Phase to address:**
Lighting/shading phase — implement the flip at the same time as AO is first added. It is nearly impossible to add later without reviewing every quad generation path.

---

### Pitfall 6: Per-Block Draw Calls (No Chunk Batching)

**What goes wrong:**
The naive Three.js approach creates one `Mesh` per visible block. A 16-chunk render distance with even modest density produces tens of thousands of objects in the scene. WebGL draw call overhead alone kills performance — browsers typically can handle 200-500 draw calls per frame at 60fps; 10,000+ blocks means 10,000+ draw calls and 1-5fps.

**Why it happens:**
Adding individual block meshes is the simplest Three.js mental model. It works for demos with 50 blocks. It fails catastrophically at voxel scale. `InstancedMesh` solves instancing but does not solve the face-culling problem (hidden interior faces still cost vertices). The correct solution is chunk-level custom geometry — not instancing.

**How to avoid:**
Never add individual block meshes to the scene. Generate a single merged `BufferGeometry` per chunk containing only the visible faces (face-culled mesh). Each chunk = one draw call. With 100 loaded chunks, that's 100 draw calls — well within budget. Face culling eliminates all internal block faces, reducing vertex count by ~80% in dense terrain.

**Warning signs:**
- `renderer.info.render.calls` shown in stats.js exceeds 500 for a reasonable scene
- Scene graph has hundreds or thousands of Mesh objects
- FPS collapses as soon as a second or third chunk is added

**Phase to address:**
Phase 1 (core rendering) — this is the most fundamental architectural decision. There is no path from per-block meshes to a performant voxel engine except a complete rewrite.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Synchronous chunk generation | Simpler code, easier debugging | Main thread freezes at real render distance | Never — break on first player test |
| Nested array voxel storage | Readable coordinate access | 3-10x meshing slowdown, GC pressure | Prototype only, must migrate before first perf test |
| One mesh per block | Zero meshing code needed | Frame rate collapses beyond 200 blocks | Never for world rendering |
| Skip `.dispose()` on chunk unload | Less lifecycle code | GPU memory leak, degradation over time | Never |
| Standard UV mapping with greedy mesh | Simple texture code | Every textured surface looks broken | Never if using real textures |
| Culled meshing instead of greedy | Faster to implement | 4-6x more triangles, worse GPU utilization | Acceptable for MVP if greedy is blocked by texture issue |
| Single-threaded noise generation | No worker complexity | Freeze spikes on chunk load | Acceptable for first prototype run only |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Three.js `PointerLockControls` | Applying mouse delta directly to camera Euler angles causes gimbal lock or camera flipping at poles | Use Three.js built-in `PointerLockControls` which handles this; do not re-implement manually |
| Three.js `Raycaster` on chunk meshes | Using Three.js raycaster against full chunk geometry is slow for block picking | Implement a dedicated DDA (Digital Differential Analyzer) voxel ray traversal that walks the voxel grid directly — O(steps) instead of O(triangles) |
| Simplex noise libraries | Using 3D simplex noise for 2D height maps is 3x slower than needed | Use 2D simplex for height maps; reserve 3D noise only for cave generation |
| Web Workers + Three.js | Attempting to call Three.js or WebGL functions inside a worker — they are undefined there | Workers receive only plain data (chunk coords). Geometry construction with Three.js happens on the main thread after worker returns typed array data |
| Texture atlas with standard `RepeatWrapping` | Standard texture atlas with `RepeatWrapping` tiles the whole atlas, not individual sub-textures | Either use WebGL2 `TEXTURE_2D_ARRAY` with one layer per block type, or compute UV offsets in fragment shader with fract() modulo |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rebuilding entire chunk mesh on single block edit | Multi-frame freeze when player places/breaks one block | Rebuild only the affected chunk (not neighbors unless on boundary) | Immediately — every block interaction |
| Generating all chunks in render distance on page load | 5-30 second startup freeze before any frame renders | Use a spiral-outward generation queue, load N chunks per frame | At render distance > 4 |
| Storing all loaded chunk data forever (no eviction) | Memory grows unboundedly — browser tab killed after ~15 minutes | Maintain a max-chunks LRU cache; unload chunks beyond render distance + 1 | At ~10 minutes of exploration |
| Checking all 6 chunk neighbors for meshing only | Ambient occlusion artifacts at corners | Include all 26 neighbors (faces + edges + corners) when computing AO | When AO is enabled |
| Uploading geometry every frame | GPU constantly busy even when world is static | Mark chunks dirty on edit; only upload dirty chunks | Every frame with static world |
| Using `THREE.BoxGeometry` for individual blocks | Same as per-block draw call trap | Custom chunk `BufferGeometry` from day one | Beyond ~50 visible blocks |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No chunk loading indicator | World has visible holes/missing chunks while generating; looks broken | Show distance fog that hides unloaded chunks — fog naturally conceals generation boundary |
| Abrupt chunk pop-in | New chunks appear suddenly, breaking immersion | Keep fog distance equal to or less than render distance so chunks fade in |
| Right-click opening browser context menu during block placement | Right-click to place blocks is immediately broken on first user test | Add `addEventListener('contextmenu', e => e.preventDefault())` before ship |
| Pointer lock requiring click-to-activate | New users are confused why mouse look does not work immediately | Display a clear "Click to play" overlay that requests pointer lock on click |
| No crosshair | Block targeting is unclear; users cannot tell what they are aiming at | A simple CSS crosshair `position: fixed; top: 50%; left: 50%` over the canvas costs nothing |
| Camera clipping into blocks | Player can see through the ground when standing near walls | Set near clip plane no smaller than 0.1; avoid values near 0.01 which cause clip jitter |

---

## "Looks Done But Isn't" Checklist

- [ ] **Chunk unloading:** Chunks that scroll out of range — verify they are removed from the scene AND `.dispose()` is called on their geometry and material. Check `renderer.info.memory.geometries` stays stable during exploration.
- [ ] **Block placing on chunk boundaries:** Placing a block at x=15 (last column of chunk A) should update the mesh of the adjacent chunk (x=0 of chunk B) to remove the now-hidden face. Verify by placing a block at every chunk edge.
- [ ] **Chunk seams visible:** Look for thin lines between chunks (z-fighting, missing faces at boundaries). Occurs when mesh generation does not correctly read neighbor chunk data for edge faces.
- [ ] **Texture bleeding:** Check that block textures do not bleed into adjacent atlas tiles. Use 1-2 pixel padding around each texture in the atlas, or use `TEXTURE_2D_ARRAY` instead.
- [ ] **Context menu on right-click:** Right-click on the canvas — browser context menu must not appear.
- [ ] **Pointer lock release:** Press Escape — pointer lock should release cleanly without breaking camera state. Re-clicking should re-acquire lock.
- [ ] **Fog hides generation boundary:** At max render distance, is the terrain edge visible? Fog near plane should match render distance.
- [ ] **Water/transparent block ordering:** Transparent blocks (water) must be rendered after opaque blocks and in back-to-front order to avoid transparency sorting artifacts.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Per-block draw calls discovered late | HIGH | Complete rewrite of rendering layer — chunk `BufferGeometry` system replaces all individual meshes |
| Texture stretching on greedy mesh | MEDIUM | Add UV scaling vertex attribute + fragment shader tiling pass; existing greedy mesh code reusable |
| Memory leak from no dispose | LOW | Add `dispose()` calls in chunk eviction path; fix is surgical and localized |
| Nested array voxel data | MEDIUM | Migrate chunk data class to typed array; update all index accessors; meshing code reusable |
| Synchronous chunk generation | MEDIUM | Extract generation function into Worker; add message-passing queue; generation logic unchanged |
| AO quad orientation artifact | LOW | Add diagonal-sum comparison in quad generation; 3 lines of code once you know the fix |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Per-block draw calls | Phase 1: Core rendering architecture | `renderer.info.render.calls` stays under 200 with 8+ chunks loaded |
| Flat typed arrays for voxel data | Phase 1: Data structures | Meshing benchmark: 16x16x256 chunk meshes in under 5ms |
| Synchronous chunk generation | Phase 1: World system architecture | No frame time spikes >8ms during movement; check DevTools Performance |
| Chunk dispose on unload | Phase 2: Chunk lifecycle | `renderer.info.memory.geometries` stable during 5-minute exploration loop |
| Texture stretching with greedy mesh | Phase 2: Meshing + texturing together | Each block face displays exactly one tiled texture, not a stretched one |
| Ambient occlusion quad flip | Phase 3: Lighting/shading | No diagonal stripe artifacts visible in enclosed spaces or concave corners |
| Context menu blocking right-click | Phase 3: Input / block interaction | Right-click on canvas — no browser menu appears |
| Chunk boundary seams | Phase 2: Chunk meshing | No visible gaps or z-fighting lines between adjacent chunks |
| Water transparency ordering | Phase 4: Transparent blocks | Water renders correctly behind and in front of opaque blocks |

---

## Sources

- [0fps.net — Meshing in a Minecraft Game (Part 1)](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/) — face culling, greedy meshing fundamentals
- [0fps.net — Meshing in a Minecraft Game (Part 2)](https://0fps.net/2012/07/07/meshing-minecraft-part-2/) — greedy meshing implementation
- [0fps.net — Ambient Occlusion for Minecraft-like Worlds](https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/) — quad orientation fix (HIGH confidence)
- [0fps.net — Texture Atlases, Wrapping and Mip-mapping](https://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/) — texture atlas pitfalls
- [0fps.net — An Analysis of Minecraft-like Engines](https://0fps.net/2012/01/14/an-analysis-of-minecraft-like-engines/) — data structure analysis, flat vs nested arrays
- [deathcap — Six Months of voxel.js (Medium)](https://medium.com/@deathcap1/six-months-of-voxel-js-494be64dd1cc) — real project post-mortem: texture stretching, lag spikes, architectural coupling
- [Three.js Forum — Optimizing my Minecraft clone](https://discourse.threejs.org/t/optimizing-my-minecraft-clone/82550) — real-world Three.js voxel performance problems
- [Three.js Forum — Chunk generation Minecraft like](https://discourse.threejs.org/t/chunk-generation-minecraft-like/16429) — chunk management patterns
- [MDN — WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) — WebGL resource disposal, draw call limits
- [Adventure Box — Texturing Greedy Meshes](https://blog.adventurebox.com/2015/02/11/texturing-greedy-meshes-in-voxel-worlds/) — greedy mesh UV fragment shader approach
- [Mozilla Research — WebGL Off the Main Thread](https://hacks.mozilla.org/2016/01/webgl-off-the-main-thread/) — Web Worker + WebGL constraints
- [Let's Make a Voxel Engine — Chunk Management](https://sites.google.com/site/letsmakeavoxelengine/home/chunk-management) — chunk rebuild budget, neighbor dependencies
- [voxelmetaverse Issue #14 — Greedy meshing stretches textures](https://github.com/deathcap/voxelmetaverse/issues/14) — confirmed texture stretching bug report

---
*Pitfalls research for: Browser-based voxel engine (Minecraft-like)*
*Researched: 2026-03-27*
