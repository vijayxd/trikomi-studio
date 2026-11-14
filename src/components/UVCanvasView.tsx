import React, { useRef, useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore, modelStore, UVViewportEngine } from "@trikomi/core/studio";
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

interface MarqueeBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isMultiKey: boolean;
}

export const UVCanvasView = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Drag transform & pan states
  const [transformState, setTransformState] = useState<DragTransformState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [marqueeState, setMarqueeState] = useState<MarqueeBoxState | null>(null);
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

  // Update Camera Viewport Projection with Pan & Zoom via UVViewportEngine
  const updateCameraBounds = useCallback(() => {
    if (!containerRef.current || !cameraRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const camera = cameraRef.current;
    const { centerU, centerV, zoom } = viewStateRef.current;
    const frustum = UVViewportEngine.calculateCameraFrustum(clientWidth, clientHeight, centerU, centerV, zoom);

    camera.left = frustum.left;
    camera.right = frustum.right;
    camera.top = frustum.top;
    camera.bottom = frustum.bottom;
    camera.updateProjectionMatrix();
    requestRender();
  }, [requestRender]);

  // 1. Rebuild Zones Overlay in WebGL via UVViewportEngine
  const updateZonesOverlay = useCallback(() => {
    if (!zonesGroupRef.current) return;
    const group = zonesGroupRef.current;
    
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    const overlay = UVViewportEngine.createZonesOverlayGroup(
      uvOrganizerStore.zones,
      modelStore.pieces,
      uvOrganizerStore.zoneDisplayMode
    );
    while (overlay.children.length > 0) {
      group.add(overlay.children[0]!);
    }

    requestRender();
  }, [requestRender]);

  // 2. Build GPU UV Meshes via UVViewportEngine
  const rebuildUVMeshes = useCallback(() => {
    if (!meshesGroupRef.current) return;
    const group = meshesGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    if (modelStore.currentModel) {
      modelStore.pieces.forEach((piece) => {
        const assignedZone = piece.assignedZoneId ? uvOrganizerStore.zones[piece.assignedZoneId] : null;
        const uvMesh = UVViewportEngine.createPieceUVMesh(piece, assignedZone);
        if (uvMesh) {
          group.add(uvMesh);
        }
      });
    }

    requestRender();
  }, [requestRender]);

  // 3. Build & Update 2D Move & Scale Gizmo via UVViewportEngine
  const updateGizmoMesh = useCallback(() => {
    if (!gizmoGroupRef.current || !cameraRef.current) return;
    const group = gizmoGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0]!;
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

    const groupBounds = uvOrganizerStore.getGroupUVBounds(activeSelectedIds);
    if (!groupBounds) {
      requestRender();
      return;
    }

    const isAllPinned = activeSelectedIds.length > 0 && activeSelectedIds.every(id => uvOrganizerStore.isPiecePinned(id));
    const gizmo = UVViewportEngine.createGizmoGroup(groupBounds, viewStateRef.current.zoom, isAllPinned);
    while (gizmo.children.length > 0) {
      group.add(gizmo.children[0]!);
    }

    requestRender();
  }, [requestRender]);

  // Focus on Selected Island via UVViewportEngine
  const focusSelectedIsland = useCallback(() => {
    const activeSelectedIds = modelStore.selectedPieceIds.length > 0
      ? modelStore.selectedPieceIds
      : (modelStore.selectedPiece ? [modelStore.selectedPiece.id] : []);
    
    if (activeSelectedIds.length === 0) return;

    const groupBounds = uvOrganizerStore.getGroupUVBounds(activeSelectedIds);
    if (!groupBounds) return;

    viewStateRef.current = UVViewportEngine.calculateIslandFocusView(groupBounds);
    updateCameraBounds();
    updateGizmoMesh();
  }, [updateCameraBounds, updateGizmoMesh]);

  // Reset UV Viewport View (Pan & Zoom to 1.0)
  const resetViewportView = useCallback(() => {
    viewStateRef.current = { centerU: 0.5, centerV: 0.5, zoom: 1.0 };
    updateCameraBounds();
    updateGizmoMesh();
  }, [updateCameraBounds, updateGizmoMesh]);

  // Listen to external reset & focus triggers from uvOrganizerStore
  useEffect(() => {
    if (uvOrganizerStore.uvViewportResetTrigger > 0) {
      resetViewportView();
    }
  }, [uvOrganizerStore.uvViewportResetTrigger, resetViewportView]);

  useEffect(() => {
    if (uvOrganizerStore.uvViewportFocusTrigger > 0) {
      focusSelectedIsland();
    }
  }, [uvOrganizerStore.uvViewportFocusTrigger, focusSelectedIsland]);

  // Keyboard shortcut: Press 'F' to focus selected island when UV Canvas has focus or mouse is over it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        const hasSelection = modelStore.selectedPiece || modelStore.selectedPieceIds.length > 0;
        if (hasSelection) {
          e.preventDefault();
          focusSelectedIsland();
          modelStore.focusOnSelected?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusSelectedIsland]);

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

    // Non-passive native wheel listener to reliably preventDefault without browser console warnings
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const coords = getUVFromClient(e.clientX, e.clientY);
      if (!coords) return;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const curZoom = viewStateRef.current.zoom;
      const nextZoom = Math.max(0.4, Math.min(10.0, curZoom * zoomFactor));

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

    container.addEventListener("wheel", onWheelNative, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      if (rendererRef.current && containerRef.current) {
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
      updateCameraBounds();
      updateGizmoMesh();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("wheel", onWheelNative);
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
    modelStore.currentModel,
    modelStore.pieces.length,
    modelStore.visibilityVersion,
    modelStore.selectedPiece?.id,
    modelStore.selectedPieceIds.slice(),
    uvOrganizerStore.zones,
    uvOrganizerStore.layoutVersion,
    uvOrganizerStore.zoneDisplayMode,
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
    return uvOrganizerStore.hitTestPieceUV(coords.u, coords.v);
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

    const bounds = uvOrganizerStore.getGroupUVBounds(activeSelectedIds);
    if (!bounds) return null;

    const u0 = bounds.minU, u1 = bounds.maxU, v0 = bounds.minV, v1 = bounds.maxV;
    const cU = bounds.centerU, cV = bounds.centerV;

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

      const movableIds = activeIds.filter(id => !uvOrganizerStore.isPiecePinned(id));
      if (movableIds.length === 0) {
        return;
      }

      const groupBounds = uvOrganizerStore.getGroupUVBounds(activeIds);
      if (!groupBounds) return;

      uvOrganizerStore.pushHistorySnapshot("Scale UV Island");
      dragDeltaRef.current = { u: 0, v: 0, scaleX: 1, scaleY: 1 };
      setTransformState({
        mode: gizmoMode,
        pieceIds: movableIds,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origBounds: { minU: groupBounds.minU, maxU: groupBounds.maxU, minV: groupBounds.minV, maxV: groupBounds.maxV },
        centerU: groupBounds.centerU,
        centerV: groupBounds.centerV
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

      const movableIds = activeIds.filter(id => !uvOrganizerStore.isPiecePinned(id));
      if (movableIds.length === 0) {
        return;
      }

      const groupBounds = uvOrganizerStore.getGroupUVBounds(activeIds);
      if (!groupBounds) return;

      uvOrganizerStore.pushHistorySnapshot("Scale UV Island");
      dragDeltaRef.current = { u: 0, v: 0, scaleX: 1, scaleY: 1 };
      setTransformState({
        mode: "translate",
        pieceIds: movableIds,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origBounds: { minU: groupBounds.minU, maxU: groupBounds.maxU, minV: groupBounds.minV, maxV: groupBounds.maxV },
        centerU: groupBounds.centerU,
        centerV: groupBounds.centerV
      });
    } else {
      // Empty space pointerdown: initiate Marquee Box Selection
      if (!isMultiKey) {
        modelStore.deselectPiece(true);
        setTransformState(null);
        updateGizmoMesh();
        requestRender();
      }
      setMarqueeState({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isMultiKey
      });
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    // 1. Marquee Box Selection Drag
    if (marqueeState) {
      setMarqueeState({
        ...marqueeState,
        currentX: e.clientX,
        currentY: e.clientY
      });
      return;
    }

    // 2. Pan Viewport Movement
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

      let currentDeltaU = ((e.clientX - transformState.startMouseX) / container.clientWidth) * spanU;
      let currentDeltaV = -(((e.clientY - transformState.startMouseY) / container.clientHeight) * spanV);

      if (transformState.mode === "translate") {
        // Delegate magnetic snapping math directly to @trikomi/core/studio
        const snapResult = uvOrganizerStore.calculateMagneticSnap(
          transformState.pieceIds,
          currentDeltaU,
          currentDeltaV,
          transformState.origBounds,
          transformState.centerU,
          transformState.centerV
        );
        currentDeltaU = snapResult.deltaU;
        currentDeltaV = snapResult.deltaV;

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

  const handlePointerUp = (e?: PointerEvent) => {
    // 1. Finalize Marquee Box Selection
    if (marqueeState) {
      const startUv = getUVFromClient(marqueeState.startX, marqueeState.startY);
      const endClientX = e ? e.clientX : marqueeState.currentX;
      const endClientY = e ? e.clientY : marqueeState.currentY;
      const endUv = getUVFromClient(endClientX, endClientY);

      const pixelDist = Math.hypot(endClientX - marqueeState.startX, endClientY - marqueeState.startY);

      if (startUv && endUv && pixelDist > 6) {
        const boxMinU = Math.min(startUv.u, endUv.u);
        const boxMaxU = Math.max(startUv.u, endUv.u);
        const boxMinV = Math.min(startUv.v, endUv.v);
        const boxMaxV = Math.max(startUv.v, endUv.v);

        // Find all pieces whose 2D UV bounding box overlaps with the marquee box
        const hitPieceIds = cachedBoundsRef.current.filter(b => {
          const overlaps = (
            b.minU <= boxMaxU &&
            b.maxU >= boxMinU &&
            b.minV <= boxMaxV &&
            b.maxV >= boxMinV
          );
          return overlaps;
        }).map(b => b.id);

        if (hitPieceIds.length > 0) {
          modelStore.selectPiecesByIds(hitPieceIds, marqueeState.isMultiKey);
        } else if (!marqueeState.isMultiKey) {
          modelStore.deselectPiece(true);
        }
      } else if (!marqueeState.isMultiKey) {
        // Just a simple click on empty space with no drag
        modelStore.deselectPiece(true);
      }

      setMarqueeState(null);
      updateGizmoMesh();
      requestRender();
      return;
    }

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
    if (transformState || panState || marqueeState) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [transformState, panState, marqueeState]);

  // Cursor styling based on hover
  const getCursor = () => {
    if (panState) return "grabbing";
    if (marqueeState) return "crosshair";
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

      {/* Visual Marquee Selection Box */}
      {marqueeState && (() => {
        const left = Math.min(marqueeState.startX, marqueeState.currentX);
        const top = Math.min(marqueeState.startY, marqueeState.currentY);
        const width = Math.abs(marqueeState.currentX - marqueeState.startX);
        const height = Math.abs(marqueeState.currentY - marqueeState.startY);

        if (width < 3 && height < 3) return null;

        return (
          <div
            className="uv-marquee-box"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`
            }}
          />
        );
      })()}

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
