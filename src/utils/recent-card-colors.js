const STORAGE_KEY = 'recentCardColors';

function loadRecentCardColors() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter(c => typeof c === 'string');
    }
  } catch (e) {
    console.warn('Kunde inte läsa senaste färger', e);
  }
  return [];
}

function saveRecentCardColors(colors) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors.slice(0, 5)));
  } catch (e) {
    console.warn('Kunde inte spara senaste färger', e);
  }
}

export function addRecentCardColor(color) {
  if (!color) return loadRecentCardColors();
  const recents = loadRecentCardColors();
  const filtered = recents.filter(c => c !== color);
  const updated = [color, ...filtered].slice(0, 5);
  saveRecentCardColors(updated);
  return updated;
}

export { loadRecentCardColors };
