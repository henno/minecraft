import * as THREE from 'three';
import { World } from '../world/World';
import { isSolid } from '../world/BlockRegistry';

export class PlayerPhysics {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly halfWidth = 0.3;
  readonly height = 1.8;
  readonly eyeHeight = 1.62;
  readonly walkSpeed = 5.8;
  readonly gravity = 24;
  readonly jumpSpeed = 8.5;
  grounded = false;

  private readonly world: World;

  constructor(world: World) {
    this.world = world;
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  step(desiredVelocity: THREE.Vector3, jumpPressed: boolean, dt: number): void {
    this.velocity.x = desiredVelocity.x;
    this.velocity.z = desiredVelocity.z;

    if (jumpPressed && this.grounded) {
      this.velocity.y = this.jumpSpeed;
      this.grounded = false;
    }

    this.velocity.y = Math.max(this.velocity.y - this.gravity * dt, -30);

    this.moveAxis('x', this.velocity.x * dt);
    this.grounded = false;
    this.moveAxis('y', this.velocity.y * dt);
    this.moveAxis('z', this.velocity.z * dt);
  }

  private moveAxis(axis: 'x' | 'y' | 'z', delta: number): void {
    if (delta === 0) return;

    this.position[axis] += delta;
    const box = this.getAabb();

    for (let bx = Math.floor(box.min.x); bx <= Math.floor(box.max.x - 1e-6); bx++) {
      for (let by = Math.floor(box.min.y); by <= Math.floor(box.max.y - 1e-6); by++) {
        for (let bz = Math.floor(box.min.z); bz <= Math.floor(box.max.z - 1e-6); bz++) {
          if (!isSolid(this.world.getBlock(bx, by, bz))) continue;

          if (axis === 'x') {
            this.position.x = delta > 0 ? Math.min(this.position.x, bx - this.halfWidth) : Math.max(this.position.x, bx + 1 + this.halfWidth);
            this.velocity.x = 0;
          }

          if (axis === 'y') {
            if (delta > 0) {
              this.position.y = Math.min(this.position.y, by - this.height);
            } else {
              this.position.y = Math.max(this.position.y, by + 1);
              this.grounded = true;
            }
            this.velocity.y = 0;
          }

          if (axis === 'z') {
            this.position.z = delta > 0 ? Math.min(this.position.z, bz - this.halfWidth) : Math.max(this.position.z, bz + 1 + this.halfWidth);
            this.velocity.z = 0;
          }
        }
      }
    }
  }

  private getAabb(): { min: THREE.Vector3; max: THREE.Vector3 } {
    return {
      min: new THREE.Vector3(
        this.position.x - this.halfWidth,
        this.position.y,
        this.position.z - this.halfWidth
      ),
      max: new THREE.Vector3(
        this.position.x + this.halfWidth,
        this.position.y + this.height,
        this.position.z + this.halfWidth
      ),
    };
  }
}
