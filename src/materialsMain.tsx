import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { materialLibraryStore } from '@trikomi/core/studio';
import { StudioMaterialLibraryView } from './components/studio/StudioMaterialLibraryView';
import './studio.css';

const StandaloneMaterialsApp: React.FC = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#070b12', overflow: 'hidden' }}>
      {/* Top Bar Header */}
      <header
        style={{
          height: '48px',
          background: 'rgba(11, 15, 23, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 40 40" fill="none" style={{ width: '24px', height: '24px' }}>
              <path d="M6 12L20 4L34 12V28L20 36L6 28V12Z" stroke="#14d9ff" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M20 4V36" stroke="rgba(20,217,255,0.4)" strokeWidth="1.5" />
              <path d="M6 12L34 28" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="5" fill="#a855f7" filter="drop-shadow(0 0 8px #14d9ff)" />
            </svg>
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>TRIKOMI 3D</span>
            <span style={{ fontSize: '10px', color: 'var(--neon-cyan)', marginLeft: '8px', padding: '1px 6px', background: 'rgba(56,189,248,0.15)', borderRadius: '3px' }}>
              PBR Fabric Material Library (3D Sphere Scene)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="/"
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              textDecoration: 'none'
            }}
          >
            ← Back to Garment Studio
          </a>
        </div>
      </header>

      {/* Main 3D Spheres View */}
      <main style={{ flex: 1, height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
        <StudioMaterialLibraryView />
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('materials-root')!);
root.render(<StandaloneMaterialsApp />);
