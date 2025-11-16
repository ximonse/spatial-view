# ADR 002: IndexedDB istället för localStorage

**Status:** Accepted  
**Datum:** 2025-11-08  
**Kontext:** spatial-notes-v2 använde localStorage som primär lagring

## Beslut
Vi använder **IndexedDB** (via Dexie.js wrapper) istället för localStorage.

## Problem med localStorage (v2)
1. **Storlek:** 5-10MB gräns (browser-dependent)
2. **Synkron I/O:** Blockerar UI vid läs/skriv
3. **Base64 overhead:** Bilder lagrades som base64 = +33% storlek
4. **Performance:** JSON.parse() av 10MB+ tar >1s
5. **Ingen indexering:** Full scan för sökningar
6. **Ingen recovery:** Korruption = förlorad data

## Fördelar med IndexedDB
1. **Unlimited storage:** Begränsat endast av disk space (med user permission)
2. **Async I/O:** Inga UI-frysningar
3. **Blob storage:** Bilder som native Blobs = ingen base64 overhead
4. **Indexering:** Snabba queries på tags, dates, etc.
5. **Transaktioner:** ACID-guarantees
6. **Version migration:** Inbyggt schema migration system

## Dexie.js wrapper
- Promise-baserat API (enklare än native IndexedDB)
- TypeScript support
- Observable collections
- Migration helpers
- Endast 20KB gzipped

## Schema design
```javascript
db.version(1).stores({
  cards: '++id, created, modified, *tags',
  changelog: '++id, timestamp, cardId'
});
```

## Konsekvenser
- ✅ Skalbart till tusentals kort med bilder
- ✅ Snabba sökningar med indices
- ✅ Smooth UI (async operations)
- ✅ Mindre disk usage (no base64)
- ❌ Mer komplext än localStorage
- ❌ Kräver migration för v2 users
