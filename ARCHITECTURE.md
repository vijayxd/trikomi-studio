# Trikomi Studio Architecture & Technical Specification

## 1. System Vision & Architectural Paradigm
Trikomi Studio is a lightweight, headless-first **Workstation Shell / UI Presentation Wrapper** for 3D garment visualization, canonical UV island organization, border-locked mesh decimation, and PBR fabric authoring.

### 🛡️ Critical Architectural Contract:
- **`trikomi-studio` is STRICTLY a UI wrapper**:
  - Contains **only** UI presentation, views, toolbars, collapsible docks, and reactive bindings.
  - **Zero proprietary 3D business logic, zero local math engines, and zero standalone `.ts` files inside `trikomi-studio/src/`** (except standard `vite-env.d.ts`).
  - **MANDATORY USE OF TRIKOMI `ThreeViewer`**: The 3D viewport mounts Trikomi Core's `ThreeViewer` (`new ThreeViewer(...)`) via `studioViewerManager.init()` from `@trikomi/core/studio`.
  - **STRICT PROHIBITION**: Raw `new THREE.WebGLRenderer()`, raw `THREE.PerspectiveCamera()`, or ad-hoc animation loops are never initialized in the wrapper or store.
- **`@trikomi/core` & `@trikomi/core/studio` contain all engine capabilities**:
  - Authored inside `trikomi/packages/core/src/studio/`.
  - Reuses Trikomi's core engine plugins:
    - [`OrbitControlsPlugin`](file:///media/vijaykc/projects/trikomi/packages/core/src/engine/plugins/OrbitControlsPlugin.ts) (`viewer:orbit-controls`)
    - [`TransformGizmoPlugin`](file:///media/vijaykc/projects/trikomi/packages/core/src/engine/plugins/TransformGizmoPlugin.ts) (`viewer:gizmo`)
    - [`CenterModelPlugin`](file:///media/vijaykc/projects/trikomi/packages/core/src/engine/plugins/CenterModelPlugin.ts) (`viewer:center-model`)
    - [`EnvironmentPlugin`](file:///media/vijaykc/projects/trikomi/packages/core/src/engine/plugins/EnvironmentPlugin.ts) (`viewer:environment`)
    - [`GLTFPlugin`](file:///media/vijaykc/projects/trikomi/packages/core/src/engine/plugins/GLTFPlugin.ts) (`viewer:gltf`)
    - [`ExportPlugin`](file:///media/vijaykc/projects/trikomi/packages/core/src/engine/plugins/ExportPlugin.ts) (`viewer:export`)
  - Domain-specific engines:
    - `DecimationEngine`: Border-locked meshopt decimation preserving 3D silhouette contours and 2D UV seams.
    - `UVCanonicalEngine`: 2D UV canonical transforms, packing, island boundary extraction, and isotropic scaling.
    - `PBRMaterialSynthesizer`: Dynamic PBR fabric material synthesis with dedicated cloned instances per garment piece.
    - `StudioModelStore` & `StudioUVOrganizerStore`: Pure state stores exported from `@trikomi/core/studio`.
    - `GarmentAuditModule`: Headless 3D Front & Back view snapshots, color ID palettes, piece verification, and UV canonical grid audit generation.

## 2. Curated Garments Canonical UV Organization & Visual Audit Pipeline
Curated assets located in `/public/models_storage` (symlinked to `/home/vijaykc/Downloads/style3d_models`) are audited and arranged using Trikomi Core modules:
- **3D Spatial Piece Classification**:
  - Automatically analyzes piece elevation (`normY`), coronal depth (`relZ`), and lateral position (`normAbsX`) against the global garment bounding box.
  - Classifies pieces into canonical zones (`COLLAR_NECK`, `FRONT_TORSO`, `BACK_TORSO`, `SLEEVE_LEFT`, `SLEEVE_RIGHT`, `WAISTBAND`, `TRIMS` / `LEG_LEFT`, `LEG_RIGHT`, `CUFF_LEFT`, `CUFF_RIGHT`).
  - Separates trims and hardware via island aspect ratio ($\ge 12.0$) and mini bounding box volume ($< 500$).
- **UV Canonical Packing**:
  - Packs islands neatly into their respective canonical zone bounding boxes with strict 1:1 isotropic scaling to prevent garment texture distortion.
- **Visual Audit Grid Sheet**:
  - Accessible via `/audit/index.html` displaying high-contrast Color ID 3D Front view (+Z), 3D Back view (-Z), 2D Canonical UV layout diagram, and piece triangle statistics.
    - `StudioSqliteService`: SQLite / IndexedDB garment persistence layer.

---

## 2. Directory Hierarchy & Package Separation

```
trikomi/packages/core/src/studio/
├── DecimationEngine.ts          # Border-locking meshopt decimation engine
├── GarmentAuditModule.ts        # Automated inspection & multi-angle snapshot helper
├── GarmentEngine.ts             # Garment stats, triangle counting, piece filtering
├── PBRMaterialSynthesizer.ts    # Fabric material synthesis & texture assignment
├── StudioModelStore.ts          # Studio 3D model state management (binds to ThreeViewer)
├── StudioUVOrganizerStore.ts    # Studio UV layout, packing & island transform state
├── StudioSqliteService.ts       # SQLite / IndexedDB garment persistence layer
├── StudioViewerManager.ts       # Trikomi ThreeViewer lifecycle coordinator
├── types.ts                     # Shared TypeScript domain contracts
└── index.ts                     # Single barrel export for @trikomi/core/studio

trikomi-studio/src/
├── components/                  # Headless UI views & panels
│   ├── studio/
│   │   ├── StudioCenterViewport.tsx  # Mounts Trikomi ThreeViewer via studioViewerManager
│   │   ├── StudioLeftPanel.tsx       # Garment piece tree & hierarchy
│   │   ├── StudioRightPanel.tsx      # Fabric properties, decimation & audit
│   │   ├── StudioTopBar.tsx          # Shading modes, undo/redo & export
│   │   └── StudioBottomDock.tsx      # UV editor dock container
│   ├── UVCanvasView.tsx              # Reactive 2D UV canvas renderer
│   └── UVZoneEditorModal.tsx         # Canonical zone editor modal
├── studio.css                   # Semantic CSS classes (Zero Tailwind)
├── App.tsx                      # Main studio layout & splitters
├── main.tsx                     # Entry point
└── vite-env.d.ts                # TypeScript environment declarations
```

---

## 3. UI Shell Bindings
- All views in `trikomi-studio` import directly from `@trikomi/core/studio`:
  ```tsx
  import { modelStore, uvOrganizerStore, studioViewerManager } from "@trikomi/core/studio";
  ```
- `StudioCenterViewport.tsx` initializes the viewer:
  ```tsx
  const viewer = studioViewerManager.init({
    container: containerRef.current,
    backgroundColor: modelStore.backgroundColor
  });
  modelStore.attachViewer(viewer);
  ```
- Transform controls attach Trikomi Core's standard `TransformGizmoPlugin`.
- Verified: **0 TypeScript warnings, 0 build errors**.
