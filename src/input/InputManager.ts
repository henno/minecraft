export interface InputFrame {
  readonly moveX: number;
  readonly moveZ: number;
  readonly lookDeltaX: number;
  readonly lookDeltaY: number;
  readonly jumpPressed: boolean;
  readonly pointerLocked: boolean;
}

export interface InteractionFrame {
  readonly primaryAction: boolean;
  readonly secondaryAction: boolean;
  readonly selectedSlot: number | null;
}

export class InputManager {
  private readonly pressedKeys = new Set<string>();
  private readonly canvas: HTMLCanvasElement;
  private pointerLocked = false;
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private jumpQueued = false;
  private primaryQueued = false;
  private secondaryQueued = false;
  private selectedSlotQueued: number | null = null;

  private readonly keyDownHandler = (event: KeyboardEvent): void => {
    const code = event.code;
    if (MOVEMENT_KEYS.has(code) || code === 'Space') {
      event.preventDefault();
    }

    if (!event.repeat && code === 'Space') {
      this.jumpQueued = true;
    }

    if (!event.repeat && code.startsWith('Digit')) {
      const slot = Number.parseInt(code.slice(5), 10);
      if (slot >= 1 && slot <= 9) {
        this.selectedSlotQueued = slot - 1;
      }
    }

    this.pressedKeys.add(code);
  };

  private readonly keyUpHandler = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly mouseMoveHandler = (event: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.lookDeltaX += event.movementX;
    this.lookDeltaY += event.movementY;
  };

  private readonly pointerLockHandler = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private readonly mouseDownHandler = (event: MouseEvent): void => {
    if (!this.pointerLocked) return;

    if (event.button === 0) {
      this.primaryQueued = true;
      event.preventDefault();
    }

    if (event.button === 2) {
      this.secondaryQueued = true;
      event.preventDefault();
    }
  };

  private readonly contextMenuHandler = (event: MouseEvent): void => {
    event.preventDefault();
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    window.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('pointerlockchange', this.pointerLockHandler);
    this.canvas.addEventListener('mousedown', this.mouseDownHandler);
    this.canvas.addEventListener('contextmenu', this.contextMenuHandler);
  }

  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  requestPointerLock(): void {
    if (!this.pointerLocked) {
      this.canvas.requestPointerLock();
    }
  }

  consumeFrame(): InputFrame {
    const frame: InputFrame = {
      moveX: (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0),
      moveZ: (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0),
      lookDeltaX: this.lookDeltaX,
      lookDeltaY: this.lookDeltaY,
      jumpPressed: this.jumpQueued,
      pointerLocked: this.pointerLocked,
    };

    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.jumpQueued = false;

    return frame;
  }

  consumeInteractions(): InteractionFrame {
    const frame: InteractionFrame = {
      primaryAction: this.primaryQueued,
      secondaryAction: this.secondaryQueued,
      selectedSlot: this.selectedSlotQueued,
    };

    this.primaryQueued = false;
    this.secondaryQueued = false;
    this.selectedSlotQueued = null;

    return frame;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('pointerlockchange', this.pointerLockHandler);
    this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
    this.canvas.removeEventListener('contextmenu', this.contextMenuHandler);
  }

  private isDown(code: string): boolean {
    return this.pressedKeys.has(code);
  }
}

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
