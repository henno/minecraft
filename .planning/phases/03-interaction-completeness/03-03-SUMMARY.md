# 03-03 Summary

- Split chunk meshing in `src/meshing/CulledMesher.ts` into `opaque` and `water` buffers so water renders in its own transparent pass.
- Added dedicated opaque/water materials in `src/rendering/ChunkMaterial.ts`; water uses tint, opacity, and `depthWrite: false` so submerged terrain stays visible.
- Expanded the atlas and registry with `wood` and `leaves` in `src/rendering/TextureAtlas.ts`, `src/world/BlockRegistry.ts`, and the on-screen hotbar in `src/core/Game.ts`.
- Final placeable palette is 7 blocks: grass, dirt, stone, sand, water, wood, leaves.

## Verification

- `npx tsc --noEmit`
- `npm run build`
- Browser check in Playwright Chromium: water reads blue and translucent, and the screenshot captured in `phase3-water-view.png` shows terrain visible through water behind placed leaves.
