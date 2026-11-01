import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Layers,
  BoxSelect,
  Sparkles,
  CheckSquare,
  Square,
  CheckCircle2
} from "lucide-react";

// Distinct palette colors for individual piece bounding boxes
const BBOX_COLORS = [
  0x38bdf8, 0x34d399, 0xfbbf24, 0xf87171, 0xa855f7, 
  0xec4899, 0x06b6d4, 0x84cc16, 0xf97316, 0x6366f1
];

// Zone definitions for identification and filtering
export interface IdentificationZone {
  id: string;
  name: string;
  description: string;
  color: string;
  colorHexNum: number;
}

export const TOPWEAR_ZONES: IdentificationZone[] = [
  { id: "FRONT_BODY", name: "Front Body", description: "Torso front (Z > 0)", color: "#38bdf8", colorHexNum: 0x38bdf8 },
  { id: "BACK_BODY", name: "Back Body", description: "Torso back (Z < 0)", color: "#818cf8", colorHexNum: 0x818cf8 },
  { id: "SLEEVE_LEFT", name: "Left Sleeve", description: "Lateral arm (X < 0)", color: "#34d399", colorHexNum: 0x34d399 },
  { id: "CUFF_LEFT", name: "Left Cuff", description: "Wrist band (X < 0, Low Y)", color: "#10b981", colorHexNum: 0x10b981 },
  { id: "SLEEVE_RIGHT", name: "Right Sleeve", description: "Lateral arm (X > 0)", color: "#f472b6", colorHexNum: 0xf472b6 },
  { id: "CUFF_RIGHT", name: "Right Cuff", description: "Wrist band (X > 0, Low Y)", color: "#fb7185", colorHexNum: 0xfb7185 },
  { id: "HOOD_COLLAR", name: "Hood / Collar", description: "Upper region (Top Y)", color: "#fbbf24", colorHexNum: 0xfbbf24 },
  { id: "WAISTBAND", name: "Waistband", description: "Bottom band (Lowest Y)", color: "#c084fc", colorHexNum: 0xc084fc },
  { id: "TRIMS", name: "Trims & Accents", description: "Elongated UV / Small BBox overlays", color: "#f97316", colorHexNum: 0xf97316 }
];

export const BOTTOMWEAR_ZONES: IdentificationZone[] = [
  { id: "WAISTBAND", name: "Waistband", description: "Top waist elastic band (High Y)", color: "#c084fc", colorHexNum: 0xc084fc },
  { id: "LEG_LEFT", name: "Left Leg", description: "Left leg panel (X < 0)", color: "#38bdf8", colorHexNum: 0x38bdf8 },
  { id: "CUFF_LEFT", name: "Left Ankle Rib", description: "Left ankle cuff band (Low Y, X < 0)", color: "#10b981", colorHexNum: 0x10b981 },
  { id: "LEG_RIGHT", name: "Right Leg", description: "Right leg panel (X > 0)", color: "#f472b6", colorHexNum: 0xf472b6 },
  { id: "CUFF_RIGHT", name: "Right Ankle Rib", description: "Right ankle cuff band (Low Y, X > 0)", color: "#fb7185", colorHexNum: 0xfb7185 },
  { id: "TRIMS", name: "Trims & Hardware", description: "Tassels, seams, zippers, stoppers, pocket accents", color: "#f97316", colorHexNum: 0xf97316 }
];

export const ZONES = TOPWEAR_ZONES;

export interface MeshPieceInfo {
  id: string;
  name: string;
  mesh: THREE.Mesh;
  boxHelper: THREE.BoxHelper;
  materialName: string;
  triangles: number;
  vertices: number;
  visible: boolean;
  colorHex: string;
  // Bounding box center & size measurements
  bboxCenter: THREE.Vector3;
  bboxSize: THREE.Vector3;
  bboxVolume: number;
  // UV island metrics for Pass 2 Trims identification
  uvAspect: number;
  isTrim: boolean;
  trimReason?: string;
  // Identified zone tags
  identifiedZone: string | null; // Pass 1 zone (or Pass 2 resolved zone)
  pass1Zone: string | null;      // Preserved Pass 1 anatomical zone
  pass2Zone: string | null;      // Pass 2 refined zone (TRIMS if trim)
  confidence: number;
  originalMaterial: THREE.Material | THREE.Material[];
}

export const Playground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const boundsGroupRef = useRef<THREE.Group | null>(null);

  // Overall model bounds cache
  const overallBboxRef = useRef<{ min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3; size: THREE.Vector3 } | null>(null);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<string>("Initializing 3D viewport...");
  const [pieces, setPieces] = useState<MeshPieceInfo[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>("#0b0f19");
  const [lightingPreset, setLightingPreset] = useState<"studio" | "warm" | "cyber" | "soft">("studio");
  const [lightingIntensity, setLightingIntensity] = useState<number>(1.2);

  // Identification State
  const [garmentType, setGarmentType] = useState<"TOPWEAR" | "BOTTOMWEAR">("TOPWEAR");
  const [activePass, setActivePass] = useState<"pass1" | "pass2">("pass2");
  const [_isIdentified, setIsIdentified] = useState<boolean>(false);

  // Active zones list based on selected garment category
  const activeZonesList = useMemo(() => {
    return garmentType === "BOTTOMWEAR" ? BOTTOMWEAR_ZONES : TOPWEAR_ZONES;
  }, [garmentType]);

  // Active selected checkboxes for zones
  const [activeZoneFilters, setActiveZoneFilters] = useState<Record<string, boolean>>({
    FRONT_BODY: false,
    BACK_BODY: false,
    SLEEVE_LEFT: false,
    CUFF_LEFT: false,
    SLEEVE_RIGHT: false,
    CUFF_RIGHT: false,
    HOOD_COLLAR: false,
    WAISTBAND: false,
    LEG_LEFT: false,
    LEG_RIGHT: false,
    TRIMS: true
  });

  // Active highlighted mesh color materials map
  const zoneHighlightMaterials = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>();
    const allUniqueZones = [...TOPWEAR_ZONES, ...BOTTOMWEAR_ZONES];
    allUniqueZones.forEach((z) => {
      if (!map.has(z.id)) {
        const mat = new THREE.MeshStandardMaterial({
          color: z.colorHexNum,
          roughness: 0.45,
          metalness: 0.1,
          emissive: z.colorHexNum,
          emissiveIntensity: 0.25,
          side: THREE.DoubleSide
        });
        map.set(z.id, mat);
      }
    });
    return map;
  }, []);

  // Update lighting setup
  const applyLighting = useCallback((group: THREE.Group, preset: string, intensity: number) => {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (preset === "studio") {
      const ambient = new THREE.AmbientLight(0xffffff, 0.7 * intensity);
      group.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.4 * intensity);
      keyLight.position.set(120, 160, 140);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.bias = -0.0001;
      group.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8 * intensity);
      fillLight.position.set(-140, 80, 100);
      group.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0xfff7ed, 1.0 * intensity);
      rimLight.position.set(0, 100, -160);
      group.add(rimLight);
    } else if (preset === "warm") {
      const ambient = new THREE.AmbientLight(0xffedd5, 0.8 * intensity);
      group.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xfdba74, 1.6 * intensity);
      keyLight.position.set(100, 140, 120);
      group.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xfef08a, 0.6 * intensity);
      fillLight.position.set(-120, 60, -80);
      group.add(fillLight);
    } else if (preset === "cyber") {
      const ambient = new THREE.AmbientLight(0x0f172a, 0.5 * intensity);
      group.add(ambient);

      const cyan = new THREE.DirectionalLight(0x06b6d4, 1.8 * intensity);
      cyan.position.set(140, 120, 100);
      group.add(cyan);

      const magenta = new THREE.DirectionalLight(0xec4899, 1.6 * intensity);
      magenta.position.set(-140, 100, -100);
      group.add(magenta);

      const top = new THREE.DirectionalLight(0x818cf8, 1.0 * intensity);
      top.position.set(0, 180, 0);
      group.add(top);
    } else {
      const ambient = new THREE.HemisphereLight(0xffffff, 0x475569, 1.1 * intensity);
      group.add(ambient);

      const dir = new THREE.DirectionalLight(0xffffff, 0.9 * intensity);
      dir.position.set(40, 180, 60);
      group.add(dir);
    }
  }, []);

  // =========================================================================
  // TWO-PASS BOUNDING BOX & UV METRICS IDENTIFICATION LOGIC
  // - Pass 1: Macro Anatomical Zones (Topwear & Bottomwear)
  // - Pass 2: Trims & Accents Separation (Lengthy UV island / Small BBox volume)
  // =========================================================================
  const identifyZonesLogic = useCallback((piecesList: MeshPieceInfo[], passMode: "pass1" | "pass2" = "pass2") => {
    if (!overallBboxRef.current || piecesList.length === 0) return piecesList;

    const { min: garmentMin, center: garmentCenter, size: garmentSize } = overallBboxRef.current;
    const totalHeight = garmentSize.y;
    const totalWidth = garmentSize.x;

    return piecesList.map((piece) => {
      // -------------------------------------------------------------
      // PASS 1: Macro Anatomical Zone Assignment via BBox Center & Size
      // -------------------------------------------------------------
      const relX = piece.bboxCenter.x - garmentCenter.x;
      const relZ = piece.bboxCenter.z - garmentCenter.z;

      // Normalized coordinates from 0 to 1
      const normY = (piece.bboxCenter.y - garmentMin.y) / (totalHeight || 1); // 0 (bottom) to 1 (top)
      const normAbsX = Math.abs(relX) / (totalWidth / 2 || 1); // 0 (center) to 1 (outer)

      // Bounding box size ratio relative to total garment
      const widthRatio = piece.bboxSize.x / (totalWidth || 1);
      const heightRatio = piece.bboxSize.y / (totalHeight || 1);

      const pieceMinY = piece.bboxCenter.y - piece.bboxSize.y / 2;
      const pieceMaxY = piece.bboxCenter.y + piece.bboxSize.y / 2;
      const normMinY = (pieceMinY - garmentMin.y) / (totalHeight || 1);
      const normMaxY = (pieceMaxY - garmentMin.y) / (totalHeight || 1);

      let p1Zone: string | null = null;
      let confidence = 0.0;

      if (garmentType === "BOTTOMWEAR") {
        const isLeft = relX < 0;
        // 1. WAISTBAND: Located at the top of pants/skirts (normY > 0.85 or normMinY > 0.78), wide horizontal band
        if ((normMinY > 0.78 || normY > 0.85) && widthRatio > 0.35 && heightRatio < 0.28) {
          p1Zone = "WAISTBAND";
          confidence = 0.95;
        }
        // 2. ANKLE RIBS: Bottommost cuffs/bands (normY < 0.12 && heightRatio < 0.15)
        else if (normY < 0.12 && heightRatio < 0.15) {
          p1Zone = isLeft ? "CUFF_LEFT" : "CUFF_RIGHT";
          confidence = 0.90;
        }
        // 3. LEGS: All remaining leg body panels divided symmetrically along coronal centerline (X < 0 Left Leg, X >= 0 Right Leg)
        else {
          p1Zone = isLeft ? "LEG_LEFT" : "LEG_RIGHT";
          confidence = 0.92;
        }
      } else {
        // TOPWEAR:
        // 1. WAISTBAND: Lowest elevation, wide waistband band
        if (normY < 0.16 && widthRatio > 0.35) {
          p1Zone = "WAISTBAND";
          confidence = 0.92;
        }
        // 2. HOOD / COLLAR: Highest elevation (top of garment, above neck line)
        else if (normY > 0.72) {
          p1Zone = "HOOD_COLLAR";
          confidence = 0.90;
        }
        // 3. SLEEVES & CUFFS: Lateral position (far left or far right)
        else if (normAbsX > 0.42 && piece.bboxSize.y > 4) {
          const isLeft = relX < 0;
          if (normY < 0.28 || piece.bboxSize.y < 12) {
            p1Zone = isLeft ? "CUFF_LEFT" : "CUFF_RIGHT";
            confidence = 0.90;
          } else {
            p1Zone = isLeft ? "SLEEVE_LEFT" : "SLEEVE_RIGHT";
            confidence = 0.92;
          }
        }
        // 4. FRONT BODY vs BACK BODY (Central torso)
        else if (normAbsX <= 0.48 && normY >= 0.12 && normY <= 0.76) {
          if (relZ > 0.5) {
            p1Zone = "FRONT_BODY";
            confidence = 0.95;
          } else if (relZ < -0.5) {
            p1Zone = "BACK_BODY";
            confidence = 0.95;
          } else {
            p1Zone = relZ >= 0 ? "FRONT_BODY" : "BACK_BODY";
            confidence = 0.75;
          }
        } else {
          p1Zone = null;
          confidence = 0.0;
        }
      }

      // -------------------------------------------------------------
      // PASS 2: Trims & Accents Identification
      // User rule: "any lengthy uv island or small bounding box thing we consider as trim"
      // (stripes, small tabs, drawstrings, accent strips, zippers, thin seams, tassels)
      // -------------------------------------------------------------
      let isTrim = false;
      let trimReason: string | undefined = undefined;

      // Waistband is a primary structural panel and protected from trim reassignment
      if (p1Zone !== "WAISTBAND") {
        const isLengthyUv = piece.uvAspect >= 12.0;
        const isTinyBbox = piece.bboxVolume > 0 && piece.bboxVolume < 500;
        const isThinSeamOrHardware = piece.bboxSize.y < 12 && piece.bboxVolume < 50000 && heightRatio < 0.04;
        const isTasselOrPocketFlap = (widthRatio < 0.12 && heightRatio < 0.32 && piece.bboxVolume < 550000);

        isTrim = isLengthyUv || isTinyBbox || isThinSeamOrHardware || isTasselOrPocketFlap;

        if (isLengthyUv && isTinyBbox) {
          trimReason = `Lengthy UV (x${piece.uvAspect.toFixed(1)}) & Mini BBox (Vol ${piece.bboxVolume.toFixed(0)})`;
        } else if (isLengthyUv) {
          trimReason = `Lengthy UV Island (Aspect: ${piece.uvAspect.toFixed(1)})`;
        } else if (isTinyBbox) {
          trimReason = `Small Bounding Box (Vol: ${piece.bboxVolume.toFixed(0)})`;
        } else if (isThinSeamOrHardware) {
          trimReason = `Thin Seam / Hardware Strip (H: ${piece.bboxSize.y.toFixed(1)})`;
        } else if (isTasselOrPocketFlap) {
          trimReason = `Tassel / Pocket Accent (W: ${(widthRatio * 100).toFixed(0)}%, H: ${(heightRatio * 100).toFixed(0)}%)`;
        }
      }

      const p2Zone = isTrim ? "TRIMS" : p1Zone;
      const finalIdentifiedZone = passMode === "pass2" ? p2Zone : p1Zone;

      return {
        ...piece,
        isTrim,
        trimReason,
        pass1Zone: p1Zone,
        pass2Zone: p2Zone,
        identifiedZone: finalIdentifiedZone,
        confidence: isTrim ? 0.96 : confidence
      };
    });
  }, [garmentType]);

  // Center, configure materials, generate bounding boxes, and ground the model
  const processLoadedObject = useCallback((
    object: THREE.Group,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls
  ) => {
    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
    }
    if (boundsGroupRef.current) {
      scene.remove(boundsGroupRef.current);
    }

    const boundsGroup = new THREE.Group();
    boundsGroup.name = "bounding_boxes";
    boundsGroup.visible = showBoundingBoxes;
    scene.add(boundsGroup);
    boundsGroupRef.current = boundsGroup;

    // 1. Initial measurement of raw geometry
    const rawBbox = new THREE.Box3().setFromObject(object);
    const rawCenter = new THREE.Vector3();
    const rawSize = new THREE.Vector3();
    rawBbox.getCenter(rawCenter);
    rawBbox.getSize(rawSize);

    // 2. Uniform scale normalization
    const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
    const targetScale = maxDim > 500 ? (100 / maxDim) : (maxDim < 5 ? 100 / maxDim : 1.0);
    object.scale.set(targetScale, targetScale, targetScale);

    // 3. Center model at (0, 0, 0)
    object.position.set(
      -rawCenter.x * targetScale,
      -rawCenter.y * targetScale,
      -rawCenter.z * targetScale
    );

    object.updateMatrixWorld(true);

    // 4. Measure scaled world bounds to find true bottom (min Y)
    const scaledBbox = new THREE.Box3().setFromObject(object);
    const scaledCenter = new THREE.Vector3();
    const scaledSize = new THREE.Vector3();
    scaledBbox.getCenter(scaledCenter);
    scaledBbox.getSize(scaledSize);

    overallBboxRef.current = {
      min: scaledBbox.min.clone(),
      max: scaledBbox.max.clone(),
      center: scaledCenter.clone(),
      size: scaledSize.clone()
    };

    const floorY = scaledBbox.min.y;

    if (gridHelperRef.current) {
      gridHelperRef.current.position.y = floorY - 0.2;
    }
    if (shadowPlaneRef.current) {
      shadowPlaneRef.current.position.y = floorY - 0.25;
    }

    const wrapper = new THREE.Group();
    wrapper.add(object);
    scene.add(wrapper);
    modelGroupRef.current = wrapper;

    let piecesList: MeshPieceInfo[] = [];
    let index = 0;

    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            if (m instanceof THREE.Material) {
              m.side = THREE.DoubleSide;
              if ("roughness" in m) (m as THREE.MeshStandardMaterial).roughness = 0.78;
            }
          });
        } else if (child.material) {
          child.material.side = THREE.DoubleSide;
          if ("roughness" in child.material) {
            (child.material as THREE.MeshStandardMaterial).roughness = 0.78;
          }
        }

        const geom = child.geometry;
        const vCount = geom.attributes.position ? geom.attributes.position.count : 0;
        const tCount = geom.index ? geom.index.count / 3 : vCount / 3;

        // Compute piece specific bounding box center, size & volume
        child.updateMatrixWorld(true);
        const pieceBbox = new THREE.Box3().setFromObject(child);
        const pieceCenter = new THREE.Vector3();
        const pieceSize = new THREE.Vector3();
        pieceBbox.getCenter(pieceCenter);
        pieceBbox.getSize(pieceSize);
        const bboxVolume = pieceSize.x * pieceSize.y * pieceSize.z;

        // Compute UV aspect ratio from geometry UV attribute (Pass 2 trim metric)
        let uvAspect = 1.0;
        const uvAttr = geom.attributes.uv;
        if (uvAttr && uvAttr.count > 0) {
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < uvAttr.count; i++) {
            const u = uvAttr.getX(i);
            const v = uvAttr.getY(i);
            if (u < minU) minU = u;
            if (u > maxU) maxU = u;
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
          }
          const uvW = maxU - minU;
          const uvH = maxV - minV;
          if (uvW > 0 && uvH > 0) {
            uvAspect = Math.max(uvW, uvH) / Math.min(uvW, uvH);
          }
        }

        // Create colored BoundingBoxHelper for this piece
        const pieceColor = BBOX_COLORS[index % BBOX_COLORS.length];
        const boxHelper = new THREE.BoxHelper(child, pieceColor);
        (boxHelper.material as THREE.LineBasicMaterial).depthTest = true;
        (boxHelper.material as THREE.LineBasicMaterial).transparent = true;
        (boxHelper.material as THREE.LineBasicMaterial).opacity = 0.85;
        (boxHelper.material as THREE.LineBasicMaterial).linewidth = 1.5;
        boxHelper.renderOrder = 10;
        boxHelper.update();
        boundsGroup.add(boxHelper);

        const hex = `#${pieceColor.toString(16).padStart(6, "0")}`;

        piecesList.push({
          id: child.uuid || `piece-${index}`,
          name: child.name || `Panel ${index + 1}`,
          mesh: child,
          boxHelper: boxHelper,
          materialName: (child.material && child.material.name) ? child.material.name : "Default Material",
          triangles: Math.round(tCount),
          vertices: vCount,
          visible: true,
          colorHex: hex,
          bboxCenter: pieceCenter,
          bboxSize: pieceSize,
          bboxVolume: bboxVolume,
          uvAspect: uvAspect,
          isTrim: false,
          identifiedZone: null,
          pass1Zone: null,
          pass2Zone: null,
          confidence: 0,
          originalMaterial: child.material
        });

        index++;
      }
    });

    // Run auto-identification logic with current activePass
    piecesList = identifyZonesLogic(piecesList, activePass);

    camera.position.set(0, 10, 130);
    controls.target.set(0, 0, 0);
    controls.update();

    setPieces(piecesList);
    setLoading(false);
  }, [identifyZonesLogic, showBoundingBoxes, activePass]);

  // Synchronize dynamic visual flashing/coloring of identified meshes
  useEffect(() => {
    if (pieces.length === 0) return;

    // Check which zones are checked
    const activeZoneIds = Object.keys(activeZoneFilters).filter((k) => activeZoneFilters[k]);

    pieces.forEach((piece) => {
      const isPieceActive = piece.identifiedZone !== null && activeZoneFilters[piece.identifiedZone] === true;

      if (activeZoneIds.length > 0 && isPieceActive && piece.identifiedZone) {
        // Flash/apply bright indication color for this identified zone
        const highlightMat = zoneHighlightMaterials.get(piece.identifiedZone);
        if (highlightMat) {
          piece.mesh.material = highlightMat;
        }

        // Highlight its bounding box helper
        const zoneInfo = activeZonesList.find((z) => z.id === piece.identifiedZone);
        if (zoneInfo && piece.boxHelper) {
          (piece.boxHelper.material as THREE.LineBasicMaterial).color.setHex(zoneInfo.colorHexNum);
          (piece.boxHelper.material as THREE.LineBasicMaterial).opacity = 1.0;
        }
      } else {
        // Restore to original unaltered fabric material
        piece.mesh.material = piece.originalMaterial;

        // Reset bounding box opacity
        if (piece.boxHelper) {
          (piece.boxHelper.material as THREE.LineBasicMaterial).opacity = 0.35;
        }
      }
    });
  }, [activeZoneFilters, activeZonesList, pieces, zoneHighlightMaterials]);

  // Manual Trigger: Re-run Identification calculation
  const runIdentification = (overridePass?: "pass1" | "pass2") => {
    const targetPass = overridePass || activePass;
    setPieces((prev) => identifyZonesLogic(prev, targetPass));
    setIsIdentified(true);
  };

  // Switch Pass mode between Pass 1 and Pass 2
  const setPassMode = (newPass: "pass1" | "pass2") => {
    setActivePass(newPass);
    setPieces((prev) => identifyZonesLogic(prev, newPass));
    // If switching to Pass 2, make sure TRIMS is checked for immediate visualization
    if (newPass === "pass2") {
      setActiveZoneFilters((prev) => ({
        ...prev,
        TRIMS: true
      }));
    }
  };

  // Toggle single zone checkbox
  const toggleZoneCheckbox = (zoneId: string) => {
    setActiveZoneFilters((prev) => ({
      ...prev,
      [zoneId]: !prev[zoneId]
    }));
  };

  // Select all / Deselect all
  const setAllZones = (enabled: boolean) => {
    const updated: Record<string, boolean> = {};
    activeZonesList.forEach((z) => { updated[z.id] = enabled; });
    setActiveZoneFilters(updated);
  };

  // Fallback loader if MTL path resolution fails
  const fallbackDirectObjLoad = useCallback((
    objUrl: string,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls
  ) => {
    setLoadProgress("Loading raw OBJ model...");
    const objLoader = new OBJLoader();
    objLoader.load(
      objUrl,
      (object) => {
        const texLoader = new THREE.TextureLoader();
        const mainTex = texLoader.load("/models/mens_sweater/textures/卫衣面料.jpg");
        mainTex.wrapS = THREE.RepeatWrapping;
        mainTex.wrapT = THREE.RepeatWrapping;
        mainTex.repeat.set(4, 4);

        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              map: mainTex,
              color: 0xffffff,
              roughness: 0.75,
              metalness: 0.05,
              side: THREE.DoubleSide
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        processLoadedObject(object, scene, camera, controls);
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          setLoadProgress(`Downloading OBJ: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
        }
      },
      (err) => {
        console.error("Failed to load OBJ:", err);
        setLoadProgress("Failed to load model. Please check file path.");
        setLoading(false);
      }
    );
  }, [processLoadedObject]);

  // Load Model with OBJLoader + MTL Loader (Supports Topwear Sweater & Bottomwear Floral Pants)
  const loadGarmentModel = useCallback((
    targetType: "TOPWEAR" | "BOTTOMWEAR",
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls
  ) => {
    setLoading(true);
    setLoadProgress("Loading textures and material definitions...");

    const isBottom = targetType === "BOTTOMWEAR";
    const basePath = isBottom ? "/models/floral_pants/" : "/models/mens_sweater/";
    const mtlFile = isBottom ? "floral_pants.mtl" : "mens_sweater.mtl";
    const objFile = isBottom ? "floral_pants.obj" : "mens_sweater.obj";
    const objUrl = `${basePath}${objFile}`;

    try {
      const mtlLoader = new MTLLoader();
      mtlLoader.setPath(basePath);

      mtlLoader.load(
        mtlFile,
        (materials) => {
          materials.preload();
          setLoadProgress(`Parsing geometry structure (${isBottom ? "13MB Pants OBJ" : "15MB Sweater OBJ"})...`);

          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.setPath(basePath);

          objLoader.load(
            objFile,
            (object) => {
              processLoadedObject(object, scene, camera, controls);
            },
            (xhr) => {
              if (xhr.lengthComputable) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                setLoadProgress(`Loading geometry: ${percent}%`);
              }
            },
            (error) => {
              console.warn("MTL applied load failed, falling back to direct OBJ parser:", error);
              fallbackDirectObjLoad(objUrl, scene, camera, controls);
            }
          );
        },
        undefined,
        (error) => {
          console.warn("MTL load failed, loading OBJ directly:", error);
          fallbackDirectObjLoad(objUrl, scene, camera, controls);
        }
      );
    } catch (e) {
      console.error("Error initiating loader:", e);
      fallbackDirectObjLoad(objUrl, scene, camera, controls);
    }
  }, [fallbackDirectObjLoad, processLoadedObject]);

  // Setup Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 10, 130);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 1200;
    controls.minDistance = 10;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;
    controlsRef.current = controls;

    // 5. Grid helper & floor shadow plane
    const grid = new THREE.GridHelper(300, 30, 0x334155, 0x1e293b);
    grid.position.y = -50;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Shadow receiver plane
    const shadowGeo = new THREE.PlaneGeometry(600, 600);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -50.05;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
    shadowPlaneRef.current = shadowPlane;

    // 6. Lights
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;
    applyLighting(lightsGroup, lightingPreset, lightingIntensity);

    // 7. Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      if (boundsGroupRef.current && boundsGroupRef.current.visible) {
        boundsGroupRef.current.children.forEach((child) => {
          if (child instanceof THREE.BoxHelper) {
            child.update();
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Listener
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // 9. Load the Active Garment OBJ + Textures
    loadGarmentModel(garmentType, scene, camera, controls);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [applyLighting, autoRotate, bgColor, lightingIntensity, lightingPreset, loadGarmentModel, garmentType]);

  // Update background color
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(bgColor);
    }
  }, [bgColor]);

  // Update auto rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update grid visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
    if (shadowPlaneRef.current) {
      shadowPlaneRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Update bounding box group visibility
  useEffect(() => {
    if (boundsGroupRef.current) {
      boundsGroupRef.current.visible = showBoundingBoxes;
    }
  }, [showBoundingBoxes]);

  // Update lighting
  useEffect(() => {
    if (lightsGroupRef.current) {
      applyLighting(lightsGroupRef.current, lightingPreset, lightingIntensity);
    }
  }, [applyLighting, lightingPreset, lightingIntensity]);

  // Toggle wireframe on all meshes
  const toggleWireframe = () => {
    const nextState = !wireframe;
    setWireframe(nextState);

    if (!modelGroupRef.current) return;
    modelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => { m.wireframe = nextState; });
        } else {
          child.material.wireframe = nextState;
        }
      }
    });
  };

  // Toggle visibility of a specific piece
  const togglePieceVisibility = (pieceId: string) => {
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === pieceId) {
          const nextVis = !p.visible;
          p.mesh.visible = nextVis;
          p.boxHelper.visible = nextVis && showBoundingBoxes;
          return { ...p, visible: nextVis };
        }
        return p;
      })
    );
  };

  // Reset Camera View
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 10, 130);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // Set camera to front/back/side
  const setCameraView = (view: "front" | "back" | "left" | "right" | "top") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dist = 130;
    controlsRef.current.target.set(0, 0, 0);

    switch (view) {
      case "front":
        cameraRef.current.position.set(0, 0, dist);
        break;
      case "back":
        cameraRef.current.position.set(0, 0, -dist);
        break;
      case "left":
        cameraRef.current.position.set(-dist, 0, 0);
        break;
      case "right":
        cameraRef.current.position.set(dist, 0, 0);
        break;
      case "top":
        cameraRef.current.position.set(0, dist, 0.1);
        break;
    }
    controlsRef.current.update();
  };

  // Select piece and highlight its bounding box
  const selectPiece = (piece: MeshPieceInfo) => {
    const isAlreadySelected = piece.id === selectedPieceId;
    const nextSelectedId = isAlreadySelected ? null : piece.id;
    setSelectedPieceId(nextSelectedId);

    pieces.forEach((p) => {
      const isSel = p.id === nextSelectedId;
      const mat = p.boxHelper.material as THREE.LineBasicMaterial;
      if (mat) {
        mat.opacity = nextSelectedId === null ? 0.85 : isSel ? 1.0 : 0.25;
      }
    });
  };

  // Count identified patterns per zone
  const zoneCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeZonesList.forEach((z) => { counts[z.id] = 0; });
    pieces.forEach((p) => {
      if (p.identifiedZone && counts[p.identifiedZone] !== undefined) {
        counts[p.identifiedZone]++;
      }
    });
    return counts;
  }, [activeZonesList, pieces]);

  return (
    <div className="playground-container" style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      position: "relative",
      backgroundColor: bgColor,
      color: "#f8fafc",
      overflow: "hidden"
    }}>
      {/* Main Body */}
      <div style={{ display: "flex", flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Left Side: Panels & Materials Outliner */}
        <div style={{
          width: "300px",
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          zIndex: 10
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700" }}>
              <Layers size={14} color="#38bdf8" />
              <span>Garment Outliner ({pieces.length})</span>
            </div>
            <button
              onClick={() => {
                const allVis = pieces.every((p) => p.visible);
                setPieces((prev) =>
                  prev.map((p) => {
                    p.mesh.visible = !allVis;
                    p.boxHelper.visible = !allVis && showBoundingBoxes;
                    return { ...p, visible: !allVis };
                  })
                );
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              Toggle All
            </button>
          </div>

          {/* Pieces List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {pieces.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "40px 10px", fontSize: "12px" }}>
                Loading panels...
              </div>
            ) : (
              pieces.map((piece) => {
                const isSelected = piece.id === selectedPieceId;
                const zoneInfo = activeZonesList.find((z) => z.id === piece.identifiedZone);
                const isZoneChecked = piece.identifiedZone ? activeZoneFilters[piece.identifiedZone] : false;

                return (
                  <div
                    key={piece.id}
                    onClick={() => selectPiece(piece)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      marginBottom: "4px",
                      borderRadius: "6px",
                      background: isSelected 
                        ? `${piece.colorHex}25` 
                        : isZoneChecked 
                          ? `${zoneInfo?.color || "#38bdf8"}18` 
                          : "rgba(30, 41, 59, 0.45)",
                      border: isSelected 
                        ? `1.5px solid ${piece.colorHex}` 
                        : isZoneChecked 
                          ? `1px solid ${zoneInfo?.color || "#38bdf8"}66` 
                          : "1px solid rgba(255, 255, 255, 0.04)",
                      borderLeft: `4px solid ${zoneInfo?.color || piece.colorHex}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePieceVisibility(piece.id);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: piece.visible ? (zoneInfo?.color || piece.colorHex) : "#64748b",
                          cursor: "pointer",
                          padding: 0,
                          display: "flex"
                        }}
                      >
                        {piece.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "4px"
                        }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: piece.visible ? "#f1f5f9" : "#64748b",
                            textDecoration: piece.visible ? "none" : "line-through",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}>
                            {piece.name}
                          </span>
                          {zoneInfo ? (
                            <span style={{
                              fontSize: "9.5px",
                              color: zoneInfo.color,
                              background: `${zoneInfo.color}20`,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontWeight: "700",
                              whiteSpace: "nowrap"
                            }}>
                              {zoneInfo.name}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: "9px",
                              color: "#64748b",
                              background: "rgba(255, 255, 255, 0.05)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              fontWeight: "500",
                              whiteSpace: "nowrap"
                            }}>
                              Unassigned
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
                          <span>{piece.triangles.toLocaleString()} tris</span>
                          <span style={{ color: piece.isTrim ? "#f97316" : "#64748b" }} title={piece.trimReason || `UV Aspect: ${piece.uvAspect.toFixed(1)}, Vol: ${piece.bboxVolume.toFixed(0)}`}>
                            {piece.isTrim ? `Trim (UV ×${piece.uvAspect.toFixed(0)})` : `Z: ${piece.bboxCenter.z.toFixed(1)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3D Scene Viewport */}
        <div style={{ flex: 1, position: "relative", height: "100%" }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

          {/* Loading Overlay */}
          {loading && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(11, 15, 25, 0.85)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              zIndex: 30
            }}>
              <div style={{
                width: "42px",
                height: "42px",
                border: "3px solid rgba(56, 189, 248, 0.2)",
                borderTopColor: "#38bdf8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite"
              }} />
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>
                {loadProgress}
              </div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Top Center: Camera Presets */}
          <div style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "30px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            zIndex: 15
          }}>
            <button onClick={() => setCameraView("front")} style={cameraPillStyle}>Front</button>
            <button onClick={() => setCameraView("back")} style={cameraPillStyle}>Back</button>
            <button onClick={() => setCameraView("left")} style={cameraPillStyle}>Left</button>
            <button onClick={() => setCameraView("right")} style={cameraPillStyle}>Right</button>
            <button onClick={() => setCameraView("top")} style={cameraPillStyle}>Top</button>
            <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
            <button onClick={resetCamera} title="Reset View" style={{ ...cameraPillStyle, color: "#38bdf8", padding: "4px 8px" }}>
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Top Right: Bounding Box Zone Identification Inspection Panel */}
          <div style={{
            position: "absolute",
            top: "16px",
            right: "20px",
            width: "300px",
            background: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            overflow: "hidden",
            zIndex: 15
          }}>
            {/* Header with Identify Action Button */}
            <div style={{
              padding: "12px 14px",
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={16} color={activePass === "pass2" ? "#f97316" : "#38bdf8"} />
                <div>
                  <div style={{ fontWeight: "700", fontSize: "13px", letterSpacing: "-0.01em" }}>
                    {activePass === "pass2" ? "Pass 2: Trims & Accents" : "Pass 1: Macro Zones"}
                  </div>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {activePass === "pass2" ? "Lengthy UV & Small BBox Separation" : "Bounding Box Center Logic"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => runIdentification()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  background: activePass === "pass2" ? "linear-gradient(135deg, #ea580c, #f97316)" : "linear-gradient(135deg, #0284c7, #2563eb)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: activePass === "pass2" ? "0 0 10px rgba(249, 115, 22, 0.3)" : "0 0 10px rgba(56, 189, 248, 0.3)"
                }}
              >
                <span>Identify</span>
              </button>
            </div>

            {/* Category Switcher: Topwear vs Bottomwear */}
            <div style={{
              display: "flex",
              background: "rgba(15, 23, 42, 0.9)",
              padding: "4px 8px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              gap: "4px",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "600" }}>Category:</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => {
                    if (garmentType !== "TOPWEAR") {
                      setGarmentType("TOPWEAR");
                      if (sceneRef.current && cameraRef.current && controlsRef.current) {
                        loadGarmentModel("TOPWEAR", sceneRef.current, cameraRef.current, controlsRef.current);
                      }
                    }
                  }}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "none",
                    background: garmentType === "TOPWEAR" ? "#0284c7" : "rgba(255, 255, 255, 0.05)",
                    color: garmentType === "TOPWEAR" ? "#fff" : "#94a3b8",
                    fontSize: "10.5px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Topwear (Sweater)
                </button>
                <button
                  onClick={() => {
                    if (garmentType !== "BOTTOMWEAR") {
                      setGarmentType("BOTTOMWEAR");
                      if (sceneRef.current && cameraRef.current && controlsRef.current) {
                        loadGarmentModel("BOTTOMWEAR", sceneRef.current, cameraRef.current, controlsRef.current);
                      }
                    }
                  }}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "none",
                    background: garmentType === "BOTTOMWEAR" ? "#0284c7" : "rgba(255, 255, 255, 0.05)",
                    color: garmentType === "BOTTOMWEAR" ? "#fff" : "#94a3b8",
                    fontSize: "10.5px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Bottomwear (Floral Pants)
                </button>
              </div>
            </div>

            {/* Pass 1 vs Pass 2 Selector Tabs */}
            <div style={{
              display: "flex",
              background: "rgba(10, 15, 26, 0.7)",
              padding: "4px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              gap: "4px"
            }}>
              <button
                onClick={() => setPassMode("pass1")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  background: activePass === "pass1" ? "rgba(56, 189, 248, 0.2)" : "transparent",
                  color: activePass === "pass1" ? "#38bdf8" : "#94a3b8",
                  fontWeight: activePass === "pass1" ? "700" : "500",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  borderBottom: activePass === "pass1" ? "2px solid #38bdf8" : "2px solid transparent"
                }}
              >
                Pass 1 (Macro)
              </button>
              <button
                onClick={() => setPassMode("pass2")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  background: activePass === "pass2" ? "rgba(249, 115, 22, 0.2)" : "transparent",
                  color: activePass === "pass2" ? "#f97316" : "#94a3b8",
                  fontWeight: activePass === "pass2" ? "700" : "500",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  borderBottom: activePass === "pass2" ? "2px solid #f97316" : "2px solid transparent"
                }}
              >
                Pass 2 (Trims Isolated)
              </button>
            </div>

            {/* Quick Actions (Select All / Clear) */}
            <div style={{
              padding: "8px 14px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(15, 23, 42, 0.5)",
              fontSize: "11px"
            }}>
              <span style={{ color: "#94a3b8" }}>Highlight Zones:</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setAllZones(true)}
                  style={{ background: "transparent", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px" }}
                >
                  All
                </button>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <button
                  onClick={() => setAllZones(false)}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "11px" }}
                >
                  None
                </button>
              </div>
            </div>

            {/* Zones Checkboxes List */}
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {activeZonesList.map((zone) => {
                const isChecked = activeZoneFilters[zone.id] === true;
                const count = zoneCounts[zone.id] || 0;

                return (
                  <div
                    key={zone.id}
                    onClick={() => toggleZoneCheckbox(zone.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      background: isChecked ? `${zone.color}20` : "rgba(30, 41, 59, 0.35)",
                      border: isChecked ? `1px solid ${zone.color}66` : "1px solid rgba(255, 255, 255, 0.04)",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ color: isChecked ? zone.color : "#64748b", display: "flex" }}>
                        {isChecked ? <CheckSquare size={15} /> : <Square size={15} />}
                      </div>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: zone.color,
                          boxShadow: isChecked ? `0 0 8px ${zone.color}` : "none"
                        }}
                      />
                      <div>
                        <div style={{ fontSize: "11.5px", fontWeight: "600", color: isChecked ? "#fff" : "#cbd5e1" }}>
                          {zone.name}
                        </div>
                        <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>
                          {zone.description}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "2px 7px",
                      borderRadius: "10px",
                      background: count > 0 ? (isChecked ? zone.color : "rgba(255, 255, 255, 0.1)") : "rgba(255, 255, 255, 0.05)",
                      color: count > 0 ? (isChecked ? "#0f172a" : zone.color) : "#64748b"
                    }}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanatory Info footer */}
            <div style={{
              padding: "8px 12px",
              background: "rgba(10, 15, 26, 0.6)",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              fontSize: "10.5px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <CheckCircle2 size={13} color="#34d399" />
              <span>
                {activePass === "pass2" 
                  ? "Pass 2: Trims & stripes isolated via UV aspect ratio & small bbox size."
                  : "Pass 1: Macro anatomical zones via 3D bounding box center coordinates."}
              </span>
            </div>
          </div>

          {/* Quick Toolbar (Bottom Right) */}
          <div style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 15
          }}>
            {/* Bounding Boxes Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <BoxSelect size={13} color="#38bdf8" />
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Bounding Boxes</span>
              </div>
              <button
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                style={{
                  background: showBoundingBoxes ? "#38bdf8" : "rgba(255,255,255,0.1)",
                  color: showBoundingBoxes ? "#0f172a" : "#fff",
                  border: "none",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                {showBoundingBoxes ? "ON" : "OFF"}
              </button>
            </div>

            {/* Wireframe Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Wireframe</span>
              <button
                onClick={toggleWireframe}
                style={{
                  background: wireframe ? "#38bdf8" : "rgba(255,255,255,0.1)",
                  color: wireframe ? "#0f172a" : "#fff",
                  border: "none",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                {wireframe ? "ON" : "OFF"}
              </button>
            </div>

            {/* Grid Helper Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Floor Grid</span>
              <button
                onClick={() => setShowGrid(!showGrid)}
                style={{
                  background: showGrid ? "#38bdf8" : "rgba(255,255,255,0.1)",
                  color: showGrid ? "#0f172a" : "#fff",
                  border: "none",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                {showGrid ? "ON" : "OFF"}
              </button>
            </div>

            {/* Auto Rotate Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Turntable</span>
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                style={{
                  background: autoRotate ? "#38bdf8" : "rgba(255,255,255,0.1)",
                  color: autoRotate ? "#0f172a" : "#fff",
                  border: "none",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                {autoRotate ? "ON" : "OFF"}
              </button>
            </div>

            {/* Lighting presets */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Lighting</span>
              <select
                value={lightingPreset}
                onChange={(e) => setLightingPreset(e.target.value as any)}
                style={{
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#cbd5e1",
                  borderRadius: "4px",
                  fontSize: "10px",
                  padding: "2px 6px"
                }}
              >
                <option value="studio">Studio</option>
                <option value="warm">Warm</option>
                <option value="cyber">Cyber</option>
                <option value="soft">Overcast</option>
              </select>
            </div>

            {/* Intensity slider */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Intensity</span>
              <input
                type="range"
                min="0.4"
                max="2.5"
                step="0.1"
                value={lightingIntensity}
                onChange={(e) => setLightingIntensity(parseFloat(e.target.value))}
                style={{ width: "80px", cursor: "pointer" }}
              />
            </div>

            {/* Background color selection */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Canvas</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {["#0b0f19", "#181c27", "#020617", "#1e293b", "#ffffff"].map((c) => (
                  <div
                    key={c}
                    onClick={() => setBgColor(c)}
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      backgroundColor: c,
                      border: bgColor === c ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer"
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const cameraPillStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#cbd5e1",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: "600",
  cursor: "pointer"
};
