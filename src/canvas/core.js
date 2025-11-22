/**
 * Canvas module using Konva.js
 *
 * FILE ORGANIZATION:
 * This file is organized into clear sections for easier navigation.
 * Use Ctrl+F to jump to section markers like "// === RENDERING ==="
 *
 * SECTIONS:
 * 1. Global State & Configuration
 * 2. Rendering (cards, colors)
 * 3. Card Creation & Editing (inline editor, bulk editor, touch menus)
 * 4. Card Operations (flip, delete)
 * 5. Canvas Management (reload, undo/redo)
 * 6. Clipboard (copy/paste/duplicate)
 * 7. Selection & Interaction (events, drag, pan, zoom)
 * 8. Public API (exports)
 * 9. UI Dialogs (command palette, quality dialog, etc)
 * 10. Search (boolean search with wildcards, proximity, etc)
 * 11. Context Menu & Card Actions (lock, pin)
 * 12. UI Buttons & Theme
 * 13. Arrangements & Keyboard Handlers
 *
 * NOTE: This file is large (3700+ lines) due to tight coupling with global state.
 * Future refactoring: Consider CanvasManager class or dependency injection.
 */

import Konva from 'konva';
import { marked } from 'marked';
import { getAllCards, updateCard, createCard, deleteCard, getCard } from './storage.js';
import { processImage } from '../utils/image-processing.js';
import { getCardImageSrc, normalizeCardImage } from '../utils/card-images.js';
import { readImageWithGemini, executeGeminiAgent, getGoogleAIAPIKey, executeChatGPTAgent } from './gemini.js';
import { getUpcomingCalendarEvents, getTodayCalendarEvents, getThisWeekCalendarEvents, formatEventsForAI } from './calendar-sync.js';
import {
  arrangeVertical,
  arrangeHorizontal,
  arrangeGrid,
  arrangeCluster,
  arrangeGridVertical,
  arrangeGridHorizontal,
  arrangeGridTopAligned
} from './arrangement.js';
import { addRecentCardColor } from '../utils/recent-card-colors.js';
import { getCardColorValue, getColorOptionsForTheme, useColoredCards } from '../utils/card-colors.js';
import { registerCommand, unregisterCommand, executeCommandFromEvent, getCommands, formatKeyBindings } from '../lib/command-registry.js';

// ============================================================================
// SECTION 1: GLOBAL STATE & CONFIGURATION
// ============================================================================

let stage = null;
let layer = null;
let isPanning = false;
let cardGroups = new Map(); // Map cardId -> Konva.Group

// Selection rectangle
let selectionRectangle = null;
let selectionStartPos = null;
let isSelecting = false;
let isAdditiveSelection = false; // Shift held during drag selection

// Undo/redo stacks
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STACK = 50;

// Track newly created cards to merge with first edit
let pendingCreateMerge = new Map(); // cardId -> create action

// Clipboard for copy/paste
let clipboard = [];
const registeredCanvasCommands = new Set();

// ============================================================================
// SECTION 2: RENDERING (Cards, Colors, Visual Elements)
// ============================================================================

// Backwards compatibility for legacy string values
const LEGACY_COLOR_MAP = {
  'yellow': 'card-color-1',
  'red': 'card-color-2',
  'green': 'card-color-3',
  'blue': 'card-color-4',
  'purple': 'card-color-5',
  'magenta': 'card-color-6',
  'pink': 'card-color-6',
  'orange': 'card-color-7',
  'gray': 'card-color-8',
  'grey': 'card-color-8',
};

/**
 * Get themed card color from cardColor property
 */
function getCardColor(cardColor) {
  const normalized = LEGACY_COLOR_MAP[cardColor] || cardColor;
  return getCardColorValue(normalized);
}

/**
 * Get color from text based on subject keywords
 * Matches both abbreviations and full names
 */
function getColorFromText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  // Subject patterns: [patterns to match] -> color
  const subjectColors = [
    { patterns: ['ma', 'matematik'], color: '#2196f3' },        // Matematik - blå
    { patterns: ['sv', 'svenska'], color: '#ffeb3b' },          // Svenska - gul
    { patterns: ['no', 'naturorientering'], color: '#4caf50' }, // NO - grön
    { patterns: ['eng', 'engelska'], color: '#f44336' },        // Engelska - röd
    { patterns: ['bi', 'bild'], color: '#9c27b0' },             // Bild - lila
    { patterns: ['tk', 'teknik'], color: '#9e9e9e' },           // Teknik - grå
    { patterns: ['spanska', 'språk'], color: '#ff9800' },       // Spanska/språk - orange
    { patterns: ['idh', 'idrott'], color: '#e91e63' },          // Idrott - rosa
    { patterns: ['so', 'samhällskunskap'], color: '#ef9a9a' },  // SO - ljusröd
    { patterns: ['sl', 'slöjd'], color: '#fff59d' },            // Slöjd - ljusgul
    { patterns: ['mu', 'musik'], color: '#a5d6a7' },            // Musik - ljusgrön
    { patterns: ['hkk'], color: '#a5d6a7' },                    // HKK - ljusgrön
    { patterns: ['lunch'], color: '#ffffff' }                   // Lunch - vit
  ];

  // Find first matching pattern
  for (const { patterns, color } of subjectColors) {
    for (const pattern of patterns) {
      // Match whole word or at word boundary
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(lowerText)) {
        return color;
      }
    }
  }

  return null; // No match found
}

/**
 * Initialize Konva canvas
 */
export async function initCanvas() {
  const container = document.getElementById('canvas-container');
  
  if (!container) {
    console.error('Canvas container not found');
    return;
  }
  
  // Create stage
  stage = new Konva.Stage({
    container: 'canvas-container',
    width: container.clientWidth,
    height: container.clientHeight,
    draggable: false
  });
  
  // Create main layer
  layer = new Konva.Layer();
  stage.add(layer);

  // Create selection rectangle (hidden by default)
  selectionRectangle = new Konva.Rect({
    fill: 'rgba(33, 150, 243, 0.1)',
    stroke: '#2196F3',
    strokeWidth: 1,
    visible: false
  });
  layer.add(selectionRectangle);

  // Load cards from storage
  await loadCards();

  // Setup event listeners
  setupCanvasEvents();

  // Setup image drag-and-drop
  setupImageDragDrop();

  // Create floating buttons
  createFitAllButton();
  createCommandPaletteButton();
  createAddButton();

  registerCanvasCommands();
  setupKeyboardShortcuts();

  console.log('Konva canvas initialized');
}

/**
 * Load cards from storage and render
 */
async function loadCards() {
  const cards = await getAllCards();
  
  for (const card of cards) {
    renderCard(card);
  }
  
  layer.batchDraw();
}

/**
 * Render a single card on canvas
 */
function renderCard(cardData) {
  const group = new Konva.Group({
    x: cardData.position?.x || 100,
    y: cardData.position?.y || 100,
    draggable: true
  });

  const normalizedImage = normalizeCardImage(cardData.image);

  if (normalizedImage?.src) {
    // Image card
    renderImageCard(group, { ...cardData, image: normalizedImage });
  } else {
    if (cardData.image) {
      console.warn('renderCard: unexpected image format, falling back to text card', cardData.image);
    }
    // Text card
    renderTextCard(group, cardData);
  }

  // Store card ID on group
  group.setAttr('cardId', cardData.id);

  // Set locked state
  if (cardData.locked) {
    group.draggable(false);
    group.setAttr('locked', true);
  }

  // Click to select (for deletion)
  group.on('click', function() {
    const isSelected = this.hasName('selected');
    const background = this.findOne('Rect');
    const isEink = document.body.classList.contains('eink-theme');
    const isDark = document.body.classList.contains('dark-theme');

    if (isSelected) {
      this.removeName('selected');
      if (background) {
        if (isEink) {
          background.stroke('#000000');
          background.strokeWidth(1);
        } else if (isDark) {
          background.stroke('#4a5568');
          background.strokeWidth(1);
        } else {
          background.stroke('#e0e0e0');
          background.strokeWidth(1);
        }
      }
    } else {
      this.addName('selected');
      if (background) {
        if (isEink) {
          background.stroke('#000000');
          background.strokeWidth(3);
        } else {
          background.stroke('#2196F3');
          background.strokeWidth(3);
        }
      }
    }

    layer.batchDraw();
  });

  // Right-click context menu
  group.on('contextmenu', function(e) {
    e.evt.preventDefault();
    showContextMenu(e.evt.clientX, e.evt.clientY, cardData.id, this);
  });

  // Touch handlers
  let touchTimer = null;
  let touchStartPos = null;
  let hasMoved = false;

  group.on('touchstart', function(e) {
    const pos = this.position();
    touchStartPos = { x: pos.x, y: pos.y };
    hasMoved = false;

    // Long press timer
    touchTimer = setTimeout(async () => {
      if (!hasMoved) {
        // Long press detected
        const selectedGroups = layer.find('.selected');

        if (selectedGroups.length > 1 && this.hasName('selected')) {
          // Multiple cards selected: show bulk menu
          await showTouchBulkMenu(e.evt.clientX || e.evt.touches[0].clientX,
                                  e.evt.clientY || e.evt.touches[0].clientY);
        } else {
          // Single card: open editor
          if (cardData.image) {
            // For image cards, open edit dialog (works for both front and flipped)
            openEditDialog(cardData.id);
          } else {
            // For text cards, open inline editor
            createInlineEditor(cardData.id, this, cardData.text || '', false);
          }
        }
        touchTimer = null;
      }
    }, 600); // 600ms long press
  });

  group.on('touchmove', function() {
    const currentPos = this.position();
    const moved = Math.abs(currentPos.x - touchStartPos.x) > 3 ||
                  Math.abs(currentPos.y - touchStartPos.y) > 3;
    if (moved) {
      hasMoved = true;
    }
  });

  group.on('touchend', function() {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;

      // If touch ended before long press timer and card hasn't moved much, treat as tap to select
      if (!hasMoved) {
        const isSelected = this.hasName('selected');
        const background = this.findOne('Rect');
        const isEink = document.body.classList.contains('eink-theme');
        const isDark = document.body.classList.contains('dark-theme');

        if (isSelected) {
          this.removeName('selected');
          if (background) {
            if (isEink) {
              background.stroke('#000000');
              background.strokeWidth(1);
            } else if (isDark) {
              background.stroke('#4a5568');
              background.strokeWidth(1);
            } else {
              background.stroke('#e0e0e0');
              background.strokeWidth(1);
            }
          }
        } else {
          this.addName('selected');
          if (background) {
            if (isEink) {
              background.stroke('#000000');
              background.strokeWidth(3);
            } else {
              background.stroke('#2196F3');
              background.strokeWidth(3);
            }
          }
        }

        layer.batchDraw();
      }
    }
  });

  group.on('touchcancel', function() {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  });

  group.on('dragstart', function() {
    hasMoved = true;
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  });

  // Group drag - move all selected cards together
  let dragStartPositions = null;

  group.on('dragstart', function() {
    const isSelected = this.hasName('selected');

    if (isSelected) {
      // Save positions of all selected cards
      dragStartPositions = new Map();
      const selectedNodes = layer.find('.selected');

      selectedNodes.forEach(node => {
        if (node !== this && node.getAttr('cardId')) {
          dragStartPositions.set(node, {
            x: node.x(),
            y: node.y()
          });
        }
      });
    }
  });

  group.on('dragmove', function() {
    if (dragStartPositions && dragStartPositions.size > 0) {
      // Calculate delta from this card's movement
      const currentPos = this.position();
      const startPos = { x: this.getAttr('startX'), y: this.getAttr('startY') };

      // Store start position on first move
      if (startPos.x === undefined) {
        this.setAttr('startX', currentPos.x);
        this.setAttr('startY', currentPos.y);
        return;
      }

      const delta = {
        x: currentPos.x - startPos.x,
        y: currentPos.y - startPos.y
      };

      // Move all other selected cards by the same delta
      dragStartPositions.forEach((originalPos, node) => {
        node.position({
          x: originalPos.x + delta.x,
          y: originalPos.y + delta.y
        });
      });

      layer.batchDraw();
    }
  });

  group.on('dragend', async function() {
    if (dragStartPositions && dragStartPositions.size > 0) {
      // Update all moved cards in database and add to undo stack
      for (const [node, originalPos] of dragStartPositions) {
        const cardId = node.getAttr('cardId');
        if (cardId) {
          const newPosition = { x: node.x(), y: node.y() };

          // Add to undo stack
          pushUndo({
            type: 'update',
            cardId: cardId,
            oldData: { position: originalPos },
            newData: { position: newPosition }
          });

          await updateCard(cardId, { position: newPosition });
        }
      }

      dragStartPositions = null;
    }

    // Clear start position attributes
    this.setAttr('startX', undefined);
    this.setAttr('startY', undefined);
  });

  layer.add(group);
  cardGroups.set(cardData.id, group);
}

/**
 * Render text card
 */
function renderTextCard(group, cardData) {
  // Get card color
  const cardColor = getCardColor(cardData.cardColor);

  // Check themes
  const isEink = document.body.classList.contains('eink-theme');
  const isDark = document.body.classList.contains('dark-theme');

  // E-ink: always white, Dark: unified neutral tone
  let fillColor = cardColor;
  if (isEink) {
    fillColor = '#ffffff';
  } else if (isDark) {
    fillColor = '#2d3748';
  }

  // Text (render first to calculate height)
  const text = new Konva.Text({
    text: cardData.text || '',
    x: 16,
    y: 16,
    width: 168,
    fontSize: 14,
    fontFamily: 'sans-serif',
    fill: isDark ? '#e0e0e0' : '#1a1a1a',
    wrap: 'word',
    ellipsis: false
  });

  // Comments (if exist) - shown in italic below main text
  let commentsText = null;
  let totalContentHeight = text.height();

  if (cardData.comments) {
    commentsText = new Konva.Text({
      text: cardData.comments,
      x: 16,
      y: 16 + text.height() + 8, // 8px gap after main text
      width: 168,
      fontSize: 12,
      fontFamily: 'sans-serif',
      fontStyle: 'italic',
      fill: isDark ? '#a0a0a0' : '#666666',
      wrap: 'word',
      ellipsis: false
    });
    totalContentHeight = text.height() + 8 + commentsText.height();
  }

  // Calculate card height based on content
  const cardHeight = Math.max(150, totalContentHeight + 32); // 16px top + 16px bottom padding

  // Background
  const background = new Konva.Rect({
    width: 200,
    height: cardHeight,
    fill: fillColor,
    stroke: isEink ? '#000000' : (isDark ? '#4a5568' : '#e0e0e0'),
    strokeWidth: 1,
    cornerRadius: 4,
    shadowColor: isEink ? 'transparent' : 'black',
    shadowBlur: isEink ? 0 : 10,
    shadowOpacity: isEink ? 0 : 0.1,
    shadowOffset: { x: 0, y: isEink ? 0 : 2 }
  });

  group.add(background);
  group.add(text);

  if (commentsText) {
    group.add(commentsText);
  }
}

/**
 * Render image card
 */
function renderImageCard(group, cardData) {
  const imageObj = new Image();
  const imageData = normalizeCardImage(cardData.image);
  const isFlipped = cardData.flipped || false;

  if (!imageData?.src) {
    console.warn('renderImageCard: missing usable image source, rendering as text card instead');
    renderTextCard(group, cardData);
    return;
  }

  console.log('DEBUG: renderImageCard - cardData.image:', imageData);

  imageObj.onload = function() {
    console.log('DEBUG: renderImageCard - imageObj loaded. naturalWidth:', imageObj.naturalWidth, 'naturalHeight:', imageObj.naturalHeight);
    console.log('DEBUG: renderImageCard - image src (truncated):', imageData.src ? imageData.src.substring(0, 100) + '...' : 'N/A');

    // Check themes
    const isEink = document.body.classList.contains('eink-theme');
    const isDark = document.body.classList.contains('dark-theme');

    // Calculate card display dimensions (maintain aspect ratio)
    // Standard display size: 200px for aligned columns
    const displayMaxWidth = 200;
    const displayMaxHeight = 300;

    let naturalWidth = imageObj.naturalWidth;
    let naturalHeight = imageObj.naturalHeight;

    // If natural dimensions are 0, use stored dimensions if available, or fallback
    if (naturalWidth === 0 || naturalHeight === 0) {
        console.warn('WARNING: Image natural dimensions are 0. Falling back to stored dimensions or default.');
        naturalWidth = imageData.width || 200;
        naturalHeight = imageData.height || 150;
    }

    // Calculate display size (scaled down for card)
    let displayWidth = naturalWidth;
    let displayHeight = naturalHeight;

    if (displayWidth > displayMaxWidth || displayHeight > displayMaxHeight) {
      const ratio = Math.min(displayMaxWidth / displayWidth, displayMaxHeight / displayHeight);
      displayWidth = displayWidth * ratio;
      displayHeight = displayHeight * ratio;
    }

    // Use display dimensions for card, but keep original image for sharp rendering
    const width = displayWidth;
    const height = displayHeight;

    console.log('DEBUG: renderImageCard - Final calculated width:', width, 'height:', height);

    // Store dimensions on group for flip
    group.setAttr('cardWidth', width);
    group.setAttr('cardHeight', height);

    if (isFlipped) {
      // Show back side (read-only view with all text)
      let currentY = 16;

      // Main text (backText)
      const mainText = new Konva.Text({
        text: cardData.backText || 'Dubbelklicka för att redigera...',
        x: 16,
        y: currentY,
        width: width - 32,
        fontSize: 16,
        fontFamily: 'sans-serif',
        fill: isDark ? '#e0e0e0' : '#1a1a1a',
        wrap: 'word',
        align: 'left'
      });
      currentY += mainText.height();

      // Tags (if any)
      let tagsText = null;
      if (cardData.tags && cardData.tags.length > 0) {
        currentY += 12; // Gap before tags
        tagsText = new Konva.Text({
          text: cardData.tags.map(tag => '#' + tag).join(' '),
          x: 16,
          y: currentY,
          width: width - 32,
          fontSize: 12,
          fontFamily: 'sans-serif',
          fill: isDark ? '#80b3ff' : '#0066cc',
          wrap: 'word'
        });
        currentY += tagsText.height();
      }

      // Comments (if any)
      let commentsText = null;
      if (cardData.comments) {
        currentY += 8; // Gap before comments
        commentsText = new Konva.Text({
          text: cardData.comments,
          x: 16,
          y: currentY,
          width: width - 32,
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontStyle: 'italic',
          fill: isDark ? '#a0a0a0' : '#666666',
          wrap: 'word'
        });
        currentY += commentsText.height();
      }

      // Calculate total height
      const totalHeight = currentY + 16; // Add bottom padding

      const background = new Konva.Rect({
        width: width,
        height: Math.max(height, totalHeight),
        fill: isEink ? '#ffffff' : (isDark ? '#2d3748' : '#fffacd'),
        stroke: isEink ? '#000000' : (isDark ? '#4a5568' : '#e0e0e0'),
        strokeWidth: 1,
        cornerRadius: 4,
        shadowColor: isEink ? 'transparent' : 'black',
        shadowBlur: isEink ? 0 : 10,
        shadowOpacity: isEink ? 0 : 0.1,
        shadowOffset: { x: 0, y: isEink ? 0 : 2 }
      });

      group.add(background);
      group.add(mainText);
      if (tagsText) group.add(tagsText);
      if (commentsText) group.add(commentsText);
    } else {
      // Show front side (image)

      // Check if we have comments to display
      let commentsText = null;
      let totalHeight = height;

      if (cardData.comments) {
        // Create comments text (will be positioned below image)
        commentsText = new Konva.Text({
          text: cardData.comments,
          x: 8,
          y: height + 8, // 8px gap after image
          width: width - 16,
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontStyle: 'italic',
          fill: isDark ? '#a0a0a0' : '#666666',
          wrap: 'word',
          ellipsis: false
        });

        // Update total height to include comments
        totalHeight = height + 8 + commentsText.height() + 8; // image + gap + comments + bottom padding
      }

      const background = new Konva.Rect({
        width: width,
        height: totalHeight,
        fill: '#ffffff',
        stroke: isEink ? '#000000' : (isDark ? '#4a5568' : '#e0e0e0'),
        strokeWidth: 1,
        cornerRadius: 4,
        shadowColor: isEink ? 'transparent' : 'black',
        shadowBlur: isEink ? 0 : 10,
        shadowOpacity: isEink ? 0 : 0.1,
        shadowOffset: { x: 0, y: isEink ? 0 : 2 }
      });

      // Calculate scale to fit display dimensions while preserving image quality
      const scaleX = width / naturalWidth;
      const scaleY = height / naturalHeight;

      const konvaImage = new Konva.Image({
        image: imageObj,
        scaleX: scaleX,
        scaleY: scaleY,
        cornerRadius: 8
      });

      group.add(background);
      group.add(konvaImage);

      if (commentsText) {
        group.add(commentsText);
      }

      // Tooltip on hover (show filename)
      group.on('mouseenter', function() {
        document.body.style.cursor = 'pointer';

        // Show tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'card-tooltip';
        tooltip.style.cssText = `
          position: fixed;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
          z-index: 10001;
          pointer-events: none;
          font-family: sans-serif;
        `;
        tooltip.textContent = cardData.text || 'Bild';
        document.body.appendChild(tooltip);

        // Update tooltip position on mouse move
        const updateTooltip = (e) => {
          tooltip.style.left = (e.clientX + 10) + 'px';
          tooltip.style.top = (e.clientY + 10) + 'px';
        };

        stage.on('mousemove', updateTooltip);
        group.setAttr('tooltipHandler', updateTooltip);
      });

      group.on('mouseleave', function() {
        document.body.style.cursor = 'default';

        // Remove tooltip
        const tooltip = document.getElementById('card-tooltip');
        if (tooltip) {
          document.body.removeChild(tooltip);
        }

        // Remove mousemove handler
        const handler = group.getAttr('tooltipHandler');
        if (handler) {
          stage.off('mousemove', handler);
        }
      });
    }

    layer.batchDraw();
  };

  imageObj.onerror = function() {
      console.error('ERROR: renderImageCard - Failed to load image from source. imageData:', imageData);
  };

  imageObj.src = imageData.src;
}

// ============================================================================
// SECTION 3: CARD CREATION & EDITING (Dialogs, Inline Editor, Touch Menus)
// ============================================================================

/**
 * Create new card
 */
async function createNewCard(position) {
  // Create empty card first
  const cardData = {
    text: '',
    tags: [],
    position
  };

  const cardId = await createCard(cardData);

  // Mark this card for merge with first edit
  const createAction = {
    type: 'create',
    cardId,
    card: cardData
  };
  pendingCreateMerge.set(cardId, createAction);

  // Reload canvas to show new card
  await reloadCanvas();

  // Open editor on the new card
  const group = cardGroups.get(cardId);
  if (group) {
    await createInlineEditor(cardId, group, '', false);
  }
}

/**
 * Inline text editor using HTML textarea overlay
 */
async function createInlineEditor(cardId, group, currentText, isImageBack = false) {
  // Get card data
  const cards = await getAllCards();
  const card = cards.find(c => c.id === cardId);
  if (!card) return;

  const currentTags = card.tags || [];
  const currentColor = card.cardColor || '';
  const currentComments = card.comments || '';

  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 24px;
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;

  const showColoredSwatches = useColoredCards();
  const paletteOptions = getColorOptionsForTheme({ colored: showColoredSwatches });

  const colorDotsHTML = paletteOptions.map(option => {
    const border = option.id === 'card-color-8' ? '3px solid #ddd' : '3px solid transparent';
    const swatch = option.swatch || 'var(--bg-secondary)';
    return `
        <div class="color-dot" data-color="${option.id}" style="width: 36px; height: 36px; border-radius: 50%;
             background: ${swatch}; border: ${border}; cursor: pointer;" title="${option.label}"></div>`;
  }).join('\n');

  dialog.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 600;">
      ${isImageBack ? 'Redigera baksida' : 'Redigera kort'}
    </h3>

    ${card.image ? `
    <div style="margin-bottom: 20px; text-align: center;">
      <img src="${getCardImageSrc(card.image) || ''}"
           style="max-width: 100%; max-height: 300px; border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.15);"
           alt="Kortbild">
    </div>
    ` : ''}

    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Text:</label>
      <textarea id="editCardText"
        style="width: 100%; height: 200px; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; resize: vertical; box-sizing: border-box;"
      >${currentText || ''}</textarea>
    </div>

    ${!isImageBack ? `
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Tags (kommaseparerade):</label>
      <input type="text" id="editCardTags"  value="${currentTags.join(', ')}"
        style="width: 100%; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; box-sizing: border-box;">
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Kommentar (visas i kursiv):</label>
      <textarea id="editCardComments"
        style="width: 100%; height: 80px; padding: 12px; font-size: 12px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; font-style: italic; resize: vertical; box-sizing: border-box;"
      >${currentComments}</textarea>
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Kortfärg:</label>
      <div id="editColorPicker" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
        <div class="color-dot" data-color="" style="width: 36px; height: 36px; border-radius: 50%;
             background: var(--bg-secondary); border: 3px solid var(--border-color); cursor: pointer;
             display: flex; align-items: center; justify-content: center; font-size: 20px;"
             title="Ingen färg">⭘</div>
        ${colorDotsHTML}
      </div>
      <div id="customColorContainer" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px;">Valfri färg:</span>
        <input type="color" id="customColorInput" style="width: 42px; height: 32px; padding: 0; border: 2px solid var(--border-color); border-radius: 6px; background: transparent;">
        <input type="text" id="customColorHex" placeholder="#rrggbb" style="flex: 1; padding: 8px; font-size: 14px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
        <button id="applyCustomColor" style="padding: 8px 12px; font-size: 14px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer;">Använd</button>
      </div>
    </div>
    ` : ''}

    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
      <button id="cancelEdit" style="padding: 12px 24px; background: var(--bg-secondary);
                                     color: var(--text-primary); border: 2px solid var(--border-color);
                                     border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer;">
        Avbryt
      </button>
      ${card.image ? `
      <button id="readWithAI" style="padding: 12px 24px; background: #8B5CF6;
                                     color: white; border: none; border-radius: 8px;
                                     font-size: 16px; font-weight: 600; cursor: pointer;">
        ✨ Läs med AI
      </button>
      ` : ''}
      <button id="saveEdit" style="padding: 12px 24px; background: var(--accent-color);
                                    color: white; border: none; border-radius: 8px;
                                    font-size: 16px; font-weight: 600; cursor: pointer;">
        ${isImageBack ? 'Spara & Vänd tillbaka' : 'Spara'}
      </button>
    </div>

    <div style="margin-top: 16px; font-size: 13px; color: var(--text-secondary); text-align: center;">
      Tips: Ctrl+Enter = Spara, Esc = Avbryt
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Get elements
  const textarea = document.getElementById('editCardText');
  const tagsInput = document.getElementById('editCardTags');
  const saveBtn = document.getElementById('saveEdit');
  const cancelBtn = document.getElementById('cancelEdit');

  // Focus textarea
  textarea.focus();
  textarea.select();

  // Handle color selection (only for regular cards)
  let selectedColor = currentColor;
  if (!isImageBack) {
    const colorDots = document.querySelectorAll('#editColorPicker .color-dot');
    const customColorInput = document.getElementById('customColorInput');
    const customColorHexInput = document.getElementById('customColorHex');
    const applyCustomColorBtn = document.getElementById('applyCustomColor');
    const customColorContainer = document.getElementById('customColorContainer');

    const setDotBorders = () => {
      colorDots.forEach(d => {
        if (d.dataset.color === '') {
          d.style.border = '3px solid var(--border-color)';
        } else if (d.dataset.color === 'card-color-8') {
          d.style.border = '3px solid #ddd';
        } else {
          d.style.border = '3px solid transparent';
        }
      });
    };

    const highlightCustom = () => {
      customColorContainer.style.outline = '3px solid var(--accent-color)';
      customColorContainer.style.borderRadius = '8px';
    };

    const clearCustomHighlight = () => {
      customColorContainer.style.outline = 'none';
    };

    const setSelectedColor = (color) => {
      selectedColor = color;
      if (color && color.startsWith('#')) {
        highlightCustom();
        setDotBorders();
      } else {
        clearCustomHighlight();
      }
    };

    // Prefill custom color inputs based on current color (supports imported colors)
    const initialCustomColor = currentColor ? getCardColor(currentColor) : '#ffffff';
    if (customColorInput) customColorInput.value = initialCustomColor;
    if (customColorHexInput) customColorHexInput.value = initialCustomColor;

    // Highlight current color
    let currentMatched = false;
    colorDots.forEach(dot => {
      if (dot.dataset.color === currentColor || (!currentColor && dot.dataset.color === '')) {
        dot.style.border = '3px solid var(--accent-color)';
        currentMatched = true;
      }

      dot.addEventListener('click', function() {
        clearCustomHighlight();
        setDotBorders();
        this.style.border = '3px solid var(--accent-color)';
        selectedColor = this.dataset.color;
      });
    });

    if (!currentMatched && currentColor && currentColor.startsWith('#')) {
      highlightCustom();
    }

    const isValidHex = (value) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value);

    const applyCustomColor = () => {
      const hexInput = (customColorHexInput ? customColorHexInput.value.trim() : '') || (customColorInput ? customColorInput.value.trim() : '');
      if (!isValidHex(hexInput)) {
        alert('Ange en giltig hexkod, t.ex. #ff8800');
        return;
      }

      if (customColorInput) customColorInput.value = hexInput;
      if (customColorHexInput) customColorHexInput.value = hexInput;
      setDotBorders();
      highlightCustom();
      setSelectedColor(hexInput.toLowerCase());
    };

    if (applyCustomColorBtn) {
      applyCustomColorBtn.addEventListener('click', applyCustomColor);
    }

    if (customColorInput) {
      customColorInput.addEventListener('input', () => {
        if (customColorHexInput) customColorHexInput.value = customColorInput.value;
      });
    }

    if (customColorHexInput) {
      customColorHexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          applyCustomColor();
        }
      });
    }
  }

  const cleanup = () => {
    if (overlay.parentNode) {
      document.body.removeChild(overlay);
    }
    document.removeEventListener('keydown', escHandler);
  };

  // Save handler
  const save = async () => {
    const newText = textarea.value;

    if (isImageBack) {
      // Save back text and flip card
      pushUndo({
        type: 'update',
        cardId,
        oldData: { backText: currentText },
        newData: { backText: newText }
      });

      await updateCard(cardId, { backText: newText });
      await flipCard(cardId);
    } else {
      // Save regular card
      const newTags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t) : currentTags;
      const commentsTextarea = document.getElementById('editCardComments');
      const newComments = commentsTextarea ? commentsTextarea.value : currentComments;

      const updates = {
        text: newText,
        tags: newTags,
        comments: newComments
      };

      // Add color if changed
      if (selectedColor !== currentColor) {
        updates.cardColor = selectedColor;
      }

      // Check if this is first edit after create - merge them
      if (pendingCreateMerge.has(cardId)) {
        const createAction = pendingCreateMerge.get(cardId);
        // Update the create action's card data with the new values
        createAction.card = { ...createAction.card, ...updates };
        pushUndo(createAction);
        pendingCreateMerge.delete(cardId);
      } else {
        // Normal update
        pushUndo({
          type: 'update',
          cardId,
          oldData: { text: currentText, tags: currentTags, cardColor: currentColor, comments: currentComments },
          newData: updates
        });
      }

      await updateCard(cardId, updates);
      await reloadCanvas();
    }

    cleanup();
  };

  // Event listeners
  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cleanup);

  // AI read button (only for image cards)
  const readWithAIBtn = document.getElementById('readWithAI');
  if (readWithAIBtn) {
    readWithAIBtn.addEventListener('click', async () => {
      cleanup();
      await readImageWithGemini(cardId);
    });
  }

  // Keyboard shortcuts
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  document.addEventListener('keydown', escHandler);

  textarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });
}

/**
 * Bulk editor for multiple selected cards
 */
async function createBulkEditor(cardIds) {
  const cards = await getAllCards();
  const selectedCards = cards.filter(c => cardIds.includes(c.id));

  if (selectedCards.length === 0) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 24px;
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;

  dialog.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 600;">
      Redigera ${selectedCards.length} kort
    </h3>

    <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
      <p style="margin: 0; font-size: 14px;">
        Ändringar appliceras på alla ${selectedCards.length} markerade kort.
        Lämna fält tomma för att inte ändra dem.
      </p>
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">
        Lägg till tags (kommaseparerade, läggs till befintliga):
      </label>
      <input type="text" id="bulkAddTags"
        placeholder="t.ex. urgent, projekt"
        style="width: 100%; padding: 12px; font-size: 16px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               box-sizing: border-box;">
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 8px; font-weight: 500;">Kortfärg:</label>
      <div id="bulkColorPicker" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
        <div class="color-dot" data-color="none" style="width: 36px; height: 36px; border-radius: 50%;
             background: var(--bg-secondary); border: 3px solid var(--accent-color); cursor: pointer;
             display: flex; align-items: center; justify-content: center; font-size: 20px;"
             title="Ändra inte färg">×</div>
        <div class="color-dot" data-color="" style="width: 36px; height: 36px; border-radius: 50%;
             background: var(--bg-secondary); border: 3px solid var(--border-color); cursor: pointer;
             display: flex; align-items: center; justify-content: center; font-size: 20px;"
             title="Ingen färg">⭘</div>
        <div class="color-dot" data-color="card-color-1" style="width: 36px; height: 36px; border-radius: 50%;
             background: #d4f2d4; border: 3px solid transparent; cursor: pointer;" title="Grön"></div>
        <div class="color-dot" data-color="card-color-2" style="width: 36px; height: 36px; border-radius: 50%;
             background: #ffe4b3; border: 3px solid transparent; cursor: pointer;" title="Orange"></div>
        <div class="color-dot" data-color="card-color-3" style="width: 36px; height: 36px; border-radius: 50%;
             background: #ffc1cc; border: 3px solid transparent; cursor: pointer;" title="Röd"></div>
        <div class="color-dot" data-color="card-color-4" style="width: 36px; height: 36px; border-radius: 50%;
             background: #fff7b3; border: 3px solid transparent; cursor: pointer;" title="Gul"></div>
        <div class="color-dot" data-color="card-color-5" style="width: 36px; height: 36px; border-radius: 50%;
             background: #f3e5f5; border: 3px solid transparent; cursor: pointer;" title="Lila"></div>
        <div class="color-dot" data-color="card-color-6" style="width: 36px; height: 36px; border-radius: 50%;
             background: #c7e7ff; border: 3px solid transparent; cursor: pointer;" title="Blå"></div>
        <div class="color-dot" data-color="card-color-7" style="width: 36px; height: 36px; border-radius: 50%;
             background: #e0e0e0; border: 3px solid transparent; cursor: pointer;" title="Grå"></div>
        <div class="color-dot" data-color="card-color-8" style="width: 36px; height: 36px; border-radius: 50%;
             background: #ffffff; border: 3px solid #ddd; cursor: pointer;" title="Vit"></div>
      </div>
      <div id="bulkCustomColorContainer" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px;">Valfri färg:</span>
        <input type="color" id="bulkCustomColorInput" style="width: 42px; height: 32px; padding: 0; border: 2px solid var(--border-color); border-radius: 6px; background: transparent;">
        <input type="text" id="bulkCustomColorHex" placeholder="#rrggbb" style="flex: 1; padding: 8px; font-size: 14px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
        <button id="bulkApplyCustomColor" style="padding: 8px 12px; font-size: 14px; border: 2px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer;">Använd</button>
      </div>
    </div>

    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
      <button id="bulkCancel" style="padding: 12px 24px; background: var(--bg-secondary);
                                     color: var(--text-primary); border: 2px solid var(--border-color);
                                     border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer;">
        Avbryt
      </button>
      <button id="bulkSave" style="padding: 12px 24px; background: var(--accent-color);
                                    color: white; border: none; border-radius: 8px;
                                    font-size: 16px; font-weight: 600; cursor: pointer;">
        Uppdatera alla
      </button>
    </div>

    <div style="margin-top: 16px; font-size: 13px; color: var(--text-secondary); text-align: center;">
      Tips: Ctrl+Enter = Spara, Esc = Avbryt
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Get elements
  const tagsInput = document.getElementById('bulkAddTags');
  const saveBtn = document.getElementById('bulkSave');
  const cancelBtn = document.getElementById('bulkCancel');

  // Handle color selection
  let selectedColor = 'none'; // Default: don't change
  const colorDots = document.querySelectorAll('#bulkColorPicker .color-dot');
  const bulkCustomColorInput = document.getElementById('bulkCustomColorInput');
  const bulkCustomColorHex = document.getElementById('bulkCustomColorHex');
  const bulkApplyCustomColor = document.getElementById('bulkApplyCustomColor');
  const bulkCustomColorContainer = document.getElementById('bulkCustomColorContainer');

  const resetBulkDotBorders = () => {
    colorDots.forEach(d => {
      if (d.dataset.color === 'none') {
        d.style.border = '3px solid transparent';
      } else if (d.dataset.color === '') {
        d.style.border = '3px solid var(--border-color)';
      } else if (d.dataset.color === 'card-color-8') {
        d.style.border = '3px solid #ddd';
      } else {
        d.style.border = '3px solid transparent';
      }
    });
  };

  const highlightBulkCustom = () => {
    bulkCustomColorContainer.style.outline = '3px solid var(--accent-color)';
    bulkCustomColorContainer.style.borderRadius = '8px';
  };

  const clearBulkCustomHighlight = () => {
    bulkCustomColorContainer.style.outline = 'none';
  };

  const isValidHex = (value) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value);

  const applyBulkCustomColor = () => {
    const hexInput = (bulkCustomColorHex ? bulkCustomColorHex.value.trim() : '') || (bulkCustomColorInput ? bulkCustomColorInput.value.trim() : '');
    if (!isValidHex(hexInput)) {
      alert('Ange en giltig hexkod, t.ex. #00cc99');
      return;
    }

    if (bulkCustomColorInput) bulkCustomColorInput.value = hexInput;
    if (bulkCustomColorHex) bulkCustomColorHex.value = hexInput;
    resetBulkDotBorders();
    highlightBulkCustom();
    selectedColor = hexInput.toLowerCase();
  };

  colorDots.forEach(dot => {
    dot.addEventListener('click', function() {
      clearBulkCustomHighlight();
      resetBulkDotBorders();

      // Select this one
      this.style.border = '3px solid var(--accent-color)';
      selectedColor = this.dataset.color;
    });
  });

  if (bulkApplyCustomColor) {
    bulkApplyCustomColor.addEventListener('click', applyBulkCustomColor);
  }

  if (bulkCustomColorInput) {
    bulkCustomColorInput.addEventListener('input', () => {
      if (bulkCustomColorHex) bulkCustomColorHex.value = bulkCustomColorInput.value;
    });
  }

  if (bulkCustomColorHex) {
    bulkCustomColorHex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyBulkCustomColor();
      }
    });
  }

  const cleanup = () => {
    if (overlay.parentNode) {
      document.body.removeChild(overlay);
    }
    document.removeEventListener('keydown', escHandler);
  };

  // Save handler
  const save = async () => {
    const addTags = tagsInput.value ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t) : [];

    // Build updates
    for (const card of selectedCards) {
      const updates = {};

      // Add tags (merge with existing)
      if (addTags.length > 0) {
        const existingTags = card.tags || [];
        const newTags = [...new Set([...existingTags, ...addTags])]; // Remove duplicates
        updates.tags = newTags;
      }

      // Update color (only if not 'none')
      if (selectedColor !== 'none') {
        updates.cardColor = selectedColor;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await updateCard(card.id, updates);
      }
    }

    await reloadCanvas();
    cleanup();

    console.log(`Bulk updated ${selectedCards.length} cards`);
  };

  // Event listeners
  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cleanup);

  // Keyboard shortcuts
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  document.addEventListener('keydown', escHandler);

  tagsInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });

  // Focus tags input
  tagsInput.focus();
}

/**
 * Show touch paste menu (for long-press on empty canvas)
 */
async function showTouchPasteMenu(x, y, position) {
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 200px;
  `;

  menu.innerHTML = `
    <div id="touchMenuPasteImage" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px;">
      📷 Klistra in bild
    </div>
    <div id="touchMenuNewCard" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px;">
      📝 Nytt kort
    </div>
    <div id="touchMenuCancel" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px; color: var(--text-secondary);">
      ✕ Avbryt
    </div>
  `;

  document.body.appendChild(menu);

  // Add hover effects
  const items = menu.querySelectorAll('div[id^="touchMenu"]');
  items.forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--bg-secondary)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
  });

  const cleanup = () => {
    if (menu.parentNode) {
      document.body.removeChild(menu);
    }
  };

  // Paste image handler - try clipboard first, fallback to file picker
  document.getElementById('touchMenuPasteImage').addEventListener('click', async () => {
    cleanup();

    // Try to paste from clipboard first
    if (navigator.clipboard && navigator.clipboard.read) {
      try {
        await pasteImageFromClipboard();
        return;
      } catch (error) {
        console.log('Clipboard paste failed, falling back to file picker:', error);
      }
    }

    // Fallback to file picker
    await importImage(position);
  });

  // New card handler
  document.getElementById('touchMenuNewCard').addEventListener('click', async () => {
    cleanup();
    await createNewCard(position);
  });

  // Cancel handler
  document.getElementById('touchMenuCancel').addEventListener('click', () => {
    cleanup();
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', cleanup, { once: true });
  }, 100);
}

/**
 * Show touch bulk menu (for long-press on selected cards)
 */
export async function showTouchBulkMenu(x, y) {
  const selectedGroups = layer.find('.selected');
  const selectedIds = selectedGroups.map(g => g.getAttr('cardId')).filter(id => id);

  if (selectedIds.length === 0) return;

  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 220px;
  `;

  menu.innerHTML = `
    <div style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid var(--border-color); margin-bottom: 4px;">
      ${selectedIds.length} kort markerade
    </div>
    <div id="touchBulkEdit" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px;">
      ✏️ Redigera alla
    </div>
    <div id="touchBulkColor" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px;">
      🎨 Ändra färg
    </div>
    <div id="touchBulkTag" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px;">
      🏷️ Lägg till taggar
    </div>
    <div id="touchBulkCancel" style="padding: 12px; cursor: pointer; border-radius: 8px; font-size: 16px; color: var(--text-secondary); border-top: 1px solid var(--border-color); margin-top: 4px;">
      ✕ Avbryt
    </div>
  `;

  document.body.appendChild(menu);

  // Add hover effects
  const items = menu.querySelectorAll('div[id^="touchBulk"]');
  items.forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--bg-secondary)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
  });

  const cleanup = () => {
    if (menu.parentNode) {
      document.body.removeChild(menu);
    }
  };

  // Edit all handler
  document.getElementById('touchBulkEdit').addEventListener('click', async () => {
    cleanup();
    await createBulkEditor(selectedIds);
  });

  // Color picker handler
  document.getElementById('touchBulkColor').addEventListener('click', async () => {
    cleanup();
    await showQuickColorPicker(x, y, selectedIds);
  });

  // Add tags handler
  document.getElementById('touchBulkTag').addEventListener('click', async () => {
    cleanup();
    await showQuickTagAdder(x, y, selectedIds);
  });

  // Cancel handler
  document.getElementById('touchBulkCancel').addEventListener('click', () => {
    cleanup();
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', cleanup, { once: true });
  }, 100);
}

/**
 * Quick color picker for bulk operations
 */
async function showQuickColorPicker(x, y, cardIds) {
  const picker = document.createElement('div');
  picker.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10001;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    max-width: 200px;
  `;

  const showColoredDots = useColoredCards();
  const colors = [
    { id: '', label: '⭘', title: 'Ingen färg', color: 'var(--bg-secondary)' },
    ...getColorOptionsForTheme({ colored: showColoredDots }).map(option => ({
      id: option.id,
      color: option.swatch,
      title: `${option.label} (${option.shortcut})`,
      label: option.shortcut,
    })),
  ];

  colors.forEach(colorInfo => {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${colorInfo.color || 'var(--bg-secondary)'};
      border: 2px solid var(--border-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    `;
    if (!showColoredDots && colorInfo.id) {
      dot.textContent = colorInfo.label;
      dot.style.color = 'var(--text-primary)';
    } else if (!colorInfo.color) {
      dot.textContent = colorInfo.label;
    }
    dot.title = colorInfo.title || colorInfo.label;

    dot.addEventListener('click', async () => {
      const cards = await getAllCards();
      for (const cardId of cardIds) {
        await updateCard(cardId, { cardColor: colorInfo.id });
      }
      addRecentCardColor(colorInfo.id);
      await reloadCanvas();
      cleanup();
    });

    picker.appendChild(dot);
  });

  document.body.appendChild(picker);

  const cleanup = () => {
    if (picker.parentNode) {
      document.body.removeChild(picker);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', cleanup, { once: true });
  }, 100);
}

/**
 * Quick tag adder for bulk operations
 */
async function showQuickTagAdder(x, y, cardIds) {
  const adder = document.createElement('div');
  adder.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10001;
    min-width: 250px;
  `;

  adder.innerHTML = `
    <div style="margin-bottom: 12px; font-weight: 600;">Lägg till taggar</div>
    <input type="text" id="quickTagInput" placeholder="t.ex. urgent, projekt"
      style="width: 100%; padding: 10px; border: 2px solid var(--border-color);
             border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);
             box-sizing: border-box; font-size: 16px; margin-bottom: 12px;">
    <div style="display: flex; gap: 8px;">
      <button id="quickTagCancel" style="flex: 1; padding: 10px; background: var(--bg-secondary);
              color: var(--text-primary); border: 2px solid var(--border-color); border-radius: 8px;
              cursor: pointer; font-size: 14px;">Avbryt</button>
      <button id="quickTagSave" style="flex: 1; padding: 10px; background: var(--accent-color);
              color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
              font-weight: 600;">Lägg till</button>
    </div>
  `;

  document.body.appendChild(adder);

  const input = document.getElementById('quickTagInput');
  const saveBtn = document.getElementById('quickTagSave');
  const cancelBtn = document.getElementById('quickTagCancel');

  input.focus();

  const cleanup = () => {
    if (adder.parentNode) {
      document.body.removeChild(adder);
    }
  };

  const save = async () => {
    const newTags = input.value.split(',').map(t => t.trim()).filter(t => t);
    if (newTags.length === 0) {
      cleanup();
      return;
    }

    const cards = await getAllCards();
    for (const cardId of cardIds) {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        const existingTags = card.tags || [];
        const mergedTags = [...new Set([...existingTags, ...newTags])];
        await updateCard(cardId, { tags: mergedTags });
      }
    }

    await reloadCanvas();
    cleanup();
  };

  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cleanup);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cleanup();
    }
  });
}

/**
 * Open edit dialog for card (or bulk edit if multiple selected)
 */
async function openEditDialog(cardId) {
  // Check if multiple cards are selected
  const selectedGroups = layer.find('.selected');

  if (selectedGroups.length > 1) {
    // Bulk edit mode
    const selectedIds = selectedGroups.map(g => g.getAttr('cardId')).filter(id => id);
    await createBulkEditor(selectedIds);
  } else {
    // Single card edit
    const cards = await getAllCards();
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const group = cardGroups.get(cardId);
    if (!group) return;

    if (card.image && card.flipped) {
      // Flipped image card: inline edit back text
      createInlineEditor(cardId, group, card.backText || '', true);
    } else {
      // Text card: inline edit
      createInlineEditor(cardId, group, card.text || '', false);
    }
  }
}

// ============================================================================
// SECTION 4: CARD OPERATIONS (Flip, Delete)
// ============================================================================

/**
 * Flip image card
 */
async function flipCard(cardId) {
  const cards = await getAllCards();
  const card = cards.find(c => c.id === cardId);

  if (!card || !card.image) return;

  const newFlipped = !card.flipped;

  pushUndo({
    type: 'update',
    cardId,
    oldData: { flipped: card.flipped },
    newData: { flipped: newFlipped }
  });

  await updateCard(cardId, { flipped: newFlipped });
  await reloadCanvas();
}

/**
 * Delete card
 */
async function handleDeleteCard(cardId) {
  // Get card data before deletion (for undo)
  const cards = await getAllCards();
  const card = cards.find(c => c.id === cardId);

  if (card) {
    // Add to undo stack
    pushUndo({
      type: 'delete',
      card: { ...card }
    });
  }

  await deleteCard(cardId);

  // Remove from canvas
  const group = cardGroups.get(cardId);
  if (group) {
    group.destroy();
    cardGroups.delete(cardId);
    layer.batchDraw();
  }
}

// ============================================================================
// SECTION 5: CANVAS MANAGEMENT (Reload, Undo/Redo)
// ============================================================================

/**
 * Reload canvas from storage
 */
export async function reloadCanvas() {
  // Clear existing cards
  cardGroups.forEach(group => group.destroy());
  cardGroups.clear();

  // Reload from storage
  await loadCards();
}

/**
 * Update shadows on all cards based on current theme
 * Called when theme changes
 */
export function updateCardShadows() {
  const isEink = document.body.classList.contains('eink-theme');
  const isDark = document.body.classList.contains('dark-theme');

  cardGroups.forEach(group => {
    const background = group.findOne('Rect');
    if (background) {
      if (isEink) {
        // E-ink: no shadows
        background.shadowColor('transparent');
        background.shadowBlur(0);
        background.shadowOpacity(0);
        background.shadowOffset({ x: 0, y: 0 });
      } else {
        // Normal/dark: subtle shadows
        background.shadowColor('black');
        background.shadowBlur(10);
        background.shadowOpacity(0.1);
        background.shadowOffset({ x: 0, y: 2 });
      }
    }
  });

  if (layer) {
    layer.batchDraw();
  }
}

/**
 * Update fill colors on all cards based on current theme.
 * Called when theme changes.
 */
export async function updateCardFills() {
  const isEink = document.body.classList.contains('eink-theme');
  const isDark = document.body.classList.contains('dark-theme');
  const allCards = await getAllCards();

  const cardDataMap = new Map(allCards.map(card => [card.id, card]));

  cardGroups.forEach(group => {
    const cardId = group.getAttr('cardId');
    const cardData = cardDataMap.get(cardId);
    if (!cardData) return;

    const background = group.findOne('Rect');
    const text = group.findOne('Text');

    if (background) {
      let fillColor;

      if (cardData.image && cardData.flipped) {
        // Back of an image card
        fillColor = isEink ? '#ffffff' : (isDark ? '#2d3748' : '#fffacd');
      } else if (cardData.image && !cardData.flipped) {
        // Front of an image card is always white
        fillColor = '#ffffff';
      } else {
        // Text card
        const cardColor = getCardColor(cardData.cardColor);
        fillColor = cardColor; // Default to the card's own color

        if (isEink) {
          fillColor = '#ffffff';
        } else if (isDark) {
          // In dark mode, text cards have a standard dark background, ignoring their color property
          fillColor = '#2d3748';
        }
      }
      background.fill(fillColor);
    }

    if (text) {
      text.fill(isDark ? '#e0e0e0' : '#1a1a1a');
    }
  });

  if (layer) {
    layer.batchDraw();
  }
}

/**
 * Update stroke on all cards based on current theme.
 * Called when theme changes.
 */
export function updateCardStrokes() {
    const isEink = document.body.classList.contains('eink-theme');
    const isDark = document.body.classList.contains('dark-theme');

    cardGroups.forEach(group => {
        const background = group.findOne('Rect');
        if (background) {
            const isSelected = group.hasName('selected');

            if (isSelected) {
                // Keep selection stroke color if selected
                if (isEink) {
                    background.stroke('#000000');
                    background.strokeWidth(3);
                } else {
                    background.stroke('#2196F3');
                    background.strokeWidth(3);
                }
            } else {
                // Apply theme-specific stroke for non-selected cards
                if (isEink) {
                    background.stroke('#000000');
                    background.strokeWidth(1);
                } else if (isDark) {
                    background.stroke('#4a5568');
                    background.strokeWidth(1);
                } else {
                    background.stroke('#e0e0e0');
                    background.strokeWidth(1);
                }
            }
        }
    });

    if (layer) {
        layer.batchDraw();
    }
}

/**
 * Undo/redo functions
 */
function pushUndo(action) {
  undoStack.push(action);
  if (undoStack.length > MAX_UNDO_STACK) {
    undoStack.shift();
  }
  redoStack = []; // Clear redo stack on new action
}

// ============================================================================
// SECTION 6: CLIPBOARD (Copy/Paste/Duplicate)
// ============================================================================

/**
 * Duplicate/copy selected cards
 */
async function duplicateSelectedCards() {
  const selectedGroups = layer.find('.selected');

  if (selectedGroups.length === 0) {
    console.log('No cards selected to duplicate');
    return;
  }

  const { getCard, createCard } = await import('./storage.js');

  for (const group of selectedGroups) {
    const cardId = group.getAttr('cardId');
    if (!cardId) continue;

    // Get original card data
    const originalCard = await getCard(cardId);
    if (!originalCard) continue;

    // Create duplicate with offset position
    const { id, uniqueId, created, modified, metadata, ...cardData } = originalCard;

    const duplicateData = {
      ...cardData,
      position: {
        x: (originalCard.position?.x || 0) + 50,
        y: (originalCard.position?.y || 0) + 50
      }
    };

    // Create with copy metadata
    await createCard(duplicateData, {
      copied: true,
      copiedAt: new Date().toISOString(),
      copiedFrom: originalCard.uniqueId,
      originalCardId: cardId
    });
  }

  // Reload canvas
  await reloadCanvas();
  console.log(`Duplicated ${selectedGroups.length} cards`);
}

/**
 * Copy selected cards to clipboard
 */
async function copySelectedCards() {
  const selectedGroups = layer.find('.selected');

  if (selectedGroups.length === 0) {
    console.log('No cards selected to copy');
    return;
  }

  const { getCard } = await import('./storage.js');

  clipboard = [];

  for (const group of selectedGroups) {
    const cardId = group.getAttr('cardId');
    if (!cardId) continue;

    const card = await getCard(cardId);
    if (!card) continue;

    // Store card data in clipboard
    clipboard.push({
      ...card
    });
  }

  console.log(`Copied ${clipboard.length} cards to clipboard`);
}

/**
 * Paste cards from clipboard
 */
async function pasteCards() {
  if (clipboard.length === 0) {
    console.log('Clipboard is empty');
    return;
  }

  const { createCard } = await import('./storage.js');

  // Get paste position (center of viewport or mouse position)
  const pointer = stage.getPointerPosition() || {
    x: stage.width() / 2,
    y: stage.height() / 2
  };
  const scale = stage.scaleX();
  const pastePosition = {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale
  };

  // Calculate offset from first card's position
  const firstCard = clipboard[0];
  const offsetX = pastePosition.x - (firstCard.position?.x || 0);
  const offsetY = pastePosition.y - (firstCard.position?.y || 0);

  for (const cardData of clipboard) {
    const { id, uniqueId, created, modified, metadata, ...cleanData } = cardData;

    const pastedData = {
      ...cleanData,
      position: {
        x: (cardData.position?.x || 0) + offsetX,
        y: (cardData.position?.y || 0) + offsetY
      }
    };

    // Create with copy metadata
    await createCard(pastedData, {
      copied: true,
      copiedAt: new Date().toISOString(),
      copiedFrom: cardData.uniqueId,
      originalCardId: id
    });
  }

  await reloadCanvas();
  console.log(`Pasted ${clipboard.length} cards`);
}

/**
 * Paste cards from clipboard and apply arrangement
 */
async function pasteCardsWithArrangement(arrangementFunc, arrangementName) {
  if (clipboard.length === 0) {
    console.log('Clipboard is empty');
    return;
  }

  const { createCard } = await import('./storage.js');

  // Get paste position (center of viewport)
  const pointer = stage.getPointerPosition() || {
    x: stage.width() / 2,
    y: stage.height() / 2
  };
  const scale = stage.scaleX();
  const pastePosition = {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale
  };

  // Create cards first
  const newCardIds = [];
  for (const cardData of clipboard) {
    const { id, uniqueId, created, modified, metadata, ...cleanData } = cardData;

    const pastedData = {
      ...cleanData,
      position: pastePosition // Start at paste position
    };

    // Create with copy metadata
    const newId = await createCard(pastedData, {
      copied: true,
      copiedAt: new Date().toISOString(),
      copiedFrom: cardData.uniqueId,
      originalCardId: id
    });

    newCardIds.push(newId);
  }

  await reloadCanvas();

  // Select the newly pasted cards
  layer.find('.selected').forEach(group => {
    group.removeName('selected');
    const background = group.findOne('Rect');
    if (background) {
      background.stroke(null);
      background.strokeWidth(0);
    }
  });

  newCardIds.forEach(cardId => {
    const group = cardGroups.get(cardId);
    if (group) {
      group.addName('selected');
      const background = group.findOne('Rect');
      if (background) {
        background.stroke('#2196F3');
        background.strokeWidth(3);
      }
    }
  });

  layer.batchDraw();

  // Apply arrangement to the newly pasted cards
  await applyArrangement(arrangementFunc, arrangementName);

  console.log(`Pasted and arranged ${clipboard.length} cards using ${arrangementName}`);
}

async function undo() {
  if (undoStack.length === 0) {
    console.log('Nothing to undo');
    return;
  }

  const action = undoStack.pop();
  redoStack.push(action);

  if (action.type === 'delete') {
    // Restore deleted card
    const cardId = await createCard(action.card);
    await reloadCanvas();
    console.log('Undo: Restored deleted card');
  } else if (action.type === 'create') {
    // Delete created card
    await deleteCard(action.cardId);
    await reloadCanvas();
    console.log('Undo: Deleted created card');
  } else if (action.type === 'update') {
    // Restore old values
    await updateCard(action.cardId, action.oldData);
    await reloadCanvas();
    console.log('Undo: Restored old card data');
  }
}

async function redo() {
  if (redoStack.length === 0) {
    console.log('Nothing to redo');
    return;
  }

  const action = redoStack.pop();
  undoStack.push(action);

  if (action.type === 'delete') {
    // Re-delete card
    await deleteCard(action.card.id);
    await reloadCanvas();
    console.log('Redo: Re-deleted card');
  } else if (action.type === 'create') {
    // Re-create card
    const cardId = await createCard(action.card);
    await reloadCanvas();
    console.log('Redo: Re-created card');
  } else if (action.type === 'update') {
    // Re-apply new values
    await updateCard(action.cardId, action.newData);
    await reloadCanvas();
    console.log('Redo: Re-applied new card data');
  }
}

// ============================================================================
// SECTION 7: SELECTION & INTERACTION (Events, Drag, Pan, Zoom)
// ============================================================================

/**
 * Update selection based on selection rectangle
 */
function updateSelection() {
  const selBox = selectionRectangle.getClientRect();
  const isEink = document.body.classList.contains('eink-theme');
  const isDark = document.body.classList.contains('dark-theme');

  // Only deselect all if NOT additive selection (Shift not held)
  if (!isAdditiveSelection) {
    layer.find('.selected').forEach(group => {
      const background = group.findOne('Rect');
      group.removeName('selected');
      if (background) {
        if (isEink) {
          background.stroke('#000000');
          background.strokeWidth(1);
        } else if (isDark) {
          background.stroke('#4a5568');
          background.strokeWidth(1);
        } else {
          background.stroke('#e0e0e0');
          background.strokeWidth(1);
        }
      }
    });
  }

  const groups = layer.getChildren(node => node.getAttr('cardId'));
  groups.forEach(group => {
    const groupBox = group.getClientRect();

    // Check if rectangles intersect
    if (Konva.Util.haveIntersection(selBox, groupBox)) {
      const background = group.findOne('Rect');
      // Only add selection if not already selected
      if (!group.hasName('selected')) {
        group.addName('selected');
        if (background) {
          if (isEink) {
            background.stroke('#000000');
            background.strokeWidth(3);
          } else {
            background.stroke('#2196F3');
            background.strokeWidth(3);
          }
        }
      }
    }
  });
}

/**
 * Setup canvas events
 */
function setupCanvasEvents() {
  // Handle window resize
  window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    if (container && stage) {
      stage.width(container.clientWidth);
      stage.height(container.clientHeight);
    }
  });

  // Zoom with mouse wheel (faster: 2x speed)
  stage.on('wheel', (e) => {
    e.evt.preventDefault();

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.1; // Was 1.05, now 1.1 for 2x faster zoom
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Limit zoom between 0.1x and 5x
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    stage.scale({ x: clampedScale, y: clampedScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    stage.position(newPos);
    stage.batchDraw();
  });

  // Pan with middle mouse or Ctrl+drag
  // Selection rectangle with left-click drag on stage
  stage.on('mousedown', (e) => {
    // Ctrl+drag or middle mouse = pan
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.ctrlKey)) {
      isPanning = true;
      stage.draggable(true);
      stage.container().style.cursor = 'grabbing';
      return;
    }

    // Left click on stage (not on card) = start selection
    if (e.target === stage && e.evt.button === 0) {
      isSelecting = true;
      isAdditiveSelection = e.evt.shiftKey; // Shift = add to selection
      const pos = stage.getPointerPosition();
      const scale = stage.scaleX();
      selectionStartPos = {
        x: (pos.x - stage.x()) / scale,
        y: (pos.y - stage.y()) / scale
      };
      selectionRectangle.width(0);
      selectionRectangle.height(0);
      selectionRectangle.visible(true);
    }
  });

  stage.on('mousemove', () => {
    if (!isSelecting) return;

    const pos = stage.getPointerPosition();
    const scale = stage.scaleX();
    const currentPos = {
      x: (pos.x - stage.x()) / scale,
      y: (pos.y - stage.y()) / scale
    };

    const x = Math.min(selectionStartPos.x, currentPos.x);
    const y = Math.min(selectionStartPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - selectionStartPos.x);
    const height = Math.abs(currentPos.y - selectionStartPos.y);

    selectionRectangle.setAttrs({
      x: x,
      y: y,
      width: width,
      height: height
    });

    // Update selection
    updateSelection();
    layer.batchDraw();
  });

  stage.on('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      stage.draggable(false);
      stage.container().style.cursor = 'default';
    }

    if (isSelecting) {
      isSelecting = false;
      isAdditiveSelection = false; // Reset
      selectionRectangle.visible(false);
      layer.batchDraw();
    }
  });

  // Save card position when dragged
  stage.on('dragend', (e) => {
    const target = e.target;
    if (target.getAttr('cardId')) {
      const cardId = target.getAttr('cardId');
      const position = { x: target.x(), y: target.y() };

      updateCard(cardId, { position });
    }
  });

  // Double-click to edit card or flip image card
  stage.on('dblclick dbltap', async (e) => {
    const target = e.target;
    if (target.parent && target.parent.getAttr('cardId')) {
      const cardId = target.parent.getAttr('cardId');

      // Get card data to check if it's an image card
      const cards = await getAllCards();
      const card = cards.find(c => c.id === cardId);

      if (!card) return;

      // Both image cards and text cards: open edit dialog on double-click
      openEditDialog(cardId);
    } else if (target === stage) {
      // Only create card if user hasn't been panning
      if (!stageTouchHasMoved) {
        // Double-click on canvas to create new card
        const pointer = stage.getPointerPosition();
        const scale = stage.scaleX();
        const position = {
          x: (pointer.x - stage.x()) / scale,
          y: (pointer.y - stage.y()) / scale
        };
        createNewCard(position);
      }
      // Reset movement flag after double-tap check
      stageTouchHasMoved = false;
    }
  });

  // Touch long-press on empty canvas to paste image
  let stageTouchTimer = null;
  let stageTouchStart = null;
  let stageTouchStartPos = null;
  let stageTouchHasMoved = false;
  let lastCenter = null;
  let lastDist = 0;
  let isTouchPanning = false;

  function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  function getCenter(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }

  stage.on('touchstart', (e) => {
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    // Reset movement tracking
    stageTouchHasMoved = false;
    stageTouchStartPos = touch1 ? { x: touch1.clientX, y: touch1.clientY } : null;

    if (touch1 && touch2) {
      // Two fingers - prepare for pinch/pan
      e.evt.preventDefault();
      isTouchPanning = false;
      stage.draggable(false);
      lastCenter = getCenter(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      );
      lastDist = getDistance(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      );
      return;
    }

    // Single finger on empty canvas - enable panning
    if (e.target === stage) {
      isTouchPanning = true;
      stage.draggable(true);
    }

    if (e.target !== stage) return; // Only on empty canvas

    stageTouchStart = Date.now();

    stageTouchTimer = setTimeout(async () => {
      // Only show paste menu if user hasn't moved (not panning)
      if (!stageTouchHasMoved) {
        const pointer = stage.getPointerPosition();
        const scale = stage.scaleX();
        const position = {
          x: (pointer.x - stage.x()) / scale,
          y: (pointer.y - stage.y()) / scale
        };

        // Show paste menu
        await showTouchPasteMenu(e.evt.touches ? e.evt.touches[0].clientX : e.evt.clientX,
                                 e.evt.touches ? e.evt.touches[0].clientY : e.evt.clientY,
                                 position);
      }
      stageTouchTimer = null;
    }, 600); // 600ms long press
  });

  stage.on('touchmove', (e) => {
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    // Track if user has moved (for detecting panning vs tap)
    if (touch1 && stageTouchStartPos) {
      const moveDistance = Math.sqrt(
        Math.pow(touch1.clientX - stageTouchStartPos.x, 2) +
        Math.pow(touch1.clientY - stageTouchStartPos.y, 2)
      );
      if (moveDistance > 5) { // 5px threshold for better pan sensitivity
        stageTouchHasMoved = true;
      }
    }

    if (touch1 && touch2) {
      // Two fingers - pinch to zoom and pan
      e.evt.preventDefault();
      stageTouchHasMoved = true; // Mark as moved for two-finger gestures

      if (stageTouchTimer) {
        clearTimeout(stageTouchTimer);
        stageTouchTimer = null;
      }

      const newCenter = getCenter(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      );
      const newDist = getDistance(
        { x: touch1.clientX, y: touch1.clientY },
        { x: touch2.clientX, y: touch2.clientY }
      );

      const oldScale = stage.scaleX();
      const pointTo = {
        x: (newCenter.x - stage.x()) / oldScale,
        y: (newCenter.y - stage.y()) / oldScale
      };

      // Zoom
      const scale = Math.max(0.1, Math.min(5, oldScale * (newDist / lastDist)));
      stage.scale({ x: scale, y: scale });

      // Pan
      const dx = newCenter.x - lastCenter.x;
      const dy = newCenter.y - lastCenter.y;
      const newPos = {
        x: newCenter.x - pointTo.x * scale + dx,
        y: newCenter.y - pointTo.y * scale + dy
      };

      stage.position(newPos);
      stage.batchDraw();

      lastDist = newDist;
      lastCenter = newCenter;
      return;
    }

    // Cancel long-press timer if user is moving (panning)
    if (stageTouchTimer && stageTouchHasMoved) {
      clearTimeout(stageTouchTimer);
      stageTouchTimer = null;
    }
  });

  stage.on('touchend touchcancel', (e) => {
    if (stageTouchTimer) {
      clearTimeout(stageTouchTimer);
      stageTouchTimer = null;
    }
    if (isTouchPanning) {
      stage.draggable(false);
      isTouchPanning = false;
    }
    lastCenter = null;
    lastDist = 0;

    // Reset movement tracking
    stageTouchStartPos = null;
    // Note: Don't reset stageTouchHasMoved here - it's needed for dbltap check
  });

}

function getPointerPositionOnStage() {
  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
  const scale = stage.scaleX();
  return {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale
  };
}

async function handleCreateNewCardAtPointer() {
  const position = getPointerPositionOnStage();
  await createNewCard(position);
}

async function handleReadWithAICommand() {
  const selectedNodes = layer.find('.selected');
  if (selectedNodes.length === 0) {
    alert('Markera först ett eller flera bildkort som du vill läsa med AI.');
    return;
  }

  const allCards = await getAllCards();
  const imageCardIds = [];

  for (const node of selectedNodes) {
    const cardId = node.getAttr('cardId');
    if (cardId) {
      const card = allCards.find(c => c.id === cardId);
      if (card && card.image) {
        imageCardIds.push(cardId);
      }
    }
  }

  if (imageCardIds.length === 0) {
    alert('Inga bildkort är markerade. Endast bildkort kan läsas med AI.');
    return;
  }

  for (const cardId of imageCardIds) {
    try {
      await readImageWithGemini(cardId);
    } catch (error) {
      console.error('Fel vid OCR:', error);
      alert(`Fel vid läsning av kort: ${error.message}`);
    }
  }

  await reloadCanvas();
  alert(`✅ ${imageCardIds.length} kort lästa med Gemini AI. Texten finns på baksidan - dubbelklicka och klicka "Vänd kort" för att se.`);
}

async function handleAIChooserCommand(forceChooser = false) {
  const savedChoice = getSavedAIPreference();

  if (savedChoice && !forceChooser) {
    if (savedChoice === 'gemini') {
      await showGeminiAssistant();
    } else if (savedChoice === 'chatgpt') {
      await showChatGPTAssistant();
    }
    return;
  }

  const selection = await showAIChooser();
  const choice = selection?.model;
  if (choice === 'gemini' || choice === 'chatgpt') {
    rememberAIPreference(choice);
    if (choice === 'gemini') {
      await showGeminiAssistant({ intent: selection.intent, prefetchedContextSummary: selection.contextSummary });
    } else if (choice === 'chatgpt') {
      await showChatGPTAssistant({ intent: selection.intent, prefetchedContextSummary: selection.contextSummary });
    }
  }
}

async function handleBackupDownload() {
  const downloadBtn = document.getElementById('btn-download');
  downloadBtn?.click();
}

async function handleRestoreBackupCommand() {
  if (window.handleRestoreBackup) {
    await window.handleRestoreBackup();
  }
}

async function handleDriveSyncCommand() {
  if (window.handleDriveSync) {
    await window.handleDriveSync();
  }
}

function handleDriveReset() {
  const confirmed = confirm('Vill du rensa alla Google Drive-inställningar?\n\n' +
    'Detta tar bort:\n' +
    '- OAuth Client ID\n' +
    '- Senaste synk-tid\n' +
    '- Backup-ID\n\n' +
    'Du måste logga in igen nästa gång du synkar.');

  if (confirmed) {
    localStorage.removeItem('googleDriveClientId');
    localStorage.removeItem('lastDriveBackupId');
    localStorage.removeItem('lastDriveBackupTime');
    alert('✅ Drive-inställningar rensade!\n\nTryck Y för att logga in igen.');
  }
}

async function handleDeleteSelectedCards() {
  const selectedNodes = layer.find('.selected');
  for (const node of selectedNodes) {
    if (node.getAttr('cardId')) {
      const cardId = node.getAttr('cardId');
      await handleDeleteCard(cardId);
    }
  }
}

async function handleColorShortcut(key) {
  const shortcutNumber = parseInt(key, 10);
  if (Number.isNaN(shortcutNumber) || shortcutNumber < 1 || shortcutNumber > 8) return;

  const selectedNodes = layer.find('.selected');
  if (!selectedNodes.length) return;

  const cards = await getAllCards();
  const colorId = `card-color-${shortcutNumber}`;

  for (const node of selectedNodes) {
    const cardId = node.getAttr('cardId');
    if (!cardId) continue;
    const card = cards.find(c => c.id === cardId);
    if (card) {
      await updateCard(cardId, { cardColor: colorId });
    }
  }

  addRecentCardColor(colorId);
  await reloadCanvas();
}

function handleSelectAllCards() {
  const isEink = document.body.classList.contains('eink-theme');
  const allCards = layer.getChildren(node => node.getAttr('cardId'));
  allCards.forEach(group => {
    const background = group.findOne('Rect');
    group.addName('selected');
    if (background) {
      if (isEink) {
        background.stroke('#000000');
        background.strokeWidth(3);
      } else {
        background.stroke('#2196F3');
        background.strokeWidth(3);
      }
    }
  });
  layer.batchDraw();
}

async function handleVerticalArrangement(options = {}) {
  const useGrid = options.forceGrid || options.data?.heldChords?.has('g');
  if (useGrid) {
    if (clipboard.length > 0) {
      await pasteCardsWithArrangement(arrangeGridVertical, 'Grid Vertical');
    } else {
      await applyArrangement(arrangeGridVertical, 'Grid Vertical');
    }
    return;
  }

  await applyArrangement(arrangeVertical, 'Vertical');
}

async function handleHorizontalArrangement(options = {}) {
  const useGrid = options.forceGrid || options.data?.heldChords?.has('g');
  if (useGrid) {
    await applyArrangement(arrangeGridHorizontal, 'Grid Horizontal');
    return;
  }

  await applyArrangement(arrangeHorizontal, 'Horizontal');
}

async function handleGridTopArrangement() {
  await applyArrangement(arrangeGridTopAligned, 'Grid Top-Aligned');
}

async function handleClusterArrangement() {
  if (clipboard.length > 0) {
    await pasteCardsWithArrangement(arrangeCluster, 'Cluster');
  } else {
    await applyArrangement(arrangeCluster, 'Cluster');
  }
}

function registerCanvasCommands() {
  registeredCanvasCommands.forEach(unregisterCommand);
  registeredCanvasCommands.clear();

  const register = (command) => {
    registerCommand(command);
    registeredCanvasCommands.add(command.id);
  };

  register({ id: 'open-command-palette', handler: () => showCommandPalette(), contexts: ['board', 'column', 'global'], showInPalette: false });
  register({ id: 'toggle-view', handler: () => toggleViewFromMenu(), contexts: ['global'] });
  register({ id: 'toggle-theme', handler: () => window.dispatchEvent(new CustomEvent('toggleTheme')), contexts: ['global'] });
  register({ id: 'fit-all-cards', handler: () => fitAllCards(), contexts: ['board'] });
  register({ id: 'new-text-card', handler: () => handleCreateNewCardAtPointer(), contexts: ['board'] });
  register({ id: 'import-image', handler: () => importImage(), contexts: ['board'] });
  register({ id: 'paste-image-clipboard', handler: () => pasteImageFromClipboard(), contexts: ['board'] });
  register({ id: 'read-with-ai', handler: () => handleReadWithAICommand(), contexts: ['board'] });
  register({ id: 'ask-ai', handler: () => handleAIChooserCommand(), contexts: ['board'] });
  register({ id: 'export-canvas', handler: () => exportCanvas(), contexts: ['board'] });
  register({ id: 'export-readable', handler: () => exportToReadableText(), contexts: ['board'] });
  register({ id: 'import-canvas', handler: () => importCanvas(), contexts: ['board'] });
  register({ id: 'download-backup', handler: () => handleBackupDownload(), contexts: ['board', 'global'] });
  register({ id: 'restore-backup', handler: () => handleRestoreBackupCommand(), contexts: ['board'] });
  register({ id: 'drive-sync', handler: () => handleDriveSyncCommand(), contexts: ['global'] });
  register({ id: 'drive-reset', handler: () => handleDriveReset(), contexts: ['global'] });
  register({ id: 'import-zotero-html', handler: () => importFromZoteroHTML(), contexts: ['board'] });
  register({ id: 'create-multiple-cards', handler: () => createMultipleCardsFromText(), contexts: ['board'] });
  register({ id: 'delete-selected', handler: () => handleDeleteSelectedCards(), contexts: ['board'] });
  register({ id: 'undo', handler: () => undo(), contexts: ['board'] });
  register({ id: 'redo', handler: () => redo(), contexts: ['board'] });
  register({ id: 'copy-selected', handler: () => copySelectedCards(), contexts: ['board'] });
  register({ id: 'paste-cards', handler: () => pasteCards(), contexts: ['board'] });
  register({ id: 'toggle-pin', handler: () => togglePinSelectedCards(), contexts: ['board'] });
  register({ id: 'select-all', handler: () => handleSelectAllCards(), contexts: ['board'] });
  register({
    id: 'arrange-vertical',
    handler: ({ data }) => handleVerticalArrangement({ data }),
    contexts: ['board'],
    when: ({ data }) => !data?.heldChords?.has('g'),
  });
  register({
    id: 'arrange-horizontal',
    handler: ({ data }) => handleHorizontalArrangement({ data }),
    contexts: ['board'],
    when: ({ data }) => !data?.heldChords?.has('g'),
  });
  register({ id: 'arrange-cluster', handler: () => handleClusterArrangement(), contexts: ['board'] });
  register({ id: 'arrange-grid-vertical', handler: ({ data }) => handleVerticalArrangement({ data, forceGrid: true }), contexts: ['board'] });
  register({ id: 'arrange-grid-horizontal', handler: ({ data }) => handleHorizontalArrangement({ data, forceGrid: true }), contexts: ['board'] });
  register({ id: 'arrange-grid-top', handler: () => handleGridTopArrangement(), contexts: ['board'] });
}

function setupKeyboardShortcuts() {
  const heldChords = new Set();

  const handleKeyDown = (e) => {
    const target = e.target;
    const isInputTarget = target && ((target.tagName === 'INPUT') || (target.tagName === 'TEXTAREA') || target.isContentEditable);

    if (!isInputTarget && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-8]$/.test(e.key)) {
      e.preventDefault();
      handleColorShortcut(e.key);
      return;
    }

    if (e.key?.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      heldChords.add('g');
      return;
    }

    executeCommandFromEvent(e, { data: { heldChords } });
  };

  const handleKeyUp = (e) => {
    if (e.key?.toLowerCase() === 'g') {
      heldChords.delete('g');
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
}

// ============================================================================
// SECTION 8: PUBLIC API (Exported Functions)
// ============================================================================

/**
 * Get stage instance
 */
export function getStage() {
  return stage;
}

/**
 * Get main layer
 */
export function getLayer() {
  return layer;
}

/**
 * Add new card (exported for external use)
 */
export async function addNewCard() {
  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
  const scale = stage.scaleX();
  const position = {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale
  };

  await createNewCard(position);
}

/**
 * Export canvas state as JSON
 */
export async function exportCanvas() {
  const cards = await getAllCards();
  const exportData = {
    type: 'full',
    version: '1.0',
    exportedAt: Date.now(),
    cards,
    viewport: {
      x: stage.x(),
      y: stage.y(),
      scale: stage.scaleX()
    }
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `spatial-view-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import canvas from JSON file
 */
export async function importCanvas() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Import cards
        const { createCard } = await import('./storage.js');

        if (data.cards && Array.isArray(data.cards)) {
          for (let i = 0; i < data.cards.length; i++) {
            const card = data.cards[i];
            // Create each card in storage (without the id to avoid conflicts)
            const { id, ...cardWithoutId } = card;

            // Add import metadata
            await createCard(cardWithoutId, {
              imported: true,
              importedAt: new Date().toISOString(),
              importedFrom: file.name,
              importBatchIndex: i
            });
          }

          // Reload canvas to show imported cards
          await reloadCanvas();

          // Restore viewport if available
          if (data.viewport) {
            stage.position({ x: data.viewport.x, y: data.viewport.y });
            stage.scale({ x: data.viewport.scale, y: data.viewport.scale });
            stage.batchDraw();
          }

          console.log(`Imported ${data.cards.length} cards`);
          alert(`Importerade ${data.cards.length} kort!`);
          resolve(data.cards.length);
        } else {
          throw new Error('Invalid JSON format');
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Misslyckades att importera fil: ' + error.message);
        reject(error);
      }
    };

    input.click();
  });
}

/**
 * Import image and create card
 */
export async function importImage() {
  return new Promise((resolve, reject) => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) {
        resolve([]);
        return;
      }

      // Show quality selector dialog AFTER files are chosen
      const quality = await showQualityDialog(files.length);
      if (!quality) {
        resolve([]);
        return;
      }

      try {
        const cardIds = [];

        for (const file of files) {
          // Process image
          const processed = await processImage(file, quality);

          // Calculate position (stagger multiple images)
          const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
          const scale = stage.scaleX();
          const offset = cardIds.length * 50; // Stagger by 50px
          const position = {
            x: ((pointer.x - stage.x()) / scale) + offset,
            y: ((pointer.y - stage.y()) / scale) + offset
          };

          // Create card with image
          const cardId = await createCard({
            text: processed.metadata.fileName,
            tags: ['bild'],
            position,
            image: {
              base64: processed.base64,
              width: processed.metadata.width,
              height: processed.metadata.height,
              quality: processed.metadata.quality
            },
            metadata: processed.metadata
          });

          cardIds.push(cardId);
        }

        // Reload canvas to show new cards
        await reloadCanvas();

        resolve(cardIds);
      } catch (error) {
        console.error('Image import failed:', error);
        reject(error);
      }
    };

    input.click();
  });
}

/**
 * Create multiple cards from pasted text
 * Format: blocks separated by double newlines
 * - Last/second-to-last line starting with # = tags
 * - Last line starting with & = comment
 */
export async function createMultipleCardsFromText() {
  // Show dialog to paste text
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 24px;
    border-radius: 12px;
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;

  dialog.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 600;">
      Skapa flera kort från text
    </h3>

    <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
      <strong>Format:</strong><br>
      • Separera kort med dubbel radbrytning (tom rad)<br>
      • Sista/näst sista rad börjar med <code>#</code> → taggar<br>
      • Sista rad börjar med <code>&</code> → kommentar
    </div>

    <div style="margin-bottom: 16px;">
      <textarea id="multiImportText"
        placeholder="Första kortet här

Andra kortet här
#tag1 #tag2

Tredje kortet med kommentar
& Detta är en kommentar"
        style="width: 100%; height: 300px; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: 'Courier New', monospace; resize: vertical; box-sizing: border-box;">
      </textarea>
    </div>

    <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center;">
      <button id="cancelMultiImport" style="
        padding: 10px 20px;
        border: 2px solid var(--border-color);
        background: transparent;
        color: var(--text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;">
        Avbryt
      </button>
      <div style="display: flex; gap: 12px;">
        <button id="createWithGemini" style="
          padding: 10px 20px;
          border: 2px solid var(--accent-color);
          background: transparent;
          color: var(--accent-color);
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;">
          ✨ Analysera med Gemini
        </button>
        <button id="createMultiImport" style="
          padding: 10px 20px;
          border: none;
          background: var(--accent-color);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;">
          Skapa kort
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const textarea = document.getElementById('multiImportText');
  textarea.focus();

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.remove();
      resolve();
    };

    document.getElementById('cancelMultiImport').onclick = cleanup;

    // Gemini analysis button
    document.getElementById('createWithGemini').onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        alert('Klistra in text först!');
        return;
      }

      // Get API key
      const apiKeyFromStorage = localStorage.getItem('googleAiApiKey');

      if (!apiKeyFromStorage) {
        alert('Du behöver ange din Google AI API-nyckel först. Läs ett bildkort med AI för att ange den.');
        return;
      }

      // Show loading state
      const geminiBtn = document.getElementById('createWithGemini');
      const originalText = geminiBtn.textContent;
      geminiBtn.textContent = '✨ Analyserar...';
      geminiBtn.disabled = true;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyFromStorage}`;

        const prompt = `Analysera följande text och plocka ut de viktigaste citatena, insikterna eller informationen.

Skapa 3-8 korta kort (beroende på textens längd och innehåll).

För varje kort:
- "text": Ett nyckelcitat eller viktig punkt (max 2-3 meningar, citera exakt om möjligt)
- "comments": En kort kommentar om varför detta är viktigt eller kontext (1 mening)
- "tags": 2-4 relevanta taggar (ämne, kategori, koncept)

VIKTIGT: Svara ENDAST med en JSON-array enligt detta format:

[
  {
    "text": "Nyckelcitat här...",
    "comments": "Förklaring varför detta är viktigt",
    "tags": ["tag1", "tag2", "tag3"]
  }
]

Text att analysera:

${text}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;

        let cards;
        try {
          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
          const jsonText = jsonMatch ? jsonMatch[1] : rawText;
          cards = JSON.parse(jsonText.trim());
        } catch (parseError) {
          console.error('Failed to parse Gemini response:', parseError);
          throw new Error('Kunde inte tolka Geminis svar. Försök igen.');
        }

        if (!Array.isArray(cards)) {
          throw new Error('Gemini returnerade inte en array av kort.');
        }

        // Create cards
        const allCards = await getAllCards();
        const maxY = allCards.length > 0 ? Math.max(...allCards.map(c => c.position?.y || 0)) : 0;
        const startPosition = {
          x: 300,
          y: maxY + 200
        };

        for (let index = 0; index < cards.length; index++) {
          const cardData = cards[index];
          const position = {
            x: startPosition.x + (index % 5) * 50,
            y: startPosition.y + Math.floor(index / 5) * 250
          };

          await createCard({
            text: cardData.text || '',
            tags: cardData.tags || [],
            comments: cardData.comments || '',
            position: position
          });
        }

        cleanup();
        await reloadCanvas();
        alert(`✅ Gemini skapade ${cards.length} kort från texten!`);

      } catch (error) {
        console.error('Gemini error:', error);
        alert(`❌ Fel: ${error.message}`);
        geminiBtn.textContent = originalText;
        geminiBtn.disabled = false;
      }
    };

    document.getElementById('createMultiImport').onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        cleanup();
        return;
      }

      // Split on double line breaks
      const blocks = text.split(/\n\s*\n/).filter(block => block.trim());

      console.log(`Creating ${blocks.length} cards from text blocks`);

      const cards = await getAllCards();
      const maxY = cards.length > 0 ? Math.max(...cards.map(c => c.position?.y || 0)) : 0;
      const startPosition = {
        x: 300,
        y: maxY + 200
      };

      let createdCount = 0;

      for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index];
        const lines = block.trim().split('\n').map(l => l.trim());

        let cardText = '';
        let tags = [];
        let comments = '';

        // Check last line for comment (starts with &)
        const lastLine = lines[lines.length - 1];
        let textLines = [...lines];

        if (lastLine.startsWith('&')) {
          comments = lastLine.substring(1).trim();
          textLines = lines.slice(0, -1);
        }

        // Check last or second-to-last line for tags (starts with #)
        const checkLine = textLines[textLines.length - 1];
        if (checkLine && checkLine.startsWith('#')) {
          const tagMatches = checkLine.match(/#\w+/g);
          if (tagMatches) {
            tags = tagMatches.map(tag => tag.substring(1));
            textLines = textLines.slice(0, -1);
          }
        }

        cardText = textLines.join('\n').trim();

        // Skip empty cards
        if (!cardText && tags.length === 0) continue;

        // Create card
        const position = {
          x: startPosition.x + (index % 5) * 50,
          y: startPosition.y + Math.floor(index / 5) * 250
        };

        await createCard({
          text: cardText,
          tags: tags,
          comments: comments,
          position: position
        });

        createdCount++;
      }

      console.log(`Multi-import complete: ${createdCount} cards created`);

      cleanup();
      await reloadCanvas();

      // Show success message
      alert(`✅ Skapade ${createdCount} kort från texten!`);
    };

    // Escape to close
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    });
  });
}

/**
 * Export canvas to readable text (HTML, Markdown, or Plain text)
 */
export async function exportToReadableText() {
  // Show format selection dialog
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 24px;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;

  dialog.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 600;">
      Exportera till läsbar text
    </h3>

    <div style="margin-bottom: 20px; font-size: 14px; color: var(--text-secondary);">
      Välj vilket format du vill exportera till:
    </div>

    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
      <button class="export-format-btn" data-format="html" style="
        padding: 16px;
        border: 2px solid var(--border-color);
        background: var(--bg-secondary);
        color: var(--text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        text-align: left;
        transition: all 0.2s;">
        <div style="font-size: 16px; margin-bottom: 4px;">🌐 HTML</div>
        <div style="font-size: 12px; opacity: 0.7;">Med färger och layout som kolumnvy</div>
      </button>
      <button class="export-format-btn" data-format="markdown" style="
        padding: 16px;
        border: 2px solid var(--border-color);
        background: var(--bg-secondary);
        color: var(--text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        text-align: left;
        transition: all 0.2s;">
        <div style="font-size: 16px; margin-bottom: 4px;">📝 Markdown</div>
        <div style="font-size: 12px; opacity: 0.7;">Med formatering (kommentarer kursiverade)</div>
      </button>
      <button class="export-format-btn" data-format="txt" style="
        padding: 16px;
        border: 2px solid var(--border-color);
        background: var(--bg-secondary);
        color: var(--text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        text-align: left;
        transition: all 0.2s;">
        <div style="font-size: 16px; margin-bottom: 4px;">📄 Plain Text</div>
        <div style="font-size: 12px; opacity: 0.7;">Enkel text utan formatering</div>
      </button>
    </div>

    <div style="display: flex; justify-content: flex-end;">
      <button id="cancelExportText" style="
        padding: 10px 20px;
        border: 2px solid var(--border-color);
        background: transparent;
        color: var(--text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;">
        Avbryt
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.remove();
      resolve();
    };

    document.getElementById('cancelExportText').onclick = cleanup;

    // Add hover effects
    const buttons = dialog.querySelectorAll('.export-format-btn');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--accent-color)';
        btn.style.background = 'var(--bg-primary)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--border-color)';
        btn.style.background = 'var(--bg-secondary)';
      });
      btn.addEventListener('click', async () => {
        const format = btn.dataset.format;
        cleanup();
        await performExport(format);
      });
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    });
  });
}

async function performExport(format) {
  const cards = await getAllCards();

  if (cards.length === 0) {
    alert('Inga kort att exportera!');
    return;
  }

  let content = '';
  let filename = '';
  let mimeType = '';

  const timestamp = new Date().toISOString().split('T')[0];

  if (format === 'html') {
    content = generateHTML(cards);
    filename = `spatial-view-${timestamp}.html`;
    mimeType = 'text/html';
  } else if (format === 'markdown') {
    content = generateMarkdown(cards);
    filename = `spatial-view-${timestamp}.md`;
    mimeType = 'text/markdown';
  } else if (format === 'txt') {
    content = generatePlainText(cards);
    filename = `spatial-view-${timestamp}.txt`;
    mimeType = 'text/plain';
  }

  // Download file
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Exported ${cards.length} cards to ${format.toUpperCase()}`);
}

function generateHTML(cards) {
  const colorMap = {
    'card-color-1': '#d4f2d4',
    'card-color-2': '#ffe4b3',
    'card-color-3': '#ffc1cc',
    'card-color-4': '#fff7b3',
    'card-color-5': '#f3e5f5',
    'card-color-6': '#c7e7ff',
    'card-color-7': '#e0e0e0',
    'card-color-8': '#ffffff'
  };

  const cardsHTML = cards.map(card => {
    const bgColor = colorMap[card.cardColor] || '#ffffff';
    const text = card.text || '';
    const comments = card.comments || '';
    const tags = card.tags || [];
    const backText = card.backText || '';

    return `
    <div class="card" style="background-color: ${bgColor};">
      ${card.image ? '<div class="card-type">🖼️ Bildkort</div>' : ''}
      <div class="card-text">${escapeHTML(text)}</div>
      ${backText ? `<div class="card-backtext">${escapeHTML(backText)}</div>` : ''}
      ${comments ? `<div class="card-comments">${escapeHTML(comments)}</div>` : ''}
      ${tags.length > 0 ? `<div class="card-tags">${tags.map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join(' ')}</div>` : ''}
    </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spatial View Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .card {
      margin-bottom: 20px;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card-type {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }
    .card-text {
      font-size: 16px;
      line-height: 1.5;
      white-space: pre-wrap;
      margin-bottom: 8px;
    }
    .card-backtext {
      font-size: 14px;
      line-height: 1.4;
      white-space: pre-wrap;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0,0,0,0.1);
    }
    .card-comments {
      font-size: 12px;
      font-style: italic;
      color: #666;
      margin-top: 8px;
    }
    .card-tags {
      margin-top: 12px;
      font-size: 12px;
    }
    .tag {
      display: inline-block;
      padding: 4px 8px;
      background: rgba(0, 102, 204, 0.1);
      color: #0066cc;
      border-radius: 4px;
      margin-right: 6px;
    }
  </style>
</head>
<body>
  <h1>Spatial View Export</h1>
  <div class="cards">
    ${cardsHTML}
  </div>
</body>
</html>`;
}

function generateMarkdown(cards) {
  const lines = ['# Spatial View Export\n'];

  cards.forEach((card, index) => {
    lines.push(`## Kort ${index + 1}`);

    if (card.image) {
      lines.push('*[Bildkort]*');
    }

    if (card.text) {
      lines.push('');
      lines.push(card.text);
    }

    if (card.backText) {
      lines.push('');
      lines.push('**Baksida:**');
      lines.push(card.backText);
    }

    if (card.comments) {
      lines.push('');
      lines.push(`*${card.comments}*`);
    }

    if (card.tags && card.tags.length > 0) {
      lines.push('');
      lines.push(`Tags: ${card.tags.map(tag => `#${tag}`).join(' ')}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

function generatePlainText(cards) {
  const lines = ['SPATIAL VIEW EXPORT', '===================', ''];

  cards.forEach((card, index) => {
    lines.push(`KORT ${index + 1}`);
    lines.push('-'.repeat(20));

    if (card.image) {
      lines.push('[Bildkort]');
    }

    if (card.text) {
      lines.push('');
      lines.push(card.text);
    }

    if (card.backText) {
      lines.push('');
      lines.push('Baksida:');
      lines.push(card.backText);
    }

    if (card.comments) {
      lines.push('');
      lines.push(`Kommentar: ${card.comments}`);
    }

    if (card.tags && card.tags.length > 0) {
      lines.push('');
      lines.push(`Tags: ${card.tags.map(tag => `#${tag}`).join(' ')}`);
    }

    lines.push('');
    lines.push('');
  });

  return lines.join('\n');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create cards from text using Gemini to extract key quotes
 */
export async function createCardsFromTextWithGemini() {
  const apiKey = await getGoogleAIAPIKey();
  if (!apiKey) {
    console.log('Gemini text splitting cancelled: No API key provided.');
    return;
  }

  // Show dialog to paste text
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 24px;
    border-radius: 12px;
    max-width: 700px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;

  dialog.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 600;">
      ✨ Skapa kort från text med Gemini
    </h3>

    <div style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">
      Klistra in lång text nedan. Gemini kommer analysera texten och plocka ut nyckelcitat,
      lägga till kommentarer och taggar automatiskt.
    </div>

    <div style="margin-bottom: 16px;">
      <textarea id="geminiSplitText"
        placeholder="Klistra in din text här..."
        style="width: 100%; height: 300px; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; resize: vertical; box-sizing: border-box;">
      </textarea>
    </div>

    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="cancelGeminiSplit" style="
        padding: 10px 20px;
        border: 2px solid var(--border-color);
        background: transparent;
        color: var(--text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;">
        Avbryt
      </button>
      <button id="createGeminiSplit" style="
        padding: 10px 20px;
        border: none;
        background: var(--accent-color);
        color: white;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;">
        ✨ Analysera med Gemini
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const textarea = document.getElementById('geminiSplitText');
  textarea.focus();

  return new Promise((resolve) => {
    const cleanup = () => {
      overlay.remove();
      resolve();
    };

    document.getElementById('cancelGeminiSplit').onclick = cleanup;

    document.getElementById('createGeminiSplit').onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        cleanup();
        return;
      }

      // Show loading state
      const createBtn = document.getElementById('createGeminiSplit');
      const originalText = createBtn.textContent;
      createBtn.textContent = '✨ Analyserar...';
      createBtn.disabled = true;

      try {
        // Call Gemini API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const prompt = `Analysera följande text och plocka ut de viktigaste citatena, insikterna eller informationen.

Skapa 3-8 korta kort (beroende på textens längd och innehåll).

För varje kort:
- "text": Ett nyckelcitat eller viktig punkt (max 2-3 meningar, citera exakt om möjligt)
- "comments": En kort kommentar om varför detta är viktigt eller kontext (1 mening)
- "tags": 2-4 relevanta taggar (ämne, kategori, koncept)

VIKTIGT: Svara ENDAST med en JSON-array enligt detta format:

[
  {
    "text": "Nyckelcitat här...",
    "comments": "Förklaring varför detta är viktigt",
    "tags": ["tag1", "tag2", "tag3"]
  },
  {
    "text": "Nästa viktiga citat...",
    "comments": "Kontext eller förklaring",
    "tags": ["tag1", "tag2"]
  }
]

Text att analysera:

${text}`;

        const payload = {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;

        // Parse JSON from response
        let cards;
        try {
          const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
          const jsonText = jsonMatch ? jsonMatch[1] : rawText;
          cards = JSON.parse(jsonText.trim());
        } catch (parseError) {
          console.error('Failed to parse Gemini response:', parseError);
          throw new Error('Kunde inte tolka Geminis svar. Försök igen.');
        }

        if (!Array.isArray(cards)) {
          throw new Error('Gemini returnerade inte en array av kort.');
        }

        // Create cards
        const allCards = await getAllCards();
        const maxY = allCards.length > 0 ? Math.max(...allCards.map(c => c.position?.y || 0)) : 0;
        const startPosition = {
          x: 300,
          y: maxY + 200
        };

        for (let index = 0; index < cards.length; index++) {
          const cardData = cards[index];

          const position = {
            x: startPosition.x + (index % 5) * 50,
            y: startPosition.y + Math.floor(index / 5) * 250
          };

          await addCard({
            text: cardData.text || '',
            tags: cardData.tags || [],
            comments: cardData.comments || '',
            position: position
          });
        }

        console.log(`Gemini text split complete: ${cards.length} cards created`);

        cleanup();
        await reloadCanvas();

        alert(`✅ Gemini skapade ${cards.length} kort från texten!`);

      } catch (error) {
        console.error('Gemini text splitting error:', error);
        alert(`❌ Fel: ${error.message}`);
        createBtn.textContent = originalText;
        createBtn.disabled = false;
      }
    };

    // Escape to close
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    });
  });
}

/**
 * Map Zotero highlight color to card color
 */
function mapZoteroColorToCard(bgColorStyle) {
  // Extract hex color from style like "background-color: #ffd40080"
  const match = bgColorStyle.match(/#([0-9a-fA-F]{6})/);
  if (!match) return null;

  const hexColor = match[1].toLowerCase();

  // Map Zotero colors to spatial-view card colors (matching v2)
  const colorMap = {
    'ffd400': 'card-color-4', // Gul
    'ff6666': 'card-color-3', // Röd
    '5fb236': 'card-color-1', // Grön
    '2ea8e5': 'card-color-6', // Blå/Cyan
    'a28ae5': 'card-color-5', // Lila
    'e56eee': 'card-color-5', // Magenta → Lila
    'f19837': 'card-color-2', // Orange
    'aaaaaa': 'card-color-7'  // Grå
  };

  return colorMap[hexColor] || null;
}

/**
 * Import notes from Zotero HTML export
 */
export async function importFromZoteroHTML() {
  return new Promise((resolve, reject) => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(0);
        return;
      }

      const reader = new FileReader();

      reader.onload = async function(event) {
        try {
          const htmlContent = event.target.result;
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');

          // Find all highlight paragraphs
          const highlightParagraphs = doc.querySelectorAll('p');

          let importedCount = 0;
          const timestamp = Date.now();

          // Calculate grid positioning
          const cols = Math.ceil(Math.sqrt(highlightParagraphs.length));

          for (let index = 0; index < highlightParagraphs.length; index++) {
            const p = highlightParagraphs[index];

            // Find the highlight span with background color
            const highlightSpan = p.querySelector('span.highlight span[style*="background-color"]');
            if (!highlightSpan) continue;

            // Extract the quote text
            const quoteText = highlightSpan.textContent.trim();
            if (!quoteText) continue;

            // Extract color
            const bgStyle = highlightSpan.getAttribute('style');
            const cardColor = mapZoteroColorToCard(bgStyle);

            // Extract citation if available
            const citationSpan = p.querySelector('span.citation');
            let citation = '';
            if (citationSpan) {
              citation = citationSpan.textContent.trim();
            }

            // Extract PDF link
            const pdfLink = p.querySelector('a[href*="open-pdf"]');
            let pdfLinkText = '';
            if (pdfLink) {
              pdfLinkText = pdfLink.textContent.trim();
            }

            // Extract comment text (text after all spans/links)
            let commentText = '';
            const allText = p.textContent;
            const highlightText = highlightSpan.textContent;
            const citationText = citationSpan ? citationSpan.textContent : '';
            const pdfText = pdfLink ? pdfLink.textContent : '';

            // Remove all known parts and what's left is the comment
            let remainingText = allText;
            remainingText = remainingText.replace(highlightText, '');
            remainingText = remainingText.replace(citationText, '');
            remainingText = remainingText.replace(pdfText, '');
            commentText = remainingText.replace(/\(|\)/g, '').trim();

            // Build card text
            let cardText = quoteText;
            if (citation) {
              cardText += `\n\n${citation}`;
            }
            if (pdfLinkText) {
              cardText += ` (${pdfLinkText})`;
            }

            // Grid positioning
            const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
            const scale = stage.scaleX();
            const col = index % cols;
            const row = Math.floor(index / cols);
            const position = {
              x: ((pointer.x - stage.x()) / scale) + col * 240,
              y: ((pointer.y - stage.y()) / scale) + row * 240
            };

            // Create card
            await createCard({
              text: cardText,
              comments: commentText || '',
              tags: ['zotero', `import_${timestamp}`],
              cardColor: cardColor,
              position
            });

            importedCount++;
          }

          // Reload canvas to show new cards
          await reloadCanvas();

          // Show success message
          alert(`📚 Zotero import: ${importedCount} kort importerade från ${file.name}`);
          console.log(`Zotero import completed: ${importedCount} cards imported from ${file.name}`);

          resolve(importedCount);
        } catch (error) {
          console.error('Error importing from Zotero:', error);
          alert('Fel vid import från Zotero HTML: ' + error.message);
          reject(error);
        }
      };

      reader.readAsText(file);
    };

    input.click();
  });
}

/**
 * Paste image from system clipboard (e.g. screenshot)
 */
async function pasteImageFromClipboard() {
  try {
    // Check if Clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.read) {
      alert('Clipboard API stöds inte i denna webbläsare. Använd "Importera bild" istället.');
      return;
    }

    const clipboardItems = await navigator.clipboard.read();
    let imageFound = false;

    for (const clipboardItem of clipboardItems) {
      for (const type of clipboardItem.types) {
        if (type.startsWith('image/')) {
          imageFound = true;
          const blob = await clipboardItem.getType(type);

          // Convert blob to file
          const file = new File([blob], 'clipboard-image.png', { type: blob.type });

          console.log('Clipboard image size:', (file.size / 1024).toFixed(1), 'KB');

          // Show quality selector dialog
          const quality = await showQualityDialog(1);
          if (!quality) return;

          console.log('Selected quality:', quality);

          // Process image
          const processed = await processImage(file, quality);

          console.log('Processed size:', (processed.metadata.compressedSize / 1024).toFixed(1), 'KB');
          console.log('Dimensions:', processed.metadata.width, 'x', processed.metadata.height);

          // Calculate position at center or mouse position
          const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
          const scale = stage.scaleX();
          const position = {
            x: (pointer.x - stage.x()) / scale,
            y: (pointer.y - stage.y()) / scale
          };

          // Create card with image
          await createCard({
            text: 'Inklistrad bild',
            tags: ['bild', 'clipboard'],
            position,
            image: {
              base64: processed.base64,
              width: processed.metadata.width,
              height: processed.metadata.height,
              quality: processed.metadata.quality
            },
            metadata: {
              ...processed.metadata,
              fileName: 'clipboard-image.png',
              source: 'clipboard'
            }
          });

          await reloadCanvas();
          console.log('Image pasted from clipboard');
          return;
        }
      }
    }

    if (!imageFound) {
      alert('Ingen bild hittades i clipboard. Kopiera en bild eller skärmdump först.');
    }

  } catch (error) {
    console.error('Failed to paste from clipboard:', error);
    if (error.name === 'NotAllowedError') {
      alert('Tillgång till clipboard nekades. Ge webbläsaren tillstånd att läsa clipboard.');
    } else {
      alert('Kunde inte klistra in bild från clipboard: ' + error.message);
    }
  }
}

// ============================================================================
// SECTION 9: UI DIALOGS (Command Palette, Quality Dialog, Text Input, Gemini Assistant)
// ============================================================================

const AI_PREFERENCE_KEY = 'spatialview:lastAIModel';
const AI_HISTORY_PREFIX = 'spatialview:aiHistory';

function getBoardScopedKey(model) {
  const boardId = window.location.pathname || 'root';
  return `${AI_HISTORY_PREFIX}:${boardId}:${model}`;
}

function getSavedAIPreference() {
  try {
    return localStorage.getItem(AI_PREFERENCE_KEY);
  } catch (error) {
    console.warn('Kunde inte läsa AI-val från localStorage:', error);
    return null;
  }
}

function rememberAIPreference(model) {
  try {
    localStorage.setItem(AI_PREFERENCE_KEY, model);
  } catch (error) {
    console.warn('Kunde inte spara AI-val:', error);
  }
}

function loadConversationHistory(model) {
  try {
    const stored = localStorage.getItem(getBoardScopedKey(model));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Kunde inte läsa sparad konversation:', error);
    return [];
  }
}

function saveConversationHistory(model, history) {
  try {
    localStorage.setItem(getBoardScopedKey(model), JSON.stringify(history));
  } catch (error) {
    console.warn('Kunde inte spara konversation:', error);
  }
}

async function buildAIContextSnapshot(toolRegistry = null) {
  try {
    const cards = toolRegistry?.getAllCards
      ? await toolRegistry.getAllCards()
      : await getAllCards();
    const totalCards = cards.length;
    const imageCards = cards.filter(c => c.hasImage).length;

    const selectedNodes = layer.find('.selected');
    const selectedIds = new Set(
      selectedNodes
        .map(node => node.getAttr('cardId'))
        .filter(Boolean)
    );
    const selectedCards = cards.filter(c => selectedIds.has(c.id));

    const tagInfo = typeof toolRegistry?.listAllTags === 'function'
      ? await toolRegistry.listAllTags()
      : (() => {
          const tagCounts = new Map();
          for (const card of cards) {
            if (card.tags && Array.isArray(card.tags)) {
              for (const tag of card.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
              }
            }
          }

          const tags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

          return { tags };
        })();
    const topTags = (tagInfo?.tags || [])
      .slice(0, 5)
      .map(t => `${t.tag} (${t.count})`)
      .join(', ');

    const createdTimestamps = cards
      .map(c => c.created)
      .filter(ts => typeof ts === 'number' && !Number.isNaN(ts));
    const dateSpan = createdTimestamps.length
      ? `${new Date(Math.min(...createdTimestamps)).toISOString().slice(0, 10)} → ${new Date(Math.max(...createdTimestamps)).toISOString().slice(0, 10)}`
      : 'saknas';

    const selectedSummary = selectedCards
      .slice(0, 3)
      .map(c => {
        const preview = c.text || c.backText || '(tomt kort)';
        return `#${c.id}: ${preview.slice(0, 80)}`;
      })
      .join('; ');

    return [
      `Kort: ${totalCards} totalt (${imageCards} med bild)`,
      selectedIds.size
        ? `Markerade (${selectedIds.size}): ${selectedSummary}${selectedCards.length > 3 ? ' …' : ''}`
        : 'Markerade: inga',
      topTags ? `Vanliga tags: ${topTags}` : 'Inga tags hittades',
      `Datumspann (skapade): ${dateSpan}`
    ].join('\n');
  } catch (error) {
    console.warn('Kunde inte bygga kontextöversikt:', error);
    return null;
  }
}

const AI_INTENTS = [
  {
    id: 'ask-anything',
    label: 'Ställ en egen fråga',
    description: 'Starta en tom chatt och skriv själv',
    prompt: ''
  },
  {
    id: 'summarize-selection',
    label: 'Sammanfatta markerade',
    description: 'Kort sammanfattning av markerade kort',
    prompt: 'Sammanfatta de markerade korten kortfattat. Fokusera på nyckelidéer och beslut.'
  },
  {
    id: 'next-steps',
    label: 'Föreslå nästa steg',
    description: 'Actionlista baserad på markerade kort',
    prompt: 'Föreslå 3–5 konkreta nästa steg baserat på markerade kort och deras tags. Svara kort.'
  },
  {
    id: 'agenda',
    label: 'Skapa agenda',
    description: 'Snabb mötesagenda från dagens fokus',
    prompt: 'Skapa en kort agenda (5 punkter) baserad på markerade kort och de vanligaste taggarna just nu.'
  }
];

/**
 * Show AI Assistant chooser (Gemini or ChatGPT)
 */
async function showAIChooser() {
  return new Promise((resolve) => {
    // IMPORTANT: Remove any leftover overlays from previous calls
    // This prevents gray overlay from persisting if cleanup didn't run properly
    const oldOverlays = document.querySelectorAll('div[style*="z-index: 10000"][style*="rgba(0, 0, 0, 0.8)"]');
    oldOverlays.forEach(old => old.remove());

    const overlay = document.createElement('div');
    overlay.className = 'ai-chooser-overlay'; // Add class for easier cleanup
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--bg-primary);
      color: var(--text-primary);
      border-radius: 16px;
      padding: 30px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const lastChoice = getSavedAIPreference();

    dialog.innerHTML = `
      <h2 style="margin: 0 0 20px 0; text-align: center; color: var(--text-primary);">
        Välj AI-assistent
      </h2>
      <p style="margin: 0 12px 18px 12px; text-align: center; color: var(--text-secondary);">
        Välj modell och startintention. Förhandsvisningen nedan visar vilken tavla-kontekst som skickas (kompakt för att spara tokens).
      </p>
      ${lastChoice ? `<p style="margin: -12px 0 24px 0; text-align: center; color: var(--text-secondary); font-size: 13px;">Senaste valda: <strong>${lastChoice === 'gemini' ? 'Gemini' : 'ChatGPT'}</strong> (startar direkt om du väljer samma igen)</p>` : ''}
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button id="chooseGemini" style="
          flex: 1;
          padding: 20px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          color: var(--text-primary);
        ">
          <div style="font-size: 32px;">🤖</div>
          <div style="font-weight: 500;">Gemini</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Tryck G</div>
        </button>
        <button id="chooseChatGPT" style="
          flex: 1;
          padding: 20px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          color: var(--text-primary);
        ">
          <div style="font-size: 32px;">💬</div>
          <div style="font-weight: 500;">ChatGPT</div>
          <div style="font-size: 12px; color: var(--text-secondary);">Tryck C</div>
        </button>
      </div>
      <div style="margin-top: 20px; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary);">
        <div style="font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>📌 Kontextextrakt (kort)</span>
          <span style="font-size: 12px; color: var(--text-secondary);">Skickas vid start</span>
        </div>
        <div id="aiContextPreview" style="white-space: pre-line; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">🔄 Bygger kontext…</div>
      </div>
      <div style="margin-top: 16px;">
        <div style="font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>🎯 Startintention</span>
          <span style="font-size: 12px; color: var(--text-secondary);">Håller svaren korta och sparar tokens</span>
        </div>
        <div id="aiIntentOptions" style="display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));"></div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const geminiBtn = document.getElementById('chooseGemini');
    const chatgptBtn = document.getElementById('chooseChatGPT');

    let selectedIntent = AI_INTENTS[0];
    let cachedContext = null;

    const renderIntents = () => {
      const intentContainer = dialog.querySelector('#aiIntentOptions');
      intentContainer.innerHTML = '';

      AI_INTENTS.forEach(intent => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
          text-align: left;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid ${selectedIntent.id === intent.id ? 'var(--accent-color)' : 'var(--border-color)'};
          background: ${selectedIntent.id === intent.id ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-secondary)'};
          cursor: pointer;
          transition: all 0.15s ease;
          color: var(--text-primary);
        `;

        btn.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px;">${intent.label}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${intent.description}</div>
        `;

        btn.addEventListener('click', () => {
          selectedIntent = intent;
          renderIntents();
        });

        intentContainer.appendChild(btn);
      });
    };

    renderIntents();

    const cleanup = (choice) => {
      document.removeEventListener('keydown', handleKey);
      overlay.remove();
      if (!choice) {
        resolve(null);
        return;
      }

      resolve({
        model: choice,
        intent: selectedIntent,
        contextSummary: cachedContext
      });
    };

    const handleKey = (e) => {
      if (e.key === 'g' || e.key === 'G') {
        cleanup('gemini');
      } else if (e.key === 'c' || e.key === 'C') {
        cleanup('chatgpt');
      } else if (e.key === 'Escape') {
        cleanup(null);
      }
    };

    geminiBtn.addEventListener('click', () => cleanup('gemini'));
    chatgptBtn.addEventListener('click', () => cleanup('chatgpt'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });

    document.addEventListener('keydown', handleKey);

    // Add hover effects
    [geminiBtn, chatgptBtn].forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--accent-color)';
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--border-color)';
        btn.style.transform = 'scale(1)';
      });
    });

    // Build context preview
    const contextPreviewEl = dialog.querySelector('#aiContextPreview');
    buildAIContextSnapshot()
      .then(summary => {
        cachedContext = summary;
        contextPreviewEl.textContent = summary || 'Kunde inte bygga en kort kontext. Starta ändå – modellen får markeringar om du har valt kort.';
      })
      .catch(() => {
        contextPreviewEl.textContent = 'Kunde inte bygga en kort kontext (sparar tokens genom att hoppa över).';
      });
  });
}

/**
 * Show Gemini Assistant dialog
 */
async function showGeminiAssistant(options = {}) {
  const { intent = null, prefetchedContextSummary = null } = options;
  // IMPORTANT: Ensure any chooser overlays are removed when opening the panel
  const oldChooserOverlays = document.querySelectorAll('.ai-chooser-overlay');
  oldChooserOverlays.forEach(overlay => overlay.remove());

  // Create side panel (no overlay, user can see canvas)
  const panel = document.createElement('div');
  panel.id = 'geminiPanel';
  panel.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    width: 400px;
    max-width: 90vw;
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease;
  `;

  // Mobile: bottom panel instead
  if (window.innerWidth < 768 || (window.innerWidth < 1024 && window.innerHeight > window.innerWidth)) {
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60vh;
      max-height: 80vh;
      width: 100%;
      background: var(--bg-primary);
      color: var(--text-primary);
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      transition: transform 0.3s ease;
      border-radius: 16px 16px 0 0;
    `;
  }

  panel.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
        🤖 Gemini Chat
      </h3>
      <div style="display: flex; gap: 12px;">
        <button id="geminiSwitchModel" title="Byt AI-modell" style="background: none; border: 1px solid var(--border-color); font-size: 13px; cursor: pointer; color: var(--text-secondary); padding: 6px 10px; border-radius: 8px;">Byt</button>
        <button id="geminiMinimize" title="Minimera (sparar konversationen)" style="background: none; border: none; font-size: 20px; cursor: pointer;
                color: var(--text-secondary); padding: 0; line-height: 1;">−</button>
        <button id="geminiClose" title="Stäng (raderar konversationen)" style="background: none; border: none; font-size: 24px; cursor: pointer;
                color: var(--text-secondary); padding: 0; line-height: 1;">&times;</button>
      </div>
    </div>
    <div id="chatMessages" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    "></div>
    <div id="voiceIndicator" style="
      display: none;
      padding: 8px 12px;
      margin: 0 16px;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff0000;
      border-radius: 8px;
      margin-bottom: 8px;
      text-align: center;
      font-size: 14px;
    ">
      🔴 Lyssnar... <span id="voiceTranscript" style="font-style: italic;"></span>
    </div>
    <div id="inputArea" style="padding: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 8px; align-items: center;">
      <input type="text" id="geminiQuery" placeholder="Skriv eller håll 'V' för röst..."
        style="flex: 1; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; box-sizing: border-box;" />
      <button id="geminiVoice" style="padding: 12px; background: var(--bg-secondary);
              color: var(--text-primary); border: 2px solid var(--border-color); border-radius: 8px;
              cursor: pointer; font-size: 20px; line-height: 1; width: 48px; height: 48px;
              display: flex; align-items: center; justify-content: center;">🎤</button>
      <button id="geminiAsk" style="padding: 12px 20px; background: var(--accent-color);
              color: white; border: none; border-radius: 8px; cursor: pointer;
              font-size: 14px; white-space: nowrap;">Skicka</button>
    </div>
  `;

  document.body.appendChild(panel);

  const queryInput = document.getElementById('geminiQuery');
  const chatMessages = document.getElementById('chatMessages');
  const askBtn = document.getElementById('geminiAsk');
  const closeBtn = document.getElementById('geminiClose');
  const switchModelBtn = document.getElementById('geminiSwitchModel');
  const minimizeBtn = document.getElementById('geminiMinimize');
  const voiceBtn = document.getElementById('geminiVoice');
  const voiceIndicator = document.getElementById('voiceIndicator');
  const voiceTranscript = document.getElementById('voiceTranscript');

  // Conversation history
  const conversationHistory = loadConversationHistory('gemini');
  const persistHistory = () => saveConversationHistory('gemini', conversationHistory);

  // Create minimize floating button (initially hidden)
  const floatingBtn = document.createElement('button');
  floatingBtn.id = 'geminiFloatingBtn';
  floatingBtn.innerHTML = '🤖';
  floatingBtn.title = 'Expandera Gemini Chat';
  floatingBtn.style.cssText = `
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-color);
    color: white;
    border: none;
    font-size: 28px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9998;
    display: none;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  `;
  floatingBtn.addEventListener('mouseenter', () => {
    floatingBtn.style.transform = 'scale(1.1)';
  });
  floatingBtn.addEventListener('mouseleave', () => {
    floatingBtn.style.transform = 'scale(1)';
  });
  document.body.appendChild(floatingBtn);

  // Minimize function
  const minimize = () => {
    persistHistory();
    panel.style.display = 'none';
    floatingBtn.style.display = 'flex';
  };

  // Expand function
  const expand = () => {
    panel.style.display = 'flex';
    floatingBtn.style.display = 'none';
    queryInput.focus();
  };

  // Focus input
  queryInput.focus();

  // Speech Recognition Setup
  let recognition = null;
  let isRecording = false;

  // Check if browser supports speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'sv-SE'; // Swedish
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecording = true;
      voiceIndicator.style.display = 'block';
      voiceBtn.style.background = '#ff0000';
      voiceBtn.style.color = 'white';
      voiceBtn.textContent = '🔴';

      // Minimize input area (hide keyboard)
      const inputArea = document.getElementById('inputArea');
      inputArea.style.display = 'none';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      voiceTranscript.textContent = `"${transcript}"`;

      // If final result, put in input
      if (event.results[0].isFinal) {
        queryInput.value = transcript;
      }
    };

    recognition.onend = () => {
      isRecording = false;
      voiceIndicator.style.display = 'none';
      voiceBtn.style.background = 'var(--bg-secondary)';
      voiceBtn.style.color = 'var(--text-primary)';
      voiceBtn.textContent = '🎤';

      // Restore input area
      const inputArea = document.getElementById('inputArea');
      inputArea.style.display = 'flex';

      // Auto-send if we have text
      if (queryInput.value.trim()) {
        setTimeout(() => sendPrompt(), 300);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      isRecording = false;
      voiceIndicator.style.display = 'none';
      voiceBtn.style.background = 'var(--bg-secondary)';
      voiceBtn.style.color = 'var(--text-primary)';
      voiceBtn.textContent = '🎤';

      // Restore input area
      const inputArea = document.getElementById('inputArea');
      inputArea.style.display = 'flex';

      if (event.error === 'no-speech') {
        addSystemMessage('⚠️ Ingen röst hördes. Försök igen.');
      } else if (event.error === 'not-allowed') {
        addSystemMessage('❌ Mikrofon-tillstånd nekades. Aktivera i webbläsaren.');
      }
    };

    // Voice button - click and hold
    voiceBtn.addEventListener('mousedown', () => {
      if (!isRecording) {
        recognition.start();
      }
    });

    voiceBtn.addEventListener('mouseup', () => {
      if (isRecording) {
        recognition.stop();
      }
    });

    // Touch support
    voiceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!isRecording) {
        recognition.start();
      }
    });

    voiceBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isRecording) {
        recognition.stop();
      }
    });

  } else {
    // Hide voice button if not supported
    voiceBtn.style.display = 'none';
    console.warn('Speech recognition not supported in this browser');
  }

  // Global 'V' key push-to-talk
  const handleVoiceKey = (e) => {
    if (e.key === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Only if not typing in an input
      if (document.activeElement !== queryInput &&
          document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!isRecording && recognition) {
          recognition.start();
        }
      }
    }
  };

  const handleVoiceKeyUp = (e) => {
    if (e.key === 'v') {
      if (isRecording && recognition) {
        recognition.stop();
      }
    }
  };

  document.addEventListener('keydown', handleVoiceKey);
  document.addEventListener('keyup', handleVoiceKeyUp);

  // Function to add message to chat
  const addMessage = (text, isUser) => {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      padding: 12px;
      border-radius: 12px;
      max-width: 85%;
      word-wrap: break-word;
      line-height: 1.5;
      ${isUser ? `
        background: var(--accent-color);
        color: white;
        align-self: flex-end;
        margin-left: auto;
      ` : `
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        align-self: flex-start;
      `}
    `;

    // Render markdown for Gemini responses, plain text for user messages
    if (isUser) {
      messageDiv.textContent = text;
    } else {
      // Parse markdown and render as HTML
      const htmlContent = marked.parse(text);
      messageDiv.innerHTML = htmlContent;

      // Add styling for markdown elements
      messageDiv.querySelectorAll('p').forEach(p => p.style.margin = '0.5em 0');
      messageDiv.querySelectorAll('ul, ol').forEach(list => {
        list.style.marginLeft = '1.5em';
        list.style.marginTop = '0.5em';
        list.style.marginBottom = '0.5em';
      });
      messageDiv.querySelectorAll('li').forEach(li => li.style.marginBottom = '0.25em');
      messageDiv.querySelectorAll('strong').forEach(strong => strong.style.fontWeight = 'bold');
      messageDiv.querySelectorAll('code').forEach(code => {
        code.style.cssText = `
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        `;
      });
      messageDiv.querySelectorAll('pre').forEach(pre => {
        pre.style.cssText = `
          background: var(--bg-secondary);
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 0.5em 0;
        `;
        const codeEl = pre.querySelector('code');
        if (codeEl) {
          codeEl.style.background = 'none';
          codeEl.style.padding = '0';
        }
      });
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // Function to add system message (thinking, errors, etc.)
    const addSystemMessage = (text) => {
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        padding: 8px 12px;
        border-radius: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      font-style: italic;
      text-align: center;
      background: var(--bg-secondary);
    `;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
  };

  const renderStoredConversation = () => {
    if (!conversationHistory.length) return;

    conversationHistory.forEach(msg => {
      if (msg.role === 'assistant') {
        addMessage(msg.text, false);
      } else if (msg.role === 'user') {
        addMessage(msg.text, true);
      } else {
        addSystemMessage(msg.text);
      }
    });

    addSystemMessage(`🔁 Fortsätter tidigare chatt (${conversationHistory.length} meddelanden).`);
  };

  // Escape key handler (declare before cleanup so we can reference it)
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  // Cleanup function
  const cleanup = () => {
    persistHistory();
    document.removeEventListener('keydown', handleEscape);
    document.removeEventListener('keydown', handleVoiceKey);
    document.removeEventListener('keyup', handleVoiceKeyUp);

    // Stop any ongoing recording
    if (isRecording && recognition) {
      recognition.stop();
    }

    // Remove panel and floating button
    panel.remove();
    floatingBtn.remove();
  };

  // Close button handler
  closeBtn.addEventListener('click', cleanup);

  // Switch model handler
  const handleSwitchModel = async () => {
    cleanup();
    await handleAIChooserCommand(true);
  };
  switchModelBtn.addEventListener('click', handleSwitchModel);

  // Minimize button handler
  minimizeBtn.addEventListener('click', minimize);

  // Floating button handler (expand)
  floatingBtn.addEventListener('click', expand);

  // Add Escape key listener
  document.addEventListener('keydown', handleEscape);

  // Define tools that Gemini can use (moved outside handler for reuse)
  const tools = [{
    functionDeclarations: [
      {
        name: 'searchCards',
        description: 'Sök efter kort baserat på text, tags eller innehåll. Returnerar matchande kort-ID:n.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Sökfråga (kan använda Boolean search: AND, OR, NOT)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'getAllCards',
        description: 'Hämta alla kort med deras data (text, tags, färg, position, skapandedatum, metadata etc.)',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'listAllTags',
        description: 'Lista alla unika tags som finns i systemet med antal kort per tagg. Använd detta FÖRST för att se vilka tags som finns.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'filterImageCards',
        description: 'Filtrera och markera alla kort som INNEHÅLLER en bild (image). Använd detta istället för att söka efter tagg "bild".',
        parameters: {
          type: 'object',
          properties: {
            hasImage: {
              type: 'boolean',
              description: 'true för att hitta bildkort, false för att hitta textkort (standard: true)'
            }
          }
        }
      },
      {
        name: 'filterCardsByTag',
        description: 'Filtrera kort baserat på en specifik tagg',
        parameters: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              description: 'Taggen att filtrera på'
            }
          },
          required: ['tag']
        }
      },
      {
        name: 'filterCardsByDateRange',
        description: 'Filtrera kort som skapades under en viss tidsperiod (t.ex. en specifik vecka, månad, eller dag)',
        parameters: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Startdatum i ISO-format (YYYY-MM-DD eller YYYY-MM-DDTHH:mm:ss)'
            },
            endDate: {
              type: 'string',
              description: 'Slutdatum i ISO-format (YYYY-MM-DD eller YYYY-MM-DDTHH:mm:ss)'
            }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'filterCardsByMentionedDate',
        description: 'Filtrera kort som nämner eller innehåller ett specifikt datum (från text, metadata eller Gemini-extraherade datum)',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Datum att söka efter (YYYY-MM-DD format)'
            }
          },
          required: ['date']
        }
      },
      {
        name: 'arrangeCardsInGrid',
        description: 'Arrangera markerade kort i ett rutnät (grid) för bättre översikt',
        parameters: {
          type: 'object',
          properties: {
            columns: {
              type: 'number',
              description: 'Antal kolumner i rutnätet (standard: 4)'
            },
            spacing: {
              type: 'number',
              description: 'Avstånd mellan kort i pixlar (standard: 20)'
            }
          }
        }
      },
      {
        name: 'groupCardsByCategory',
        description: 'Gruppera och arrangera kort baserat på deras tags eller kategorier',
        parameters: {
          type: 'object',
          properties: {
            categoryTag: {
              type: 'string',
              description: 'Tagg att gruppera efter (t.ex. "möte", "anteckning", "faktura")'
            }
          }
        }
      },
      {
        name: 'arrangeAllTagsInGrids',
        description: 'Arrangera ALLA kort grupperade efter deras taggar i separata grids (vertikalt). ANVÄND DENNA för "sortera tematiskt" eller "gruppera alla taggar". Inga parametrar behövs!',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'getUpcomingCalendar',
        description: 'Hämta kommande kalenderhändelser från Google Calendar för de närmaste veckorna. ANVÄND för att se vad användaren har för sig framöver!',
        parameters: {
          type: 'object',
          properties: {
            weeks: {
              type: 'number',
              description: 'Antal veckor att hämta (standard: 3)'
            }
          }
        }
      },
      {
        name: 'getTodayCalendar',
        description: 'Hämta dagens kalenderhändelser från Google Calendar. ANVÄND för "vad har jag idag?" eller "dagens schema"',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'getThisWeekCalendar',
        description: 'Hämta denna veckans kalenderhändelser från Google Calendar. ANVÄND för "hur ser min vecka ut?"',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'createCardsFromCalendar',
        description: 'Skapa kort från Google Calendar-händelser. Skapar INTE duplicat - kollar calendarEventId. ANVÄND för "importera min kalender" eller "skapa kort från mina möten"',
        parameters: {
          type: 'object',
          properties: {
            weeks: {
              type: 'number',
              description: 'Antal veckor framåt att hämta händelser från (standard: 2)'
            }
          }
        }
      },
      {
        name: 'arrangeCardsByDay',
        description: 'Arrangera kort i ett VECKOSCHEMA där varje dag är en kolumn. Perfekt för att visualisera kalendern! ANVÄND för "visa som veckoschema", "organisera efter dag" eller "skapa veckovy"',
        parameters: {
          type: 'object',
          properties: {
            weeks: {
              type: 'number',
              description: 'Antal veckor att visa (standard: 2)'
            },
            useExtractedDate: {
              type: 'boolean',
              description: 'Använd Gemini-extraherade datum istället för skapandedatum (standard: true)'
            }
          }
        }
      },
      {
        name: 'applySchoolColorScheme',
        description: 'Tillämpa FÖRINSTÄLLT färgschema för SKOLÄMNEN. Ma=blå, SV=gul, Eng=röd, lunch=vit, etc. ANVÄND ALLTID denna för skolschema! ANVÄND för "färglägg schemat", "applicera färger" eller efter att ha importerat kalender',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'colorCardsByPattern',
        description: 'Färglägg kort baserat på textmönster. Alla kort som innehåller "lunch" får samma färg, alla "viktigt" får annan färg etc. ANVÄND för "färglägg alla lunch-möten" eller "ge alla SV-kort blå färg"',
        parameters: {
          type: 'object',
          properties: {
            patterns: {
              type: 'array',
              description: 'Array av mönster och färger. Exempel: [{pattern: "lunch", color: "#ffeb3b"}, {pattern: "viktigt", color: "#f44336"}, {pattern: "Ma", color: "#2196f3"}]',
              items: {
                type: 'object',
                properties: {
                  pattern: { type: 'string', description: 'Textsträng att söka efter (case-insensitive)' },
                  color: { type: 'string', description: 'Hex-färgkod (t.ex. #ff0000 för röd)' }
                },
                required: ['pattern', 'color']
              }
            }
          },
          required: ['patterns']
        }
      },
      {
        name: 'arrangeCardsTimeline',
        description: 'Arrangera kort kronologiskt på en tidslinje baserat på skapandedatum eller extraherade datum',
        parameters: {
          type: 'object',
          properties: {
            useExtractedDate: {
              type: 'boolean',
              description: 'Använd Gemini-extraherade datum istället för skapandedatum (standard: false)'
            },
            orientation: {
              type: 'string',
              description: 'Horisontell eller vertikal tidslinje: "horizontal" eller "vertical" (standard: horizontal)'
            }
          }
        }
      },
      {
        name: 'arrangeCardsKanban',
        description: 'Arrangera kort i Kanban-kolumner baserat på status-tags eller kategorier',
        parameters: {
          type: 'object',
          properties: {
            columns: {
              type: 'array',
              description: 'Lista med kolumnnamn/tags (t.ex. ["backlog", "todo", "pågår", "klart"])',
              items: { type: 'string' }
            }
          },
          required: ['columns']
        }
      },
      {
        name: 'arrangeCardsMindMap',
        description: 'Arrangera kort i en radiell mind map-struktur runt ett centralkort',
        parameters: {
          type: 'object',
          properties: {
            centerCardId: {
              type: 'number',
              description: 'ID för centralkortet (om inte angivet används första markerade kortet)'
            },
            radius: {
              type: 'number',
              description: 'Radie från centrum i pixlar (standard: 300)'
            }
          }
        }
      },
      {
        name: 'arrangeCardsCluster',
        description: 'Gruppera och arrangera kort i kluster baserat på gemensamma tags eller innehåll',
        parameters: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              description: 'Klustermetod: "tags" (gruppera efter gemensamma tags) eller "smart" (AI-baserad) (standard: tags)'
            }
          }
        }
      }
    ]
  }];

  // Tool registry - actual functions
  const toolRegistry = {
    searchCards: async (args) => {
      await searchCards(args.query);
      const selectedCount = layer.find('.selected').length;
      return `Hittade och markerade ${selectedCount} kort.`;
    },
    getAllCards: async () => {
      const cards = await getAllCards();
      return cards.map(c => ({
        id: c.id,
        text: c.text?.substring(0, 100),
        backText: c.backText?.substring(0, 100),
        tags: c.tags,
        cardColor: c.cardColor,
        hasImage: !!c.image,
        created: c.created,
        createdAt: c.metadata?.createdAt,
        extractedDate: c.geminiMetadata?.extractedDate,
        extractedDateTime: c.geminiMetadata?.extractedDateTime
      }));
    },
    listAllTags: async () => {
      const cards = await getAllCards();
      const tagCounts = new Map();

      // Count occurrences of each tag
      for (const card of cards) {
        if (card.tags && Array.isArray(card.tags)) {
          for (const tag of card.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }

      // Convert to array and sort by count (descending)
      const tagList = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      const summary = tagList.map(t => `${t.tag} (${t.count})`).join(', ');
      return {
        totalUniqueTags: tagList.length,
        totalCards: cards.length,
        tags: tagList,
        summary: `Hittade ${tagList.length} unika tags: ${summary}`
      };
    },
    filterImageCards: async (args) => {
      const hasImage = args.hasImage !== false; // Default to true
      const cards = await getAllCards();

      // Filter cards based on whether they have an image
      const matchingIds = cards
        .filter(c => hasImage ? !!c.image : !c.image)
        .map(c => c.id);

      // Deselect all first, then select matching
      deselectAllCards();
      matchingIds.forEach(id => {
        const node = layer.findOne(n => n.getAttr('cardId') === id);
        if (node) {
          node.addName('selected'); // Add class name for consistency
          const background = node.findOne('Rect');
          if (background) {
            background.stroke('#2196F3');
            background.strokeWidth(3);
          }
        }
      });
      layer.batchDraw();

      const cardType = hasImage ? 'bildkort' : 'textkort';
      return `Markerade ${matchingIds.length} ${cardType} (av totalt ${cards.length} kort).`;
    },
    filterCardsByTag: async (args) => {
      await searchCards(`tags:${args.tag}`);
      const selectedCount = layer.find('.selected').length;
      return `Markerade ${selectedCount} kort med taggen "${args.tag}".`;
    },
    filterCardsByDateRange: async (args) => {
      const startTime = new Date(args.startDate).getTime();
      const endTime = new Date(args.endDate).getTime();

      const cards = await getAllCards();
      const matchingIds = cards
        .filter(c => c.created >= startTime && c.created <= endTime)
        .map(c => c.id);

      // Deselect all first, then select matching
      deselectAllCards();
      matchingIds.forEach(id => {
        const node = layer.findOne(n => n.getAttr('cardId') === id);
        if (node) {
          node.addName('selected'); // Add class name for consistency
          const background = node.findOne('Rect');
          if (background) {
            background.stroke('#2196F3');
            background.strokeWidth(3);
          }
        }
      });
      layer.batchDraw();

      return `Markerade ${matchingIds.length} kort skapade mellan ${args.startDate} och ${args.endDate}.`;
    },
    filterCardsByMentionedDate: async (args) => {
      const searchDate = args.date; // YYYY-MM-DD

      const cards = await getAllCards();
      const matchingIds = [];

      for (const card of cards) {
        // Check Gemini extracted dates
        if (card.geminiMetadata?.extractedDate === searchDate ||
            card.geminiMetadata?.extractedDateTime?.startsWith(searchDate)) {
          matchingIds.push(card.id);
          continue;
        }

        // Check if date is mentioned in text or backText
        const allText = `${card.text || ''} ${card.backText || ''}`.toLowerCase();
        if (allText.includes(searchDate)) {
          matchingIds.push(card.id);
          continue;
        }

        // Check date hashtags (e.g. #250819 for 2025-08-19)
        const dateTag = searchDate.replace(/^20/, '').replace(/-/g, ''); // Convert 2025-08-19 to 250819
        if (card.tags?.some(tag => tag.includes(dateTag))) {
          matchingIds.push(card.id);
        }
      }

      // Deselect all first, then select matching
      deselectAllCards();
      matchingIds.forEach(id => {
        const node = layer.findOne(n => n.getAttr('cardId') === id);
        if (node) {
          node.addName('selected'); // Add class name for consistency
          const background = node.findOne('Rect');
          if (background) {
            background.stroke('#2196F3');
            background.strokeWidth(3);
          }
        }
      });
      layer.batchDraw();

      return `Markerade ${matchingIds.length} kort som nämner datumet ${searchDate}.`;
    },
    arrangeCardsInGrid: async (args) => {
      const columns = args.columns || 4;
      const spacing = args.spacing || 13;  // Reduced by 1/3 (was 20)
      const offsetX = args.offsetX || 0;
      const offsetY = args.offsetY || 0;

      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) {
        return 'Inga kort är markerade. Markera kort först för att arrangera dem.';
      }

      // Get card dimensions (assume all cards are same size for simplicity)
      const cardWidth = 200;
      const cardHeight = 150;

      // Arrange in grid with offset
      selectedNodes.forEach((node, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;

        const x = offsetX + col * (cardWidth + spacing);
        const y = offsetY + row * (cardHeight + spacing);

        node.position({ x, y });
      });

      layer.batchDraw();

      const rows = Math.ceil(selectedNodes.length / columns);
      return `Arrangerade ${selectedNodes.length} kort i ett ${columns}x${rows} rutnät på position (${offsetX}, ${offsetY}).`;
    },
    groupCardsByCategory: async (args) => {
      const categoryTag = args.categoryTag;

      // First, filter cards by the category tag
      await searchCards(`tags:${categoryTag}`);

      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) {
        return `Inga kort hittades med taggen "${categoryTag}".`;
      }

      // Arrange them in a grid
      const columns = 4;
      const spacing = 13;  // Reduced by 1/3 (was 20)
      const cardWidth = 200;
      const cardHeight = 150;

      selectedNodes.forEach((node, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;

        const x = col * (cardWidth + spacing);
        const y = row * (cardHeight + spacing);

        node.position({ x, y });
      });

      layer.batchDraw();

      return `Grupperade och arrangerade ${selectedNodes.length} kort med kategorin "${categoryTag}".`;
    },

    arrangeAllTagsInGrids: async () => {
      console.log('🔍 arrangeAllTagsInGrids: Starting...');

      // Get all unique tags
      const cards = await getAllCards();
      console.log(`📦 Found ${cards.length} cards in database`);

      const tagCounts = new Map();
      for (const card of cards) {
        if (card.tags && Array.isArray(card.tags)) {
          for (const tag of card.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }

      const tags = Array.from(tagCounts.keys());
      console.log(`🏷️ Found ${tags.length} unique tags:`, tags);

      if (tags.length === 0) {
        return 'Inga taggar hittades.';
      }

      // Constants for layout
      const cardWidth = 200;
      const cardHeight = 150;
      const columns = 4;
      const spacing = 13;   // Reduced by 1/3 (was 20)
      const gridGap = 67;   // Reduced by 1/3 (was 100)

      let currentY = 0;
      let arrangedCount = 0;

      // Arrange each tag group
      for (const tag of tags) {
        // Filter cards by this tag
        const matchingCards = cards.filter(c => c.tags && c.tags.includes(tag));
        console.log(`🏷️ Tag "${tag}": ${matchingCards.length} cards`);

        if (matchingCards.length === 0) continue;

        // Find and arrange these cards
        matchingCards.forEach((card, index) => {
          const node = layer.findOne(n => n.getAttr('cardId') === card.id);
          if (node) {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const x = col * (cardWidth + spacing);
            const y = currentY + row * (cardHeight + spacing);

            console.log(`  ➡️ Moving card ${card.id} to (${x}, ${y})`);
            node.position({ x, y });
            arrangedCount++;
          } else {
            console.warn(`  ⚠️ Node not found for card ${card.id}`);
          }
        });

        // Move to next group position
        const rows = Math.ceil(matchingCards.length / columns);
        currentY += rows * (cardHeight + spacing) + gridGap;
      }

      console.log(`✅ Calling layer.batchDraw() for ${arrangedCount} cards`);
      layer.batchDraw();

      return `Arrangerade ${arrangedCount} kort i ${tags.length} tagg-grupper (vertikalt med ${gridGap}px mellanrum).`;
    },

    getUpcomingCalendar: async (args) => {
      const weeks = args.weeks || 3;
      try {
        const events = await getUpcomingCalendarEvents(weeks);
        return formatEventsForAI(events);
      } catch (error) {
        return `Kunde inte hämta kalenderhändelser: ${error.message}. Se till att du har kopplat Google Calendar (samma Client ID som Drive).`;
      }
    },

    getTodayCalendar: async () => {
      try {
        const events = await getTodayCalendarEvents();
        return formatEventsForAI(events);
      } catch (error) {
        return `Kunde inte hämta dagens händelser: ${error.message}`;
      }
    },

    getThisWeekCalendar: async () => {
      try {
        const events = await getThisWeekCalendarEvents();
        return formatEventsForAI(events);
      } catch (error) {
        return `Kunde inte hämta veckans händelser: ${error.message}`;
      }
    },

    createCardsFromCalendar: async (args) => {
      const weeks = args.weeks || 2;
      try {
        // Get calendar events
        const events = await getUpcomingCalendarEvents(weeks);

        if (!events || events.length === 0) {
          return 'Inga kalenderhändelser hittades.';
        }

        // Get all existing cards
        const existingCards = await getAllCards();

        // Find which events already have cards
        const existingEventIds = new Set(
          existingCards
            .filter(c => c.calendarEventId)
            .map(c => c.calendarEventId)
        );

        // Filter to only new events
        const newEvents = events.filter(e => !existingEventIds.has(e.id));

        if (newEvents.length === 0) {
          return `Alla ${events.length} kalenderhändelser har redan kort. Inga nya kort skapades.`;
        }

        // Create cards for new events
        let createdCount = 0;
        const createdCards = [];

        for (const event of newEvents) {
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);

          // Format card text
          let cardText = `📅 ${event.summary}\n\n`;
          cardText += `⏰ ${startDate.toLocaleString('sv-SE', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`;

          if (!event.isAllDay) {
            cardText += ` - ${endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
          }

          if (event.location) {
            cardText += `\n📍 ${event.location}`;
          }

          if (event.description) {
            cardText += `\n\n${event.description}`;
          }

          if (event.attendees && event.attendees.length > 0) {
            cardText += `\n\n👥 ${event.attendees.length} deltagare`;
          }

          // Create the card with automatic color detection
          const autoColor = getColorFromText(event.summary);
          const defaultColor = event.isAllDay ? '#e3f2fd' : '#fff3e0';

          const newCard = await createCard({
            text: cardText,
            x: 100 + (createdCount % 5) * 250, // Spread cards horizontally
            y: 100 + Math.floor(createdCount / 5) * 200,
            tags: ['calendar', 'meeting'],
            cardColor: autoColor || defaultColor, // Use subject color if found, otherwise default
            calendarEventId: event.id, // Store the calendar event ID!
            calendarEventLink: event.htmlLink,
            eventDate: event.start // Store event date for sorting
          });

          createdCards.push(newCard);
          createdCount++;
        }

        // Reload canvas to show new cards
        await reloadCanvas();

        return `Skapade ${createdCount} nya kort från kalendern (${events.length - createdCount} events hade redan kort). De nya korten är taggade med 'calendar' och 'meeting'.`;

      } catch (error) {
        console.error('Error creating cards from calendar:', error);
        return `Kunde inte skapa kort från kalendern: ${error.message}`;
      }
    },

    applySchoolColorScheme: async () => {
      // Preset color scheme for school subjects (both abbreviations and full names)
      const schoolColors = [
        {patterns: ["ma", "matematik"], color: "#2196f3"},           // Matematik - blå
        {patterns: ["sv", "svenska"], color: "#ffeb3b"},             // Svenska - gul
        {patterns: ["no", "naturorientering"], color: "#4caf50"},    // NO - grön
        {patterns: ["eng", "engelska"], color: "#f44336"},           // Engelska - röd
        {patterns: ["bi", "bild"], color: "#9c27b0"},                // Bild - lila
        {patterns: ["tk", "teknik"], color: "#9e9e9e"},              // Teknik - grå
        {patterns: ["spanska", "språk"], color: "#ff9800"},          // Spanska/språk - orange
        {patterns: ["idh", "idrott"], color: "#e91e63"},             // Idrott - rosa
        {patterns: ["so", "samhällskunskap"], color: "#ef9a9a"},     // SO - ljusröd
        {patterns: ["sl", "slöjd"], color: "#fff59d"},               // Slöjd - ljusgul
        {patterns: ["mu", "musik"], color: "#a5d6a7"},               // Musik - ljusgrön
        {patterns: ["hkk"], color: "#a5d6a7"},                       // HKK - ljusgrön
        {patterns: ["lunch"], color: "#ffffff"}                      // Lunch - vit
      ];

      try {
        const cards = await getAllCards();
        let coloredCount = 0;
        const colorSummary = {};

        for (const {patterns, color} of schoolColors) {
          const matchingCards = cards.filter(card => {
            const text = (card.text || '').toLowerCase();
            const backText = (card.backText || '').toLowerCase();
            const tags = (card.tags || []).join(' ').toLowerCase();
            const searchText = `${text} ${backText} ${tags}`;

            // Check if any pattern matches
            return patterns.some(pattern => {
              const regex = new RegExp(`\\b${pattern}\\b`, 'i');
              return regex.test(searchText);
            });
          });

          if (matchingCards.length > 0) {
            colorSummary[patterns[0]] = matchingCards.length; // Use first pattern for summary

            for (const card of matchingCards) {
              await updateCard(card.id, { cardColor: color });
              coloredCount++;

              // Update visual node color
              const node = layer.findOne(n => n.getAttr('cardId') === card.id);
              if (node) {
                const cardRect = node.findOne('Rect');
                if (cardRect) {
                  cardRect.fill(color);
                }
              }
            }
          }
        }

        layer.batchDraw();

        let summary = `Tillämpade skolfärgschema på ${coloredCount} kort:\n`;
        for (const [pattern, count] of Object.entries(colorSummary)) {
          summary += `- ${pattern}: ${count} kort\n`;
        }

        return summary;

      } catch (error) {
        console.error('Error applying school color scheme:', error);
        return `Kunde inte tillämpa färgschema: ${error.message}`;
      }
    },

    colorCardsByPattern: async (args) => {
      const patterns = args.patterns || []; // Array of {pattern: string, color: string}

      if (patterns.length === 0) {
        return 'Inga färg-mönster angivna. Exempel: [{pattern: "lunch", color: "#ffeb3b"}, {pattern: "viktigt", color: "#f44336"}]';
      }

      try {
        const cards = await getAllCards();
        let coloredCount = 0;
        const colorSummary = {};

        for (const {pattern, color} of patterns) {
          const matchingCards = cards.filter(card => {
            const text = (card.text || '').toLowerCase();
            const backText = (card.backText || '').toLowerCase();
            const tags = (card.tags || []).join(' ').toLowerCase();
            const searchText = `${text} ${backText} ${tags}`;
            return searchText.includes(pattern.toLowerCase());
          });

          colorSummary[pattern] = matchingCards.length;

          for (const card of matchingCards) {
            await updateCard(card.id, { cardColor: color });
            coloredCount++;

            // Update visual node color
            const node = layer.findOne(n => n.getAttr('cardId') === card.id);
            if (node) {
              const cardRect = node.findOne('Rect');
              if (cardRect) {
                cardRect.fill(color);
              }
            }
          }
        }

        layer.batchDraw();

        let summary = `Färglade ${coloredCount} kort:\n`;
        for (const [pattern, count] of Object.entries(colorSummary)) {
          summary += `- "${pattern}": ${count} kort\n`;
        }

        return summary;

      } catch (error) {
        console.error('Error coloring cards:', error);
        return `Kunde inte färglägga kort: ${error.message}`;
      }
    },

    arrangeCardsByDay: async (args) => {
      const weeks = args.weeks || 2;
      const useExtractedDate = args.useExtractedDate !== false; // Default true

      try {
        // Get all cards
        const cards = await getAllCards();

        // Group cards by date
        const cardsByDate = new Map();

        for (const card of cards) {
          let dateStr = null;

          // Try to get date from various sources
          if (card.eventDate) {
            // Calendar event date (prioritize this)
            const date = new Date(card.eventDate);
            dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
          } else if (useExtractedDate && card.geminiMetadata?.extractedDateTime) {
            const date = new Date(card.geminiMetadata.extractedDateTime);
            dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
          } else if (useExtractedDate && card.geminiMetadata?.extractedDate) {
            const date = new Date(card.geminiMetadata.extractedDate);
            dateStr = date.toISOString().split('T')[0];
          } else if (card.created) {
            const date = new Date(card.created);
            dateStr = date.toISOString().split('T')[0];
          }

          if (dateStr) {
            if (!cardsByDate.has(dateStr)) {
              cardsByDate.set(dateStr, []);
            }
            cardsByDate.get(dateStr).push(card);
          }
        }

        if (cardsByDate.size === 0) {
          return 'Inga kort med datum hittades att arrangera.';
        }

        // Sort dates chronologically
        const sortedDates = Array.from(cardsByDate.keys()).sort();

        // Limit to requested weeks if specified
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weeksInMs = weeks * 7 * 24 * 60 * 60 * 1000;
        const endDate = new Date(today.getTime() + weeksInMs);

        const filteredDates = sortedDates.filter(dateStr => {
          const date = new Date(dateStr);
          return date >= today && date <= endDate;
        });

        const datesToShow = filteredDates.length > 0 ? filteredDates : sortedDates.slice(0, weeks * 7);

        // Layout constants (reduced spacing by 1/3)
        const columnWidth = 210;   // Tighter columns (was 250)
        const columnSpacing = 10;  // Much tighter spacing (was 20)
        const cardHeight = 160;
        const cardSpacing = 10;    // Reduced by 1/3 (was 15)
        const headerHeight = 80;
        const startX = 50;
        const startY = 50;

        let arrangedCount = 0;

        // Arrange cards in columns by day
        datesToShow.forEach((dateStr, dayIndex) => {
          const cardsForDay = cardsByDate.get(dateStr) || [];
          const x = startX + dayIndex * (columnWidth + columnSpacing);

          // Create date header label (we'll use a card for this)
          const date = new Date(dateStr);
          const dayName = date.toLocaleDateString('sv-SE', { weekday: 'short' });
          const dateLabel = date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });

          cardsForDay.forEach((card, cardIndex) => {
            const node = layer.findOne(n => n.getAttr('cardId') === card.id);
            if (node) {
              const y = startY + headerHeight + cardIndex * (cardHeight + cardSpacing);
              node.position({ x, y });
              arrangedCount++;
            }
          });
        });

        layer.batchDraw();

        const weekCount = Math.ceil(datesToShow.length / 7);
        return `Arrangerade ${arrangedCount} kort i ett veckoschema över ${datesToShow.length} dagar (ca ${weekCount} veckor). Varje kolumn = en dag.`;

      } catch (error) {
        console.error('Error arranging cards by day:', error);
        return `Kunde inte arrangera kort efter dag: ${error.message}`;
      }
    },

    arrangeCardsTimeline: async (args) => {
      const useExtractedDate = args.useExtractedDate || false;
      const orientation = args.orientation || 'horizontal';

      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) {
        return 'Inga kort är markerade. Markera kort först för att arrangera dem på en tidslinje.';
      }

      const cards = await getAllCards();

      // Build array of {node, timestamp, card}
      const cardsWithDates = [];
      for (const node of selectedNodes) {
        const cardId = node.getAttr('cardId');
        const card = cards.find(c => c.id === cardId);
        if (!card) continue;

        let timestamp;
        if (useExtractedDate && card.geminiMetadata?.extractedDateTime) {
          timestamp = new Date(card.geminiMetadata.extractedDateTime).getTime();
        } else if (useExtractedDate && card.geminiMetadata?.extractedDate) {
          timestamp = new Date(card.geminiMetadata.extractedDate).getTime();
        } else {
          timestamp = card.created || Date.now();
        }

        cardsWithDates.push({ node, timestamp, card });
      }

      // Sort by timestamp
      cardsWithDates.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate spacing
      const minTime = cardsWithDates[0].timestamp;
      const maxTime = cardsWithDates[cardsWithDates.length - 1].timestamp;
      const timeRange = maxTime - minTime || 1; // Avoid division by zero

      const cardWidth = 200;
      const cardHeight = 150;
      const spacing = 33;  // Reduced by 1/3 (was 50)
      const totalLength = 1500; // Total timeline length in pixels

      if (orientation === 'horizontal') {
        // Horizontal timeline
        cardsWithDates.forEach((item, index) => {
          const relativeTime = (item.timestamp - minTime) / timeRange;
          const x = relativeTime * totalLength;
          const y = 100; // Fixed Y position
          item.node.position({ x, y });
        });
      } else {
        // Vertical timeline
        cardsWithDates.forEach((item, index) => {
          const relativeTime = (item.timestamp - minTime) / timeRange;
          const x = 100; // Fixed X position
          const y = relativeTime * totalLength;
          item.node.position({ x, y });
        });
      }

      layer.batchDraw();

      const dateSource = useExtractedDate ? 'extraherade datum' : 'skapandedatum';
      return `Arrangerade ${cardsWithDates.length} kort på en ${orientation === 'horizontal' ? 'horisontell' : 'vertikal'} tidslinje baserat på ${dateSource}.`;
    },

    arrangeCardsKanban: async (args) => {
      const columns = args.columns || ['backlog', 'todo', 'pågår', 'klart'];

      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) {
        return 'Inga kort är markerade. Markera kort först för att arrangera dem i Kanban-kolumner.';
      }

      const cards = await getAllCards();
      const cardWidth = 200;
      const cardHeight = 150;
      const columnWidth = 250;
      const spacing = 13;  // Reduced by 1/3 (was 20)

      // Group cards by column
      const columnGroups = columns.map(col => ({ name: col, cards: [] }));
      const unassigned = [];

      for (const node of selectedNodes) {
        const cardId = node.getAttr('cardId');
        const card = cards.find(c => c.id === cardId);
        if (!card) continue;

        // Find which column this card belongs to
        let assigned = false;
        for (let i = 0; i < columns.length; i++) {
          const colName = columns[i].toLowerCase();
          if (card.tags?.some(tag => tag.toLowerCase().includes(colName))) {
            columnGroups[i].cards.push({ node, card });
            assigned = true;
            break;
          }
        }

        if (!assigned) {
          unassigned.push({ node, card });
        }
      }

      // Arrange cards in columns
      columnGroups.forEach((group, colIndex) => {
        const x = colIndex * columnWidth;
        group.cards.forEach((item, rowIndex) => {
          const y = rowIndex * (cardHeight + spacing);
          item.node.position({ x, y });
        });
      });

      // Put unassigned cards in a separate area
      const unassignedX = columns.length * columnWidth + 50;
      unassigned.forEach((item, index) => {
        const y = index * (cardHeight + spacing);
        item.node.position({ x: unassignedX, y });
      });

      layer.batchDraw();

      const summary = columnGroups.map((g, i) => `"${g.name}": ${g.cards.length}`).join(', ');
      return `Arrangerade kort i Kanban-kolumner: ${summary}. ${unassigned.length} kort utan kolumn-tagg.`;
    },

    arrangeCardsMindMap: async (args) => {
      const radius = args.radius || 300;

      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) {
        return 'Inga kort är markerade. Markera kort först för att arrangera dem i en mind map.';
      }

      // Find center card
      let centerNode;
      if (args.centerCardId) {
        centerNode = layer.findOne(n => n.getAttr('cardId') === args.centerCardId);
      }
      if (!centerNode) {
        centerNode = selectedNodes[0]; // Use first selected as center
      }

      // Place center card at origin
      centerNode.position({ x: 0, y: 0 });

      // Arrange other cards radially around center
      const otherNodes = selectedNodes.filter(n => n !== centerNode);
      const angleStep = (2 * Math.PI) / otherNodes.length;

      otherNodes.forEach((node, index) => {
        const angle = index * angleStep;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        node.position({ x, y });
      });

      layer.batchDraw();

      return `Arrangerade ${selectedNodes.length} kort i en radiell mind map-struktur (${otherNodes.length} kort runt centralkort).`;
    },

    arrangeCardsCluster: async (args) => {
      const method = args.method || 'tags';

      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) {
        return 'Inga kort är markerade. Markera kort först för att klustra dem.';
      }

      const cards = await getAllCards();

      if (method === 'tags') {
        // Group by most common tag
        const tagGroups = new Map();

        for (const node of selectedNodes) {
          const cardId = node.getAttr('cardId');
          const card = cards.find(c => c.id === cardId);
          if (!card || !card.tags || card.tags.length === 0) {
            // Cards without tags go to "no-tag" group
            if (!tagGroups.has('utan-tagg')) {
              tagGroups.set('utan-tagg', []);
            }
            tagGroups.get('utan-tagg').push({ node, card });
            continue;
          }

          // Use first tag as primary cluster
          const primaryTag = card.tags[0];
          if (!tagGroups.has(primaryTag)) {
            tagGroups.set(primaryTag, []);
          }
          tagGroups.get(primaryTag).push({ node, card });
        }

        // Arrange clusters spatially
        const clusterSpacing = 267;  // Reduced by 1/3 (was 400)
        const cardSpacing = 13;      // Reduced by 1/3 (was 20)
        const cardWidth = 200;
        const cardHeight = 150;

        let clusterIndex = 0;
        for (const [tag, items] of tagGroups.entries()) {
          const clusterX = (clusterIndex % 3) * clusterSpacing;
          const clusterY = Math.floor(clusterIndex / 3) * clusterSpacing;

          // Arrange cards within cluster in a grid
          items.forEach((item, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);
            const x = clusterX + col * (cardWidth + cardSpacing);
            const y = clusterY + row * (cardHeight + cardSpacing);
            item.node.position({ x, y });
          });

          clusterIndex++;
        }

        layer.batchDraw();

        const clusterSummary = Array.from(tagGroups.entries())
          .map(([tag, items]) => `"${tag}": ${items.length}`)
          .join(', ');
        return `Skapade ${tagGroups.size} kluster baserat på tags: ${clusterSummary}.`;
      } else {
        // Smart clustering would use AI/semantic similarity
        return 'Smart clustering (AI-baserad) är inte implementerad än. Använd method: "tags" istället.';
      }
    }
  };

  renderStoredConversation();

  const injectContextSnapshot = async () => {
    if (conversationHistory.length > 0) return;

    const contextSummary = prefetchedContextSummary || await buildAIContextSnapshot(toolRegistry);
    if (contextSummary) {
      addSystemMessage('📌 Förser AI:n med aktuell tavla-kontekst (komprimerad).');
      addSystemMessage('🪙 Token-sparläge: svaren ska vara korta och återanvända kontexten ovan.');
      conversationHistory.push({ role: 'system', text: contextSummary });
      conversationHistory.push({ role: 'system', text: 'Svara kortfattat (max ~120 ord). Återanvänd kontexten ovan och kalla på verktyg istället för långa resonemang.' });
      persistHistory();
    }
  };

  await injectContextSnapshot();

  // Ask handler - now with chat interface
  const sendPrompt = async (promptText = null) => {
    const query = (promptText ?? queryInput.value).trim();
    if (!query) return;

    // Add user message to chat
    addMessage(query, true);
    conversationHistory.push({ role: 'user', text: query });
    persistHistory();

    // Clear input and disable button if this is a manual send
    if (!promptText) {
      queryInput.value = '';
    }
    askBtn.disabled = true;
    askBtn.textContent = '...';

    // Show thinking message
    const thinkingMsg = addSystemMessage('🤔 Gemini tänker...');

    try {
      // Call Gemini with tools and conversation history
      const response = await executeGeminiAgent(query, tools, toolRegistry, conversationHistory);

      // Remove thinking message
      thinkingMsg.remove();

      // Add Gemini response to chat
      addMessage(response, false);
      conversationHistory.push({ role: 'assistant', text: response });
      persistHistory();

    } catch (error) {
      console.error('Gemini Assistant error:', error);

      // Remove thinking message
      thinkingMsg.remove();

      // Show error
      addSystemMessage(`❌ Fel: ${error.message}`);
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = 'Skicka';
      queryInput.focus();
    }
  };

  askBtn.addEventListener('click', () => sendPrompt());

  // Enter to submit
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendPrompt();
    }
  });

  if (intent?.prompt) {
    sendPrompt(intent.prompt);
  }
}

/**
 * Show ChatGPT Assistant dialog
 */
async function showChatGPTAssistant(options = {}) {
  const { intent = null, prefetchedContextSummary = null } = options;
  // IMPORTANT: Ensure any chooser overlays are removed when opening the panel
  const oldChooserOverlays = document.querySelectorAll('.ai-chooser-overlay');
  oldChooserOverlays.forEach(overlay => overlay.remove());

  // Create side panel (no overlay, user can see canvas) - same as Gemini
  const panel = document.createElement('div');
  panel.id = 'chatgptPanel';
  panel.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    width: 400px;
    max-width: 90vw;
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease;
  `;

  // Mobile: bottom panel instead
  if (window.innerWidth < 768 || (window.innerWidth < 1024 && window.innerHeight > window.innerWidth)) {
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60vh;
      max-height: 80vh;
      width: 100%;
      background: var(--bg-primary);
      color: var(--text-primary);
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      transition: transform 0.3s ease;
      border-radius: 16px 16px 0 0;
    `;
  }

  panel.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
        💬 ChatGPT Chat
      </h3>
      <div style="display: flex; gap: 12px;">
        <button id="chatgptSwitchModel" title="Byt AI-modell" style="background: none; border: 1px solid var(--border-color); font-size: 13px; cursor: pointer; color: var(--text-secondary); padding: 6px 10px; border-radius: 8px;">Byt</button>
        <button id="chatgptMinimize" title="Minimera (sparar konversationen)" style="background: none; border: none; font-size: 20px; cursor: pointer;
                color: var(--text-secondary); padding: 0; line-height: 1;">−</button>
        <button id="chatgptClose" title="Stäng (raderar konversationen)" style="background: none; border: none; font-size: 24px; cursor: pointer;
                color: var(--text-secondary); padding: 0; line-height: 1;">&times;</button>
      </div>
    </div>
    <div id="chatgptMessages" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    "></div>
    <div id="chatgptVoiceIndicator" style="
      display: none;
      padding: 8px 12px;
      margin: 0 16px;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff0000;
      border-radius: 8px;
      margin-bottom: 8px;
      text-align: center;
      font-size: 14px;
    ">
      🔴 Lyssnar... <span id="chatgptVoiceTranscript" style="font-style: italic;"></span>
    </div>
    <div id="chatgptInputArea" style="padding: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 8px; align-items: center;">
      <input type="text" id="chatgptQuery" placeholder="Skriv eller håll 'V' för röst..."
        style="flex: 1; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; box-sizing: border-box;" />
      <button id="chatgptVoice" style="padding: 12px; background: var(--bg-secondary);
              color: var(--text-primary); border: 2px solid var(--border-color); border-radius: 8px;
              cursor: pointer; font-size: 20px; line-height: 1; width: 48px; height: 48px;
              display: flex; align-items: center; justify-content: center;">🎤</button>
      <button id="chatgptAsk" style="padding: 12px 20px; background: var(--accent-color);
              color: white; border: none; border-radius: 8px; cursor: pointer;
              font-size: 14px; white-space: nowrap;">Skicka</button>
    </div>
  `;

  document.body.appendChild(panel);

    const queryInput = document.getElementById('chatgptQuery');
    const chatMessages = document.getElementById('chatgptMessages');
    const askBtn = document.getElementById('chatgptAsk');
    const closeBtn = document.getElementById('chatgptClose');
    const switchModelBtn = document.getElementById('chatgptSwitchModel');
    const minimizeBtn = document.getElementById('chatgptMinimize');
    const voiceBtn = document.getElementById('chatgptVoice');
    const voiceIndicator = document.getElementById('chatgptVoiceIndicator');
    const voiceTranscript = document.getElementById('chatgptVoiceTranscript');

    // Conversation history
    const conversationHistory = loadConversationHistory('chatgpt');
    const persistHistory = () => saveConversationHistory('chatgpt', conversationHistory);

  // Create minimize floating button (initially hidden)
  const floatingBtn = document.createElement('button');
  floatingBtn.id = 'chatgptFloatingBtn';
  floatingBtn.innerHTML = '💬';
  floatingBtn.title = 'Expandera ChatGPT Chat';
  floatingBtn.style.cssText = `
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-color);
    color: white;
    border: none;
    font-size: 28px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9998;
    display: none;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  `;
  floatingBtn.addEventListener('mouseenter', () => {
    floatingBtn.style.transform = 'scale(1.1)';
  });
  floatingBtn.addEventListener('mouseleave', () => {
    floatingBtn.style.transform = 'scale(1)';
  });
  document.body.appendChild(floatingBtn);

    // Minimize function
    const minimize = () => {
      persistHistory();
      panel.style.display = 'none';
      floatingBtn.style.display = 'flex';
    };

  // Expand function
  const expand = () => {
    panel.style.display = 'flex';
    floatingBtn.style.display = 'none';
    queryInput.focus();
  };

  // Focus input
  queryInput.focus();

  // Voice recognition (same as Gemini)
  let recognition = null;
  let isRecording = false;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'sv-SE';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecording = true;
      voiceIndicator.style.display = 'block';
      voiceTranscript.textContent = '';

      // Minimize input area (hide keyboard)
      const inputArea = document.getElementById('chatgptInputArea');
      inputArea.style.display = 'none';
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      voiceTranscript.textContent = transcript;

      if (event.results[0].isFinal) {
        queryInput.value = transcript;
        voiceIndicator.style.display = 'none';
      }
    };

    recognition.onend = () => {
      isRecording = false;
      voiceIndicator.style.display = 'none';

      // Restore input area
      const inputArea = document.getElementById('chatgptInputArea');
      inputArea.style.display = 'flex';
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      voiceIndicator.style.display = 'none';
      isRecording = false;

      // Restore input area
      const inputArea = document.getElementById('chatgptInputArea');
      inputArea.style.display = 'flex';

      if (event.error === 'not-allowed') {
        addSystemMessage('❌ Mikrofon-tillstånd nekades. Aktivera i webbläsaren.');
      }
    };

    voiceBtn.addEventListener('mousedown', () => {
      if (!isRecording) recognition.start();
    });

    voiceBtn.addEventListener('mouseup', () => {
      if (isRecording) recognition.stop();
    });

    voiceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!isRecording) recognition.start();
    });

    voiceBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isRecording) recognition.stop();
    });
  } else {
    voiceBtn.style.display = 'none';
    console.warn('Speech recognition not supported in this browser');
  }

  const handleVoiceKey = (e) => {
    if (e.key === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (document.activeElement !== queryInput &&
          document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!isRecording && recognition) {
          recognition.start();
        }
      }
    }
  };

  const handleVoiceKeyUp = (e) => {
    if (e.key === 'v') {
      if (isRecording && recognition) {
        recognition.stop();
      }
    }
  };

  document.addEventListener('keydown', handleVoiceKey);
  document.addEventListener('keyup', handleVoiceKeyUp);

  // Function to add message to chat
  const addMessage = (text, isUser) => {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      padding: 12px;
      border-radius: 12px;
      max-width: 85%;
      word-wrap: break-word;
      line-height: 1.5;
      ${isUser ? `
        background: var(--accent-color);
        color: white;
        align-self: flex-end;
        margin-left: auto;
      ` : `
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        align-self: flex-start;
      `}
    `;

    // Render markdown for ChatGPT responses, plain text for user messages
    if (isUser) {
      messageDiv.textContent = text;
    } else {
      const htmlContent = marked.parse(text);
      messageDiv.innerHTML = htmlContent;

      // Add styling for markdown elements
      messageDiv.querySelectorAll('p').forEach(p => p.style.margin = '0.5em 0');
      messageDiv.querySelectorAll('ul, ol').forEach(list => {
        list.style.marginLeft = '1.5em';
        list.style.marginTop = '0.5em';
        list.style.marginBottom = '0.5em';
      });
      messageDiv.querySelectorAll('li').forEach(li => li.style.marginBottom = '0.25em');
      messageDiv.querySelectorAll('strong').forEach(strong => strong.style.fontWeight = 'bold');
      messageDiv.querySelectorAll('code').forEach(code => {
        code.style.cssText = `
          background: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        `;
      });
      messageDiv.querySelectorAll('pre').forEach(pre => {
        pre.style.cssText = `
          background: var(--bg-secondary);
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 0.5em 0;
        `;
        const codeEl = pre.querySelector('code');
        if (codeEl) {
          codeEl.style.background = 'none';
          codeEl.style.padding = '0';
        }
      });
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const addSystemMessage = (text) => {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      font-style: italic;
      text-align: center;
      background: var(--bg-secondary);
    `;
    messageDiv.textContent = text;
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return messageDiv;
    };

    const renderStoredConversation = () => {
      if (!conversationHistory.length) return;

      conversationHistory.forEach(msg => {
        if (msg.role === 'assistant') {
          addMessage(msg.text, false);
        } else if (msg.role === 'user') {
          addMessage(msg.text, true);
        } else {
          addSystemMessage(msg.text);
        }
      });

      addSystemMessage(`🔁 Fortsätter tidigare chatt (${conversationHistory.length} meddelanden).`);
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };

    const cleanup = () => {
      persistHistory();
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleVoiceKey);
      document.removeEventListener('keyup', handleVoiceKeyUp);

      if (isRecording && recognition) {
        recognition.stop();
      }

      // Remove panel and floating button
      panel.remove();
      floatingBtn.remove();
    };

    closeBtn.addEventListener('click', cleanup);

    // Switch model handler
    const handleSwitchModel = async () => {
      cleanup();
      await handleAIChooserCommand(true);
    };
    switchModelBtn.addEventListener('click', handleSwitchModel);

    // Minimize button handler
    minimizeBtn.addEventListener('click', minimize);

  // Floating button handler (expand)
  floatingBtn.addEventListener('click', expand);

  document.addEventListener('keydown', handleEscape);

  // Reuse the same tools and toolRegistry from showGeminiAssistant
  // (I'll need to extract this into a shared function, but for now duplicate it)
  const tools = [{
    functionDeclarations: [
      {
        name: 'searchCards',
        description: 'Search for cards containing specific text (supports Boolean operators: AND, OR, NOT, wildcards *, ?, and proximity NEAR/N)',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (e.g., "python AND NOT tutorial*")' }
          },
          required: ['query']
        }
      },
      {
        name: 'getAllCards',
        description: 'Get all cards from the canvas',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'filterCardsByTag',
        description: 'Filter and display cards by a specific tag',
        parameters: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag name to filter by' }
          },
          required: ['tag']
        }
      },
      {
        name: 'listAllTags',
        description: 'List all unique tags across all cards with their counts. ALWAYS use this first when user asks about tags or categories!',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'filterImageCards',
        description: 'Filter cards based on whether they contain images or not',
        parameters: {
          type: 'object',
          properties: {
            hasImage: { type: 'boolean', description: 'true to show only image cards, false to show only text cards' }
          },
          required: ['hasImage']
        }
      },
      {
        name: 'filterCardsByDateRange',
        description: 'Filter cards created within a specific date range',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
          },
          required: ['startDate', 'endDate']
        }
      },
      {
        name: 'arrangeCardsGrid',
        description: 'Arrange selected cards in a grid layout',
        parameters: {
          type: 'object',
          properties: {
            columns: { type: 'number', description: 'Number of columns (default: auto)' }
          }
        }
      },
      {
        name: 'arrangeCardsTimeline',
        description: 'Arrange cards in a timeline based on dates (extractedDate or createdAt)',
        parameters: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Timeline direction' }
          }
        }
      },
      {
        name: 'arrangeCardsKanban',
        description: 'Arrange cards in Kanban columns based on tags',
        parameters: {
          type: 'object',
          properties: {
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of column names/tags (e.g., ["backlog", "todo", "pågår", "klart"])'
            }
          },
          required: ['columns']
        }
      },
      {
        name: 'arrangeCardsMindMap',
        description: 'Arrange cards in a mind map/radial layout',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'arrangeCardsCluster',
        description: 'Cluster cards by similarity (tags, content, or AI-based)',
        parameters: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['tags', 'ai'], description: 'Clustering method' }
          }
        }
      },
      {
        name: 'arrangeAllTagsInGrids',
        description: 'Arrange ALL cards grouped by their tags in separate grids (vertically stacked). USE THIS for "sort thematically" or "group all tags". No parameters needed!',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'getUpcomingCalendar',
        description: 'Get upcoming calendar events from Google Calendar for the next weeks. USE THIS to see what user has coming up!',
        parameters: {
          type: 'object',
          properties: {
            weeks: {
              type: 'number',
              description: 'Number of weeks to fetch (default: 3)'
            }
          }
        }
      },
      {
        name: 'getTodayCalendar',
        description: 'Get today\'s calendar events from Google Calendar. USE THIS for "what do I have today?" or "today\'s schedule"',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'getThisWeekCalendar',
        description: 'Get this week\'s calendar events from Google Calendar. USE THIS for "how does my week look?"',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'createCardsFromCalendar',
        description: 'Create cards from Google Calendar events. Does NOT create duplicates - checks calendarEventId. USE THIS for "import my calendar" or "create cards from my meetings"',
        parameters: {
          type: 'object',
          properties: {
            weeks: {
              type: 'number',
              description: 'Number of weeks ahead to fetch events from (default: 2)'
            }
          }
        }
      },
      {
        name: 'arrangeCardsByDay',
        description: 'Arrange cards in WEEKLY SCHEDULE where each day is a column. Perfect for visualizing calendar! USE THIS for "show as weekly schedule", "organize by day" or "create week view"',
        parameters: {
          type: 'object',
          properties: {
            weeks: {
              type: 'number',
              description: 'Number of weeks to show (default: 2)'
            },
            useExtractedDate: {
              type: 'boolean',
              description: 'Use Gemini-extracted dates instead of creation date (default: true)'
            }
          }
        }
      },
      {
        name: 'applySchoolColorScheme',
        description: 'Apply PRESET color scheme for SCHOOL SUBJECTS. Ma=blue, SV=yellow, Eng=red, lunch=white, etc. ALWAYS USE this for school schedule! USE for "color the schedule", "apply colors" or after importing calendar',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'colorCardsByPattern',
        description: 'Color cards based on text patterns. All cards containing "lunch" get same color, all "important" get another color etc. USE THIS for "color all lunch meetings" or "make all SV cards blue"',
        parameters: {
          type: 'object',
          properties: {
            patterns: {
              type: 'array',
              description: 'Array of patterns and colors. Example: [{pattern: "lunch", color: "#ffeb3b"}, {pattern: "important", color: "#f44336"}, {pattern: "Ma", color: "#2196f3"}]',
              items: {
                type: 'object',
                properties: {
                  pattern: { type: 'string', description: 'Text string to search for (case-insensitive)' },
                  color: { type: 'string', description: 'Hex color code (e.g. #ff0000 for red)' }
                },
                required: ['pattern', 'color']
              }
            }
          },
          required: ['patterns']
        }
      }
    ]
  }];

  const toolRegistry = {
    searchCards: async ({ query }) => {
      // Import and call search function
      const searchBar = document.getElementById('search-input');
      if (searchBar) {
        searchBar.value = query;
        const event = new Event('input', { bubbles: true });
        searchBar.dispatchEvent(event);
        const cards = await getAllCards();
        const selectedNodes = layer.find('.selected');
        return `Found ${selectedNodes.length} cards matching "${query}"`;
      }
      return 'Search not available';
    },

    getAllCards: async () => {
      const cards = await getAllCards();
      return cards.map(c => ({
        id: c.id,
        text: c.text?.substring(0, 100),
        tags: c.tags,
        hasImage: !!c.image,
        createdAt: c.createdAt
      }));
    },

    filterCardsByTag: async ({ tag }) => {
      const cards = await getAllCards();
      const filtered = cards.filter(c => c.tags?.includes(tag));

      // Select matching cards on canvas
      layer.find('.card').forEach(node => {
        const cardId = node.getAttr('cardId');
        if (filtered.some(c => c.id === cardId)) {
          node.setAttr('selected', true);
          node.findOne('.selectIndicator')?.visible(true);
        }
      });
      layer.batchDraw();

      return `Selected ${filtered.length} cards with tag "${tag}"`;
    },

    listAllTags: async () => {
      const cards = await getAllCards();
      const tagCounts = {};
      cards.forEach(c => {
        (c.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => `${tag} (${count})`);
      return sortedTags.length > 0 ? sortedTags : ['No tags found'];
    },

    filterImageCards: async ({ hasImage }) => {
      const cards = await getAllCards();
      const filtered = cards.filter(c => !!c.image === hasImage);

      layer.find('.card').forEach(node => {
        const cardId = node.getAttr('cardId');
        if (filtered.some(c => c.id === cardId)) {
          node.setAttr('selected', true);
          node.findOne('.selectIndicator')?.visible(true);
        }
      });
      layer.batchDraw();

      return `Selected ${filtered.length} ${hasImage ? 'image' : 'text'} cards`;
    },

    filterCardsByDateRange: async ({ startDate, endDate }) => {
      const cards = await getAllCards();
      const start = new Date(startDate);
      const end = new Date(endDate);

      const filtered = cards.filter(c => {
        const date = c.geminiMetadata?.extractedDate
          ? new Date(c.geminiMetadata.extractedDate)
          : new Date(c.createdAt);
        return date >= start && date <= end;
      });

      layer.find('.card').forEach(node => {
        const cardId = node.getAttr('cardId');
        if (filtered.some(c => c.id === cardId)) {
          node.setAttr('selected', true);
          node.findOne('.selectIndicator')?.visible(true);
        }
      });
      layer.batchDraw();

      return `Selected ${filtered.length} cards from ${startDate} to ${endDate}`;
    },

    arrangeCardsGrid: async (args) => {
      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) return 'No cards selected';
      await arrangeGrid(selectedNodes, args.columns);
      return `Arranged ${selectedNodes.length} cards in grid`;
    },

    arrangeCardsTimeline: async ({ direction = 'horizontal' }) => {
      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) return 'No cards selected';
      const cards = await getAllCards();
      // Sort by date and arrange
      const sortedNodes = selectedNodes.toArray().sort((a, b) => {
        const cardA = cards.find(c => c.id === a.getAttr('cardId'));
        const cardB = cards.find(c => c.id === b.getAttr('cardId'));
        const dateA = cardA?.geminiMetadata?.extractedDate || cardA?.createdAt;
        const dateB = cardB?.geminiMetadata?.extractedDate || cardB?.createdAt;
        return new Date(dateA) - new Date(dateB);
      });
      if (direction === 'horizontal') {
        await arrangeHorizontal(sortedNodes);
      } else {
        await arrangeVertical(sortedNodes);
      }
      return `Arranged ${selectedNodes.length} cards in ${direction} timeline`;
    },

    arrangeCardsKanban: async ({ columns }) => {
      const cards = await getAllCards();
      const columnGroups = {};

      columns.forEach(col => {
        columnGroups[col] = cards.filter(c => c.tags?.includes(col));
      });

      // Arrange each column
      let xOffset = 100;
      for (const col of columns) {
        const columnCards = columnGroups[col];
        const nodes = columnCards.map(c => {
          return layer.find('.card').find(n => n.getAttr('cardId') === c.id);
        }).filter(n => n);

        if (nodes.length > 0) {
          await arrangeVertical(nodes, { x: xOffset, y: 100 });
          xOffset += 350;
        }
      }

      return `Arranged cards in Kanban with columns: ${columns.join(', ')}`;
    },

    arrangeCardsMindMap: async () => {
      const selectedNodes = layer.find('.selected');
      if (selectedNodes.length === 0) return 'No cards selected';
      await arrangeCircle(selectedNodes);
      return `Arranged ${selectedNodes.length} cards in mind map`;
    },

    arrangeCardsCluster: async ({ method = 'tags' }) => {
      if (method === 'ai') {
        return 'Smart clustering (AI-baserad) är inte implementerad än. Använd method: "tags" istället.';
      }
      // Simple tag-based clustering
      const cards = await getAllCards();
      const clusters = {};
      cards.forEach(c => {
        const primaryTag = c.tags?.[0] || 'untagged';
        if (!clusters[primaryTag]) clusters[primaryTag] = [];
        clusters[primaryTag].push(c);
      });

      let xOffset = 100;
      for (const [tag, clusterCards] of Object.entries(clusters)) {
        const nodes = clusterCards.map(c => {
          return layer.find('.card').find(n => n.getAttr('cardId') === c.id);
        }).filter(n => n);

        if (nodes.length > 0) {
          await arrangeGrid(nodes, 3, { x: xOffset, y: 100 });
          xOffset += 600;
        }
      }

      return `Clustered cards into ${Object.keys(clusters).length} groups by tags`;
    },

    arrangeAllTagsInGrids: async () => {
      console.log('🔍 [ChatGPT] arrangeAllTagsInGrids: Starting...');

      // Get all unique tags
      const cards = await getAllCards();
      console.log(`📦 [ChatGPT] Found ${cards.length} cards in database`);

      const tagCounts = new Map();
      for (const card of cards) {
        if (card.tags && Array.isArray(card.tags)) {
          for (const tag of card.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }

      const tags = Array.from(tagCounts.keys());
      console.log(`🏷️ [ChatGPT] Found ${tags.length} unique tags:`, tags);

      if (tags.length === 0) {
        return 'No tags found.';
      }

      // Constants for layout
      const cardWidth = 200;
      const cardHeight = 150;
      const columns = 4;
      const spacing = 13;   // Reduced by 1/3 (was 20)
      const gridGap = 67;   // Reduced by 1/3 (was 100)

      let currentY = 0;
      let arrangedCount = 0;

      // Arrange each tag group
      for (const tag of tags) {
        // Filter cards by this tag
        const matchingCards = cards.filter(c => c.tags && c.tags.includes(tag));
        console.log(`🏷️ [ChatGPT] Tag "${tag}": ${matchingCards.length} cards`);

        if (matchingCards.length === 0) continue;

        // Find and arrange these cards
        matchingCards.forEach((card, index) => {
          const node = layer.findOne(n => n.getAttr('cardId') === card.id);
          if (node) {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const x = col * (cardWidth + spacing);
            const y = currentY + row * (cardHeight + spacing);

            console.log(`  ➡️ [ChatGPT] Moving card ${card.id} to (${x}, ${y})`);
            node.position({ x, y });
            arrangedCount++;
          } else {
            console.warn(`  ⚠️ [ChatGPT] Node not found for card ${card.id}`);
          }
        });

        // Move to next group position
        const rows = Math.ceil(matchingCards.length / columns);
        currentY += rows * (cardHeight + spacing) + gridGap;
      }

      console.log(`✅ [ChatGPT] Calling layer.batchDraw() for ${arrangedCount} cards`);
      layer.batchDraw();

      return `Arranged ${arrangedCount} cards in ${tags.length} tag groups (vertically with ${gridGap}px spacing).`;
    },

    getUpcomingCalendar: async (args) => {
      const weeks = args.weeks || 3;
      try {
        const events = await getUpcomingCalendarEvents(weeks);
        return formatEventsForAI(events);
      } catch (error) {
        return `Could not fetch calendar events: ${error.message}. Make sure you have connected Google Calendar (same Client ID as Drive).`;
      }
    },

    getTodayCalendar: async () => {
      try {
        const events = await getTodayCalendarEvents();
        return formatEventsForAI(events);
      } catch (error) {
        return `Could not fetch today's events: ${error.message}`;
      }
    },

    getThisWeekCalendar: async () => {
      try {
        const events = await getThisWeekCalendarEvents();
        return formatEventsForAI(events);
      } catch (error) {
        return `Could not fetch this week's events: ${error.message}`;
      }
    },

    createCardsFromCalendar: async (args) => {
      const weeks = args.weeks || 2;
      try {
        // Get calendar events
        const events = await getUpcomingCalendarEvents(weeks);

        if (!events || events.length === 0) {
          return 'No calendar events found.';
        }

        // Get all existing cards
        const existingCards = await getAllCards();

        // Find which events already have cards
        const existingEventIds = new Set(
          existingCards
            .filter(c => c.calendarEventId)
            .map(c => c.calendarEventId)
        );

        // Filter to only new events
        const newEvents = events.filter(e => !existingEventIds.has(e.id));

        if (newEvents.length === 0) {
          return `All ${events.length} calendar events already have cards. No new cards created.`;
        }

        // Create cards for new events
        let createdCount = 0;
        const createdCards = [];

        for (const event of newEvents) {
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);

          // Format card text
          let cardText = `📅 ${event.summary}\n\n`;
          cardText += `⏰ ${startDate.toLocaleString('sv-SE', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`;

          if (!event.isAllDay) {
            cardText += ` - ${endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
          }

          if (event.location) {
            cardText += `\n📍 ${event.location}`;
          }

          if (event.description) {
            cardText += `\n\n${event.description}`;
          }

          if (event.attendees && event.attendees.length > 0) {
            cardText += `\n\n👥 ${event.attendees.length} deltagare`;
          }

          // Create the card with automatic color detection
          const autoColor = getColorFromText(event.summary);
          const defaultColor = event.isAllDay ? '#e3f2fd' : '#fff3e0';

          const newCard = await createCard({
            text: cardText,
            x: 100 + (createdCount % 5) * 250, // Spread cards horizontally
            y: 100 + Math.floor(createdCount / 5) * 200,
            tags: ['calendar', 'meeting'],
            cardColor: autoColor || defaultColor, // Use subject color if found, otherwise default
            calendarEventId: event.id, // Store the calendar event ID!
            calendarEventLink: event.htmlLink,
            eventDate: event.start // Store event date for sorting
          });

          createdCards.push(newCard);
          createdCount++;
        }

        // Reload canvas to show new cards
        await reloadCanvas();

        return `Created ${createdCount} new cards from calendar (${events.length - createdCount} events already had cards). New cards are tagged with 'calendar' and 'meeting'.`;

      } catch (error) {
        console.error('Error creating cards from calendar:', error);
        return `Could not create cards from calendar: ${error.message}`;
      }
    },

    applySchoolColorScheme: async () => {
      const schoolColors = [
        {patterns: ["ma", "matematik"], color: "#2196f3"},           // Matematik - blå
        {patterns: ["sv", "svenska"], color: "#ffeb3b"},             // Svenska - gul
        {patterns: ["no", "naturorientering"], color: "#4caf50"},    // NO - grön
        {patterns: ["eng", "engelska"], color: "#f44336"},           // Engelska - röd
        {patterns: ["bi", "bild"], color: "#9c27b0"},                // Bild - lila
        {patterns: ["tk", "teknik"], color: "#9e9e9e"},              // Teknik - grå
        {patterns: ["spanska", "språk"], color: "#ff9800"},          // Spanska/språk - orange
        {patterns: ["idh", "idrott"], color: "#e91e63"},             // Idrott - rosa
        {patterns: ["so", "samhällskunskap"], color: "#ef9a9a"},     // SO - ljusröd
        {patterns: ["sl", "slöjd"], color: "#fff59d"},               // Slöjd - ljusgul
        {patterns: ["mu", "musik"], color: "#a5d6a7"},               // Musik - ljusgrön
        {patterns: ["hkk"], color: "#a5d6a7"},                       // HKK - ljusgrön
        {patterns: ["lunch"], color: "#ffffff"}                      // Lunch - vit
      ];

      try {
        const cards = await getAllCards();
        let coloredCount = 0;
        const colorSummary = {};

        for (const {patterns, color} of schoolColors) {
          const matchingCards = cards.filter(card => {
            const text = (card.text || '').toLowerCase();
            const backText = (card.backText || '').toLowerCase();
            const tags = (card.tags || []).join(' ').toLowerCase();
            const searchText = `${text} ${backText} ${tags}`;

            // Check if any pattern matches
            return patterns.some(pattern => {
              const regex = new RegExp(`\\b${pattern}\\b`, 'i');
              return regex.test(searchText);
            });
          });

          if (matchingCards.length > 0) {
            colorSummary[patterns[0]] = matchingCards.length;

            for (const card of matchingCards) {
              await updateCard(card.id, { cardColor: color });
              coloredCount++;

              const node = layer.findOne(n => n.getAttr('cardId') === card.id);
              if (node) {
                const cardRect = node.findOne('Rect');
                if (cardRect) {
                  cardRect.fill(color);
                }
              }
            }
          }
        }

        layer.batchDraw();

        let summary = `Applied school color scheme to ${coloredCount} cards:\n`;
        for (const [pattern, count] of Object.entries(colorSummary)) {
          summary += `- ${pattern}: ${count} cards\n`;
        }

        return summary;

      } catch (error) {
        console.error('Error applying school color scheme:', error);
        return `Could not apply color scheme: ${error.message}`;
      }
    },

    colorCardsByPattern: async (args) => {
      const patterns = args.patterns || [];

      if (patterns.length === 0) {
        return 'No color patterns provided. Example: [{pattern: "lunch", color: "#ffeb3b"}, {pattern: "important", color: "#f44336"}]';
      }

      try {
        const cards = await getAllCards();
        let coloredCount = 0;
        const colorSummary = {};

        for (const {pattern, color} of patterns) {
          const matchingCards = cards.filter(card => {
            const text = (card.text || '').toLowerCase();
            const backText = (card.backText || '').toLowerCase();
            const tags = (card.tags || []).join(' ').toLowerCase();
            const searchText = `${text} ${backText} ${tags}`;
            return searchText.includes(pattern.toLowerCase());
          });

          colorSummary[pattern] = matchingCards.length;

          for (const card of matchingCards) {
            await updateCard(card.id, { cardColor: color });
            coloredCount++;

            const node = layer.findOne(n => n.getAttr('cardId') === card.id);
            if (node) {
              const cardRect = node.findOne('Rect');
              if (cardRect) {
                cardRect.fill(color);
              }
            }
          }
        }

        layer.batchDraw();

        let summary = `Colored ${coloredCount} cards:\n`;
        for (const [pattern, count] of Object.entries(colorSummary)) {
          summary += `- "${pattern}": ${count} cards\n`;
        }

        return summary;

      } catch (error) {
        console.error('Error coloring cards:', error);
        return `Could not color cards: ${error.message}`;
      }
    },

    arrangeCardsByDay: async (args) => {
      const weeks = args.weeks || 2;
      const useExtractedDate = args.useExtractedDate !== false;

      try {
        const cards = await getAllCards();
        const cardsByDate = new Map();

        for (const card of cards) {
          let dateStr = null;

          if (card.eventDate) {
            // Calendar event date (prioritize this)
            const date = new Date(card.eventDate);
            dateStr = date.toISOString().split('T')[0];
          } else if (useExtractedDate && card.geminiMetadata?.extractedDateTime) {
            const date = new Date(card.geminiMetadata.extractedDateTime);
            dateStr = date.toISOString().split('T')[0];
          } else if (useExtractedDate && card.geminiMetadata?.extractedDate) {
            const date = new Date(card.geminiMetadata.extractedDate);
            dateStr = date.toISOString().split('T')[0];
          } else if (card.created) {
            const date = new Date(card.created);
            dateStr = date.toISOString().split('T')[0];
          }

          if (dateStr) {
            if (!cardsByDate.has(dateStr)) {
              cardsByDate.set(dateStr, []);
            }
            cardsByDate.get(dateStr).push(card);
          }
        }

        if (cardsByDate.size === 0) {
          return 'No cards with dates found to arrange.';
        }

        const sortedDates = Array.from(cardsByDate.keys()).sort();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weeksInMs = weeks * 7 * 24 * 60 * 60 * 1000;
        const endDate = new Date(today.getTime() + weeksInMs);

        const filteredDates = sortedDates.filter(dateStr => {
          const date = new Date(dateStr);
          return date >= today && date <= endDate;
        });

        const datesToShow = filteredDates.length > 0 ? filteredDates : sortedDates.slice(0, weeks * 7);

        const columnWidth = 210;   // Tighter columns (was 250)
        const columnSpacing = 10;  // Much tighter spacing (was 20)
        const cardHeight = 160;
        const cardSpacing = 10;    // Reduced by 1/3 (was 15)
        const headerHeight = 80;
        const startX = 50;
        const startY = 50;

        let arrangedCount = 0;

        datesToShow.forEach((dateStr, dayIndex) => {
          const cardsForDay = cardsByDate.get(dateStr) || [];
          const x = startX + dayIndex * (columnWidth + columnSpacing);

          cardsForDay.forEach((card, cardIndex) => {
            const node = layer.findOne(n => n.getAttr('cardId') === card.id);
            if (node) {
              const y = startY + headerHeight + cardIndex * (cardHeight + cardSpacing);
              node.position({ x, y });
              arrangedCount++;
            }
          });
        });

        layer.batchDraw();

        const weekCount = Math.ceil(datesToShow.length / 7);
        return `Arranged ${arrangedCount} cards in weekly schedule over ${datesToShow.length} days (~${weekCount} weeks). Each column = one day.`;

      } catch (error) {
        console.error('Error arranging cards by day:', error);
        return `Could not arrange cards by day: ${error.message}`;
      }
      }
    };

    renderStoredConversation();

    const injectContextSnapshot = async () => {
      if (conversationHistory.length > 0) return;

      const contextSummary = prefetchedContextSummary || await buildAIContextSnapshot(toolRegistry);
      if (contextSummary) {
        addSystemMessage('📌 Förser AI:n med aktuell tavla-kontekst (komprimerad).');
        addSystemMessage('🪙 Token-sparläge: svara kort och återanvänd kontexten.');
        conversationHistory.push({ role: 'system', text: contextSummary });
        conversationHistory.push({ role: 'system', text: 'Svara kortfattat (max ~120 ord). Använd verktyg istället för långa utläggningar.' });
        persistHistory();
      }
    };

    await injectContextSnapshot();

    // Ask handler
    const sendPrompt = async (promptText = null) => {
      const query = (promptText ?? queryInput.value).trim();
      if (!query) return;

      addMessage(query, true);
      conversationHistory.push({ role: 'user', text: query });
      persistHistory();

      if (!promptText) {
        queryInput.value = '';
      }
      askBtn.disabled = true;
      askBtn.textContent = '...';

      const thinkingMsg = addSystemMessage('💭 ChatGPT tänker...');

      try {
        const response = await executeChatGPTAgent(query, tools, toolRegistry, conversationHistory);

        thinkingMsg.remove();

        addMessage(response, false);
        conversationHistory.push({ role: 'assistant', text: response });
        persistHistory();

      } catch (error) {
        console.error('ChatGPT Assistant error:', error);

        thinkingMsg.remove();

        addSystemMessage(`❌ Fel: ${error.message}`);
      } finally {
        askBtn.disabled = false;
        askBtn.textContent = 'Skicka';
        queryInput.focus();
      }
    };

  askBtn.addEventListener('click', () => sendPrompt());

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendPrompt();
    }
  });

  if (intent?.prompt) {
    sendPrompt(intent.prompt);
  }
}

/**
 * Show command palette
 */

function showCommandPalette() {
  const commands = getCommands().filter(cmd => typeof cmd.handler === 'function');
  if (commands.length === 0) return;

  const overlay = document.createElement('div');
  overlay.dataset.commandPalette = 'overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 10000;
    padding-top: 80px;
    overflow-y: auto;
  `;

  const palette = document.createElement('div');
  palette.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-height: 80vh;
    overflow-y: auto;
  `;

  let handleKeyboard;

  const cleanup = () => {
    if (overlay && overlay.parentNode) {
      document.body.removeChild(overlay);
    }
    if (handleKeyboard) {
      document.removeEventListener('keydown', handleKeyboard);
    }
  };

  const descriptionFor = (cmd) => cmd.description || cmd.desc || '';

  const commandsWithIndex = commands.map((cmd, idx) => ({
    ...cmd,
    originalIndex: idx,
    keyLabel: formatKeyBindings(cmd) || cmd.keyBinding || ''
  }));

  const renderCommands = (filteredCommands) => {
    const commandList = palette.querySelector('#command-list');
    commandList.innerHTML = filteredCommands.map((cmd) => `
      <div class="command-item" data-original-index="${cmd.originalIndex}" style="
        padding: 16px;
        background: ${cmd.handler ? '#f5f5f5' : '#fafafa'};
        border-radius: 8px;
        cursor: ${cmd.handler ? 'pointer' : 'default'};
        transition: all 0.15s;
        border: 2px solid transparent;
        display: flex;
        align-items: center;
        gap: 16px;
      ">
        <div style="font-size: 24px; flex-shrink: 0;">
          ${cmd.icon || '⌘'}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 16px; color: #1a1a1a; margin-bottom: 2px;">
            ${cmd.name || cmd.id}
          </div>
          <div style="font-size: 13px; color: #666;">
            ${descriptionFor(cmd)}
          </div>
        </div>
        <div style="
          background: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          font-family: monospace;
          white-space: nowrap;
          flex-shrink: 0;
        ">
          ${cmd.keyLabel || '—'}
        </div>
      </div>
    `).join('');

    const commandItems = commandList.querySelectorAll('.command-item');
    commandItems.forEach((item, index) => {
      const cmd = filteredCommands[index];

      if (cmd?.handler) {
        item.addEventListener('mouseenter', () => {
          item.style.background = '#e3f2fd';
          item.style.borderColor = '#2196F3';
          item.style.transform = 'scale(1.01)';
        });

        item.addEventListener('mouseleave', () => {
          item.style.background = '#f5f5f5';
          item.style.borderColor = 'transparent';
          item.style.transform = 'scale(1)';
        });

        item.addEventListener('click', async () => {
          cleanup();
          await cmd.handler({ source: 'palette' });
        });
      }
    });
  };

  palette.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 24px; color: #1a1a1a;">
        ⌘ Command Palette
      </h2>
      <span style="color: #999; font-size: 14px;">Tryck ESC för att stänga</span>
    </div>

    <input
      type="text"
      id="command-search"
      placeholder="Sök kommandon..."
      style="
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        margin-bottom: 16px;
        outline: none;
        transition: border-color 0.15s;
      "
    />

    <div id="command-list" style="display: flex; flex-direction: column; gap: 8px;">
    </div>
  `;

  overlay.appendChild(palette);
  document.body.appendChild(overlay);

  let selectedIndex = -1;
  let currentCommands = commandsWithIndex;

  renderCommands(currentCommands);

  const highlightCommand = (index) => {
    const commandList = palette.querySelector('#command-list');
    const items = commandList.querySelectorAll('.command-item');

    items.forEach((item, idx) => {
      if (idx === index) {
        item.style.background = '#e3f2fd';
        item.style.borderColor = '#2196F3';
        item.style.transform = 'scale(1.01)';
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        const originalCmd = currentCommands[idx];
        item.style.background = originalCmd?.handler ? '#f5f5f5' : '#fafafa';
        item.style.borderColor = 'transparent';
        item.style.transform = 'scale(1)';
      }
    });
  };

  const searchInput = palette.querySelector('#command-search');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      currentCommands = commandsWithIndex;
      renderCommands(commandsWithIndex);
      selectedIndex = -1;
      return;
    }

    const filtered = commandsWithIndex.filter(cmd =>
      (cmd.name || '').toLowerCase().includes(query) ||
      descriptionFor(cmd).toLowerCase().includes(query) ||
      (cmd.keyLabel || '').toLowerCase().includes(query) ||
      (cmd.category || '').toLowerCase().includes(query)
    );

    currentCommands = filtered;
    renderCommands(filtered);
    selectedIndex = -1;
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'ArrowDown') {
      e.preventDefault();
      searchInput.blur();
      selectedIndex = -1;
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      document.dispatchEvent(downEvent);
    }
  });

  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = '#2196F3';
  });
  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = '#e0e0e0';
  });

  handleKeyboard = async (e) => {
    if (e.key === 'Escape') {
      cleanup();
      return;
    }

    const isTypingInSearch = document.activeElement === searchInput;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const actionableCommands = currentCommands.filter(cmd => cmd.handler);
      if (actionableCommands.length === 0) return;

      let nextIndex = selectedIndex;
      do {
        nextIndex = (nextIndex + 1) % currentCommands.length;
      } while (!currentCommands[nextIndex]?.handler && nextIndex !== selectedIndex);

      selectedIndex = nextIndex;
      highlightCommand(selectedIndex);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const actionableCommands = currentCommands.filter(cmd => cmd.handler);
      if (actionableCommands.length === 0) return;

      let prevIndex = selectedIndex;
      do {
        prevIndex = prevIndex <= 0 ? currentCommands.length - 1 : prevIndex - 1;
      } while (!currentCommands[prevIndex]?.handler && prevIndex !== selectedIndex);

      selectedIndex = prevIndex;
      highlightCommand(selectedIndex);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < currentCommands.length) {
        const selectedCmd = currentCommands[selectedIndex];
        if (selectedCmd?.handler) {
          cleanup();
          document.removeEventListener('keydown', handleKeyboard);
          await selectedCmd.handler({ source: 'palette' });
          return;
        }
      }
      return;
    }

    if (e.key === '/' && !isTypingInSearch) {
      e.preventDefault();
      searchInput.focus();
      return;
    }

    if (isTypingInSearch) {
      e.stopPropagation();
      return;
    }
  };
  document.addEventListener('keydown', handleKeyboard);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cleanup();
    }
  });
}

/**
 * Show quality selector dialog
 */
function showQualityDialog(fileCount) {
  return new Promise((resolve) => {
    // Create modal overlay
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
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    dialog.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #1a1a1a;">
        Välj kvalitet
      </h2>
      <p style="margin: 0 0 24px 0; color: #666; font-size: 16px;">
        ${fileCount} ${fileCount === 1 ? 'bild vald' : 'bilder valda'}
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="quality-normal" style="
          padding: 20px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: transform 0.1s;
        ">
          <div style="font-size: 18px; margin-bottom: 4px;">📸 Normal (rekommenderad)</div>
          <div style="font-size: 14px; opacity: 0.9;">900px, bra balans för A7-kort</div>
        </button>

        <button id="quality-high" style="
          padding: 20px;
          background: #FF9800;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: transform 0.1s;
        ">
          <div style="font-size: 18px; margin-bottom: 4px;">🔍 Hög (för OCR)</div>
          <div style="font-size: 14px; opacity: 0.9;">1200px, bäst för AI-textigenkänning</div>
        </button>

        <button id="quality-low" style="
          padding: 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: transform 0.1s;
        ">
          <div style="font-size: 18px; margin-bottom: 4px;">✍️ Låg (snabbt)</div>
          <div style="font-size: 14px; opacity: 0.9;">600px, mindre filstorlek</div>
        </button>

        <button id="quality-original" style="
          padding: 20px;
          background: #9C27B0;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: transform 0.1s;
        ">
          <div style="font-size: 18px; margin-bottom: 4px;">⭐ Original</div>
          <div style="font-size: 14px; opacity: 0.9;">Ingen komprimering - kan bli stort!</div>
        </button>

        <button id="quality-cancel" style="
          padding: 12px;
          background: transparent;
          color: #666;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        ">
          Avbryt
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add hover effects
    const buttons = dialog.querySelectorAll('button[id^="quality-"]');
    buttons.forEach(btn => {
      if (btn.id !== 'quality-cancel') {
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'scale(1.02)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'scale(1)';
        });
      }
    });

    // Handle button clicks
    const cleanup = (quality) => {
      document.body.removeChild(overlay);
      resolve(quality);
    };

    dialog.querySelector('#quality-high').addEventListener('click', () => cleanup('high'));
    dialog.querySelector('#quality-normal').addEventListener('click', () => cleanup('normal'));
    dialog.querySelector('#quality-low').addEventListener('click', () => cleanup('low'));
    dialog.querySelector('#quality-original').addEventListener('click', () => cleanup('original'));
    dialog.querySelector('#quality-cancel').addEventListener('click', () => cleanup(null));

    // ESC to cancel
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        cleanup(null);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Setup drag-and-drop for images
 */
export function setupImageDragDrop() {
  const container = stage.container();

  // Prevent default drag behavior
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.border = '3px dashed #2196F3';
  });

  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.border = 'none';
  });

  // Handle drop
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.style.border = 'none';

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));

    if (files.length === 0) return;

    try {
      // Show quality selector dialog
      const quality = await showQualityDialog(files.length);
      if (!quality) return;

      for (const file of files) {
        const processed = await processImage(file, quality);

        // Get drop position
        const pointer = stage.getPointerPosition();
        const scale = stage.scaleX();
        const position = {
          x: (pointer.x - stage.x()) / scale,
          y: (pointer.y - stage.y()) / scale
        };

        await createCard({
          text: processed.metadata.fileName,
          tags: ['bild'],
          position,
          image: {
            base64: processed.base64,
            width: processed.metadata.width,
            height: processed.metadata.height,
            quality: processed.metadata.quality
          },
          metadata: processed.metadata
        });
      }

      await reloadCanvas();
    } catch (error) {
      console.error('Drag-drop import failed:', error);
      alert('Misslyckades att importera bild: ' + error.message);
    }
  });

  console.log('Drag-and-drop enabled for images');
}

/**
 * Fit all cards in view
 */
export function fitAllCards() {
  // ALWAYS fit ALL cards (like v2's cy.fit(null, 50))
  const cards = layer.getChildren().filter(node => node.getAttr('cardId'));

  if (cards.length === 0) {
    console.log('No cards to fit');
    return;
  }

  // Calculate bounding box for all cards
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  cards.forEach(card => {
    const box = card.getClientRect();
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  });

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  // Add fixed padding (50px like v2)
  const padding = 50;
  const paddedWidth = contentWidth + padding * 2;
  const paddedHeight = contentHeight + padding * 2;

  // Calculate scale to fit
  const scaleX = stage.width() / paddedWidth;
  const scaleY = stage.height() / paddedHeight;
  const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x

  // Calculate center of content
  const contentCenterX = minX + contentWidth / 2;
  const contentCenterY = minY + contentHeight / 2;

  // Set new scale
  stage.scale({ x: scale, y: scale });

  // Center the content in the stage
  stage.position({
    x: stage.width() / 2 - contentCenterX * scale,
    y: stage.height() / 2 - contentCenterY * scale
  });

  stage.batchDraw();
  console.log('Fitted and centered all cards in view');
}

// ============================================================================
// SECTION 10: SEARCH (Boolean Search, Wildcards, Proximity)
// ============================================================================

/**
 * Normalize search query (trim, lowercase) and guard against invalid inputs
 */
export function normalizeSearchQuery(query) {
  if (typeof query !== 'string') return '';
  return query.trim().toLowerCase();
}

/**
 * Build the searchable text payload for a card
 */
export function buildCardSearchText(card) {
  const text = (card.text || '').toLowerCase();
  const backText = (card.backText || '').toLowerCase();
  const tags = (card.tags || []).join(' ').toLowerCase();
  return [text, backText, tags].join(' ').trim();
}

/**
 * Check if term matches with wildcard support
 */
export function matchWithWildcard(term, searchableText) {
  if (term.includes('*')) {
    // Convert wildcard to regex
    const regexPattern = term.replace(/\*/g, '.*');
    const regex = new RegExp('\\b' + regexPattern + '\\b', 'i');
    return regex.test(searchableText);
  }
  return searchableText.includes(term);
}

/**
 * Check proximity search (NEAR/x or N/x)
 */
export function checkProximity(query, searchableText) {
  // Match patterns like "word1 near/5 word2" or "word1 n/5 word2"
  const proximityMatch = query.match(/(.+?)\s+(near|n)\/(\d+)\s+(.+)/i);
  if (!proximityMatch) return false;

  const term1 = proximityMatch[1].trim();
  const distance = parseInt(proximityMatch[3]);
  const term2 = proximityMatch[4].trim();

  // Split text into words
  const normalizedText = typeof searchableText === 'string' ? searchableText.toLowerCase() : '';
  const words = normalizedText.split(/\s+/);

  // Find positions of both terms
  const positions1 = [];
  const positions2 = [];

  words.forEach((word, index) => {
    if (matchWithWildcard(term1, word)) positions1.push(index);
    if (matchWithWildcard(term2, word)) positions2.push(index);
  });

  // Check if any pair is within distance
  for (const pos1 of positions1) {
    for (const pos2 of positions2) {
      if (Math.abs(pos1 - pos2) <= distance) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluate boolean search query
 * Supports: OR, AND, NOT, "exact phrases", *, ( ), NEAR/x, N/x
 */
export function evaluateBooleanQuery(query, searchableText) {
  const normalizedQuery = normalizeSearchQuery(query);
  const normalizedText = typeof searchableText === 'string' ? searchableText.toLowerCase() : '';

  if (!normalizedQuery) {
    console.log('[evaluateBooleanQuery] Empty or invalid query provided');
    return false;
  }

  // Handle different boolean operators
  console.log('[evaluateBooleanQuery] Query:', normalizedQuery, 'SearchableText:', normalizedText.substring(0, 50));

  // Handle parentheses (highest precedence)
  if (normalizedQuery.includes('(')) {
    // Find matching parentheses and evaluate recursively
    const parenMatch = normalizedQuery.match(/\(([^()]+)\)/);
    if (parenMatch) {
      const innerQuery = parenMatch[1];
      const innerResult = evaluateBooleanQuery(innerQuery, normalizedText);
      // Replace the parentheses group with result placeholder
      const replaced = normalizedQuery.replace(parenMatch[0], innerResult ? '__TRUE__' : '__FALSE__');
      return evaluateBooleanQuery(replaced, normalizedText);
    }
  }

  // Handle result placeholders from parentheses
  if (normalizedQuery === '__TRUE__') return true;
  if (normalizedQuery === '__FALSE__') return false;

  // Handle proximity search (NEAR/x or N/x)
  if (/\s+(near|n)\/\d+\s+/i.test(normalizedQuery)) {
    return checkProximity(normalizedQuery, normalizedText);
  }

  // Split by OR first (lowest precedence)
  if (normalizedQuery.includes(' or ')) {
    const orParts = normalizedQuery.split(' or ');
    console.log('[evaluateBooleanQuery] OR parts:', orParts);
    return orParts.some(part => evaluateBooleanQuery(part.trim(), normalizedText));
  }

  // Handle NOT operations
  if (normalizedQuery.includes(' not ')) {
    const notIndex = normalizedQuery.indexOf(' not ');
    const beforeNot = normalizedQuery.substring(0, notIndex).trim();
    const afterNot = normalizedQuery.substring(notIndex + 5).trim(); // ' not '.length = 5

    // If there's something before NOT, it must match
    let beforeMatches = true;
    if (beforeNot) {
      beforeMatches = evaluateBooleanQuery(beforeNot, normalizedText);
    }

    // The part after NOT must NOT match
    const afterMatches = evaluateBooleanQuery(afterNot, normalizedText);

    return beforeMatches && !afterMatches;
  }

  // Handle AND operations (default behavior and explicit)
  const andParts = normalizedQuery.includes(' and ')
    ? normalizedQuery.split(' and ')
    : normalizedQuery.split(' ').filter(term => term.length > 0);

  return andParts.every(term => {
    term = term.trim();
    console.log('[evaluateBooleanQuery] Checking term:', term);

    // Skip placeholders
    if (term === '__TRUE__') return true;
    if (term === '__FALSE__') return false;

    // Remove quotes if present for exact phrase matching
    if (term.startsWith('"') && term.endsWith('"')) {
      // Exact phrase search
      const phrase = term.slice(1, -1);
      console.log('[evaluateBooleanQuery] Exact phrase search:', phrase, 'Match:', normalizedText.includes(phrase));
      return normalizedText.includes(phrase);
    } else if (term.startsWith("'") && term.endsWith("'")) {
      // Also support single quotes
      const phrase = term.slice(1, -1);
      console.log('[evaluateBooleanQuery] Single quote phrase search:', phrase, 'Match:', normalizedText.includes(phrase));
      return normalizedText.includes(phrase);
    } else {
      // Regular word search with wildcard support
      const matches = matchWithWildcard(term, normalizedText);
      console.log('[evaluateBooleanQuery] Regular/wildcard search:', term, 'Match:', matches);
      return matches;
    }
  });
}

/**
 * Search and highlight cards
 * @param {string} query - Search query
 */
export async function searchCards(query) {
  console.log('[searchCards] Called with query:', query);

  if (!layer) {
    console.error('[searchCards] Layer not initialized');
    return;
  }

  const allCards = await getAllCards();
  // Get all groups from layer that have a cardId attribute
  const allGroups = layer.getChildren().filter(node => node.getAttr('cardId'));

  console.log('[searchCards] Total cards in DB:', allCards.length);
  console.log('[searchCards] Total card groups on canvas:', allGroups.length);

  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    // Clear search - reset all cards
    console.log('[searchCards] Clearing search, resetting all cards');
    allGroups.forEach(group => {
      group.opacity(1);
      const background = group.findOne('Rect');
      if (!group.hasName('selected')) {
        if (background) {
          background.stroke('#e0e0e0');
          background.strokeWidth(1);
        }
      }
    });
    layer.batchDraw();
    return;
  }

  const matchingCards = new Set();

  // Find matching cards using boolean logic
  allCards.forEach(card => {
    const searchableText = buildCardSearchText(card);

    console.log('[searchCards] Checking card:', card.id);

    // Use boolean query evaluation
    if (evaluateBooleanQuery(normalizedQuery, searchableText)) {
      console.log('[searchCards] ✓ Match found:', card.id);
      matchingCards.add(card.id);
    }
  });

  console.log('[searchCards] Matching card IDs:', Array.from(matchingCards));

  // Apply visual effects
  allGroups.forEach(group => {
    const cardId = group.getAttr('cardId');
    const background = group.findOne('Rect');
    const isMatch = matchingCards.has(cardId);

    console.log('[searchCards] Group cardId:', cardId, 'isMatch:', isMatch, 'hasBackground:', !!background);

    if (isMatch) {
      // Matching card: mark and full opacity
      console.log('[searchCards] → Highlighting match:', cardId);
      group.opacity(1);
      group.addName('selected');
      if (background) {
        background.stroke('#2196F3');
        background.strokeWidth(3);
      }
    } else {
      // Non-matching card: fade and remove selection
      console.log('[searchCards] → Fading non-match:', cardId);
      group.opacity(0.3);
      group.removeName('selected');
      if (background) {
        background.stroke('#e0e0e0');
        background.strokeWidth(1);
      }
    }
  });

  layer.batchDraw();
  console.log(`[searchCards] ✓ Search complete: found ${matchingCards.size} matches for "${query}"`);
}

// ============================================================================
// SECTION 11: CONTEXT MENU & CARD ACTIONS (Lock, Pin)
// ============================================================================

/**
 * Show context menu for card
 */
export async function showContextMenu(x, y, cardId, group) {
  // Remove any existing context menu
  const existingMenu = document.getElementById('card-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const selectedGroups = layer.find('.selected');
  const isBulkOperation = selectedGroups.length > 1 && group.hasName('selected');
  const isLocked = group.getAttr('locked') || false;

  // Create menu
  const menu = document.createElement('div');
  menu.id = 'card-context-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10001;
    min-width: 180px;
    overflow: hidden;
  `;

  let menuItems = [];

  if (isBulkOperation) {
    const selectedIds = selectedGroups.map(g => g.getAttr('cardId'));
    menu.innerHTML = `<div style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid var(--border-color); margin-bottom: 4px; color: var(--text-primary);">${selectedIds.length} kort markerade</div>`;
    menuItems = [
      {
        label: '🎨 Ändra färg',
        action: () => showQuickColorPicker(x, y, selectedIds)
      },
      {
        label: '✏️ Redigera alla',
        action: () => createBulkEditor(selectedIds)
      },
      {
        label: '🗑️ Ta bort alla',
        action: () => {
          if (confirm(`Är du säker på att du vill ta bort ${selectedIds.length} kort?`)) {
            selectedIds.forEach(id => handleDeleteCard(id));
          }
        }
      }
    ];
    renderMenuItems(menu, menuItems, true);
  } else {
    // Single card menu
    const card = await getCard(cardId);
    menuItems = [
      {
        label: isLocked ? '📌 Avpinna kort' : '📌 Pinna kort',
        action: () => toggleLockCard(cardId, group)
      },
      {
        label: '✏️ Redigera',
        action: () => openEditDialog(cardId)
      }
    ];

    if (card && card.image) {
      // Add flip option for image cards
      menuItems.push({
        label: card.flipped ? '🔄 Visa bild' : '🔄 Visa text',
        action: () => flipCard(cardId)
      });

      menuItems.push({
        label: '✨ Läs med AI',
        action: async () => {
          try {
            await readImageWithGemini(cardId);
            await reloadCanvas();
            alert('✅ Kort läst med Gemini AI. Texten finns på baksidan - dubbelklicka och klicka "Vänd kort" för att se.');
          } catch (error) {
            console.error('Fel vid OCR:', error);
            alert(`Fel vid läsning av kort: ${error.message}`);
          }
        }
      });
    }

    menuItems.push({
      label: '🗑️ Ta bort',
      action: () => handleDeleteCard(cardId)
    });

    renderMenuItems(menu, menuItems, false);
  }

  document.body.appendChild(menu);

  // Close menu on click outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function renderMenuItems(menu, items, isBulk) {
    if (!isBulk) {
        menu.innerHTML = ''; // Clear loading placeholder
    }

    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.label;
        menuItem.style.cssText = `
          padding: 10px 16px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
          color: var(--text-primary);
        `;
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.background = 'var(--bg-secondary)';
        });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.background = 'var(--bg-primary)';
        });
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          const contextMenu = document.getElementById('card-context-menu');
          if (contextMenu) contextMenu.remove();
        });
        menu.appendChild(menuItem);
    });
}

/**
 * Toggle lock state for a card
 */
async function toggleLockCard(cardId, group) {
  const isLocked = group.getAttr('locked') || false;
  const newLockedState = !isLocked;

  // Update visual state
  group.draggable(!newLockedState);
  group.setAttr('locked', newLockedState);

  // Update database
  await updateCard(cardId, { locked: newLockedState });

  // Visual feedback - add lock icon
  updateLockIndicator(group, newLockedState);

  console.log(`Card ${cardId} ${newLockedState ? 'locked' : 'unlocked'}`);
  layer.batchDraw();
}

/**
 * Update lock indicator on card
 */
function updateLockIndicator(group, isLocked) {
  // Remove existing lock indicator
  const existingLock = group.findOne('.lock-indicator');
  if (existingLock) {
    existingLock.destroy();
  }

  if (isLocked) {
    // Add pin icon
    const background = group.findOne('Rect');
    if (background) {
      const pinIcon = new Konva.Text({
        text: '📌',
        x: background.width() - 30,
        y: 5,
        fontSize: 20,
        name: 'lock-indicator',
        listening: false
      });
      group.add(pinIcon);
    }
  }
}

/**
 * Toggle pin/unpin for selected cards
 */
async function togglePinSelectedCards() {
  const selectedGroups = layer.find('.selected');
  if (selectedGroups.length === 0) {
    console.log('No cards selected to pin/unpin');
    return;
  }

  // Check if any are pinned
  const anyPinned = selectedGroups.some(group => group.getAttr('locked'));

  for (const group of selectedGroups) {
    const cardId = group.getAttr('cardId');
    if (cardId) {
      // If any are pinned, unpin all. Otherwise, pin all.
      const newState = !anyPinned;
      group.draggable(!newState);
      group.setAttr('locked', newState);
      await updateCard(cardId, { locked: newState });
      updateLockIndicator(group, newState);
    }
  }

  console.log(`${anyPinned ? 'Unpinned' : 'Pinned'} ${selectedGroups.length} cards`);
  layer.batchDraw();
}

// ============================================================================
// SECTION 12: UI BUTTONS & THEME (Fit All, Add Menu, Theme Toggle)
// ============================================================================

/**
 * Create "Fit All" button
 */
function createFitAllButton() {
  const isEink = document.body.classList.contains('eink-theme');

  const button = document.createElement('button');
  button.id = 'fit-all-button';
  button.innerHTML = '🔍';
  button.title = 'Visa alla kort';
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    background: ${isEink ? 'white' : '#2196F3'};
    color: ${isEink ? 'black' : 'white'};
    border: ${isEink ? '2px solid black' : 'none'};
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    box-shadow: ${isEink ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)'};
    z-index: 1000;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = isEink ? 'none' : '0 6px 16px rgba(0, 0, 0, 0.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = isEink ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)';
  });

  button.addEventListener('click', fitAllCards);

  document.body.appendChild(button);
  console.log('Fit All button created');
}

/**
 * Create "Command Palette" button
 */
function createCommandPaletteButton() {
  const isEink = document.body.classList.contains('eink-theme');

  const button = document.createElement('button');
  button.id = 'command-palette-button';
  button.innerHTML = '⌘';
  button.title = 'Kommandopalett (Space)';
  button.style.cssText = `
    position: fixed;
    bottom: 168px;
    right: 24px;
    width: 56px;
    height: 56px;
    background: ${isEink ? 'white' : '#2196F3'};
    color: ${isEink ? 'black' : 'white'};
    border: ${isEink ? '2px solid black' : 'none'};
    border-radius: 50%;
    font-size: 28px;
    cursor: pointer;
    box-shadow: ${isEink ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)'};
    z-index: 1000;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = isEink ? 'none' : '0 6px 16px rgba(0, 0, 0, 0.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = isEink ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)';
  });

  button.addEventListener('click', showCommandPalette);

  document.body.appendChild(button);
  console.log('Command Palette button created');
}

/**
 * Show add menu overlay
 */
function showAddMenu() {
  // Remove existing menu if any
  const existingMenu = document.getElementById('add-menu-overlay');
  if (existingMenu) {
    existingMenu.remove();
    return; // Toggle off
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'add-menu-overlay';
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
    z-index: 10002;
    backdrop-filter: blur(4px);
  `;

  // Create menu container
  const menu = document.createElement('div');
  menu.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    min-width: 300px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Snabbmeny';
  title.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 24px;
    color: #1a1a1a;
  `;
  menu.appendChild(title);

  // Menu items
  const menuItems = [
    {
      icon: '📝',
      label: 'Nytt text-kort',
      desc: 'Skapa ett nytt text-kort',
      action: async () => {
        const pointer = stage.getPointerPosition();
        const scale = stage.scaleX();
        const position = pointer ? {
          x: (pointer.x - stage.x()) / scale,
          y: (pointer.y - stage.y()) / scale
        } : { x: 100, y: 100 };
        await createNewCard(position);
        overlay.remove();
      }
    },
    {
      icon: '🖼️',
      label: 'Importera bild',
      desc: 'Lägg till en bild från din enhet',
      action: async () => {
        overlay.remove(); // Remove overlay BEFORE opening file picker
        await importImage();
      }
    }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.style.cssText = `
      padding: 16px;
      margin-bottom: 8px;
      background: #f5f5f5;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 16px;
    `;

    menuItem.innerHTML = `
      <div style="font-size: 28px; flex-shrink: 0;">${item.icon}</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 16px; color: #1a1a1a; margin-bottom: 2px;">
          ${item.label}
        </div>
        <div style="font-size: 13px; color: #666;">
          ${item.desc}
        </div>
      </div>
    `;

    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.background = '#e8e8e8';
      menuItem.style.transform = 'translateX(4px)';
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.background = '#f5f5f5';
      menuItem.style.transform = 'translateX(0)';
    });

    menuItem.addEventListener('click', item.action);
    menu.appendChild(menuItem);
  });

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

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
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme') || 'light';

  const themes = ['light', 'dark', 'eink'];
  const currentIndex = themes.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themes.length;
  const nextTheme = themes[nextIndex];

  body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);

  console.log(`Theme changed to: ${nextTheme}`);
}

/**
 * Toggle view from menu
 */
function toggleViewFromMenu() {
  // Call the main.js toggleView function via custom event
  window.dispatchEvent(new CustomEvent('toggleView'));
}

/**
 * Create floating add button
 */
function createAddButton() {
  const isEink = document.body.classList.contains('eink-theme');

  const button = document.createElement('button');
  button.id = 'add-button';
  button.innerHTML = '+';
  button.title = 'Nytt kort (N) | Långpress: Importera bild (I) | Extra lång: Command (C)';
  button.style.cssText = `
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 56px;
    height: 56px;
    background: ${isEink ? 'white' : '#4CAF50'};
    color: ${isEink ? 'black' : 'white'};
    border: ${isEink ? '2px solid black' : 'none'};
    border-radius: 50%;
    font-size: 32px;
    font-weight: 300;
    cursor: pointer;
    box-shadow: ${isEink ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)'};
    z-index: 1000;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  `;

  let pressStartTime = null;

  const onPressStart = () => {
    pressStartTime = Date.now();
    button.style.transform = 'scale(0.95)';
  };

  const onPressEnd = () => {
    button.style.transform = 'scale(1)';
    // Show overlay menu
    showAddMenu();
  };

  let isPressed = false;

  button.addEventListener('mousedown', () => {
    isPressed = true;
    onPressStart();
  });

  button.addEventListener('mouseup', () => {
    if (isPressed) {
      isPressed = false;
      onPressEnd();
    }
  });

  button.addEventListener('mouseleave', () => {
    if (isPressed) {
      isPressed = false;
      button.style.transform = 'scale(1)';
    }
  });

  button.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isPressed = true;
    onPressStart();
  });

  button.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isPressed) {
      isPressed = false;
      onPressEnd();
    }
  });

  button.addEventListener('mouseenter', () => {
    if (!isPressed) {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    }
  });

  button.addEventListener('mouseleave', () => {
    if (!isPressed) {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }
  });

  document.body.appendChild(button);
  console.log('Add button created');
}

// ============================================================================
// SECTION 13: ARRANGEMENTS & KEYBOARD HANDLERS (Grid, Vertical, Horizontal, etc.)
// ============================================================================

/**
 * Apply arrangement to selected cards with animation
 */
async function applyArrangement(arrangeFn, arrangeName) {
  const selectedGroups = layer.find('.selected');
  if (selectedGroups.length === 0) {
    console.log('No cards selected for arrangement');
    return;
  }

  // Get mouse/center position
  const pointer = stage.getPointerPosition();
  const scale = stage.scaleX();
  const centerPos = pointer ? {
    x: (pointer.x - stage.x()) / scale,
    y: (pointer.y - stage.y()) / scale
  } : {
    x: 0,
    y: 0
  };

  // Prepare card data for arrangement
  const cardsData = await Promise.all(
    selectedGroups.map(async group => {
      const cardId = group.getAttr('cardId');
      const cards = await getAllCards();
      const card = cards.find(c => c.id === cardId);
      const background = group.findOne('Rect');

      return {
        id: cardId,
        width: background ? background.width() : 200,
        height: background ? background.height() : 150,
        card: card
      };
    })
  );

  // Calculate new positions
  const newPositions = arrangeFn(cardsData, centerPos);

  // Check if this is a grid arrangement that needs standard width
  const needsStandardWidth = arrangeName.includes('Grid Vertical') ||
                             arrangeName.includes('Grid Horizontal') ||
                             arrangeName.includes('Grid Top-Aligned');
  const standardWidth = 200;

  // Animate cards to new positions (and resize if needed)
  newPositions.forEach(({ id, x, y }) => {
    const group = cardGroups.get(id);
    if (!group) return;

    // Animate position
    group.to({
      x: x,
      y: y,
      duration: 0.3,
      easing: Konva.Easings.EaseOut
    });

    // Resize cards to standard width for grid arrangements
    if (needsStandardWidth) {
      const background = group.findOne('Rect');
      const text = group.findOne('Text');
      const image = group.findOne('Image');

      if (background) {
        const currentWidth = background.width();
        if (currentWidth !== standardWidth) {
          background.to({
            width: standardWidth,
            duration: 0.3,
            easing: Konva.Easings.EaseOut
          });
        }
      }

      if (text) {
        text.to({
          width: standardWidth - 20,
          duration: 0.3,
          easing: Konva.Easings.EaseOut
        });
      }

      if (image) {
        // Scale image proportionally to fit standard width
        // Images use scaleX/scaleY, not width/height directly
        const imageElement = image.image();
        if (imageElement) {
          const naturalWidth = imageElement.naturalWidth || imageElement.width;
          const naturalHeight = imageElement.naturalHeight || imageElement.height;

          // Calculate new scale to fit standard width
          const newScaleX = standardWidth / naturalWidth;
          const newScaleY = newScaleX; // Keep aspect ratio

          const newDisplayHeight = naturalHeight * newScaleY;

          image.to({
            scaleX: newScaleX,
            scaleY: newScaleY,
            duration: 0.3,
            easing: Konva.Easings.EaseOut
          });

          // Also resize background to match new image height
          // Image cards have no text area, so just use image height
          if (background) {
            background.to({
              height: newDisplayHeight,
              duration: 0.3,
              easing: Konva.Easings.EaseOut
            });
          }
        }
      }
    }

    // Update database
    updateCard(id, { position: { x, y } });
  });

  layer.batchDraw();
  console.log(`Arranged ${newPositions.length} cards: ${arrangeName}`);
}

/**
 * Custom modal dialog (replaces prompt)
 */
function showTextInputDialog(title, defaultValue = '') {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
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
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      padding: 24px;
      width: 90%;
      max-width: 500px;
      animation: slideDown 0.2s ease-out;
    `;

    // Add animation keyframe
    if (!document.getElementById('dialog-animation-style')) {
      const style = document.createElement('style');
      style.id = 'dialog-animation-style';
      style.textContent = `
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Title
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
    `;

    // Input
    const input = document.createElement('textarea');
    input.value = defaultValue;
    input.style.cssText = `
      width: 100%;
      min-height: 100px;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      font-family: sans-serif;
      resize: vertical;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    `;
    input.addEventListener('focus', () => {
      input.style.borderColor = '#2196F3';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#e0e0e0';
    });

    // Buttons container
    const buttons = document.createElement('div');
    buttons.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Avbryt';
    cancelBtn.style.cssText = `
      padding: 10px 20px;
      background: #f5f5f5;
      color: #666;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#e0e0e0';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = '#f5f5f5';
    });
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(null);
    });

    // OK button
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = `
      padding: 10px 20px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    `;
    okBtn.addEventListener('mouseenter', () => {
      okBtn.style.background = '#1976D2';
    });
    okBtn.addEventListener('mouseleave', () => {
      okBtn.style.background = '#2196F3';
    });
    okBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(input.value);
    });

    // Build dialog
    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dialog.appendChild(titleEl);
    dialog.appendChild(input);
    dialog.appendChild(buttons);
    overlay.appendChild(dialog);

    // Handle escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', escapeHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Handle enter key (submit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        okBtn.click();
      }
    });

    // Show dialog
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

/**
 * Clear clipboard
 */
export function clearClipboard() {
  clipboard = [];
  console.log('Clipboard cleared');
}

/**
 * Deselect all cards
 */
export function deselectAllCards() {
  if (!layer) return;

  const isEink = document.body.classList.contains('eink-theme');
  const isDark = document.body.classList.contains('dark-theme');

  layer.find('.selected').forEach(group => {
    group.removeName('selected');
    const background = group.findOne('Rect');
    if (background) {
      if (isEink) {
        background.stroke('#000000');
        background.strokeWidth(1);
      } else if (isDark) {
        background.stroke('#4a5568');
        background.strokeWidth(1);
      } else {
        background.stroke('#e0e0e0');
        background.strokeWidth(1);
      }
    }
  });

  layer.batchDraw();
  console.log('All cards deselected');
}
