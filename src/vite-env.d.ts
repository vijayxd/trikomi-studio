/// <reference types="vite/client" />

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "three/examples/jsm/libs/meshopt_simplifier.module.js" {
  export interface MeshoptSimplifierInstance {
    ready: Promise<void>;
    supported: boolean;
    compactMesh(indices: Uint32Array | Uint16Array): [Uint32Array, number];
    simplify(
      indices: Uint32Array | Uint16Array,
      vertex_positions: Float32Array,
      vertex_positions_stride: number,
      target_index_count: number,
      target_error: number,
      flags?: string[]
    ): [Uint32Array, number];
    simplifyWithAttributes(
      indices: Uint32Array | Uint16Array,
      vertex_positions: Float32Array,
      vertex_positions_stride: number,
      vertex_attributes: Float32Array,
      vertex_attributes_stride: number,
      attribute_weights: number[],
      vertex_lock: Uint8Array | null,
      target_index_count: number,
      target_error: number,
      flags?: string[]
    ): [Uint32Array, number];
  }

  export const MeshoptSimplifier: MeshoptSimplifierInstance;
}

