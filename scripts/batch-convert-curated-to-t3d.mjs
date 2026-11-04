/**
 * batch-convert-curated-to-t3d.mjs
 * Converts all 75 curated 3D garments to Trikomi encrypted container (.t3d) format.
 *
 * Each garment directory in models_storage/ and Downloads/style3d_models/ receives:
 * - <garment_id>.t3d (AES-GCM-256 encrypted, 16-bit quantized geometry and UVs)
 * - preservation of all existing materials, metadata, and texture assets.
 */

import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { T3DPackager } from '/media/vijaykc/projects/trikomi/packages/core/src/protection/T3DPackager.ts';
import { T3DLoader } from '/media/vijaykc/projects/trikomi/packages/core/src/protection/T3DLoader.ts';

const CURATED_CATALOG_PATH = '/media/vijaykc/projects/trikomi-studio/public/data/curated_catalog.json';
const MODELS_STORAGE_DIR = '/media/vijaykc/projects/trikomi-studio/dist/models_storage';
const DOWNLOADS_DIR = '/home/vijaykc/Downloads/style3d_models';

async function main() {
  const curated = JSON.parse(fs.readFileSync(CURATED_CATALOG_PATH, 'utf8'));
  console.log(`[T3D Batch] Loaded curated catalog with ${curated.length} garments.`);

  let successCount = 0;
  let totalRawBytes = 0;
  let totalT3DBytes = 0;

  for (let i = 0; i < curated.length; i++) {
    const item = curated[i];
    const garmentId = item.id;
    const title = item.name || item.title || garmentId;

    // Target directories (both storage and downloads cache if exists)
    const targetDirs = [
      path.join(MODELS_STORAGE_DIR, garmentId),
      path.join(DOWNLOADS_DIR, garmentId)
    ].filter(d => fs.existsSync(d));

    if (targetDirs.length === 0) {
      console.warn(`[T3D Batch] [${i+1}/${curated.length}] Skipping ${garmentId}: Directory not found.`);
      continue;
    }

    const primaryDir = targetDirs[0];
    const objPath = path.join(primaryDir, `${garmentId}_thin.obj`);
    const metaPath = path.join(primaryDir, 'metadata.json');

    if (!fs.existsSync(objPath)) {
      console.warn(`[T3D Batch] [${i+1}/${curated.length}] Skipping ${garmentId}: OBJ missing at ${objPath}`);
      continue;
    }

    const objText = fs.readFileSync(objPath, 'utf8');
    totalRawBytes += objText.length;

    let materialsMeta = {};
    if (fs.existsSync(metaPath)) {
      try {
        materialsMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8')).materials || {};
      } catch (e) {
        console.warn(`[T3D Batch] Error reading metadata for ${garmentId}:`, e.message);
      }
    }

    const loader = new OBJLoader();
    const group = loader.parse(objText);

    // Attach materials and metadata
    const files = fs.readdirSync(primaryDir);
    group.traverse((child) => {
      if (child.isMesh) {
        const matName = child.material.name || '';
        const mtlInfo = materialsMeta[matName] || {};
        child.userData.materialName = matName;

        let col = 0xffffff;
        if (mtlInfo.baseColor && Array.isArray(mtlInfo.baseColor)) {
          const r = Math.round(mtlInfo.baseColor[0] * 255);
          const g = Math.round(mtlInfo.baseColor[1] * 255);
          const b = Math.round(mtlInfo.baseColor[2] * 255);
          col = (r << 16) | (g << 8) | b;
        }

        child.material = new THREE.MeshStandardMaterial({
          color: col,
          roughness: mtlInfo.roughness ?? 0.5,
          metalness: mtlInfo.metalness ?? 0.0
        });
        child.material.name = matName;

        const diffFile = files.find(f => f.startsWith(matName) && f.includes('diffuse'));
        const normFile = files.find(f => f.startsWith(matName) && f.includes('normal'));
        child.material.userData = {
          mapName: diffFile || undefined,
          normalMapName: normFile || undefined,
          normalScale: mtlInfo.normalScale !== undefined ? mtlInfo.normalScale : 1.0,
          texWidth: mtlInfo.texWidth !== undefined ? mtlInfo.texWidth : undefined,
          texHeight: mtlInfo.texHeight !== undefined ? mtlInfo.texHeight : undefined
        };
      }
    });

    // Package to .t3d
    const t3dBuffer = await T3DPackager.package(group, { enableQuantization: true });
    totalT3DBytes += t3dBuffer.byteLength;

    // Verify loading integrity
    const verifiedGroup = await T3DLoader.parse(t3dBuffer);
    if (!verifiedGroup || verifiedGroup.children.length === 0) {
      throw new Error(`Verification failed for ${garmentId}`);
    }

    // Save to all target directories
    for (const d of targetDirs) {
      const outPath = path.join(d, `${garmentId}.t3d`);
      fs.writeFileSync(outPath, Buffer.from(t3dBuffer));
    }

    // Update catalog item t3dUrl
    item.t3dUrl = `/models_storage/${garmentId}/${garmentId}.t3d`;
    item.format = 't3d';

    successCount++;
    const ratio = ((t3dBuffer.byteLength / objText.length) * 100).toFixed(1);
    console.log(`[T3D Batch] [${successCount}/${curated.length}] Converted ${garmentId} ("${title}"): ${(objText.length / 1024 / 1024).toFixed(2)}MB -> ${(t3dBuffer.byteLength / 1024 / 1024).toFixed(2)}MB (${ratio}%) [${verifiedGroup.children.length} meshes verified]`);
  }

  // Update curated_catalog.json in both public and dist
  fs.writeFileSync(CURATED_CATALOG_PATH, JSON.stringify(curated, null, 2), 'utf8');
  const distCatalog = '/media/vijaykc/projects/trikomi-studio/dist/data/curated_catalog.json';
  if (fs.existsSync(distCatalog)) {
    fs.writeFileSync(distCatalog, JSON.stringify(curated, null, 2), 'utf8');
  }

  console.log(`\n========================================`);
  console.log(`[T3D Batch Conversion Complete]`);
  console.log(`Converted: ${successCount} / ${curated.length} garments`);
  console.log(`Total OBJ Size: ${(totalRawBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Encrypted T3D Size: ${(totalT3DBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Bandwidth / Storage Savings: ${(100 - (totalT3DBytes / totalRawBytes) * 100).toFixed(1)}% reduction`);
  console.log(`Catalog updated with .t3d URLs.`);
  console.log(`========================================\n`);
}

main().catch(err => {
  console.error('[T3D Batch Error]:', err);
  process.exit(1);
});
