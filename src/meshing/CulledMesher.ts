import { BlockFace, BlockId, BlockIds, CHUNK_SIZE, CHUNK_HEIGHT } from '../types';
import type { TextureAtlasLayout } from '../rendering/TextureAtlas';
import { getBlockTexture, isTransparent } from '../world/BlockRegistry';
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
  colors: Float32Array;     // 3 floats per vertex (rgb face shading)
  uvs: Float32Array;        // 2 floats per vertex (u, v) sampled from texture atlas
  indices: Uint32Array;     // 3 ints per triangle (index into position array)
  vertexCount: number;
  indexCount: number;
}

export interface ChunkMeshBuffers {
  opaque: MeshBuffers;
  water: MeshBuffers;
}

// The 6 face directions: +X, -X, +Y, -Y, +Z, -Z
// Each face: normal direction, and 4 vertex offsets from block origin
const FACES = [
  // +X face (right)
  {
    face: 'px' as BlockFace,
    brightness: 0.82,
    normal: [1, 0, 0] as const,
    neighbourOffset: [1, 0, 0] as const,
    corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] as const,
  },
  // -X face (left)
  {
    face: 'nx' as BlockFace,
    brightness: 0.82,
    normal: [-1, 0, 0] as const,
    neighbourOffset: [-1, 0, 0] as const,
    corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] as const,
  },
  // +Y face (top)
  {
    face: 'py' as BlockFace,
    brightness: 1,
    normal: [0, 1, 0] as const,
    neighbourOffset: [0, 1, 0] as const,
    corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] as const,
  },
  // -Y face (bottom)
  {
    face: 'ny' as BlockFace,
    brightness: 0.58,
    normal: [0, -1, 0] as const,
    neighbourOffset: [0, -1, 0] as const,
    corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] as const,
  },
  // +Z face (front)
  {
    face: 'pz' as BlockFace,
    brightness: 0.7,
    normal: [0, 0, 1] as const,
    neighbourOffset: [0, 0, 1] as const,
    corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] as const,
  },
  // -Z face (back)
  {
    face: 'nz' as BlockFace,
    brightness: 0.7,
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
 *   - AIR never emits faces; WATER uses the transparent pass only.
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
  atlas: TextureAtlasLayout,
  neighbours: Partial<Record<'px' | 'nx' | 'pz' | 'nz', Chunk>> = {}
): ChunkMeshBuffers {
  // Pre-allocate generous buffers; we track actual counts separately
  // Worst case: each block contributes 6 faces × 4 vertices = 24 vertices
  // In practice face culling reduces this by ~80% for solid terrain
  const maxQuads = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE * 6;
  let opaqueVertexCount = 0;
  let opaqueIndexCount = 0;
  let waterVertexCount = 0;
  let waterIndexCount = 0;

  const opaque = {
    positions: new Float32Array(maxQuads * 4 * 3),
    normals: new Float32Array(maxQuads * 4 * 3),
    colors: new Float32Array(maxQuads * 4 * 3),
    uvs: new Float32Array(maxQuads * 4 * 2),
    indices: new Uint32Array(maxQuads * 6),
  };

  const water = {
    positions: new Float32Array(maxQuads * 4 * 3),
    normals: new Float32Array(maxQuads * 4 * 3),
    colors: new Float32Array(maxQuads * 4 * 3),
    uvs: new Float32Array(maxQuads * 4 * 2),
    indices: new Uint32Array(maxQuads * 6),
  };

  // World-space offset of this chunk's origin
  const originX = chunk.cx * CHUNK_SIZE;
  const originZ = chunk.cz * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = chunk.getBlock(lx, ly, lz);
        if (blockId === BlockIds.AIR) continue;

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

          if (blockId === BlockIds.WATER) {
            if (neighbourId !== BlockIds.AIR) continue;
            const emitted = emitFace(water, waterVertexCount, waterIndexCount, atlas, blockId, face, originX, originZ, lx, ly, lz);
            waterVertexCount = emitted.vertexCount;
            waterIndexCount = emitted.indexCount;
            continue;
          }

          if (!isTransparent(neighbourId)) continue;
          const emitted = emitFace(opaque, opaqueVertexCount, opaqueIndexCount, atlas, blockId, face, originX, originZ, lx, ly, lz);
          opaqueVertexCount = emitted.vertexCount;
          opaqueIndexCount = emitted.indexCount;
        }
      }
    }
  }

  return {
    opaque: finalizeMeshBuffers(opaque, opaqueVertexCount, opaqueIndexCount),
    water: finalizeMeshBuffers(water, waterVertexCount, waterIndexCount),
  };
}

function emitFace(
  buffers: Omit<MeshBuffers, 'vertexCount' | 'indexCount'>,
  vertexCount: number,
  indexCount: number,
  atlas: TextureAtlasLayout,
  blockId: BlockId,
  face: typeof FACES[number],
  originX: number,
  originZ: number,
  lx: number,
  ly: number,
  lz: number
): { vertexCount: number; indexCount: number } {
  const [fnx, fny, fnz] = face.normal;
  const baseVertex = vertexCount;
  const brightness = face.brightness;
  let nextVertexCount = vertexCount;
  let nextIndexCount = indexCount;

  for (const corner of face.corners) {
    const wx = originX + lx + corner[0];
    const wy = ly + corner[1];
    const wz = originZ + lz + corner[2];

    const vi = nextVertexCount * 3;
    buffers.positions[vi] = wx;
    buffers.positions[vi + 1] = wy;
    buffers.positions[vi + 2] = wz;
    buffers.normals[vi] = fnx;
    buffers.normals[vi + 1] = fny;
    buffers.normals[vi + 2] = fnz;
    buffers.colors[vi] = brightness;
    buffers.colors[vi + 1] = brightness;
    buffers.colors[vi + 2] = brightness;

    nextVertexCount++;
  }

  const tile = getBlockTexture(blockId, face.face);
  const rect = atlas.rects[tile];
  const uvi = baseVertex * 2;
  buffers.uvs[uvi] = rect.u0;
  buffers.uvs[uvi + 1] = rect.v0;
  buffers.uvs[uvi + 2] = rect.u0;
  buffers.uvs[uvi + 3] = rect.v1;
  buffers.uvs[uvi + 4] = rect.u1;
  buffers.uvs[uvi + 5] = rect.v1;
  buffers.uvs[uvi + 6] = rect.u1;
  buffers.uvs[uvi + 7] = rect.v0;

  buffers.indices[nextIndexCount++] = baseVertex;
  buffers.indices[nextIndexCount++] = baseVertex + 1;
  buffers.indices[nextIndexCount++] = baseVertex + 2;
  buffers.indices[nextIndexCount++] = baseVertex;
  buffers.indices[nextIndexCount++] = baseVertex + 2;
  buffers.indices[nextIndexCount++] = baseVertex + 3;

  return { vertexCount: nextVertexCount, indexCount: nextIndexCount };
}

function finalizeMeshBuffers(
  buffers: Omit<MeshBuffers, 'vertexCount' | 'indexCount'>,
  vertexCount: number,
  indexCount: number
): MeshBuffers {
  return {
    positions: buffers.positions.slice(0, vertexCount * 3),
    normals: buffers.normals.slice(0, vertexCount * 3),
    colors: buffers.colors.slice(0, vertexCount * 3),
    uvs: buffers.uvs.slice(0, vertexCount * 2),
    indices: buffers.indices.slice(0, indexCount),
    vertexCount,
    indexCount,
  };
}
