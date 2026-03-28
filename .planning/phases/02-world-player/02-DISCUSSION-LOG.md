# Phase 2: World & Player - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md`.

**Date:** 2026-03-28
**Phase:** 2-World & Player
**Areas discussed:** Atlas source, player controls, streaming scope

---

## Atlas Source

| Option | Description | Selected |
|--------|-------------|----------|
| External PNG spritesheet | Add image assets to repo and load via Vite | |
| Runtime canvas atlas | Generate 16x16 pixel-art tiles in code and upload as texture | ✓ |

**Notes:** Repo currently has no art asset pipeline. Runtime atlas keeps the phase self-contained while still delivering identifiable block faces.

## First-Person Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Pointer lock + click-to-play overlay | Standard browser FPS UX | ✓ |
| Free mouse without pointer lock | Easier to wire, but poor FPS feel | |

**Notes:** Pointer lock is table-stakes for browser voxel engines and avoids edge-clamping issues.

## Chunk Streaming Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Static origin-centered loading | What Phase 1 does now | |
| Player-centered distance priority | Required for exploration | ✓ |

**Notes:** Phase 2 must replace the fixed 5x5 origin loop with player-relative streaming and unload.
