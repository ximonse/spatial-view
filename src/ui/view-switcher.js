import { addRecentCardColor, loadRecentCardColors } from '../utils/recent-card-colors.js';
import { getColorOptionsForTheme, useColoredCards } from '../utils/card-colors.js';
import { getCardImageSrc } from '../utils/card-images.js';

let stateRef;

export function initViewSwitcher(state) {
  stateRef = state;
  window.addEventListener('toggleView', toggleView);
}

/**
 * Toggle between board and column view
 */
export async function toggleView() {
  stateRef.currentView = stateRef.currentView === 'board' ? 'column' : 'board';

  const boardView = document.getElementById('board-view');
  const columnView = document.getElementById('column-view');
  const toggleBtn = document.getElementById('btn-view-toggle');

  if (stateRef.currentView === 'board') {
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
export async function renderColumnView(searchQuery = '') {
  const cardList = document.getElementById('card-list');
  if (!cardList) return;

  // Import storage to get cards
  const { getAllCards } = await import('../lib/storage.js');
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
    const { evaluateBooleanQuery } = await import('../lib/canvas.js');

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

  // Sort cards by modified timestamp (newest first)
  const sortedCards = [...cards].sort((a, b) => {
    const timeA = a.modified ?? a.lastModified ?? 0;
    const timeB = b.modified ?? b.lastModified ?? 0;
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

    const appendTextContent = () => {
      const text = document.createElement('div');
      const primaryText = card.text || card.backText || 'Tomt kort';
      text.textContent = primaryText;
      text.style.cssText = `
        font-size: 16px;
        color: ${isDark ? '#e0e0e0' : '#1a1a1a'};
        line-height: 1.6;
        white-space: pre-wrap;
      `;
      cardElement.appendChild(text);
    };

    if (card.image) {
      // Image card
      const imageSrc = getCardImageSrc(card.image);

      if (imageSrc) {
        const img = document.createElement('img');
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
        console.warn('renderColumnView: unsupported image payload, rendering as text card', card.image);
        appendTextContent();
      }
    } else {
      appendTextContent();
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
      const { showContextMenu } = await import('../lib/canvas.js');
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
            const { showTouchBulkMenu } = await import('../lib/canvas.js');
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
    const imageSrc = getCardImageSrc(card.image);
    if (imageSrc) {
      imageHTML = `
        <div style="margin-bottom: 16px;">
          <img src="${imageSrc}" style="width: 100%; border-radius: 8px;" alt="Card image" />
        </div>
      `;
    }
  }

  const showColoredSwatches = useColoredCards();
  const paletteOptions = getColorOptionsForTheme({ colored: showColoredSwatches });
  const initialCustomColor = currentColor && currentColor.startsWith('#')
    ? currentColor
    : '#ffd400';

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

    <div style="margin-bottom: 16px; position: relative;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px;">Kortfärg:</label>
      <button id="column-color-toggle" style="display: inline-flex; align-items: center; gap: 8px; width: 100%;
        padding: 10px 12px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-primary);
        color: var(--text-primary); cursor: pointer;">
        <span id="column-color-preview" style="display: inline-block; width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid var(--border-color);"></span>
        <span id="column-color-label" style="flex: 1; text-align: left; font-weight: 500;">Välj färg</span>
        <span style="font-size: 14px; opacity: 0.7;">▾</span>
      </button>
      <div id="column-color-dropdown" style="display: none; position: absolute; top: 72px; left: 0; right: 0;
        background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 8px; padding: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 20;">
        <div id="column-color-picker" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 8px;"></div>
        <div id="column-recent-colors" style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color);">
          <div style="font-size: 13px; margin-bottom: 8px; font-weight: 600;">Senaste färger</div>
          <div id="column-recent-list" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center; justify-content: space-between;">
          <label for="column-custom-color" style="font-size: 13px; font-weight: 600;">Färgväljare</label>
          <input type="color" id="column-custom-color" value="${initialCustomColor}" style="flex: 1; min-width: 120px; height: 40px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); cursor: pointer;">
          <button id="column-apply-custom" style="padding: 10px 12px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer;">Använd</button>
        </div>
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
  const colorDropdown = editorContainer.querySelector('#column-color-dropdown');
  const colorToggle = editorContainer.querySelector('#column-color-toggle');
  const colorPreview = editorContainer.querySelector('#column-color-preview');
  const colorLabel = editorContainer.querySelector('#column-color-label');
  const recentList = editorContainer.querySelector('#column-recent-list');
  const customColorInput = editorContainer.querySelector('#column-custom-color');
  const applyCustomColorBtn = editorContainer.querySelector('#column-apply-custom');

  // Focus textarea
  textarea.focus();
  textarea.select();

  // Track selected color
  let selectedColor = currentColor;

  // Color picker logic with dropdown + recents
  let outsideClickHandler = null;
  const colorOptions = [
    { id: '', label: 'Ingen färg', swatch: 'var(--bg-primary)', border: '3px solid var(--border-color)' },
    ...paletteOptions.map(option => ({
      id: option.id,
      label: `${option.label} (${option.shortcut})`,
      swatch: option.swatch,
      shortcut: option.shortcut,
    })),
  ];

  const getColorMeta = (id) => {
    if (id && id.startsWith('#')) {
      return { id, label: 'Egen färg', swatch: id };
    }
    return colorOptions.find(c => c.id === id);
  };

  const addRecentColor = (color) => {
    if (!color) return; // hoppa över "ingen färg"
    const updated = addRecentCardColor(color);
    renderRecentColors(updated);
  };

  const setSelectedColor = (colorId) => {
    selectedColor = colorId;
    const meta = getColorMeta(colorId) || { label: 'Välj färg', swatch: 'transparent', border: '2px solid var(--border-color)' };
    if (colorPreview) {
      colorPreview.style.background = meta.swatch;
      colorPreview.style.border = meta.border || '2px solid var(--border-color)';
    }
    if (colorLabel) {
      colorLabel.textContent = meta.label;
    }

    const colorDots = colorPicker ? colorPicker.querySelectorAll('.color-dot') : [];
    colorDots.forEach(d => {
      if (d.dataset.color === colorId) {
        d.style.border = '3px solid #2196F3';
      } else if (d.dataset.color === 'card-color-8') {
        d.style.border = '3px solid #ddd';
      } else if (d.dataset.color === '') {
        d.style.border = '3px solid var(--border-color)';
      } else {
        d.style.border = '3px solid transparent';
      }
    });

    const recentDots = recentList ? recentList.querySelectorAll('.recent-color') : [];
    recentDots.forEach(d => {
      d.style.outline = d.dataset.color === colorId ? '3px solid #2196F3' : '2px solid var(--border-color)';
    });
  };

  const renderColorDots = () => {
    if (!colorPicker) return;
    colorPicker.innerHTML = '';

    colorOptions.forEach(option => {
      const dot = document.createElement('div');
      dot.className = 'color-dot';
      dot.dataset.color = option.id;
      dot.title = option.label;
      dot.style.cssText = `width: 32px; height: 32px; border-radius: 50%; background: ${option.swatch}; border: ${option.border || '3px solid transparent'}; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--text-primary);`;

      if (!showColoredSwatches && option.id) {
        dot.textContent = option.shortcut || option.label;
      } else if (option.id === '') {
        dot.textContent = '⭘';
      }

      dot.addEventListener('click', () => {
        const color = dot.dataset.color;
        setSelectedColor(color);
        addRecentColor(color);
        colorDropdown.style.display = 'none';
      });

      colorPicker.appendChild(dot);
    });
  };

  const renderRecentColors = (colors = loadRecentCardColors()) => {
    if (!recentList) return;
    recentList.innerHTML = '';
    if (!colors.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Ingen historik ännu';
      empty.style.fontSize = '12px';
      empty.style.opacity = '0.8';
      recentList.appendChild(empty);
      return;
    }

    colors.slice(0, 5).forEach(colorId => {
      const meta = getColorMeta(colorId) || { swatch: colorId, label: colorId };
      const dot = document.createElement('div');
      dot.className = 'recent-color';
      dot.dataset.color = colorId;
      dot.title = meta?.label || colorId;
      dot.style.cssText = `width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 2px solid var(--border-color); background: ${meta?.swatch || colorId}; display: flex; align-items: center; justify-content: center; color: var(--text-primary); font-weight: 600;`;
      if (!showColoredSwatches && colorId && !colorId.startsWith('#')) {
        dot.textContent = meta.shortcut || colorId;
      }
      dot.addEventListener('click', () => {
        setSelectedColor(colorId);
        addRecentColor(colorId);
        colorDropdown.style.display = 'none';
      });
      recentList.appendChild(dot);
    });
    setSelectedColor(selectedColor || '');
  };

  const toggleDropdown = () => {
    if (!colorDropdown) return;
    const isOpen = colorDropdown.style.display === 'block';
    colorDropdown.style.display = isOpen ? 'none' : 'block';
  };

  if (colorPicker && colorDropdown && colorToggle) {
    renderColorDots();

    colorToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    outsideClickHandler = (e) => {
      if (!colorDropdown.contains(e.target) && !colorToggle.contains(e.target)) {
        colorDropdown.style.display = 'none';
      }
    };

    document.addEventListener('click', outsideClickHandler);

    renderRecentColors();
    setSelectedColor(selectedColor || '');

    if (applyCustomColorBtn && customColorInput) {
      applyCustomColorBtn.addEventListener('click', () => {
        const chosenColor = customColorInput.value;
        if (!chosenColor) return;
        setSelectedColor(chosenColor);
        addRecentColor(chosenColor);
        colorDropdown.style.display = 'none';
      });
    }
  }

  const cleanupColorPicker = () => {
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler);
      outsideClickHandler = null;
    }
  };

  // Save function
  const saveEdit = async () => {
    const newText = textarea.value;
    const { updateCard } = await import('../lib/storage.js');

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
    cleanupColorPicker();
    editorContainer.remove();
    await renderColumnView(); // Refresh view
  };

  // Cancel function
  const cancelEdit = () => {
    cleanupColorPicker();
    editorContainer.remove();
  };

  // Delete function
  const deleteCard = async () => {
    if (confirm('Är du säker på att du vill ta bort detta kort?')) {
      const { deleteCard } = await import('../lib/storage.js');
      await deleteCard(card.id);
      cleanupColorPicker();
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
    const imageSrc = getCardImageSrc(card.image);
    if (imageSrc) {
      img.src = imageSrc;
      img.style.cssText = `
        width: 100%;
        border-radius: 8px;
        margin-bottom: 16px;
      `;
      dialog.appendChild(img);
    } else {
      console.warn('Edit dialog: missing valid image source for card', card.id);
    }
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
      const { deleteCard } = await import('../lib/storage.js');
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
    const { updateCard } = await import('../lib/storage.js');

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
