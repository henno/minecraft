import { CHUNK_SIZE, CHUNK_HEIGHT, BlockIds } from '../types';
import { localIndex, chunkOrigin } from '../utils/coords';
import { NoiseGenerator } from './NoiseGenerator';

/**
 * Sea level — blocks at y < SEA_LEVEL in air columns become WATER.
 * With CHUNK_HEIGHT = 64, placing sea at y=20 gives:
 *   - ~20 blocks of water/ocean at the bottom of world
 *   - ~44 blocks of terrain height range above sea level
 */
const SEA_LEVEL = 20;

/**
 * Fill a Uint8Array with block IDs for the chunk at (cx, cz).
 *
 * Block placement rules (top-down for each x,z column):
 *   1. Sample terrain height h = floor(noise.sample2D(wx, wz) * (CHUNK_HEIGHT - 1))
 *      This maps [0,1] noise to [0, 63] block height.
 *   2. For each y from 0 to CHUNK_HEIGHT-1:
 *      - y == h           → GRASS (surface)
 *      - h-3 <= y < h     → DIRT (3 layers of dirt below surface)
 *      - y < h-3          → STONE (deep bedrock)
 *      - y > h && y < SEA_LEVEL → WATER (fill ocean below sea level)
 *      - y > h            → AIR
 *
 * @param cx Chunk X grid coordinate
 * @param cz Chunk Z grid coordinate
 * @param noise Seeded NoiseGenerator instance (shared across chunks)
 * @returns Uint8Array of CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE elements
 */
export function generateChunk(cx: number, cz: number, noise: NoiseGenerator): Uint8Array {
  const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  const origin = chunkOrigin(cx, cz);

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = origin.x + lx;
      const wz = origin.z + lz;

      // Sample height in world blocks [0, CHUNK_HEIGHT - 1]
      const h = Math.floor(noise.sample2D(wx, wz) * (CHUNK_HEIGHT - 1));

      for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
        let blockId: number = BlockIds.AIR;

        if (ly === h) {
          blockId = BlockIds.GRASS;
        } else if (ly >= h - 3 && ly < h) {
          blockId = BlockIds.DIRT;
        } else if (ly < h - 3) {
          blockId = BlockIds.STONE;
        } else if (ly > h && ly < SEA_LEVEL) {
          // Air column below sea level → fill with water
          blockId = BlockIds.WATER;
        }
        // else: AIR (already 0 from Uint8Array initialisation)

        data[localIndex(lx, ly, lz)] = blockId;
      }
    }
  }

  return data;
}
