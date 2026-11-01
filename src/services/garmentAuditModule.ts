/**
 * garmentAuditModule.ts
 * Self-contained module for:
 *  1. Piece-by-piece high-contrast Color ID assignment (1:1 sync between 3D Mesh and 2D UV).
 *  2. Multi-angle 3D camera positioning (Front, Back, Isometric).
 *  3. Seamless WebGL snapshot captures for fast visual auditing and manual adjustment.
 */
import * as THREE from "three";
import { modelStore } from "../store/modelStore";
import { uvOrganizerStore } from "../store/uvOrganizerStore";

// 24 vibrant, distinct high-contrast colors (distinguishable at a glance)
export const AUDIT_PIECE_PALETTE = [
  "#38bdf8", // Sky Blue
  "#f43f5e", // Rose / Coral
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#6366f1", // Indigo
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#e11d48", // Crimson
  "#8b5cf6", // Violet
  "#22c55e", // Bright Green
  "#eab308", // Yellow
  "#d946ef", // Fuchsia
  "#0ea5e9", // Ocean
  "#fb7185", // Light Coral
  "#34d399", // Mint
  "#fbbf24", // Gold
  "#c084fc", // Lavender
  "#2dd4bf", // Aqua
  "#f87171", // Soft Red
  "#818cf8"  // Periwinkle
];

export interface AuditSnapshotResult {
  garmentId: string;
  garmentName: string;
  frontColorIdUrl: string;
  backColorIdUrl: string;
  uvCanvasUrl: string;
  frontLitmusUrl: string;
  backLitmusUrl: string;
}

class GarmentAuditModule {
  private isColorIdActive: boolean = false;
  private backupMaterials: Map<string, { map: THREE.Texture | null; color: THREE.Color }> = new Map();

  get active(): boolean {
    return this.isColorIdActive;
  }

  /**
   * Get the deterministic distinct color for a piece index or ID
   */
  getPieceColor(index: number): string {
    return AUDIT_PIECE_PALETTE[index % AUDIT_PIECE_PALETTE.length];
  }

  /**
   * Toggle Piece Color ID Mode:
   * Replaces diffuse textures with vibrant solid colors per piece so each piece is immediately recognizable.
   */
  toggleColorIdMode(enable?: boolean): boolean {
    const targetState = enable !== undefined ? enable : !this.isColorIdActive;
    this.isColorIdActive = targetState;

    if (this.isColorIdActive) {
      this.enableColorIdMode();
    } else {
      this.disableColorIdMode();
    }

    return this.isColorIdActive;
  }

  /**
   * Apply distinct colors to each piece in 3D
   */
  enableColorIdMode() {
    this.isColorIdActive = true;
    this.backupMaterials.clear();

    modelStore.pieces.forEach((piece, idx) => {
      if (!piece.material) return;
      const mat = piece.material;

      // Backup original texture and color
      if (!this.backupMaterials.has(piece.id)) {
        this.backupMaterials.set(piece.id, {
          map: mat.map || null,
          color: mat.color.clone()
        });
      }

      const colorHex = this.getPieceColor(idx);
      mat.map = null;
      mat.color.set(colorHex);
      mat.roughness = 0.5;
      mat.metalness = 0.05;
      mat.needsUpdate = true;
    });

    modelStore.updateAssignedTransparency();
  }

  /**
   * Revert back to original textures/materials
   */
  disableColorIdMode() {
    this.isColorIdActive = false;

    modelStore.pieces.forEach((piece) => {
      if (!piece.material) return;
      const backup = this.backupMaterials.get(piece.id);
      if (backup) {
        piece.material.map = backup.map;
        piece.material.color.copy(backup.color);
        piece.material.needsUpdate = true;
      }
    });

    this.backupMaterials.clear();
    modelStore.updateAssignedTransparency();
  }

  /**
   * Position the 3D studio camera precisely to front, back, or isometric angle
   */
  setCameraView(view: "front" | "back" | "iso") {
    const camera = modelStore.camera;
    const controls = modelStore.controls;
    const model = modelStore.currentModel;
    if (!camera || !controls || !model) return;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 100;

    const fov = camera.fov * (Math.PI / 180);
    const dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;

    controls.target.set(0, 0, 0);

    if (view === "front") {
      camera.position.set(0, maxDim * 0.05, dist);
    } else if (view === "back") {
      camera.position.set(0, maxDim * 0.05, -dist);
    } else if (view === "iso") {
      camera.position.set(dist * 0.75, dist * 0.5, dist * 0.75);
    }

    camera.lookAt(0, 0, 0);
    controls.update();

    if (modelStore.renderer && modelStore.scene) {
      modelStore.renderer.render(modelStore.scene, camera);
    }
  }

  /**
   * Capture a PNG data URL from the current 3D WebGL renderer
   */
  capture3DView(): string | null {
    const renderer = modelStore.renderer;
    const scene = modelStore.scene;
    const camera = modelStore.camera;
    if (!renderer || !scene || !camera) return null;

    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  }

  /**
   * Capture comprehensive multi-angle audit snapshots:
   *  1. Front 3D Color ID
   *  2. Back 3D Color ID
   *  3. Front Litmus Test (Chest Logo)
   *  4. Back Litmus Test
   */
  async captureCompleteAudit(): Promise<AuditSnapshotResult | null> {
    const current = modelStore.filteredCuratedList[modelStore.currentCuratedIndex];
    if (!current || !modelStore.currentModel) return null;

    // 1. Enable Color ID Mode & capture Front + Back
    this.enableColorIdMode();
    this.setCameraView("front");
    await new Promise(r => setTimeout(r, 60));
    const frontColorIdUrl = this.capture3DView() || "";

    this.setCameraView("back");
    await new Promise(r => setTimeout(r, 60));
    const backColorIdUrl = this.capture3DView() || "";

    // 2. Apply Litmus Texture & capture Front + Back
    this.disableColorIdMode();
    const type = current.category === "BOTTOMWEAR" ? "BOTTOMWEAR" : "TOPWEAR";
    modelStore.applyLitmusTestTexture(type);
    await new Promise(r => setTimeout(r, 80));

    this.setCameraView("front");
    await new Promise(r => setTimeout(r, 60));
    const frontLitmusUrl = this.capture3DView() || "";

    this.setCameraView("back");
    await new Promise(r => setTimeout(r, 60));
    const backLitmusUrl = this.capture3DView() || "";

    // Reset camera to front
    this.setCameraView("front");

    return {
      garmentId: current.id,
      garmentName: current.name,
      frontColorIdUrl,
      backColorIdUrl,
      uvCanvasUrl: "",
      frontLitmusUrl,
      backLitmusUrl
    };
  }
}

export const garmentAuditModule = new GarmentAuditModule();
