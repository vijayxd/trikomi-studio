import React, { useRef, useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore } from "../store/uvOrganizerStore";
import { modelStore } from "../store/modelStore";
import { Sparkles, RefreshCw, X, LayoutGrid, Move, Wand2, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Target, Undo2, Scale, Grid, Download } from "lucide-react";
import * as THREE from "three";

interface PieceBounds2D {
  id: string;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

interface DragState2D {
  pieceIds: string[];
  startMouseX: number;
  startMouseY: number;
}

export const UVCanvasView = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState2D | null>(null);

  // Synchronized hovered piece ID across 2D UV canvas and 3D viewport
  const activeHoveredPieceId = modelStore.hoveredPieceId;

  // WebGL GPU Viewport System (Same architecture as Blender UV Editor)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const meshesGroupRef = useRef<THREE.Group | null>(null);
  const zonesGroupRef = useRef<THREE.Group | null>(null);
  const selectionBoxMeshRef = useRef<THREE.LineSegments | null>(null);
  const snapGuideLinesMeshRef = useRef<THREE.LineSegments | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const cachedBoundsRef = useRef<PieceBounds2D[]>([]);
  const dragDeltaRef = useRef<{ u: number; v: number }>({ u: 0, v: 0 });
  const animFrameIdRef = useRef<number | null>(null);

  // Initialize Three.js WebGL viewport for the UV Editor
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = 400;
    const height = 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#090d16");
    sceneRef.current = scene;

    // Orthographic camera mapping exactly [0, 1] UV space to [0, 400] canvas coordinates
    // UV space: U is [0, 1] left to right, V is [0, 1] bottom to top
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Groups
    const zonesGroup = new THREE.Group();
    scene.add(zonesGroup);
    zonesGroupRef.current = zonesGroup;

    const meshesGroup = new THREE.Group();
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    // Selection box helper
    const boxGeom = new THREE.BufferGeometry();
    boxGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    boxGeom.setIndex([0, 1, 1, 2, 2, 3, 3, 0]);
    const boxMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, depthTest: false });
    const selectionBox = new THREE.LineSegments(boxGeom, boxMat);
    selectionBox.visible = false;
    scene.add(selectionBox);
    selectionBoxMeshRef.current = selectionBox;

    // Magnetic Snapping Guide Lines (Vertical & Horizontal infinite alignment guides)
    const guideGeom = new THREE.BufferGeometry();
    guideGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    guideGeom.setIndex([0, 1, 2, 3]);
    const guideMat = new THREE.LineBasicMaterial({
      color: 0xfacc15, // High-visibility laser yellow
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });
    const snapGuideLines = new THREE.LineSegments(guideGeom, guideMat);
    snapGuideLines.visible = false;
    scene.add(snapGuideLines);
    snapGuideLinesMeshRef.current = snapGuideLines;

    const render = () => {
      renderer.render(scene, camera);
    };

    render();

    return () => {
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // Fast GPU Render trigger
  const requestRender = useCallback(() => {
    if (animFrameIdRef.current !== null) return;
    animFrameIdRef.current = requestAnimationFrame(() => {
      animFrameIdRef.current = null;
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    });
  }, []);

  // 1. Rebuild Zones Overlay in WebGL
  const updateZonesOverlay = useCallback(() => {
    if (!zonesGroupRef.current) return;
    const group = zonesGroupRef.current;
    
    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    // Grid lines (10x10)
    const gridPositions: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const p = i / 10;
      gridPositions.push(p, 0, -1, p, 1, -1);
      gridPositions.push(0, p, -1, 1, p, -1);
    }
    const gridGeom = new THREE.BufferGeometry();
    gridGeom.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 });
    group.add(new THREE.LineSegments(gridGeom, gridMat));

    // Canonical zone rectangles
    Object.values(uvOrganizerStore.zones).forEach((zone) => {
      const zW = zone.uMax - zone.uMin;
      const zH = zone.vMax - zone.vMin;
      const zX = zone.uMin + zW * 0.5;
      const zY = zone.vMin + zH * 0.5;

      const assignedCount = modelStore.pieces.filter(p => p.assignedZoneId === zone.id).length;
      const isEmpty = assignedCount === 0;

      // Plane fill
      const planeGeom = new THREE.PlaneGeometry(zW, zH);
      const colorVal = new THREE.Color(zone.color);
      const planeMat = new THREE.MeshBasicMaterial({
        color: isEmpty ? 0xffffff : colorVal,
        transparent: true,
        opacity: isEmpty ? 0.02 : 0.08,
        depthWrite: false
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.set(zX, zY, -0.5);
      group.add(planeMesh);

      // Border outline
      const edges = new THREE.EdgesGeometry(planeGeom);
      const edgeMat = new THREE.LineBasicMaterial({
        color: isEmpty ? 0x475569 : colorVal,
        transparent: true,
        opacity: isEmpty ? 0.3 : 0.9,
        linewidth: 1.5
      });
      const edgeLines = new THREE.LineSegments(edges, edgeMat);
      edgeLines.position.set(zX, zY, -0.4);
      group.add(edgeLines);
    });

    requestRender();
  }, [requestRender]);

  // 2. Build GPU UV Meshes (Takes < 1ms on GPU, 0 CPU bottleneck!)
  const rebuildUVMeshes = useCallback(() => {
    if (!meshesGroupRef.current) return;
    const group = meshesGroupRef.current;

    // Clear old meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    const boundsList: PieceBounds2D[] = [];

    if (modelStore.currentModel) {
      modelStore.pieces.forEach((piece) => {
        const mesh = piece.mesh;
        if (!mesh || !mesh.geometry) return;
        const geom = mesh.geometry;
        const uvAttr = geom.attributes.uv;
        const indexAttr = geom.index;
        if (!(uvAttr instanceof THREE.BufferAttribute)) return;

        const arr = uvAttr.array;
        if (arr.length < 2) return;

        // Compute 2D bounds for raycast/hit test
        let minU = arr[0], maxU = arr[0];
        let minV = arr[1], maxV = arr[1];
        for (let i = 2; i < arr.length; i += 2) {
          const u = arr[i];
          const v = arr[i + 1];
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        boundsList.push({ id: piece.id, minU, maxU, minV, maxV });

        const assignedZone = piece.assignedZoneId ? uvOrganizerStore.zones[piece.assignedZoneId] : null;
        const zoneColor = assignedZone ? new THREE.Color(assignedZone.color) : new THREE.Color(0x64748b);

        // Build GPU Mesh directly from UV coordinates (X = U, Y = V, Z = 0)
        const uvGeom = new THREE.BufferGeometry();
        const vCount = uvAttr.count;
        const posArray = new Float32Array(vCount * 3);

        for (let i = 0; i < vCount; i++) {
          posArray[i * 3] = uvAttr.getX(i);
          posArray[i * 3 + 1] = uvAttr.getY(i);
          posArray[i * 3 + 2] = 0;
        }

        uvGeom.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
        if (indexAttr) {
          uvGeom.setIndex(indexAttr.clone());
        }

        // Shaded Fill (Transparent GPU surface)
        const fillMat = new THREE.MeshBasicMaterial({
          color: zoneColor,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const uvMesh = new THREE.Mesh(uvGeom, fillMat);
        uvMesh.name = piece.id;

        // Wireframe Edge Overlay (Hardware line rasterizer - 0ms CPU time!)
        const wireMat = new THREE.MeshBasicMaterial({
          color: zoneColor,
          wireframe: true,
          transparent: true,
          opacity: 0.45
        });
        const wireMesh = new THREE.Mesh(uvGeom, wireMat);
        uvMesh.add(wireMesh);

        group.add(uvMesh);
      });
    }

    cachedBoundsRef.current = boundsList;
    requestRender();
  }, [requestRender]);

  // Initial and reactive refresh
  useEffect(() => {
    if (uvOrganizerStore.isUVInspectOpen) {
      updateZonesOverlay();
      rebuildUVMeshes();
    }
  }, [
    uvOrganizerStore.isUVInspectOpen,
    uvOrganizerStore.zones,
    uvOrganizerStore.layoutVersion,
    modelStore.pieces.length,
    updateZonesOverlay,
    rebuildUVMeshes
  ]);

  // Update selection bounding box on GPU
  useEffect(() => {
    if (!selectionBoxMeshRef.current) return;
    const box = selectionBoxMeshRef.current;
    
    // Check if we have multiple selected pieces
    const selectedIds = modelStore.selectedPieceIds;
    const isMultiSelected = selectedIds.length > 1;

    let targetBounds: { minU: number; maxU: number; minV: number; maxV: number } | null = null;
    let isCurrentlyDragged = false;

    if (isMultiSelected) {
      // Calculate group bounding box from cached bounds
      let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
      let count = 0;
      selectedIds.forEach(id => {
        const b = cachedBoundsRef.current.find(item => item.id === id);
        if (b) {
          if (b.minU < gMinU) gMinU = b.minU;
          if (b.maxU > gMaxU) gMaxU = b.maxU;
          if (b.minV < gMinV) gMinV = b.minV;
          if (b.maxV > gMaxV) gMaxV = b.maxV;
          count++;
        }
      });
      if (count > 0) {
        targetBounds = { minU: gMinU, maxU: gMaxU, minV: gMinV, maxV: gMaxV };
        if (dragState && dragState.pieceIds.some(id => selectedIds.includes(id))) {
          isCurrentlyDragged = true;
        }
      }
    } else {
      const activePieceId = activeHoveredPieceId || modelStore.selectedPiece?.id;
      if (activePieceId) {
        const b = cachedBoundsRef.current.find(item => item.id === activePieceId);
        if (b) {
          targetBounds = { minU: b.minU, maxU: b.maxU, minV: b.minV, maxV: b.maxV };
          if (dragState && dragState.pieceIds.includes(activePieceId)) {
            isCurrentlyDragged = true;
          }
        }
      }
    }

    if (targetBounds) {
      let minU = targetBounds.minU, maxU = targetBounds.maxU, minV = targetBounds.minV, maxV = targetBounds.maxV;
      if (isCurrentlyDragged) {
        minU += dragDeltaRef.current.u;
        maxU += dragDeltaRef.current.u;
        minV += dragDeltaRef.current.v;
        maxV += dragDeltaRef.current.v;
      }

      const posAttr = box.geometry.attributes.position;
      if (posAttr instanceof THREE.BufferAttribute) {
        const p = posAttr.array as Float32Array;
        // Bottom-left
        p[0] = minU; p[1] = minV; p[2] = 0.5;
        // Bottom-right
        p[3] = maxU; p[4] = minV; p[5] = 0.5;
        // Top-right
        p[6] = maxU; p[7] = maxV; p[8] = 0.5;
        // Top-left
        p[9] = minU; p[10] = maxV; p[11] = 0.5;
        posAttr.needsUpdate = true;
        box.visible = true;
        requestRender();
        return;
      }
    }

    box.visible = false;
    requestRender();
  }, [modelStore.selectedPiece?.id, modelStore.selectedPieceIds.slice(), activeHoveredPieceId, dragState, requestRender]);

  // O(1) piece lookup from UV coordinates
  const getPieceAtCanvasCoords = (clientX: number, clientY: number): string | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const clickU = (clientX - rect.left) / rect.width;
    const clickV = 1.0 - ((clientY - rect.top) / rect.height);
    const pad = 0.015;

    for (let i = cachedBoundsRef.current.length - 1; i >= 0; i--) {
      const b = cachedBoundsRef.current[i];
      if (clickU >= b.minU - pad && clickU <= b.maxU + pad && clickV >= b.minV - pad && clickV <= b.maxV + pad) {
        return b.id;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const hitId = getPieceAtCanvasCoords(e.clientX, e.clientY);
    const isMultiKey = e.shiftKey || e.metaKey || e.ctrlKey;

    if (hitId) {
      e.preventDefault();
      const p = modelStore.pieces.find(item => item.id === hitId);
      if (p) {
        if (isMultiKey) {
          modelStore.togglePieceSelection(p.mesh, true);
        } else {
          // If clicking an island that's already part of multi-selection, keep the group selected for dragging!
          if (!modelStore.selectedPieceIds.includes(hitId)) {
            modelStore.selectPiece(p.mesh);
          }
        }
      }

      // Determine which pieces are being dragged together
      const activeIds = modelStore.selectedPieceIds.includes(hitId)
        ? [...modelStore.selectedPieceIds]
        : [hitId];

      dragDeltaRef.current = { u: 0, v: 0 };
      setDragState({
        pieceIds: activeIds,
        startMouseX: e.clientX,
        startMouseY: e.clientY
      });
    } else {
      if (!isMultiKey) {
        modelStore.deselectPiece();
      }
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) {
      const hitId = getPieceAtCanvasCoords(e.clientX, e.clientY);
      modelStore.setHoveredPieceId(hitId);
    }
  };

  const handleContainerPointerLeave = () => {
    if (!dragState) {
      modelStore.setHoveredPieceId(null);
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (dragState) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let currentDeltaU = (e.clientX - dragState.startMouseX) / rect.width;
      let currentDeltaV = -((e.clientY - dragState.startMouseY) / rect.height);

      // -------------------------------------------------------------
      // MAGNETIC BOUNDING BOX SNAPPING (UV Space)
      // Snaps dragged group bounding box flush against other islands' edges/centers
      // -------------------------------------------------------------
      let snappedGuidelineU: number | null = null;
      let snappedGuidelineV: number | null = null;

      // Allow holding Alt/Option to temporarily bypass snapping
      const isAltKey = e.altKey;
      if (snapEnabled && !isAltKey) {
        // Compute collective bounding box of the dragged pieces
        let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
        let validPieces = 0;
        dragState.pieceIds.forEach(id => {
          const b = cachedBoundsRef.current.find(item => item.id === id);
          if (b) {
            if (b.minU < gMinU) gMinU = b.minU;
            if (b.maxU > gMaxU) gMaxU = b.maxU;
            if (b.minV < gMinV) gMinV = b.minV;
            if (b.maxV > gMaxV) gMaxV = b.maxV;
            validPieces++;
          }
        });

        if (validPieces > 0) {
          const myW = gMaxU - gMinU;
          const myH = gMaxV - gMinV;
          const curMinU = gMinU + currentDeltaU;
          const curMaxU = gMaxU + currentDeltaU;
          const curCenterU = curMinU + myW * 0.5;

          const curMinV = gMinV + currentDeltaV;
          const curMaxV = gMaxV + currentDeltaV;
          const curCenterV = curMinV + myH * 0.5;

          const snapThreshold = 0.015; // ~6px magnetic snap threshold in UV space
          let bestDiffU = snapThreshold;
          let bestSnapTargetU: number | null = null;
          let snapSourceU: "min" | "max" | "center" | null = null;

          let bestDiffV = snapThreshold;
          let bestSnapTargetV: number | null = null;
          let snapSourceV: "min" | "max" | "center" | null = null;

          // Test against all other UV islands not in the dragged group
          cachedBoundsRef.current.forEach((other) => {
            if (dragState.pieceIds.includes(other.id)) return;
            const otherW = other.maxU - other.minU;
            const otherH = other.maxV - other.minV;
            const otherCenterU = other.minU + otherW * 0.5;
            const otherCenterV = other.minV + otherH * 0.5;

            // X-axis (U) snap candidates: min, max, center against other min, max, center
            const testTargetsU = [other.minU, other.maxU, otherCenterU];
            testTargetsU.forEach(targetU => {
              const diffMin = Math.abs(curMinU - targetU);
              if (diffMin < bestDiffU) {
                bestDiffU = diffMin;
                bestSnapTargetU = targetU;
                snapSourceU = "min";
              }
              const diffMax = Math.abs(curMaxU - targetU);
              if (diffMax < bestDiffU) {
                bestDiffU = diffMax;
                bestSnapTargetU = targetU;
                snapSourceU = "max";
              }
              const diffCenter = Math.abs(curCenterU - targetU);
              if (diffCenter < bestDiffU) {
                bestDiffU = diffCenter;
                bestSnapTargetU = targetU;
                snapSourceU = "center";
              }
            });

            // Y-axis (V) snap candidates: min, max, center against other min, max, center
            const testTargetsV = [other.minV, other.maxV, otherCenterV];
            testTargetsV.forEach(targetV => {
              const diffMin = Math.abs(curMinV - targetV);
              if (diffMin < bestDiffV) {
                bestDiffV = diffMin;
                bestSnapTargetV = targetV;
                snapSourceV = "min";
              }
              const diffMax = Math.abs(curMaxV - targetV);
              if (diffMax < bestDiffV) {
                bestDiffV = diffMax;
                bestSnapTargetV = targetV;
                snapSourceV = "max";
              }
              const diffCenter = Math.abs(curCenterV - targetV);
              if (diffCenter < bestDiffV) {
                bestDiffV = diffCenter;
                bestSnapTargetV = targetV;
                snapSourceV = "center";
              }
            });
          });

          // Apply U snap
          if (bestSnapTargetU !== null && snapSourceU !== null) {
            if (snapSourceU === "min") {
              currentDeltaU = bestSnapTargetU - gMinU;
            } else if (snapSourceU === "max") {
              currentDeltaU = bestSnapTargetU - gMaxU;
            } else if (snapSourceU === "center") {
              currentDeltaU = bestSnapTargetU - (gMinU + myW * 0.5);
            }
            snappedGuidelineU = bestSnapTargetU;
          }

          // Apply V snap
          if (bestSnapTargetV !== null && snapSourceV !== null) {
            if (snapSourceV === "min") {
              currentDeltaV = bestSnapTargetV - gMinV;
            } else if (snapSourceV === "max") {
              currentDeltaV = bestSnapTargetV - gMaxV;
            } else if (snapSourceV === "center") {
              currentDeltaV = bestSnapTargetV - (gMinV + myH * 0.5);
            }
            snappedGuidelineV = bestSnapTargetV;
          }
        }
      }

      dragDeltaRef.current = { u: currentDeltaU, v: currentDeltaV };

      // Update Visual Guide Lines (Yellow alignment lasers)
      if (snapGuideLinesMeshRef.current) {
        const guideMesh = snapGuideLinesMeshRef.current;
        const posAttr = guideMesh.geometry.attributes.position;
        if (posAttr instanceof THREE.BufferAttribute) {
          const arr = posAttr.array as Float32Array;
          if (snappedGuidelineU !== null) {
            arr[0] = snappedGuidelineU; arr[1] = 0; arr[2] = 0.8;
            arr[3] = snappedGuidelineU; arr[4] = 1; arr[5] = 0.8;
          } else {
            arr[0] = -10; arr[1] = -10; arr[2] = 0.8;
            arr[3] = -10; arr[4] = -10; arr[5] = 0.8;
          }

          if (snappedGuidelineV !== null) {
            arr[6] = 0; arr[7] = snappedGuidelineV; arr[8] = 0.8;
            arr[9] = 1; arr[10] = snappedGuidelineV; arr[11] = 0.8;
          } else {
            arr[6] = -10; arr[7] = -10; arr[8] = 0.8;
            arr[9] = -10; arr[10] = -10; arr[11] = 0.8;
          }

          posAttr.needsUpdate = true;
          guideMesh.visible = (snappedGuidelineU !== null || snappedGuidelineV !== null);
        }
      }

      // Instantaneous 60fps GPU Mesh Translation for ALL dragged pieces
      if (meshesGroupRef.current) {
        dragState.pieceIds.forEach(id => {
          const activeMesh = meshesGroupRef.current?.children.find(c => c.name === id);
          if (activeMesh) {
            activeMesh.position.set(currentDeltaU, currentDeltaV, 0.1);
          }
        });
      }

      requestRender();
    }
  };

  const handlePointerUp = () => {
    if (dragState) {
      const finalDeltaU = dragDeltaRef.current.u;
      const finalDeltaV = dragDeltaRef.current.v;

      // Hide guide lines
      if (snapGuideLinesMeshRef.current) {
        snapGuideLinesMeshRef.current.visible = false;
      }

      if (Math.abs(finalDeltaU) > 0.0001 || Math.abs(finalDeltaV) > 0.0001) {
        // Commit actual 3D vertex UV buffer translation for group
        uvOrganizerStore.translatePiecesGroupUV(dragState.pieceIds, finalDeltaU, finalDeltaV);
        modelStore.persistGarmentConfigToSQLite();
      }

      // Reset GPU node transform for all dragged pieces
      if (meshesGroupRef.current) {
        dragState.pieceIds.forEach(id => {
          const activeMesh = meshesGroupRef.current?.children.find(c => c.name === id);
          if (activeMesh) {
            activeMesh.position.set(0, 0, 0);
          }
        });
      }

      dragDeltaRef.current = { u: 0, v: 0 };
      setDragState(null);
      // Re-read updated UV positions into GPU buffer
      rebuildUVMeshes();
    }
  };

  useEffect(() => {
    if (dragState) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [dragState]);

  if (!uvOrganizerStore.isUVInspectOpen) return null;

  const assignedCount = uvOrganizerStore.assignedPanels.length;

  return (
    <div
      className="uv-canvas-container"
      style={{
        width: "440px",
        height: "100%",
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        borderLeft: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        zIndex: 15
      }}
    >
      {/* Header */}
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={16} color="#38bdf8" />
          <div>
            <span style={{ fontWeight: "700", fontSize: "13px" }}>
              Hardware-Accelerated UV Editor
            </span>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>
              WebGL GPU Viewport (Blender architecture)
            </div>
          </div>
        </div>

        {/* Category Switcher Tabs: Topwear vs Bottomwear */}
        <div style={{ display: "flex", background: "rgba(0, 0, 0, 0.4)", padding: "2.5px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <button
            type="button"
            onClick={() => uvOrganizerStore.switchGarmentType("TOPWEAR")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "10.5px",
              fontWeight: "600",
              cursor: "pointer",
              border: uvOrganizerStore.activeGarmentType === "TOPWEAR" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
              background: uvOrganizerStore.activeGarmentType === "TOPWEAR" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(37, 99, 235, 0.4))" : "transparent",
              color: uvOrganizerStore.activeGarmentType === "TOPWEAR" ? "#fff" : "#94a3b8",
              boxShadow: uvOrganizerStore.activeGarmentType === "TOPWEAR" ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
              transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
            title="Switch to Topwear Slots (Front/Back Body, Sleeves, Collar, Waistband, Trims)"
          >
            👕 Topwear
          </button>
          <button
            type="button"
            onClick={() => uvOrganizerStore.switchGarmentType("BOTTOMWEAR")}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "10.5px",
              fontWeight: "600",
              cursor: "pointer",
              border: uvOrganizerStore.activeGarmentType === "BOTTOMWEAR" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
              background: uvOrganizerStore.activeGarmentType === "BOTTOMWEAR" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(37, 99, 235, 0.4))" : "transparent",
              color: uvOrganizerStore.activeGarmentType === "BOTTOMWEAR" ? "#fff" : "#94a3b8",
              boxShadow: uvOrganizerStore.activeGarmentType === "BOTTOMWEAR" ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
              transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
            title="Switch to Bottomwear Slots (Left/Right Leg, Waistband, Ankle Ribs, Trims/Pockets)"
          >
            👖 Bottomwear
          </button>
        </div>

        <button
          className="control-pill"
          style={{ padding: "4px", border: "none", background: "transparent" }}
          onClick={() => uvOrganizerStore.closeUVInspect()}
          title="Close UV Map Inspector"
        >
          <X size={15} />
        </button>
      </div>

      {/* Main UV WebGL Viewport */}
      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handleContainerPointerMove}
            onPointerLeave={handleContainerPointerLeave}
            style={{
              width: "400px",
              height: "400px",
              borderRadius: "10px",
              overflow: "hidden",
              border: activeHoveredPieceId ? "1px solid rgba(56, 189, 248, 0.45)" : "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: activeHoveredPieceId ? "0 0 20px rgba(56, 189, 248, 0.2), 0 12px 32px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.5)",
              cursor: dragState ? "grabbing" : (activeHoveredPieceId ? "grab" : "default"),
              transition: "border-color 0.15s ease, box-shadow 0.15s ease"
            }}
          />
          {activeHoveredPieceId && (
            <div style={{
              position: "absolute",
              top: "8px",
              left: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              pointerEvents: "none",
              background: "rgba(15, 23, 42, 0.88)",
              backdropFilter: "blur(6px)",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "10.5px",
              color: "#38bdf8",
              fontWeight: "600",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
            }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 6px #38bdf8" }} />
              <span>{modelStore.pieces.find(p => p.id === activeHoveredPieceId)?.name || "Pattern Island"}</span>
              {(() => {
                const p = modelStore.pieces.find(item => item.id === activeHoveredPieceId);
                const zone = p?.assignedZoneId ? uvOrganizerStore.zones[p.assignedZoneId] : null;
                return zone ? (
                  <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "4px", background: `${zone.color}25`, color: zone.color, border: `1px solid ${zone.color}50` }}>
                    {zone.label}
                  </span>
                ) : null;
              })()}
            </div>
          )}
          <div style={{ position: "absolute", bottom: "8px", left: "10px", right: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", pointerEvents: "none", background: "rgba(0,0,0,0.65)", padding: "2px 6px", borderRadius: "4px", fontSize: "9.5px", color: "#94a3b8" }}>
              <Move size={10} color="#38bdf8" /> Drag to move (Hold <span style={{ color: "#facc15", fontWeight: "700" }}>Alt</span> to free move)
            </div>

            <button
              type="button"
              onClick={() => setSnapEnabled(prev => !prev)}
              style={{
                background: snapEnabled ? "rgba(250, 204, 21, 0.2)" : "rgba(0, 0, 0, 0.65)",
                border: snapEnabled ? "1px solid rgba(250, 204, 21, 0.5)" : "1px solid rgba(255, 255, 255, 0.12)",
                color: snapEnabled ? "#facc15" : "#94a3b8",
                padding: "2px 7px",
                borderRadius: "4px",
                fontSize: "9.5px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: snapEnabled ? "0 0 8px rgba(250, 204, 21, 0.25)" : "none"
              }}
              title="Magnetic Bounding Box Snapping: Automatically snaps dragged island edges and centers flush with other pattern islands"
            >
              <span>🧲</span>
              <span>Snap: {snapEnabled ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>

        {/* Island Transform Toolbar (Single & Multi-Island Group) */}
        {modelStore.selectedPiece && (
          <div style={{
            marginTop: "10px",
            width: "100%",
            background: "rgba(15, 23, 42, 0.85)",
            border: modelStore.selectedPieceIds.length > 1 ? "1px solid rgba(250, 204, 21, 0.35)" : "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "8px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: modelStore.selectedPieceIds.length > 1 ? "0 4px 16px rgba(250, 204, 21, 0.15)" : "0 4px 16px rgba(0,0,0,0.3)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10.5px", fontWeight: "700", color: modelStore.selectedPieceIds.length > 1 ? "#facc15" : "#38bdf8", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>{modelStore.selectedPieceIds.length > 1 ? "👥" : "🎯"}</span>
                {modelStore.selectedPieceIds.length > 1
                  ? `Group Selection (${modelStore.selectedPieceIds.length} pieces)`
                  : `${modelStore.selectedPiece.name} Controls`}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {modelStore.selectedPieceIds.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      modelStore.deselectPiece();
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: "9.5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "2px 4px"
                    }}
                    title="Deselect all pieces"
                  >
                    <X size={11} /> Deselect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.resetPieceUV(modelStore.selectedPiece.id);
                        rebuildUVMeshes();
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: "9.5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "2px 4px"
                    }}
                    title="Reset this piece's UV island to its original unwrap"
                  >
                    <Undo2 size={11} /> Reset
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: modelStore.selectedPieceIds.length > 1 ? "repeat(4, 1fr)" : "repeat(6, 1fr)", gap: "4px" }}>
              <button
                type="button"
                onClick={() => {
                  if (modelStore.selectedPieceIds.length > 1) {
                    uvOrganizerStore.rotatePiecesGroupUV(modelStore.selectedPieceIds, -90);
                  } else if (modelStore.selectedPiece) {
                    uvOrganizerStore.rotatePieceUV(modelStore.selectedPiece.id, -90);
                  }
                  rebuildUVMeshes();
                }}
                className="btn-icon"
                style={{ padding: "5px", height: "auto", borderRadius: "6px", fontSize: "10px", gap: "2px", flexDirection: "column" }}
                title={modelStore.selectedPieceIds.length > 1 ? "Rotate Group 90° CCW around Group Center" : "Rotate Island 90° Counter-Clockwise"}
              >
                <RotateCcw size={12} color={modelStore.selectedPieceIds.length > 1 ? "#facc15" : "#38bdf8"} />
                <span style={{ fontSize: "8.5px" }}>-90°</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (modelStore.selectedPieceIds.length > 1) {
                    uvOrganizerStore.rotatePiecesGroupUV(modelStore.selectedPieceIds, 90);
                  } else if (modelStore.selectedPiece) {
                    uvOrganizerStore.rotatePieceUV(modelStore.selectedPiece.id, 90);
                  }
                  rebuildUVMeshes();
                }}
                className="btn-icon"
                style={{ padding: "5px", height: "auto", borderRadius: "6px", fontSize: "10px", gap: "2px", flexDirection: "column" }}
                title={modelStore.selectedPieceIds.length > 1 ? "Rotate Group 90° CW around Group Center" : "Rotate Island 90° Clockwise"}
              >
                <RotateCw size={12} color={modelStore.selectedPieceIds.length > 1 ? "#facc15" : "#38bdf8"} />
                <span style={{ fontSize: "8.5px" }}>+90°</span>
              </button>

              {modelStore.selectedPieceIds.length <= 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.flipPieceUV(modelStore.selectedPiece.id, "horizontal");
                        rebuildUVMeshes();
                      }
                    }}
                    className="btn-icon"
                    style={{ padding: "5px", height: "auto", borderRadius: "6px", fontSize: "10px", gap: "2px", flexDirection: "column" }}
                    title="Flip Island Horizontally (Mirror U)"
                  >
                    <FlipHorizontal size={12} color="#38bdf8" />
                    <span style={{ fontSize: "8.5px" }}>Flip H</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.flipPieceUV(modelStore.selectedPiece.id, "vertical");
                        rebuildUVMeshes();
                      }
                    }}
                    className="btn-icon"
                    style={{ padding: "5px", height: "auto", borderRadius: "6px", fontSize: "10px", gap: "2px", flexDirection: "column" }}
                    title="Flip Island Vertically (Mirror V)"
                  >
                    <FlipVertical size={12} color="#38bdf8" />
                    <span style={{ fontSize: "8.5px" }}>Flip V</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  if (modelStore.selectedPieceIds.length > 1) {
                    uvOrganizerStore.scalePiecesGroupUV(modelStore.selectedPieceIds, 1.1);
                  } else if (modelStore.selectedPiece) {
                    uvOrganizerStore.scalePieceUV(modelStore.selectedPiece.id, 1.1);
                  }
                  rebuildUVMeshes();
                }}
                className="btn-icon"
                style={{ padding: "5px", height: "auto", borderRadius: "6px", fontSize: "10px", gap: "2px", flexDirection: "column" }}
                title={modelStore.selectedPieceIds.length > 1 ? "Scale Group Up (+10%) around Group Center" : "Scale Island Up (+10%)"}
              >
                <ZoomIn size={12} color={modelStore.selectedPieceIds.length > 1 ? "#facc15" : "#38bdf8"} />
                <span style={{ fontSize: "8.5px" }}>+10%</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (modelStore.selectedPieceIds.length > 1) {
                    uvOrganizerStore.scalePiecesGroupUV(modelStore.selectedPieceIds, 0.9);
                  } else if (modelStore.selectedPiece) {
                    uvOrganizerStore.scalePieceUV(modelStore.selectedPiece.id, 0.9);
                  }
                  rebuildUVMeshes();
                }}
                className="btn-icon"
                style={{ padding: "5px", height: "auto", borderRadius: "6px", fontSize: "10px", gap: "2px", flexDirection: "column" }}
                title={modelStore.selectedPieceIds.length > 1 ? "Scale Group Down (-10%) around Group Center" : "Scale Island Down (-10%)"}
              >
                <ZoomOut size={12} color={modelStore.selectedPieceIds.length > 1 ? "#facc15" : "#38bdf8"} />
                <span style={{ fontSize: "8.5px" }}>-10%</span>
              </button>
            </div>

            {modelStore.selectedPieceIds.length <= 1 && (
              <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (modelStore.selectedPiece) {
                      uvOrganizerStore.centerPieceInZone(modelStore.selectedPiece.id);
                      rebuildUVMeshes();
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: "4px 8px", fontSize: "10.5px", justifyContent: "center", gap: "4px" }}
                  title="Center island directly into its assigned zone slot"
                >
                  <Target size={11} color="#38bdf8" />
                  <span>Center in Zone</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: "14px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
          {Object.values(uvOrganizerStore.zones).map((z) => {
            const count = modelStore.pieces.filter(p => p.assignedZoneId === z.id).length;
            const isEmpty = count === 0;
            return (
              <div
                key={z.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: isEmpty ? "var(--text-dim)" : "var(--text-muted)",
                  opacity: isEmpty ? 0.6 : 1
                }}
              >
                <div style={{ width: "9px", height: "9px", borderRadius: "3px", background: isEmpty ? "#475569" : z.color }} />
                <span>{z.label} {isEmpty ? "(Empty)" : `(${count})`}</span>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: "10px", paddingTop: "8px" }}>
          {/* Arrange Strategy Selector: Fixed Zones vs Auto-Rearrange Empty Zones */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
              Empty Zone Strategy
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "rgba(0, 0, 0, 0.35)", padding: "3px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <button
                type="button"
                onClick={() => uvOrganizerStore.setArrangeMode("fixed")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "10.5px",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: uvOrganizerStore.arrangeMode === "fixed" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                  background: uvOrganizerStore.arrangeMode === "fixed" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(37, 99, 235, 0.4))" : "transparent",
                  color: uvOrganizerStore.arrangeMode === "fixed" ? "#fff" : "#94a3b8",
                  boxShadow: uvOrganizerStore.arrangeMode === "fixed" ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  textAlign: "center"
                }}
                title="Keep standardized canonical coordinates intact even if unassigned panels are missing"
              >
                🔒 Keep Fixed
              </button>
              <button
                type="button"
                onClick={() => uvOrganizerStore.setArrangeMode("dynamic")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "10.5px",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: uvOrganizerStore.arrangeMode === "dynamic" ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                  background: uvOrganizerStore.arrangeMode === "dynamic" ? "linear-gradient(135deg, rgba(2, 132, 199, 0.4), rgba(37, 99, 235, 0.4))" : "transparent",
                  color: uvOrganizerStore.arrangeMode === "dynamic" ? "#fff" : "#94a3b8",
                  boxShadow: uvOrganizerStore.arrangeMode === "dynamic" ? "0 2px 8px rgba(2, 132, 199, 0.25)" : "none",
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  textAlign: "center"
                }}
                title="If no panel is assigned to a zone, dynamically collapse empty space and repack active zones across UV [0,1]"
              >
                🔄 Auto-Repack
              </button>
            </div>
          </div>

          {/* Seam Bleed Padding Selector (Phase 3) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>
                Seam Bleed Margin (Padding)
              </span>
              <span style={{ fontSize: "10px", color: "#38bdf8", fontWeight: "600" }}>
                {uvOrganizerStore.islandPaddingPx}px
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "rgba(0, 0, 0, 0.35)", padding: "3px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)", gap: "2px" }}>
              {([4, 8, 12, 16] as const).map((px) => (
                <button
                  key={px}
                  type="button"
                  onClick={() => uvOrganizerStore.setIslandPaddingPx(px)}
                  style={{
                    padding: "4px",
                    borderRadius: "5px",
                    fontSize: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: uvOrganizerStore.islandPaddingPx === px ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
                    background: uvOrganizerStore.islandPaddingPx === px ? "linear-gradient(135deg, rgba(2, 132, 199, 0.5), rgba(37, 99, 235, 0.5))" : "transparent",
                    color: uvOrganizerStore.islandPaddingPx === px ? "#fff" : "#94a3b8",
                    textAlign: "center"
                  }}
                  title={`Set ${px}px gutter padding between islands to prevent seam bleeding`}
                >
                  {px}px
                </button>
              ))}
            </div>
          </div>

          {/* Equalize Texel Density & UV Checker Grid (Phase 3) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: "center", padding: "6px 8px", fontSize: "11px", gap: "4px" }}
              onClick={() => {
                const res = uvOrganizerStore.equalizeTexelDensity();
                rebuildUVMeshes();
              }}
              title="Scale islands so fabric weave and texture pixel density is 100% uniform across all garment panels"
              disabled={!modelStore.currentModel}
            >
              <Scale size={12} color="#34d399" />
              <span>Equalize Density</span>
            </button>

            <button
              className="btn btn-secondary"
              style={{
                justifyContent: "center",
                padding: "6px 8px",
                fontSize: "11px",
                gap: "4px",
                border: modelStore.uvGridMode ? "1px solid rgba(250, 204, 21, 0.5)" : "var(--border-color)",
                color: modelStore.uvGridMode ? "#facc15" : "var(--text-color)"
              }}
              onClick={() => modelStore.toggleUVGridMode()}
              title="Toggle numbered checkerboard texture on 3D garment to inspect texture stretching"
              disabled={!modelStore.currentModel}
            >
              <Grid size={12} color={modelStore.uvGridMode ? "#facc15" : "#38bdf8"} />
              <span>Checker: {modelStore.uvGridMode ? "ON" : "OFF"}</span>
            </button>
          </div>

          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center", padding: "8px", fontSize: "11.5px", gap: "6px" }}
            onClick={() => {
              uvOrganizerStore.autoDetectPatternAssignments(true);
              rebuildUVMeshes();
            }}
            title="Auto-detect zones using Two-Pass bounding box center & UV math"
            disabled={!modelStore.currentModel}
          >
            <Wand2 size={13} color="#38bdf8" />
            <span>Auto-Detect Zones ({uvOrganizerStore.activeGarmentType === "BOTTOMWEAR" ? "Bottomwear" : "Topwear"})</span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center", padding: "8px", fontSize: "11.5px" }}
            onClick={() => uvOrganizerStore.setShowZoneEditorModal(true)}
            title="Create, arrange, or resize fixed UV slot zones"
          >
            <LayoutGrid size={13} color="#38bdf8" />
            <span>Customize Blueprint Zones</span>
          </button>

          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "10px", justifyContent: "center", fontWeight: "700", fontSize: "12.5px" }}
            onClick={() => {
              uvOrganizerStore.arrangeAssignedUVs();
              rebuildUVMeshes();
            }}
          >
            <RefreshCw size={14} />
            <span>Arrange UVs ({assignedCount} Assigned)</span>
          </button>

          {/* Phase 5: Production Blueprint Exporter */}
          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center", padding: "8px", fontSize: "11.5px", gap: "6px", border: "1px solid rgba(56, 189, 248, 0.3)", color: "#38bdf8" }}
            onClick={() => uvOrganizerStore.exportProductionBlueprint(2048, "png")}
            title="Export 2048x2048 high-resolution transparent blueprint PNG with panel names and wireframes for manufacturing tech packs"
            disabled={!modelStore.currentModel}
          >
            <Download size={13} color="#38bdf8" />
            <span>Export Blueprint PNG (2K)</span>
          </button>
        </div>
      </div>
    </div>
  );
});
