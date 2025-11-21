const ZOTERO_BASE_PALETTE = {
  'card-color-1': '#ffd400', // Gul
  'card-color-2': '#ff6666', // Röd
  'card-color-3': '#5fb236', // Grön
  'card-color-4': '#2ea8e5', // Blå
  'card-color-5': '#a28ae5', // Lila
  'card-color-6': '#e56eee', // Magenta
  'card-color-7': '#f19837', // Orange
  'card-color-8': '#aaaaaa', // Grå
};

const ZOTERO_LIGHT_PALETTE = {
  'card-color-1': '#fff4b8',
  'card-color-2': '#ffd6d6',
  'card-color-3': '#d4efc7',
  'card-color-4': '#cbe9ff',
  'card-color-5': '#e7ddff',
  'card-color-6': '#ffd6ff',
  'card-color-7': '#ffe3c4',
  'card-color-8': '#f0f0f0',
};

const CARD_COLOR_INFO = [
  { id: 'card-color-1', label: 'Gul', shortcut: '1' },
  { id: 'card-color-2', label: 'Röd', shortcut: '2' },
  { id: 'card-color-3', label: 'Grön', shortcut: '3' },
  { id: 'card-color-4', label: 'Blå', shortcut: '4' },
  { id: 'card-color-5', label: 'Lila', shortcut: '5' },
  { id: 'card-color-6', label: 'Magenta', shortcut: '6' },
  { id: 'card-color-7', label: 'Orange', shortcut: '7' },
  { id: 'card-color-8', label: 'Grå', shortcut: '8' },
];

function useColoredCards() {
  if (typeof document === 'undefined') return true;
  const body = document.body;
  return !(body.classList.contains('dark-theme') || body.classList.contains('eink-theme'));
}

function getCardColorValue(cardColor) {
  if (cardColor && cardColor.startsWith('#')) return cardColor;

  const baseColor = ZOTERO_BASE_PALETTE[cardColor] || '#ffffff';
  return useColoredCards() ? (ZOTERO_LIGHT_PALETTE[cardColor] || baseColor) : baseColor;
}

function getColorOptionsForTheme({ colored = useColoredCards() } = {}) {
  const palette = colored ? ZOTERO_LIGHT_PALETTE : {};
  return CARD_COLOR_INFO.map(info => ({
    ...info,
    swatch: palette[info.id] || 'var(--bg-secondary)',
  }));
}

export {
  CARD_COLOR_INFO,
  ZOTERO_BASE_PALETTE,
  ZOTERO_LIGHT_PALETTE,
  getCardColorValue,
  getColorOptionsForTheme,
  useColoredCards,
};
