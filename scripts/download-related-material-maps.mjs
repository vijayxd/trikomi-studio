import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const CURATED_MATS_PATH = path.resolve("public/fabric_library/curated_materials.json");
const ALL_METADATA_PATH = "/home/vijaykc/Desktop/override/all_fabrics_metadata.json";
const OUTPUT_DIR = path.resolve("public/fabric_library/curated_textures");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size > 0) {
      return true; // Already downloaded
    }
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[WARN] Failed to download ${url}: ${res.status}`);
    return false;
  }

  const nodeReadable = Readable.fromWeb(res.body);
  const fileStream = fs.createWriteStream(destPath);
  await pipeline(nodeReadable, fileStream);
  return true;
}

async function main() {
  console.log("🧵 Starting download of all related fabric map channels (diffuse, specular, displacement, roughness, metalness, alpha)...");

  const curatedMaterials = JSON.parse(fs.readFileSync(CURATED_MATS_PATH, "utf8"));
  const allFabrics = JSON.parse(fs.readFileSync(ALL_METADATA_PATH, "utf8"));

  const mapById = new Map();
  allFabrics.forEach(f => mapById.set(f.id, f));

  let totalDownloaded = 0;

  for (let i = 0; i < curatedMaterials.length; i++) {
    const mat = curatedMaterials[i];
    const prefix = String(mat.index).padStart(2, "0");
    const meta = mapById.get(mat.id);

    console.log(`\n[${i + 1}/${curatedMaterials.length}] Processing "${mat.name}" (${mat.category})...`);

    if (!meta || !meta.model3DViewUrl) {
      console.warn(`  Missing model3DViewUrl for ${mat.name}`);
      continue;
    }

    const res = await fetch(meta.model3DViewUrl);
    if (!res.ok) {
      console.warn(`  Failed to fetch fabric.json for ${mat.name}`);
      continue;
    }

    const fabricJson = await res.json();
    const front = fabricJson.material?.renderConfig?.front || {};
    const baseUrl = meta.model3DViewUrl.substring(0, meta.model3DViewUrl.lastIndexOf("/"));

    // Channels to inspect and download
    const channelKeys = [
      "baseColor",
      "specular",
      "displacement",
      "glossiness",
      "metalness",
      "alpha"
    ];

    if (!mat.maps) {
      mat.maps = {};
    }

    for (const channel of channelKeys) {
      const texPath = front[channel]?.texture?.path;
      if (texPath) {
        const fullUrl = baseUrl + "/" + encodeURI(texPath);
        const ext = path.extname(texPath) || ".jpg";
        const cleanMatName = mat.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        const outFileName = `${prefix}_${cleanMatName}_${channel}${ext}`;
        const outFilePath = path.join(OUTPUT_DIR, outFileName);

        const success = await downloadFile(fullUrl, outFilePath);
        if (success) {
          totalDownloaded++;
          const relUrl = `/fabric_library/curated_textures/${outFileName}`;
          mat.maps[channel] = relUrl;
          console.log(`  ✓ ${channel}: ${outFileName}`);
        }
      }
    }

    // Set baseColorValue if present
    if (meta.baseColorValue && Array.isArray(meta.baseColorValue)) {
      mat.baseColorValue = meta.baseColorValue;
    }

    // Direct diffuse map alias
    if (mat.maps.baseColor) {
      mat.diffuseMapUrl = mat.maps.baseColor;
    }
  }

  // Update curated_materials.json
  fs.writeFileSync(CURATED_MATS_PATH, JSON.stringify(curatedMaterials, null, 2));
  console.log(`\n🎉 Finished! Downloaded ${totalDownloaded} texture maps.`);
  console.log(`💾 Updated catalog: ${CURATED_MATS_PATH}`);
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
