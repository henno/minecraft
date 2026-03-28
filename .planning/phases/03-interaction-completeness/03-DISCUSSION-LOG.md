# Phase 3: Interaction & Completeness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md`.

**Date:** 2026-03-28
**Phase:** 3-Interaction & Completeness
**Areas discussed:** targeting strategy, water path, performance validation

---

## Block Targeting Source

| Option | Description | Selected |
|--------|-------------|----------|
| Three.js mesh raycast | Intersect rendered chunk meshes and infer voxel | |
| Voxel DDA raycast against `World.getBlock()` | Deterministic voxel traversal from camera | ✓ |

**Notes:** World-data raycasting avoids mesh/material coupling and remains correct even if transparent water or future mesh optimizations change render geometry.

## Water Rendering Path

| Option | Description | Selected |
|--------|-------------|----------|
| Keep water merged into opaque terrain material | Simpler initially, but poor transparency behavior | |
| Separate transparent geometry/material path | Correct tint/opacity without breaking opaque terrain | ✓ |

**Notes:** Transparent water is a phase goal; folding it into the opaque path would make draw order and depth behavior harder to reason about.

## Performance Acceptance

| Option | Description | Selected |
|--------|-------------|----------|
| Informal feel-only check | "Seems smooth" browser judgment | |
| Explicit measured verification | Stats overlay + recorded render distance and scene conditions | ✓ |

**Notes:** The roadmap promises a 60fps target. The plan should therefore require an observable, repeatable verification step rather than a vague subjective pass.
