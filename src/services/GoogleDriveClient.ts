/**
 * GoogleDriveClient.ts
 * Standalone Client-Side WebCrypto Google Drive Client for Trikomi Studio.
 *
 * Runs 100% inside the browser on GitHub Pages and Localhost:
 * - Uses native WebCrypto (SubtleCrypto RSASSA-PKCS1-v1_5 SHA-256) for OAuth2 authentication.
 * - Streams models (.t3d) with download progress callbacks.
 * - Fetches fabrics and textures with client-side Blob URLs.
 * - Saves and loads UV layout deltas directly to Google Drive manifest.json without a backend proxy.
 */

const GDRIVE_CONFIG = {
  CLIENT_EMAIL: "trikomi-studio@victorshell9391.iam.gserviceaccount.com",
  MODELS_FOLDER_ID: "1BTUc3AmbcSsKzcRv0bZiMnmddn6syc3m",
  FABRIC_FOLDER_ID: "1WOyobE9hU5NEFvsq7fP7RFKcKydXg9q0",
  MANIFEST_FILE_ID: "1dTaq_bTYaZaBhSyI-mGVgQifNGZUZZN4",
  TOKEN_URL: "https://oauth2.googleapis.com/token",
  DRIVE_API_BASE: "https://www.googleapis.com/drive/v3",
  DRIVE_UPLOAD_BASE: "https://www.googleapis.com/upload/drive/v3",
  // Base64-encoded PKCS#8 DER private key
  PRIVATE_KEY_B64: "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCyTFAWPKyTSiGU" +
    "YI9XP6SUCkASHAgKtHGN/OPiDIQJg9JuFKttfjES/sPOOYCGdsxF8yFaC2ICiW+o" +
    "IPj1y5JZDDsEhcA/XrS6Efw+oslQt1pub2WZv4kAaaiuScIYcDw+6mAoQr83mDjT" +
    "5riin7SECca3+7Mubf+hNkqLdMHLj0oZ2tO36stmJh5eo/pKitqpA3Gd74yQrmu1" +
    "iEKSWs8/PL6UflFkhhTi5F/fVwlonupjjSj4g6msM4+SKlAc/jlZEG9hkvoeS+y5" +
    "Cv0mU2jHWjj1Eieatuzl35CA7qXb+Yl5MnrGm81XtodbFljvmsTFNZhJ7V4bR5M4" +
    "4N9IgecDAgMBAAECggEAGYXIW7veYvcpog5wdmeAgkXgBgzyhGsawN3X1nPpiAh8" +
    "BuX5OXiRmHZ/m6BU6uqhMyIqlAktGSUzUTiRwB2emsCgHMrzSh70dUOTKCQv99ic" +
    "nqezk4lSGI0HaGuGgpkOXAiQ2zKIIh0thVJxplXWMVB08cFF/6TKAvm9PK6UpIlm" +
    "UB/5AXPXEos1Hg1lXpa75AGcX/aKyDCb/rxI5u7MDYuZOjhq1pg2yS+miYB3ln2R" +
    "oxjahwe56oGKYvqTDt+EVybOpQRkjspYQd/GP608QvQyvqhmaIOk/bbhSOdBkN4/" +
    "mhXfETdaE5cZHoMHvKfQdZOR5u33CNhiwyxoA7opAQKBgQDrEYm2t0OR8ouMwsxS" +
    "oWcXuJweU3Bs8joJ3qrLXft1hmsniGqbJLW2NVbueLdN7st/ERzgtHdJvAlLKB9M" +
    "jdrjRE1I+Qv9ATLO9DN0oDwCJT9OvdDHvzMqYOzdku4RoeGmNVfGrZvFUfRZgl/J" +
    "ug88jHkNe02rcSRnuRpVtcp8iQKBgQDCLKzX+qBxTyhCLw64XIxDJ8akT/KIS3qG" +
    "rZkAETvCBsNvAtz/Vf9zKRVh3qWGKjjITVl/bXcHGXnjXPRvugBR0vdioQ7zRpsu" +
    "BteaS1hGnCAk71jQL/Fq3muq7lnxuzCdwwzPQ+drIDbYHhgLXGptqNXz47r4C6nE" +
    "JLEhEuAcKwKBgHBEXAVL2ZWmxUdg8by1IUuO++Dv8M3XkiiMk/200Rf8LskeueuG" +
    "yNJQ/0e9l6480ivJvIUFK8OnbrjaXLhvN487W73yU+tt2xpEPx8AOCi+KVIuDbyY" +
    "cJNY30ejmNgK/H4pE9brq22+CnmFbsIlfolofZgWv62Vx9FR8mXlAOQhAoGAGUCM" +
    "He53LSU5PBo4lNtcVmN23umSxgzi2176NdsH5XzRr780lHRPq19da4P0DNWy2sHM" +
    "cNkAkMjMZDgzhdAvuHRyPb5qXlMBXWQAaA2CZnRpbcQ+zZxejiJs6CblRZ2tfebe" +
    "5JmVIAZpe4O2ZsvW/3nkkTo9l4KUynBnJMD6qk8CgYA7e0UjbvNT5VtlOuKYUJuV" +
    "YeNSyO8pRitpG5GcfEBIV5SvySV/XboBSCQqGH0B9NBfoEncBEL/koL+2x56/Job" +
    "JVBd2Td5D2zuoQoPGgfwBh0gcA3IW4NOGswzkHoo91ZRiqe5EFGFHW9ppWtSt73o" +
    "eVOmlTg+Tpv+CyZAjV8F6Q=="
};

function base64UrlEncode(data: ArrayBuffer | Uint8Array | string): string {
  let str = "";
  if (typeof data === "string") {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    str = btoa(binary);
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export class GoogleDriveClient {
  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;
  private static cryptoKey: CryptoKey | null = null;

  private static fileCache: Map<string, { id: string; name: string; mimeType: string }> = new Map();
  private static blobUrlCache: Map<string, string> = new Map();
  private static indexPromise: Promise<void> | null = null;

  private static async getCryptoKey(): Promise<CryptoKey> {
    if (this.cryptoKey) return this.cryptoKey;
    const keyBuffer = base64ToArrayBuffer(GDRIVE_CONFIG.PRIVATE_KEY_B64);
    this.cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return this.cryptoKey;
  }

  public static async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && now < this.tokenExpiresAt - 60) {
      return this.cachedToken;
    }

    const key = await this.getCryptoKey();

    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: GDRIVE_CONFIG.CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
      aud: GDRIVE_CONFIG.TOKEN_URL,
      exp: now + 3600,
      iat: now
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaim = base64UrlEncode(JSON.stringify(claim));
    const unsignedToken = `${encodedHeader}.${encodedClaim}`;

    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsignedToken)
    );

    const signedJwt = `${unsignedToken}.${base64UrlEncode(signatureBuffer)}`;

    const res = await fetch(GDRIVE_CONFIG.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedJwt
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google OAuth2 Token Request failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in || 3600);
    return this.cachedToken!;
  }

  public static async ensureIndexed(): Promise<void> {
    if (this.fileCache.size > 0) return;
    if (this.indexPromise) return this.indexPromise;

    this.indexPromise = (async () => {
      try {
        const token = await this.getAccessToken();
        await Promise.all([
          this.crawlFolder(GDRIVE_CONFIG.MODELS_FOLDER_ID, token),
          this.crawlFolder(GDRIVE_CONFIG.FABRIC_FOLDER_ID, token)
        ]);
        console.log(`[GoogleDriveClient] ⚡ Indexed ${this.fileCache.size} files directly from Google Drive.`);
      } catch (err) {
        console.warn("[GoogleDriveClient] Indexing encountered error:", err);
      } finally {
        this.indexPromise = null;
      }
    })();

    return this.indexPromise;
  }

  private static async crawlFolder(folderId: string, token: string): Promise<void> {
    let pageToken: string | null = null;
    do {
      const url = new URL(`${GDRIVE_CONFIG.DRIVE_API_BASE}/files`);
      url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
      url.searchParams.set("fields", "nextPageToken, files(id, name, mimeType, size)");
      url.searchParams.set("pageSize", "1000");
      url.searchParams.set("supportsAllDrives", "true");
      url.searchParams.set("includeItemsFromAllDrives", "true");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) break;

      const data = await res.json();
      if (data.files) {
        for (const f of data.files) {
          if (f.mimeType === "application/vnd.google-apps.folder") {
            await this.crawlFolder(f.id, token);
          } else {
            this.fileCache.set(f.name.toLowerCase(), f);
          }
        }
      }
      pageToken = data.nextPageToken || null;
    } while (pageToken);
  }

  public static async resolveFile(filename: string): Promise<{ id: string; name: string } | null> {
    await this.ensureIndexed();
    const clean = filename.toLowerCase().trim();
    if (this.fileCache.has(clean)) {
      return this.fileCache.get(clean)!;
    }
    for (const [key, val] of this.fileCache.entries()) {
      if (key.includes(clean) || clean.includes(key)) {
        return val;
      }
    }
    return null;
  }

  public static async getFileBlobUrl(filename: string): Promise<string | null> {
    const clean = filename.toLowerCase().trim();
    if (this.blobUrlCache.has(clean)) {
      return this.blobUrlCache.get(clean)!;
    }

    const file = await this.resolveFile(filename);
    if (!file) return null;

    const token = await this.getAccessToken();
    const res = await fetch(`${GDRIVE_CONFIG.DRIVE_API_BASE}/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrlCache.set(clean, blobUrl);
    return blobUrl;
  }

  public static async getJson(filename: string): Promise<any> {
    const file = await this.resolveFile(filename);
    const fileId = file?.id || (filename.toLowerCase().includes("manifest.json") ? GDRIVE_CONFIG.MANIFEST_FILE_ID : null);
    if (!fileId) throw new Error(`File ${filename} not found in Google Drive`);

    const token = await this.getAccessToken();
    const res = await fetch(`${GDRIVE_CONFIG.DRIVE_API_BASE}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to fetch JSON ${filename}: ${res.statusText}`);
    return await res.json();
  }

  public static async getArrayBuffer(
    identifier: string,
    onProgress?: (pct: number, loaded: number, total: number) => void
  ): Promise<ArrayBuffer> {
    let fileId: string | null = null;
    if (identifier.length > 20 && !identifier.includes("/") && !identifier.includes(".")) {
      fileId = identifier;
    } else {
      const filename = identifier.split("/").pop() || identifier;
      const file = await this.resolveFile(filename);
      if (file) fileId = file.id;
    }

    if (!fileId) throw new Error(`Could not locate Drive file for "${identifier}"`);

    const token = await this.getAccessToken();
    const response = await fetch(`${GDRIVE_CONFIG.DRIVE_API_BASE}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Drive fetch failed: ${response.statusText}`);

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body || totalBytes === 0) {
      const buffer = await response.arrayBuffer();
      onProgress?.(100, buffer.byteLength, buffer.byteLength);
      return buffer;
    }

    const reader = response.body.getReader();
    let loadedBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loadedBytes += value.length;
        const pct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
        onProgress?.(pct, loadedBytes, totalBytes);
      }
    }

    const allBytes = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      allBytes.set(chunk, offset);
      offset += chunk.length;
    }
    onProgress?.(100, loadedBytes, totalBytes);
    return allBytes.buffer;
  }

  public static async saveUVLayoutDelta(delta: any): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const garmentId = delta.garmentId;
      if (!garmentId) return { success: false, error: "No garmentId in delta" };

      const getRes = await fetch(`${GDRIVE_CONFIG.DRIVE_API_BASE}/files/${GDRIVE_CONFIG.MANIFEST_FILE_ID}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!getRes.ok) throw new Error(`Failed to read manifest: ${getRes.statusText}`);

      const manifestData = await getRes.json();
      if (!Array.isArray(manifestData)) throw new Error("Manifest is not an array");

      const target = manifestData.find((item: any) => item.id === garmentId);
      if (!target) throw new Error(`Garment ${garmentId} not found in manifest`);

      target.uvLayout = delta;
      target.updatedAt = new Date().toISOString();

      const patchRes = await fetch(
        `${GDRIVE_CONFIG.DRIVE_UPLOAD_BASE}/files/${GDRIVE_CONFIG.MANIFEST_FILE_ID}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(manifestData, null, 2)
        }
      );

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Drive PATCH failed: ${patchRes.status} ${errText}`);
      }

      console.log(`[GoogleDriveClient] 💾 UV layout for ${garmentId} patched directly to Google Drive manifest!`);
      return { success: true };
    } catch (err: any) {
      console.error("[GoogleDriveClient] UV layout save error:", err);
      return { success: false, error: err.message };
    }
  }

  public static async getSavedUVLayoutDelta(garmentId: string): Promise<any | null> {
    try {
      const manifest = await this.getJson("manifest.json");
      if (Array.isArray(manifest)) {
        const item = manifest.find((m: any) => m.id === garmentId);
        if (item && item.uvLayout) return item.uvLayout;
      }
    } catch (e) {
      console.warn("[GoogleDriveClient] Could not fetch saved UV layout delta:", e);
    }
    return null;
  }
}
