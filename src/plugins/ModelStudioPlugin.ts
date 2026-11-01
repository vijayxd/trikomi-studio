/**
 * @module ModelStudioPlugin
 * Trikomi Studio Plugin for Garment Mesh inspection, isolation, decimation, and hierarchy.
 */

import * as THREE from 'three';
import { TrikomiStudioPlugin, type ITrikomiViewer } from './TrikomiPluginBase';

export interface GarmentPieceInfo {
  uuid: string;
  name: string;
  vertexCount: number;
  triangleCount: number;
  visible: boolean;
  materialName: string;
}

export class ModelStudioPlugin extends TrikomiStudioPlugin {
  public readonly id = 'model_studio';

  private activeModelRoot: THREE.Object3D | null = null;
  private pieces: GarmentPieceInfo[] = [];

  public setActiveModel(root: THREE.Object3D): void {
    this.activeModelRoot = root;
    this.scanPieces();
  }

  public getPieces(): GarmentPieceInfo[] {
    return this.pieces;
  }

  public scanPieces(): GarmentPieceInfo[] {
    this.pieces = [];
    if (!this.activeModelRoot) return this.pieces;

    this.activeModelRoot.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const geom = mesh.geometry;
        const vertCount = geom.attributes.position ? geom.attributes.position.count : 0;
        const triCount = geom.index ? geom.index.count / 3 : vertCount / 3;

        const matName = Array.isArray(mesh.material)
          ? mesh.material.map(m => m.name || 'unnamed').join(', ')
          : (mesh.material?.name || 'unnamed');

        this.pieces.push({
          uuid: mesh.uuid,
          name: mesh.name || `Piece_${this.pieces.length + 1}`,
          vertexCount: vertCount,
          triangleCount: Math.round(triCount),
          visible: mesh.visible,
          materialName: matName
        });
      }
    });

    return this.pieces;
  }

  public togglePieceVisibility(uuid: string): void {
    if (!this.activeModelRoot) return;
    this.activeModelRoot.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh && node.uuid === uuid) {
        node.visible = !node.visible;
      }
    });
    this.scanPieces();
  }

  public setGhosting(uuid: string, ghost: boolean): void {
    if (!this.activeModelRoot) return;
    this.activeModelRoot.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh && node.uuid === uuid) {
        const mesh = node as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(m => {
          if (m) {
            m.transparent = ghost;
            m.opacity = ghost ? 0.35 : 1.0;
            m.needsUpdate = true;
          }
        });
      }
    });
  }

  override onDetach(): void {
    this.activeModelRoot = null;
    this.pieces = [];
    super.onDetach();
  }
}
