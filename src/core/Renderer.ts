import * as THREE from 'three';

/**
 * Renderer — wraps THREE.WebGLRenderer with resize handling and scene management.
 *
 * Uses WebGLRenderer (NOT WebGPURenderer — Safari compatibility required).
 * Antialias enabled for cleaner block edges in the MVP.
 *
 * The renderer owns the canvas. Call renderer.domElement to get the canvas element.
 */
export class Renderer {
  readonly webgl: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private readonly resizeHandler: () => void;
  private clearColor = new THREE.Color(0x8fc3df);

  constructor() {
    this.webgl = new THREE.WebGLRenderer({ antialias: true });
    this.webgl.setSize(window.innerWidth, window.innerHeight);
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.setClearColor(this.clearColor);

    // Append canvas to body
    document.body.appendChild(this.webgl.domElement);

    // Camera: positioned above and at an angle to see terrain
    // FoV=75, near=0.1 (avoid clip jitter — never go below 0.1), far=1000
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 256);
    this.camera.position.set(40, 80, 100);
    this.camera.lookAt(40, 0, 40); // Look at center of 5×5 chunk grid

    // Scene with ambient + directional light for basic visibility
    this.scene = new THREE.Scene();

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(100, 200, 100);
    this.scene.add(sun);

    // Handle window resize
    this.resizeHandler = this.onResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);
  }

  configureFog(farDistance: number): void {
    const nearDistance = farDistance * 0.6;
    this.camera.far = farDistance + 24;
    this.camera.updateProjectionMatrix();
    this.scene.fog = new THREE.Fog(this.clearColor.getHex(), nearDistance, farDistance);
    this.webgl.setClearColor(this.clearColor);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(window.innerWidth, window.innerHeight);
  }

  /** Render one frame. */
  render(): void {
    this.webgl.render(this.scene, this.camera);
  }

  /** Dispose of renderer and remove canvas. Call on cleanup. */
  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.webgl.dispose();
    this.webgl.domElement.remove();
  }
}
