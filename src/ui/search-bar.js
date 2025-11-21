import { clearClipboard, deselectAllCards, searchCards } from '../lib/canvas.js';
import { registerCommand, unregisterCommand } from '../lib/command-registry.js';
import { renderColumnView } from './view-switcher.js';

export function initSearchBar(state) {
  const searchInput = document.getElementById('search-input');
  const registeredIds = new Set();

  const handleSearch = async (event) => {
    const query = event.target.value;
    console.log('[search-bar] handleSearch called with:', query);
    console.log('[search-bar] currentView:', state.currentView);

    if (state.currentView === 'board') {
      await searchCards(query);
    } else {
      // Column view - filter cards
      await renderColumnView(query);
    }
  };

  const debouncedSearch = debounce(handleSearch, 300);

  searchInput?.addEventListener('input', debouncedSearch);

  // Enter to blur when focused (Escape handled via command registry)
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchInput.blur(); // Unfocus so keyboard shortcuts work
    }
  });

  const registerSearchCommands = () => {
    unregisterCommand('focus-search');
    unregisterCommand('clear-selection');

    const focusHandler = () => {
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    };

    const clearHandler = () => {
      const paletteOpen = document.querySelector('[data-command-palette="overlay"]');
      if (paletteOpen) return;

      clearClipboard();
      deselectAllCards();

      if (searchInput && searchInput.value) {
        searchInput.value = '';
        handleSearch({ target: searchInput });
        searchInput.blur();
      }
    };

    registerCommand({ id: 'focus-search', handler: focusHandler, allowInInputs: true });
    registeredIds.add('focus-search');
    registerCommand({
      id: 'clear-selection',
      handler: clearHandler,
      allowInInputs: true,
      priority: 20,
    });
    registeredIds.add('clear-selection');
  };

  registerSearchCommands();

  return {
    handleSearch,
    dispose() {
      registeredIds.forEach(unregisterCommand);
      registeredIds.clear();
    }
  };
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
