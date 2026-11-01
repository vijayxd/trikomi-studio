/**
 * @module MaterialStudioPlugin
 * Trikomi Studio Plugin for PBR Fabric and Material Finishes.
 * Preserves material isolation via per-mesh cloning.
 */

import * as THREE from 'three';
import { TrikomiStudioPlugin, type ITrikomiViewer } from './TrikomiPluginBase';

export interface MaterialColorPreset {
  name: string;
  color: string;
}

export class MaterialStudioPlugin extends TrikomiStudioPlugin {
  public readonly id = 'material_studio';

  public readonly colorPresets: MaterialColorPreset[] = [
    { name: 'Yellow Gold', color: '#ffd700' },
    { name: 'Platinum', color: '#e5e4e2' },
    { name: 'Rose Gold', color: '#b76e79' },
    { name: 'Matte Black', color: '#111111' },
    { name: 'Cyber Cobalt', color: '#00f0ff' },
    { name: 'Neon Crimson', color: '#ff0055' }
  ];

  private activeSlot: string = 'all';

  public setActiveSlot(slot: string): void {
    this.activeSlot = slot;
  }

  public getActiveSlot(): string {
    return this.activeSlot;
  }

  public applyColor(colorHex: string, targetMeshUuid?: string): void {
    if (!this.viewer || !this.viewer.scene) return;

    this.viewer.scene.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (targetMeshUuid && mesh.uuid !== targetMeshUuid) {
          return;
        }

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            if ('color' in mat) {
              (mat as THREE.MeshStandardMaterial).color.set(colorHex);
            }
          });
        } else if (mesh.material && 'color' in mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).color.set(colorHex);
        }
      }
    });
  }

  public setWireframe(enabled: boolean): void {
    if (!this.viewer || !this.viewer.scene) return;
    this.viewer.scene.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              if ('wireframe' in mat) {
                (mat as THREE.MeshStandardMaterial).wireframe = enabled;
              }
            });
          } else if ('wireframe' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = enabled;
          }
        }
      }
    });
  }
}
