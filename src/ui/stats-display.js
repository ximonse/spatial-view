/**
 * Stats Display Module
 * Shows selection, pinned, and deleted card statistics
 */

let statsElement = null;
let hideTimeout = null;

export function initStatsDisplay() {
  statsElement = document.getElementById('stats-display');
}

/**
 * Update and show stats display
 * @param {Object} stats - { selected: number, pinned: number, deleted: number, total: number }
 */
export function updateStats(stats) {
  if (!statsElement) return;

  const lines = [];

  if (stats.selected > 0) {
    lines.push(`Markerade: ${stats.selected}`);
  }

  if (stats.pinned > 0) {
    lines.push(`Pinnade: ${stats.pinned}`);
  }

  if (stats.deleted > 0) {
    lines.push(`Raderade: ${stats.deleted}`);
  }

  if (stats.total !== undefined) {
    lines.push(`Totalt: ${stats.total}`);
  }

  if (lines.length > 0) {
    statsElement.textContent = lines.join(' • ');
    showStats();

    // Auto-hide after 3 seconds
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideStats, 3000);
  } else {
    hideStats();
  }
}

/**
 * Show stats display temporarily
 */
export function showStats() {
  if (statsElement) {
    statsElement.classList.add('visible');
  }
}

/**
 * Hide stats display
 */
export function hideStats() {
  if (statsElement) {
    statsElement.classList.remove('visible');
  }
}

/**
 * Clear auto-hide timeout (useful when user is actively selecting)
 */
export function keepStatsVisible() {
  clearTimeout(hideTimeout);
}
