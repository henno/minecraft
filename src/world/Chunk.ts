import { BlockId, CHUNK_SIZE, CHUNK_HEIGHT, ChunkCoord } from '../types';
import { localIndex, chunkKey } from '../utils/coords';

/**
 * Chunk — the fundamental data container for voxel world data.
 *
 * Stores voxel block IDs in a flat Uint8Array. Supports up to 255 block types.
 * Layout: index = ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx
 * (y-major, z-middle, x-innermost for cache-friendly x-axis iteration)
 *
 * NEVER store voxel data as blocks[x][y][z] nested arrays — 3-10x slower to
 * iterate due to cache misses and GC pressure. See PITFALLS.md P4.
 */
export class Chunk {
  /** Chunk grid position */
  readonly cx: number;
  readonly cz: number;

  /** Flat voxel storage: Uint8Array of CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE elements */
  readonly data: Uint8Array;

  /** Unique string key for use in Map<string, Chunk> */
  readonly key: string;

  /** True when this chunk's mesh is out of date and needs rebuilding */
  dirty: boolean = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    // Uint8Array is zero-initialised — all blocks default to AIR (0)
  }

  /** Read block ID at local coordinates. Returns 0 (AIR) if out of bounds. */
  getBlock(lx: number, ly: number, lz: number): BlockId {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
      return 0; // AIR
    }
    return this.data[localIndex(lx, ly, lz)] ?? 0;
  }

  /** Write block ID at local coordinates. Marks chunk dirty. Ignores out-of-bounds writes. */
  setBlock(lx: number, ly: number, lz: number, id: BlockId): void {
    if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
      return;
    }
    this.data[localIndex(lx, ly, lz)] = id;
    this.dirty = true;
  }
}

// Re-export ChunkCoord for consumers that work with Chunk objects
export type { ChunkCoord };
