import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// --- Local Trikomi SDK Resolution (Matches trikomi-demo vite.config.ts) ---
const localSdkRoot = path.resolve(__dirname, '../trikomi/packages');
const localCoreEntry = path.resolve(localSdkRoot, 'core/src/index.ts');
const useLocalSdk = fs.existsSync(localCoreEntry) || process.env.USE_LOCAL_SDK === 'true';

const dynamicAlias = useLocalSdk ? {
  '@trikomi/core/8thwall': path.resolve(localSdkRoot, '8thwall/src/index.ts'),
  '@trikomi/core/sportswear': path.resolve(localSdkRoot, 'sportswear/src/index.ts'),
  '@trikomi/core/face-mocap': path.resolve(localSdkRoot, 'face-mocap/src/index.ts'),
  '@trikomi/core/eyewear': path.resolve(localSdkRoot, 'eyewear/src/index.ts'),
  '@trikomi/core/tour': path.resolve(localSdkRoot, 'tour/src/index.ts'),
  '@trikomi/core/viewer': path.resolve(localSdkRoot, 'viewer/src/index.ts'),
  '@trikomi/core/box': path.resolve(localSdkRoot, 'box/src/index.ts'),
  '@trikomi/core/studio': path.resolve(localSdkRoot, 'core/src/studio/index.ts'),
  '@trikomi/core': localCoreEntry,
  '@trikomi/sportswear': path.resolve(localSdkRoot, 'sportswear/src/index.ts'),
  'mobx': path.resolve(__dirname, 'node_modules/mobx')
} : {};

let activeTransfer = null;
let sseClients = [];

// Built-in Vite Plugin: Direct Local Bridge API
const serveSecurityTxtPlugin = () => ({
  name: 'serve-security-txt',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/packages/core/dist/security.txt') {
        const targetPath = path.resolve(__dirname, '../trikomi/packages/core/dist/security.txt');
        if (fs.existsSync(targetPath)) {
          const content = fs.readFileSync(targetPath);
          res.setHeader('Content-Type', 'text/plain');
          res.end(content);
          return;
        }
      }
      next();
    });
  }
});

function style3dBridgePlugin() {
  return {
    name: 'style3d-bridge-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Enable open CORS so style3d.ai can post directly to localhost:5173
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        if (req.url.endsWith(".hdr")) {
          res.setHeader("Content-Type", "application/octet-stream");
        }

        // Serve local filesystem files (e.g. models, textures, obj, mtl)
        if (req.url.startsWith('/api/local-file')) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetPath = urlObj.searchParams.get('path');
            if (targetPath && fs.existsSync(targetPath)) {
              const stat = fs.statSync(targetPath);
              if (stat.isFile()) {
                if (targetPath.endsWith('.obj')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                else if (targetPath.endsWith('.mtl')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                else if (targetPath.endsWith('.jpg') || targetPath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
                else if (targetPath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
                else res.setHeader('Content-Type', 'application/octet-stream');
                res.writeHead(200, { 'Content-Length': stat.size });
                fs.createReadStream(targetPath).pipe(res);
                return;
              }
            }
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'File not found' }));
          } catch (e) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: e.message }));
          }
        }

        // Endpoint to check already downloaded garments to prevent redundant downloads
        if (req.url === '/api/downloaded-assets' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          const dlDir = "/home/vijaykc/Downloads/style3d_models";
          try {
            if (!fs.existsSync(dlDir)) {
              return res.end(JSON.stringify([]));
            }
            const dirs = fs.readdirSync(dlDir);
            const downloaded = dirs.filter(d => {
              const full = path.join(dlDir, d);
              return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, `${d}_thin.obj`));
            });
            return res.end(JSON.stringify(downloaded));
          } catch (err) {
            return res.end(JSON.stringify([]));
          }
        }

        // Server-Sent Events (SSE) stream: pushes to dashboard only when a transfer occurs
        if (req.url === '/api/transfer-stream' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write(': connected\n\n');

          const client = res;
          sseClients.push(client);

          req.on('close', () => {
            sseClients = sseClients.filter(c => c !== client);
          });
          return;
        }

        if (req.url === '/api/transfer' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              activeTransfer = data;
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ status: 'ok', title: data.title, receivedAt: new Date().toISOString() }));
              console.log(`[Bridge API] Successfully received transfer: "${data.title}" from Style3D extension!`);
              try {
                fs.writeFileSync("last_transfer_debug.json", JSON.stringify({
                  title: data.title,
                  materials: data.materials,
                  objSummary: data.objText ? data.objText.split("\n").filter(l => l.startsWith("o ") || l.startsWith("usemtl ")) : []
                }, null, 2));
                console.log("[Bridge API] Wrote last_transfer_debug.json");
              } catch (e) {}

              // Push instantly to dashboard via SSE (Zero polling needed!)
              const msg = `data: ${JSON.stringify(data)}\n\n`;
              sseClients.forEach(client => {
                try {
                  client.write(msg);
                } catch (e) {}
              });

              // Automatically save assets to disk for the sportswear library (System Downloads folder exclusively)
              try {
                const assetId = data.id || "garment_" + Date.now();
                const targetDir = path.resolve("/home/vijaykc/Downloads/style3d_models", assetId);

                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

                // Write OBJ
                if (data.objText) {
                  const objFilename = `${assetId}_thin.obj`;
                  fs.writeFileSync(path.join(targetDir, objFilename), data.objText, "utf8");
                }

                // Write MTL and decode textures
                if (data.materials) {
                  let mtlText = `# Material Definition for ${assetId}\n`;
                  for (const [matName, mat] of Object.entries(data.materials)) {
                    mtlText += `\nnewmtl ${matName}\n`;
                    if (mat.baseColor && Array.isArray(mat.baseColor)) {
                      mtlText += `Kd ${mat.baseColor.join(" ")}\n`;
                    }
                    if (typeof mat.roughness === "number") {
                      mtlText += `Pr ${mat.roughness.toFixed(4)}\n`;
                    }
                    if (typeof mat.metalness === "number") {
                      mtlText += `Pm ${mat.metalness.toFixed(4)}\n`;
                    }

                    // Save diffuse texture
                    if (mat.diffDataUrl && mat.diffDataUrl.startsWith("data:image/")) {
                      const ext = mat.diffDataUrl.includes("image/jpeg") || mat.diffDataUrl.includes("image/jpg") ? "jpg" : "png";
                      const diffFile = `${matName}_diffuse.${ext}`;
                      const base64Data = mat.diffDataUrl.split(",")[1];
                      if (base64Data) {
                        const buf = Buffer.from(base64Data, "base64");
                        fs.writeFileSync(path.join(targetDir, diffFile), buf);
                        mtlText += `map_Kd ${diffFile}\n`;
                      }
                    }

                    // Save normal texture
                    if (mat.normDataUrl && mat.normDataUrl.startsWith("data:image/")) {
                      const ext = mat.normDataUrl.includes("image/jpeg") || mat.normDataUrl.includes("image/jpg") ? "jpg" : "png";
                      const normFile = `${matName}_normal.${ext}`;
                      const base64Data = mat.normDataUrl.split(",")[1];
                      if (base64Data) {
                        const buf = Buffer.from(base64Data, "base64");
                        fs.writeFileSync(path.join(targetDir, normFile), buf);
                        mtlText += `map_Bump ${normFile}\n`;
                      }
                    }
                  }

                  const mtlFilename = `${assetId}_thin.mtl`;
                  fs.writeFileSync(path.join(targetDir, mtlFilename), mtlText, "utf8");
                  fs.writeFileSync(path.join(targetDir, "metadata.json"), JSON.stringify({
                    id: assetId,
                    title: data.title,
                    isThin: data.isThin,
                    materials: data.materials,
                    receivedAt: new Date().toISOString()
                  }, null, 2), "utf8");
                  console.log(`[Bridge API] Saved thin OBJ, MTL, textures to /home/vijaykc/Downloads/style3d_models/${assetId}`);
                }
              } catch (saveErr) {
                console.error("[Bridge API] Error saving assets to disk:", saveErr);
              }
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/transfer' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          const toSend = activeTransfer || { status: 'idle' };
          activeTransfer = null;
          res.end(JSON.stringify(toSend));
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: dynamicAlias
  },
  define: {
    'process.env.SECURITY_CODE': '""',
    'process.env': {}
  },
  optimizeDeps: {
    exclude: ['@jitl/quickjs-wasmfile-release-sync']
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr', '**/*.exr', '**/*.obj'],
  plugins: [react(), style3dBridgePlugin(), ...(useLocalSdk ? [serveSecurityTxtPlugin()] : [])],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        catalog: path.resolve(__dirname, 'catalog.html'),
      },
    },
  },
});
