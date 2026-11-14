import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './studio.css'
import { App } from './App'
import { modelStore, uvOrganizerStore } from '@trikomi/core/studio'

// Expose stores for debug inspection & headless test simulations
if (typeof window !== 'undefined') {
  (window as any).modelStore = modelStore;
  (window as any).uvOrganizerStore = uvOrganizerStore;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <App />
  );
}
