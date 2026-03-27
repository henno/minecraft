# Tseburek — Browser Voxel Engine

## What This Is

A browser-based Minecraft-like voxel engine that generates infinite procedural terrain and lets players explore, break, and place blocks. Runs in any modern browser via WebGL — no install, no server. Classic 16x16 pixel art textures for the authentic Minecraft aesthetic.

## Core Value

Performant infinite terrain generation and rendering in the browser — if the world doesn't load fast and render smoothly, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Infinite procedural terrain generation with chunk-based loading/unloading
- [ ] Classic Minecraft-style 16x16 block textures
- [ ] 5-10 block types: grass, dirt, stone, sand, water, wood, leaves
- [ ] First-person camera with WASD + mouse look controls
- [ ] Block breaking (left click)
- [ ] Block placing (right click)
- [ ] Smooth chunk loading as player moves through the world
- [ ] Basic lighting/shading for depth perception
- [ ] Performant rendering (greedy meshing or similar optimization)

### Out of Scope

- Multiplayer / networking — single player only, keeping architecture simple
- Mobs / entities — engine focus, no AI or entity systems
- Inventory / crafting — no game mechanics beyond place/break
- Sound / music — visual engine only for now
- Mobile support — desktop browsers only
- Save/load — not needed for engine demo

## Context

- Browser-based using WebGL (Three.js or raw WebGL)
- Terrain generated with Perlin/simplex noise
- Chunk-based world management for infinite terrain
- Performance is critical — voxel engines are GPU/memory intensive
- TypeScript for type safety and maintainability

## Constraints

- **Platform**: Browser only — must work in Chrome, Firefox, Safari
- **Rendering**: WebGL — no WebGPU (broader compatibility)
- **Performance**: 60fps target at reasonable render distance
- **Dependencies**: Minimal — avoid heavy frameworks beyond rendering library

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Browser over desktop | Faster to implement, instant sharing, no build/packaging overhead | — Pending |
| Single player only | Simplifies architecture, no networking complexity | — Pending |
| Classic Minecraft textures | Proven aesthetic, clear visual identity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*
