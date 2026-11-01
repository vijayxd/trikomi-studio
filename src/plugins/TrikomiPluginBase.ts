/**
 * @module TrikomiPluginBase
 * Base interface and class for Trikomi Studio Addon Plugins.
 * Designed to seamlessly interface with @trikomi/core ThreeViewer.
 */

import * as THREE from 'three';

export interface ITrikomiViewer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.Camera;
  renderer: THREE.WebGLRenderer;
  getPlugin?<T>(id: string): T | undefined;
}

export interface ITrikomiStudioPlugin {
  readonly id: string;
  enabled: boolean;
  onAttach(viewer: ITrikomiViewer): void;
  onDetach(): void;
  onUpdate?(deltaTime: number): void;
  onRender?(): void;
}

export abstract class TrikomiStudioPlugin implements ITrikomiStudioPlugin {
  abstract readonly id: string;
  public enabled: boolean = true;
  protected viewer?: ITrikomiViewer;

  onAttach(viewer: ITrikomiViewer): void {
    this.viewer = viewer;
  }

  onDetach(): void {
    this.viewer = undefined;
  }

  onUpdate?(deltaTime: number): void;
  onRender?(): void;
}
