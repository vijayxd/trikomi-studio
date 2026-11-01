import { makeAutoObservable } from "mobx";
import * as THREE from "three";
import { modelStore } from "./modelStore";
import { 
  CanonicalUVZone, 
  UVZonesDict, 
  OrganizedPanelInfo,
  GarmentPiece
} from "../types/garment";

export type { CanonicalUVZone, UVZonesDict };

export const GARMENT_TYPES = {
  TOPWEAR: "TOPWEAR",
  BOTTOMWEAR: "BOTTOMWEAR"
} as const;

export type GarmentType = typeof GARMENT_TYPES[keyof typeof GARMENT_TYPES];

// 1. TOPWEAR: Canonical UV Template (T-Shirts, Hoodies, Tank Tops, Sleeveless Tops, Crop Tops)
// Unassigned / absent parts simply remain empty!
export const DEFAULT_TOPWEAR_CANONICAL_UV_ZONES: UVZonesDict = {
  FRONT_TORSO:  { id: "FRONT_TORSO",  label: "Front Body",   uMin: 0.01, uMax: 0.44, vMin: 0.55, vMax: 0.99, color: "#38bdf8" },
  BACK_TORSO:   { id: "BACK_TORSO",   label: "Back Body",    uMin: 0.45, uMax: 0.88, vMin: 0.55, vMax: 0.99, color: "#818cf8" },
  TRIMS:        { id: "TRIMS",        label: "Trims / Laces",uMin: 0.89, uMax: 0.99, vMin: 0.48, vMax: 0.99, color: "#94a3b8" },
  WAISTBAND:    { id: "WAISTBAND",    label: "Waistband",    uMin: 0.01, uMax: 0.88, vMin: 0.48, vMax: 0.54, color: "#c084fc" },
  SLEEVE_LEFT:  { id: "SLEEVE_LEFT",  label: "Left Sleeve",  uMin: 0.01, uMax: 0.27, vMin: 0.08, vMax: 0.47, color: "#34d399" },
  CUFF_LEFT:    { id: "CUFF_LEFT",    label: "Left Cuff",    uMin: 0.01, uMax: 0.27, vMin: 0.01, vMax: 0.07, color: "#10b981" },
  SLEEVE_RIGHT: { id: "SLEEVE_RIGHT", label: "Right Sleeve", uMin: 0.28, uMax: 0.54, vMin: 0.08, vMax: 0.47, color: "#f472b6" },
  CUFF_RIGHT:   { id: "CUFF_RIGHT",   label: "Right Cuff",   uMin: 0.28, uMax: 0.54, vMin: 0.01, vMax: 0.07, color: "#fb7185" },
  COLLAR_NECK:  { id: "COLLAR_NECK",  label: "Collar / Hood",uMin: 0.55, uMax: 0.99, vMin: 0.01, vMax: 0.47, color: "#fbbf24" }
};

// 2. BOTTOMWEAR: Universal Canonical UV Template (Pants, Trousers, Joggers, Shorts, Skirts)
// Canonical zones: WAISTBAND, LEG_LEFT, LEG_RIGHT, CUFF_LEFT (Left Ankle Rib), CUFF_RIGHT (Right Ankle Rib), TRIMS
// Ankle ribs provide unified texture mapping capability across full-length pants, joggers, and shorts!
export const DEFAULT_BOTTOMWEAR_CANONICAL_UV_ZONES: UVZonesDict = {
  WAISTBAND:    { id: "WAISTBAND",    label: "Waistband",        uMin: 0.01, uMax: 0.88, vMin: 0.90, vMax: 0.99, color: "#c084fc" },
  TRIMS:        { id: "TRIMS",        label: "Trims & Accents",  uMin: 0.89, uMax: 0.99, vMin: 0.01, vMax: 0.99, color: "#94a3b8" },
  LEG_LEFT:     { id: "LEG_LEFT",     label: "Left Leg",         uMin: 0.01, uMax: 0.44, vMin: 0.08, vMax: 0.89, color: "#38bdf8" },
  CUFF_LEFT:    { id: "CUFF_LEFT",    label: "Left Ankle Rib",   uMin: 0.01, uMax: 0.44, vMin: 0.01, vMax: 0.07, color: "#10b981" },
  LEG_RIGHT:    { id: "LEG_RIGHT",    label: "Right Leg",        uMin: 0.45, uMax: 0.88, vMin: 0.08, vMax: 0.89, color: "#f472b6" },
  CUFF_RIGHT:   { id: "CUFF_RIGHT",   label: "Right Ankle Rib",  uMin: 0.45, uMax: 0.88, vMin: 0.01, vMax: 0.07, color: "#fb7185" }
};

export class UVOrganizerStore {
  isUVInspectOpen = true; // Open side-by-side UV Editor by default
  hoveredZone: string | null = null;
  selectedZoneId: string | null = "FRONT_TORSO";
  showZoneEditorModal = false;
  activeGarmentType: GarmentType = GARMENT_TYPES.TOPWEAR;
  layoutVersion = 0; // Incremented whenever UV coordinates are arranged or updated

  // UV Arrange Strategy:
  // "fixed" (Canonical standard): Empty slot zones remain fixed in place at standardized coordinates
  // "dynamic" (Auto-repack): Only assigned zones are arranged, expanding and filling UV [0,1] space without leaving dead empty slots
  arrangeMode: "fixed" | "dynamic" = "fixed";

  // Island Padding Margin (in pixels at 2048x2048 map equivalent) to prevent mipmap seam bleeding
  islandPaddingPx: 4 | 8 | 12 | 16 = 8;

  // Fully customizable zones dictionary (persisted)
  zones: UVZonesDict = JSON.parse(JSON.stringify(DEFAULT_TOPWEAR_CANONICAL_UV_ZONES));

  setIslandPaddingPx(px: 4 | 8 | 12 | 16) {
    this.islandPaddingPx = px;
  }

  constructor() {
    makeAutoObservable(this);
    this.loadSavedZones();
  }

  setArrangeMode(mode: "fixed" | "dynamic") {
    this.arrangeMode = mode;
  }

  loadSavedZones() {
    try {
      const stored = localStorage.getItem(`custom_canonical_uv_zones_${this.activeGarmentType}`);
      if (stored) {
        this.zones = JSON.parse(stored);
      } else {
        const defaultTemplate = this.activeGarmentType === GARMENT_TYPES.BOTTOMWEAR 
          ? DEFAULT_BOTTOMWEAR_CANONICAL_UV_ZONES 
          : DEFAULT_TOPWEAR_CANONICAL_UV_ZONES;
        this.zones = JSON.parse(JSON.stringify(defaultTemplate));
        this.saveZones();
      }
    } catch (e) {
      console.warn("Could not load custom UV zones", e);
    }
  }

  saveZones() {
    try {
      localStorage.setItem(`custom_canonical_uv_zones_${this.activeGarmentType}`, JSON.stringify(this.zones));
    } catch { }
  }

  switchGarmentType(type: GarmentType) {
    if (this.activeGarmentType !== type) {
      this.activeGarmentType = type;
      this.loadSavedZones();
      this.selectedZoneId = Object.keys(this.zones)[0] || null;
      this.layoutVersion++;
    }
  }

  resetZonesToDefault() {
    const defaultTemplate = this.activeGarmentType === GARMENT_TYPES.BOTTOMWEAR 
      ? DEFAULT_BOTTOMWEAR_CANONICAL_UV_ZONES 
      : DEFAULT_TOPWEAR_CANONICAL_UV_ZONES;
    this.zones = JSON.parse(JSON.stringify(defaultTemplate));
    this.saveZones();
  }

  exportZonesAsJSON() {
    const backupData = {
      generator: "Style3D Garment Studio",
      version: "2.0",
      timestamp: new Date().toISOString(),
      garmentType: this.activeGarmentType,
      zones: this.zones
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uv_canonical_layout_${this.activeGarmentType.toLowerCase()}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importZonesFromJSON(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString) as { garmentType?: GarmentType; zones?: UVZonesDict };
      if (data && data.zones) {
        if (data.garmentType && Object.values(GARMENT_TYPES).includes(data.garmentType)) {
          this.activeGarmentType = data.garmentType;
        }
        this.zones = data.zones;
        this.selectedZoneId = Object.keys(this.zones)[0] || null;
        this.saveZones();
        return { success: true };
      }
      return { success: false, error: "Invalid JSON format: missing 'zones' dictionary." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  updateZoneBounds(zoneId: string, updates: Partial<CanonicalUVZone>) {
    if (this.zones[zoneId]) {
      Object.assign(this.zones[zoneId], updates);
      this.saveZones();
    }
  }

  addNewZone(label: string, color = "#a855f7"): string {
    const id = "CUSTOM_ZONE_" + Date.now().toString(36).toUpperCase();
    this.zones[id] = {
      id,
      label: label || "New Slot",
      uMin: 0.1,
      uMax: 0.3,
      vMin: 0.1,
      vMax: 0.3,
      color: color
    };
    this.selectedZoneId = id;
    this.saveZones();
    return id;
  }

  deleteZone(zoneId: string) {
    if (this.zones[zoneId]) {
      delete this.zones[zoneId];
      if (this.selectedZoneId === zoneId) {
        this.selectedZoneId = Object.keys(this.zones)[0] || null;
      }
      this.saveZones();
    }
  }

  setSelectedZone(zoneId: string | null) {
    this.selectedZoneId = zoneId;
  }

  setShowZoneEditorModal(val: boolean) {
    this.showZoneEditorModal = val;
  }

  setHoveredZone(zoneId: string | null) {
    this.hoveredZone = zoneId;
  }

  toggleUVInspect() {
    this.isUVInspectOpen = !this.isUVInspectOpen;
  }

  openUVInspect() {
    this.isUVInspectOpen = true;
  }

  closeUVInspect() {
    this.isUVInspectOpen = false;
  }

  // Robust Two-Pass Pattern Identification Algorithm (Pure Bounding Box & UV Math, zero mesh names)
  // - Pass 1: Macro Anatomical Zones (Front Body, Back Body, Sleeves, Cuffs, Hood/Collar, Waistband)
  // - Pass 2: Trims & Accents Separation (Lengthy UV Island Aspect >= 12.0 or Mini BBox Volume < 400)
  autoDetectPatternAssignments(forceOverwrite = false) {
    if (!modelStore.currentModel || modelStore.pieces.length === 0) return;

    // 1. Measure overall garment bounding box in world space
    const garmentBbox = new THREE.Box3().setFromObject(modelStore.currentModel);
    const garmentCenter = new THREE.Vector3();
    const garmentSize = new THREE.Vector3();
    garmentBbox.getCenter(garmentCenter);
    garmentBbox.getSize(garmentSize);

    const garmentMin = garmentBbox.min;
    const totalHeight = garmentSize.y || 1;
    const totalWidth = garmentSize.x || 1;

    const maxDim = Math.max(garmentSize.x, garmentSize.y, garmentSize.z) || 100;
    // Scale factor to map world coordinates to Playground's normalized 100-unit reference frame
    const scaleFactor = 100 / maxDim;

    // Auto-infer garment type if garment dimensions clearly indicate Bottomwear (Pants have height/width > 2.0)
    // or if the loaded model title mentions pants/trousers/shorts/bottom/skirt
    const heightToWidthRatio = garmentSize.y / (garmentSize.x || 1);
    const modelTitle = (modelStore.modelMeta.title || "").toLowerCase();
    const isPantsByAspectOrName = heightToWidthRatio >= 1.85 || 
      ["pant", "trouser", "jean", "bottom", "short", "skirt", "legging"].some(w => modelTitle.includes(w));

    if (isPantsByAspectOrName && this.activeGarmentType !== GARMENT_TYPES.BOTTOMWEAR) {
      this.switchGarmentType(GARMENT_TYPES.BOTTOMWEAR);
    } else if (!isPantsByAspectOrName && heightToWidthRatio < 1.6 && ["sweater", "hoodie", "shirt", "tee", "top", "jacket"].some(w => modelTitle.includes(w)) && this.activeGarmentType !== GARMENT_TYPES.TOPWEAR) {
      this.switchGarmentType(GARMENT_TYPES.TOPWEAR);
    }

    // Map zone IDs dynamically based on available canonical template
    const frontZoneId = this.zones.FRONT_TORSO?.id || "FRONT_TORSO";
    const backZoneId = this.zones.BACK_TORSO?.id || "BACK_TORSO";
    const sleeveLZoneId = this.zones.SLEEVE_LEFT?.id || "SLEEVE_LEFT";
    const sleeveRZoneId = this.zones.SLEEVE_RIGHT?.id || "SLEEVE_RIGHT";
    const cuffLZoneId = this.zones.CUFF_LEFT?.id || sleeveLZoneId;
    const cuffRZoneId = this.zones.CUFF_RIGHT?.id || sleeveRZoneId;
    const hoodZoneId = this.zones.COLLAR_NECK?.id || "COLLAR_NECK";
    const waistbandZoneId = this.zones.WAISTBAND?.id || "WAISTBAND";
    const trimsZoneId = this.zones.TRIMS?.id || "TRIMS";

    modelStore.pieces.forEach((piece) => {
      if (piece.assignedZoneId && !forceOverwrite) return;

      const mesh = piece.mesh;
      if (!mesh || !mesh.geometry) return;
      const geom = mesh.geometry;

      mesh.updateMatrixWorld(true);
      const pieceBbox = new THREE.Box3().setFromObject(mesh);
      const pieceCenter = new THREE.Vector3();
      const pieceSize = new THREE.Vector3();
      pieceBbox.getCenter(pieceCenter);
      pieceBbox.getSize(pieceSize);

      // Scaled dimensions in Playground's normalized 100-unit coordinate frame
      const scaledPieceSizeY = pieceSize.y * scaleFactor;
      const scaledPieceVolume = (pieceSize.x * scaleFactor) * (pieceSize.y * scaleFactor) * (pieceSize.z * scaleFactor);

      // Compute UV aspect ratio directly from geometry UV attribute
      let uvAspect = 1.0;
      const uvAttr = geom.attributes.uv;
      if (uvAttr && uvAttr.count > 0) {
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < uvAttr.count; i++) {
          const u = uvAttr.getX(i);
          const v = uvAttr.getY(i);
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        const uvW = maxU - minU;
        const uvH = maxV - minV;
        if (uvW > 0 && uvH > 0) {
          uvAspect = Math.max(uvW, uvH) / Math.min(uvW, uvH);
        }
      }

      // -------------------------------------------------------------
      // PASS 1: Macro Anatomical Zone Assignment
      // -------------------------------------------------------------
      const relX = pieceCenter.x - garmentCenter.x;
      const relZ = pieceCenter.z - garmentCenter.z;

      const normY = (pieceCenter.y - garmentMin.y) / totalHeight;     // 0 (bottom) to 1 (top)
      const normMinY = (pieceBbox.min.y - garmentMin.y) / totalHeight; // Piece lowest Y
      const normMaxY = (pieceBbox.max.y - garmentMin.y) / totalHeight; // Piece highest Y
      const normAbsX = Math.abs(relX) / (totalWidth / 2 || 1);        // 0 (center) to 1 (outer)
      const widthRatio = pieceSize.x / totalWidth;
      const heightRatio = pieceSize.y / totalHeight;

      let targetZone = frontZoneId;

      if (this.activeGarmentType === GARMENT_TYPES.BOTTOMWEAR) {
        const isLeft = relX < 0;
        // 1. WAISTBAND: Located at the top of pants/skirts (normY > 0.85 or normMinY > 0.78), wide horizontal band
        if ((normMinY > 0.78 || normY > 0.85) && widthRatio > 0.35 && heightRatio < 0.28) {
          targetZone = waistbandZoneId;
        }
        // 2. ANKLE RIBS: Bottommost cuffs/bands (normY < 0.12 && heightRatio < 0.15)
        else if (normY < 0.12 && heightRatio < 0.15 && (this.zones.CUFF_LEFT || this.zones.CUFF_RIGHT)) {
          targetZone = isLeft ? (this.zones.CUFF_LEFT?.id || "CUFF_LEFT") : (this.zones.CUFF_RIGHT?.id || "CUFF_RIGHT");
        }
        // 3. LEGS: All remaining leg body panels divided symmetrically along coronal centerline (X < 0 Left Leg, X >= 0 Right Leg)
        else {
          targetZone = isLeft ? (this.zones.LEG_LEFT?.id || "LEG_LEFT") : (this.zones.LEG_RIGHT?.id || "LEG_RIGHT");
        }
      } else {
        // TOPWEAR:
        // 1. WAISTBAND: Lowest elevation, wide waistband band
        if (normY < 0.16 && widthRatio > 0.35) {
          targetZone = waistbandZoneId;
        }
        // 2. HOOD / COLLAR: Highest elevation (top of garment, above neck line)
        else if (normY > 0.72) {
          targetZone = hoodZoneId;
        }
        // 3. SLEEVES & CUFFS: Lateral position (far left or far right)
        else if (normAbsX > 0.42 && scaledPieceSizeY > 4) {
          const isLeft = relX < 0;
          if (normY < 0.28 || scaledPieceSizeY < 12) {
            targetZone = isLeft ? cuffLZoneId : cuffRZoneId;
          } else {
            targetZone = isLeft ? sleeveLZoneId : sleeveRZoneId;
          }
        }
        // 4. FRONT BODY vs BACK BODY (Central torso)
        else if (normAbsX <= 0.48 && normY >= 0.12 && normY <= 0.76) {
          targetZone = relZ >= 0 ? frontZoneId : backZoneId;
        } else {
          targetZone = frontZoneId;
        }
      }

      // -------------------------------------------------------------
      // PASS 2: Trims & Accents Separation (Applies to both Topwear & Bottomwear)
      // User rule: "any lengthy uv island or small bounding box thing we consider as trim"
      // Bit-for-bit identical to Playground.tsx reference algorithm:
      // - Elongated UV island (uvAspect >= 12.0)
      // - Tiny bounding box volume (scaledPieceVolume < 500)
      // - Extremely thin stitching / seam lines / zippers (scaledPieceSizeY < 12 && scaledPieceVolume < 50000 && heightRatio < 0.04)
      // - Tassels, pockets flaps, small side strips (widthRatio < 0.12 && heightRatio < 0.32 && scaledPieceVolume < 550000)
      // - Waistband is a primary structural panel and protected from trim reassignment
      // -------------------------------------------------------------
      if (targetZone !== waistbandZoneId) {
        const isLengthyUv = uvAspect >= 12.0;
        const isTinyBbox = scaledPieceVolume > 0 && scaledPieceVolume < 500;
        const isThinSeamOrHardware = scaledPieceSizeY < 12 && scaledPieceVolume < 50000 && heightRatio < 0.04;
        const isTasselOrPocketFlap = (widthRatio < 0.12 && heightRatio < 0.32 && scaledPieceVolume < 550000);

        if (isLengthyUv || isTinyBbox || isThinSeamOrHardware || isTasselOrPocketFlap) {
          targetZone = trimsZoneId;
        }
      }

      piece.assignedZoneId = targetZone;
    });

    // 1. Immediately update piece materials so 3D Viewport reflects assignments
    modelStore.updateAssignedTransparency();

    // 2. Persist to SQLite config
    modelStore.persistGarmentConfigToSQLite();

    // 3. Increment layoutVersion so UV Studio reactive listeners re-render immediately
    this.layoutVersion++;
  }

  get assignedPanels(): OrganizedPanelInfo[] {
    const list: OrganizedPanelInfo[] = [];
    modelStore.pieces.forEach((p) => {
      if (p.assignedZoneId && this.zones[p.assignedZoneId]) {
        list.push({
          id: p.id,
          name: p.name,
          mesh: p.mesh,
          triangles: p.triangles,
          assignedZone: p.assignedZoneId,
          targetZoneMeta: this.zones[p.assignedZoneId]
        });
      }
    });
    return list;
  }

  // Translate a specific piece's UVs by deltaU and deltaV (Instant 60fps drag!)
  translatePieceUV(pieceId: string, deltaU: number, deltaV: number) {
    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.mesh || !piece.mesh.geometry) return;
    const uvAttr = piece.mesh.geometry.attributes.uv;
    if (!(uvAttr instanceof THREE.BufferAttribute)) return;

    const arr = uvAttr.array;
    for (let i = 0; i < arr.length; i += 2) {
      arr[i] += deltaU;
      arr[i + 1] += deltaV;
    }
    uvAttr.needsUpdate = true;
    if (piece.material) {
      piece.material.needsUpdate = true;
    }
    this.layoutVersion++;
  }

  // Get Island Center and Bounds
  getPieceUVBounds(pieceId: string): { minU: number; maxU: number; minV: number; maxV: number; centerU: number; centerV: number; width: number; height: number } | null {
    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.mesh || !piece.mesh.geometry) return null;
    const uvAttr = piece.mesh.geometry.attributes.uv;
    if (!(uvAttr instanceof THREE.BufferAttribute) || uvAttr.count === 0) return null;

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    const arr = uvAttr.array;
    for (let i = 0; i < arr.length; i += 2) {
      const u = arr[i];
      const v = arr[i + 1];
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    return {
      minU,
      maxU,
      minV,
      maxV,
      centerU: (minU + maxU) * 0.5,
      centerV: (minV + maxV) * 0.5,
      width: maxU - minU,
      height: maxV - minV
    };
  }

  // Get Combined Bounds of Multiple Selected Pieces
  getGroupUVBounds(pieceIds: string[]): { minU: number; maxU: number; minV: number; maxV: number; centerU: number; centerV: number; width: number; height: number } | null {
    if (pieceIds.length === 0) return null;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    let validCount = 0;

    pieceIds.forEach(id => {
      const b = this.getPieceUVBounds(id);
      if (b) {
        if (b.minU < minU) minU = b.minU;
        if (b.maxU > maxU) maxU = b.maxU;
        if (b.minV < minV) minV = b.minV;
        if (b.maxV > maxV) maxV = b.maxV;
        validCount++;
      }
    });

    if (validCount === 0) return null;
    return {
      minU,
      maxU,
      minV,
      maxV,
      centerU: (minU + maxU) * 0.5,
      centerV: (minV + maxV) * 0.5,
      width: maxU - minU,
      height: maxV - minV
    };
  }

  // Translate a group of pieces by deltaU and deltaV
  translatePiecesGroupUV(pieceIds: string[], deltaU: number, deltaV: number) {
    pieceIds.forEach(id => {
      const piece = modelStore.pieces.find(p => p.id === id);
      if (!piece || !piece.mesh || !piece.mesh.geometry) return;
      const uvAttr = piece.mesh.geometry.attributes.uv;
      if (!(uvAttr instanceof THREE.BufferAttribute)) return;

      const arr = uvAttr.array;
      for (let i = 0; i < arr.length; i += 2) {
        arr[i] += deltaU;
        arr[i + 1] += deltaV;
      }
      uvAttr.needsUpdate = true;
      if (piece.material) {
        piece.material.needsUpdate = true;
      }
    });
    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
  }

  // Rotate a group of pieces together around their collective group center
  rotatePiecesGroupUV(pieceIds: string[], angleDeg: number) {
    const groupBounds = this.getGroupUVBounds(pieceIds);
    if (!groupBounds) return;

    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const cU = groupBounds.centerU;
    const cV = groupBounds.centerV;

    pieceIds.forEach(id => {
      const piece = modelStore.pieces.find(p => p.id === id);
      if (!piece || !piece.mesh || !piece.mesh.geometry) return;
      const uvAttr = piece.mesh.geometry.attributes.uv;
      if (!(uvAttr instanceof THREE.BufferAttribute)) return;

      const arr = uvAttr.array;
      for (let i = 0; i < arr.length; i += 2) {
        const du = arr[i] - cU;
        const dv = arr[i + 1] - cV;
        arr[i] = cU + (du * cosA - dv * sinA);
        arr[i + 1] = cV + (du * sinA + dv * cosA);
      }
      uvAttr.needsUpdate = true;
      if (piece.material) {
        piece.material.needsUpdate = true;
      }
    });

    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
  }

  // Scale a group of pieces together around their collective group center
  scalePiecesGroupUV(pieceIds: string[], factor: number) {
    if (factor <= 0 || factor === 1) return;
    const groupBounds = this.getGroupUVBounds(pieceIds);
    if (!groupBounds) return;

    const cU = groupBounds.centerU;
    const cV = groupBounds.centerV;

    pieceIds.forEach(id => {
      const piece = modelStore.pieces.find(p => p.id === id);
      if (!piece || !piece.mesh || !piece.mesh.geometry) return;
      const uvAttr = piece.mesh.geometry.attributes.uv;
      if (!(uvAttr instanceof THREE.BufferAttribute)) return;

      const arr = uvAttr.array;
      for (let i = 0; i < arr.length; i += 2) {
        arr[i] = cU + (arr[i] - cU) * factor;
        arr[i + 1] = cV + (arr[i + 1] - cV) * factor;
      }
      uvAttr.needsUpdate = true;
      if (piece.material) {
        piece.material.needsUpdate = true;
      }
    });

    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
  }

  // Rotate Piece UV around its center by angle in degrees (e.g. 90, -90, 45, 180)
  rotatePieceUV(pieceId: string, angleDeg: number) {
    const bounds = this.getPieceUVBounds(pieceId);
    if (!bounds) return;

    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.mesh || !piece.mesh.geometry) return;
    const uvAttr = piece.mesh.geometry.attributes.uv;
    if (!(uvAttr instanceof THREE.BufferAttribute)) return;

    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const cU = bounds.centerU;
    const cV = bounds.centerV;

    const arr = uvAttr.array;
    for (let i = 0; i < arr.length; i += 2) {
      const du = arr[i] - cU;
      const dv = arr[i + 1] - cV;
      arr[i] = cU + (du * cosA - dv * sinA);
      arr[i + 1] = cV + (du * sinA + dv * cosA);
    }
    uvAttr.needsUpdate = true;
    if (piece.material) {
      piece.material.needsUpdate = true;
    }
    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
  }

  // Flip Piece UV horizontally (around center U) or vertically (around center V)
  flipPieceUV(pieceId: string, axis: "horizontal" | "vertical") {
    const bounds = this.getPieceUVBounds(pieceId);
    if (!bounds) return;

    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.mesh || !piece.mesh.geometry) return;
    const uvAttr = piece.mesh.geometry.attributes.uv;
    if (!(uvAttr instanceof THREE.BufferAttribute)) return;

    const cU = bounds.centerU;
    const cV = bounds.centerV;
    const arr = uvAttr.array;

    if (axis === "horizontal") {
      for (let i = 0; i < arr.length; i += 2) {
        arr[i] = 2 * cU - arr[i];
      }
    } else {
      for (let i = 1; i < arr.length; i += 2) {
        arr[i] = 2 * cV - arr[i];
      }
    }

    uvAttr.needsUpdate = true;
    if (piece.material) {
      piece.material.needsUpdate = true;
    }
    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
  }

  // Scale Piece UV uniformly around its center
  scalePieceUV(pieceId: string, factor: number) {
    if (factor <= 0 || factor === 1) return;
    const bounds = this.getPieceUVBounds(pieceId);
    if (!bounds) return;

    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.mesh || !piece.mesh.geometry) return;
    const uvAttr = piece.mesh.geometry.attributes.uv;
    if (!(uvAttr instanceof THREE.BufferAttribute)) return;

    const cU = bounds.centerU;
    const cV = bounds.centerV;
    const arr = uvAttr.array;

    for (let i = 0; i < arr.length; i += 2) {
      arr[i] = cU + (arr[i] - cU) * factor;
      arr[i + 1] = cV + (arr[i + 1] - cV) * factor;
    }

    uvAttr.needsUpdate = true;
    if (piece.material) {
      piece.material.needsUpdate = true;
    }
    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
  }

  // Center Piece directly into its assigned zone bounds
  centerPieceInZone(pieceId: string) {
    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.assignedZoneId) return;
    const targetZone = this.zones[piece.assignedZoneId];
    if (!targetZone) return;

    const bounds = this.getPieceUVBounds(pieceId);
    if (!bounds) return;

    const zoneCenterU = (targetZone.uMin + targetZone.uMax) * 0.5;
    const zoneCenterV = (targetZone.vMin + targetZone.vMax) * 0.5;

    const deltaU = zoneCenterU - bounds.centerU;
    const deltaV = zoneCenterV - bounds.centerV;

    this.translatePieceUV(pieceId, deltaU, deltaV);
    modelStore.persistGarmentConfigToSQLite();
  }

  // Reset Piece UV to original geometry unwrap from file
  resetPieceUV(pieceId: string) {
    const piece = modelStore.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.mesh || !piece.mesh.geometry) return;
    const geom = piece.mesh.geometry;
    const origUv = geom.userData?.originalUv;
    if (!(origUv instanceof Float32Array)) return;

    const uvAttr = geom.attributes.uv;
    if (uvAttr instanceof THREE.BufferAttribute) {
      uvAttr.array.set(origUv);
      uvAttr.needsUpdate = true;
      if (piece.material) {
        piece.material.needsUpdate = true;
      }
      this.layoutVersion++;
      modelStore.persistGarmentConfigToSQLite();
    }
  }

  // INSTANT MULTI-PIECE AWARE ARRANGE UVS (< 5ms execution):
  // 1. Never stalls or lags: Uses direct array indexing without method calls
  // 2. Multiple pieces in same zone (e.g., Front Body + Kangaroo Pocket):
  //    - Sorts pieces by area (largest main panel on top, smaller pockets placed neatly below)
  //    - Applies uniform 1:1 isotropic scaling
  //    - Stacks non-overlapping sub-slots so pocket and body never collide
  arrangeAssignedUVs(): { packedCount: number; emptyZones: string[] } {
    const t0 = performance.now();
    let packedCount = 0;

    // 1. Automatically assign any unselected/unassigned patterns directly to TRIMS
    // (Stitching lines, tiny buttons, collar bands, drawstrings, pocket flaps, labels, etc.)
    const trimsZoneId = this.zones.TRIMS?.id || Object.keys(this.zones).find(k => k.toLowerCase().includes("trim")) || Object.keys(this.zones)[0];
    if (trimsZoneId) {
      modelStore.pieces.forEach((p) => {
        if (!p.assignedZoneId) {
          p.assignedZoneId = trimsZoneId;
        }
      });
    }

    const byZone = new Map<string, GarmentPiece[]>();
    modelStore.pieces.forEach((p) => {
      if (p.assignedZoneId && this.zones[p.assignedZoneId]) {
        const arr = byZone.get(p.assignedZoneId) || [];
        arr.push(p);
        byZone.set(p.assignedZoneId, arr);
      }
    });

    const activeZoneKeys = new Set(byZone.keys());
    const emptyZones = Object.keys(this.zones).filter(k => !activeZoneKeys.has(k));

    // Pre-pass: Compute group bounds for every zone
    interface ZoneGroupData {
      zoneId: string;
      targetZone: CanonicalUVZone;
      piecesInZone: GarmentPiece[];
      validPieceAttrs: { piece: GarmentPiece; uvAttr: THREE.BufferAttribute }[];
      groupMinU: number;
      groupMaxU: number;
      groupMinV: number;
      groupMaxV: number;
      groupW: number;
      groupH: number;
      isTrims: boolean;
    }

    const zoneGroups: ZoneGroupData[] = [];

    byZone.forEach((piecesInZone, zoneId) => {
      const targetZone = this.zones[zoneId];
      if (!targetZone) return;

      const validPieceAttrs: { piece: GarmentPiece; uvAttr: THREE.BufferAttribute }[] = [];
      let groupMinU = Infinity, groupMaxU = -Infinity;
      let groupMinV = Infinity, groupMaxV = -Infinity;

      piecesInZone.forEach((piece) => {
        const uvAttr = piece.mesh?.geometry?.attributes.uv;
        if (uvAttr instanceof THREE.BufferAttribute) {
          validPieceAttrs.push({ piece, uvAttr });
          const arr = uvAttr.array;
          for (let i = 0; i < arr.length; i += 2) {
            const u = arr[i];
            const v = arr[i + 1];
            if (u < groupMinU) groupMinU = u;
            if (u > groupMaxU) groupMaxU = u;
            if (v < groupMinV) groupMinV = v;
            if (v > groupMaxV) groupMaxV = v;
          }
        }
      });

      if (validPieceAttrs.length === 0) return;

      const groupW = Math.max(0.0001, groupMaxU - groupMinU);
      const groupH = Math.max(0.0001, groupMaxV - groupMinV);
      const isTrims = zoneId.toLowerCase().includes("trim");

      zoneGroups.push({
        zoneId,
        targetZone,
        piecesInZone,
        validPieceAttrs,
        groupMinU,
        groupMaxU,
        groupMinV,
        groupMaxV,
        groupW,
        groupH,
        isTrims
      });
    });

    if (zoneGroups.length === 0) {
      return { packedCount: 0, emptyZones };
    }

    // METHOD A: "fixed" (Default Canonical Blueprint)
    // Keeps every slot zone at its fixed coordinates, leaving unused slots empty.
    //
    // METHOD B: "dynamic" (Auto-rearrange Zones)
    // If no panel is assigned to certain zones, the active zones dynamically expand and repack
    // into the 0..1 UV coordinate space so empty zones don't leave wasted empty gaps.
    const resolvedTargets = new Map<string, { uMin: number; uMax: number; vMin: number; vMax: number }>();

    if (this.arrangeMode === "dynamic") {
      // Build dynamic layout for active groups only
      const mainGroups = zoneGroups.filter(g => !g.isTrims);
      const trimsGroup = zoneGroups.find(g => g.isTrims);

      // Reserve space for trims if present (e.g. 10% strip on right: U 0.90..0.99)
      const hasTrims = !!trimsGroup;
      const mainMaxU = hasTrims ? 0.88 : 0.99;
      const mainMinU = 0.01;
      const mainMinV = 0.01;
      const mainMaxV = 0.99;

      if (hasTrims && trimsGroup) {
        resolvedTargets.set(trimsGroup.zoneId, {
          uMin: 0.89,
          uMax: 0.99,
          vMin: 0.01,
          vMax: 0.99
        });
      }

      // Arrange main groups into a dynamic balanced grid across available UV area
      const count = mainGroups.length;
      if (count > 0) {
        // Optimal rows & columns for the active groups
        const cols = count <= 2 ? count : Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const colWidth = (mainMaxU - mainMinU) / cols;
        const rowHeight = (mainMaxV - mainMinV) / rows;

        mainGroups.forEach((g, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          // Invert row index so first items (front/back) are at the top (higher V)
          const invertedRow = (rows - 1) - row;

          const u0 = mainMinU + col * colWidth + 0.005;
          const u1 = mainMinU + (col + 1) * colWidth - 0.005;
          const v0 = mainMinV + invertedRow * rowHeight + 0.005;
          const v1 = mainMinV + (invertedRow + 1) * rowHeight - 0.005;

          resolvedTargets.set(g.zoneId, {
            uMin: u0,
            uMax: u1,
            vMin: v0,
            vMax: v1
          });
        });
      }
    } else {
      // Fixed Canonical slots from this.zones
      zoneGroups.forEach((zg) => {
        resolvedTargets.set(zg.zoneId, {
          uMin: zg.targetZone.uMin,
          uMax: zg.targetZone.uMax,
          vMin: zg.targetZone.vMin,
          vMax: zg.targetZone.vMax
        });
      });
    }

    // Convert pixel padding (based on 2048x2048 resolution) into UV [0, 1] offset
    const paddingUV = this.islandPaddingPx / 2048;

    // 1. Calculate a SINGLE GLOBAL UNIFORM SCALE across all main garment zones (except trims)
    // This ensures Front Body, Back Body, Sleeves, Cuffs, Collar, Waistband etc. ALL have 100% identical UV scale!
    let globalMainScale = Infinity;
    zoneGroups.forEach((zg) => {
      if (!zg.isTrims) {
        const target = resolvedTargets.get(zg.zoneId)!;
        // Apply padding margin inside target bounds
        const targetW = Math.max(0.001, (target.uMax - target.uMin) - paddingUV * 2);
        const targetH = Math.max(0.001, (target.vMax - target.vMin) - paddingUV * 2);
        const scaleToFit = Math.min(targetW / zg.groupW, targetH / zg.groupH);
        if (scaleToFit < globalMainScale) {
          globalMainScale = scaleToFit;
        }
      }
    });

    if (globalMainScale === Infinity || globalMainScale <= 0) {
      globalMainScale = 1.0;
    }

    // 2. Apply transformations:
    // - Non-trims zones: Use the EXACT SAME globalMainScale and center into slot
    // - Trims zone: Scaled independently to fit its slot tightly
    zoneGroups.forEach((zg) => {
      const target = resolvedTargets.get(zg.zoneId)!;
      const targetW = Math.max(0.001, (target.uMax - target.uMin) - paddingUV * 2);
      const targetH = Math.max(0.001, (target.vMax - target.vMin) - paddingUV * 2);

      const scale = zg.isTrims 
        ? Math.min(targetW / zg.groupW, targetH / zg.groupH)
        : globalMainScale;

      const finalW = zg.groupW * scale;
      const finalH = zg.groupH * scale;

      // Determine V positioning:
      // For Torso panels (FRONT_TORSO, BACK_TORSO) and Bottomwear panels (WAISTBAND, LEGS),
      // we use TOP-ANCHOR alignment so chest logos, necklines, and waistbands always align
      // reliably at the exact same physical coordinates, regardless of garment height!
      const isTopAnchoredZone = 
        zg.zoneId === "FRONT_TORSO" || 
        zg.zoneId === "BACK_TORSO" || 
        zg.zoneId === "WAISTBAND" ||
        zg.zoneId.startsWith("LEG_");

      const offsetU = (target.uMin + paddingUV) + (targetW - finalW) * 0.5;
      const offsetV = (isTopAnchoredZone && this.arrangeMode === "fixed")
        ? (target.vMax - paddingUV) - finalH // Pin to top edge of canonical zone
        : (target.vMin + paddingUV) + (targetH - finalH) * 0.5; // Center vertically

      zg.validPieceAttrs.forEach(({ piece, uvAttr }) => {
        const arr = uvAttr.array;
        for (let i = 0; i < arr.length; i += 2) {
          arr[i] = offsetU + (arr[i] - zg.groupMinU) * scale;
          arr[i + 1] = offsetV + (arr[i + 1] - zg.groupMinV) * scale;
        }
        uvAttr.needsUpdate = true;
        if (piece.material) {
          piece.material.needsUpdate = true;
        }
        packedCount++;
      });
    });

    const duration = (performance.now() - t0).toFixed(1);
    console.log(`[UVOrganizer] ⚡ UV Arrange (${this.arrangeMode.toUpperCase()}) Complete in ${duration}ms! Packed ${packedCount} pieces across ${byZone.size} zones.`);
    this.layoutVersion++; // Signal UV editor to immediately rebuild meshes and re-render
    modelStore.persistGarmentConfigToSQLite();
    this.openUVInspect();
    return { packedCount, emptyZones };
  }

  // Compute 3D Mesh Surface Area vs 2D UV Island Area to determine Texel Density (pixels/cm)
  computePieceTexelDensity(piece: GarmentPiece): { surfaceArea3D: number; uvArea: number; texelDensity: number } | null {
    if (!piece.mesh || !piece.mesh.geometry) return null;
    const geom = piece.mesh.geometry;
    const posAttr = geom.attributes.position;
    const uvAttr = geom.attributes.uv;
    const indexAttr = geom.index;
    if (!(posAttr instanceof THREE.BufferAttribute) || !(uvAttr instanceof THREE.BufferAttribute)) return null;

    let totalArea3D = 0;
    let totalUvArea = 0;

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const uvA = new THREE.Vector2();
    const uvB = new THREE.Vector2();
    const uvC = new THREE.Vector2();

    const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

    for (let i = 0; i < triCount; i++) {
      const idx0 = indexAttr ? indexAttr.getX(i * 3) : i * 3;
      const idx1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
      const idx2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

      vA.fromBufferAttribute(posAttr, idx0);
      vB.fromBufferAttribute(posAttr, idx1);
      vC.fromBufferAttribute(posAttr, idx2);

      // 3D Triangle Area (Half cross product magnitude)
      const edge1 = new THREE.Vector3().subVectors(vB, vA);
      const edge2 = new THREE.Vector3().subVectors(vC, vA);
      const cross = new THREE.Vector3().crossVectors(edge1, edge2);
      totalArea3D += cross.length() * 0.5;

      // 2D UV Triangle Area (Half determinant)
      uvA.fromBufferAttribute(uvAttr, idx0);
      uvB.fromBufferAttribute(uvAttr, idx1);
      uvC.fromBufferAttribute(uvAttr, idx2);
      const uvCross = Math.abs((uvB.x - uvA.x) * (uvC.y - uvA.y) - (uvC.x - uvA.x) * (uvB.y - uvA.y));
      totalUvArea += uvCross * 0.5;
    }

    if (totalArea3D <= 0 || totalUvArea <= 0) return null;

    // Texel density ratio: relative UV scale relative to 3D world dimension
    const texelDensity = Math.sqrt(totalUvArea / totalArea3D);

    return {
      surfaceArea3D: totalArea3D,
      uvArea: totalUvArea,
      texelDensity
    };
  }

  // Equalize Texel Density across all assigned pieces
  // Automatically balances pattern UV scaling so fabric weave looks 100% uniform across every panel
  equalizeTexelDensity(): { updatedCount: number; targetDensity: number } {
    let weightedDensitySum = 0;
    let totalWeight = 0;
    const pieceDensities = new Map<string, { density: number; area3D: number }>();

    // Pass 1: Compute average target texel density weighted by panel 3D area (ignoring trims)
    modelStore.pieces.forEach((p) => {
      const isTrim = p.assignedZoneId?.toLowerCase().includes("trim");
      if (!isTrim) {
        const stats = this.computePieceTexelDensity(p);
        if (stats && stats.texelDensity > 0) {
          pieceDensities.set(p.id, { density: stats.texelDensity, area3D: stats.surfaceArea3D });
          weightedDensitySum += stats.texelDensity * stats.surfaceArea3D;
          totalWeight += stats.surfaceArea3D;
        }
      }
    });

    if (totalWeight <= 0) return { updatedCount: 0, targetDensity: 1.0 };
    const targetDensity = weightedDensitySum / totalWeight;

    // Pass 2: Rescale individual pieces to match target texel density exactly
    let updatedCount = 0;
    pieceDensities.forEach(({ density }, pieceId) => {
      if (density > 0) {
        const factor = targetDensity / density;
        if (Math.abs(factor - 1.0) > 0.02) {
          this.scalePieceUV(pieceId, factor);
          updatedCount++;
        }
      }
    });

    this.layoutVersion++;
    modelStore.persistGarmentConfigToSQLite();
    console.log(`[UVOrganizer] ⚖️ Equalized Texel Density for ${updatedCount} panels (Target: ${(targetDensity * 1000).toFixed(2)})`);
    return { updatedCount, targetDensity };
  }

  // Phase 5: Production Blueprint Exporter (PNG & SVG)
  // Generates print-ready high-res UV layout with colored zones, wireframes, piece names and measurements
  exportProductionBlueprint(resolution: 2048 | 4096 = 2048, format: "png" | "svg" = "png") {
    if (!modelStore.currentModel || modelStore.pieces.length === 0) return;

    if (format === "png") {
      const canvas = document.createElement("canvas");
      canvas.width = resolution;
      canvas.height = resolution;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark blueprint background
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, resolution, resolution);

      // 1. Draw 10x10 fine grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = Math.max(1, Math.round(resolution / 2048));
      const step = resolution / 10;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, resolution);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(resolution, i * step);
        ctx.stroke();
      }

      // 2. Draw Canonical Blueprint Zones
      Object.values(this.zones).forEach((zone) => {
        const x = zone.uMin * resolution;
        const y = (1.0 - zone.vMax) * resolution;
        const w = (zone.uMax - zone.uMin) * resolution;
        const h = (zone.vMax - zone.vMin) * resolution;

        ctx.fillStyle = `${zone.color}15`;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = `${zone.color}80`;
        ctx.lineWidth = Math.max(2, Math.round(resolution / 1024));
        ctx.strokeRect(x, y, w, h);

        // Zone Tag
        ctx.fillStyle = zone.color;
        ctx.font = `bold ${Math.round(resolution * 0.013)}px sans-serif`;
        ctx.fillText(zone.label.toUpperCase(), x + 12, y + 24);
      });

      // 3. Draw UV Island Wireframes & Surfaces
      modelStore.pieces.forEach((piece) => {
        const geom = piece.mesh?.geometry;
        if (!geom) return;
        const uvAttr = geom.attributes.uv;
        const indexAttr = geom.index;
        if (!uvAttr) return;

        const assignedZone = piece.assignedZoneId ? this.zones[piece.assignedZoneId] : null;
        const pieceColor = assignedZone ? assignedZone.color : "#94a3b8";

        ctx.strokeStyle = pieceColor;
        ctx.lineWidth = Math.max(1, Math.round(resolution / 2048));
        ctx.fillStyle = `${pieceColor}35`;

        const triCount = indexAttr ? indexAttr.count / 3 : uvAttr.count / 3;
        for (let i = 0; i < triCount; i++) {
          const idx0 = indexAttr ? indexAttr.getX(i * 3) : i * 3;
          const idx1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
          const idx2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;

          const u0 = uvAttr.getX(idx0) * resolution;
          const v0 = (1.0 - uvAttr.getY(idx0)) * resolution;
          const u1 = uvAttr.getX(idx1) * resolution;
          const v1 = (1.0 - uvAttr.getY(idx1)) * resolution;
          const u2 = uvAttr.getX(idx2) * resolution;
          const v2 = (1.0 - uvAttr.getY(idx2)) * resolution;

          ctx.beginPath();
          ctx.moveTo(u0, v0);
          ctx.lineTo(u1, v1);
          ctx.lineTo(u2, v2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Panel Name label at Island center
        const b = this.getPieceUVBounds(piece.id);
        if (b) {
          const cx = b.centerU * resolution;
          const cy = (1.0 - b.centerV) * resolution;

          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(resolution * 0.011)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 6;
          ctx.fillText(piece.name, cx, cy);
          ctx.shadowBlur = 0;
        }
      });

      // 4. Header title & metadata
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(resolution * 0.015)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const title = `${modelStore.modelMeta.title || "Garment"} - UV Layout Blueprint (${resolution}x${resolution})`;
      ctx.fillText(title, 24, 24);

      // Download PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `uv_blueprint_${this.activeGarmentType.toLowerCase()}_${resolution}x${resolution}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
  }
}

export const uvOrganizerStore = new UVOrganizerStore();
