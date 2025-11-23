/**
 * Spatial View v1.0
 * Main entry point
 */

import './styles.css';
import { detectDeviceMode, initApp } from './core/app.js';
import { initToolbar, handleDriveSync, handleRestoreBackup, handleRestoreFromBlob } from './ui/toolbar.js';
import { initSearchBar } from './ui/search-bar.js';
import { initViewSwitcher } from './ui/view-switcher.js';
import { setContextResolver } from './lib/command-registry.js';
import { initStatsDisplay } from './ui/stats-display.js';

// App state
const state = {
  currentView: 'board', // 'board' | 'column'
  deviceMode: detectDeviceMode(),
  theme: localStorage.getItem('theme') || 'light',
  uiMode: localStorage.getItem('uiMode') || 'full', // 'full' | 'minimal' | 'toggle-only'
  cards: [],
};

setContextResolver(() => [state.currentView, 'global']);

function initInfoOverlay() {
  const floatingHeader = document.getElementById('floating-header');
  const infoOverlay = document.getElementById('info-overlay');
  const infoClose = document.getElementById('info-close');

  floatingHeader?.addEventListener('click', () => {
    infoOverlay?.classList.add('active');
  });

  infoClose?.addEventListener('click', () => {
    infoOverlay?.classList.remove('active');
  });

  // Close on overlay background click
  infoOverlay?.addEventListener('click', (e) => {
    if (e.target === infoOverlay) {
      infoOverlay.classList.remove('active');
    }
  });
}

async function start() {
  initViewSwitcher(state);
  await initApp(state);
  initToolbar(state);
  initSearchBar(state);
  initInfoOverlay();
  initStatsDisplay();
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

// Export state for debugging
if (import.meta.env.DEV) {
  window.__SPATIAL_VIEW__ = state;
}

// Export restore and sync functions for canvas.js and drive-sync.js
window.handleRestoreBackup = handleRestoreBackup;
window.handleRestoreFromBlob = handleRestoreFromBlob;
window.handleDriveSync = handleDriveSync;
