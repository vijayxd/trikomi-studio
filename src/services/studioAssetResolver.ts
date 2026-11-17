/**
 * studioAssetResolver.ts
 * Resolves models and fabric textures with direct Google Drive WebCrypto on GitHub Pages
 * and seamless fallback to local proxy when running locally.
 */

import { GoogleDriveClient } from "./GoogleDriveClient";
import { runInAction } from "mobx";

export async function initStudioData(modelStore: any, uvOrganizerStore: any) {
  try {
    console.log("[Studio] 🌐 Initializing direct Google Drive connection...");
    await GoogleDriveClient.ensureIndexed();

    // 1. Load curated models catalog directly from Google Drive manifest
    try {
      const manifest = await GoogleDriveClient.getJson("manifest.json");
      if (Array.isArray(manifest) && manifest.length > 0) {
        const data = manifest.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category || "TOPWEAR",
          format: "t3d",
          diskExists: true,
          t3dUrl: item.filename || `${item.id}.t3d`,
          objUrl: item.filename || `${item.id}.t3d`
        }));
        runInAction(() => {
          modelStore.curatedCatalog = data;
        });
        console.log(`[Studio] 📦 Loaded ${data.length} curated garments directly from Google Drive.`);

        // Auto load first model if none active
        if (!modelStore.currentModel && data.length > 0) {
          loadDirectModel(0, modelStore, uvOrganizerStore);
        }
      }
    } catch (e: any) {
      console.warn("[Studio] Could not load manifest directly, relying on proxy:", e.message);
    }

    // 2. Load curated fabric materials directly from Google Drive
    try {
      const materials = await GoogleDriveClient.getJson("curated_materials.json");
      if (Array.isArray(materials) && materials.length > 0) {
        runInAction(() => {
          modelStore.curatedMaterialsList = materials;
          if (!materials.some((m: any) => m.id === modelStore.selectedMaterialId)) {
            modelStore.selectedMaterialId = materials[0].id;
          }
        });
        console.log(`[Studio] 🧵 Loaded ${materials.length} fabric materials directly from Google Drive.`);
      }
    } catch (e: any) {
      console.warn("[Studio] Could not load materials directly, relying on proxy:", e.message);
    }
  } catch (err: any) {
    console.warn("[Studio] Direct Google Drive init failed:", err.message);
  }
}

export async function loadDirectModel(index: number, modelStore: any, uvOrganizerStore?: any) {
  const list = modelStore.filteredCuratedList;
  if (!list || list.length === 0) return;
  const clampedIndex = (index + list.length) % list.length;
  const item = list[clampedIndex];
  if (!item) return;

  runInAction(() => {
    modelStore.currentCuratedIndex = clampedIndex;
    modelStore.isLoadingCuratedModel = true;
    modelStore.loadingProgress = 0;
    modelStore.loadingStatusMessage = `Connecting to Google Drive...`;
  });

  try {
    const filename = item.t3dUrl || `${item.id}.t3d`;
    console.log(`[Studio] 📥 Streaming model binary for "${item.name || item.id}" directly from Drive...`);
    
    // Direct streaming with progress
    const buffer = await GoogleDriveClient.getArrayBuffer(filename, (pct, loaded, total) => {
      runInAction(() => {
        modelStore.loadingProgress = pct;
        modelStore.loadingStatusMessage = `Downloading: ${Math.round(loaded / 1024)} KB / ${Math.round(total / 1024)} KB (${pct}%)`;
      });
    });

    runInAction(() => {
      modelStore.loadingProgress = 100;
      modelStore.loadingStatusMessage = `Parsing 3D Mesh...`;
    });

    // Load from ArrayBuffer directly into viewer
    await modelStore.load(buffer, item.name || item.id);

    // Auto-fetch saved UV layout delta from Drive
    if (uvOrganizerStore && item.id) {
      const targetType = item.category === "BOTTOMWEAR" ? "BOTTOMWEAR" : "TOPWEAR";
      uvOrganizerStore.switchGarmentType?.(targetType);
      
      const savedDelta = await GoogleDriveClient.getSavedUVLayoutDelta(item.id);
      if (savedDelta) {
        const result = uvOrganizerStore.applyUVLayoutDelta(savedDelta);
        if (result.appliedCount > 0) {
          console.log(`[Studio] ⚡ Applied saved UV layout for ${item.id} (${result.appliedCount} islands restored).`);
        }
      }
      uvOrganizerStore.layoutVersion++;
    }
  } catch (err: any) {
    console.error("[Studio] Error loading model from Drive:", err);
    // Fallback to store standard load
    await modelStore.loadCuratedModelByIndex(clampedIndex, uvOrganizerStore);
  } finally {
    runInAction(() => {
      modelStore.isLoadingCuratedModel = false;
    });
  }
}
