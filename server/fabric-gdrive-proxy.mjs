/**
 * fabric-gdrive-proxy.mjs
 * Production Backend Proxy for Google Drive Fabric Library and 3D Models
 *
 * Folder IDs:
 * - Fabric Library: 1WOyobE9hU5NEFvsq7fP7RFKcKydXg9q0
 * - Sportswear Models (.t3d): 1BTUc3AmbcSsKzcRv0bZiMnmddn6syc3m
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4001;
const FABRIC_FOLDER_ID = process.env.GDRIVE_FABRIC_FOLDER_ID || '1WOyobE9hU5NEFvsq7fP7RFKcKydXg9q0';
const MODELS_FOLDER_ID = process.env.GDRIVE_MODELS_FOLDER_ID || '1BTUc3AmbcSsKzcRv0bZiMnmddn6syc3m';
const MANIFEST_FILE_ID = '1dTaq_bTYaZaBhSyI-mGVgQifNGZUZZN4';
const CRED_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/vijaykc/Desktop/victorshell9391-1e11b19eb8c8.json';
const CACHE_DIR = path.resolve('./.fabric_cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let cachedAccessToken = null;
let tokenExpiresAt = 0;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  if (!fs.existsSync(CRED_PATH)) {
    throw new Error(`Missing credentials file at ${CRED_PATH}`);
  }

  const cred = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: cred.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(toSign);
  const signature = sign.sign(cred.private_key, 'base64url');
  const jwt = `${toSign}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(data));
  }
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + 3500;
  return cachedAccessToken;
}

// In-memory filename -> Drive File metadata map
const fabricIndex = new Map();
const modelsIndex = new Map();
let lastFabricIndexFetch = 0;
let lastModelsIndexFetch = 0;

async function refreshFolderIndex(folderId, targetMap) {
  const token = await getAccessToken();
  targetMap.clear();

  async function crawlFolder(fId) {
    let pageToken = null;
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `'${fId}' in parents and trashed = false`);
      url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, size)');
      url.searchParams.set('pageSize', '500');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.files) {
        for (const f of data.files) {
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            await crawlFolder(f.id);
          } else {
            targetMap.set(f.name.toLowerCase(), f);
          }
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  await crawlFolder(folderId);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;
  console.log(`[GDrive Proxy] 📥 ${req.method} ${pathname}`);

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', cachedFabric: fabricIndex.size, cachedModels: modelsIndex.size }));
    return;
  }

  // Handle Save UV Layout directly into Google Drive manifest.json (POST /api/save-uv-layout)
  if ((pathname === '/api/save-uv-layout' || pathname === '/save-uv-layout') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const delta = JSON.parse(body);
        const garmentId = delta.garmentId;
        if (!garmentId) throw new Error('Missing garmentId');

        const filename = `${garmentId}.json`;
        const jsonBuffer = Buffer.from(JSON.stringify(delta, null, 2), 'utf8');

        // Update local on-disk cache for fast access
        const cachedPath = path.join(CACHE_DIR, filename);
        fs.writeFileSync(cachedPath, jsonBuffer);

        // Fetch manifest.json from Google Drive, merge uvLayout, and PATCH back
        const token = await getAccessToken();
        const manifestRes = await fetch(`https://www.googleapis.com/drive/v3/files/${MANIFEST_FILE_ID}?alt=media&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const manifestList = await manifestRes.json();
        const item = Array.isArray(manifestList) ? manifestList.find(m => m.id === garmentId) : null;
        if (item) {
          item.uvLayout = delta;
          item.uvUpdatedAt = delta.updatedAt || new Date().toISOString();
        }

        const patchRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${MANIFEST_FILE_ID}?uploadType=media&supportsAllDrives=true`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(manifestList, null, 2)
        });

        if (!patchRes.ok) {
          const errText = await patchRes.text();
          throw new Error(`Drive manifest PATCH failed: ${errText}`);
        }

        // Invalidate manifest in cache
        const cachedManifest = path.join(CACHE_DIR, 'manifest.json');
        if (fs.existsSync(cachedManifest)) fs.unlinkSync(cachedManifest);

        console.log(`[GDrive Proxy] 💾 Saved UV layout for "${garmentId}" directly into Google Drive manifest.json`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', garmentId, savedAt: delta.updatedAt }));
      } catch (err) {
        console.error('[GDrive Proxy] UV save error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'UV save error' }));
      }
    });
    return;
  }

  // Handle Get UV Layout directly from Google Drive manifest.json (GET /api/get-uv-layout?id=...)
  if ((pathname === '/api/get-uv-layout' || pathname === '/get-uv-layout') && req.method === 'GET') {
    const garmentId = reqUrl.searchParams.get('id');
    if (!garmentId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing garmentId' }));
      return;
    }

    const filename = `${garmentId}.json`.toLowerCase();

    // 1. Check local on-disk cache first
    const cachedFilePath = path.join(CACHE_DIR, filename);
    if (fs.existsSync(cachedFilePath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(cachedFilePath).pipe(res);
      return;
    }

    // 2. Fetch from Google Drive manifest.json
    try {
      const token = await getAccessToken();
      const manifestRes = await fetch(`https://www.googleapis.com/drive/v3/files/${MANIFEST_FILE_ID}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const manifestList = await manifestRes.json();
      const item = Array.isArray(manifestList) ? manifestList.find(m => m.id === garmentId) : null;

      if (item && item.uvLayout) {
        const buf = Buffer.from(JSON.stringify(item.uvLayout, null, 2), 'utf8');
        fs.writeFileSync(cachedFilePath, buf);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(buf);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Layout not found on Drive manifest' }));
    } catch (err) {
      console.error('[GDrive Proxy] UV fetch error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const isModelReq = pathname.startsWith('/api/models_storage') || pathname.startsWith('/models_storage');
  const targetFolderId = isModelReq ? MODELS_FOLDER_ID : FABRIC_FOLDER_ID;
  const targetMap = isModelReq ? modelsIndex : fabricIndex;

  let cleanPath = pathname
    .replace(/^\/api\/fabric_library/, '')
    .replace(/^\/fabric_library/, '')
    .replace(/^\/api\/models_storage/, '')
    .replace(/^\/models_storage/, '')
    .replace(/^\/api\/data/, '')
    .replace(/^\/data/, '');

  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {}

  const rawFilename = path.basename(cleanPath);
  const filename = rawFilename.toLowerCase();
  const fileStem = path.basename(filename, path.extname(filename));

  if (!rawFilename) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Filename missing');
    return;
  }

  // 1. Check local on-disk cache
  const cachedFilePath = path.join(CACHE_DIR, filename);
  if (fs.existsSync(cachedFilePath)) {
    const ext = path.extname(filename).toLowerCase();
    const stat = fs.statSync(cachedFilePath);
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.json'
        ? 'application/json'
        : ext === '.t3d'
        ? 'application/octet-stream'
        : 'image/jpeg';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(cachedFilePath).pipe(res);
    return;
  }

  // 2. Fetch directly from Google Drive via Service Account
  try {
    const now = Date.now();
    const lastFetch = isModelReq ? lastModelsIndexFetch : lastFabricIndexFetch;
    if (now - lastFetch > 300000 || targetMap.size === 0) {
      await refreshFolderIndex(targetFolderId, targetMap);
      if (isModelReq) lastModelsIndexFetch = now;
      else lastFabricIndexFetch = now;
    }

    let driveFile = targetMap.get(filename);
    if (!driveFile) {
      for (const [name, f] of targetMap.entries()) {
        if (
          name === filename ||
          name.includes(fileStem) ||
          (fileStem.length >= 10 && name.includes(fileStem)) ||
          name.includes(filename)
        ) {
          driveFile = f;
          break;
        }
      }
    }

    if (!driveFile) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`File "${filename}" not found in Drive folder`);
      return;
    }

    const token = await getAccessToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media&supportsAllDrives=true`;

    const gRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!gRes.ok) {
      res.writeHead(gRes.status, { 'Content-Type': 'text/plain' });
      res.end(`Failed to fetch from Drive: ${gRes.statusText}`);
      return;
    }

    const buffer = Buffer.from(await gRes.arrayBuffer());
    fs.writeFileSync(cachedFilePath, buffer);

    res.writeHead(200, {
      'Content-Type': driveFile.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(buffer);
  } catch (err) {
    console.error('[GDrive Proxy Error]', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(err.message || 'Internal proxy error');
  }
});

server.listen(PORT, () => {
  console.log(`[GDrive Proxy] Running on port ${PORT}`);
  console.log(`[GDrive Proxy] Fabric Folder ID: ${FABRIC_FOLDER_ID}`);
  console.log(`[GDrive Proxy] Models Folder ID: ${MODELS_FOLDER_ID}`);
});
