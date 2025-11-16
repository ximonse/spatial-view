/**
 * Card arrangement utilities
 * Adapted from spatial-notes-v2 for Konva.js
 */

/**
 * Arrange cards in vertical column
 * Based on v2's arrangeSelectedInColumn
 */
export function arrangeVertical(cards, centerPos) {
  const gap = 40;
  const positions = [];

  // Calculate total height needed
  let totalHeight = 0;
  cards.forEach((card, index) => {
    const height = card.height || 150;
    totalHeight += height;
    if (index < cards.length - 1) totalHeight += gap;
  });

  // Start from top, centered vertically around centerPos
  let currentY = centerPos.y - totalHeight / 2;

  cards.forEach(card => {
    const height = card.height || 150;
    const width = card.width || 200;

    positions.push({
      id: card.id,
      x: centerPos.x - width / 2, // Center horizontally
      y: currentY
    });

    currentY += height + gap;
  });

  return positions;
}

/**
 * Arrange cards in horizontal row
 * Based on v2's arrangeSelectedInRow
 */
export function arrangeHorizontal(cards, centerPos) {
  const gap = 40;
  const positions = [];

  // Calculate total width needed
  let totalWidth = 0;
  cards.forEach((card, index) => {
    const width = card.width || 200;
    totalWidth += width;
    if (index < cards.length - 1) totalWidth += gap;
  });

  // Start from left, centered horizontally around centerPos
  let currentX = centerPos.x - totalWidth / 2;

  cards.forEach(card => {
    const width = card.width || 200;

    positions.push({
      id: card.id,
      x: currentX,
      y: centerPos.y // Top-aligned
    });

    currentX += width + gap;
  });

  return positions;
}

/**
 * Arrange cards in grid
 * Based on v2's arrangeSelectedInGrid
 */
export function arrangeGrid(cards, centerPos) {
  const spacing = 180; // Both horizontal and vertical
  const positions = [];

  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(cards.length));
  const rows = Math.ceil(cards.length / cols);

  const gridWidth = cols * spacing;
  const gridHeight = rows * spacing;

  // Start position (top-left of grid, centered around centerPos)
  const startX = centerPos.x - gridWidth / 2;
  const startY = centerPos.y - gridHeight / 2;

  cards.forEach((card, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    positions.push({
      id: card.id,
      x: startX + col * spacing,
      y: startY + row * spacing
    });
  });

  return positions;
}

/**
 * Arrange cards in cluster (circle)
 * Based on v2's clusterSelectedCards
 */
export function arrangeCluster(cards, centerPos) {
  const radius = 50;
  const positions = [];

  cards.forEach((card, index) => {
    const angle = (index / cards.length) * 2 * Math.PI;
    const x = centerPos.x + Math.cos(angle) * radius;
    const y = centerPos.y + Math.sin(angle) * radius;

    positions.push({
      id: card.id,
      x: x,
      y: y
    });
  });

  return positions;
}

/**
 * Arrange cards in vertical columns (grid variant)
 * Max 5 columns, 20px gaps both ways
 * All cards use standard width for aligned columns
 */
export function arrangeGridVertical(cards, centerPos) {
  const maxCols = 5;
  const gap = 40;
  const standardWidth = 200; // Standard width for all cards
  const positions = [];

  const cols = Math.min(maxCols, Math.ceil(Math.sqrt(cards.length)));
  const cardsPerCol = Math.ceil(cards.length / cols);

  // Calculate total grid width (all columns same width)
  const totalWidth = cols * standardWidth + (cols - 1) * gap;

  // Start position
  let currentX = centerPos.x - totalWidth / 2;
  const startY = centerPos.y;

  let cardIndex = 0;
  for (let col = 0; col < cols && cardIndex < cards.length; col++) {
    let currentY = startY;

    for (let row = 0; row < cardsPerCol && cardIndex < cards.length; row++) {
      const card = cards[cardIndex];
      const height = card.height || 150;

      positions.push({
        id: card.id,
        x: currentX,
        y: currentY
      });

      currentY += height + gap;
      cardIndex++;
    }

    currentX += standardWidth + gap;
  }

  return positions;
}

/**
 * Arrange cards in packed rows
 * Max 5 per row, top-aligned within row, tight vertical packing
 * All cards use standard width for aligned columns
 */
export function arrangeGridHorizontal(cards, centerPos) {
  const maxCols = 5;
  const gap = 40;
  const standardWidth = 200; // Standard width for all cards
  const positions = [];

  // Group cards into rows
  const rows = [];
  for (let i = 0; i < cards.length; i += maxCols) {
    rows.push(cards.slice(i, i + maxCols));
  }

  // Calculate row heights (tallest card in each row)
  const rowHeights = rows.map(row => {
    return Math.max(...row.map(card => card.height || 150));
  });

  // Calculate total grid height
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows.length - 1) * gap;

  let currentY = centerPos.y - totalHeight / 2;

  rows.forEach((row, rowIndex) => {
    // Calculate row width (all cards same width)
    const rowWidth = row.length * standardWidth + (row.length - 1) * gap;
    let currentX = centerPos.x - rowWidth / 2;

    row.forEach(card => {
      positions.push({
        id: card.id,
        x: currentX,
        y: currentY // Top-aligned within row
      });

      currentX += standardWidth + gap;
    });

    // Next row starts at bottom of tallest card in current row + gap
    currentY += rowHeights[rowIndex] + gap;
  });

  return positions;
}

/**
 * Arrange cards in overlapping grid (Kanban-style, for showing titles)
 * Max 5 per row, cards overlap vertically to show ~120px of each
 * Rows start at left edge
 * All cards use standard width for aligned columns
 */
export function arrangeGridTopAligned(cards, centerPos) {
  const maxCols = 5;
  const colSpacing = 15; // Tight horizontal spacing
  const rowSpacing = 120; // Vertical overlap - show 120px of each card
  const standardWidth = 200; // Standard width for all cards
  const positions = [];

  // Group into rows
  const rows = [];
  for (let i = 0; i < cards.length; i += maxCols) {
    rows.push(cards.slice(i, i + maxCols));
  }

  const totalHeight = rows.length * rowSpacing;
  let currentY = centerPos.y - totalHeight / 2;

  rows.forEach(row => {
    // All rows start at the same X position (left-aligned)
    let currentX = centerPos.x;

    row.forEach(card => {
      positions.push({
        id: card.id,
        x: currentX,
        y: currentY
      });

      currentX += standardWidth + colSpacing;
    });

    currentY += rowSpacing; // Overlapping rows
  });

  return positions;
}
