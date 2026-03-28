import * as THREE from 'three';

export type AtlasTileId = 'grass-top' | 'grass-side' | 'dirt' | 'stone' | 'sand' | 'water' | 'wood-top' | 'wood-side' | 'leaves';

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface TextureAtlasLayout {
  readonly tileSize: number;
  readonly padding: number;
  readonly rects: Record<AtlasTileId, UvRect>;
}

export interface TextureAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly layout: TextureAtlasLayout;
}

const TILE_SIZE = 16;
const PADDING = 2;
const TILE_ORDER: readonly AtlasTileId[] = [
  'grass-top',
  'grass-side',
  'dirt',
  'stone',
  'sand',
  'water',
  'wood-top',
  'wood-side',
  'leaves',
];
const COLUMNS = 3;

type TilePainter = (ctx: CanvasRenderingContext2D) => void;

export function createTextureAtlas(): TextureAtlas {
  const rows = Math.ceil(TILE_ORDER.length / COLUMNS);
  const atlasWidth = COLUMNS * (TILE_SIZE + PADDING * 2);
  const atlasHeight = rows * (TILE_SIZE + PADDING * 2);
  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create texture atlas context');
  }

  ctx.imageSmoothingEnabled = false;

  const rects = {} as Record<AtlasTileId, UvRect>;

  TILE_ORDER.forEach((tile, index) => {
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const cellX = col * (TILE_SIZE + PADDING * 2);
    const cellY = row * (TILE_SIZE + PADDING * 2);
    const drawX = cellX + PADDING;
    const drawY = cellY + PADDING;

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = TILE_SIZE;
    tileCanvas.height = TILE_SIZE;
    const tileCtx = tileCanvas.getContext('2d');

    if (!tileCtx) {
      throw new Error(`Failed to paint atlas tile ${tile}`);
    }

    tileCtx.imageSmoothingEnabled = false;
    TILE_PAINTERS[tile](tileCtx);

    ctx.drawImage(tileCanvas, drawX, drawY);
    bleedTile(ctx, tileCanvas, drawX, drawY);

    rects[tile] = {
      u0: drawX / atlasWidth,
      v0: 1 - (drawY + TILE_SIZE) / atlasHeight,
      u1: (drawX + TILE_SIZE) / atlasWidth,
      v1: 1 - drawY / atlasHeight,
    };
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    layout: {
      tileSize: TILE_SIZE,
      padding: PADDING,
      rects,
    },
  };
}

function bleedTile(
  ctx: CanvasRenderingContext2D,
  tileCanvas: HTMLCanvasElement,
  drawX: number,
  drawY: number
): void {
  ctx.drawImage(tileCanvas, 0, 0, TILE_SIZE, 1, drawX, drawY - 1, TILE_SIZE, 1);
  ctx.drawImage(tileCanvas, 0, TILE_SIZE - 1, TILE_SIZE, 1, drawX, drawY + TILE_SIZE, TILE_SIZE, 1);
  ctx.drawImage(tileCanvas, 0, 0, 1, TILE_SIZE, drawX - 1, drawY, 1, TILE_SIZE);
  ctx.drawImage(tileCanvas, TILE_SIZE - 1, 0, 1, TILE_SIZE, drawX + TILE_SIZE, drawY, 1, TILE_SIZE);

  ctx.drawImage(tileCanvas, 0, 0, 1, 1, drawX - 1, drawY - 1, 1, 1);
  ctx.drawImage(tileCanvas, TILE_SIZE - 1, 0, 1, 1, drawX + TILE_SIZE, drawY - 1, 1, 1);
  ctx.drawImage(tileCanvas, 0, TILE_SIZE - 1, 1, 1, drawX - 1, drawY + TILE_SIZE, 1, 1);
  ctx.drawImage(tileCanvas, TILE_SIZE - 1, TILE_SIZE - 1, 1, 1, drawX + TILE_SIZE, drawY + TILE_SIZE, 1, 1);
}

function fill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const TILE_PAINTERS: Record<AtlasTileId, TilePainter> = {
  'grass-top': (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#4a8c2f');
    fill(ctx, 0, 0, 16, 4, '#76b24a');
    fill(ctx, 2, 2, 3, 2, '#8dcb59');
    fill(ctx, 8, 1, 4, 3, '#8dcb59');
    fill(ctx, 5, 6, 2, 2, '#3e7128');
    fill(ctx, 11, 8, 3, 2, '#2f5f1d');
    fill(ctx, 2, 11, 4, 2, '#5e9c3e');
  },
  'grass-side': (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#7b5a34');
    fill(ctx, 0, 0, 16, 4, '#5ea238');
    fill(ctx, 0, 4, 16, 2, '#8ac45a');
    fill(ctx, 2, 7, 3, 2, '#8d6a40');
    fill(ctx, 7, 9, 4, 3, '#6b4c2a');
    fill(ctx, 12, 6, 2, 6, '#8e6840');
    fill(ctx, 4, 12, 6, 2, '#5f4326');
  },
  dirt: (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#7b5a34');
    fill(ctx, 2, 2, 2, 2, '#946a40');
    fill(ctx, 6, 4, 3, 2, '#6a4b2a');
    fill(ctx, 11, 3, 2, 3, '#8b653d');
    fill(ctx, 3, 9, 4, 2, '#644726');
    fill(ctx, 9, 10, 3, 3, '#946b43');
    fill(ctx, 13, 12, 2, 2, '#5c4124');
  },
  stone: (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#7a7f86');
    fill(ctx, 1, 2, 3, 2, '#979ca2');
    fill(ctx, 5, 4, 4, 3, '#656b72');
    fill(ctx, 11, 2, 3, 4, '#8b9097');
    fill(ctx, 3, 10, 2, 3, '#5e6369');
    fill(ctx, 8, 9, 5, 2, '#949aa0');
    fill(ctx, 12, 12, 2, 2, '#64696f');
  },
  sand: (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#d7c07a');
    fill(ctx, 1, 2, 3, 2, '#eddc98');
    fill(ctx, 7, 3, 4, 3, '#c3ae67');
    fill(ctx, 12, 5, 2, 2, '#efe0a0');
    fill(ctx, 3, 9, 5, 2, '#bba35f');
    fill(ctx, 10, 11, 3, 2, '#e7d58d');
    fill(ctx, 13, 13, 2, 1, '#c5ae68');
  },
  water: (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#2d78c8');
    fill(ctx, 0, 3, 16, 2, '#4da4f4');
    fill(ctx, 2, 8, 5, 2, '#1f5fa8');
    fill(ctx, 9, 10, 4, 2, '#69bfff');
    fill(ctx, 12, 5, 2, 2, '#92d8ff');
  },
  'wood-top': (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#9c6e3d');
    fill(ctx, 2, 2, 12, 12, '#c08a4d');
    fill(ctx, 4, 4, 8, 8, '#7f562a');
    fill(ctx, 6, 6, 4, 4, '#d9a662');
    fill(ctx, 1, 7, 2, 2, '#704922');
    fill(ctx, 13, 7, 2, 2, '#704922');
  },
  'wood-side': (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#8b5f34');
    fill(ctx, 2, 0, 2, 16, '#a8743f');
    fill(ctx, 7, 0, 2, 16, '#6e471f');
    fill(ctx, 12, 0, 2, 16, '#b98448');
    fill(ctx, 4, 3, 2, 3, '#9e6d3b');
    fill(ctx, 9, 8, 2, 4, '#6b421d');
  },
  leaves: (ctx) => {
    fill(ctx, 0, 0, 16, 16, '#3f7f3c');
    fill(ctx, 1, 1, 4, 4, '#68a65b');
    fill(ctx, 7, 2, 5, 3, '#8cc671');
    fill(ctx, 11, 7, 4, 4, '#2e612d');
    fill(ctx, 3, 9, 5, 4, '#5c984c');
    fill(ctx, 8, 12, 3, 2, '#89cf7a');
  },
};
