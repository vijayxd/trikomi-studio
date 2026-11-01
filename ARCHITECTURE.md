# 🏛️ ARCHITECTURE.md — Trikomi 3D Asset Studio Architecture & Blueprints

[![Ecosystem](https://img.shields.io/badge/Ecosystem-Trikomi%203D%20Platform-00f0ff?style=for-the-badge)](https://trikomi.com)
[![Role](https://img.shields.io/badge/Role-3D%20Asset%20%26%20UV%20Studio-a855f7?style=for-the-badge)](https://trikomi.com)

---

## 🌐 Trikomi Platform Ecosystem Bridge

- **`trikomi`** (`/media/vijaykc/projects/trikomi`): Monorepo core SDK source (`@trikomi/core`, WebGPU engine, WASM security).
- **`trikomi-demo`** (`/media/vijaykc/projects/trikomi-demo`): React B2B reference configurators (Sportswear, Jewelry, Eyewear, Box).
- **`trikomi-vanilla-demos`** (`/media/vijaykc/projects/trikomi-vanilla-demos`): Zero-framework HTML5/ESM showcases.
- **`trikomi-studio` (This Repository)**: Dedicated 3D Garment Asset & Canonical UV Studio workstation.

---

## 1. System Architecture

```
   ┌────────────────────────────────────────────────────────┐
   │                   Trikomi Studio UI                    │
   │   ┌─────────────┐   ┌──────────────┐   ┌────────────┐   │
   │   │  StudioTop  │   │  LeftPanel   │   │ RightPanel │   │
   │   │   (Modes)   │   │(Tree/Search) │   │ (UV Canvas)│   │
   │   └──────┬──────┘   └──────┬───────┘   └─────┬──────┘   │
   │          │                 │                 │          │
   │          └────────────┐    │    ┌────────────┘          │
   │                       ▼    ▼    ▼                       │
   │                  ┌──────────────────┐                   │
   │                  │   MobX Stores    │                   │
   │                  │ (model/organizer)│                   │
   │                  └────────┬─────────┘                   │
   └───────────────────────────┼─────────────────────────────┘
                               │ Dispatches Actions & Observes
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │               Trikomi Studio Addon Plugins              │
   │           (Conforming to IViewerPlugin Contract)        │
   │                                                         │
   │  ┌───────────────────────┐   ┌───────────────────────┐  │
   │  │   ModelStudioPlugin   │   │    UVStudioPlugin     │  │
   │  │(Hierarchy, Decimate)  │   │(Canonical, Packing)   │  │
   │  └───────────────────────┘   └───────────────────────┘  │
   │  ┌───────────────────────┐   ┌───────────────────────┐  │
   │  │ MaterialStudioPlugin  │   │ AuditValidationPlugin │  │
   │  │  (PBR Swatches, Wire) │   │(Watertight, Overlap)  │  │
   │  └───────────────────────┘   └───────────────────────┘  │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │              EnvironmentStudioPlugin              │  │
   │  │         (HDR Reflections, Clear Color)            │  │
   │  └───────────────────────────────────────────────────┘  │
   └───────────────────────────┬─────────────────────────────┘
                               │ Lifecycle & Render Hooks
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │                    @trikomi/core SDK                    │
   │     (ThreeViewer, WebGPU / WebGL Pipelines, WASM)       │
   └─────────────────────────────────────────────────────────┘
```

---

## 2. Studio Workstation Modes (TopBar Navigation)

1. **`Model Studio`** (`model`):
   - 3D Garment Viewport focus.
   - Left Panel: Piece hierarchy tree, search filter, visibility toggles, ghosting (`0.35` opacity), and piece transform cards.
   - Bottom Dock: Non-destructive decimation slider, triangle count audit, and active pieces.
2. **`UV Studio`** (`uv`):
   - 2D Canonical UV Canvas View (`UVCanvasView.tsx`).
   - Right Panel: Canonical slot assignments (Chest, Back, Sleeves, Collar), automatic pattern auto-detection, and isotropic pack button.
   - Litmus test numbered grid projection.
3. **`Material Studio`** (`material`):
   - PBR Fabric swatch cards (Jersey Blue, Jersey Black, Mesh White, Metallic, Fabric Neon, Pattern).
   - Real-time roughness, metalness, and base color mutation with material isolation (`baseMat.clone()`).
4. **`Asset Validation`** (`validation`):
   - Mesh watertight audit, open edge detection, degenerate triangle inspection, and UV boundary overlap report.

---

## 3. Directory & File Blueprint

```
trikomi-studio/
├── AGENTS.md                    # Studio operational rules and agent guidelines
├── ARCHITECTURE.md              # System design, data flows, and mode blueprints
├── docs/
│   └── UV_STUDIO_ROADMAP.md     # 5-Phase UV Studio development roadmap
├── public/
│   ├── data/                    # Curated catalog JSON definitions
│   ├── textures/                # Litmus test alignment textures
│   └── favicon.svg              # Trikomi brand SVG
├── src/
│   ├── components/
│   │   ├── studio/              # Reusable semantic Studio chassis components
│   │   │   ├── StudioCard.tsx             # Nested collapsible card with dynamic flex redistribution
│   │   │   ├── StudioTopBar.tsx           # Brand + Mode tabs + Dock toggles
│   │   │   ├── StudioLeftPanel.tsx        # Scene Explorer, Piece Tree, Transforms (Nested Cards)
│   │   │   ├── StudioCenterViewport.tsx   # 3D Garment Viewport & Controls
│   │   │   ├── StudioRightPanel.tsx       # UV Editor Canvas & Canonical slots (Nested Cards)
│   │   │   └── StudioBottomDock.tsx       # Material Library & Decimation (Nested Collapsible Cards)
│   │   ├── UVCanvasView.tsx     # 2D UV island canvas renderer
│   │   └── UVZoneEditorModal.tsx# Canonical zone editor dialog
│   ├── plugins/                 # Trikomi Addon Plugins (IViewerPlugin)
│   │   ├── TrikomiPluginBase.ts           # Abstract base class
│   │   ├── ModelStudioPlugin.ts           # Mesh hierarchy & decimation
│   │   ├── UVStudioPlugin.ts              # Canonical layout & litmus
│   │   ├── MaterialStudioPlugin.ts        # PBR fabric finishes
│   │   ├── EnvironmentStudioPlugin.ts     # HDR reflection lighting
│   │   ├── AuditValidationPlugin.ts       # Watertight & overlap audit
│   │   └── index.ts                       # Barrel export
│   ├── store/
│   │   ├── modelStore.ts        # MobX 3D garment & viewport state
│   │   └── uvOrganizerStore.ts  # MobX Canonical UV pattern organizer state
│   ├── studio.css               # Semantic cyber chassis styling & tokens
│   ├── App.tsx                  # Main Studio Shell layout
│   └── main.tsx                 # Application entrypoint
└── vite.config.js               # Local SDK resolution & Bridge server
```

---

## 4. Development & Build Blueprints

```bash
# 1. Typecheck with Zero Errors
npx tsc --noEmit

# 2. Build Production Bundle
pnpm run build

# 3. Development Server with Local SDK hot-reloading
pnpm dev
```

## Studio Plugin Addon Status

- **`ModelStudioPlugin`** (`src/plugins/ModelStudioPlugin.ts`): Attached to scene for piece hierarchy, visibility, ghosting (`0.35` opacity), and decimation geometry preservation.
- **`UVStudioPlugin`** (`src/plugins/UVStudioPlugin.ts`): Connected to canonical 2D UV layout, pattern unwrap, and litmus projection.
- **`MaterialStudioPlugin`** (`src/plugins/MaterialStudioPlugin.ts`): Active for PBR swatches, color manipulation, and material cloning.
- **`EnvironmentStudioPlugin`** (`src/plugins/EnvironmentStudioPlugin.ts`): Controls HDR reflections, viewport background, and clear colors.
- **`AuditValidationPlugin`** (`src/plugins/AuditValidationPlugin.ts`): Runs non-destructive manifold geometry and UV bounds inspection.
