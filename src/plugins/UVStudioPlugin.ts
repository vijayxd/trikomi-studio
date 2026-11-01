/**
 * @module UVStudioPlugin
 * Trikomi Studio Plugin for UV island detection, canonical slot assignments,
 * litmus test projection, and isotropic packing.
 */

import * as THREE from 'three';
import { TrikomiStudioPlugin, type ITrikomiViewer } from './TrikomiPluginBase';

export interface UVIslandInfo {
  id: string;
  pieceName: string;
  meshUuid: string;
  bounds: { minU: number; maxU: number; minV: number; maxV: number };
  center: { u: number; v: number };
  area: number;
}

export class UVStudioPlugin extends TrikomiStudioPlugin {
  public readonly id = 'uv_studio';

  private islands: UVIslandInfo[] = [];
  private activeLitmusTexture: THREE.Texture | null = null;
  private litmusModeEnabled: boolean = false;

  public getIslands(): UVIslandInfo[] {
    return this.islands;
  }

  public setLitmusTexture(texture: THREE.Texture | null): void {
    this.activeLitmusTexture = texture;
  }

  public toggleLitmusMode(enabled: boolean): void {
    this.litmusModeEnabled = enabled;
    if (!this.viewer || !this.viewer.scene || !this.activeLitmusTexture) return;

    this.viewer.scene.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            if ('map' in mat) {
              (mat as THREE.MeshStandardMaterial).map = enabled ? this.activeLitmusTexture : null;
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
  }

  public isLitmusMode(): boolean {
    return this.litmusModeEnabled;
  }

  override onDetach(): void {
    this.islands = [];
    this.activeLitmusTexture = null;
    super.onDetach();
  }
}
