import { BlockFace, BlockId, BlockIds } from '../types';
import type { AtlasTileId } from '../rendering/TextureAtlas';

export interface BlockDef {
  id: BlockId;
  name: string;
  solid: boolean;   // false = AIR and WATER (not collidable for now)
  transparent: boolean; // true = AIR, WATER
  placeable: boolean;
  texture: AtlasTileId | Record<BlockFace, AtlasTileId>;
}

// Block definitions indexed by BlockId. Array position == block ID.
export const BLOCK_DEFS: readonly BlockDef[] = [
  { id: BlockIds.AIR,   name: 'air',   solid: false, transparent: true, placeable: false, texture: 'dirt' },
  {
    id: BlockIds.GRASS,
    name: 'grass',
    solid: true,
    transparent: false,
    placeable: true,
    texture: {
      px: 'grass-side',
      nx: 'grass-side',
      py: 'grass-top',
      ny: 'dirt',
      pz: 'grass-side',
      nz: 'grass-side',
    },
  },
  { id: BlockIds.DIRT,  name: 'dirt',  solid: true,  transparent: false, placeable: true, texture: 'dirt' },
  { id: BlockIds.STONE, name: 'stone', solid: true,  transparent: false, placeable: true, texture: 'stone' },
  { id: BlockIds.SAND,  name: 'sand',  solid: true,  transparent: false, placeable: true, texture: 'sand' },
  { id: BlockIds.WATER, name: 'water', solid: false, transparent: true, placeable: true, texture: 'water' },
  {
    id: BlockIds.WOOD,
    name: 'wood',
    solid: true,
    transparent: false,
    placeable: true,
    texture: {
      px: 'wood-side',
      nx: 'wood-side',
      py: 'wood-top',
      ny: 'wood-top',
      pz: 'wood-side',
      nz: 'wood-side',
    },
  },
  { id: BlockIds.LEAVES, name: 'leaves', solid: true, transparent: false, placeable: true, texture: 'leaves' },
];

/** Get block definition by ID. Returns AIR def if ID is out of range. */
export function getBlockDef(id: BlockId): BlockDef {
  return BLOCK_DEFS[id] ?? BLOCK_DEFS[BlockIds.AIR]!;
}

/** Returns true if the block at this ID is solid (player cannot pass through). */
export function isSolid(id: BlockId): boolean {
  return getBlockDef(id).solid;
}

/** Returns true if the block at this ID is transparent (adjacent faces should render). */
export function isTransparent(id: BlockId): boolean {
  return getBlockDef(id).transparent;
}

export function isPlaceable(id: BlockId): boolean {
  return getBlockDef(id).placeable;
}

export function getPlaceableBlockIds(): BlockId[] {
  return BLOCK_DEFS.filter((block) => block.placeable).map((block) => block.id);
}

/** Resolve the atlas tile for a block face. */
export function getBlockTexture(id: BlockId, face: BlockFace): AtlasTileId {
  const texture = getBlockDef(id).texture;
  return typeof texture === 'string' ? texture : texture[face];
}
