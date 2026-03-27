import * as THREE from 'three';
import Stats from 'stats.js';
import { Renderer } from './Renderer';
import { World } from '../world/World';
import { buildChunkMesh } from '../meshing/CulledMesher';
import { CHUNK_SIZE } from '../types';

/**
 * Game — top-level coordinator.
 *
 * Responsibilities:
 *   - Initialise all subsystems
 *   - Request a 5×5 chunk grid around the origin
 *   - Each frame: apply newly-arrived chunk meshes to the Three.js scene
 *   - Drive the requestAnimationFrame loop
 *
 * Chunk mesh lifecycle:
 *   - World signals via needsMesh Set when a chunk has new data
 *   - Game calls buildChunkMesh() and creates a THREE.Mesh
 *   - On remesh, the old THREE.Mesh is removed and its geometry disposed (PITFALLS.md P3)
 *
 * Block colouring (no texture atlas yet — that's Phase 2):
 *   Use a simple MeshLambertMaterial per block type differentiated by vertex color.
 *   A single shared green material is fine for Phase 1 — visible terrain is the goal.
 */
export class Game {
  private readonly renderer: Renderer;
  private readonly world: World;
  private readonly chunkMeshes = new Map<string, THREE.Mesh>();
  private readonly stats: Stats;
  private animFrameId = 0;
  private lastTime = 0;

  // Render radius: 5×5 grid = indices -2 to +2 in both X and Z
  private readonly RENDER_RADIUS = 2;

  // Shared material for all chunks in Phase 1
  // Green-ish to suggest terrain — textures come in Phase 2
  private readonly chunkMaterial = new THREE.MeshLambertMaterial({
    vertexColors: false,
    color: 0x5a9e52, // muted green
    side: THREE.FrontSide,
  });

  // Suppress unused import warning — CHUNK_SIZE used via type check
  private readonly _chunkSize = CHUNK_SIZE;

  constructor() {
    this.renderer = new Renderer();
    this.world = new World();

    // Stats.js overlay — only in development
    this.stats = new Stats();
    this.stats.showPanel(0); // 0 = FPS panel
    if (import.meta.env.DEV) {
      document.body.appendChild(this.stats.dom);
    }
  }

  /** Initialise: request initial chunk grid. */
  init(): void {
    // Request 5×5 chunk grid centred on origin
    for (let cx = -this.RENDER_RADIUS; cx <= this.RENDER_RADIUS; cx++) {
      for (let cz = -this.RENDER_RADIUS; cz <= this.RENDER_RADIUS; cz++) {
        this.world.requestChunk(cx, cz);
      }
    }

    // Start loop
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop(time: number): void {
    this.animFrameId = requestAnimationFrame(this.loop.bind(this));
    this.stats.begin();

    const dt = Math.min((time - this.lastTime) / 1000, 0.1); // seconds, capped at 100ms
    this.lastTime = time;

    this.update(dt);
    this.renderer.render();

    this.stats.end();
  }

  private update(_dt: number): void {
    // Process chunks that have newly-arrived terrain data
    for (const key of this.world.needsMesh) {
      this.rebuildChunkMesh(key);
    }
    this.world.needsMesh.clear();

    // Re-request any missing chunks (back-pressure may have deferred them)
    for (let cx = -this.RENDER_RADIUS; cx <= this.RENDER_RADIUS; cx++) {
      for (let cz = -this.RENDER_RADIUS; cz <= this.RENDER_RADIUS; cz++) {
        this.world.requestChunk(cx, cz);
      }
    }
  }

  private rebuildChunkMesh(key: string): void {
    // Parse key to get cx, cz
    const [cxStr, czStr] = key.split(',');
    const cx = parseInt(cxStr!, 10);
    const cz = parseInt(czStr!, 10);

    const chunk = this.world.getChunk(cx, cz);
    if (!chunk) return;

    // Gather neighbour chunks for boundary face culling
    const neighbours = {
      px: this.world.getChunk(cx + 1, cz),
      nx: this.world.getChunk(cx - 1, cz),
      pz: this.world.getChunk(cx, cz + 1),
      nz: this.world.getChunk(cx, cz - 1),
    };

    const buffers = buildChunkMesh(chunk, neighbours);

    if (buffers.vertexCount === 0) return; // empty chunk — nothing to render

    // Build THREE.BufferGeometry from typed arrays
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('normal',   new THREE.BufferAttribute(buffers.normals,   3));
    geometry.setAttribute('uv',       new THREE.BufferAttribute(buffers.uvs,       2));
    geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));

    const mesh = new THREE.Mesh(geometry, this.chunkMaterial);
    mesh.name = `chunk-${key}`;

    // Remove and dispose old mesh if it exists (PITFALLS.md P3 — prevents GPU memory leak)
    const oldMesh = this.chunkMeshes.get(key);
    if (oldMesh) {
      this.renderer.scene.remove(oldMesh);
      oldMesh.geometry.dispose();
      // Material is shared — do NOT dispose it here
    }

    this.renderer.scene.add(mesh);
    this.chunkMeshes.set(key, mesh);
  }

  /** Clean up all resources. */
  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    for (const mesh of this.chunkMeshes.values()) {
      mesh.geometry.dispose();
    }
    this.chunkMaterial.dispose();
    this.renderer.dispose();
    this.stats.dom.remove();
  }
}
