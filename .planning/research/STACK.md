# Stack Research

**Domain:** Browser-based voxel engine (Minecraft-like)
**Researched:** 2026-03-27
**Confidence:** HIGH (core stack), MEDIUM (supporting libraries)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 6.0.2 | Language | Type safety for complex voxel math, chunk indexing, and block type enums. Catches off-by-one errors in 3D coordinate systems at compile time rather than runtime. Standard choice for any non-trivial JS project in 2025+. |
| Three.js | 0.183.2 | WebGL rendering abstraction | The dominant 3D library for the browser. Provides Camera, BufferGeometry, Material, and the render loop. You use raw BufferGeometry (not Mesh per block) — Three.js handles GPU buffer uploads without requiring raw WebGL knowledge. Monthly release cadence, large community, well-documented voxel patterns in official manual. |
| Vite | 8.0.3 | Dev server + bundler | Sub-50ms HMR means shader and geometry code changes reflect immediately. Native TypeScript support via esbuild. The `vanilla-ts` template starts the project with zero framework overhead. No React/Vue needed for a game loop — Vite handles the asset pipeline cleanly. |
| simplex-noise | 4.0.3 | Terrain height/biome generation | Dependency-free, tree-shakeable, ~70M calls/second on a single thread. Provides 2D and 3D variants. The `createNoise2D`/`createNoise3D` API (v4.x) supports seeded RNG via `alea` for deterministic worlds. OpenSimplex is patent-clear; simplex-noise.js is widely used in production terrain systems. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| alea | 1.0.1 | Seeded PRNG for deterministic noise | Use with simplex-noise to seed terrain — same seed always produces the same world. Required for any `createNoise2D(prng)` call. Zero dependencies. |
| stats.js | 0.17.0 | FPS/memory overlay during development | Drop-in `Stats` panel showing FPS, frame time, and MB used. Essential for catching regressions during chunk meshing work. Remove from production build or guard with `import.meta.env.DEV`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite `vanilla-ts` template | Project scaffold | `npm create vite@latest tseburek -- --template vanilla-ts` — produces a minimal index.html + main.ts with no framework overhead. |
| TypeScript strict mode | Catch coordinate/index bugs | Enable `"strict": true` and `"noUncheckedIndexedAccess": true` in tsconfig. Voxel engines have dense array indexing; unchecked access causes silent bugs. |
| Vite GLSL plugin (`vite-plugin-glsl`) | Import `.glsl` files as strings | If you write custom shaders (AO, texture atlas UV math), this lets you keep shaders in separate `.glsl` files with syntax highlighting rather than template literals. Optional — only needed if you write ShaderMaterial shaders. |

## Installation

```bash
# Core
npm create vite@latest tseburek -- --template vanilla-ts
cd tseburek
npm install three simplex-noise alea

# Dev dependencies
npm install -D @types/three stats.js

# Optional — only if writing custom GLSL shaders
npm install -D vite-plugin-glsl
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Three.js | Raw WebGL | Only if you need absolute GPU control and are willing to write your own matrix math, camera, and buffer management. For a Minecraft-like engine the abstraction cost of Three.js is worth it — BufferGeometry maps directly to how you build chunk meshes. |
| Three.js | Babylon.js | Babylon has a larger built-in feature set (physics, GUI, inspector) but heavier bundle. For a focused engine demo, Three.js is lighter and its manual has a dedicated voxel geometry tutorial. |
| Three.js | PlayCanvas / A-Frame | These are scene-graph editors wrapped around WebGL. Voxel engines need manual control over mesh construction — scene-graph abstractions fight you when you're generating geometry procedurally. |
| Vite | webpack / Parcel | webpack is slower dev startup; Parcel lacks the Vite HMR speed. For a GPU-heavy project where you iterate on shaders and mesh generation, fast HMR pays off. |
| simplex-noise | noisejs (josephg) | noisejs works but is less maintained and doesn't have typed exports. simplex-noise.js is actively maintained and ships ESM + TypeScript declarations. |
| simplex-noise | @types/perlin-noise or similar | Perlin noise has directional artifacts that produce visible grid patterns in terrain. Simplex is strictly better for natural-looking terrain. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `THREE.InstancedMesh` for terrain blocks | Instancing places identical geometry at many transforms — you can't do face-culling or greedy meshing. Each instance is a full cube including hidden interior faces. Kills performance at scale. | Custom `BufferGeometry` per chunk, building only visible quad faces. The Three.js voxel manual tutorial demonstrates this explicitly. |
| `THREE.BoxGeometry` per block | One draw call per block. A 16×16×256 chunk is 65,536 draw calls. GPU can handle ~100-300 draw calls at 60fps. This approach breaks at even small render distances. | One merged `BufferGeometry` per chunk with face culling, re-meshed on block changes. |
| React Three Fiber (R3F) | Adds React's reconciler overhead on top of Three.js. Useful for UI-driven 3D scenes, not for a game loop that runs every frame and manually controls geometry. Fiber's per-frame React overhead is measurable. | Vanilla Three.js with a `requestAnimationFrame` loop. |
| voxel.js (max-mapper/voxel-engine) | Abandoned — last significant commit was 2013-2015. The retrospective blog post from the author describes why the modular architecture failed. Dependencies are unmaintained. | Write the engine yourself using Three.js primitives; it's the right scope for this project. |
| WebGPU (Three.js `WebGPURenderer`) | The project constraint explicitly requires WebGL for cross-browser compatibility. Safari's WebGPU support is incomplete as of early 2026. Three.js WebGPU path is still maturing. | `THREE.WebGLRenderer` — works in Chrome, Firefox, and Safari. |

## Stack Patterns by Variant

**If adding ambient occlusion (AO) shading:**
- Write a custom `ShaderMaterial` that samples per-vertex AO baked into a buffer attribute
- Add `vite-plugin-glsl` for clean shader file management
- AO is computed at mesh-build time per vertex, stored as a float attribute, sampled in the fragment shader

**If adding Web Worker chunk meshing (Phase 2+):**
- Move mesh generation logic to a Worker using `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`
- Vite handles Worker bundling natively — no special config needed
- Pass chunk voxel data as `Uint8Array` / `Int32Array` (transferable) not plain objects
- `SharedArrayBuffer` requires COOP/COEP headers — simpler to use `Transferable` ownership transfer

**If terrain needs 3D caves (not just height-map surface):**
- Use `createNoise3D` from simplex-noise with a density threshold (e.g. `noise3D(x,y,z) < -0.2` = air)
- Layer 2D height-map + 3D cave noise for Minecraft-like terrain
- 3D noise is ~3x more calls than 2D; acceptable cost when run in a Worker

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| three@0.183.2 | @types/three@0.183.1 | Types package tracks three.js minor version. Install matching minor. `npm install -D @types/three@0.183` ensures alignment. |
| simplex-noise@4.0.3 | alea@1.0.1 | v4.x API requires a PRNG function, not a seed integer. Pass `alea('my-seed')` as the argument to `createNoise2D`. v3.x API is incompatible (different import pattern). |
| vite@8.0.3 | TypeScript@6.0.2 | Vite 8 uses Rolldown internally. TypeScript 6.x is supported. No known conflicts. |
| stats.js@0.17.0 | No @types/stats.js needed | Package ships its own TypeScript declarations. Install as devDependency. |

## Sources

- npm registry (live query March 2026) — confirmed versions: three@0.183.2, simplex-noise@4.0.3, vite@8.0.3, typescript@6.0.2, @types/three@0.183.1, alea@1.0.1, stats.js@0.17.0
- https://threejs.org/manual/en/voxel-geometry.html — official Three.js voxel geometry tutorial; chunk structure, face culling, BufferGeometry approach — HIGH confidence
- https://github.com/jwagner/simplex-noise.js — simplex-noise.js README; v4.x API, performance numbers (~70M calls/s), alea integration — HIGH confidence
- https://vite.dev/guide/ — Vite official docs; vanilla-ts template, Worker bundling, HMR — HIGH confidence
- https://discourse.threejs.org/t/how-to-make-a-ultra-optimized-voxel-terrain-like-this-in-a-html-file/83315 — Three.js forum; instancing vs BufferGeometry trade-offs for voxel terrain — MEDIUM confidence
- https://www.jameshylands.co.uk/2022/10/greedy-meshing-in-javascript.html — Greedy meshing in JS; vertex count comparison (culled: 72,792 vs greedy: 4,092 for 32^3 chunk) — MEDIUM confidence
- https://dev.to/lucasdamianjohnson/how-i-made-multi-threaded-voxel-engine-in-typescript-1e8f — multi-threaded voxel engine TypeScript; SharedArrayBuffer chunk approach — MEDIUM confidence (WebSearch-sourced, not directly verified)

---
*Stack research for: Browser-based voxel engine (Minecraft-like)*
*Researched: 2026-03-27*
