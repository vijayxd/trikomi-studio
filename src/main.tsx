import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './studio.css'
import { App } from './App'
import { modelStore, uvOrganizerStore, studioViewerManager } from '@trikomi/core/studio'
import { initStudioData } from './services/studioAssetResolver'

// Initialize direct Google Drive integration for GitHub Pages & standalone usage
initStudioData(modelStore, uvOrganizerStore);

// Expose stores for debug inspection & headless test simulations
if (typeof window !== 'undefined') {
  (window as any).modelStore = modelStore;
  (window as any).uvOrganizerStore = uvOrganizerStore;
  (window as any).studioViewerManager = studioViewerManager;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <App />
  );
}
