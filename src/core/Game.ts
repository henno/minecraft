import * as THREE from 'three';
import Stats from 'stats.js';
import { Renderer } from './Renderer';
import { World } from '../world/World';
import { buildChunkMesh, MeshBuffers } from '../meshing/CulledMesher';
import { BlockIds, CHUNK_SIZE, VoxelTarget } from '../types';
import { createTextureAtlas } from '../rendering/TextureAtlas';
import { createChunkMaterials } from '../rendering/ChunkMaterial';
import { InputManager } from '../input/InputManager';
import { Player } from '../player/Player';
import { getBlockDef, getPlaceableBlockIds } from '../world/BlockRegistry';

export class Game {
  private readonly renderer: Renderer;
  private readonly world: World;
  private readonly chunkMeshes = new Map<string, THREE.Group>();
  private readonly stats: Stats;
  private readonly atlas = createTextureAtlas();
  private readonly materials = createChunkMaterials(this.atlas);
  private readonly input: InputManager;
  private readonly player: Player;
  private readonly hud: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly statusBar: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private readonly placeableBlockIds = getPlaceableBlockIds();

  private animFrameId = 0;
  private lastTime = 0;
  private smoothedFps = 60;
  private selectedBlockIndex = 0;

  private readonly LOAD_RADIUS = 4;
  private readonly UNLOAD_RADIUS = 5;
  private readonly MAX_MESH_UPDATES_PER_FRAME = 4;

  constructor() {
    this.renderer = new Renderer();
    this.world = new World();
    this.input = new InputManager(this.renderer.webgl.domElement);
    this.player = new Player(this.renderer.camera, this.input, this.world);
    this.hud = this.createHud();
    this.crosshair = this.createCrosshair();
    this.statusBar = this.createStatusBar();
    this.hotbar = this.createHotbar();
    this.renderer.webgl.domElement.addEventListener('click', () => this.input.requestPointerLock());
    this.renderer.configureFog((this.LOAD_RADIUS + 0.75) * CHUNK_SIZE);

    this.stats = new Stats();
    this.stats.showPanel(0);
    if (import.meta.env.DEV) {
      document.body.appendChild(this.stats.dom);
    }
  }

  init(): void {
    this.world.updateStreaming(0, 0, this.LOAD_RADIUS, this.UNLOAD_RADIUS);
    this.updateHud(null);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop(time: number): void {
    this.animFrameId = requestAnimationFrame(this.loop.bind(this));
    this.stats.begin();

    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.smoothedFps = THREE.MathUtils.lerp(this.smoothedFps, 1 / Math.max(dt, 1 / 240), 0.12);

    this.update(dt);
    this.renderer.render();

    this.stats.end();
  }

  private update(dt: number): void {
    this.player.update(dt);

    const interactionFrame = this.input.consumeInteractions();
    if (interactionFrame.selectedSlot !== null && interactionFrame.selectedSlot < this.placeableBlockIds.length) {
      this.selectedBlockIndex = interactionFrame.selectedSlot;
    }

    const center = this.player.isSpawned ? this.player.currentChunk : { cx: 0, cz: 0 };
    const unloadedKeys = this.world.updateStreaming(center.cx, center.cz, this.LOAD_RADIUS, this.UNLOAD_RADIUS);
    for (const key of unloadedKeys) {
      this.disposeChunkMesh(key);
    }

    const targetBeforeInteraction = this.player.getTargetedBlock();
    this.handleInteractions(targetBeforeInteraction, interactionFrame.primaryAction, interactionFrame.secondaryAction);

    const meshKeys = Array.from(this.world.needsMesh).sort((a, b) => this.compareChunkDistance(a, b, center.cx, center.cz));
    for (const key of meshKeys.slice(0, this.MAX_MESH_UPDATES_PER_FRAME)) {
      this.rebuildChunkMesh(key);
      this.world.needsMesh.delete(key);
    }

    const target = this.player.getTargetedBlock();
    this.updateHud(target);
    this.updateDebugState(target);
  }

  private handleInteractions(target: VoxelTarget | null, primaryAction: boolean, secondaryAction: boolean): void {
    if (!this.input.isPointerLocked || !this.player.isSpawned || !target) return;

    if (primaryAction) {
      this.world.setBlock(target.block.wx, target.block.wy, target.block.wz, BlockIds.AIR);
    }

    if (!secondaryAction) return;

    const blockId = this.placeableBlockIds[this.selectedBlockIndex];
    if (blockId === undefined) return;

    const occupant = this.world.getLoadedBlock(target.adjacent.wx, target.adjacent.wy, target.adjacent.wz);
    if (occupant === null || occupant !== BlockIds.AIR) return;
    if (this.player.intersectsBlock(target.adjacent.wx, target.adjacent.wy, target.adjacent.wz)) return;

    this.world.setBlock(target.adjacent.wx, target.adjacent.wy, target.adjacent.wz, blockId);
  }

  private rebuildChunkMesh(key: string): void {
    const [cx, cz] = this.parseChunkKey(key);
    const chunk = this.world.getChunk(cx, cz);
    if (!chunk) return;

    const neighbours = {
      px: this.world.getChunk(cx + 1, cz),
      nx: this.world.getChunk(cx - 1, cz),
      pz: this.world.getChunk(cx, cz + 1),
      nz: this.world.getChunk(cx, cz - 1),
    };

    const buffers = buildChunkMesh(chunk, this.atlas.layout, neighbours);
    this.disposeChunkMesh(key);

    const group = new THREE.Group();
    group.name = `chunk-${key}`;

    const opaqueMesh = this.createMeshFromBuffers(buffers.opaque, this.materials.opaque, 0);
    if (opaqueMesh) {
      group.add(opaqueMesh);
    }

    const waterMesh = this.createMeshFromBuffers(buffers.water, this.materials.water, 1);
    if (waterMesh) {
      waterMesh.renderOrder = 1;
      group.add(waterMesh);
    }

    if (group.children.length === 0) {
      return;
    }

    this.renderer.scene.add(group);
    this.chunkMeshes.set(key, group);
  }

  private createMeshFromBuffers(
    buffers: MeshBuffers,
    material: THREE.Material,
    renderOrder: number
  ): THREE.Mesh | null {
    if (buffers.vertexCount === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder;
    return mesh;
  }

  private compareChunkDistance(a: string, b: string, cx: number, cz: number): number {
    const [ax, az] = this.parseChunkKey(a);
    const [bx, bz] = this.parseChunkKey(b);
    return (ax - cx) ** 2 + (az - cz) ** 2 - ((bx - cx) ** 2 + (bz - cz) ** 2);
  }

  private parseChunkKey(key: string): [number, number] {
    const [cxStr = '0', czStr = '0'] = key.split(',');
    return [Number.parseInt(cxStr, 10), Number.parseInt(czStr, 10)];
  }

  private disposeChunkMesh(key: string): void {
    const group = this.chunkMeshes.get(key);
    if (!group) return;

    this.renderer.scene.remove(group);
    for (const child of group.children) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    this.chunkMeshes.delete(key);
  }

  private createHud(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'radial-gradient(circle at center, rgba(15, 23, 38, 0.16), rgba(15, 23, 38, 0.76))';
    overlay.style.color = '#f4f1de';
    overlay.style.fontFamily = 'Georgia, serif';
    overlay.style.letterSpacing = '0.08em';
    overlay.style.textTransform = 'uppercase';
    overlay.style.textAlign = 'center';
    overlay.style.padding = '24px';
    overlay.style.zIndex = '10';
    overlay.style.cursor = 'pointer';
    overlay.addEventListener('click', () => this.input.requestPointerLock());
    document.body.appendChild(overlay);
    return overlay;
  }

  private createCrosshair(): HTMLDivElement {
    const crosshair = document.createElement('div');
    crosshair.style.position = 'fixed';
    crosshair.style.left = '50%';
    crosshair.style.top = '50%';
    crosshair.style.width = '18px';
    crosshair.style.height = '18px';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '11';
    crosshair.style.opacity = '0.95';
    crosshair.style.background = 'linear-gradient(#f4f1de 0 0) center/2px 18px no-repeat, linear-gradient(#f4f1de 0 0) center/18px 2px no-repeat';
    document.body.appendChild(crosshair);
    return crosshair;
  }

  private createStatusBar(): HTMLDivElement {
    const status = document.createElement('div');
    status.style.position = 'fixed';
    status.style.left = '50%';
    status.style.bottom = '96px';
    status.style.transform = 'translateX(-50%)';
    status.style.padding = '10px 14px';
    status.style.border = '1px solid rgba(244, 241, 222, 0.28)';
    status.style.background = 'rgba(15, 23, 38, 0.52)';
    status.style.backdropFilter = 'blur(4px)';
    status.style.color = '#f4f1de';
    status.style.fontFamily = 'Georgia, serif';
    status.style.fontSize = '12px';
    status.style.letterSpacing = '0.06em';
    status.style.textTransform = 'uppercase';
    status.style.pointerEvents = 'none';
    status.style.zIndex = '11';
    document.body.appendChild(status);
    return status;
  }

  private createHotbar(): HTMLDivElement {
    const hotbar = document.createElement('div');
    hotbar.style.position = 'fixed';
    hotbar.style.left = '50%';
    hotbar.style.bottom = '28px';
    hotbar.style.transform = 'translateX(-50%)';
    hotbar.style.display = 'flex';
    hotbar.style.gap = '8px';
    hotbar.style.zIndex = '11';
    hotbar.style.pointerEvents = 'none';
    document.body.appendChild(hotbar);
    return hotbar;
  }

  private updateHud(target: VoxelTarget | null): void {
    if (this.input.isPointerLocked) {
      this.hud.style.display = 'none';
    } else {
      this.hud.style.display = 'flex';
      this.hud.textContent = this.player.isSpawned
        ? 'Click to play - WASD move, Space jump, left break, right place, number keys select block'
        : 'Generating world... click when terrain settles';
    }

    const uiVisible = this.player.isSpawned;
    this.crosshair.style.display = uiVisible ? 'block' : 'none';
    this.statusBar.style.display = uiVisible ? 'block' : 'none';
    this.hotbar.style.display = uiVisible ? 'flex' : 'none';

    this.crosshair.style.background = target
      ? 'linear-gradient(#ffd27d 0 0) center/2px 18px no-repeat, linear-gradient(#ffd27d 0 0) center/18px 2px no-repeat'
      : 'linear-gradient(#f4f1de 0 0) center/2px 18px no-repeat, linear-gradient(#f4f1de 0 0) center/18px 2px no-repeat';

    const selectedBlock = getBlockDef(this.placeableBlockIds[this.selectedBlockIndex] ?? BlockIds.DIRT);
    this.statusBar.textContent = target
      ? `Target ${getBlockDef(target.blockId).name} @ ${target.block.wx}, ${target.block.wy}, ${target.block.wz} | Selected ${selectedBlock.name} | ${this.smoothedFps.toFixed(0)} FPS | ${this.chunkMeshes.size} chunks`
      : `No target | Selected ${selectedBlock.name} | ${this.smoothedFps.toFixed(0)} FPS | ${this.chunkMeshes.size} chunks`;

    this.hotbar.replaceChildren(...this.placeableBlockIds.map((blockId, index) => this.createHotbarItem(blockId, index)));
  }

  private createHotbarItem(blockId: number, index: number): HTMLDivElement {
    const item = document.createElement('div');
    const selected = index === this.selectedBlockIndex;
    item.textContent = `${index + 1} ${getBlockDef(blockId).name}`;
    item.style.padding = '9px 12px';
    item.style.minWidth = '78px';
    item.style.textAlign = 'center';
    item.style.border = selected ? '1px solid #ffd27d' : '1px solid rgba(244, 241, 222, 0.18)';
    item.style.background = selected ? 'rgba(99, 70, 24, 0.72)' : 'rgba(15, 23, 38, 0.48)';
    item.style.color = '#f4f1de';
    item.style.fontFamily = 'Georgia, serif';
    item.style.fontSize = '12px';
    item.style.letterSpacing = '0.04em';
    item.style.textTransform = 'uppercase';
    item.style.boxShadow = selected ? '0 0 18px rgba(255, 210, 125, 0.18)' : 'none';
    return item;
  }

  private updateDebugState(target: VoxelTarget | null): void {
    const debugWindow = window as Window & { __tseburekDebug?: Record<string, unknown> };
    debugWindow.__tseburekDebug = {
      fps: Number(this.smoothedFps.toFixed(1)),
      loadRadius: this.LOAD_RADIUS,
      loadedChunks: this.chunkMeshes.size,
      selectedBlock: getBlockDef(this.placeableBlockIds[this.selectedBlockIndex] ?? BlockIds.DIRT).name,
      targetBlock: target ? getBlockDef(target.blockId).name : null,
      targetPosition: target ? `${target.block.wx},${target.block.wy},${target.block.wz}` : null,
      drawCalls: this.renderer.webgl.info.render.calls,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    for (const key of this.chunkMeshes.keys()) {
      this.disposeChunkMesh(key);
    }
    this.world.dispose();
    this.input.dispose();
    this.hud.remove();
    this.crosshair.remove();
    this.statusBar.remove();
    this.hotbar.remove();
    this.atlas.texture.dispose();
    this.materials.opaque.dispose();
    this.materials.water.dispose();
    this.renderer.dispose();
    this.stats.dom.remove();
  }
}
