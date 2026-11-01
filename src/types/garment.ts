import * as THREE from "three";

export interface FabricCatalogItem {
  id: string;
  name: string;
  categoryName?: string;
  thumbnailUrl?: string;
  normalTextureUrl?: string;
  normalStrength?: number;
  roughness?: number;
  metalness?: number;
  baseColorValue?: number[] | string | number;
  baseColorTextureUrl?: string;
}

export interface GarmentPiece {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  visible?: boolean;
  triangles: number;
  originalGeometry?: THREE.BufferGeometry;
  originalTriangles?: number;
  catalogItem: FabricCatalogItem | null;
  assignedZoneId?: string | null; // Zone assigned by user (e.g. FRONT_TORSO, BACK_TORSO, or null if unassigned)
}

export interface MapAuditEntry {
  meshName: string;
  texture: string;
  url?: string;
}

export interface ModelMetadata {
  title: string;
  triangles: number;
  vertices: number;
  piecesCount: number;
  missingMaps: MapAuditEntry[];
  matchedMaps: MapAuditEntry[];
  isThin?: boolean;
  mode?: string;
  totalPackedMaps?: number;
  totalCatalogMatches?: number;
  modelHash?: string;
  isRestoredFromSqlite?: boolean;
}

export interface MigratedRegistryItem {
  id: string;
  title: string;
  timestamp: string;
  triangles?: number;
  piecesCount?: number;
}

export interface IncomingMaterialInfo {
  name?: string;
  baseColor?: number[] | string | number;
  roughness?: number;
  metalness?: number;
  diffDataUrl?: string;
  diffUrl?: string;
  normDataUrl?: string;
  normUrl?: string;
  normTex?: string;
  normalScale?: number;
  texWidth?: number;
  texHeight?: number;
  texAngle?: number;
  texOffset?: [number, number];
}

export interface RawMeshData {
  name: string;
  materialName: string;
  vertices: number[];
  indices?: number[];
  normals?: number[];
  uvs?: number[];
  fabricMatrix?: number[];
  uvSize?: [number, number];
}

export interface TransferPayload {
  id?: string;
  title?: string;
  rawMeshes?: RawMeshData[];
  objText?: string;
  materials?: Record<string, IncomingMaterialInfo>;
  isThin?: boolean;
  mode?: string;
  detectedLocalCatalogCount?: number;
  dedicatedStyle3dMapCount?: number;
  timestamp?: string;
}

export interface CanonicalUVZone {
  id: string;
  label: string;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  color: string;
}

export type UVZonesDict = Record<string, CanonicalUVZone>;

export interface OrganizedPanelInfo {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  triangles: number;
  assignedZone: string;
  targetZoneMeta: CanonicalUVZone;
}
