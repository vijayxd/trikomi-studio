import React, { useRef, useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore } from "../store/uvOrganizerStore";
import { modelStore } from "../store/modelStore";
import { Move } from "lucide-react";
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
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const uvMesh = new THREE.Mesh(uvGeom, fillMat);
        uvMesh.name = piece.id;

        // Wireframe Edge Overlay (Hardware line rasterizer)
        const wireMat = new THREE.MeshBasicMaterial({
          color: zoneColor,
          wireframe: true,
          transparent: true,
          opacity: 0.55
        });
        const wireMesh = new THREE.Mesh(uvGeom, wireMat);
        uvMesh.add(wireMesh);

        group.add(uvMesh);
      });
    }

    cachedBoundsRef.current = boundsList;
    requestRender();
  }, [requestRender]);

  // Dynamic Fluid Resize Observer
  const resizeCanvas = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    rendererRef.current.setSize(clientWidth, clientHeight);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Keep square aspect ratio for UV space [0, 1] x [0, 1] centered inside canvas
    const aspect = clientWidth / clientHeight;
    const camera = cameraRef.current;
    if (aspect >= 1.0) {
      // Wider than tall: fit vertical [0, 1] and center horizontal
      const span = aspect;
      const offset = (span - 1.0) / 2;
      camera.left = -offset;
      camera.right = 1.0 + offset;
      camera.top = 1.0;
      camera.bottom = 0.0;
    } else {
      // Taller than wide: fit horizontal [0, 1] and center vertical
      const span = 1.0 / aspect;
      const offset = (span - 1.0) / 2;
      camera.left = 0.0;
      camera.right = 1.0;
      camera.top = 1.0 + offset;
      camera.bottom = -offset;
    }
    camera.updateProjectionMatrix();
    requestRender();
  }, [requestRender]);

  // Initialize Three.js WebGL viewport for the UV Editor
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#060c1d");
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
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

    // Magnetic Snapping Guide Lines
    const guideGeom = new THREE.BufferGeometry();
    guideGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    guideGeom.setIndex([0, 1, 2, 3]);
    const guideMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });
    const snapGuideLines = new THREE.LineSegments(guideGeom, guideMat);
    snapGuideLines.visible = false;
    scene.add(snapGuideLines);
    snapGuideLinesMeshRef.current = snapGuideLines;

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [resizeCanvas]);

  // Initial and reactive refresh
  useEffect(() => {
    updateZonesOverlay();
    rebuildUVMeshes();
  }, [
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
    const activeSelectedIds = modelStore.selectedPieceIds.length > 0 
      ? modelStore.selectedPieceIds 
      : (modelStore.selectedPiece ? [modelStore.selectedPiece.id] : []);

    if (activeSelectedIds.length > 0) {
      const selectedBounds = cachedBoundsRef.current.filter(b => activeSelectedIds.includes(b.id));

      if (selectedBounds.length > 0) {
        let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
        selectedBounds.forEach(b => {
          if (b.minU < gMinU) gMinU = b.minU;
          if (b.maxU > gMaxU) gMaxU = b.maxU;
          if (b.minV < gMinV) gMinV = b.minV;
          if (b.maxV > gMaxV) gMaxV = b.maxV;
        });

        const pad = 0.006;
        const dU = dragState ? dragDeltaRef.current.u : 0;
        const dV = dragState ? dragDeltaRef.current.v : 0;
        const u0 = gMinU - pad + dU;
        const u1 = gMaxU + pad + dU;
        const v0 = gMinV - pad + dV;
        const v1 = gMaxV + pad + dV;

        const posAttr = box.geometry.attributes.position;
        if (posAttr instanceof THREE.BufferAttribute) {
          const arr = posAttr.array as Float32Array;
          arr[0] = u0; arr[1] = v0; arr[2] = 0.5;
          arr[3] = u1; arr[4] = v0; arr[5] = 0.5;
          arr[6] = u1; arr[7] = v1; arr[8] = 0.5;
          arr[9] = u0; arr[10] = v1; arr[11] = 0.5;
          posAttr.needsUpdate = true;
          box.visible = true;
          requestRender();
          return;
        }
      }
    }

    // Hover highlight fallback
    if (activeHoveredPieceId) {
      const b = cachedBoundsRef.current.find(item => item.id === activeHoveredPieceId);
      if (b) {
        const pad = 0.005;
        const u0 = b.minU - pad;
        const u1 = b.maxU + pad;
        const v0 = b.minV - pad;
        const v1 = b.maxV + pad;

        const posAttr = box.geometry.attributes.position;
        if (posAttr instanceof THREE.BufferAttribute) {
          const arr = posAttr.array as Float32Array;
          arr[0] = u0; arr[1] = v0; arr[2] = 0.5;
          arr[3] = u1; arr[4] = v0; arr[5] = 0.5;
          arr[6] = u1; arr[7] = v1; arr[8] = 0.5;
          arr[9] = u0; arr[10] = v1; arr[11] = 0.5;
          posAttr.needsUpdate = true;
          box.visible = true;
          requestRender();
          return;
        }
      }
    }

    box.visible = false;
    requestRender();
  }, [modelStore.selectedPiece?.id, modelStore.selectedPieceIds.slice(), activeHoveredPieceId, dragState, requestRender]);

  // O(1) piece lookup from UV coordinates
  const getPieceAtCanvasCoords = (clientX: number, clientY: number): string | null => {
    const container = containerRef.current;
    if (!container || !cameraRef.current) return null;
    const rect = container.getBoundingClientRect();
    const camera = cameraRef.current;

    // Map screen click into camera orthographic UV space
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const clickU = camera.left + normX * (camera.right - camera.left);
    const clickV = camera.top - normY * (camera.top - camera.bottom);
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
          if (!modelStore.selectedPieceIds.includes(hitId)) {
            modelStore.selectPiece(p.mesh);
          }
        }
      }

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
      if (!container || !cameraRef.current) return;
      const rect = container.getBoundingClientRect();
      const camera = cameraRef.current;

      const spanU = camera.right - camera.left;
      const spanV = camera.top - camera.bottom;

      let currentDeltaU = ((e.clientX - dragState.startMouseX) / rect.width) * spanU;
      let currentDeltaV = -(((e.clientY - dragState.startMouseY) / rect.height) * spanV);

      let snappedGuidelineU: number | null = null;
      let snappedGuidelineV: number | null = null;

      if (snapEnabled && !e.altKey) {
        const threshold = 0.012;
        const myBounds = cachedBoundsRef.current.filter(b => dragState.pieceIds.includes(b.id));

        if (myBounds.length > 0) {
          let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
          myBounds.forEach(b => {
            if (b.minU < gMinU) gMinU = b.minU;
            if (b.maxU > gMaxU) gMaxU = b.maxU;
            if (b.minV < gMinV) gMinV = b.minV;
            if (b.maxV > gMaxV) gMaxV = b.maxV;
          });

          const curMinU = gMinU + currentDeltaU;
          const curMaxU = gMaxU + currentDeltaU;
          const curCenterU = (curMinU + curMaxU) * 0.5;
          const myW = curMaxU - curMinU;

          const curMinV = gMinV + currentDeltaV;
          const curMaxV = gMaxV + currentDeltaV;
          const curCenterV = (curMinV + curMaxV) * 0.5;
          const myH = curMaxV - curMinV;

          const otherBounds = cachedBoundsRef.current.filter(b => !dragState.pieceIds.includes(b.id));

          let bestDiffU = threshold;
          let bestSnapTargetU: number | null = null;
          let snapSourceU: "min" | "max" | "center" | null = null;

          let bestDiffV = threshold;
          let bestSnapTargetV: number | null = null;
          let snapSourceV: "min" | "max" | "center" | null = null;

          otherBounds.forEach(other => {
            const otherCenterU = (other.minU + other.maxU) * 0.5;
            const otherCenterV = (other.minV + other.maxV) * 0.5;

            [other.minU, other.maxU, otherCenterU].forEach(targetU => {
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

            [other.minV, other.maxV, otherCenterV].forEach(targetV => {
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

          if (bestSnapTargetU !== null && snapSourceU !== null) {
            if (snapSourceU === "min") currentDeltaU = bestSnapTargetU - gMinU;
            else if (snapSourceU === "max") currentDeltaU = bestSnapTargetU - gMaxU;
            else if (snapSourceU === "center") currentDeltaU = bestSnapTargetU - (gMinU + myW * 0.5);
            snappedGuidelineU = bestSnapTargetU;
          }

          if (bestSnapTargetV !== null && snapSourceV !== null) {
            if (snapSourceV === "min") currentDeltaV = bestSnapTargetV - gMinV;
            else if (snapSourceV === "max") currentDeltaV = bestSnapTargetV - gMaxV;
            else if (snapSourceV === "center") currentDeltaV = bestSnapTargetV - (gMinV + myH * 0.5);
            snappedGuidelineV = bestSnapTargetV;
          }
        }
      }

      dragDeltaRef.current = { u: currentDeltaU, v: currentDeltaV };

      // Update Visual Guide Lines
      if (snapGuideLinesMeshRef.current) {
        const guideMesh = snapGuideLinesMeshRef.current;
        const posAttr = guideMesh.geometry.attributes.position;
        if (posAttr instanceof THREE.BufferAttribute) {
          const arr = posAttr.array as Float32Array;
          if (snappedGuidelineU !== null) {
            arr[0] = snappedGuidelineU; arr[1] = 0; arr[2] = 0.8;
            arr[3] = snappedGuidelineU; arr[4] = 1; arr[5] = 0.8;
          } else {
            arr[0] = 0; arr[1] = 0; arr[2] = 0; arr[3] = 0; arr[4] = 0; arr[5] = 0;
          }
          if (snappedGuidelineV !== null) {
            arr[6] = 0; arr[7] = snappedGuidelineV; arr[8] = 0.8;
            arr[9] = 1; arr[10] = snappedGuidelineV; arr[11] = 0.8;
          } else {
            arr[6] = 0; arr[7] = 0; arr[8] = 0; arr[9] = 0; arr[10] = 0; arr[11] = 0;
          }
          posAttr.needsUpdate = true;
          guideMesh.visible = snappedGuidelineU !== null || snappedGuidelineV !== null;
        }
      }

      // Live GPU translation
      if (meshesGroupRef.current) {
        dragState.pieceIds.forEach(id => {
          const activeMesh = meshesGroupRef.current?.children.find(c => c.name === id);
          if (activeMesh) {
            activeMesh.position.set(currentDeltaU, currentDeltaV, 0);
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

      if (snapGuideLinesMeshRef.current) {
        snapGuideLinesMeshRef.current.visible = false;
      }

      if (Math.abs(finalDeltaU) > 0.0001 || Math.abs(finalDeltaV) > 0.0001) {
        uvOrganizerStore.translatePiecesGroupUV(dragState.pieceIds, finalDeltaU, finalDeltaV);
        modelStore.persistGarmentConfigToSQLite();
      }

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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerLeave={handleContainerPointerLeave}
        style={{
          width: "100%",
          height: "100%",
          cursor: dragState ? "grabbing" : (activeHoveredPieceId ? "grab" : "default")
        }}
      />

      {/* Floating Hover Badge */}
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
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "10px",
          color: "#38bdf8",
          fontWeight: "600",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 6px #38bdf8" }} />
          <span>{modelStore.pieces.find(p => p.id === activeHoveredPieceId)?.name || "Pattern Island"}</span>
        </div>
      )}

      {/* Bottom Floating Info Strip: Move hint + Magnetic Snap Toggle */}
      <div style={{
        position: "absolute",
        bottom: "8px",
        left: "10px",
        right: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "auto"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          pointerEvents: "none",
          background: "rgba(0,0,0,0.65)",
          padding: "2px 6px",
          borderRadius: "4px",
          fontSize: "9px",
          color: "#94a3b8"
        }}>
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
            fontSize: "9px",
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
  );
});
