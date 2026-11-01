import React, { useRef, useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore } from "../store/uvOrganizerStore";
import { modelStore } from "../store/modelStore";
import * as THREE from "three";

interface PieceBounds2D {
  id: string;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

type TransformMode = "translate" | "scale-tl" | "scale-tr" | "scale-br" | "scale-bl" | "scale-r" | "scale-t" | "scale-l" | "scale-b";

interface DragTransformState {
  mode: TransformMode;
  pieceIds: string[];
  startMouseX: number;
  startMouseY: number;
  origBounds: { minU: number; maxU: number; minV: number; maxV: number };
  centerU: number;
  centerV: number;
}

interface PanState {
  startX: number;
  startY: number;
  startCamCenterU: number;
  startCamCenterV: number;
}

export const UVCanvasView = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Drag transform & pan states
  const [transformState, setTransformState] = useState<DragTransformState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [activeGizmoHandle, setActiveGizmoHandle] = useState<string | null>(null);

  // Synchronized hovered piece ID across 2D UV canvas and 3D viewport
  const activeHoveredPieceId = modelStore.hoveredPieceId;

  // WebGL GPU Viewport System
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const meshesGroupRef = useRef<THREE.Group | null>(null);
  const zonesGroupRef = useRef<THREE.Group | null>(null);
  const selectionBoxMeshRef = useRef<THREE.LineSegments | null>(null);
  const gizmoGroupRef = useRef<THREE.Group | null>(null);
  const snapGuideLinesMeshRef = useRef<THREE.LineSegments | null>(null);

  // Pan & Zoom state in UV Coordinates
  const viewStateRef = useRef<{ centerU: number; centerV: number; zoom: number }>({
    centerU: 0.5,
    centerV: 0.5,
    zoom: 1.0
  });

  const cachedBoundsRef = useRef<PieceBounds2D[]>([]);
  const dragDeltaRef = useRef<{ u: number; v: number; scaleX: number; scaleY: number }>({
    u: 0,
    v: 0,
    scaleX: 1,
    scaleY: 1
  });
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

  // Update Camera Viewport Projection with Pan & Zoom
  const updateCameraBounds = useCallback(() => {
    if (!containerRef.current || !cameraRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const camera = cameraRef.current;
    const aspect = clientWidth / clientHeight;
    const { centerU, centerV, zoom } = viewStateRef.current;

    const halfSpan = 0.55 / zoom;
    if (aspect >= 1.0) {
      const halfU = halfSpan * aspect;
      const halfV = halfSpan;
      camera.left = centerU - halfU;
      camera.right = centerU + halfU;
      camera.top = centerV + halfV;
      camera.bottom = centerV - halfV;
    } else {
      const halfU = halfSpan;
      const halfV = halfSpan / aspect;
      camera.left = centerU - halfU;
      camera.right = centerU + halfU;
      camera.top = centerV + halfV;
      camera.bottom = centerV - halfV;
    }
    camera.updateProjectionMatrix();
    requestRender();
  }, [requestRender]);

  // 1. Rebuild Zones Overlay in WebGL
  const updateZonesOverlay = useCallback(() => {
    if (!zonesGroupRef.current) return;
    const group = zonesGroupRef.current;
    
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

    // Outer UV Unit Square [0, 1] x [0, 1] Border Glow
    const borderGeom = new THREE.BufferGeometry();
    borderGeom.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, -0.9,  1, 0, -0.9,
      1, 0, -0.9,  1, 1, -0.9,
      1, 1, -0.9,  0, 1, -0.9,
      0, 1, -0.9,  0, 0, -0.9
    ], 3));
    const borderMat = new THREE.LineBasicMaterial({ color: 0x14d9ff, transparent: true, opacity: 0.35, linewidth: 2 });
    group.add(new THREE.LineSegments(borderGeom, borderMat));

    // Canonical zone rectangles
    Object.values(uvOrganizerStore.zones).forEach((zone) => {
      const zW = zone.uMax - zone.uMin;
      const zH = zone.vMax - zone.vMin;
      const zX = zone.uMin + zW * 0.5;
      const zY = zone.vMin + zH * 0.5;

      const assignedCount = modelStore.pieces.filter(p => p.assignedZoneId === zone.id).length;
      const isEmpty = assignedCount === 0;

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

      const edges = new THREE.EdgesGeometry(planeGeom);
      const edgeMat = new THREE.LineBasicMaterial({
        color: isEmpty ? 0x475569 : colorVal,
        transparent: true,
        opacity: isEmpty ? 0.25 : 0.85,
        linewidth: 1.5
      });
      const edgeLines = new THREE.LineSegments(edges, edgeMat);
      edgeLines.position.set(zX, zY, -0.4);
      group.add(edgeLines);
    });

    requestRender();
  }, [requestRender]);

  // 2. Build GPU UV Meshes
  const rebuildUVMeshes = useCallback(() => {
    if (!meshesGroupRef.current) return;
    const group = meshesGroupRef.current;

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
        const zoneColor = assignedZone ? new THREE.Color(assignedZone.color) : new THREE.Color(0x38bdf8);

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

        // Shaded surface fill
        const fillMat = new THREE.MeshBasicMaterial({
          color: zoneColor,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const uvMesh = new THREE.Mesh(uvGeom, fillMat);
        uvMesh.name = piece.id;

        // Clean wireframe lines overlay
        const wireMat = new THREE.MeshBasicMaterial({
          color: zoneColor,
          wireframe: true,
          transparent: true,
          opacity: 0.65
        });
        const wireMesh = new THREE.Mesh(uvGeom, wireMat);
        uvMesh.add(wireMesh);

        group.add(uvMesh);
      });
    }

    cachedBoundsRef.current = boundsList;
    requestRender();
  }, [requestRender]);

  // 3. Build & Update 2D Move & Scale Gizmo (Mockup Precision)
  const updateGizmoMesh = useCallback(() => {
    if (!gizmoGroupRef.current || !cameraRef.current) return;
    const group = gizmoGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    const activeSelectedIds = modelStore.selectedPieceIds.length > 0 
      ? modelStore.selectedPieceIds 
      : (modelStore.selectedPiece ? [modelStore.selectedPiece.id] : []);

    if (activeSelectedIds.length === 0) {
      requestRender();
      return;
    }

    const selectedBounds = cachedBoundsRef.current.filter(b => activeSelectedIds.includes(b.id));
    if (selectedBounds.length === 0) {
      requestRender();
      return;
    }

    let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
    selectedBounds.forEach(b => {
      if (b.minU < gMinU) gMinU = b.minU;
      if (b.maxU > gMaxU) gMaxU = b.maxU;
      if (b.minV < gMinV) gMinV = b.minV;
      if (b.maxV > gMaxV) gMaxV = b.maxV;
    });

    const pad = 0.008;
    const u0 = gMinU - pad;
    const u1 = gMaxU + pad;
    const v0 = gMinV - pad;
    const v1 = gMaxV + pad;
    const cU = (u0 + u1) * 0.5;
    const cV = (v0 + v1) * 0.5;

    // Viewport relative scale for crisp handles
    const zoom = viewStateRef.current.zoom;
    const arrowLen = 0.07 / zoom;
    const arrowHead = 0.018 / zoom;
    const handleSize = 0.016 / zoom;

    // --- Bounding Box Outline (Cyan Dashed Feel) ---
    const bboxGeom = new THREE.BufferGeometry();
    bboxGeom.setAttribute("position", new THREE.Float32BufferAttribute([
      u0, v0, 0.4,  u1, v0, 0.4,
      u1, v0, 0.4,  u1, v1, 0.4,
      u1, v1, 0.4,  u0, v1, 0.4,
      u0, v1, 0.4,  u0, v0, 0.4
    ], 3));
    const bboxMat = new THREE.LineBasicMaterial({ color: 0x14d9ff, linewidth: 2, depthTest: false });
    group.add(new THREE.LineSegments(bboxGeom, bboxMat));

    // --- 4 Corner Scale Handles ---
    const corners = [
      { name: "handle-scale-bl", x: u0, y: v0 },
      { name: "handle-scale-br", x: u1, y: v0 },
      { name: "handle-scale-tr", x: u1, y: v1 },
      { name: "handle-scale-tl", x: u0, y: v1 }
    ];

    corners.forEach(c => {
      const handleGeom = new THREE.PlaneGeometry(handleSize, handleSize);
      const handleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
      const handleMesh = new THREE.Mesh(handleGeom, handleMat);
      handleMesh.position.set(c.x, c.y, 0.6);
      handleMesh.name = c.name;
      group.add(handleMesh);

      // Dark border on handle
      const hBorder = new THREE.LineSegments(
        new THREE.EdgesGeometry(handleGeom),
        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1.5, depthTest: false })
      );
      hBorder.position.set(c.x, c.y, 0.65);
      group.add(hBorder);
    });

    // --- 2D Move Translation Arrows (Red X / Green Y per Mockup) ---
    // Red Arrow: +U (X-Axis)
    const redGeom = new THREE.BufferGeometry();
    redGeom.setAttribute("position", new THREE.Float32BufferAttribute([
      cU, cV, 0.7,  cU + arrowLen, cV, 0.7
    ], 3));
    const redLine = new THREE.Line(redGeom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3, depthTest: false }));
    group.add(redLine);

    const redHeadGeom = new THREE.ConeGeometry(arrowHead * 0.5, arrowHead, 4);
    redHeadGeom.rotateZ(-Math.PI / 2);
    const redHead = new THREE.Mesh(redHeadGeom, new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false }));
    redHead.position.set(cU + arrowLen, cV, 0.7);
    redHead.name = "handle-move-x";
    group.add(redHead);

    // Green Arrow: +V (Y-Axis)
    const greenGeom = new THREE.BufferGeometry();
    greenGeom.setAttribute("position", new THREE.Float32BufferAttribute([
      cU, cV, 0.7,  cU, cV + arrowLen, 0.7
    ], 3));
    const greenLine = new THREE.Line(greenGeom, new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 3, depthTest: false }));
    group.add(greenLine);

    const greenHeadGeom = new THREE.ConeGeometry(arrowHead * 0.5, arrowHead, 4);
    const greenHead = new THREE.Mesh(greenHeadGeom, new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false }));
    greenHead.position.set(cU, cV + arrowLen, 0.7);
    greenHead.name = "handle-move-y";
    group.add(greenHead);

    // Center Pivot White Box (Mockup Center Pivot Box)
    const pivotGeom = new THREE.PlaneGeometry(handleSize * 0.7, handleSize * 0.7);
    const pivotMesh = new THREE.Mesh(pivotGeom, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
    pivotMesh.position.set(cU, cV, 0.8);
    pivotMesh.name = "handle-move-center";
    group.add(pivotMesh);

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

    const zonesGroup = new THREE.Group();
    scene.add(zonesGroup);
    zonesGroupRef.current = zonesGroup;

    const meshesGroup = new THREE.Group();
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    const gizmoGroup = new THREE.Group();
    scene.add(gizmoGroup);
    gizmoGroupRef.current = gizmoGroup;

    // Selection box helper for hover
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

    updateCameraBounds();

    const resizeObserver = new ResizeObserver(() => {
      if (rendererRef.current && containerRef.current) {
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
      updateCameraBounds();
      updateGizmoMesh();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [updateCameraBounds, updateGizmoMesh]);

  // Initial and reactive refresh
  useEffect(() => {
    updateZonesOverlay();
    rebuildUVMeshes();
    updateGizmoMesh();
  }, [
    uvOrganizerStore.zones,
    uvOrganizerStore.layoutVersion,
    modelStore.pieces.length,
    modelStore.selectedPiece?.id,
    modelStore.selectedPieceIds.slice(),
    updateZonesOverlay,
    rebuildUVMeshes,
    updateGizmoMesh
  ]);

  // Coordinate Conversion Helpers
  const getUVFromClient = (clientX: number, clientY: number): { u: number; v: number } | null => {
    const container = containerRef.current;
    if (!container || !cameraRef.current) return null;
    const rect = container.getBoundingClientRect();
    const camera = cameraRef.current;

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const u = camera.left + normX * (camera.right - camera.left);
    const v = camera.top - normY * (camera.top - camera.bottom);
    return { u, v };
  };

  const getPieceAtCanvasCoords = (clientX: number, clientY: number): string | null => {
    const coords = getUVFromClient(clientX, clientY);
    if (!coords) return null;
    const { u: clickU, v: clickV } = coords;
    const pad = 0.015 / viewStateRef.current.zoom;

    for (let i = cachedBoundsRef.current.length - 1; i >= 0; i--) {
      const b = cachedBoundsRef.current[i];
      if (clickU >= b.minU - pad && clickU <= b.maxU + pad && clickV >= b.minV - pad && clickV <= b.maxV + pad) {
        return b.id;
      }
    }
    return null;
  };

  // Hit-test Gizmo Handles
  const getGizmoHandleAtCoords = (clientX: number, clientY: number): TransformMode | null => {
    const coords = getUVFromClient(clientX, clientY);
    if (!coords) return null;
    const { u, v } = coords;

    const activeSelectedIds = modelStore.selectedPieceIds.length > 0 
      ? modelStore.selectedPieceIds 
      : (modelStore.selectedPiece ? [modelStore.selectedPiece.id] : []);

    if (activeSelectedIds.length === 0) return null;

    const selectedBounds = cachedBoundsRef.current.filter(b => activeSelectedIds.includes(b.id));
    if (selectedBounds.length === 0) return null;

    let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
    selectedBounds.forEach(b => {
      if (b.minU < gMinU) gMinU = b.minU;
      if (b.maxU > gMaxU) gMaxU = b.maxU;
      if (b.minV < gMinV) gMinV = b.minV;
      if (b.maxV > gMaxV) gMaxV = b.maxV;
    });

    const pad = 0.008;
    const u0 = gMinU - pad, u1 = gMaxU + pad, v0 = gMinV - pad, v1 = gMaxV + pad;
    const cU = (u0 + u1) * 0.5, cV = (v0 + v1) * 0.5;

    const zoom = viewStateRef.current.zoom;
    const handleR = 0.015 / zoom;
    const arrowLen = 0.07 / zoom;

    // Corner Scale Handles
    if (Math.hypot(u - u0, v - v0) < handleR) return "scale-bl";
    if (Math.hypot(u - u1, v - v0) < handleR) return "scale-br";
    if (Math.hypot(u - u1, v - v1) < handleR) return "scale-tr";
    if (Math.hypot(u - u0, v - v1) < handleR) return "scale-tl";

    // Move Arrows and Center Pivot
    if (Math.hypot(u - cU, v - cV) < handleR * 1.2) return "translate";
    if (u >= cU && u <= cU + arrowLen && Math.abs(v - cV) < handleR) return "translate";
    if (v >= cV && v <= cV + arrowLen && Math.abs(u - cU) < handleR) return "translate";

    return null;
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container || !cameraRef.current) return;

    const coords = getUVFromClient(e.clientX, e.clientY);
    if (!coords) return;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const curZoom = viewStateRef.current.zoom;
    const nextZoom = Math.max(0.4, Math.min(10.0, curZoom * zoomFactor));

    // Zoom centered towards mouse cursor
    const { u, v } = coords;
    const curCenterU = viewStateRef.current.centerU;
    const curCenterV = viewStateRef.current.centerV;

    viewStateRef.current = {
      zoom: nextZoom,
      centerU: u + (curCenterU - u) * (curZoom / nextZoom),
      centerV: v + (curCenterV - v) * (curZoom / nextZoom)
    };

    updateCameraBounds();
    updateGizmoMesh();
  };

  // Pointer Down (Pan vs Gizmo Transform vs Island Select)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Middle mouse click (or Spacebar / Alt + Left Click) -> PAN
    if (e.button === 1 || e.altKey || e.button === 2) {
      e.preventDefault();
      setPanState({
        startX: e.clientX,
        startY: e.clientY,
        startCamCenterU: viewStateRef.current.centerU,
        startCamCenterV: viewStateRef.current.centerV
      });
      return;
    }

    if (e.button !== 0) return;

    // 2. Check Gizmo Handle Hit
    const gizmoMode = getGizmoHandleAtCoords(e.clientX, e.clientY);
    if (gizmoMode) {
      e.preventDefault();
      const activeIds = modelStore.selectedPieceIds.length > 0 
        ? [...modelStore.selectedPieceIds] 
        : (modelStore.selectedPiece ? [modelStore.selectedPiece.id] : []);

      const selectedBounds = cachedBoundsRef.current.filter(b => activeIds.includes(b.id));
      let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
      selectedBounds.forEach(b => {
        if (b.minU < gMinU) gMinU = b.minU;
        if (b.maxU > gMaxU) gMaxU = b.maxU;
        if (b.minV < gMinV) gMinV = b.minV;
        if (b.maxV > gMaxV) gMaxV = b.maxV;
      });

      dragDeltaRef.current = { u: 0, v: 0, scaleX: 1, scaleY: 1 };
      setTransformState({
        mode: gizmoMode,
        pieceIds: activeIds,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origBounds: { minU: gMinU, maxU: gMaxU, minV: gMinV, maxV: gMaxV },
        centerU: (gMinU + gMaxU) * 0.5,
        centerV: (gMinV + gMaxV) * 0.5
      });
      return;
    }

    // 3. Piece Selection & Direct Island Drag
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

      const selectedBounds = cachedBoundsRef.current.filter(b => activeIds.includes(b.id));
      let gMinU = Infinity, gMaxU = -Infinity, gMinV = Infinity, gMaxV = -Infinity;
      selectedBounds.forEach(b => {
        if (b.minU < gMinU) gMinU = b.minU;
        if (b.maxU > gMaxU) gMaxU = b.maxU;
        if (b.minV < gMinV) gMinV = b.minV;
        if (b.maxV > gMaxV) gMaxV = b.maxV;
      });

      dragDeltaRef.current = { u: 0, v: 0, scaleX: 1, scaleY: 1 };
      setTransformState({
        mode: "translate",
        pieceIds: activeIds,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origBounds: { minU: gMinU, maxU: gMaxU, minV: gMinV, maxV: gMaxV },
        centerU: (gMinU + gMaxU) * 0.5,
        centerV: (gMinV + gMaxV) * 0.5
      });
    } else {
      if (!isMultiKey) {
        modelStore.deselectPiece();
      }
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    // 1. Pan Viewport Movement
    if (panState) {
      const container = containerRef.current;
      if (!container || !cameraRef.current) return;
      const camera = cameraRef.current;

      const spanU = camera.right - camera.left;
      const spanV = camera.top - camera.bottom;

      const deltaPixelX = e.clientX - panState.startX;
      const deltaPixelY = e.clientY - panState.startY;

      const deltaU = -(deltaPixelX / container.clientWidth) * spanU;
      const deltaV = (deltaPixelY / container.clientHeight) * spanV;

      viewStateRef.current.centerU = panState.startCamCenterU + deltaU;
      viewStateRef.current.centerV = panState.startCamCenterV + deltaV;

      updateCameraBounds();
      updateGizmoMesh();
      return;
    }

    // 2. Gizmo Scale or Translate Movement
    if (transformState) {
      const container = containerRef.current;
      if (!container || !cameraRef.current) return;
      const camera = cameraRef.current;

      const spanU = camera.right - camera.left;
      const spanV = camera.top - camera.bottom;

      const currentDeltaU = ((e.clientX - transformState.startMouseX) / container.clientWidth) * spanU;
      const currentDeltaV = -(((e.clientY - transformState.startMouseY) / container.clientHeight) * spanV);

      if (transformState.mode === "translate") {
        dragDeltaRef.current.u = currentDeltaU;
        dragDeltaRef.current.v = currentDeltaV;

        if (meshesGroupRef.current) {
          transformState.pieceIds.forEach(id => {
            const activeMesh = meshesGroupRef.current?.children.find(c => c.name === id);
            if (activeMesh) {
              activeMesh.position.set(currentDeltaU, currentDeltaV, 0);
            }
          });
        }
        if (gizmoGroupRef.current) {
          gizmoGroupRef.current.position.set(currentDeltaU, currentDeltaV, 0);
        }
      } else {
        // Corner Scaling relative to island bounding center
        const origW = transformState.origBounds.maxU - transformState.origBounds.minU;
        const origH = transformState.origBounds.maxV - transformState.origBounds.minV;

        let scaleFactor = 1.0;
        if (transformState.mode === "scale-tr") {
          scaleFactor = 1.0 + (currentDeltaU + currentDeltaV) / (origW + origH);
        } else if (transformState.mode === "scale-tl") {
          scaleFactor = 1.0 + (-currentDeltaU + currentDeltaV) / (origW + origH);
        } else if (transformState.mode === "scale-br") {
          scaleFactor = 1.0 + (currentDeltaU - currentDeltaV) / (origW + origH);
        } else if (transformState.mode === "scale-bl") {
          scaleFactor = 1.0 + (-currentDeltaU - currentDeltaV) / (origW + origH);
        }

        scaleFactor = Math.max(0.2, Math.min(5.0, scaleFactor));
        dragDeltaRef.current.scaleX = scaleFactor;
        dragDeltaRef.current.scaleY = scaleFactor;

        // Apply visual scale preview on GPU
        if (meshesGroupRef.current) {
          const cU = transformState.centerU;
          const cV = transformState.centerV;
          transformState.pieceIds.forEach(id => {
            const activeMesh = meshesGroupRef.current?.children.find(c => c.name === id);
            if (activeMesh) {
              activeMesh.scale.set(scaleFactor, scaleFactor, 1);
              activeMesh.position.set(cU * (1 - scaleFactor), cV * (1 - scaleFactor), 0);
            }
          });
        }
        if (gizmoGroupRef.current) {
          const cU = transformState.centerU;
          const cV = transformState.centerV;
          gizmoGroupRef.current.scale.set(scaleFactor, scaleFactor, 1);
          gizmoGroupRef.current.position.set(cU * (1 - scaleFactor), cV * (1 - scaleFactor), 0);
        }
      }

      requestRender();
    }
  };

  const handlePointerUp = () => {
    if (panState) {
      setPanState(null);
    }

    if (transformState) {
      const { mode, pieceIds } = transformState;
      const { u, v, scaleX } = dragDeltaRef.current;

      if (mode === "translate") {
        if (Math.abs(u) > 0.0001 || Math.abs(v) > 0.0001) {
          uvOrganizerStore.translatePiecesGroupUV(pieceIds, u, v);
          modelStore.persistGarmentConfigToSQLite();
        }
      } else {
        if (Math.abs(scaleX - 1.0) > 0.001) {
          uvOrganizerStore.scalePiecesGroupUV(pieceIds, scaleX);
          modelStore.persistGarmentConfigToSQLite();
        }
      }

      // Reset GPU node transform
      if (meshesGroupRef.current) {
        pieceIds.forEach(id => {
          const activeMesh = meshesGroupRef.current?.children.find(c => c.name === id);
          if (activeMesh) {
            activeMesh.position.set(0, 0, 0);
            activeMesh.scale.set(1, 1, 1);
          }
        });
      }
      if (gizmoGroupRef.current) {
        gizmoGroupRef.current.position.set(0, 0, 0);
        gizmoGroupRef.current.scale.set(1, 1, 1);
      }

      dragDeltaRef.current = { u: 0, v: 0, scaleX: 1, scaleY: 1 };
      setTransformState(null);
      rebuildUVMeshes();
      updateGizmoMesh();
    }
  };

  useEffect(() => {
    if (transformState || panState) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [transformState, panState]);

  // Cursor styling based on hover
  const getCursor = () => {
    if (panState) return "grabbing";
    if (transformState) {
      if (transformState.mode === "translate") return "move";
      return "nwse-resize";
    }
    if (activeGizmoHandle) {
      if (activeGizmoHandle === "translate") return "move";
      return "nwse-resize";
    }
    if (activeHoveredPieceId) return "pointer";
    return "default";
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: getCursor()
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => {
          if (!transformState && !panState) {
            const handle = getGizmoHandleAtCoords(e.clientX, e.clientY);
            setActiveGizmoHandle(handle);
            const hitId = getPieceAtCanvasCoords(e.clientX, e.clientY);
            modelStore.setHoveredPieceId(hitId);
          }
        }}
        onPointerLeave={() => {
          if (!transformState && !panState) {
            setActiveGizmoHandle(null);
            modelStore.setHoveredPieceId(null);
          }
        }}
        style={{ width: "100%", height: "100%" }}
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

      {/* Zoom / Pan Reset Controls */}
      <div style={{
        position: "absolute",
        bottom: "8px",
        right: "10px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "rgba(14, 21, 39, 0.85)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "6px",
        padding: "2px 5px",
        fontSize: "9px",
        color: "var(--text-secondary)"
      }}>
        <span>Zoom: {Math.round(viewStateRef.current.zoom * 100)}%</span>
        <button
          onClick={() => {
            viewStateRef.current = { centerU: 0.5, centerV: 0.5, zoom: 1.0 };
            updateCameraBounds();
            updateGizmoMesh();
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--neon-cyan)",
            cursor: "pointer",
            fontSize: "9px",
            fontWeight: "600"
          }}
          title="Reset Zoom & Pan to Fit UV Space"
        >
          Reset
        </button>
      </div>
    </div>
  );
});
