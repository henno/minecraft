import * as THREE from 'three';
import type { TextureAtlas } from './TextureAtlas';

export interface ChunkMaterials {
  opaque: THREE.MeshBasicMaterial;
  water: THREE.MeshBasicMaterial;
}

export function createChunkMaterials(atlas: TextureAtlas): ChunkMaterials {
  const opaque = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    color: 0xffffff,
    vertexColors: true,
    side: THREE.FrontSide,
    transparent: false,
    toneMapped: false,
  });

  const water = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    color: 0xa8e2ff,
    vertexColors: true,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    toneMapped: false,
  });

  return { opaque, water };
}
