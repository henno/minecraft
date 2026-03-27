import { CHUNK_SIZE, ChunkCoord, LocalCoord } from '../types';

/** Convert world X/Z to chunk grid coordinates (floor division). */
export function worldToChunk(wx: number, wz: number): ChunkCoord {
  return {
    cx: Math.floor(wx / CHUNK_SIZE),
    cz: Math.floor(wz / CHUNK_SIZE),
  };
}

/** Convert chunk grid coordinates to the world-space origin (minimum corner) of that chunk. */
export function chunkOrigin(cx: number, cz: number): { x: number; z: number } {
  return { x: cx * CHUNK_SIZE, z: cz * CHUNK_SIZE };
}

/** Convert world coordinates to local coordinates within the chunk that contains them. */
export function worldToLocal(wx: number, wy: number, wz: number): LocalCoord {
  return {
    lx: ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ly: wy,
    lz: ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  };
}

/**
 * Flat 3D array index for a voxel at local (lx, ly, lz).
 * Layout: y-major then z then x → index = ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx
 * This matches cache-friendly iteration order (iterate x innermost).
 */
export function localIndex(lx: number, ly: number, lz: number): number {
  return ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
}

/** Unique string key for a chunk coordinate, used in Map<string, Chunk>. */
export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
