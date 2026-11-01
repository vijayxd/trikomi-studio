import { makeAutoObservable, runInAction } from "mobx";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptSimplifier } from "three/examples/jsm/libs/meshopt_simplifier.module.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { 
  GarmentPiece, 
  FabricCatalogItem, 
  ModelMetadata, 
  MigratedRegistryItem,
  IncomingMaterialInfo,
  RawMeshData,
  TransferPayload,
  MapAuditEntry
} from "../types/garment";
import { sqliteService, GarmentConfigRecord } from "../services/sqliteService";

export interface CuratedGarmentItem {
  id: string;
  name: string;
  category: "TOPWEAR" | "BOTTOMWEAR" | "SUIT";
  objUrl: string;
  diskExists: boolean;
}

class ModelStore {
  // Migration Registry
  migratedItems: MigratedRegistryItem[] = [];

  // Curated Garment Catalog for Direct Audit & Switching
  curatedCatalog: CuratedGarmentItem[] = [];
  curatedCategoryFilter: "ALL" | "TOPWEAR" | "BOTTOMWEAR" = "TOPWEAR";
  currentCuratedIndex: number = -1;
  isLoadingCuratedModel: boolean = false;
  autoLitmusTextureEnabled: boolean = true;
  loadedLitmusTextures: Map<string, THREE.Texture> = new Map();

  // Fabric Catalog (loaded from public/data/fabrics_catalog.json)
  catalog: FabricCatalogItem[] = [];
  catalogMap = new Map<string, FabricCatalogItem>(); // id or textureUrl -> fabric item
  catalogByName = new Map<string, FabricCatalogItem>(); // name -> fabric item

  // Review Status Registry (Persisted to localStorage: "passed" | "needs_review")
  reviewStatusMap: Record<string, "passed" | "needs_review"> = {};

  initReviewStatus() {
    try {
      const stored = localStorage.getItem("garment_litmus_review_status");
      if (stored) {
        this.reviewStatusMap = JSON.parse(stored);
      }
    } catch {
      this.reviewStatusMap = {};
    }
  }

  saveReviewStatus() {
    try {
      localStorage.setItem("garment_litmus_review_status", JSON.stringify(this.reviewStatusMap));
    } catch {}
  }

  getCurrentModelReviewStatus(): "passed" | "needs_review" | "unreviewed" {
    const list = this.filteredCuratedList;
    const current = list[this.currentCuratedIndex];
    if (!current) return "unreviewed";
    return this.reviewStatusMap[current.id] || "unreviewed";
  }

  markCurrentModelReview(status: "passed" | "needs_review") {
    const list = this.filteredCuratedList;
    const current = list[this.currentCuratedIndex];
    if (!current) return;
    const nextStatus = this.reviewStatusMap[current.id] === status ? undefined : status;
    if (nextStatus) {
      this.reviewStatusMap[current.id] = nextStatus;
    } else {
      delete this.reviewStatusMap[current.id];
    }
    this.saveReviewStatus();
  }

  get reviewStats(): { passed: number; needsReview: number; total: number } {
    const list = this.filteredCuratedList;
    let passed = 0;
    let needsReview = 0;
    list.forEach(item => {
      const s = this.reviewStatusMap[item.id];
      if (s === "passed") passed++;
      else if (s === "needs_review") needsReview++;
    });
    return { passed, needsReview, total: list.length };
  }

  // Current Active Garment Model
  currentModel: THREE.Group | null = null;
  modelMeta: ModelMetadata = {
    title: "",
    triangles: 0,
    vertices: 0,
    piecesCount: 0,
    missingMaps: [],
    matchedMaps: [],
    isThin: false,
    mode: "standard",
    totalPackedMaps: 0,
    totalCatalogMatches: 0
  };

  // Surface Selection & Finetuning
  selectedPiece: GarmentPiece | null = null; // Primary selected THREE.Mesh piece
  selectedPieceIds: string[] = []; // Multiple selected piece IDs (Shift / Cmd multi-selection)
  hoveredPieceId: string | null = null; // Live hovered pattern piece (2D UV or 3D viewport)
  pieces: GarmentPiece[] = [];
  shadingMode: "render" | "selection" | "uv_grid" | "wireframe" = "selection";
  wireframeMode = false;
  transparentAssignedMode = false; // When true, assigned panels are rendered semi-transparent (opacity 0.55)
  isWizardActive = false; // Fast Guided Assignment Wizard
  uvGridMode = false; // UV Tile Checkerboard debug mode
  viewMode = "shaded"; // "shaded" | "matcap" | "wireframe" | "uv_debug"
  onResize: (() => void) | null = null;

  setHoveredPieceId(id: string | null) {
    if (this.hoveredPieceId !== id) {
      this.hoveredPieceId = id;
      this.updateAssignedTransparency();
    }
  }

  isPieceSelected(pieceId: string): boolean {
    return this.selectedPieceIds.includes(pieceId) || this.selectedPiece?.id === pieceId;
  }

  togglePieceSelection(mesh: THREE.Mesh, multiSelect = false) {
    const found = this.pieces.find(p => p.mesh === mesh);
    if (!found) return;

    if (multiSelect) {
      if (this.selectedPieceIds.includes(found.id)) {
        this.selectedPieceIds = this.selectedPieceIds.filter(id => id !== found.id);
        if (this.selectedPiece?.id === found.id) {
          const nextId = this.selectedPieceIds[0];
          this.selectedPiece = nextId ? (this.pieces.find(p => p.id === nextId) || null) : null;
        }
      } else {
        this.selectedPieceIds.push(found.id);
        this.selectedPiece = found;
      }
    } else {
      this.selectedPiece = found;
      this.selectedPieceIds = [found.id];
    }
    this.updateAssignedTransparency();
  }

  selectAllPiecesInZone(zoneId: string) {
    const matching = this.pieces.filter(p => p.assignedZoneId === zoneId);
    if (matching.length > 0) {
      this.selectedPieceIds = matching.map(p => p.id);
      this.selectedPiece = matching[0];
      this.updateAssignedTransparency();
    }
  }

  // Studio Lighting & Render Setup
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  controls: OrbitControls | null = null;
  canvasContainer: HTMLElement | null = null;
  pmremGenerator: THREE.PMREMGenerator | null = null;
  resizeObserver: ResizeObserver | null = null;

  // Style3D HDRI & Lighting Presets
  currentHdri = "hdr0"; // "hdr0" (Default Style3D Studio) | "hdr1" | "hdr2" | "neutral"
  envIntensity = 1.0;
  exposure = 1.0;
  backgroundColor = "#181c27"; // Sleek Style3D dark canvas

  setBackgroundColor(hex: string) {
    this.backgroundColor = hex;
    if (this.scene) {
      this.scene.background = new THREE.Color(hex);
    }
  }

  constructor() {
    makeAutoObservable(this);
    this.initRegistry();
    this.initReviewStatus();
    this.initBroadcastReceiver();
    this.loadCatalog();
    this.loadCuratedCatalog();
  }

  // 1. Initialize Migration Registry from LocalStorage
  initRegistry() {
    try {
      const stored = localStorage.getItem("style3d_migration_registry");
      if (stored) {
        this.migratedItems = JSON.parse(stored);
      }
    } catch {
      this.migratedItems = [];
    }
  }

  saveRegistry() {
    try {
      localStorage.setItem("style3d_migration_registry", JSON.stringify(this.migratedItems));
    } catch { }
  }

  isAlreadyMigrated(id: string, title: string): boolean {
    return this.migratedItems.some(item => item.id === id || (item.title === title && title !== ""));
  }

  registerMigrated(item: { id?: string; title: string }) {
    if (!this.isAlreadyMigrated(item.id || "", item.title)) {
      this.migratedItems.unshift({
        id: item.id || Date.now().toString(),
        title: item.title,
        timestamp: new Date().toISOString(),
        triangles: this.modelMeta.triangles,
        piecesCount: this.modelMeta.piecesCount
      });
      this.saveRegistry();
    }
  }

  // 2. Load the Local 5,846 Fabric Catalog
  async loadCatalog() {
    try {
      const res = await fetch("/data/fabrics_catalog.json");
      if (res.ok) {
        const data: FabricCatalogItem[] = await res.json();
        runInAction(() => {
          this.catalog = data;
          this.catalogMap.clear();
          this.catalogByName.clear();
          data.forEach(item => {
            this.catalogMap.set(item.id, item);
            if (item.name) {
              const raw = item.name.toLowerCase().trim();
              const underscored = raw.replace(/[/\\?%*:|"<> \s]/g, "_");
              const alphaOnly = raw.replace(/[^a-z0-9]/g, "");
              this.catalogByName.set(raw, item);
              this.catalogByName.set(underscored, item);
              this.catalogByName.set(alphaOnly, item);
            }
            if (item.normalTextureUrl) this.catalogMap.set(item.normalTextureUrl, item);
          });
        });
        console.log(`[Store] Loaded ${data.length} fabric catalog items into memory.`);
      }
    } catch (e) {
      console.warn("Could not load fabric catalog:", e);
    }
  }

  // 3. In-Browser Instant Communication with Style3D Extension
  lastTransferId: string | null = null;
  isProcessingTransfer = false;
  receiverInitialized = false;

  initBroadcastReceiver() {
    if (this.receiverInitialized) return;
    this.receiverInitialized = true;

    // 1. In-browser BroadcastChannel (when in same origin/context)
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("style3d_transfer_bus");
        channel.onmessage = (event: MessageEvent<{ type?: string; payload?: TransferPayload }>) => {
          if (event.data && event.data.type === "STYLE3D_MESH_TRANSFER" && event.data.payload) {
            this.handleExtensionTransfer(event.data.payload);
          }
        };
      } catch { }
    }

    // 2. Persistent Server-Sent Events (Zero Polling, Zero Network Tab Loop!)
    if (typeof EventSource !== "undefined") {
      try {
        const evtSource = new EventSource("/api/transfer-stream");
        evtSource.onmessage = (event: MessageEvent<string>) => {
          if (!event.data) return;
          try {
            const data: TransferPayload = JSON.parse(event.data);
            if (data && data.id && data.id !== this.lastTransferId && data.objText) {
              this.lastTransferId = data.id;
              console.log(`[Store] Received transfer via SSE Stream: "${data.title}" (ID: ${data.id})`);
              this.handleExtensionTransfer(data);
            }
          } catch (err) {
            console.error("[Store] Error parsing incoming transfer event:", err);
          }
        };
        evtSource.onerror = () => {
          // EventSource will automatically reconnect if disconnected
        };
      } catch (e) {
        console.warn("[Store] SSE stream setup failed:", e);
      }
    }
  }

  // Handle direct transfer payload from extension without file download
  handleExtensionTransfer(payload: TransferPayload) {
    if (!payload) return;
    const { title, rawMeshes, objText, materials, isThin, mode, detectedLocalCatalogCount, dedicatedStyle3dMapCount } = payload;

    if (this.isProcessingTransfer) {
      console.warn("[Store] Already processing a transfer, skipping duplicate invocation.");
      return;
    }

    this.isProcessingTransfer = true;
    const directCount = Array.isArray(rawMeshes) ? rawMeshes.length : 0;
    console.log(`[Store] Processing transfer: "${title}", Direct Meshes: ${directCount}, OBJ length: ${objText ? objText.length : 0}, Catalog Maps: ${detectedLocalCatalogCount || 0}, Dedicated Maps: ${dedicatedStyle3dMapCount || 0}`);

    try {
      if (Array.isArray(rawMeshes) && rawMeshes.length > 0) {
        console.log(`%c[Store] ⚡ Using Direct In-Memory Mesh Transfer (${rawMeshes.length} meshes)!`, "color: #10b981; font-weight: bold; font-size: 13px;");
        this.loadDirectMeshes(rawMeshes, title || "Style3D Garment", materials || {}, {
          isThin: isThin,
          mode: mode,
          detectedLocalCatalogCount: detectedLocalCatalogCount,
          dedicatedStyle3dMapCount: dedicatedStyle3dMapCount
        });
      } else if (objText && objText.length > 50) {
        this.loadObjString(objText, title || "Style3D Garment", materials || {}, {
          isThin: isThin,
          mode: mode,
          detectedLocalCatalogCount: detectedLocalCatalogCount,
          dedicatedStyle3dMapCount: dedicatedStyle3dMapCount
        });
      }
    } finally {
      this.isProcessingTransfer = false;
    }
  }

  // 4. Three.js Scene Setup (Pure Three.js, No R3F)
  initThree(container: HTMLElement) {
    if (!container) return;
    this.canvasContainer = container;

    const width = container.clientWidth || (window.innerWidth - 680) || 800;
    const height = container.clientHeight || (window.innerHeight - 60) || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.backgroundColor);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);
    this.camera.position.set(0, 0, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = "";
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // PMREM Generator & Style3D HDRI Environment
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.loadHdri(this.currentHdri);

    // Direct 3D Raycaster: Click pattern in 3D scene to select it instantly
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
      const dom = this.renderer?.domElement;
      if (!dom || !this.camera || !this.currentModel) return;

      const rect = dom.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const intersects = raycaster.intersectObjects(this.currentModel.children, true);
      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        if (hitObj instanceof THREE.Mesh) {
          const piece = this.pieces.find(p => p.mesh === hitObj);
          this.setHoveredPieceId(piece ? piece.id : null);
          return;
        }
      }
      this.setHoveredPieceId(null);
    });

    this.renderer.domElement.addEventListener("pointerleave", () => {
      this.setHoveredPieceId(null);
    });

    this.renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
      const dom = this.renderer?.domElement;
      if (!dom || !this.camera) return;

      const rect = dom.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      if (this.currentModel) {
        const intersects = raycaster.intersectObjects(this.currentModel.children, true);
        if (intersects.length > 0) {
          const hitObj = intersects[0].object;
          if (hitObj instanceof THREE.Mesh) {
            runInAction(() => {
              this.togglePieceSelection(hitObj, event.shiftKey || event.metaKey);
            });
          }
        } else {
          runInAction(() => {
            this.deselectPiece();
          });
        }
      }
    });

    // Resize Handler
    this.onResize = () => {
      if (!this.canvasContainer || !this.renderer || !this.camera) return;
      const w = this.canvasContainer.clientWidth;
      const h = this.canvasContainer.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    window.addEventListener("resize", this.onResize);

    // ResizeObserver watches the actual canvas container element whenever layout/sidebars change
    if (window.ResizeObserver && this.canvasContainer) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize?.();
      });
      this.resizeObserver.observe(this.canvasContainer);
    }

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (this.controls) {
        this.controls.update();
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  // Style3D HDRI Loader & Studio Environment Controls
  loadHdri(hdriId: string) {
    if (!this.renderer || !this.scene || !this.pmremGenerator) return;
    this.currentHdri = hdriId;

    const hdrLoader = new HDRLoader();
    const hdriPath = `/hdri/${hdriId}.hdr`;

    console.log(`[Store] Loading Style3D Studio HDRI: ${hdriPath}`);
    hdrLoader.load(
      hdriPath,
      (texture) => {
        if (!this.pmremGenerator || !this.scene) return;
        const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
        this.scene.environment = envMap;
        if (this.scene.environment) {
          this.scene.environmentIntensity = this.envIntensity;
        }
        if (this.currentModel) {
          this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.envMapIntensity = this.envIntensity;
              child.material.needsUpdate = true;
            }
          });
        }
        texture.dispose();
        console.log(`%c[Store] ✨ Style3D Studio HDRI (${hdriId}) applied!`, "color: #10b981; font-weight: bold;");
      },
      undefined,
      (err) => console.warn(`[Store] HDRI load failed:`, err)
    );
  }

  setEnvIntensity(val: number) {
    this.envIntensity = Math.max(0, Math.min(3, val));
    if (this.scene && this.scene.environment) {
      this.scene.environmentIntensity = this.envIntensity;
    }
    if (this.currentModel) {
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.envMapIntensity = this.envIntensity;
          child.material.needsUpdate = true;
        }
      });
    }
  }

  setExposure(val: number) {
    this.exposure = Math.max(0.1, Math.min(3, val));
    if (this.renderer) {
      this.renderer.toneMappingExposure = this.exposure;
    }
  }

  togglePieceVisibility(pieceId: string) {
    const p = this.pieces.find(item => item.id === pieceId);
    if (p) {
      p.visible = p.visible === false ? true : false;
      if (p.mesh) {
        p.mesh.visible = p.visible;
      }
    }
  }

  toggleAllPiecesVisibility() {
    const anyVisible = this.pieces.some(p => p.visible !== false);
    const targetState = !anyVisible;
    this.pieces.forEach(p => {
      p.visible = targetState;
      if (p.mesh) {
        p.mesh.visible = targetState;
      }
    });
  }

  // Toggle semi-transparent mode for assigned panels
  toggleTransparentAssigned() {
    this.transparentAssignedMode = !this.transparentAssignedMode;
    this.updateAssignedTransparency();
  }

  // Deselect active pattern (e.g. clicking on empty space)
  deselectPiece(force = false) {
    // When in speed-run / guided wizard mode, do not deselect on empty space click.
    // The mode and active piece focus remain locked until Esc or close button is clicked!
    if (this.isWizardActive && !force) return;
    this.selectedPiece = null;
    this.selectedPieceIds = [];
    this.updateAssignedTransparency();
  }

  // Set explicit Blender-style Viewport Shading Mode
  setShadingMode(mode: "render" | "selection" | "uv_grid" | "wireframe") {
    this.shadingMode = mode;
    this.wireframeMode = (mode === "wireframe");

    // Apply or remove wireframe
    if (this.currentModel) {
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.wireframe = this.wireframeMode;
        }
      });
    }

    // Apply or remove UV Grid texture
    if (mode === "uv_grid") {
      const tileTex = this.getUVTileTexture();
      this.pieces.forEach(p => {
        if (!p.material) return;
        if (p.material.userData.originalMap === undefined) {
          p.material.userData.originalMap = p.material.map || null;
          p.material.userData.originalColor = p.material.color.clone();
        }
        p.material.map = tileTex;
        p.material.color.setRGB(1, 1, 1);
        p.material.needsUpdate = true;
      });
    } else {
      // Revert UV tile texture if switching away
      this.pieces.forEach(p => {
        if (!p.material) return;
        if (p.material.userData.originalMap !== undefined) {
          p.material.map = p.material.userData.originalMap;
        }
        if (p.material.userData.originalColor) {
          p.material.color.copy(p.material.userData.originalColor);
        }
        p.material.needsUpdate = true;
      });
    }

    this.updateAssignedTransparency();
  }

  // Update material appearance based on selection, assigned ghosting, and shading mode
  updateAssignedTransparency() {
    this.pieces.forEach(p => {
      if (!p.material) return;

      const isSelected = this.isPieceSelected(p.id);
      const isHovered = this.hoveredPieceId === p.id;
      const isAssigned = !!p.assignedZoneId;

      // In pure "render" mode (when NOT actively running speedrun wizard)
      if (this.shadingMode === "render" && !this.isWizardActive) {
        if (isSelected) {
          p.material.emissive = new THREE.Color("#ef4444");
          p.material.emissiveIntensity = 0.45;
        } else if (isHovered) {
          p.material.emissive = new THREE.Color("#38bdf8");
          p.material.emissiveIntensity = 0.4;
        } else {
          p.material.emissive = new THREE.Color(0x000000);
          p.material.emissiveIntensity = 0.0;
        }
        p.material.transparent = false;
        p.material.opacity = 1.0;
        p.material.depthWrite = true;
        p.material.needsUpdate = true;
        return;
      }

      if (isSelected) {
        // Active selected pattern: Glows vibrant red so it stands out immediately in 3D
        p.material.transparent = false;
        p.material.opacity = 1.0;
        p.material.depthWrite = true;
        p.material.emissive = new THREE.Color("#ef4444");
        p.material.emissiveIntensity = 0.55;
      } else if (isHovered) {
        // Live hovered pattern from 2D UV or 3D cursor: Neon cyan glow
        p.material.transparent = false;
        p.material.opacity = 1.0;
        p.material.depthWrite = true;
        p.material.emissive = new THREE.Color("#38bdf8");
        p.material.emissiveIntensity = 0.45;
      } else {
        // Clear emissive highlight
        p.material.emissive = new THREE.Color(0x000000);
        p.material.emissiveIntensity = 0.0;

        if (this.transparentAssignedMode && isAssigned) {
          p.material.transparent = true;
          p.material.opacity = 0.55;
          p.material.depthWrite = false;
        } else {
          p.material.transparent = false;
          p.material.opacity = 1.0;
          p.material.depthWrite = true;
        }
      }
      p.material.needsUpdate = true;
    });
  }

  // Assign a canonical zone to a piece
  assignZoneToPiece(pieceId: string, zoneId: string | null) {
    const p = this.pieces.find(item => item.id === pieceId);
    if (p) {
      p.assignedZoneId = zoneId;
      if (this.transparentAssignedMode) {
        this.updateAssignedTransparency();
      }
      this.persistGarmentConfigToSQLite();
    }
  }

  // Persist current model assignments and metadata into persistent SQLite (IndexedDB backed)
  async persistGarmentConfigToSQLite(): Promise<void> {
    const hash = this.modelMeta.modelHash;
    if (!hash || this.pieces.length === 0) return;

    const assignments: Record<string, string | null> = {};
    this.pieces.forEach(p => {
      assignments[p.name] = p.assignedZoneId || null;
    });

    const record: GarmentConfigRecord = {
      modelHash: hash,
      title: this.modelMeta.title || "Style3D Garment",
      garmentType: this.modelMeta.mode || "standard",
      triangles: this.modelMeta.triangles,
      piecesCount: this.modelMeta.piecesCount,
      zoneAssignmentsJson: JSON.stringify(assignments),
      updatedAt: new Date().toISOString()
    };

    try {
      await sqliteService.saveConfig(record);
    } catch (err) {
      console.warn("[SQLite] Could not save garment config:", err);
    }
  }

  // Check and restore assignments from SQLite if previously analyzed
  async checkAndRestoreFromSQLite(modelHash: string): Promise<boolean> {
    try {
      const existing = await sqliteService.getConfigByHash(modelHash);
      if (existing && existing.zoneAssignmentsJson) {
        const assignments: Record<string, string | null> = JSON.parse(existing.zoneAssignmentsJson);
        let restoredCount = 0;
        runInAction(() => {
          this.pieces.forEach(p => {
            if (assignments[p.name] !== undefined) {
              p.assignedZoneId = assignments[p.name];
              if (p.assignedZoneId) restoredCount++;
            }
          });
          this.modelMeta.isRestoredFromSqlite = true;
          if (this.transparentAssignedMode) {
            this.updateAssignedTransparency();
          }
        });
        console.log(`[SQLite] ✨ Recognized existing model (${modelHash})! Restored ${restoredCount} piece assignments automatically from SQLite.`);
        return true;
      }
    } catch (err) {
      console.warn("[SQLite] Error querying existing config:", err);
    }

    // If NO existing configuration in SQLite, automatically turn on Ghost Mode and start Guided Wizard
    runInAction(() => {
      this.transparentAssignedMode = true;
      this.updateAssignedTransparency();
      this.startWizard();
    });
    return false;
  }

  // --- Guided Wizard Controller ---
  wizardIndex = 0;

  // Restart the wizard from Pattern #1 (clearing previous assignments if requested, or reviewing sequentially)
  restartWizardFromBeginning(resetAssignments = true) {
    if (this.pieces.length === 0) return;
    
    if (resetAssignments) {
      this.pieces.forEach(p => {
        p.assignedZoneId = null;
      });
      this.persistGarmentConfigToSQLite();
    }

    this.wizardIndex = 0;
    this.isWizardActive = true;
    this.transparentAssignedMode = true;
    this.shadingMode = "selection";
    this.selectedPiece = this.pieces[0] || null;
    this.updateAssignedTransparency();
  }

  startWizard() {
    if (this.pieces.length === 0) return;

    // Check if any pieces are unassigned
    const hasUnassigned = this.pieces.some(p => !p.assignedZoneId);
    if (!hasUnassigned) {
      // If all pieces are already assigned, restart from the very beginning!
      this.restartWizardFromBeginning(true);
      return;
    }

    this.isWizardActive = true;
    this.transparentAssignedMode = true;
    this.shadingMode = "selection";
    this.updateAssignedTransparency();
    this.focusNextUnassignedPiece();
  }

  exitWizard() {
    this.isWizardActive = false;
    this.deselectPiece(true);
    this.updateAssignedTransparency();
  }

  focusNextUnassignedPiece(): boolean {
    const nextUnassigned = this.pieces.find(p => !p.assignedZoneId);
    if (nextUnassigned) {
      this.selectedPiece = nextUnassigned;
      this.wizardIndex = this.pieces.indexOf(nextUnassigned);
      this.updateAssignedTransparency();
      return true;
    }
    // All pieces assigned!
    this.isWizardActive = false;
    this.updateAssignedTransparency();
    return false;
  }

  // Assign the active piece via hotkey / button and instantly advance to the next pattern
  assignAndAdvanceWizard(zoneId: string | null) {
    if (!this.selectedPiece) return;
    this.assignZoneToPiece(this.selectedPiece.id, zoneId);
    this.focusNextUnassignedPiece();
  }

  // Reset a piece's UVs back to original factory unwrap
  resetPieceToFactoryUV(pieceId: string) {
    const p = this.pieces.find(item => item.id === pieceId);
    if (!p || !p.mesh || !p.mesh.geometry) return;
    const geom = p.mesh.geometry;
    const uvAttr = geom.attributes.uv;
    const orig = geom.userData?.originalUv;
    if (uvAttr instanceof THREE.BufferAttribute && orig instanceof Float32Array) {
      uvAttr.copyArray(orig);
      uvAttr.needsUpdate = true;
      if (p.material) {
        p.material.needsUpdate = true;
      }
      p.assignedZoneId = null;
    }
  }

  // Direct In-Memory Mesh Builder (No intermediate OBJ conversion!)
  loadDirectMeshes(
    rawMeshes: RawMeshData[], 
    title = "Garment", 
    incomingMaterials: Record<string, IncomingMaterialInfo> = {}, 
    transferMeta: { isThin?: boolean; mode?: string; detectedLocalCatalogCount?: number; dedicatedStyle3dMapCount?: number } = {}
  ) {
    if (!this.scene) return;

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }

    const group = new THREE.Group();
    group.name = title;

    let totalTris = 0;
    let totalVerts = 0;
    const piecesList: GarmentPiece[] = [];
    const missingMaps: MapAuditEntry[] = [];
    const matchedMaps: MapAuditEntry[] = [];
    let totalPackedMaps = 0;
    let totalCatalogMatches = 0;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    const createdMaterials = new Map<string, THREE.MeshStandardMaterial>();

    const getOrCreatePbrMaterial = (mtlName: string): THREE.MeshStandardMaterial => {
      const sanitizedName = (mtlName || "").replace(/[/\\?%*:|"<> \s]/g, "_");
      const lookupKey = incomingMaterials[mtlName] ? mtlName : sanitizedName;
      const cached = createdMaterials.get(lookupKey);
      if (cached) return cached;

      const mtlInfo = incomingMaterials[lookupKey] ||
        incomingMaterials[mtlName] ||
        incomingMaterials[sanitizedName] ||
        null;

      const cleanName = (mtlName || "").toLowerCase().replace(/piece_\d+/g, "").trim();
      const underscoredName = cleanName.replace(/[/\\?%*:|"<> \s]/g, "_");
      const alphaOnlyName = cleanName.replace(/[^a-z0-9]/g, "");
      const matched = this.catalogByName.get(cleanName) ||
        this.catalogByName.get(underscoredName) ||
        this.catalogByName.get(alphaOnlyName) ||
        null;

      if (matched) totalCatalogMatches++;

      const rawColorVal = (mtlInfo && mtlInfo.baseColor) || (matched && matched.baseColorValue) || [0.85, 0.85, 0.85];
      let colorObj = new THREE.Color(0.85, 0.85, 0.85);
      if (Array.isArray(rawColorVal) && rawColorVal.length >= 3) {
        let r = Number(rawColorVal[0]), g = Number(rawColorVal[1]), b = Number(rawColorVal[2]);
        if (r > 1.0 || g > 1.0 || b > 1.0) { r /= 255; g /= 255; b /= 255; }
        colorObj = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
      } else if (typeof rawColorVal === "string") {
        colorObj = new THREE.Color(rawColorVal);
      } else if (typeof rawColorVal === "number") {
        colorObj = new THREE.Color(rawColorVal);
      }

      let matRoughness = 0.82;
      if (mtlInfo && typeof mtlInfo.roughness === "number") {
        matRoughness = mtlInfo.roughness;
      } else if (matched && typeof matched.roughness === "number") {
        matRoughness = matched.roughness;
      }

      let matMetalness = 0.0;
      if (mtlInfo && typeof mtlInfo.metalness === "number") {
        matMetalness = mtlInfo.metalness;
      } else if (matched && typeof matched.metalness === "number") {
        matMetalness = matched.metalness;
      }

      const mat = new THREE.MeshStandardMaterial({
        color: colorObj.clone(),
        roughness: matRoughness,
        metalness: matMetalness,
        envMapIntensity: this.envIntensity,
        side: THREE.DoubleSide
      });

      // 1. Diffuse Map
      const diffSource = (mtlInfo && (mtlInfo.diffDataUrl || mtlInfo.diffUrl)) || (matched && matched.baseColorTextureUrl);
      if (diffSource) {
        if (diffSource.startsWith("data:")) totalPackedMaps++;
        textureLoader.load(
          diffSource,
          (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            mat.map = tex;
            mat.color.copy(colorObj);
            mat.needsUpdate = true;
          },
          undefined,
          (err) => console.warn(`[Store] Could not load diffuse for ${mtlName}:`, err)
        );
      }

      // 2. Normal Map
      const normSource = (mtlInfo && (mtlInfo.normDataUrl || mtlInfo.normUrl)) || (matched && matched.normalTextureUrl);
      const rawNormScale = (mtlInfo && mtlInfo.normalScale) || (matched && matched.normalStrength) || 1.0;
      const normScale = rawNormScale * 2.0;
      if (normSource) {
        if (normSource.startsWith("data:")) totalPackedMaps++;
        textureLoader.load(
          normSource,
          (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            mat.normalMap = tex;
            mat.normalScale.set(normScale, normScale);
            mat.needsUpdate = true;
          },
          undefined,
          (err) => console.warn(`[Store] Could not load normal for ${mtlName}:`, err)
        );
      }

      createdMaterials.set(lookupKey, mat);
      return mat;
    };

    rawMeshes.forEach((meshData) => {
      const geom = new THREE.BufferGeometry();
      const posArr = new Float32Array(meshData.vertices);
      geom.setAttribute("position", new THREE.BufferAttribute(posArr, 3));

      const vCount = posArr.length / 3;
      totalVerts += vCount;

      if (meshData.indices && meshData.indices.length > 0) {
        geom.setIndex(meshData.indices);
        totalTris += Math.round(meshData.indices.length / 3);
      } else {
        totalTris += Math.round(vCount / 3);
      }

      if (meshData.normals && meshData.normals.length > 0) {
        geom.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(meshData.normals), 3));
      } else {
        geom.computeVertexNormals();
      }

      // UV transformation using authentic Style3D physical transform
      if (meshData.uvs && meshData.uvs.length >= vCount * 2) {
        const rawUv = meshData.uvs;
        const finalUv = new Float32Array(vCount * 2);

        const firstMtlKey = Object.keys(incomingMaterials)[0];
        const mtlObj = incomingMaterials[meshData.materialName] || (firstMtlKey ? incomingMaterials[firstMtlKey] : undefined) || {};
        const tw = (mtlObj.texWidth && mtlObj.texWidth > 0) ? mtlObj.texWidth : 1;
        const th = (mtlObj.texHeight && mtlObj.texHeight > 0) ? mtlObj.texHeight : 1;

        const fm = meshData.fabricMatrix || [1, 0, 0, 0, 1, 0, 0, 0, 1];
        const uvSize = meshData.uvSize || [1, 1];
        const uvSx = (Array.isArray(uvSize) && uvSize[0] > 0) ? uvSize[0] : 1;
        const uvSy = (Array.isArray(uvSize) && uvSize[1] > 0) ? uvSize[1] : 1;

        const b0x = uvSx / tw;
        const b0y = uvSy / th;
        const rot = -(mtlObj.texAngle || 0);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const tx = (mtlObj.texOffset && mtlObj.texOffset[0]) || 0;
        const ty = (mtlObj.texOffset && mtlObj.texOffset[1]) || 0;

        const W0_0 = b0x * cosR, W0_1 = b0x * sinR;
        const W0_3 = -b0y * sinR, W0_4 = b0y * cosR;
        const W0_6 = tx, W0_7 = ty;

        const m0 = W0_0 * fm[0] + W0_3 * fm[1];
        const m1 = W0_1 * fm[0] + W0_4 * fm[1];
        const m3 = W0_0 * fm[3] + W0_3 * fm[4];
        const m4 = W0_1 * fm[3] + W0_4 * fm[4];
        const m6 = W0_0 * fm[6] + W0_3 * fm[7] + W0_6;
        const m7 = W0_1 * fm[6] + W0_4 * fm[7] + W0_7;

        for (let i = 0; i < vCount * 2; i += 2) {
          finalUv[i] = rawUv[i] * m0 + rawUv[i + 1] * m3 + m6;
          finalUv[i + 1] = rawUv[i] * m1 + rawUv[i + 1] * m4 + m7;
        }

        geom.setAttribute("uv", new THREE.BufferAttribute(finalUv, 2));
        // Preserve authentic factory unwrap copy for 100% reversible reset
        geom.userData.originalUv = finalUv.slice();
      }

      const baseMat = getOrCreatePbrMaterial(meshData.materialName);
      // Clone material so each garment piece has its own independent material instance.
      // Otherwise, sharing the same material instance causes highlight/transparency updates
      // on one piece to override all pieces sharing that material name!
      const mat = baseMat.clone();
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = meshData.name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      group.add(mesh);

      const tris = meshData.indices ? Math.round(meshData.indices.length / 3) : Math.round(vCount / 3);
      piecesList.push({
        id: mesh.uuid,
        name: meshData.name,
        mesh: mesh,
        material: mat,
        triangles: tris,
        originalGeometry: geom.clone(),
        originalTriangles: tris,
        catalogItem: null,
        assignedZoneId: null
      });
    });

    // Center and fit model in camera
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 100;

    group.position.x = -center.x;
    group.position.y = -center.y;
    group.position.z = -center.z;

    if (this.camera && this.controls) {
      this.camera.near = 1;
      this.camera.far = Math.max(50000, maxDim * 20);
      this.camera.updateProjectionMatrix();

      const fov = this.camera.fov * (Math.PI / 180);
      const cameraDist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.6;
      this.camera.position.set(0, maxDim * 0.1, cameraDist);
      this.camera.lookAt(0, 0, 0);

      this.controls.target.set(0, 0, 0);
      this.controls.maxDistance = cameraDist * 10;
      this.controls.minDistance = 1;
      this.controls.update();
    }

    // Compute geometric hash from vertices
    let sampleFloats: number[] = [];
    if (rawMeshes.length > 0 && rawMeshes[0].vertices) {
      sampleFloats = rawMeshes[0].vertices.slice(0, 10000);
    }

    this.scene.add(group);

    runInAction(() => {
      this.currentModel = group;
      this.pieces = piecesList;
      this.selectedPiece = piecesList[0] || null;
      this.modelMeta = {
        title: title,
        triangles: totalTris,
        vertices: totalVerts,
        piecesCount: piecesList.length,
        isThin: transferMeta.isThin,
        mode: transferMeta.mode,
        totalPackedMaps: transferMeta.dedicatedStyle3dMapCount !== undefined ? transferMeta.dedicatedStyle3dMapCount : totalPackedMaps,
        totalCatalogMatches: transferMeta.detectedLocalCatalogCount !== undefined ? transferMeta.detectedLocalCatalogCount : totalCatalogMatches,
        missingMaps: missingMaps,
        matchedMaps: matchedMaps,
        modelHash: undefined,
        isRestoredFromSqlite: false
      };
      this.updateAssignedTransparency();
    });

    // Compute hash asynchronously and check SQLite cache
    sqliteService.computeModelHash(sampleFloats).then((hash) => {
      runInAction(() => {
        this.modelMeta.modelHash = hash;
      });
      this.checkAndRestoreFromSQLite(hash);
    });
  }

  // 5. Load OBJ string and Auto-Bind Catalog PBR Textures
  loadObjString(
    objContent: string, 
    title = "Garment", 
    incomingMaterials: Record<string, IncomingMaterialInfo> = {}, 
    transferMeta: { isThin?: boolean; mode?: string; detectedLocalCatalogCount?: number; dedicatedStyle3dMapCount?: number } = {}
  ) {
    if (!this.scene) return;

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }

    const loader = new OBJLoader();
    const group = loader.parse(objContent);

    let totalTris = 0;
    let totalVerts = 0;
    const piecesList: GarmentPiece[] = [];
    const missingMaps: MapAuditEntry[] = [];
    const matchedMaps: MapAuditEntry[] = [];

    let totalPackedMaps = 0;
    let totalCatalogMatches = 0;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geom = child.geometry;
        const count = geom.attributes.position ? geom.attributes.position.count : 0;
        const tris = geom.index ? geom.index.count / 3 : count / 3;
        totalTris += Math.round(tris);
        totalVerts += count;

        // Save original unwrap backup
        if (geom.attributes.uv) {
          const uvArr = geom.attributes.uv.array;
          if (uvArr instanceof Float32Array) {
            geom.userData.originalUv = uvArr.slice();
          } else {
            geom.userData.originalUv = new Float32Array(uvArr);
          }
        }

        // Retrieve Material assigned to this mesh
        const rawMtlName = (child.material && child.material.name) || child.name || "";
        const mtlName = rawMtlName.replace(/[/\\?%*:|"<> \s]/g, "_");
        const firstMtlKey = Object.keys(incomingMaterials)[0];
        const mtlInfo = incomingMaterials[rawMtlName] ||
          incomingMaterials[mtlName] ||
          incomingMaterials[child.name] ||
          (Object.keys(incomingMaterials).length === 1 && firstMtlKey ? incomingMaterials[firstMtlKey] : null);

        const cleanName = mtlName.toLowerCase().replace(/piece_\d+/g, "").trim();
        const underscoredName = cleanName.replace(/[/\\?%*:|"<> \s]/g, "_");
        const alphaOnlyName = cleanName.replace(/[^a-z0-9]/g, "");
        const matched = this.catalogByName.get(cleanName) ||
          this.catalogByName.get(underscoredName) ||
          this.catalogByName.get(alphaOnlyName) ||
          null;

        if (matched) {
          totalCatalogMatches++;
          console.log(`[Store] ✨ Auto-matched panel "${child.name}" to Catalog Item: "${matched.name}" (ID: ${matched.id})`);
        }

        const rawColorVal = (mtlInfo && mtlInfo.baseColor) || (matched && matched.baseColorValue) || [0.85, 0.85, 0.85];
        let colorObj = new THREE.Color(0.85, 0.85, 0.85);
        if (Array.isArray(rawColorVal) && rawColorVal.length >= 3) {
          let r = Number(rawColorVal[0]), g = Number(rawColorVal[1]), b = Number(rawColorVal[2]);
          if (r > 1.0 || g > 1.0 || b > 1.0) { r /= 255; g /= 255; b /= 255; }
          colorObj = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
        } else if (typeof rawColorVal === "string") {
          colorObj = new THREE.Color(rawColorVal);
        } else if (typeof rawColorVal === "number") {
          colorObj = new THREE.Color(rawColorVal);
        }

        let matRoughness = 0.82;
        if (mtlInfo && typeof mtlInfo.roughness === "number") {
          matRoughness = mtlInfo.roughness;
        } else if (matched && typeof matched.roughness === "number") {
          matRoughness = matched.roughness;
        }

        let matMetalness = 0.0;
        if (mtlInfo && typeof mtlInfo.metalness === "number") {
          matMetalness = mtlInfo.metalness;
        } else if (matched && typeof matched.metalness === "number") {
          matMetalness = matched.metalness;
        }

        const pbrMaterial = new THREE.MeshStandardMaterial({
          color: colorObj.clone(),
          roughness: matRoughness,
          metalness: matMetalness,
          envMapIntensity: this.envIntensity,
          side: THREE.DoubleSide
        });

        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin("anonymous");

        const diffSource = (mtlInfo && (mtlInfo.diffDataUrl || mtlInfo.diffUrl)) || (matched && matched.baseColorTextureUrl);
        if (diffSource) {
          if (diffSource.startsWith("data:")) totalPackedMaps++;
          textureLoader.load(
            diffSource,
            (tex) => {
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.colorSpace = THREE.SRGBColorSpace;
              pbrMaterial.map = tex;
              pbrMaterial.color.copy(colorObj);
              pbrMaterial.needsUpdate = true;
            },
            undefined,
            (err) => console.warn(`[Store] Could not load diffuse texture for ${child.name}:`, err)
          );
        }

        const normSource = (mtlInfo && (mtlInfo.normDataUrl || mtlInfo.normUrl)) || (matched && matched.normalTextureUrl);
        const rawNormScale = (mtlInfo && mtlInfo.normalScale) || (matched && matched.normalStrength) || 1.0;
        const normScale = rawNormScale * 2.0;

        if (normSource) {
          if (normSource.startsWith("data:")) totalPackedMaps++;
          matchedMaps.push({ meshName: child.name, texture: mtlName, url: normSource });
          textureLoader.load(
            normSource,
            (tex) => {
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              pbrMaterial.normalMap = tex;
              pbrMaterial.normalScale.set(normScale, normScale);
              pbrMaterial.needsUpdate = true;
            },
            undefined,
            (err) => console.warn(`[Store] Could not load normal map for ${child.name}:`, err)
          );
        } else if (mtlInfo && mtlInfo.normTex) {
          missingMaps.push({ meshName: child.name, texture: mtlInfo.normTex });
        }

        child.material = pbrMaterial;
        child.castShadow = true;
        child.receiveShadow = true;

        piecesList.push({
          id: child.uuid,
          name: child.name || `Panel_${piecesList.length + 1}`,
          mesh: child,
          material: pbrMaterial,
          triangles: Math.round(tris),
          originalGeometry: child.geometry.clone(),
          originalTriangles: Math.round(tris),
          catalogItem: matched || null,
          assignedZoneId: null
        });
      }
    });

    // Center and fit model in camera
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 100;

    group.position.x = -center.x;
    group.position.y = -center.y;
    group.position.z = -center.z;

    if (this.camera && this.controls) {
      this.camera.near = 1;
      this.camera.far = Math.max(50000, maxDim * 20);
      this.camera.updateProjectionMatrix();

      const fov = this.camera.fov * (Math.PI / 180);
      const cameraDist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.6;
      this.camera.position.set(0, maxDim * 0.1, cameraDist);
      this.camera.lookAt(0, 0, 0);

      this.controls.target.set(0, 0, 0);
      this.controls.maxDistance = cameraDist * 10;
      this.controls.minDistance = 1;
      this.controls.update();
    }

    // Compute geometric hash from loaded OBJ pieces
    let sampleFloats: Float32Array = new Float32Array(0);
    if (piecesList.length > 0 && piecesList[0].mesh.geometry.attributes.position) {
      const posArr = piecesList[0].mesh.geometry.attributes.position.array;
      if (posArr instanceof Float32Array) {
        sampleFloats = posArr.slice(0, 10000);
      }
    }

    this.scene.add(group);

    runInAction(() => {
      this.currentModel = group;
      this.pieces = piecesList;
      this.selectedPiece = piecesList[0] || null;
      this.modelMeta = {
        title: title,
        triangles: totalTris,
        vertices: totalVerts,
        piecesCount: piecesList.length,
        isThin: transferMeta.isThin,
        mode: transferMeta.mode,
        totalPackedMaps: transferMeta.dedicatedStyle3dMapCount !== undefined ? transferMeta.dedicatedStyle3dMapCount : totalPackedMaps,
        totalCatalogMatches: transferMeta.detectedLocalCatalogCount !== undefined ? transferMeta.detectedLocalCatalogCount : totalCatalogMatches,
        missingMaps: missingMaps,
        matchedMaps: matchedMaps,
        modelHash: undefined,
        isRestoredFromSqlite: false
      };
    });

    // Compute hash asynchronously and check SQLite cache
    sqliteService.computeModelHash(sampleFloats).then((hash) => {
      runInAction(() => {
        this.modelMeta.modelHash = hash;
      });
      this.checkAndRestoreFromSQLite(hash);
    });
  }

  // 6. Surface Selection & Actions
  selectPiece(mesh: THREE.Mesh) {
    const found = this.pieces.find(p => p.mesh === mesh);
    if (found) {
      this.selectedPiece = found;
      this.selectedPieceIds = [found.id];
      this.updateAssignedTransparency();
    }
  }

  toggleWireframe() {
    this.wireframeMode = !this.wireframeMode;
    if (this.currentModel) {
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.wireframe = this.wireframeMode;
        }
      });
    }
  }

  // Reset Camera View to frame active model or default position
  resetCamera() {
    if (!this.camera || !this.controls) return;
    if (this.currentModel) {
      const box = new THREE.Box3().setFromObject(this.currentModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 100;
      const fov = this.camera.fov * (Math.PI / 180);
      const cameraDist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.6;

      this.camera.position.set(0, maxDim * 0.1, cameraDist);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else {
      this.camera.position.set(0, 0, 1000);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  // Procedural Numbered UV Tile Checkerboard Texture Generator (1024x1024)
  private uvTileTexture: THREE.CanvasTexture | null = null;

  getUVTileTexture(): THREE.CanvasTexture {
    if (this.uvTileTexture) return this.uvTileTexture;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // 8x8 Numbered Grid (A1-H8) with gradient quadrants and crosshairs
      const gridSize = 8;
      const step = 1024 / gridSize;
      const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const isEven = (row + col) % 2 === 0;
          ctx.fillStyle = isEven ? "#1e293b" : "#0f172a";
          ctx.fillRect(col * step, row * step, step, step);

          // Grid Border
          ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(col * step, row * step, step, step);

          // Sub-checkerboard fine grid
          const subStep = step / 4;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 1;
          for (let si = 1; si < 4; si++) {
            ctx.beginPath();
            ctx.moveTo(col * step + si * subStep, row * step);
            ctx.lineTo(col * step + si * subStep, (row + 1) * step);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(col * step, row * step + si * subStep);
            ctx.lineTo((col + 1) * step, row * step + si * subStep);
            ctx.stroke();
          }

          // Numbered Label: e.g. "A1", "C4", "H8"
          const label = `${letters[row]}${col + 1}`;
          ctx.fillStyle = isEven ? "#38bdf8" : "#fbbf24";
          ctx.font = "bold 26px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, col * step + step / 2, row * step + step / 2);

          // Direction Arrow indicating +U and +V orientation
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.font = "10px sans-serif";
          ctx.fillText("↗ UV", col * step + step / 2, row * step + step / 2 + 22);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.uvTileTexture = tex;
    return tex;
  }

  // Toggle Numbered UV Tile Grid texture across all garment pieces
  toggleUVGridMode() {
    this.uvGridMode = !this.uvGridMode;
    const tileTex = this.getUVTileTexture();

    this.pieces.forEach(p => {
      if (!p.material) return;
      if (this.uvGridMode) {
        // Back up original diffuse map if not already backed up
        if (!p.material.userData.originalMap) {
          p.material.userData.originalMap = p.material.map || null;
          p.material.userData.originalColor = p.material.color.clone();
        }
        p.material.map = tileTex;
        p.material.color.setRGB(1, 1, 1);
      } else {
        // Restore original texture and color
        if (p.material.userData.originalMap !== undefined) {
          p.material.map = p.material.userData.originalMap;
        }
        if (p.material.userData.originalColor) {
          p.material.color.copy(p.material.userData.originalColor);
        }
      }
      p.material.needsUpdate = true;
    });

    this.updateAssignedTransparency();
  }

  // Load Curated Catalog of 75 Style3D Garments
  async loadCuratedCatalog() {
    try {
      const res = await fetch("/data/curated_catalog.json");
      if (res.ok) {
        const data: CuratedGarmentItem[] = await res.json();
        runInAction(() => {
          this.curatedCatalog = data;
        });
        console.log(`[Store] Loaded ${data.length} curated garments into memory.`);
      }
    } catch (e) {
      console.warn("Could not load curated catalog:", e);
    }
  }

  get filteredCuratedList(): CuratedGarmentItem[] {
    if (this.curatedCategoryFilter === "ALL") {
      return this.curatedCatalog;
    }
    return this.curatedCatalog.filter(item => item.category === this.curatedCategoryFilter);
  }

  setCuratedCategoryFilter(filter: "ALL" | "TOPWEAR" | "BOTTOMWEAR") {
    this.curatedCategoryFilter = filter;
    this.currentCuratedIndex = -1;
  }

  async loadCuratedModelByIndex(index: number, uvOrganizer?: any) {
    const list = this.filteredCuratedList;
    if (list.length === 0) return;
    const clampedIndex = (index + list.length) % list.length;
    const item = list[clampedIndex];
    if (!item) return;

    runInAction(() => {
      this.currentCuratedIndex = clampedIndex;
      this.isLoadingCuratedModel = true;
    });

    try {
      const diskPath = `/home/vijaykc/Downloads/style3d_models/${item.id}/${item.id}_thin.obj`;
      const url = `/api/local-file?path=${encodeURIComponent(diskPath)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch OBJ: ${res.statusText}`);
      }
      const objText = await res.text();
      this.loadObjString(objText, item.name || item.id);

      // Automatically configure UV Organizer for this garment type
      if (uvOrganizer) {
        const targetType = item.category === "BOTTOMWEAR" ? "BOTTOMWEAR" : "TOPWEAR";
        uvOrganizer.switchGarmentType(targetType);
        // Automatically detect pattern assignments
        uvOrganizer.autoDetectPatternAssignments(false);
        // Automatically arrange UVs with top-anchor alignment
        uvOrganizer.arrangeAssignedUVs();
      }

      // Automatically apply Litmus Test texture
      if (this.autoLitmusTextureEnabled) {
        const texCategory = item.category === "BOTTOMWEAR" ? "BOTTOMWEAR" : "TOPWEAR";
        this.applyLitmusTestTexture(texCategory);
      }
    } catch (err) {
      console.error("[Store] Error loading curated model:", err);
    } finally {
      runInAction(() => {
        this.isLoadingCuratedModel = false;
      });
    }
  }

  async loadNextCuratedModel(uvOrganizer?: any) {
    const list = this.filteredCuratedList;
    if (list.length === 0) return;
    const nextIndex = this.currentCuratedIndex + 1;
    await this.loadCuratedModelByIndex(nextIndex, uvOrganizer);
  }

  async loadPrevCuratedModel(uvOrganizer?: any) {
    const list = this.filteredCuratedList;
    if (list.length === 0) return;
    const prevIndex = this.currentCuratedIndex <= 0 ? list.length - 1 : this.currentCuratedIndex - 1;
    await this.loadCuratedModelByIndex(prevIndex, uvOrganizer);
  }

  // Apply Litmus Test Texture (Topwear or Bottomwear)
  applyLitmusTestTexture(type: "TOPWEAR" | "BOTTOMWEAR") {
    const texUrl = type === "BOTTOMWEAR" 
      ? "/textures/litmus_test_bottomwear.png"
      : "/textures/litmus_test_topwear.png";

    let tex = this.loadedLitmusTextures.get(texUrl);
    if (!tex) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      tex = loader.load(texUrl, (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.wrapS = THREE.ClampToEdgeWrapping;
        loadedTex.wrapT = THREE.ClampToEdgeWrapping;
        this.pieces.forEach(p => {
          if (p.material) {
            p.material.needsUpdate = true;
          }
        });
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      this.loadedLitmusTextures.set(texUrl, tex);
    }

    this.pieces.forEach(p => {
      if (!p.material) return;
      if (!p.material.userData.originalMap) {
        p.material.userData.originalMap = p.material.map || null;
        p.material.userData.originalColor = p.material.color.clone();
      }
      p.material.map = tex;
      p.material.color.setRGB(1, 1, 1);
      p.material.needsUpdate = true;
    });

    this.updateAssignedTransparency();
    console.log(`[Store] 🧪 Applied Litmus Test Texture (${type}) across ${this.pieces.length} panels.`);
  }

  toggleAutoLitmusTexture() {
    this.autoLitmusTextureEnabled = !this.autoLitmusTextureEnabled;
    if (!this.autoLitmusTextureEnabled) {
      // Revert back to original maps
      this.pieces.forEach(p => {
        if (!p.material) return;
        if (p.material.userData.originalMap !== undefined) {
          p.material.map = p.material.userData.originalMap;
        }
        if (p.material.userData.originalColor) {
          p.material.color.copy(p.material.userData.originalColor);
        }
        p.material.needsUpdate = true;
      });
      this.updateAssignedTransparency();
    } else {
      const type = this.modelMeta.title.toLowerCase().includes("pants") || 
                   this.modelMeta.title.toLowerCase().includes("shorts") || 
                   this.modelMeta.title.toLowerCase().includes("skirt") || 
                   this.modelMeta.title.toLowerCase().includes("legging")
        ? "BOTTOMWEAR" : "TOPWEAR";
      this.applyLitmusTestTexture(type);
    }
  }

  // Apply catalog fabric directly onto the selected piece
  applyCatalogFabric(fabricItem: FabricCatalogItem) {
    if (!this.selectedPiece || !this.selectedPiece.mesh) return;

    const mat = this.selectedPiece.material;
    mat.roughness = fabricItem.roughness || 0.5;
    mat.metalness = fabricItem.metalness || 0.0;

    if (fabricItem.normalTextureUrl) {
      new THREE.TextureLoader().load(fabricItem.normalTextureUrl, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        mat.normalMap = tex;
        mat.normalScale.set(fabricItem.normalStrength || 1.0, fabricItem.normalStrength || 1.0);
        mat.needsUpdate = true;
      });
    }
    this.selectedPiece.catalogItem = fabricItem;
  }

  // Decimation / Simplify Modifier State
  decimationRatio = 1.0; // 1.0 = 100% original, 0.5 = 50% tris reduction
  isDecimating = false;

  // Decimate Garment Geometry with strict UV boundary & shape preservation
  async decimateModel(targetRatio: number) {
    if (!this.currentModel || this.pieces.length === 0) return;
    const clampedRatio = Math.max(0.05, Math.min(1.0, targetRatio));
    runInAction(() => {
      this.decimationRatio = clampedRatio;
    });

    if (clampedRatio >= 0.999) {
      this.revertDecimation();
      return;
    }

    runInAction(() => {
      this.isDecimating = true;
    });

    try {
      await MeshoptSimplifier.ready;

      let totalTris = 0;
      let totalVerts = 0;

      for (const p of this.pieces) {
        // Cache original geometry and triangle count once from the raw model
        if (!p.originalGeometry) {
          p.originalGeometry = p.mesh.geometry.clone();
          p.originalTriangles = p.triangles;
        }

        // Always clone directly from the pristine originalGeometry
        let geomToSimplify = p.originalGeometry.clone();

        // If geometry is non-indexed, merge identical vertices to allow edge collapse
        if (geomToSimplify.getIndex() === null) {
          geomToSimplify = mergeVertices(geomToSimplify);
        }

        const index = geomToSimplify.getIndex();
        const posAttr = geomToSimplify.getAttribute("position");
        const uvAttr = geomToSimplify.getAttribute("uv");
        const normalAttr = geomToSimplify.getAttribute("normal");

        if (!index || !posAttr || posAttr.count < 10) {
          totalTris += p.triangles;
          totalVerts += posAttr ? posAttr.count : 0;
          continue;
        }

        const vertexCount = posAttr.count;
        const positions = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
          positions[i * 3 + 0] = posAttr.getX(i);
          positions[i * 3 + 1] = posAttr.getY(i);
          positions[i * 3 + 2] = posAttr.getZ(i);
        }

        // Target index count calculated strictly from original index count
        const targetIndexCount = Math.max(3, Math.floor((index.count * clampedRatio) / 3) * 3);

        // Ensure Uint32Array index array
        const indexArray = index.array instanceof Uint32Array || index.array instanceof Uint16Array 
          ? index.array 
          : new Uint32Array(index.array);

        let simplifiedIndices: Uint32Array;

        // Simplify with attributes using LockBorder flag to lock 3D seam borders and UV boundary outlines!
        if (uvAttr) {
          const attributeStride = (normalAttr ? 3 : 0) + 2;
          const vertexAttributes = new Float32Array(vertexCount * attributeStride);
          const attributeWeights: number[] = [];

          if (normalAttr) attributeWeights.push(0.25, 0.25, 0.25);
          // Strong weight on UV coordinates (1.0, 1.0) so internal pattern mapping is never distorted
          attributeWeights.push(1.0, 1.0);

          for (let i = 0, o = 0; i < vertexCount; i++) {
            if (normalAttr) {
              vertexAttributes[o++] = normalAttr.getX(i);
              vertexAttributes[o++] = normalAttr.getY(i);
              vertexAttributes[o++] = normalAttr.getZ(i);
            }
            vertexAttributes[o++] = uvAttr.getX(i);
            vertexAttributes[o++] = uvAttr.getY(i);
          }

          // LockBorder prevents outer island contour collapse, keeping the pattern perimeter intact
          const simplifyFlags = ["LockBorder"];
          const result = MeshoptSimplifier.simplifyWithAttributes(
            indexArray,
            positions,
            3,
            vertexAttributes,
            attributeStride,
            attributeWeights,
            null,
            targetIndexCount,
            1e-2, // strict error threshold to maintain exact garment panel silhouettes
            simplifyFlags
          );
          simplifiedIndices = result[0] instanceof Uint32Array ? result[0] : new Uint32Array(result[0]);
        } else {
          const result = MeshoptSimplifier.simplify(
            indexArray,
            positions,
            3,
            targetIndexCount,
            1e-2,
            ["LockBorder"]
          );
          simplifiedIndices = result[0] instanceof Uint32Array ? result[0] : new Uint32Array(result[0]);
        }

        // Compact mesh to strip unreferenced vertices and rebuild clean buffers
        const [remap, unique] = MeshoptSimplifier.compactMesh(simplifiedIndices);

        const simplifiedGeo = new THREE.BufferGeometry();
        for (const name in geomToSimplify.attributes) {
          const attribute = geomToSimplify.getAttribute(name);
          if (attribute instanceof THREE.BufferAttribute) {
            const itemSize = attribute.itemSize;
            const newAttribute = new THREE.BufferAttribute(
              new Float32Array(unique * itemSize),
              itemSize,
              attribute.normalized
            );

            for (let i = 0; i < remap.length; i++) {
              const target = remap[i];
              if (target === 0xffffffff) continue;
              for (let k = 0; k < itemSize; k++) {
                newAttribute.setComponent(target, k, attribute.getComponent(i, k));
              }
            }
            simplifiedGeo.setAttribute(name, newAttribute);
          }
        }

        simplifiedGeo.setIndex(new THREE.BufferAttribute(simplifiedIndices, 1));
        simplifiedGeo.computeVertexNormals();

        // Preserve original factory UVs userData for 100% reversible reset
        if (geomToSimplify.userData.originalUv) {
          simplifiedGeo.userData.originalUv = geomToSimplify.userData.originalUv;
        }

        // Update mesh geometry
        p.mesh.geometry.dispose();
        p.mesh.geometry = simplifiedGeo;

        const newTris = simplifiedGeo.index ? simplifiedGeo.index.count / 3 : (simplifiedGeo.attributes.position ? simplifiedGeo.attributes.position.count / 3 : 0);
        p.triangles = Math.round(newTris);
        totalTris += p.triangles;
        totalVerts += simplifiedGeo.attributes.position ? simplifiedGeo.attributes.position.count : 0;
      }

      runInAction(() => {
        this.modelMeta.triangles = totalTris;
        this.modelMeta.vertices = totalVerts;
      });
    } catch (err) {
      console.error("[Store] Decimation error:", err);
    } finally {
      runInAction(() => {
        this.isDecimating = false;
      });
    }
  }

  // Restore Original Geometry (Revert Decimation)
  revertDecimation() {
    this.decimationRatio = 1.0;
    let totalTris = 0;
    let totalVerts = 0;

    this.pieces.forEach(p => {
      if (p.originalGeometry) {
        const restored = p.originalGeometry.clone();
        p.mesh.geometry.dispose();
        p.mesh.geometry = restored;
        p.triangles = p.originalTriangles || p.triangles;
      }
      totalTris += p.triangles;
      totalVerts += p.mesh.geometry.attributes.position ? p.mesh.geometry.attributes.position.count : 0;
    });

    this.modelMeta.triangles = totalTris;
    this.modelMeta.vertices = totalVerts;
  }

  // 7. Export Final Clean Optimized GLB (strips all textures, optimizes buffers via meshopt, pure geometry & materials)
  async exportGLB() {
    if (!this.currentModel || this.pieces.length === 0) return;

    // Temporarily ensure clean state without editor highlights
    const originalShadingMode = this.shadingMode;
    const originalSelected = this.selectedPiece;
    this.deselectPiece(true);
    this.setShadingMode("render");

    try {
      await MeshoptSimplifier.ready;

      // Create an export group with pure geometry and lightweight solid PBR materials (0 textures)
      const exportGroup = new THREE.Group();
      exportGroup.name = this.modelMeta.title || "Garment";

      for (const piece of this.pieces) {
        if (!piece.mesh || !piece.mesh.geometry) continue;

        const currentGeo = piece.mesh.geometry;
        const posAttr = currentGeo.getAttribute("position");
        const uvAttr = currentGeo.getAttribute("uv");
        const normalAttr = currentGeo.getAttribute("normal");
        let indexAttr = currentGeo.getIndex();

        if (!posAttr || posAttr.count < 3) continue;

        // Ensure indexed geometry
        let cleanGeo = currentGeo.clone();
        if (!cleanGeo.getIndex()) {
          cleanGeo = mergeVertices(cleanGeo);
        }
        indexAttr = cleanGeo.getIndex();

        if (!indexAttr) continue;

        // Use meshopt compactMesh to ensure vertex cache locality and eliminate unused vertices
        const indexArr = indexAttr.array instanceof Uint32Array || indexAttr.array instanceof Uint16Array 
          ? indexAttr.array 
          : new Uint32Array(indexAttr.array);

        const [remap, uniqueCount] = MeshoptSimplifier.compactMesh(indexArr);

        const optimizedGeo = new THREE.BufferGeometry();

        // 1. Position attribute
        const newPos = new Float32Array(uniqueCount * 3);
        const curPos = cleanGeo.getAttribute("position");
        for (let i = 0; i < remap.length; i++) {
          const target = remap[i];
          if (target === 0xffffffff) continue;
          newPos[target * 3] = curPos.getX(i);
          newPos[target * 3 + 1] = curPos.getY(i);
          newPos[target * 3 + 2] = curPos.getZ(i);
        }
        optimizedGeo.setAttribute("position", new THREE.BufferAttribute(newPos, 3));

        // 2. UV attribute
        if (uvAttr) {
          const newUv = new Float32Array(uniqueCount * 2);
          const curUv = cleanGeo.getAttribute("uv");
          for (let i = 0; i < remap.length; i++) {
            const target = remap[i];
            if (target === 0xffffffff) continue;
            newUv[target * 2] = curUv.getX(i);
            newUv[target * 2 + 1] = curUv.getY(i);
          }
          optimizedGeo.setAttribute("uv", new THREE.BufferAttribute(newUv, 2));
        }

        // 3. Normal attribute
        if (normalAttr) {
          const newNormal = new Float32Array(uniqueCount * 3);
          const curNormal = cleanGeo.getAttribute("normal");
          for (let i = 0; i < remap.length; i++) {
            const target = remap[i];
            if (target === 0xffffffff) continue;
            newNormal[target * 3] = curNormal.getX(i);
            newNormal[target * 3 + 1] = curNormal.getY(i);
            newNormal[target * 3 + 2] = curNormal.getZ(i);
          }
          optimizedGeo.setAttribute("normal", new THREE.BufferAttribute(newNormal, 3));
        } else {
          optimizedGeo.computeVertexNormals();
        }

        optimizedGeo.setIndex(new THREE.BufferAttribute(indexArr, 1));

        // Extract pure solid color & material parameters WITHOUT any heavy texture maps (0 image payload!)
        let baseColor = new THREE.Color(0.85, 0.85, 0.85);
        let roughness = 0.82;
        let metalness = 0.0;

        if (piece.material && piece.material instanceof THREE.MeshStandardMaterial) {
          baseColor = piece.material.color.clone();
          roughness = piece.material.roughness;
          metalness = piece.material.metalness;
        }

        const pureMaterial = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: roughness,
          metalness: metalness,
          side: THREE.DoubleSide
          // Notice: map, normalMap, roughnessMap, metalnessMap are completely omitted!
        });

        const exportMesh = new THREE.Mesh(optimizedGeo, pureMaterial);
        exportMesh.name = piece.name || `Panel_${exportGroup.children.length + 1}`;
        exportGroup.add(exportMesh);
      }

      const exporter = new GLTFExporter();
      exporter.parse(
        exportGroup,
        (gltf: ArrayBuffer | { [key: string]: unknown }) => {
          // Dispose temporary export group resources
          exportGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });

          // Restore editor state
          runInAction(() => {
            this.selectedPiece = originalSelected;
            this.setShadingMode(originalShadingMode);
          });

          if (gltf instanceof ArrayBuffer) {
            const blob = new Blob([gltf], { type: "model/gltf-binary" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            const name = `${this.modelMeta.title || "garment"}_pure_geometry.glb`;
            link.download = name;
            link.click();

            this.registerMigrated({
              id: Date.now().toString(),
              title: this.modelMeta.title || "Style3D Garment"
            });
          }
        },
        (error) => {
          console.error("GLTF export error:", error);
          runInAction(() => {
            this.selectedPiece = originalSelected;
            this.setShadingMode(originalShadingMode);
          });
        },
        { binary: true }
      );
    } catch (err) {
      console.error("[Store] Export error:", err);
      runInAction(() => {
        this.selectedPiece = originalSelected;
        this.setShadingMode(originalShadingMode);
      });
    }
  }
}

export const modelStore = new ModelStore();
