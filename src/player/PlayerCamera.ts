import * as THREE from 'three';

export class PlayerCamera {
  readonly sensitivity = 0.0025;
  readonly maxPitch = Math.PI / 2 - 0.05;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly forward = new THREE.Vector3();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private yaw = 0;
  private pitch = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.syncFromCameraOrientation();
  }

  get yawRadians(): number {
    return this.yaw;
  }

  setPosition(position: THREE.Vector3): void {
    this.camera.position.copy(position);
  }

  applyLook(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.sensitivity;
    this.pitch -= deltaY * this.sensitivity;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getForwardPlanar(target = new THREE.Vector3()): THREE.Vector3 {
    this.camera.getWorldDirection(this.forward);
    target.copy(this.forward);
    target.y = 0;
    if (target.lengthSq() === 0) {
      target.set(0, 0, -1);
    }
    return target.normalize();
  }

  getRightPlanar(target = new THREE.Vector3()): THREE.Vector3 {
    this.getForwardPlanar(target);
    target.crossVectors(target, THREE.Object3D.DEFAULT_UP);
    return target.normalize();
  }

  getWorldDirection(target = new THREE.Vector3()): THREE.Vector3 {
    return this.camera.getWorldDirection(target);
  }

  private syncFromCameraOrientation(): void {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this.euler.y;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.euler.x));
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
