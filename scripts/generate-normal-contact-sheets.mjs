/**
 * generate-normal-contact-sheets.mjs
 * Generates exactly 10 high-resolution contact sheets of fabric normal maps.
 * CRITICAL RULE: ZERO SCALING / NO DOWNSCALING.
 * Extracts a 1:1 unaltered 256x256 pixel center crop from each texture
 * so the genuine weave threads and knit stitches remain 100% pixel-sharp.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SOURCE_DIR = path.resolve('./public/fabric_library/normals');
const OUTPUT_DIR = path.resolve('./public/fabric_contact_sheets');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Collect all normal map files
const allFiles = fs.readdirSync(SOURCE_DIR)
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .sort();

console.log(`[Contact Sheet Generator] Found ${allFiles.length} fabric normal maps in ${SOURCE_DIR}`);

// Target: Exactly 10 sheets
const TOTAL_SHEETS = 10;
const perSheet = Math.ceil(allFiles.length / TOTAL_SHEETS); // ~38 items per sheet

const TILE_SIZE = 256;      // 1:1 unaltered center crop (256x256 pixels)
const LABEL_HEIGHT = 44;    // Text label strip height below tile
const COLS = 6;             // 6 tiles per row
const ROWS = Math.ceil(perSheet / COLS); // ~7 rows
const MARGIN = 16;
const GAP = 12;

const SHEET_WIDTH = MARGIN * 2 + COLS * TILE_SIZE + (COLS - 1) * GAP;
const SHEET_HEIGHT = MARGIN * 2 + ROWS * (TILE_SIZE + LABEL_HEIGHT) + (ROWS - 1) * GAP;

console.log(`[Config] 10 Sheets | ${perSheet} tiles/sheet | Grid: ${COLS}x${ROWS}`);
console.log(`[Config] Sheet Canvas Resolution: ${SHEET_WIDTH} x ${SHEET_HEIGHT} px`);

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

async function createCropWithLabel(filePath, filename, globalIndex) {
  try {
    const meta = await sharp(filePath).metadata();
    const origW = meta.width || 1024;
    const origH = meta.height || 1024;

    // 1:1 CENTER CROP (NO RESIZE / NO SCALE)
    const cropW = Math.min(TILE_SIZE, origW);
    const cropH = Math.min(TILE_SIZE, origH);
    const left = Math.max(0, Math.floor((origW - cropW) / 2));
    const top = Math.max(0, Math.floor((origH - cropH) / 2));

    const croppedBuffer = await sharp(filePath)
      .extract({ left, top, width: cropW, height: cropH })
      .toBuffer();

    // Clean human-readable label
    let cleanName = filename.replace(/_normal\.(jpg|png)$/i, '');
    if (cleanName.length > 28) {
      cleanName = cleanName.slice(0, 26) + '..';
    }

    const svgLabel = `
      <svg width="${TILE_SIZE}" height="${LABEL_HEIGHT}">
        <rect width="100%" height="100%" fill="#0b0f19" rx="3"/>
        <text x="8" y="18" fill="#14d9ff" font-family="monospace" font-size="12" font-weight="bold">#${globalIndex + 1}</text>
        <text x="46" y="18" fill="#e2e8f0" font-family="sans-serif" font-size="11" font-weight="600">${escapeXml(cleanName)}</text>
        <text x="8" y="34" fill="#64748b" font-family="monospace" font-size="9">${origW}x${origH} • 1:1 Native Center</text>
      </svg>
    `;

    const labelBuffer = Buffer.from(svgLabel);

    // Combine crop and label into a single tile (256 x 300)
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
      { input: labelBuffer, top: TILE_SIZE, left: 0 }
    ])
    .png()
    .toBuffer();

    return tileBuffer;
  } catch (err) {
    console.error(`Error processing ${filename}:`, err.message);
    return null;
  }
}

async function generateSheet(sheetIndex, filesForSheet, startIndex) {
  const composites = [];

  for (let i = 0; i < filesForSheet.length; i++) {
    const filename = filesForSheet[i];
    const filePath = path.join(SOURCE_DIR, filename);
    const globalIdx = startIndex + i;

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const left = MARGIN + col * (TILE_SIZE + GAP);
    const top = MARGIN + row * (TILE_SIZE + LABEL_HEIGHT + GAP);

    const tileBuffer = await createCropWithLabel(filePath, filename, globalIdx);
    if (tileBuffer) {
      composites.push({ input: tileBuffer, left, top });
    }
  }

  const sheetNum = String(sheetIndex + 1).padStart(2, '0');
  const sheetFilename = `sheet_${sheetNum}.png`;
  const sheetPath = path.join(OUTPUT_DIR, sheetFilename);

  await sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 3,
      background: { r: 7, g: 10, b: 18 } // Dark cyber slate
    }
  })
  .composite(composites)
  .png({ quality: 95 })
  .toFile(sheetPath);

  console.log(`[Sheet ${sheetNum}/${TOTAL_SHEETS}] Generated: ${sheetFilename} (${composites.length} tiles)`);
  return sheetFilename;
}

async function main() {
  const sheetFiles = [];

  for (let s = 0; s < TOTAL_SHEETS; s++) {
    const start = s * perSheet;
    const end = Math.min(start + perSheet, allFiles.length);
    const filesForSheet = allFiles.slice(start, end);

    if (filesForSheet.length === 0) break;

    const sheetName = await generateSheet(s, filesForSheet, start);
    sheetFiles.push({
      sheetIndex: s + 1,
      filename: sheetName,
      count: filesForSheet.length,
      range: `#${start + 1} - #${end}`
    });
  }

  // Create an interactive HTML Viewer for the 10 sheets
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fabric Normal Maps — 10 Contact Sheets (1:1 Native Center Crops)</title>
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
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 { font-size: 20px; color: #fff; display: flex; align-items: center; gap: 8px; }
    .badge {
      background: rgba(20, 217, 255, 0.12);
      color: var(--cyan);
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      border: 1px solid rgba(20, 217, 255, 0.25);
    }
    .sheet-nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .sheet-nav a {
      background: var(--card-bg);
      color: var(--text);
      text-decoration: none;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    .sheet-nav a:hover {
      border-color: var(--cyan);
      color: var(--cyan);
    }
    .sheet-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 32px;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .sheet-title { font-size: 15px; font-weight: 600; color: #fff; }
    .sheet-img-wrap {
      overflow-x: auto;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .sheet-img-wrap img {
      display: block;
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🧵 Fabric Normal Maps — 10 Inspection Contact Sheets</h1>
      <p style="color: var(--muted); font-size: 12px; margin-top: 4px;">
        1:1 Native Resolution Center Crops (256x256 px) • Zero Scaling / Zero Distortion • Total Textures: ${allFiles.length}
      </p>
    </div>
    <span class="badge">10 SHEETS TOTAL</span>
  </header>

  <nav class="sheet-nav">
    ${sheetFiles.map(s => `<a href="#sheet-${s.sheetIndex}">Sheet ${s.sheetIndex} (${s.range})</a>`).join('')}
  </nav>

  <main>
    ${sheetFiles.map(s => `
      <section class="sheet-section" id="sheet-${s.sheetIndex}">
        <div class="sheet-header">
          <div class="sheet-title">Sheet ${s.sheetIndex} of 10 &bull; Tiles ${s.range} (${s.count} fabric textures)</div>
          <a href="./${s.filename}" target="_blank" style="color: var(--cyan); font-size: 11px; text-decoration: none;">Open Full Res PNG &UpperRightArrow;</a>
        </div>
        <div class="sheet-img-wrap">
          <img src="./${s.filename}" alt="Sheet ${s.sheetIndex}" loading="lazy"/>
        </div>
      </section>
    `).join('')}
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), htmlContent, 'utf8');
  console.log(`[Contact Sheet Generator] Complete! View at http://localhost:5173/fabric_contact_sheets/index.html`);
}

main().catch(console.error);
