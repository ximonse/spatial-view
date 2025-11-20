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
      const { deleteCard } = await import('../lib/storage.js');
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
