import { Chunk } from './Chunk';
import { BlockId } from '../types';
import { worldToChunk, chunkKey, worldToLocal } from '../utils/coords';

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

    const chunk = new Chunk(cx, cz);
    // data.buffer was transferred — copy into a new Uint8Array owned by the chunk
    chunk.data.set(data);
    chunk.dirty = true;

    this.chunks.set(key, chunk);
    this.requested.delete(key);
    this.needsMesh.add(key);
    this.inFlight--;
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

  /**
   * Write block ID at world-space integer coordinates.
   * Marks the chunk dirty so its mesh will be rebuilt next frame.
   * No-op if the chunk is not loaded.
   */
  setBlock(wx: number, wy: number, wz: number, id: BlockId): void {
    const { cx, cz } = worldToChunk(wx, wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    const { lx, ly, lz } = worldToLocal(wx, wy, wz);
    chunk.setBlock(lx, ly, lz, id);
    this.needsMesh.add(chunk.key);
  }

  /** All currently loaded chunks (for iteration by renderer). */
  get loadedChunks(): IterableIterator<Chunk> {
    return this.chunks.values();
  }
}
