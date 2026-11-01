/**
 * @module EnvironmentStudioPlugin
 * Trikomi Studio Plugin for Environment Lighting, HDR maps, and Viewport Background control.
 */

import * as THREE from 'three';
import { TrikomiStudioPlugin, type ITrikomiViewer } from './TrikomiPluginBase';

export interface EnvironmentPreset {
  id: string;
  name: string;
  url: string;
}

export class EnvironmentStudioPlugin extends TrikomiStudioPlugin {
  public readonly id = 'environment_studio';

  private currentHdrTexture: THREE.Texture | null = null;
  private showEnvironment: boolean = true;
  private backgroundColor: string = '#090d16';

  public readonly presets: EnvironmentPreset[] = [
    { id: 'studio', name: 'Studio Softbox', url: '/hdri/aerodynamics_workshop_1k.hdr' },
    { id: 'neutral', name: 'Neutral Daylight', url: '/hdri/photo_studio_loft_hall_1k.hdr' },
    { id: 'dark', name: 'Dark Void Contrast', url: '/hdri/dark_studio.hdr' }
  ];

  public setBackgroundColor(hex: string): void {
    this.backgroundColor = hex;
    if (this.viewer && this.viewer.renderer) {
      this.viewer.renderer.setClearColor(new THREE.Color(hex), 1);
    }
  }

  public getBackgroundColor(): string {
    return this.backgroundColor;
  }

  public setShowEnvironment(show: boolean): void {
    this.showEnvironment = show;
    if (this.viewer && this.viewer.scene) {
      this.viewer.scene.environment = show ? this.currentHdrTexture : null;
    }
  }

  public isEnvironmentVisible(): boolean {
    return this.showEnvironment;
  }

  public setEnvironmentTexture(texture: THREE.Texture | null): void {
    this.currentHdrTexture = texture;
    if (this.viewer && this.viewer.scene && this.showEnvironment) {
      this.viewer.scene.environment = texture;
    }
  }

  override onAttach(viewer: ITrikomiViewer): void {
    super.onAttach(viewer);
    this.setBackgroundColor(this.backgroundColor);
  }

  override onDetach(): void {
    if (this.viewer && this.viewer.scene) {
      this.viewer.scene.environment = null;
    }
    this.currentHdrTexture = null;
    super.onDetach();
  }
}
