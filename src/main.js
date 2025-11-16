/**
 * Spatial View v1.0
 * Main entry point
 *
 * ⚠️ TODO: DENNA FIL ÄR FÖR STOR (606+ rader)!
 * Behöver delas upp enligt ARCHITECTURE.md:
 * - ui/toolbar.js (toolbar interactions, knappar)
 * - ui/search-bar.js (sök-input hantering)
 * - ui/view-switcher.js (byten mellan board/column view)
 * - core/app.js (huvudsaklig init-logik)
 * main.js ska bara vara ~50 rader orchestrator
 */

import './styles.css';
import { initCanvas, addNewCard, exportCanvas, importImage, searchCards, clearClipboard, deselectAllCards } from './lib/canvas.js';
import { initStorage } from './lib/storage.js';

// App state
const state = {
  currentView: 'board', // 'board' | 'column'
  deviceMode: detectDeviceMode(),
  theme: localStorage.getItem('theme') || 'light',
  uiMode: localStorage.getItem('uiMode') || 'full', // 'full' | 'minimal' | 'toggle-only'
  cards: [],
};

/**
 * Detect device mode for optimizations
 */
function detectDeviceMode() {
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
function applyDeviceOptimizations() {
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
 * Initialize app
 */
async function init() {
  console.log('Initializing Spatial View...');
  console.log('Device mode:', state.deviceMode);
  
  // Apply device optimizations
  applyDeviceOptimizations();

  // Apply saved theme BEFORE initializing canvas
  applySavedTheme();

  // Initialize storage
  await initStorage();

  // Initialize canvas (Konva) - always initialize for switching
  await initCanvas();

  // Setup event listeners
  setupEventListeners();

  // If starting in column view, render it
  if (state.currentView === 'column') {
    await renderColumnView();
  }

  console.log('Spatial View ready!');
}

/**
 * Apply saved theme from localStorage
 * Called BEFORE canvas initialization to ensure cards render with correct theme
 */
function applySavedTheme() {
  const body = document.body;
  const savedTheme = localStorage.getItem('theme') || state.theme;
  if (savedTheme && savedTheme !== 'light') {
    body.classList.remove('dark-theme', 'eink-theme', 'sepia-theme');
    if (savedTheme === 'dark') {
      body.classList.add('dark-theme');
    } else if (savedTheme === 'eink') {
      body.classList.add('eink-theme');
    }
    state.theme = savedTheme;
    console.log('Applied saved theme:', savedTheme);
  }
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {

  // View toggle
  const viewToggle = document.getElementById('btn-view-toggle');
  viewToggle?.addEventListener('click', toggleView);

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn?.addEventListener('click', toggleTheme);

  // UI mode toggle
  const uiModeToggle = document.getElementById('btn-ui-mode-toggle');
  uiModeToggle?.addEventListener('click', toggleUIMode);

  // Import button
  const importBtn = document.getElementById('btn-import');
  importBtn?.addEventListener('click', handleImport);

  // Download button
  const downloadBtn = document.getElementById('btn-download');
  downloadBtn?.addEventListener('click', handleDownloadBackup);

  // Search
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', debounce(handleSearch, 300));

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

  // Listen for toggle view event from canvas
  window.addEventListener('toggleView', toggleView);

  // Listen for toggle theme event from canvas
  window.addEventListener('toggleTheme', toggleTheme);

  // Apply saved UI mode
  applyUIMode();

  // Info overlay handlers
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

/**
 * Toggle between board and column view
 */
async function toggleView() {
  state.currentView = state.currentView === 'board' ? 'column' : 'board';

  const boardView = document.getElementById('board-view');
  const columnView = document.getElementById('column-view');
  const toggleBtn = document.getElementById('btn-view-toggle');

  if (state.currentView === 'board') {
    boardView?.classList.add('active');
    columnView?.classList.remove('active');
    toggleBtn.textContent = '▯'; // Icon for Column view (what it will switch to)
  } else {
    boardView?.classList.remove('active');
    columnView?.classList.add('active');
    toggleBtn.textContent = '▬'; // Icon for Board view (what it will switch to)
    // Load cards in column view
    await renderColumnView();
  }
}

/**
 * Render cards in column view
 */
async function renderColumnView(searchQuery = '') {
  const cardList = document.getElementById('card-list');
  if (!cardList) return;

  // Import storage to get cards
  const { getAllCards } = await import('./lib/storage.js');
  let cards = await getAllCards();

  // Clear existing content
  cardList.innerHTML = '';

  if (cards.length === 0) {
    cardList.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Inga kort ännu. Klicka på "+ Lägg till" för att skapa ett kort.</div>';
    return;
  }

  // Filter by search query if provided
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.trim().toLowerCase();

    // Import boolean search function
    const { evaluateBooleanQuery } = await import('./lib/canvas.js');

    cards = cards.filter(card => {
      const text = card.text || '';
      const backText = card.backText || '';
      const combinedText = (text + ' ' + backText).toLowerCase();

      // Use boolean search (same as board view)
      return evaluateBooleanQuery(query, combinedText);
    });

    if (cards.length === 0) {
      cardList.innerHTML = `<div style="padding: 40px; text-align: center; color: #999;">Inga kort matchade "${searchQuery}"</div>`;
      return;
    }
  }

  // Sort cards by last modified (newest first)
  const sortedCards = [...cards].sort((a, b) => {
    const timeA = a.lastModified || 0;
    const timeB = b.lastModified || 0;
    return timeB - timeA;
  });

  // Check themes
  const isEink = document.body.classList.contains('eink-theme');
  const isDark = document.body.classList.contains('dark-theme');

  // Render each card
  sortedCards.forEach(card => {
    const cardElement = document.createElement('div');
    cardElement.className = 'column-card';

    if (isEink) {
      // E-ink: white card, black border, NO shadows, rounded corners
      cardElement.style.cssText = `
        background: white;
        border: 2px solid #000;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: none;
        cursor: pointer;
        transition: none;
      `;
    } else if (isDark) {
      // Dark theme: blue card, white text
      cardElement.style.cssText = `
        background: #2d3748;
        border: 1px solid #4a5568;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        transition: all 0.2s;
        color: #e0e0e0;
      `;
    } else {
      // Light theme
      cardElement.style.cssText = `
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition: all 0.2s;
      `;
    }

    if (card.image) {
      // Image card
      const img = document.createElement('img');
      // Handle both direct base64 string and object format
      const imageSrc = typeof card.image === 'string' ? card.image : card.image.base64;
      img.src = imageSrc;
      img.style.cssText = `
        width: 100%;
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin-bottom: 12px;
        display: block;
      `;

      // Error handling for images
      img.onerror = () => {
        console.error('Failed to load image for card:', card.id);
        img.style.display = 'none';
        const errorText = document.createElement('div');
        errorText.textContent = '⚠️ Bild kunde inte laddas';
        errorText.style.cssText = `
          padding: 20px;
          background: #fff3cd;
          border-radius: 4px;
          color: #856404;
          text-align: center;
          margin-bottom: 12px;
        `;
        cardElement.insertBefore(errorText, cardElement.firstChild);
      };

      cardElement.appendChild(img);

      if (card.text || card.backText) {
        const text = document.createElement('div');
        text.textContent = card.backText || card.text || '';
        text.style.cssText = `
          font-size: 14px;
          color: ${isDark ? '#e0e0e0' : '#666'};
          line-height: 1.5;
          white-space: pre-wrap;
        `;
        cardElement.appendChild(text);
      }
    } else {
      // Text card
      const text = document.createElement('div');
      text.textContent = card.text || 'Tomt kort';
      text.style.cssText = `
        font-size: 16px;
        color: ${isDark ? '#e0e0e0' : '#1a1a1a'};
        line-height: 1.6;
        white-space: pre-wrap;
      `;
      cardElement.appendChild(text);
    }

    // Hover effect
    cardElement.addEventListener('mouseenter', () => {
      if (isEink) {
        // E-ink: thicker border on hover
        cardElement.style.border = '3px solid #000';
      } else if (isDark) {
        // Dark theme
        cardElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
        cardElement.style.transform = 'translateY(-2px)';
      } else {
        // Light theme
        cardElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        cardElement.style.transform = 'translateY(-2px)';
      }
    });

    cardElement.addEventListener('mouseleave', () => {
      if (isEink) {
        // E-ink: back to normal border
        cardElement.style.border = '2px solid #000';
      } else if (isDark) {
        // Dark theme
        cardElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        cardElement.style.transform = 'translateY(0)';
      } else {
        // Light theme
        cardElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        cardElement.style.transform = 'translateY(0)';
      }
    });

    // Click to select (same as board view)
    cardElement.addEventListener('click', () => {
      const isSelected = cardElement.classList.contains('selected');

      if (isSelected) {
        cardElement.classList.remove('selected');
        if (isEink) {
          cardElement.style.border = '2px solid #000';
        } else if (isDark) {
          cardElement.style.border = '1px solid #4a5568';
        } else {
          cardElement.style.border = '1px solid #e0e0e0';
        }
      } else {
        cardElement.classList.add('selected');
        if (isEink) {
          cardElement.style.border = '4px solid #000';
        } else {
          cardElement.style.border = '3px solid #2196F3';
        }
      }
    });

    // Double-click to edit - inline editing for column view
    cardElement.addEventListener('dblclick', () => {
      showColumnInlineEdit(card, cardElement);
    });

    // Right-click context menu (same as board view)
    cardElement.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      // Import context menu function from canvas
      const { showContextMenu } = await import('./lib/canvas.js');
      showContextMenu(e.clientX, e.clientY, card.id, cardElement);
    });

    // Touch handlers (same as board view)
    let touchTimer = null;
    let touchStartY = null;
    let hasMoved = false;

    cardElement.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      hasMoved = false;

      // Long press timer
      touchTimer = setTimeout(async () => {
        if (!hasMoved) {
          // Long press detected
          const selectedCards = cardList.querySelectorAll('.column-card.selected');

          if (selectedCards.length > 1 && cardElement.classList.contains('selected')) {
            // Multiple cards selected: show bulk menu
            const { showTouchBulkMenu } = await import('./lib/canvas.js');
            await showTouchBulkMenu(e.touches[0].clientX, e.touches[0].clientY);
          } else {
            // Single card: open editor
            showColumnEditDialog(card, cardElement);
          }
          touchTimer = null;
        }
      }, 600); // 600ms long press
    });

    cardElement.addEventListener('touchmove', (e) => {
      const currentY = e.touches[0].clientY;
      const moved = Math.abs(currentY - touchStartY) > 3;
      if (moved) {
        hasMoved = true;
      }
    });

    cardElement.addEventListener('touchend', () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    });

    cardElement.addEventListener('touchcancel', () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    });

    cardList.appendChild(cardElement);
  });
}

/**
 * Show edit dialog for card in column view
 */
/**
 * Show inline editor in column view
 */
async function showColumnInlineEdit(card, cardElement) {
  // Check if already editing
  if (cardElement.querySelector('.inline-editor')) return;

  const isImageCard = !!card.image;
  const currentText = isImageCard ? (card.backText || '') : (card.text || '');
  const currentTags = card.tags || [];
  const currentColor = card.cardColor || '';

  // Create inline editor container
  const editorContainer = document.createElement('div');
  editorContainer.className = 'inline-editor';
  editorContainer.style.cssText = `
    padding: 16px;
    background: var(--bg-secondary);
    border: 2px solid var(--accent-color);
    border-radius: 8px;
    margin-top: 12px;
  `;

  // If image card, show image first
  let imageHTML = '';
  if (isImageCard) {
    const imageSrc = typeof card.image === 'string' ? card.image : card.image.base64;
    imageHTML = `
      <div style="margin-bottom: 16px;">
        <img src="${imageSrc}" style="width: 100%; border-radius: 8px;" alt="Card image" />
      </div>
    `;
  }

  editorContainer.innerHTML = `
    ${imageHTML}

    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Text:</label>
      <textarea id="column-edit-text"
        style="width: 100%; min-height: 150px; padding: 10px; font-size: 15px;
               border: 2px solid var(--border-color); border-radius: 6px;
               background: var(--bg-primary); color: var(--text-primary);
               font-family: inherit; resize: vertical; box-sizing: border-box;"
      >${currentText}</textarea>
    </div>

    ${!isImageCard ? `
    <div style="margin-bottom: 12px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Tags (kommaseparerade):</label>
      <input type="text" id="column-edit-tags" value="${currentTags.join(', ')}"
        style="width: 100%; padding: 10px; font-size: 15px;
               border: 2px solid var(--border-color); border-radius: 6px;
               background: var(--bg-primary); color: var(--text-primary);
               box-sizing: border-box;">
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Kortfärg:</label>
      <div id="column-color-picker" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <div class="color-dot" data-color="" style="width: 32px; height: 32px; border-radius: 50%;
             background: var(--bg-primary); border: 3px solid var(--border-color); cursor: pointer;
             display: flex; align-items: center; justify-content: center; font-size: 18px;"
             title="Ingen färg">⭘</div>
        <div class="color-dot" data-color="card-color-1" style="width: 32px; height: 32px; border-radius: 50%;
             background: #d4f2d4; border: 3px solid ${currentColor === 'card-color-1' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Grön"></div>
        <div class="color-dot" data-color="card-color-2" style="width: 32px; height: 32px; border-radius: 50%;
             background: #ffe4b3; border: 3px solid ${currentColor === 'card-color-2' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Orange"></div>
        <div class="color-dot" data-color="card-color-3" style="width: 32px; height: 32px; border-radius: 50%;
             background: #ffc1cc; border: 3px solid ${currentColor === 'card-color-3' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Röd"></div>
        <div class="color-dot" data-color="card-color-4" style="width: 32px; height: 32px; border-radius: 50%;
             background: #fff7b3; border: 3px solid ${currentColor === 'card-color-4' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Gul"></div>
        <div class="color-dot" data-color="card-color-5" style="width: 32px; height: 32px; border-radius: 50%;
             background: #f3e5f5; border: 3px solid ${currentColor === 'card-color-5' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Lila"></div>
        <div class="color-dot" data-color="card-color-6" style="width: 32px; height: 32px; border-radius: 50%;
             background: #c7e7ff; border: 3px solid ${currentColor === 'card-color-6' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Blå"></div>
        <div class="color-dot" data-color="card-color-7" style="width: 32px; height: 32px; border-radius: 50%;
             background: #e0e0e0; border: 3px solid ${currentColor === 'card-color-7' ? '#2196F3' : 'transparent'}; cursor: pointer;" title="Grå"></div>
        <div class="color-dot" data-color="card-color-8" style="width: 32px; height: 32px; border-radius: 50%;
             background: #ffffff; border: 3px solid ${currentColor === 'card-color-8' ? '#2196F3' : '#ddd'}; cursor: pointer;" title="Vit"></div>
      </div>
    </div>
    ` : ''}

    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="column-cancel-edit" style="padding: 10px 20px; background: var(--bg-secondary);
                                         color: var(--text-primary); border: 2px solid var(--border-color);
                                         border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;">
        Avbryt
      </button>
      <button id="column-delete-card" style="padding: 10px 20px; background: #dc3545;
                                         color: white; border: none; border-radius: 6px;
                                         font-size: 14px; font-weight: 500; cursor: pointer;">
        🗑️ Ta bort
      </button>
      <button id="column-save-edit" style="padding: 10px 20px; background: var(--accent-color);
                                        color: white; border: none; border-radius: 6px;
                                        font-size: 14px; font-weight: 600; cursor: pointer;">
        Spara
      </button>
    </div>

    <div style="margin-top: 12px; font-size: 12px; color: var(--text-secondary); text-align: center;">
      Ctrl+Enter = Spara, Esc = Avbryt
    </div>
  `;

  cardElement.appendChild(editorContainer);

  // Get elements
  const textarea = editorContainer.querySelector('#column-edit-text');
  const tagsInput = editorContainer.querySelector('#column-edit-tags');
  const saveBtn = editorContainer.querySelector('#column-save-edit');
  const cancelBtn = editorContainer.querySelector('#column-cancel-edit');
  const deleteBtn = editorContainer.querySelector('#column-delete-card');
  const colorPicker = editorContainer.querySelector('#column-color-picker');

  // Focus textarea
  textarea.focus();
  textarea.select();

  // Track selected color
  let selectedColor = currentColor;

  // Color picker logic
  if (colorPicker) {
    const colorDots = colorPicker.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const color = dot.dataset.color;
        selectedColor = color;

        // Update borders
        colorDots.forEach(d => {
          if (d.dataset.color === color) {
            d.style.border = '3px solid #2196F3';
          } else {
            d.style.border = d.dataset.color === 'card-color-8' ? '3px solid #ddd' : '3px solid transparent';
          }
        });
      });
    });
  }

  // Save function
  const saveEdit = async () => {
    const newText = textarea.value;
    const { updateCard } = await import('./lib/storage.js');

    const updates = {};

    if (isImageCard) {
      updates.backText = newText;
    } else {
      updates.text = newText;

      // Parse tags
      if (tagsInput) {
        const tagString = tagsInput.value.trim();
        updates.tags = tagString ? tagString.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
      }

      // Set color
      updates.cardColor = selectedColor;
    }

    await updateCard(card.id, updates);
    editorContainer.remove();
    await renderColumnView(); // Refresh view
  };

  // Cancel function
  const cancelEdit = () => {
    editorContainer.remove();
  };

  // Delete function
  const deleteCard = async () => {
    if (confirm('Är du säker på att du vill ta bort detta kort?')) {
      const { deleteCard } = await import('./lib/storage.js');
      await deleteCard(card.id);
      await renderColumnView();
    }
  };

  // Event listeners
  saveBtn.addEventListener('click', saveEdit);
  cancelBtn.addEventListener('click', cancelEdit);
  deleteBtn.addEventListener('click', deleteCard);

  // Keyboard shortcuts
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      cancelEdit();
      document.removeEventListener('keydown', keyHandler);
    } else if (e.ctrlKey && e.key === 'Enter') {
      saveEdit();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

/**
 * OLD: Show edit dialog (modal) - kept for reference but replaced with inline
 */
async function showColumnEditDialog_OLD(card, cardElement) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  // Title
  const title = document.createElement('h2');
  title.textContent = card.image ? 'Redigera bildkort' : 'Redigera textkort';
  title.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 24px;
    color: #1a1a1a;
  `;
  dialog.appendChild(title);

  // If image card, show image
  if (card.image) {
    const img = document.createElement('img');
    // Handle both direct base64 string and object format
    const imageSrc = typeof card.image === 'string' ? card.image : card.image.base64;
    img.src = imageSrc;
    img.style.cssText = `
      width: 100%;
      border-radius: 8px;
      margin-bottom: 16px;
    `;
    dialog.appendChild(img);
  }

  // Text area
  const textarea = document.createElement('textarea');
  const textToEdit = card.image ? (card.backText || '') : (card.text || '');
  textarea.value = textToEdit;
  textarea.style.cssText = `
    width: 100%;
    min-height: 200px;
    padding: 12px;
    font-size: 16px;
    font-family: sans-serif;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    resize: vertical;
    margin-bottom: 16px;
  `;
  dialog.appendChild(textarea);

  // Buttons container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  `;

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '🗑️ Ta bort';
  deleteBtn.style.cssText = `
    padding: 10px 20px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  deleteBtn.addEventListener('mouseenter', () => {
    deleteBtn.style.background = '#c82333';
  });
  deleteBtn.addEventListener('mouseleave', () => {
    deleteBtn.style.background = '#dc3545';
  });
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Är du säker på att du vill ta bort detta kort?')) {
      const { deleteCard } = await import('./lib/storage.js');
      await deleteCard(card.id);
      overlay.remove();
      await renderColumnView(); // Refresh the view
    }
  });

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Avbryt';
  cancelBtn.style.cssText = `
    padding: 10px 20px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#5a6268';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = '#6c757d';
  });
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Spara';
  saveBtn.style.cssText = `
    padding: 10px 20px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  saveBtn.addEventListener('mouseenter', () => {
    saveBtn.style.background = '#218838';
  });
  saveBtn.addEventListener('mouseleave', () => {
    saveBtn.style.background = '#28a745';
  });
  saveBtn.addEventListener('click', async () => {
    const newText = textarea.value;
    const { updateCard } = await import('./lib/storage.js');

    if (card.image) {
      await updateCard(card.id, { backText: newText });
    } else {
      await updateCard(card.id, { text: newText });
    }

    overlay.remove();
    await renderColumnView(); // Refresh the view
  });

  buttonContainer.appendChild(deleteBtn);
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(saveBtn);
  dialog.appendChild(buttonContainer);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus textarea
  textarea.focus();
  textarea.select();

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Close on ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Toggle theme
 */
async function toggleTheme() {
  const body = document.body;

  // Get current theme from class
  let currentTheme = 'light';
  if (body.classList.contains('dark-theme')) currentTheme = 'dark';
  else if (body.classList.contains('eink-theme')) currentTheme = 'eink';

  const themes = ['light', 'dark', 'eink'];
  const currentIndex = themes.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themes.length;
  const nextTheme = themes[nextIndex];

  // Remove all theme classes
  body.classList.remove('dark-theme', 'eink-theme', 'sepia-theme');

  // Add new theme class (except for light which is default)
  if (nextTheme === 'dark') {
    body.classList.add('dark-theme');
  } else if (nextTheme === 'eink') {
    body.classList.add('eink-theme');
  }

  // Also set data attribute for consistency
  body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
  state.theme = nextTheme;

  // Update button text
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    // The text is now removed, but we could update a title/tooltip here
    const themeTitles = {
      'light': 'Byt till mörkt tema',
      'dark': 'Byt till e-ink tema',
      'eink': 'Byt till ljust tema'
    };
    themeBtn.title = themeTitles[nextTheme] || 'Byt tema';
  }

  // Update card appearances based on new theme
  const { updateCardShadows, updateCardFills, updateCardStrokes } = await import('./lib/canvas.js');
  updateCardShadows();
  await updateCardFills(); // Use await since it's an async function
  updateCardStrokes();

  console.log(`Theme changed to: ${nextTheme}`);
}

/**
 * Toggle UI mode (full -> minimal -> toggle-only -> full)
 */
function toggleUIMode() {
  const modes = ['full', 'minimal', 'toggle-only'];
  const currentIndex = modes.indexOf(state.uiMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  state.uiMode = modes[nextIndex];

  // Save to localStorage
  localStorage.setItem('uiMode', state.uiMode);

  // Apply the new mode
  applyUIMode();

  console.log(`UI mode changed to: ${state.uiMode}`);
}

/**
 * Apply UI mode - show/hide buttons
 */
function applyUIMode() {
  const toolbar = document.getElementById('toolbar');
  const toolbarActions = document.getElementById('toolbar-actions');
  const commandPaletteBtn = document.getElementById('command-palette-button');
  const addBtn = document.getElementById('add-button');
  const fitAllBtn = document.getElementById('fit-all-button');
  const uiToggleBtn = document.getElementById('btn-ui-mode-toggle');

  if (!toolbar) return;

  // Reset toggle button to default position first
  if (uiToggleBtn) {
    uiToggleBtn.style.position = '';
    uiToggleBtn.style.top = '';
    uiToggleBtn.style.right = '';
    uiToggleBtn.style.zIndex = '';
  }

  // Mode 1: Full - show everything
  if (state.uiMode === 'full') {
    toolbar.style.display = 'flex';
    if (toolbarActions) {
      toolbarActions.style.display = 'flex';
      // Show all buttons in toolbar
      Array.from(toolbarActions.children).forEach(child => {
        child.style.display = '';
      });
    }
    if (commandPaletteBtn) commandPaletteBtn.style.display = 'flex';
    if (addBtn) addBtn.style.display = 'flex';
    if (fitAllBtn) fitAllBtn.style.display = 'flex';
    if (uiToggleBtn) uiToggleBtn.title = 'Byt till minimalt UI';
  }

  // Mode 2: Minimal - hide toolbar buttons EXCEPT toggle, show floating command palette
  else if (state.uiMode === 'minimal') {
    // Hide toolbar buttons except toggle
    if (toolbarActions) {
      Array.from(toolbarActions.children).forEach(child => {
        if (child.id === 'btn-ui-mode-toggle') {
          child.style.display = '';
        } else {
          child.style.display = 'none';
        }
      });
      toolbarActions.style.display = 'flex';
    }
    // Show floating command palette button
    if (commandPaletteBtn) commandPaletteBtn.style.display = 'flex';
    if (addBtn) addBtn.style.display = 'none';
    if (fitAllBtn) fitAllBtn.style.display = 'none';
    toolbar.style.display = 'flex';
    if (uiToggleBtn) uiToggleBtn.title = 'Byt till endast UI-knapp';
  }

  // Mode 3: Toggle-only - show ONLY toggle button
  else if (state.uiMode === 'toggle-only') {
    // Hide toolbar buttons except toggle
    if (toolbarActions) {
      Array.from(toolbarActions.children).forEach(child => {
        if (child.id === 'btn-ui-mode-toggle') {
          child.style.display = '';
        } else {
          child.style.display = 'none';
        }
      });
      toolbarActions.style.display = 'flex';
    }
    // Hide floating buttons
    if (commandPaletteBtn) commandPaletteBtn.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    if (fitAllBtn) fitAllBtn.style.display = 'none';
    toolbar.style.display = 'flex';
    if (uiToggleBtn) uiToggleBtn.title = 'Byt till fullt UI';
  }

  console.log(`Applied UI mode: ${state.uiMode}`);
}

/**
 * Handle import action
 */
async function handleImport() {
  if (state.currentView !== 'board') {
    alert('Byt till Board-vy för att lägga till bilder');
    return;
  }

  // Open file picker directly (quality dialog shows after)
  try {
    await importImage();
  } catch (error) {
    console.error('Import failed:', error);
    alert('Misslyckades att importera bild: ' + error.message);
  }
}

/**
 * Handle download backup
 */
async function handleDownloadBackup() {
  try {
    const JSZip = (await import('jszip')).default;
    const { getAllCards } = await import('./lib/storage.js');

    console.log('Creating backup...');
    const zip = new JSZip();

    // Get all cards
    const cards = await getAllCards();

    // Create JSON export
    const jsonData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      cards: cards
    };

    zip.file('cards.json', JSON.stringify(jsonData, null, 2));

    // Add images folder
    const imagesFolder = zip.folder('images');
    let imageCount = 0;

    // Extract and save images
    for (const card of cards) {
      if (card.image) {
        try {
          // Handle both direct base64 string and object format
          const imageSrc = typeof card.image === 'string' ? card.image : card.image.base64;

          // Extract base64 data (remove data:image/png;base64, prefix)
          const base64Data = imageSrc.split(',')[1];

          if (base64Data) {
            // Use card ID as filename
            const filename = `card_${card.id}.png`;
            imagesFolder.file(filename, base64Data, { base64: true });
            imageCount++;
          }
        } catch (error) {
          console.error(`Failed to export image for card ${card.id}:`, error);
        }
      }
    }

    console.log(`Exporting ${cards.length} cards and ${imageCount} images...`);

    // Generate zip file
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Create filename with date
    const date = new Date().toISOString().split('T')[0];
    a.download = `spatial-view-backup-${date}.zip`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Backup created successfully: ${cards.length} cards, ${imageCount} images`);
    alert(`Backup skapad!\n\n${cards.length} kort och ${imageCount} bilder exporterade.`);

  } catch (error) {
    console.error('Backup failed:', error);
    alert('Misslyckades att skapa backup: ' + error.message);
  }
}

/**
 * Handle search input
 */
async function handleSearch(event) {
  const query = event.target.value;
  console.log('[main.js] handleSearch called with:', query);
  console.log('[main.js] currentView:', state.currentView);

  if (state.currentView === 'board') {
    await searchCards(query);
  } else {
    // Column view - filter cards
    await renderColumnView(query);
  }
}

/**
 * Debounce helper
 */
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

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export state for debugging
if (import.meta.env.DEV) {
  window.__SPATIAL_VIEW__ = state;
}
