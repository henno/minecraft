import { CHUNK_SIZE, CHUNK_HEIGHT } from '../types';
import { isTransparent } from '../world/BlockRegistry';
import { Chunk } from '../world/Chunk';

/**
 * MeshBuffers — the raw typed arrays that will become a THREE.BufferGeometry.
 *
 * These are returned from buildChunkMesh and uploaded to the GPU by the renderer.
 * Using typed arrays (not THREE.Vector3[]) keeps memory compact and avoids GC.
 */
export interface MeshBuffers {
  positions: Float32Array;  // 3 floats per vertex (x, y, z)
  normals: Float32Array;    // 3 floats per vertex (normal direction)
  uvs: Float32Array;        // 2 floats per vertex (u, v) — simple [0,1] per face for now
  indices: Uint32Array;     // 3 ints per triangle (index into position array)
  vertexCount: number;
  indexCount: number;
}

// The 6 face directions: +X, -X, +Y, -Y, +Z, -Z
// Each face: normal direction, and 4 vertex offsets from block origin
const FACES = [
  // +X face (right)
  {
    normal: [1, 0, 0] as const,
    neighbourOffset: [1, 0, 0] as const,
    corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] as const,
  },
  // -X face (left)
  {
    normal: [-1, 0, 0] as const,
    neighbourOffset: [-1, 0, 0] as const,
    corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] as const,
  },
  // +Y face (top)
  {
    normal: [0, 1, 0] as const,
    neighbourOffset: [0, 1, 0] as const,
    corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] as const,
  },
  // -Y face (bottom)
  {
    normal: [0, -1, 0] as const,
    neighbourOffset: [0, -1, 0] as const,
    corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] as const,
  },
  // +Z face (front)
  {
    normal: [0, 0, 1] as const,
    neighbourOffset: [0, 0, 1] as const,
    corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] as const,
  },
  // -Z face (back)
  {
    normal: [0, 0, -1] as const,
    neighbourOffset: [0, 0, -1] as const,
    corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] as const,
  },
];

/**
 * Build a face-culled mesh for the given chunk.
 *
 * Rules:
 *   - A face is emitted when a solid block is adjacent to a transparent/air block.
 *   - For faces on chunk boundaries, the neighbour chunk is checked if provided.
 *     If no neighbour chunk is available, the boundary face is emitted (visible edge).
 *   - AIR and WATER blocks never emit faces.
 *   - One quad (2 triangles, 4 vertices) per visible face.
 *
 * NEVER create one Mesh per block — one merged BufferGeometry per chunk only.
 * See PITFALLS.md P6.
 *
 * @param chunk The chunk to mesh
 * @param neighbours Map of neighbour chunks by direction key — reduces seam artifacts
 *   Keys: 'px', 'nx', 'pz', 'nz' (neighbour in +X, -X, +Z, -Z direction)
 */
export function buildChunkMesh(
  chunk: Chunk,
  neighbours: Partial<Record<'px' | 'nx' | 'pz' | 'nz', Chunk>> = {}
): MeshBuffers {
  // Pre-allocate generous buffers; we track actual counts separately
  // Worst case: each block contributes 6 faces × 4 vertices = 24 vertices
  // In practice face culling reduces this by ~80% for solid terrain
  const maxQuads = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE * 6;
  const positions = new Float32Array(maxQuads * 4 * 3);
  const normals = new Float32Array(maxQuads * 4 * 3);
  const uvs = new Float32Array(maxQuads * 4 * 2);
  const indices = new Uint32Array(maxQuads * 6);

  let vertexCount = 0;
  let indexCount = 0;

  // World-space offset of this chunk's origin
  const originX = chunk.cx * CHUNK_SIZE;
  const originZ = chunk.cz * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = chunk.getBlock(lx, ly, lz);
        // Skip AIR and WATER — they don't emit faces
        if (isTransparent(blockId)) continue;

        for (const face of FACES) {
          const [nx, ny, nz] = face.neighbourOffset;
          const nlx = lx + nx;
          const nly = ly + ny;
          const nlz = lz + nz;

          // Determine the block ID on the other side of this face
          let neighbourId: number;

          // Check if neighbour is inside this chunk
          if (nlx >= 0 && nlx < CHUNK_SIZE && nly >= 0 && nly < CHUNK_HEIGHT && nlz >= 0 && nlz < CHUNK_SIZE) {
            neighbourId = chunk.getBlock(nlx, nly, nlz);
          } else {
            // Neighbour is in an adjacent chunk — look it up
            let neighbourChunk: Chunk | undefined;
            if (nlx < 0) neighbourChunk = neighbours['nx'];
            else if (nlx >= CHUNK_SIZE) neighbourChunk = neighbours['px'];
            else if (nlz < 0) neighbourChunk = neighbours['nz'];
            else if (nlz >= CHUNK_SIZE) neighbourChunk = neighbours['pz'];

            if (neighbourChunk) {
              const clampedLx = ((nlx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
              const clampedLz = ((nlz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
              neighbourId = neighbourChunk.getBlock(clampedLx, nly, clampedLz);
            } else {
              // No neighbour chunk loaded — emit face (conservative: show boundary)
              neighbourId = 0; // treat as AIR
            }
          }

          // Only emit face if neighbour is transparent
          if (!isTransparent(neighbourId)) continue;

          // Emit quad: 4 vertices, 2 triangles
          const [fnx, fny, fnz] = face.normal;
          const baseVertex = vertexCount;

          for (const corner of face.corners) {
            const wx = originX + lx + corner[0];
            const wy = ly + corner[1];
            const wz = originZ + lz + corner[2];

            const vi = vertexCount * 3;
            positions[vi]     = wx;
            positions[vi + 1] = wy;
            positions[vi + 2] = wz;
            normals[vi]     = fnx;
            normals[vi + 1] = fny;
            normals[vi + 2] = fnz;

            vertexCount++;
          }

          // UV: simple [0,1] per face — 4 corners map to quad corners
          const uvi = baseVertex * 2;
          uvs[uvi]     = 0; uvs[uvi + 1] = 0;
          uvs[uvi + 2] = 0; uvs[uvi + 3] = 1;
          uvs[uvi + 4] = 1; uvs[uvi + 5] = 1;
          uvs[uvi + 6] = 1; uvs[uvi + 7] = 0;

          // Two triangles: (0,1,2) and (0,2,3) relative to baseVertex
          indices[indexCount++] = baseVertex;
          indices[indexCount++] = baseVertex + 1;
          indices[indexCount++] = baseVertex + 2;
          indices[indexCount++] = baseVertex;
          indices[indexCount++] = baseVertex + 2;
          indices[indexCount++] = baseVertex + 3;
        }
      }
    }
  }

  // Return sliced views so callers get exactly the right size
  return {
    positions: positions.slice(0, vertexCount * 3),
    normals: normals.slice(0, vertexCount * 3),
    uvs: uvs.slice(0, vertexCount * 2),
    indices: indices.slice(0, indexCount),
    vertexCount,
    indexCount,
  };
}
