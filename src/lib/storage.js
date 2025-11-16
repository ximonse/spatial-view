/**
 * Storage module using IndexedDB (Dexie.js)
 */

import Dexie from 'dexie';

// Initialize database
const db = new Dexie('SpatialViewDB');

// Define schema
db.version(1).stores({
  cards: '++id, created, modified, *tags',
  changelog: '++id, timestamp, cardId'
});

/**
 * Initialize storage
 */
export async function initStorage() {
  try {
    await db.open();
    console.log('IndexedDB initialized');
    
    // Check if this is first run
    const count = await db.cards.count();
    if (count === 0) {
      console.log('First run - database is empty');
      await createWelcomeCard();
    }
    
    return db;
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    throw error;
  }
}

/**
 * Create welcome card on first run
 */
async function createWelcomeCard() {
  const welcomeCard = {
    text: 'Välkommen till Spatial View!\n\nDetta är din visuella second brain för handskrivna anteckningar.',
    tags: ['välkommen'],
    created: Date.now(),
    modified: Date.now(),
    position: { x: 100, y: 100 }
  };
  
  await db.cards.add(welcomeCard);
  console.log('Welcome card created');
}

/**
 * Get all cards
 */
export async function getAllCards() {
  return await db.cards.toArray();
}

/**
 * Get card by ID
 */
export async function getCard(id) {
  return await db.cards.get(id);
}

// Counter for cards created in the same millisecond
let cardCounter = 0;
let lastTimestamp = 0;

/**
 * Generate unique card ID in format: yymmdd_hh_mm_ss_ms_a
 */
function generateCardId() {
  const now = new Date();
  const timestamp = now.getTime();

  // Reset counter if we're in a new millisecond
  if (timestamp !== lastTimestamp) {
    cardCounter = 0;
    lastTimestamp = timestamp;
  } else {
    cardCounter++;
  }

  // Format: yymmdd_hh_mm_ss_ms_a
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  // Letter suffix: a, b, c, etc.
  const suffix = String.fromCharCode(97 + cardCounter); // 97 = 'a'

  return `${yy}${mm}${dd}_${hh}_${min}_${ss}_${ms}_${suffix}`;
}

/**
 * Create new card
 */
export async function createCard(cardData, metadata = {}) {
  const uniqueId = generateCardId();

  const card = {
    ...cardData,
    uniqueId,
    created: Date.now(),
    modified: Date.now(),
    metadata: {
      ...metadata,
      createdAt: new Date().toISOString()
    }
  };

  const id = await db.cards.add(card);

  // Log to changelog
  await logChange('create', id, card);

  return id;
}

/**
 * Update existing card
 */
export async function updateCard(id, updates) {
  const updated = {
    ...updates,
    modified: Date.now()
  };
  
  await db.cards.update(id, updated);
  
  // Log to changelog
  await logChange('update', id, updated);
}

/**
 * Delete card
 */
export async function deleteCard(id) {
  await db.cards.delete(id);
  
  // Log to changelog
  await logChange('delete', id, null);
}

/**
 * Search cards
 */
export async function searchCards(query) {
  const allCards = await db.cards.toArray();
  
  return allCards.filter(card => {
    const tagsStr = card.tags ? card.tags.join(' ') : '';
    const searchText = (card.text + ' ' + tagsStr).toLowerCase();
    return searchText.includes(query.toLowerCase());
  });
}

/**
 * Log change to changelog for delta sync
 */
async function logChange(operation, cardId, data) {
  await db.changelog.add({
    timestamp: Date.now(),
    cardId,
    operation,
    data
  });
}

/**
 * Export all cards (full backup)
 */
export async function exportFull() {
  const cards = await db.cards.toArray();
  
  return {
    type: 'full',
    version: '1.0',
    exportedAt: Date.now(),
    cards
  };
}

/**
 * Export delta (changes since timestamp)
 */
export async function exportDelta(sinceTimestamp = 0) {
  const changes = await db.changelog
    .where('timestamp')
    .above(sinceTimestamp)
    .toArray();
  
  return {
    type: 'delta',
    version: '1.0',
    sinceTimestamp,
    exportedAt: Date.now(),
    changes
  };
}

/**
 * Import cards from JSON
 */
export async function importData(jsonData) {
  if (jsonData.type === 'full') {
    // Full import - add all cards
    await db.cards.bulkAdd(jsonData.cards);
  } else if (jsonData.type === 'delta') {
    // Delta import - merge changes
    for (const change of jsonData.changes) {
      if (change.operation === 'create') {
        await db.cards.add(change.data);
      } else if (change.operation === 'update') {
        await db.cards.put(change.data);
      } else if (change.operation === 'delete') {
        await db.cards.delete(change.cardId);
      }
    }
  }
}

// Export db for advanced usage
export { db };
