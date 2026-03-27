import { BlockId, BlockIds } from '../types';

export interface BlockDef {
  id: BlockId;
  name: string;
  solid: boolean;   // false = AIR and WATER (not collidable for now)
  transparent: boolean; // true = AIR, WATER
}

// Block definitions indexed by BlockId. Array position == block ID.
export const BLOCK_DEFS: readonly BlockDef[] = [
  { id: BlockIds.AIR,   name: 'air',   solid: false, transparent: true  },
  { id: BlockIds.GRASS, name: 'grass', solid: true,  transparent: false },
  { id: BlockIds.DIRT,  name: 'dirt',  solid: true,  transparent: false },
  { id: BlockIds.STONE, name: 'stone', solid: true,  transparent: false },
  { id: BlockIds.SAND,  name: 'sand',  solid: true,  transparent: false },
  { id: BlockIds.WATER, name: 'water', solid: false, transparent: true  },
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
