import initSqlJs, { Database, SqlJsStatic } from "sql.js";

// Database name for IndexedDB backing storage of the SQLite .db binary
const IDB_NAME = "Style3D_SQLite_Storage";
const IDB_STORE = "sqlite_file";
const DB_KEY = "garment_database.sqlite";

export interface GarmentConfigRecord {
  modelHash: string;
  title: string;
  garmentType: string;
  triangles: number;
  piecesCount: number;
  zoneAssignmentsJson: string; // Map of pieceName -> zoneId
  updatedAt: string;
}

class SQLitePersistenceService {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private isInitializing = false;
  private initPromise: Promise<Database> | null = null;

  async getDatabase(): Promise<Database> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.isInitializing = true;
      try {
        this.SQL = await initSqlJs({
          locateFile: () => "/sql-wasm.wasm"
        });

        // Load existing binary from IndexedDB if present
        const savedData = await this.loadBinaryFromIndexedDB();
        if (savedData && savedData.byteLength > 0) {
          this.db = new this.SQL.Database(new Uint8Array(savedData));
          console.log("[SQLite] Loaded existing SQLite database from IndexedDB.");
        } else {
          this.db = new this.SQL.Database();
          console.log("[SQLite] Initialized brand-new SQLite database in WASM memory.");
        }

        // Create table schema if not exists
        this.initSchema();
        this.isInitializing = false;
        return this.db;
      } catch (err) {
        this.isInitializing = false;
        console.error("[SQLite] Error initializing SQLite WASM:", err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  private initSchema() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS garment_configs (
        model_hash TEXT PRIMARY KEY,
        title TEXT,
        garment_type TEXT,
        triangles INTEGER,
        pieces_count INTEGER,
        zone_assignments JSON,
        updated_at TEXT
      );
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_garment_hash ON garment_configs(model_hash);
    `);
    this.persistToIndexedDB();
  }

  // Generate SHA-256 Checksum Hash for a 3D model
  async computeModelHash(vertexPositions: Float32Array | number[]): Promise<string> {
    try {
      const f32 = vertexPositions instanceof Float32Array 
        ? vertexPositions 
        : new Float32Array(vertexPositions);

      // Sample first 10,000 floats + total byte count to compute ultra-fast unique fingerprint
      const count = Math.min(f32.length, 10000);
      const sampleArrayBuffer = new ArrayBuffer(count * 4);
      const sampleView = new Float32Array(sampleArrayBuffer);
      for (let i = 0; i < count; i++) {
        sampleView[i] = f32[i];
      }

      const hashBuffer = await crypto.subtle.digest("SHA-256", sampleArrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 16)}_${vertexPositions.length / 3}v`;
    } catch {
      // Fallback fingerprint
      return `hash_${vertexPositions.length}_${Date.now()}`;
    }
  }

  // Check if configuration already exists for this 3D model
  async getConfigByHash(modelHash: string): Promise<GarmentConfigRecord | null> {
    const db = await this.getDatabase();
    const stmt = db.prepare("SELECT * FROM garment_configs WHERE model_hash = :hash LIMIT 1");
    try {
      stmt.bind({ ":hash": modelHash });
      if (stmt.step()) {
        const row = stmt.getAsObject() as {
          model_hash: string;
          title: string;
          garment_type: string;
          triangles: number;
          pieces_count: number;
          zone_assignments: string;
          updated_at: string;
        };
        return {
          modelHash: row.model_hash,
          title: row.title,
          garmentType: row.garment_type,
          triangles: Number(row.triangles),
          piecesCount: Number(row.pieces_count),
          zoneAssignmentsJson: row.zone_assignments,
          updatedAt: row.updated_at
        };
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  // Save or update garment configuration in SQLite
  async saveConfig(record: GarmentConfigRecord): Promise<void> {
    const db = await this.getDatabase();
    const query = `
      INSERT INTO garment_configs (
        model_hash, title, garment_type, triangles, pieces_count, zone_assignments, updated_at
      ) VALUES (
        :model_hash, :title, :garment_type, :triangles, :pieces_count, :zone_assignments, :updated_at
      )
      ON CONFLICT(model_hash) DO UPDATE SET
        title = excluded.title,
        garment_type = excluded.garment_type,
        triangles = excluded.triangles,
        pieces_count = excluded.pieces_count,
        zone_assignments = excluded.zone_assignments,
        updated_at = excluded.updated_at;
    `;

    db.run(query, {
      ":model_hash": record.modelHash,
      ":title": record.title,
      ":garment_type": record.garmentType,
      ":triangles": record.triangles,
      ":pieces_count": record.piecesCount,
      ":zone_assignments": record.zoneAssignmentsJson,
      ":updated_at": record.updatedAt
    });

    console.log(`[SQLite] Persisted garment configuration for hash: ${record.modelHash} (Title: ${record.title})`);
    await this.persistToIndexedDB();
  }

  // Export all saved garment configurations from SQLite
  async getAllConfigs(): Promise<GarmentConfigRecord[]> {
    const db = await this.getDatabase();
    const stmt = db.prepare("SELECT * FROM garment_configs ORDER BY updated_at DESC");
    const results: GarmentConfigRecord[] = [];
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          model_hash: string;
          title: string;
          garment_type: string;
          triangles: number;
          pieces_count: number;
          zone_assignments: string;
          updated_at: string;
        };
        results.push({
          modelHash: row.model_hash,
          title: row.title,
          garmentType: row.garment_type,
          triangles: Number(row.triangles),
          piecesCount: Number(row.pieces_count),
          zoneAssignmentsJson: row.zone_assignments,
          updatedAt: row.updated_at
        });
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  // --- IndexedDB Backing Storage for SQLite binary file ---
  private persistToIndexedDB(): Promise<void> {
    if (!this.db) return Promise.resolve();
    const binary = this.db.export();

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const idb = req.result;
        const tx = idb.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put(binary.buffer, DB_KEY);
        tx.oncomplete = () => {
          idb.close();
          resolve();
        };
        tx.onerror = () => {
          idb.close();
          reject(tx.error);
        };
      };
      req.onerror = () => reject(req.error);
    });
  }

  private loadBinaryFromIndexedDB(): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const idb = req.result;
        const tx = idb.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get(DB_KEY);
        getReq.onsuccess = () => {
          idb.close();
          resolve((getReq.result as ArrayBuffer) || null);
        };
        getReq.onerror = () => {
          idb.close();
          reject(getReq.error);
        };
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const sqliteService = new SQLitePersistenceService();
