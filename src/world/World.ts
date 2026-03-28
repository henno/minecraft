import { Chunk } from './Chunk';
import { BlockId, BlockIds, CHUNK_HEIGHT, CHUNK_SIZE } from '../types';
import { worldToChunk, chunkKey, worldToLocal } from '../utils/coords';
import { isSolid } from './BlockRegistry';

interface TerrainResponse {
  cx: number;
  cz: number;
  data: Uint8Array;
}

/**
 * World — the authoritative registry for all loaded chunk data.
 *
 * Responsibilities:
 *   - Holds Map<string, Chunk> for all loaded chunks
 *   - Dispatches terrain generation to TerrainWorker via postMessage
 *   - Limits concurrent in-flight worker tasks to MAX_IN_FLIGHT (4)
 *     to prevent memory pressure from queuing too many large ArrayBuffers
 *   - Applies returned Uint8Array data to new Chunk instances
 *   - Tracks which chunks have newly-arrived data (needsMesh set)
 *
 * IMPORTANT: All voxel reads/writes route through World. Never bypass to
 * chunk.data directly from outside World.
 */
export class World {
  private readonly chunks = new Map<string, Chunk>();
  private readonly requested = new Set<string>(); // chunks with pending worker tasks
  private desiredKeys = new Set<string>();
  private readonly worker: Worker;
  private inFlight = 0;
  private readonly MAX_IN_FLIGHT = 4;

  /** Chunks that have received new data and need their mesh rebuilt */
  readonly needsMesh = new Set<string>();

  constructor() {
    this.worker = new Worker(
      new URL('../terrain/TerrainWorker.ts', import.meta.url),
      { type: 'module' }
    );
    this.worker.onmessage = this.onWorkerMessage.bind(this);
  }

  /**
   * Request a chunk to be generated if not already loaded or in-flight.
   * Respects MAX_IN_FLIGHT back-pressure — call this each frame for desired chunks.
   */
  requestChunk(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key) || this.requested.has(key)) return;
    if (this.inFlight >= this.MAX_IN_FLIGHT) return;

    this.requested.add(key);
    this.inFlight++;
    this.worker.postMessage({ cx, cz });
  }

  /** Called when the terrain worker returns chunk data. */
  private onWorkerMessage(event: MessageEvent<TerrainResponse>): void {
    const { cx, cz, data } = event.data;
    const key = chunkKey(cx, cz);

    this.requested.delete(key);
    this.inFlight--;

    if (!this.desiredKeys.has(key)) {
      return;
    }

    const chunk = new Chunk(cx, cz);
    // data.buffer was transferred — copy into a new Uint8Array owned by the chunk
    chunk.data.set(data);
    chunk.dirty = true;

    this.chunks.set(key, chunk);
    this.needsMesh.add(key);
  }

  /** Get a loaded chunk by grid coordinates. Returns undefined if not loaded. */
  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /**
   * Read block ID at world-space integer coordinates.
   * Returns 0 (AIR) if the containing chunk is not loaded.
   * O(1) — two Map lookups + array index math.
   */
  getBlock(wx: number, wy: number, wz: number): BlockId {
    const { cx, cz } = worldToChunk(wx, wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0;
    const { lx, ly, lz } = worldToLocal(wx, wy, wz);
    return chunk.getBlock(lx, ly, lz);
  }

  getLoadedBlock(wx: number, wy: number, wz: number): BlockId | null {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockIds.AIR;

    const { cx, cz } = worldToChunk(wx, wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return null;

    const { lx, ly, lz } = worldToLocal(wx, wy, wz);
    return chunk.getBlock(lx, ly, lz);
  }

  /**
   * Write block ID at world-space integer coordinates.
   * Marks the chunk dirty so its mesh will be rebuilt next frame.
   * No-op if the chunk is not loaded.
   */
  setBlock(wx: number, wy: number, wz: number, id: BlockId): boolean {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return false;

    const { cx, cz } = worldToChunk(wx, wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;

    const { lx, ly, lz } = worldToLocal(wx, wy, wz);
    const previous = chunk.getBlock(lx, ly, lz);
    if (previous === id) return false;

    chunk.setBlock(lx, ly, lz, id);
    this.markChunkDirty(cx, cz);

    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

    return true;
  }

  /** All currently loaded chunks (for iteration by renderer). */
  get loadedChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }

  updateStreaming(centerCx: number, centerCz: number, loadRadius: number, unloadRadius: number): string[] {
    const desired = new Set<string>();
    const wanted: Array<{ cx: number; cz: number; distance: number }> = [];

    for (let dz = -loadRadius; dz <= loadRadius; dz++) {
      for (let dx = -loadRadius; dx <= loadRadius; dx++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const key = chunkKey(cx, cz);
        desired.add(key);
        wanted.push({ cx, cz, distance: dx * dx + dz * dz });
      }
    }

    wanted.sort((a, b) => a.distance - b.distance);
    this.desiredKeys = desired;

    for (const chunk of wanted) {
      this.requestChunk(chunk.cx, chunk.cz);
    }

    const unloaded: string[] = [];
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.cx - centerCx);
      const dz = Math.abs(chunk.cz - centerCz);
      if (Math.max(dx, dz) <= unloadRadius) continue;

      this.chunks.delete(key);
      this.needsMesh.delete(key);
      unloaded.push(key);
    }

    return unloaded;
  }

  findSpawnPositionNear(
    wx: number,
    wz: number,
    radius: number,
    halfWidth = 0.3,
    height = 1.8
  ): { x: number; y: number; z: number } | null {
    for (let step = 0; step <= radius; step++) {
      for (let dz = -step; dz <= step; dz++) {
        for (let dx = -step; dx <= step; dx++) {
          if (step > 0 && Math.abs(dx) !== step && Math.abs(dz) !== step) continue;

          const x = Math.floor(wx + dx);
          const z = Math.floor(wz + dz);
          const surfaceY = this.findSurfaceY(x, z);

          if (surfaceY === null) continue;

          const spawnX = x + 0.5;
          const spawnY = surfaceY + 1;
          const spawnZ = z + 0.5;

          if (!this.hasClearance(spawnX, spawnY, spawnZ, halfWidth, height)) continue;

          return { x: spawnX, y: spawnY, z: spawnZ };
        }
      }
    }

    return null;
  }

  dispose(): void {
    this.worker.terminate();
  }

  private findSurfaceY(wx: number, wz: number): number | null {
    const { cx, cz } = worldToChunk(wx, wz);
    if (!this.getChunk(cx, cz)) return null;

    for (let y = CHUNK_HEIGHT - 3; y >= 0; y--) {
      if (!isSolid(this.getBlock(wx, y, wz))) continue;
      if (isSolid(this.getBlock(wx, y + 1, wz))) continue;
      if (isSolid(this.getBlock(wx, y + 2, wz))) continue;
      return y;
    }

    return null;
  }

  private hasClearance(x: number, y: number, z: number, halfWidth: number, height: number): boolean {
    const minX = Math.floor(x - halfWidth);
    const maxX = Math.floor(x + halfWidth - 1e-6);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height - 1e-6);
    const minZ = Math.floor(z - halfWidth);
    const maxZ = Math.floor(z + halfWidth - 1e-6);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (isSolid(this.getBlock(bx, by, bz))) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private markChunkDirty(cx: number, cz: number): void {
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    chunk.dirty = true;
    this.needsMesh.add(chunk.key);
  }
}
