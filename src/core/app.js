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

  setupDriveAutoSync();

  console.log('Spatial View ready!');
}

function setupDriveAutoSync() {
  const intervalMs = 2 * 60 * 60 * 1000; // 2 hours
  let intervalId = null;
  let syncing = false;

  const runSync = async (reason) => {
    const hasClientId = Boolean(localStorage.getItem('googleDriveClientId'));
    if (syncing || !hasClientId) {
      return;
    }

    const isClosing = reason === 'pagehide' || reason === 'tab-hidden';
    if (document.visibilityState !== 'visible' && !isClosing) {
      return;
    }
    syncing = true;
    try {
      const { syncWithDrive } = await import('../lib/drive-sync.js');
      await syncWithDrive({ autoMode: true, reason });
    } catch (error) {
      console.error('Auto Drive sync failed:', error);
    } finally {
      syncing = false;
    }
  };

  const startInterval = () => {
    const hasClientId = Boolean(localStorage.getItem('googleDriveClientId'));
    if (intervalId || !hasClientId || document.visibilityState !== 'visible') return;
    intervalId = setInterval(() => runSync('interval'), intervalMs);
  };

  const stopInterval = () => {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  // Start auto-sync when page is visible
  if (document.visibilityState === 'visible') {
    startInterval();
  }

  // Pause timers when hidden, resume on focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startInterval();
    } else {
      stopInterval();
      // Try to sync once right as the tab is being hidden/closed
      runSync('tab-hidden');
    }
  });

  // Extra safeguard for tab close/navigation
  window.addEventListener('pagehide', () => {
    runSync('pagehide');
  });
}
