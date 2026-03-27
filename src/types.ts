// Chunk dimensions — world height is 64 blocks (D-02)
export const CHUNK_SIZE = 16;   // X and Z width
export const CHUNK_HEIGHT = 64; // Y height (world height per D-02)

// Block ID type — 0 = AIR, 1-255 = solid blocks
export type BlockId = number;

// Block IDs as named constants
export const BlockIds = {
  AIR:   0,
  GRASS: 1,
  DIRT:  2,
  STONE: 3,
  SAND:  4,
  WATER: 5,
} as const;

// Chunk grid coordinate (integer chunk position in the world grid)
export interface ChunkCoord {
  cx: number; // chunk X index
  cz: number; // chunk Z index
}

// World-space integer voxel coordinate
export interface WorldCoord {
  wx: number;
  wy: number;
  wz: number;
}

// Local voxel coordinate within a chunk (0 to CHUNK_SIZE-1 for x/z, 0 to CHUNK_HEIGHT-1 for y)
export interface LocalCoord {
  lx: number;
  ly: number;
  lz: number;
}
