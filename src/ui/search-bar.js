import { clearClipboard, deselectAllCards, searchCards } from '../lib/canvas.js';
import { renderColumnView } from './view-switcher.js';

export function initSearchBar(state) {
  const searchInput = document.getElementById('search-input');

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

  // Escape to clear search, Enter to blur (local - when focused)
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      handleSearch({ target: searchInput }); // Clear search results
      searchInput.blur(); // Unfocus the search input
    } else if (e.key === 'Enter') {
      e.preventDefault();
      searchInput.blur(); // Unfocus so keyboard shortcuts work
    }
  });

  // Global Escape handler for search, clipboard, and selection
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Clear clipboard
      clearClipboard();

      // Deselect all cards
      deselectAllCards();

      // If search has content, clear it
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        handleSearch({ target: searchInput }); // Clear search results
        searchInput.blur(); // Unfocus the search input
      }
    }
  });

  return { handleSearch };
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
