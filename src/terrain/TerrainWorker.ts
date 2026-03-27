/**
 * TerrainWorker — Web Worker for chunk terrain generation.
 *
 * This file runs in a Worker context. It MUST NOT import Three.js, access
 * the DOM, or make WebGL calls — workers have no access to those APIs.
 *
 * Protocol:
 *   Incoming message: { cx: number, cz: number }
 *   Outgoing message: { cx: number, cz: number, data: Uint8Array }
 *   The data.buffer is transferred (zero-copy) — caller must not reuse data after postMessage.
 *
 * The NoiseGenerator is instantiated once per worker and reused for all chunks
 * (creating it per-message would re-initialise the PRNG on each call — expensive).
 */

import { NoiseGenerator } from './NoiseGenerator';
import { generateChunk } from './TerrainRules';

// Single noise instance shared for the lifetime of this worker
const noise = new NoiseGenerator('tseburek');

interface TerrainRequest {
  cx: number;
  cz: number;
}

interface TerrainResponse {
  cx: number;
  cz: number;
  data: Uint8Array;
}

self.onmessage = (event: MessageEvent<TerrainRequest>) => {
  const { cx, cz } = event.data;

  // Generate voxel data — CPU-intensive, runs off main thread
  const data = generateChunk(cx, cz, noise);

  // Transfer the ArrayBuffer to the main thread (zero-copy ownership transfer)
  // After this call, `data` and `data.buffer` are neutered in the worker
  const response: TerrainResponse = { cx, cz, data };
  self.postMessage(response, [data.buffer as ArrayBuffer]);
};
