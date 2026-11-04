/**
 * upload-curated-to-gdrive.mjs
 * Streams individual .t3d files directly into Google Drive folder 'sportswear'
 * Uses Google Service Account JWT authentication and Google Drive API v3.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CRED_PATH = '/home/vijaykc/Desktop/victorshell9391-1e11b19eb8c8.json';
const FOLDER_ID = '1BTUc3AmbcSsKzcRv0bZiMnmddn6syc3m';
const SOURCE_DIR = path.resolve('./curated_t3d_export');

if (!fs.existsSync(CRED_PATH)) {
  console.error(`Missing credentials file at ${CRED_PATH}`);
  process.exit(1);
}

const cred = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
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
  return data.access_token;
}

async function listExistingFilesInFolder(token) {
  const files = new Map();
  let pageToken = null;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${FOLDER_ID}' in parents and trashed = false`);
    url.searchParams.set('fields', 'nextPageToken, files(id, name, size)');
    url.searchParams.set('pageSize', '200');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files) {
      data.files.forEach(f => files.set(f.name, f));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

async function uploadFile(token, filePath, filename) {
  const fileBytes = fs.readFileSync(filePath);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    parents: [FOLDER_ID],
    mimeType: 'application/octet-stream'
  };

  const multipartBody = Buffer.concat([
    Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/octet-stream\r\n\r\n'
    ),
    fileBytes,
    Buffer.from(closeDelimiter)
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(multipartBody.length)
      },
      body: multipartBody
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

async function main() {
  console.log('[GDrive Uploader] Authenticating service account...');
  let token = await getAccessToken();
  console.log(`[GDrive Uploader] Successfully authenticated as ${cred.client_email}`);

  console.log(`[GDrive Uploader] Fetching existing files in folder ${FOLDER_ID}...`);
  const existingFiles = await listExistingFilesInFolder(token);
  console.log(`[GDrive Uploader] Found ${existingFiles.size} existing files in destination folder.`);

  const allFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.t3d'))
    .sort();

  console.log(`[GDrive Uploader] Found ${allFiles.length} .t3d files ready for upload.`);

  let uploadedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const filename = allFiles[i];
    const filePath = path.join(SOURCE_DIR, filename);
    const stat = fs.statSync(filePath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);

    if (existingFiles.has(filename)) {
      console.log(`[${i + 1}/${allFiles.length}] SKIP: "${filename}" already exists in Google Drive.`);
      skippedCount++;
      continue;
    }

    console.log(`[${i + 1}/${allFiles.length}] UPLOADING: "${filename}" (${sizeMb} MB)...`);
    const startTime = Date.now();

    try {
      const result = await uploadFile(token, filePath, filename);
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   -> SUCCESS! File ID: ${result.id} (${elapsedSec}s)`);
      uploadedCount++;
    } catch (err) {
      console.error(`   -> ERROR uploading ${filename}:`, err.message);
      // Try refreshing token once if 401
      if (err.message.includes('401')) {
        console.log('   Refreshing token...');
        token = await getAccessToken();
      }
    }
  }

  // Also upload manifest.json
  const manifestPath = path.join(SOURCE_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    console.log('[GDrive Uploader] Uploading manifest.json...');
    await uploadFile(token, manifestPath, 'manifest.json');
    console.log('   -> manifest.json uploaded successfully.');
  }

  console.log('----------------------------------------------------');
  console.log(`[GDrive Uploader] FINISHED! Uploaded: ${uploadedCount}, Skipped: ${skippedCount}, Total: ${allFiles.length}`);
}

main().catch(console.error);
