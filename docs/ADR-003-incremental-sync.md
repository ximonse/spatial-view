# ADR 003: Incremental Sync utan Backend

**Status:** Implemented
**Planerad:** 2025-11-08
**Implementerad:** 2025-11-22
**Kontext:** Användaren vill kunna synka mellan enheter utan att ladda hela JSON-filen varje gång

## Beslut
Vi implementerar **incremental sync** genom delta-export/import utan central backend.

## Approach: Delta Changelog

### Datamodell
```javascript
// IndexedDB table: changelog
{
  id: autoincrement,
  timestamp: Date,
  cardId: string,
  operation: 'create' | 'update' | 'delete',
  data: object // Full card data eller bara ändrade fields
}

// Metadata i cards table
{
  ...cardData,
  created: timestamp,
  modified: timestamp,
  syncedAt: timestamp // Senaste gången denna enhet synkade
}
```

### Export (Delta)
```javascript
// Exportera bara ändringar sedan senaste sync
export function exportDelta(sinceTimestamp) {
  const changes = db.changelog
    .where('timestamp')
    .above(sinceTimestamp)
    .toArray();
  
  return {
    type: 'delta',
    sinceTimestamp,
    exportedAt: Date.now(),
    changes
  };
}
```

### Import (Merge)
```javascript
// Merge inkommande changes med lokal data
export function importDelta(deltaJson) {
  for (const change of deltaJson.changes) {
    const local = await db.cards.get(change.cardId);
    
    if (!local) {
      // Nytt kort - lägg till direkt
      await db.cards.add(change.data);
    } else if (change.operation === 'delete') {
      // Raderat - ta bort lokalt
      await db.cards.delete(change.cardId);
    } else {
      // Update - conflict resolution
      if (change.data.modified > local.modified) {
        // Remote nyare - använd remote
        await db.cards.put(change.data);
      } else {
        // Local nyare - behåll local (eller visa konflikt UI)
      }
    }
  }
}
```

### Full Export (Backup)
```javascript
// För backup eller first-time sync på ny enhet
export function exportFull() {
  const cards = await db.cards.toArray();
  return {
    type: 'full',
    exportedAt: Date.now(),
    cards
  };
}
```

## User Flow

### Scenario 1: Desktop → Mobile (första gången)
1. Desktop: Export full → `backup-2025-11-08-full.json`
2. Mobile: Import full → Alla kort sparas
3. Mobile: Sätter `syncedAt` till import timestamp

### Scenario 2: Mobile → Desktop (uppdateringar)
1. Mobile: Redigerar 3 kort, lägger till 2 nya
2. Mobile: Export delta (sedan senaste sync) → `delta-2025-11-08-15-30.json` (5 changes)
3. Desktop: Import delta → Merge changes
4. Desktop: Uppdaterar `syncedAt`

### Scenario 3: Bidirectional (båda enheter har ändringar)
1. Desktop: Export delta → `desktop-delta.json`
2. Mobile: Export delta → `mobile-delta.json`
3. Desktop: Import `mobile-delta.json` (merge)
4. Mobile: Import `desktop-delta.json` (merge)
5. Konfliktlösning: last-write-wins (senaste `modified` vinner)

## Google Drive Integration ✅ IMPLEMENTERAD

Google Drive sync är nu implementerad och fullt fungerande.

**Implementerade features:**
- ✅ OAuth 2.0 autentisering via Google Identity Services
- ✅ Ladda ner JSON-backup från Google Drive
- ✅ Ladda upp JSON-backup till Google Drive
- ✅ Auto-skapande av `spatial-view-backups` folder
- ✅ Lista tidigare backups med timestamps
- ✅ Inkrementell restore (bara uppdaterade kort)

**Användarflöde:**
1. Klicka på Google Drive-knappen i UI
2. Auktorisera med Google-konto (engångs)
3. Välj "Ladda upp backup" eller "Ladda ner backup"
4. Backup-filer namnges automatiskt: `spatial-view-backup-YYYY-MM-DD-HH-MM-SS.json`

**Implementation:**
- Se `src/lib/drive-sync.js` för Google Drive API-integration
- OAuth token hanteras med `google.accounts.oauth2.initTokenClient()`
- File picker använder Google Drive Picker API

**Framtida förbättringar (optional):**
- Automatisk auto-sync varje N minuter
- Conflict resolution UI för bidirectional sync
- Delta sync istället för full backup (minska datatransfer)

## Fördelar
- ✅ Ingen backend behövs
- ✅ Minimal data transfer (bara ändringar)
- ✅ Fungerar offline
- ✅ User har full kontroll (manuell export/import)
- ✅ Kan senare automatiseras med Google Drive

## Begränsningar
- ⚠️ Konfliktlösning är simplistic (last-write-wins)
- ⚠️ Ingen central "source of truth"
- ⚠️ Användaren måste manuellt importera (tills Google Drive integration)

## Alternativ som övervägdes
- **PouchDB/CouchDB:** Automatisk p2p sync, men komplext setup
- **Supabase:** Central backend, men vendor lock-in och kräver account
- **Google Drive endast:** Funkar men inte realtid
