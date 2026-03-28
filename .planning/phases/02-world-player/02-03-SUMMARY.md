---
phase: 02-world-player
plan: "03"
subsystem: player-physics
tags: [collision, gravity, jump, spawn]
completed: 2026-03-28
---

# Phase 2 Plan 03 Summary

- Added `src/player/PlayerPhysics.ts` with an axis-separated voxel AABB resolver using `World.getBlock()` plus `isSolid()` checks.
- Collider dimensions: half-width `0.3`, height `1.8`, eye height `1.62`.
- Movement constants: walk speed `5.8`, gravity `24`, jump speed `8.5`, max fall speed `30`.
- Added deterministic spawn search in `src/world/World.ts` near origin with headroom checks so the player starts on valid terrain instead of inside slopes.
- `src/player/Player.ts` now bridges input intent into physics and keeps the first-person camera synced to the collider.
