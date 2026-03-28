import * as THREE from 'three';
import { BlockIds, CHUNK_HEIGHT, VoxelTarget } from '../types';
import { worldToChunk } from '../utils/coords';
import { InputManager } from '../input/InputManager';
import { World } from '../world/World';
import { PlayerCamera } from './PlayerCamera';
import { PlayerPhysics } from './PlayerPhysics';

export class Player {
  private readonly input: InputManager;
  private readonly cameraController: PlayerCamera;
  private readonly physics: PlayerPhysics;
  private readonly world: World;
  private readonly desiredVelocity = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3(8, 72, 8);
  private readonly lookDirection = new THREE.Vector3();
  private spawned = false;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager, world: World) {
    this.input = input;
    this.world = world;
    this.cameraController = new PlayerCamera(camera);
    this.physics = new PlayerPhysics(world);
    this.cameraController.setPosition(this.cameraPosition);
  }

  get position(): THREE.Vector3 {
    return this.physics.position;
  }

  get currentChunk(): { cx: number; cz: number } {
    return worldToChunk(this.position.x, this.position.z);
  }

  get isSpawned(): boolean {
    return this.spawned;
  }

  get halfWidth(): number {
    return this.physics.halfWidth;
  }

  get height(): number {
    return this.physics.height;
  }

  update(dt: number): void {
    const frame = this.input.consumeFrame();

    if (frame.pointerLocked) {
      this.cameraController.applyLook(frame.lookDeltaX, frame.lookDeltaY);
    }

    if (!this.spawned) {
      const spawn = this.world.findSpawnPositionNear(0, 0, 12, this.physics.halfWidth, this.physics.height);
      if (!spawn) {
        this.cameraController.setPosition(this.cameraPosition);
        return;
      }

      this.physics.setPosition(spawn.x, spawn.y, spawn.z);
      this.spawned = true;
    }

    this.desiredVelocity.set(0, 0, 0);

    if (frame.pointerLocked) {
      this.cameraController.getForwardPlanar(this.forward);
      this.cameraController.getRightPlanar(this.right);

      this.desiredVelocity.addScaledVector(this.right, frame.moveX);
      this.desiredVelocity.addScaledVector(this.forward, frame.moveZ);

      if (this.desiredVelocity.lengthSq() > 1) {
        this.desiredVelocity.normalize();
      }

      this.desiredVelocity.multiplyScalar(this.physics.walkSpeed);
    }

    this.physics.step(this.desiredVelocity, frame.pointerLocked && frame.jumpPressed, dt);
    this.cameraPosition.copy(this.physics.position);
    this.cameraPosition.y += this.physics.eyeHeight;
    this.cameraController.setPosition(this.cameraPosition);
  }

  getTargetedBlock(maxDistance = 5.75): VoxelTarget | null {
    if (!this.spawned) return null;

    const origin = this.cameraPosition;
    const direction = this.cameraController.getWorldDirection(this.lookDirection).normalize();

    let wx = Math.floor(origin.x);
    let wy = Math.floor(origin.y);
    let wz = Math.floor(origin.z);

    let previous = { wx, wy, wz };
    let normal = { x: 0, y: 0, z: 0 };

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDeltaX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.x);
    const tDeltaY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.y);
    const tDeltaZ = stepZ === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.z);

    let tMaxX = this.initialRayBoundary(origin.x, direction.x, wx);
    let tMaxY = this.initialRayBoundary(origin.y, direction.y, wy);
    let tMaxZ = this.initialRayBoundary(origin.z, direction.z, wz);

    for (;;) {
      const blockId = this.world.getLoadedBlock(wx, wy, wz);
      if (blockId === null) return null;

      if (blockId !== BlockIds.AIR && blockId !== BlockIds.WATER) {
        return {
          block: { wx, wy, wz },
          adjacent: previous,
          normal,
          blockId,
          distance: Math.min(tMaxX, tMaxY, tMaxZ),
        };
      }

      previous = { wx, wy, wz };

      if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
        if (tMaxX > maxDistance) return null;
        wx += stepX;
        normal = { x: -stepX, y: 0, z: 0 };
        tMaxX += tDeltaX;
      } else if (tMaxY <= tMaxZ) {
        if (tMaxY > maxDistance) return null;
        wy += stepY;
        if (wy < 0 || wy >= CHUNK_HEIGHT) return null;
        normal = { x: 0, y: -stepY, z: 0 };
        tMaxY += tDeltaY;
      } else {
        if (tMaxZ > maxDistance) return null;
        wz += stepZ;
        normal = { x: 0, y: 0, z: -stepZ };
        tMaxZ += tDeltaZ;
      }
    }
  }

  intersectsBlock(wx: number, wy: number, wz: number): boolean {
    const minX = this.position.x - this.physics.halfWidth;
    const maxX = this.position.x + this.physics.halfWidth;
    const minY = this.position.y;
    const maxY = this.position.y + this.physics.height;
    const minZ = this.position.z - this.physics.halfWidth;
    const maxZ = this.position.z + this.physics.halfWidth;

    return wx < maxX && wx + 1 > minX && wy < maxY && wy + 1 > minY && wz < maxZ && wz + 1 > minZ;
  }

  private initialRayBoundary(position: number, direction: number, cell: number): number {
    if (direction > 0) {
      return (cell + 1 - position) / direction;
    }

    if (direction < 0) {
      return (position - cell) / -direction;
    }

    return Number.POSITIVE_INFINITY;
  }
}
