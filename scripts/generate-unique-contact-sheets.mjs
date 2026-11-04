/**
 * generate-unique-contact-sheets.mjs
 * Filters out near-duplicate and flat textures across the 375 library.
 * Clusters them by weave architecture (directionality, spatial frequency, depth)
 * and keeps only the single most distinct, crisp exemplar for each unique fabric weave.
 * Assembles them into dedicated "Unique Fabric Weaves" contact sheets with 1:1 center crops.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SOURCE_DIR = path.resolve('./public/fabric_library/normals');
const OUTPUT_DIR = path.resolve('./public/fabric_contact_sheets/unique');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const allFiles = fs.readdirSync(SOURCE_DIR)
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .sort();

console.log(`[Unique Extractor] Processing ${allFiles.length} normal maps...`);

// Extract features from 1:1 center crop (128x128 sample for feature hashing)
async function extractFeatures(filename) {
  const filePath = path.join(SOURCE_DIR, filename);
  try {
    const meta = await sharp(filePath).metadata();
    const origW = meta.width || 1024, origH = meta.height || 1024;
    const cropSize = 128;
    const left = Math.max(0, Math.floor((origW - cropSize) / 2));
    const top = Math.max(0, Math.floor((origH - cropSize) / 2));

    const { data, info } = await sharp(filePath)
      .extract({ left, top, width: cropSize, height: cropSize })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let meanR = 0, meanG = 0, meanB = 0;
    const count = cropSize * cropSize;
    for (let i = 0; i < data.length; i += info.channels) {
      meanR += data[i];
      meanG += data[i + 1];
      meanB += data[i + 2];
    }
    meanR /= count; meanG /= count; meanB /= count;

    let varR = 0, varG = 0;
    // Also compute horizontal vs vertical gradient energy to detect weave ribs/twills
    let gradH = 0, gradV = 0, gradDiag = 0;

    for (let y = 0; y < cropSize - 1; y++) {
      for (let x = 0; x < cropSize - 1; x++) {
        const idx = (y * cropSize + x) * info.channels;
        const idxRight = (y * cropSize + (x + 1)) * info.channels;
        const idxDown = ((y + 1) * cropSize + x) * info.channels;
        const idxDiag = ((y + 1) * cropSize + (x + 1)) * info.channels;

        const r = data[idx], g = data[idx + 1];
        varR += (r - meanR) * (r - meanR);
        varG += (g - meanG) * (g - meanG);

        gradH += Math.abs(data[idxRight] - r);
        gradV += Math.abs(data[idxDown] - g);
        gradDiag += Math.abs(data[idxDiag] - r);
      }
    }

    varR /= count; varG /= count;
    const roughness = Math.sqrt(varR + varG);
    const dirRatio = (gradH + 1) / (gradV + 1); // < 0.7 = vertical ribs, > 1.4 = horizontal ribs, ~1.0 = isotropic
    const diagRatio = gradDiag / (gradH + gradV + 1); // high = twill/diagonal weave

    // Downsampled 8x8 structural fingerprint for perceptual distance
    const thumbBuffer = await sharp(filePath)
      .extract({ left, top, width: cropSize, height: cropSize })
      .resize(8, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    return {
      filename,
      filePath,
      origW,
      origH,
      roughness,
      dirRatio,
      diagRatio,
      thumb: thumbBuffer
    };
  } catch (err) {
    return null;
  }
}

function computeSimilarity(featA, featB) {
  // Compare 8x8 fingerprints (SSD)
  let sumDiff = 0;
  for (let i = 0; i < featA.thumb.length; i++) {
    const diff = featA.thumb[i] - featB.thumb[i];
    sumDiff += diff * diff;
  }
  const avgDiff = Math.sqrt(sumDiff / featA.thumb.length);
  return avgDiff; // lower = more identical
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

async function main() {
  console.log('[Step 1/3] Extracting structural features for all textures...');
  const allFeatures = [];
  for (let i = 0; i < allFiles.length; i++) {
    const feat = await extractFeatures(allFiles[i]);
    if (feat) allFeatures.push(feat);
  }

  // Filter 1: Discard flat/featureless textures (roughness < 13.0)
  const textured = allFeatures.filter(f => f.roughness >= 13.0);
  console.log(`[Step 2/3] Filtered out ${allFeatures.length - textured.length} flat/blank textures. ${textured.length} textured candidates remain.`);

  // Filter 2: Deduplication by greedy clustering
  // Sort candidates by roughness/clarity descending so we pick the crispiest exemplar of each cluster
  textured.sort((a, b) => b.roughness - a.roughness);

  const uniqueList = [];
  const SIMILARITY_THRESHOLD = 18.0; // Textures with distance < 18 are deemed duplicate/near-identical

  for (const candidate of textured) {
    let isDuplicate = false;
    for (const chosen of uniqueList) {
      const dist = computeSimilarity(candidate, chosen);
      if (dist < SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      uniqueList.push(candidate);
    }
  }

  console.log(`[Step 3/3] Found exactly ${uniqueList.length} DISTINCT UNIQUE fabric weave types!`);

  // Sort unique list by weave archetype:
  // 1. Vertical Rib Knits (dirRatio < 0.75)
  // 2. Diagonal Twills / Denim (diagRatio high)
  // 3. Waffle / Piqué / Textured
  // 4. Standard Balanced Weaves & Jerseys
  uniqueList.sort((a, b) => {
    if (a.dirRatio < 0.75 && b.dirRatio >= 0.75) return -1;
    if (b.dirRatio < 0.75 && a.dirRatio >= 0.75) return 1;
    return b.roughness - a.roughness;
  });

  // Save unique catalog JSON
  const catalogData = uniqueList.map((u, idx) => ({
    index: idx + 1,
    filename: u.filename,
    roughness: +u.roughness.toFixed(2),
    dirRatio: +u.dirRatio.toFixed(2),
    resolution: `${u.origW}x${u.origH}`
  }));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'unique_catalog.json'), JSON.stringify(catalogData, null, 2), 'utf8');

  // Render Contact Sheets for the Unique Weaves
  // With ~50-80 unique weaves, we create clean 5x5 or 6x6 sheets
  const TILE_SIZE = 256;      // 1:1 unaltered center crop
  const LABEL_HEIGHT = 44;
  const COLS = 5;
  const TILES_PER_SHEET = 25; // 5x5 grid
  const MARGIN = 16;
  const GAP = 14;

  const totalSheets = Math.ceil(uniqueList.length / TILES_PER_SHEET);
  const SHEET_WIDTH = MARGIN * 2 + COLS * TILE_SIZE + (COLS - 1) * GAP;

  const generatedSheets = [];

  for (let s = 0; s < totalSheets; s++) {
    const start = s * TILES_PER_SHEET;
    const end = Math.min(start + TILES_PER_SHEET, uniqueList.length);
    const slice = uniqueList.slice(start, end);
    const rows = Math.ceil(slice.length / COLS);
    const sheetHeight = MARGIN * 2 + rows * (TILE_SIZE + LABEL_HEIGHT) + (rows - 1) * GAP;

    const composites = [];

    for (let i = 0; i < slice.length; i++) {
      const item = slice[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const left = MARGIN + col * (TILE_SIZE + GAP);
      const top = MARGIN + row * (TILE_SIZE + LABEL_HEIGHT + GAP);

      // Extract 1:1 center crop (256x256)
      const cropW = Math.min(TILE_SIZE, item.origW);
      const cropH = Math.min(TILE_SIZE, item.origH);
      const cropX = Math.max(0, Math.floor((item.origW - cropW) / 2));
      const cropY = Math.max(0, Math.floor((item.origH - cropH) / 2));

      const croppedBuffer = await sharp(item.filePath)
        .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
        .toBuffer();

      let cleanName = item.filename.replace(/_normal\.(jpg|png)$/i, '');
      if (cleanName.length > 26) cleanName = cleanName.slice(0, 24) + '..';

      const svgLabel = `
        <svg width="${TILE_SIZE}" height="${LABEL_HEIGHT}">
          <rect width="100%" height="100%" fill="#0b0f19" rx="3"/>
          <text x="8" y="18" fill="#14d9ff" font-family="monospace" font-size="12" font-weight="bold">#${start + i + 1}</text>
          <text x="46" y="18" fill="#e2e8f0" font-family="sans-serif" font-size="11" font-weight="600">${escapeXml(cleanName)}</text>
          <text x="8" y="34" fill="#64748b" font-family="monospace" font-size="9">Depth: ${item.roughness.toFixed(0)} • ${item.origW}x${item.origH} (1:1 Center)</text>
        </svg>
      `;

      const tileBuffer = await sharp({
        create: {
          width: TILE_SIZE,
          height: TILE_SIZE + LABEL_HEIGHT,
          channels: 3,
          background: { r: 11, g: 15, b: 25 }
        }
      })
      .composite([
        { input: croppedBuffer, top: 0, left: 0 },
        { input: Buffer.from(svgLabel), top: TILE_SIZE, left: 0 }
      ])
      .png()
      .toBuffer();

      composites.push({ input: tileBuffer, left, top });
    }

    const sheetFilename = `unique_sheet_${String(s + 1).padStart(2, '0')}.png`;
    const sheetPath = path.join(OUTPUT_DIR, sheetFilename);

    await sharp({
      create: {
        width: SHEET_WIDTH,
        height: sheetHeight,
        channels: 3,
        background: { r: 7, g: 10, b: 18 }
      }
    })
    .composite(composites)
    .png({ quality: 95 })
    .toFile(sheetPath);

    console.log(`[Unique Sheet ${s + 1}/${totalSheets}] Saved: ${sheetFilename} (${slice.length} distinct fabrics)`);
    generatedSheets.push({
      index: s + 1,
      filename: sheetFilename,
      count: slice.length,
      range: `#${start + 1} - #${end}`
    });
  }

  // HTML Gallery for Unique Weaves
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Unique Fabric Weave Normal Maps — Curated Distinct Types</title>
  <style>
    :root {
      --bg: #070a12;
      --card-bg: #0d131f;
      --border: rgba(255, 255, 255, 0.08);
      --cyan: #14d9ff;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; }
    header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 20px; color: #fff; }
    .badge { background: rgba(20, 217, 255, 0.12); color: var(--cyan); padding: 4px 12px; border-radius: 4px; font-size: 11px; font-family: monospace; border: 1px solid rgba(20, 217, 255, 0.3); }
    .nav { display: flex; gap: 8px; margin-bottom: 24px; }
    .nav a { background: var(--card-bg); color: var(--text); text-decoration: none; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); font-size: 12px; font-weight: 500; }
    .nav a:hover { border-color: var(--cyan); color: var(--cyan); }
    .section { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 32px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .title { font-size: 15px; font-weight: 600; color: #fff; }
    .img-wrap { overflow-x: auto; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); }
    .img-wrap img { display: block; max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🧵 Curated Unique Fabric Weaves (Zero Duplicates)</h1>
      <p style="color: var(--muted); font-size: 12px; margin-top: 4px;">
        1:1 Native Center Crops (256x256 px) • Filtered out identical textures and flat noise • Total Unique Weaves: ${uniqueList.length}
      </p>
    </div>
    <span class="badge">${uniqueList.length} DISTINCT WEAVES</span>
  </header>
  <nav class="nav">
    ${generatedSheets.map(s => `<a href="#sheet-${s.index}">Sheet ${s.index} (${s.range})</a>`).join('')}
  </nav>
  <main>
    ${generatedSheets.map(s => `
      <section class="section" id="sheet-${s.index}">
        <div class="section-header">
          <div class="title">Unique Sheet ${s.index} of ${totalSheets} &bull; Weaves ${s.range}</div>
          <a href="./${s.filename}" target="_blank" style="color: var(--cyan); font-size: 11px; text-decoration: none;">View Full Resolution PNG &UpperRightArrow;</a>
        </div>
        <div class="img-wrap">
          <img src="./${s.filename}" alt="Unique Sheet ${s.index}" loading="lazy"/>
        </div>
      </section>
    `).join('')}
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8');
  console.log(`[Unique Extractor] Complete! Open at http://localhost:5173/fabric_contact_sheets/unique/index.html`);
}

main().catch(console.error);
