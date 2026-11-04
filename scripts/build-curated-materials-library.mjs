/**
 * build-curated-materials-library.mjs
 * Builds the official 21-Fabric Curated Material Library:
 * - Copies matching thumbnails into public/fabric_library/curated_thumbnails/
 * - Builds public/fabric_library/curated_materials.json with complete PBR parameters
 *   (normalMap, thumbnail, roughness, metalness, normalStrength, normalRepeat, physical properties).
 */

import fs from 'fs';
import path from 'path';

const catalogPath = '/home/vijaykc/Desktop/override/fabric_library/library_catalog.json';
const sourceThumbsDir = '/home/vijaykc/Desktop/override/fabric_library/thumbnails';
const curatedNormalsDir = path.resolve('./public/fabric_library/curated_normals');
const targetThumbsDir = path.resolve('./public/fabric_library/curated_thumbnails');
const outputJsonPath = path.resolve('./public/fabric_library/curated_materials.json');

if (!fs.existsSync(targetThumbsDir)) {
  fs.mkdirSync(targetThumbsDir, { recursive: true });
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const curatedFiles = fs.readdirSync(curatedNormalsDir)
  .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
  .sort();

const curatedMaterials = [];

for (let i = 0; i < curatedFiles.length; i++) {
  const normalFile = curatedFiles[i];
  const origName = normalFile.replace(/^\d+_\s*/, '');
  const entry = catalog.find(c => c.normalMap && c.normalMap.endsWith(origName));

  if (!entry) {
    console.warn(`Could not find catalog entry for ${normalFile}`);
    continue;
  }

  // Copy thumbnail
  const thumbBase = path.basename(entry.thumbnail);
  const srcThumb = path.join(sourceThumbsDir, thumbBase);
  const destThumbFilename = `${String(i + 1).padStart(2, '0')}_${thumbBase}`;
  const destThumbPath = path.join(targetThumbsDir, destThumbFilename);

  if (fs.existsSync(srcThumb)) {
    fs.copyFileSync(srcThumb, destThumbPath);
  } else {
    console.warn(`Thumbnail missing: ${srcThumb}`);
  }

  curatedMaterials.push({
    index: i + 1,
    id: entry.id,
    name: entry.name,
    category: entry.category,
    normalMapUrl: `/fabric_library/curated_normals/${normalFile}`,
    thumbnailUrl: `/fabric_library/curated_thumbnails/${destThumbFilename}`,
    normalStrength: entry.normalStrength || 1.0,
    normalRepeat: entry.normalRepeat || [24, 24],
    roughness: entry.roughness !== undefined ? entry.roughness : 0.6,
    metalness: entry.metalness !== undefined ? entry.metalness : 0.0,
    glossiness: entry.glossiness !== undefined ? entry.glossiness : 0.4,
    physical: entry.physical || {
      className: entry.category,
      thickness: 0.5,
      weight: 200
    }
  });

  console.log(`[${i + 1}/21] "${entry.name}" (${entry.category}) -> PBR & Physical specs mapped.`);
}

fs.writeFileSync(outputJsonPath, JSON.stringify(curatedMaterials, null, 2), 'utf8');
console.log(`\nSuccessfully built Curated Material Library: ${outputJsonPath} (${curatedMaterials.length} materials)`);
