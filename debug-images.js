// Temporary debug script to check image data
import Dexie from 'dexie';

const db = new Dexie('SpatialView');
db.version(1).stores({
  cards: '++id, text, image, position, lastModified'
});

const cards = await db.cards.toArray();
console.log('Total cards:', cards.length);

cards.forEach(card => {
  if (card.image) {
    console.log(`Card ${card.id}:`);
    console.log('  - Has image:', !!card.image);
    console.log('  - Image type:', typeof card.image);
    console.log('  - Image starts with:', card.image.substring(0, 50));
    console.log('  - Image length:', card.image.length);
  }
});
