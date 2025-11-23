# Kortskapande-regler i Spatial View

Fullständig dokumentation av alla regler, processer och datastrukturer vid skapande, importering och kopiering av kort.

## Innehållsförteckning

1. [Grundläggande struktur](#grundläggande-struktur)
2. [Automatiskt genererade fält](#automatiskt-genererade-fält)
3. [Kortskapande-metoder](#kortskapande-metoder)
4. [Position-regler](#position-regler)
5. [Metadata-fält](#metadata-fält)
6. [ID-generering](#id-generering)

---

## Grundläggande struktur

### `createCard()` - Central funktion (storage.js)

ALL kortskapande går genom denna funktion. Den sätter automatiskt grundläggande fält och sparar i IndexedDB.

**Process:**
1. Generera unikt ID med `generateCardId()`
2. Skapa kort-objekt med alla fält från `cardData` parameter
3. Lägg till automatiska fält (uniqueId, created, modified, metadata)
4. Spara i IndexedDB via `db.cards.add()`
5. Logga ändring i changelog för synkronisering
6. Returnera det nya kort-ID:et

---

## Automatiskt genererade fält

Dessa fält sätts ALLTID automatiskt av `createCard()`:

| Fält | Datatyp | Beskrivning | Exempel |
|------|---------|-------------|---------|
| `uniqueId` | string | Unikt ID i format `yymmdd_hh_mm_ss_ms_a` | `"251120_14_23_45_123_a"` |
| `created` | number | Unix timestamp i millisekunder | `1700491200000` |
| `modified` | number | Unix timestamp i millisekunder | `1700491200000` |
| `metadata.createdAt` | string | ISO 8601 timestamp | `"2025-11-20T14:23:45.123Z"` |

---

## Kortskapande-metoder

### 1. Manuellt skapa tomt kort

**Funktion:** `createNewCard()` i canvas.js

**Trigger:** Användaren klickar på "Nytt kort" eller trycker `N`

**Fält som sätts:**
```javascript
{
  text: '',              // Tom sträng
  tags: [],              // Tom array
  position: {x, y},      // Vid musklick eller viewport-center
  // + automatiska fält (uniqueId, created, modified, metadata)
}
```

**Special:**
- Kortet skapas INNAN användaren skriver något
- Inline-editor öppnas direkt
- Första edit "slås samman" med create för undo/redo

---

### 2. Skapa kort från bild

#### A) Importera från fil (`importImage()`)

**Trigger:** "Importera bild" knapp eller drag-and-drop

**Bildprocessering:**
1. Användaren väljer kvalitet: `low`, `normal`, `high`, `original`
2. `processImage(file, quality)` körs:
   - Komprimerar med `browser-image-compression` (om inte original)
   - Extraherar EXIF metadata
   - Konverterar till base64 för IndexedDB
3. Metadata sparas

**Fält som sätts:**
```javascript
{
  text: 'filnamn.jpg',           // Filnamnet
  tags: ['bild'],                // Automatisk tagg
  position: {x, y},              // Vid muspekare + offset
  image: {
    base64: 'data:image/jpeg;base64,...',
    width: 800,
    height: 600,
    quality: 'normal'
  },
  metadata: {
    fileName: 'photo.jpg',
    fileSize: 1048576,           // Bytes
    fileType: 'image/jpeg',
    lastModified: 1700491200000,
    width: 800,
    height: 600,
    quality: 'normal',
    originalSize: 2097152,       // Före kompression
    compressedSize: 524288,      // Efter kompression
    compressionRatio: '0.25',
    createdAt: '...'             // AUTO
  }
}
```

**Position:** Vid muspekare eller viewport-center. Flera bilder: stagger med 50px offset.

#### B) Klistra in från clipboard (`pasteImageFromClipboard()`)

**Trigger:** `Ctrl+V` med bild i clipboard *** verkar inte funka

**Process:**
1. Läs från `navigator.clipboard.read()`
2. Konvertera Blob → File ('clipboard-image.png')
3. Användaren väljer kvalitet
4. `processImage(file, quality)`
5. Skapa kort

**Fält som sätts:**
```javascript
{
  text: 'Inklistrad bild',       // Hårdkodat
  tags: ['bild', 'clipboard'],   // Två taggar
  position: {x, y},
  image: { base64, width, height, quality },
  metadata: {
    ...processed.metadata,
    fileName: 'clipboard-image.png',
    source: 'clipboard',         // EXTRA fält!
    createdAt: '...'
  }
}
```

---

### 3. Kopiera kort

#### A) Duplicera valda kort (`duplicateSelectedCards()`)

**Trigger:** `Ctrl+D` eller högerklicksmeny ctrl+d fuinkar icke 

**Fält som KOPIERAS:**
```javascript
// Allt utom id, uniqueId, created, modified, metadata:
{
  text,
  tags,
  cardColor,
  comments,
  image,              // Hela objektet med base64
  calendarEventId,
  calendarEventLink,
  eventDate,
  geminiMetadata,
  // etc.
}
```

**Fält som ÄNDRAS:**
```javascript
{
  position: {
    x: original.x + 50,     // +50px offset
    y: original.y + 50
  },
  // NYTT från createCard():
  uniqueId: '...',          // Nytt ID
  created: Date.now(),      // Nytt timestamp
  modified: Date.now(),
  metadata: {
    copied: true,           // MARKERING
    copiedAt: '...',        // ISO timestamp
    copiedFrom: original.uniqueId,
    originalCardId: cardId,
    createdAt: '...'
  }
}
```

#### B) Kopiera och klistra in (`copySelectedCards()` + `pasteCards()`)

**Kopiera:** `Ctrl+C` - sparar kort i clipboard-array

**Klistra in:** `Ctrl+V` - skapar nya kort

**Position-logik:**
- Beräkna offset från första kortet i clipboard
- Bibehåll relativ position mellan korten

**Samma metadata som duplicera:**
- `metadata.copied`, `copiedAt`, `copiedFrom`, `originalCardId`

---

### 4. Importera från JSON

**Funktion:** `importFromJson()`

**Trigger:** "Importera från JSON" knapp

**Validering:**
- Kontrollerar `data.cards && Array.isArray(data.cards)`

**Process:**
```javascript
for (let i = 0; i < data.cards.length; i++) {
  const card = data.cards[i];
  const { id, ...cardWithoutId } = card;  // TA BORT id!

  await createCard(cardWithoutId, {
    imported: true,
    importedAt: new Date().toISOString(),
    importedFrom: file.name,
    importBatchIndex: i
  });
}
```

**VIKTIGT:** Original `id` kastas bort! Nytt ID genereras alltid.

**Fält som sätts:**
```javascript
{
  ...cardWithoutId,        // Allt från JSON UTOM id
  uniqueId: '...',         // NYTT ID genereras!
  created: Date.now(),     // NYTT timestamp
  modified: Date.now(),
  metadata: {
    imported: true,
    importedAt: '...',
    importedFrom: 'export.json',
    importBatchIndex: 0,
    createdAt: '...'
  }
}
```

---

### 5. AI-skapa kort

#### A) Från text med formatting (`createMultipleCardsFromText()`)

**Format:**
- Textblock separerade med dubbla radbrytningar
- Sista raden med `#tag1 #tag2` = taggar
- Sista raden med `&kommentar` = kommentar

**Parsing-exempel:**
```
Detta är korttext.
Mer text här.
#matematik #geometri
&Viktigt för provet
```

**Fält som sätts:**
```javascript
{
  text: 'Detta är korttext.\nMer text här.',
  tags: ['matematik', 'geometri'],
  comments: 'Viktigt för provet',
  position: {
    x: startX + (index % 5) * 50,
    y: startY + floor(index / 5) * 250
  }
}
```

**Position-logik:**
- Startar under alla befintliga kort (`maxY + 200`)
- Grid-layout: 5 kolumner bred, 250px höjd per rad

#### B) AI-generering via Gemini (`createCardsFromTextWithGemini()`)

**Process:**
1. Användaren skriver prompt
2. Skicka till Gemini API
3. Förväntat JSON-format:
```javascript
[
  {
    text: '...',
    tags: ['tag1', 'tag2'],
    comments: '...'
  }
]
```

**Samma fält och position som `createMultipleCardsFromText()`**

---

### 6. Kalenderkort från Google Calendar

**Funktion:** `createCardsFromCalendar()` i Gemini Agent toolRegistry

**Trigger:** AI-kommando: "Skapa kort från min kalender"

**Duplikathantering:**
```javascript
const existingEventIds = new Set(
  existingCards
    .filter(c => c.calendarEventId)
    .map(c => c.calendarEventId)
);

const newEvents = events.filter(e => !existingEventIds.has(e.id));
```

**VIKTIGT:** Kollar `calendarEventId` för att undvika dubbletter!

**Färglogik:**
```javascript
const autoColor = getColorFromText(event.summary);  // Ämnesfärg
const defaultColor = event.isAllDay ? '#e3f2fd' : '#fff3e0';

cardColor: autoColor || defaultColor
```

- Heldag-event: Ljusblå `#e3f2fd`
- Vanlig event: Ljusorange `#fff3e0`
- OM ämne matchar skolämne: använd skolämnesfärg

**Fält som sätts:**
```javascript
{
  text: `📅 ${event.summary}\n\n⏰ ${formatted_date}\n📍 ${location}`,
  tags: ['calendar', 'meeting'],
  position: {
    x: 100 + (count % 5) * 250,
    y: 100 + floor(count / 5) * 200
  },
  cardColor: autoColor || defaultColor,
  calendarEventId: event.id,         // För duplikatcheck!
  calendarEventLink: event.htmlLink,
  eventDate: event.start,            // ISO timestamp
}
```

**Position:** Grid från (100, 100), 5 kolumner

---

### 7. Zotero-import

**Funktion:** `importFromZotero()`

**Trigger:** "Importera från Zotero" knapp

**Process:**
1. Läs HTML-fil från Zotero export
2. Parsa `<p>` taggar med highlights
3. Extrahera:
   - Highlight-text (citat)
   - Citation
   - PDF-länk
   - Kommentar
   - Färg från `background-color` style

**Färg-mapping:**
```javascript
function mapZoteroColorToCard(bgStyle) {
  if (bgStyle.includes('#ffd400')) return '#ffd400';  // Gul
  if (bgStyle.includes('#ff6666')) return '#ff6666';  // Röd
  if (bgStyle.includes('#5fb236')) return '#5fb236';  // Grön
  if (bgStyle.includes('#2ea8e5')) return '#2ea8e5';  // Blå
  if (bgStyle.includes('#a28ae5')) return '#a28ae5';  // Lila
  if (bgStyle.includes('#e56eee')) return '#e56eee';  // Magenta
  if (bgStyle.includes('#f19837')) return '#f19837';  // Orange
  if (bgStyle.includes('#aaaaaa')) return '#aaaaaa';  // Grå
  return '#ffffff';  // Vit
}
```

**Fält som sätts:**
```javascript
{
  text: `${quoteText}\n\n${citation} (${pdfLink})`,
  comments: commentText,
  tags: ['zotero', `import_${timestamp}`],
  cardColor: mapZoteroColorToCard(bgStyle),
  position: {
    x: pointer.x + col * 240,
    y: pointer.y + row * 240
  }
}
```

**Position:** Grid-layout vid muspekare

---

### 8. Gemini OCR/Image Analysis

**Funktion:** `readImageWithGemini()` i gemini.js

**Trigger:** Högerklick → "Läs text från bild (Gemini)" på bildkort

**Process:**
1. Hämta kort med `image.base64`
2. Skicka till Gemini 2.5 Flash
3. Förväntat JSON-format:
```javascript
{
  text: "...",                     // Transkriberad text
  description: "...",              // Bildbeskrivning (om ingen text)
  metadata: {
    extractedDate: "YYYY-MM-DD",
    extractedTime: "HH:MM",
    extractedDateTime: "YYYY-MM-DDTHH:MM",
    extractedPeople: ["namn1", "namn2"],
    extractedPlaces: ["plats1", "plats2"]
  },
  hashtags: ["tag1", "tag2"]      // Inkl. datum (#250819, #25v44)
}
```

**Fält som UPPDATERAS (ej nytt kort):**
```javascript
await updateCard(cardId, {
  text: parsedData.text || parsedData.description,
  tags: [...existingTags, ...newTags],  // MERGE taggar!
  geminiMetadata: parsedData.metadata
});
```

**VIKTIGT:** Detta skapar INTE nytt kort, utan uppdaterar befintligt bildkort!

---

## Position-regler

### Sammanfattning av alla position-logiker:

| Metod | Position-regel |
|-------|---------------|
| **Nytt tomt kort** | Vid musklick ELLER viewport-center |
| **Importera bild** | Vid muspekare + stagger (50px per bild) |
| **Importera flera (JSON/AI)** | Grid: 5 kolumner, startar under alla kort (`maxY + 200`), 50px horisontellt, 250px vertikalt |
| **Kopiera/Paste** | Original + 50px offset (x, y), bibehåller relativ position mellan kort |
| **Zotero** | Grid vid muspekare: 240px spacing |
| **Kalender** | Grid från (100, 100): 250px horisontellt, 200px vertikalt |

---

## Metadata-fält

### Alltid satta (via createCard):
- `uniqueId` - Format: `yymmdd_hh_mm_ss_ms_a`
- `created` - Unix timestamp (ms)
- `modified` - Unix timestamp (ms)
- `metadata.createdAt` - ISO 8601 timestamp

### Kopiering:
- `metadata.copied` - `true`
- `metadata.copiedAt` - ISO timestamp
- `metadata.copiedFrom` - Original uniqueId
- `metadata.originalCardId` - Original ID

### Import:
- `metadata.imported` - `true`
- `metadata.importedAt` - ISO timestamp
- `metadata.importedFrom` - Filename
- `metadata.importBatchIndex` - Index i batch

### Bilder:
- `image.base64` - Base64 data
- `image.width` - Pixels
- `image.height` - Pixels
- `image.quality` - `'low'`/`'normal'`/`'high'`/`'original'`
- `metadata.fileName` - Filnamn
- `metadata.fileSize` - Bytes
- `metadata.fileType` - MIME type
- `metadata.lastModified` - Timestamp
- `metadata.originalSize` - Före kompression
- `metadata.compressedSize` - Efter kompression
- `metadata.compressionRatio` - Förhållande (string)
- `metadata.source` - `'clipboard'` (vid paste)

### Gemini OCR:
- `geminiMetadata.extractedDate` - `YYYY-MM-DD`
- `geminiMetadata.extractedTime` - `HH:MM`
- `geminiMetadata.extractedDateTime` - ISO format
- `geminiMetadata.extractedPeople` - Array
- `geminiMetadata.extractedPlaces` - Array

### Kalender:
- `calendarEventId` - Google Calendar Event ID
- `calendarEventLink` - htmlLink
- `eventDate` - ISO timestamp

---

## ID-generering

### Format: `yymmdd_hh_mm_ss_ms_a`

**Komponenter:**
- `yy` - År (2 siffror)
- `mm` - Månad (01-12)
- `dd` - Dag (01-31)
- `hh` - Timme (00-23)
- `mm` - Minut (00-59)
- `ss` - Sekund (00-59)
- `ms` - Millisekund (000-999)
- `a` - Bokstav-suffix (a, b, c, ...)

**Counter-system:**
- Global `cardCounter` och `lastTimestamp` i storage.js
- Om samma millisekund: öka counter (a → b → c → ...)
- Om ny millisekund: reset counter till 0

**Exempel:**
- `251120_14_32_45_123_a` - Första kortet 2025-11-20 14:32:45.123
- `251120_14_32_45_123_b` - Andra kortet samma millisekund
- `251120_14_32_45_124_a` - Nästa millisekund

**Syfte:**
- Unikt ID som innehåller tidsinformation
- Läsbart format för debugging
- Sortingsbar kronologiskt
- Garanterat unikt även vid snabb kortskapande

---

## Zotero-färger (standardfärger)

Dessa färger används för kort och matchar Zotero highlight-systemet:

| Färg-ID | Hex-kod | Färg | Användning |
|---------|---------|------|-----------|
| `card-color-1` | `#ffd400` | Gul | Default highlight |
| `card-color-2` | `#ff6666` | Röd | Viktigt/varningar |
| `card-color-3` | `#5fb236` | Grön | Positiva/slutsatser |
| `card-color-4` | `#2ea8e5` | Blå | Information/fakta |
| `card-color-5` | `#a28ae5` | Lila | Analys/reflektion |
| `card-color-6` | `#e56eee` | Magenta | Särskilda noter |
| `card-color-7` | `#f19837` | Orange | Metoder/processer |
| `card-color-8` | `#aaaaaa` | Grå | Övrigt/neutral |

**Skolämnes-färger** (används av `getColorFromText()`):
- Matematik (Ma): `#2ea8e5` (Blå)
- Svenska (SV): `#ffd400` (Gul)
- Engelska (Eng): `#ff6666` (Röd)
- NO/Naturorientering: `#5fb236` (Grön)
- Bild (Bi): `#a28ae5` (Lila)
- Teknik (Tk): `#aaaaaa` (Grå)
- Spanska/språk: `#f19837` (Orange)
- Idrott (IDH): `#e56eee` (Magenta)
- SO/Samhällskunskap: `#ff6666` (Röd)
- Slöjd (Sl): `#ffd400` (Gul)
- Musik (Mu): `#5fb236` (Grön)
- HKK: `#5fb236` (Grön)
- Lunch: `#ffffff` (Vit)

---

## Sammanfattning: Viktiga regler

### ✅ ALLTID gör detta:

1. **Nytt ID genereras ALLTID** vid:
   - Import från JSON
   - Kopiering/paste
   - Alla former av kortskapande

2. **Original ID kastas ALLTID bort** vid:
   - Import från JSON
   - Paste från clipboard

3. **Duplikatcheck via `calendarEventId`** för kalenderkort

4. **Position offsettas +50px** vid kopiering

5. **Taggar mergas** vid Gemini OCR (ej ersätts)

6. **Bildkompression** körs vid import (om inte 'original' valts)

7. **Metadata-spår** sätts vid kopiering/import:
   - `metadata.copied`
   - `metadata.imported`
   - `metadata.copiedFrom`
   - `metadata.importedFrom`

### ❌ ALDRIG gör detta:

1. **Återanvänd befintligt ID** från import/paste
2. **Skapa kort utan position** - alltid sätt position
3. **Kopiera bildkort utan att kopiera hela image-objektet**
4. **Glöm att sätta `calendarEventId`** för kalenderkort (duplikathantering)

---

## Exempel: Komplett kortstruktur efter skapande

```javascript
{
  // Auto-genererat
  id: 42,                              // Dexie auto-increment
  uniqueId: "251120_14_23_45_123_a",
  created: 1700491200000,
  modified: 1700491200000,

  // Innehåll
  text: "Möte med handledare",
  tags: ["möte", "avhandling", "251120"],
  comments: "Kom ihåg kapitel 3",

  // Visuellt
  cardColor: "#ff6666",
  position: { x: 450, y: 200 },

  // Bild (om bildkort)
  image: {
    base64: "data:image/jpeg;base64,...",
    width: 800,
    height: 600,
    quality: "normal"
  },

  // Kalender (om kalenderkort)
  calendarEventId: "abc123xyz",
  calendarEventLink: "https://...",
  eventDate: "2025-11-20T14:00:00",

  // Gemini metadata (om OCR körts)
  geminiMetadata: {
    extractedDate: "2025-11-20",
    extractedDateTime: "2025-11-20T14:00",
    extractedPeople: ["Anna", "Erik"],
    extractedPlaces: ["Stockholm"]
  },

  // System metadata
  metadata: {
    createdAt: "2025-11-20T14:23:45.123Z",
    // Vid kopiering:
    copied: true,
    copiedAt: "2025-11-20T14:25:00.000Z",
    copiedFrom: "251120_14_20_30_456_a",
    // Vid bildimport:
    fileName: "photo.jpg",
    fileSize: 1048576,
    originalSize: 2097152,
    compressedSize: 524288,
    compressionRatio: "0.25"
  }
}
```

---

*Dokumentation skapad: 2025-11-20*
*Version: 1.0*
*Baserad på: Spatial View efter refaktorering till modulstruktur*
