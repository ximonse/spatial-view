import { initCanvas } from '../lib/canvas.js';
import { initStorage } from '../lib/storage.js';
import { applyThemeFromState } from '../ui/theme.js';
import { renderColumnView } from '../ui/view-switcher.js';

/**
 * Detect device mode for optimizations
 */
export function detectDeviceMode() {
  const ua = navigator.userAgent.toLowerCase();

  // E-ink detection (Viwoood AiPaper Mini or similar)
  if (ua.includes('eink') || ua.includes('viwoood')) {
    return 'eink';
  }

  // Mobile detection
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    return 'mobile';
  }

  // Tablet detection
  if (/tablet|ipad/.test(ua) || (window.innerWidth <= 1024 && 'ontouchstart' in window)) {
    return 'tablet';
  }

  return 'desktop';
}

/**
 * Apply device-specific optimizations
 */
function applyDeviceOptimizations(state) {
  const body = document.body;
  body.classList.add(`device-${state.deviceMode}`);

  if (state.deviceMode === 'eink') {
    // E-ink mode: disable animations, use column view
    state.theme = 'eink';
    state.currentView = 'column';
    // Default to minimal UI for e-ink if not set
    if (!localStorage.getItem('uiMode')) {
      state.uiMode = 'minimal';
    }
    console.log('E-ink mode activated');
  }

  if (state.deviceMode === 'mobile' || state.deviceMode === 'tablet') {
    // Mobile/tablet mode: start with column view
    state.currentView = 'column';
    // Default to minimal UI for touch devices if not set
    if (!localStorage.getItem('uiMode')) {
      state.uiMode = 'minimal';
    }
    console.log(`${state.deviceMode} mode activated`);
  }
}

/**
 * Apply saved theme from localStorage
 * Called BEFORE canvas initialization to ensure cards render with correct theme
 */
function applySavedTheme(state) {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    state.theme = savedTheme;
    console.log('Applied saved theme:', savedTheme);
  }
  applyThemeFromState(state);
}

/**
 * Initialize app
 */
export async function initApp(state) {
  console.log('Initializing Spatial View...');
  console.log('Device mode:', state.deviceMode);

  // Apply device optimizations
  applyDeviceOptimizations(state);

  // Apply saved theme BEFORE initializing canvas
  applySavedTheme(state);

  // Initialize storage
  await initStorage();

  // Initialize canvas (Konva) - always initialize for switching
  await initCanvas();

  // If starting in column view, render it
  if (state.currentView === 'column') {
    await renderColumnView();
  }

  // Check for newer backup in Google Drive (if configured)
  setTimeout(async () => {
    try {
      const { checkAndOfferRestore } = await import('../lib/drive-sync.js');
      await checkAndOfferRestore();
    } catch (error) {
      // Silently fail if Drive sync not configured
      console.log('Drive sync not available:', error.message);
    }
  }, 2000); // Wait 2 seconds after init to avoid blocking startup

  // Auto-sync to Drive on page close
  window.addEventListener('beforeunload', async () => {
    const autoSync = localStorage.getItem('autoSyncOnClose');
    if (autoSync === 'true') {
      try {
        const { syncWithDrive } = await import('../lib/drive-sync.js');
        await syncWithDrive();
      } catch (error) {
        console.error('Auto-sync on close failed:', error);
      }
    }
  });

  console.log('Spatial View ready!');
}
