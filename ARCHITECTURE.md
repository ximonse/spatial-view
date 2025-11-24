# Spatial View - Arkitektur

## Principer

### Modularisering
- **Ingen fil över 300 rader** (helst under 200)
- **En fil = ett ansvar** (Single Responsibility Principle)
- **Dela upp tidigt** - vänta inte tills filen är för stor

### Filstruktur

```
src/
├── main.js              (< 100 rader - endast app init)
├── core/
│   └── app.js           (huvudsaklig init-logik)
├── ui/
│   ├── toolbar.js       (toolbar interactions)
│   ├── search-bar.js    (sök-funktionalitet UI)
│   └── view-switcher.js (view-hantering)
├── canvas/
│   ├── core.js          (stage, layer, init)
│   ├── rendering.js     (renderTextCard, renderImageCard)
│   ├── editing.js       (editors, dialogs)
│   ├── interactions.js  (klick, touch, drag)
│   ├── clipboard.js     (copy/paste)
│   └── search.js        (canvas search-logik)
├── lib/
│   ├── storage.js       (IndexedDB)
│   ├── arrangement.js   (arrangerings-algoritmer)
│   └── gemini.js        (AI-integration)
└── utils/
    ├── image-processing.js
    └── delta-sync.js
```

### Innan du lägger till en funktion

1. **Fråga**: Vilken modul hör detta till?
2. **Kolla**: Är filen redan över 200 rader?
3. **Om ja**: Skapa en ny modul eller dela upp befintlig först
4. **Importera**: Använd named exports, inte default exports

### Refactoring-signaler

- **Fil > 300 rader** = Akut refactoring
- **Fil > 200 rader** = Planera uppdelning
- **Funktion > 50 rader** = Överväg att dela upp

### Exempel på bra struktur

```javascript
// canvas/editing.js - ENDAST editing-relaterad kod
export function createInlineEditor(cardData, onSave) { ... }
export function createBulkEditor(cardIds) { ... }
export function showTouchBulkMenu(x, y) { ... }

// canvas/rendering.js - ENDAST rendering
export function renderTextCard(group, cardData) { ... }
export function renderImageCard(group, cardData) { ... }
export function getCardColor(cardColor) { ... }

// canvas/core.js - importerar och använder
import { renderTextCard, renderImageCard } from './rendering.js';
import { createInlineEditor } from './editing.js';
```

## Nuvarande status (2025-11-22)

### ⚠️ Viktig information om faktisk arkitektur

**MÅLBILD vs VERKLIGHET:**
- **Målbild** (dokumenterad ovan): Modulär struktur med filer < 300 rader
- **Verklighet**: Majoriteten av koden finns fortfarande i `src/canvas/core.js` (8023 rader)

**Varför denna avvikelse?**

En stor refactoring påbörjades som skapade modulfiler i `src/canvas/`, `src/ui/`, och `src/utils/`, men implementationen blev inte fullständig. De flesta "moduler" är tunt omslag (thin wrappers) som bara re-exporterar funktioner från `core.js`.

**Faktisk filstruktur:**

```
src/
├── main.js              (~100 rader - app init)
├── canvas/
│   ├── core.js          (8023 rader ⚠️ - huvudsaklig canvas-logik)
│   ├── rendering.js     (thin wrapper → core.js)
│   ├── editing.js       (thin wrapper → core.js)
│   ├── interactions.js  (thin wrapper → core.js)
│   ├── clipboard.js     (thin wrapper → core.js)
│   └── search.js        (thin wrapper → core.js)
├── ui/
│   ├── toolbar.js       (faktisk implementation ✓)
│   ├── theme.js         (faktisk implementation ✓)
│   └── view-switcher.js (faktisk implementation ✓)
├── lib/
│   ├── storage.js       (faktisk implementation ✓)
│   ├── gemini.js        (faktisk implementation ✓)
│   └── calendar-sync.js (faktisk implementation ✓)
└── utils/
    └── image-processing.js (faktisk implementation ✓)
```

### Vad fungerar bra idag

**core.js är organiserat i 13 tydliga sektioner:**
1. Global State & Configuration
2. Rendering (Cards, Colors, Visual Elements)
3. Card Creation & Editing (Dialogs, Inline Editor, Touch Menus)
4. Card Operations (Flip, Delete)
5. Canvas Management (Reload, Undo/Redo)
6. Clipboard (Copy/Paste/Duplicate)
7. Selection & Interaction (Events, Drag, Pan, Zoom)
8. Public API (Exported Functions)
9. UI Dialogs (Command Palette, Quality Dialog, Text Input)
10. Search (Boolean Search, Wildcards, Proximity)
11. Context Menu & Card Actions (Lock, Pin)
12. UI Buttons & Theme (Fit All, Add Menu, Theme Toggle)
13. Arrangements & Keyboard Handlers

**Navigera i core.js:**
- Använd Ctrl+F för att söka efter: `// === SECTION X:`
- Varje sektion har en stor banner
- Header-kommentaren listar alla sektioner

**Fördelar med nuvarande struktur:**
- ✅ Lättare att hitta funktioner än i en oorganiserad fil
- ✅ Tydlig struktur
- ✅ Inga breaking changes
- ✅ Fungerar stabilt

### Framtida migration (när tid finns)

#### Fas 1: Faktisk modularisering av core.js
För att nå målbilden behövs:
1. Flytta rendering-logik till egen `rendering.js` (inte bara re-export)
2. Flytta editing-logik till egen `editing.js`
3. Flytta interaction-logik till egen `interactions.js`
4. Hantera global state med dependency injection eller context

**Utmaning:** Tight coupling mellan funktioner och global state (stage, layer, selectedCards, etc.)

#### Fas 2: State management
Överväg `CanvasManager` klass för att kapsla in global state:
```javascript
class CanvasManager {
  constructor(stage, layer) {
    this.stage = stage;
    this.layer = layer;
    this.selectedCards = new Set();
    // ... etc
  }
}
```

## Riktlinjer framåt

### För tillägg i core.js (nuvarande approach)
1. **Innan du lägger till kod**: Kontrollera filstorlek med `wc -l`
2. **Följ sektionerna**: Lägg ny kod i rätt sektion (1-13)
3. **Dokumentera**: Uppdatera header-kommentaren när du lägger till funktioner
4. **Om core.js > 10000 rader**: Diskutera faktisk modularisering

### För ny funktionalitet (nya filer)
1. **Fråga**: Är detta en fristående modul? (som storage.js, gemini.js)
2. **Om ja**: Skapa egen fil i `lib/` eller `utils/`
3. **Om nej**: Lägg till i rätt sektion i core.js
4. **Importera**: Använd named exports, inte default exports

### Pre-commit hook
Projektet har en 300-radsgräns i pre-commit hook. Om du behöver bypassa (för core.js):
```bash
git commit --no-verify
```

---

## AI Assistant Architecture

### Design Philosophy

**Läs mer:** Se `docs/AI_DESIGN_PHILOSOPHY.md` för fullständig förklaring av designfilosofin.

**Kort sammanfattning:** AI-assistenten använder MINIMAL toolbox + DJUP spatial förståelse istället för 30+ specialiserade verktyg.

### Hur AI-systemet fungerar

**Princip:** "En duktig hantverkare med hammare och såg kommer längre än en nybörjare med 30 specialverktyg."

**Före (problem):**
- 30+ fördefinierade arrange-tools
- AI blir "tool selector" istället för "problem solver"
- Rigid: kan bara göra vad tools tillåter
- "Arrangera i 3 kategorier" → använder fel tool → 60 grids istället för 3

**Efter (lösning):**
- Minimal toolbox: `updateCards`, `getAllCards`, `getCanvasInfo`
- AI förstår spatial geometri (kort = 200×150px, 15px = samma grupp, 250px = olika grupper)
- AI komponerar lösningar från grundoperationer
- "Arrangera i 3 kategorier" → analyserar data → beräknar layout → skapar 3 kolumner

### Tool-arkitektur

**Två olika toolboxes:**

1. **AI:s toolbox** (src/canvas/core.js, lines 5139-5363):
   - Information: `getAllCards`, `searchCards`, `listAllTags`, filter-funktioner
   - Manipulation: `updateCards`, `selectCards`, `addTagsToCards`, `removeTagsFromCards`
   - Kontext: `getCanvasInfo`
   - Integrationer: Calendar-tools

2. **Användarens toolbox** (src/canvas/core.js, lines 5367-6524):
   - ALLA arrange-funktioner finns kvar i toolRegistry
   - Tillgängliga via shortcuts, buttons, kommandopalett
   - AI kan INTE kalla dessa direkt
   - Exempel: `arrangeCardsInGrid`, `arrangeCardsTimeline`, `arrangeCardsKanban`

**Viktigt:** AI:n har INTE tillgång till de specialiserade arrange-funktionerna, men användaren har det!

### System Prompt (src/lib/gemini.js, lines 332-586)

Istället för tool-beskrivningar innehåller prompten:

1. **Spatial kunskap:**
   ```
   - Kort: 200×150px (fast storlek)
   - 13-20px spacing = samma grupp
   - 200-300px spacing = olika grupper
   - Canvas: oändligt 2D-system
   ```

2. **Visuella mönster:**
   ```
   - Grid: x += 215px kolumner, y += 165px rader
   - Kluster: 15px inom, 250px mellan
   - Timeline: sortera efter datum, placera sekvensiellt
   - Hierarki: central → periferi
   ```

3. **Arrangemangsalgoritmer:**
   ```javascript
   // Kategorisering (N teman):
   För varje kategori i:
     x = 100 + i * 450  // kolumnavstånd
     För varje kort j:
       y = 100 + j * 165  // radavstånd
   ```

4. **Meta-taggar (KRITISKT):**
   - `#zotero`, `#gemini`, `#calendar`, `#ocr`, `#drive`
   - MÅSTE alltid inkluderas i analys och gruppering
   - Representerar ofta 50%+ av användarens data

### Workflow: Hur AI resonerar

**Exempel: "Arrangera mina kort i 3 kategorier"**

1. **FÖRSTÅ:**
   - `getAllCards()` → hämta alla kort
   - Analysera tags (INKLUSIVE meta-taggar!)
   - Identifiera 3 meningsfulla teman

2. **PLANERA:**
   - Kategori A: 15 kort (#forskning, #zotero)
   - Kategori B: 22 kort (#möte, #calendar)
   - Kategori C: 8 kort (#idé)
   - Layout: 3 kolumner @ x=100, x=450, x=800

3. **KOMPONERA:**
   ```javascript
   updateCards({
     updates: [
       {id: 1, x: 100, y: 100, tags: ["forskning"]},
       {id: 2, x: 100, y: 265},
       // ... kategori A
       {id: 16, x: 450, y: 100, tags: ["möte"]},
       // ... kategori B
       {id: 38, x: 800, y: 100, tags: ["idé"]},
       // ... kategori C
     ]
   })
   ```

4. **FÖRKLARA:**
   - "Jag grupperade i Forskning (15 kort inklusive #zotero), Planering (22 kort inklusive #calendar), Kreativitet (8 kort)"
   - Transparent om resonemang och val

### Fördelar med denna arkitektur

✅ **Intelligent:** AI resonerar istället för pattern-matching
✅ **Flexibel:** Kan skapa VILKEN layout som helst
✅ **Transparent:** Förklarar sina val och beräkningar
✅ **Skalbar:** Ingen ny kod behövs för nya mönster
✅ **Användarvänlig:** Shortcuts och buttons fungerar som vanligt

### Testing och validering

**Test cases:**
1. "Arrangera i 3 kategorier" → ska skapa 3 kolumner, inte 60 grids
2. "Gruppera forskningskort" → ska inkludera #zotero-kort
3. "Visa veckan som tidslinje" → ska beräkna kronologisk layout
4. "Samla duplicerade kort" → ska identifiera och gruppera

**Success criteria:**
- AI förklarar sitt resonemang
- Meta-taggar inkluderas i alla operationer
- Spacing-principer följs (15px inom, 250px mellan)
- Användare behåller alla shortcuts

---

**Kom ihåg**: Målbilden är fortfarande 300-raders-moduler, men vi prioriterar stabilitet och fungerade features över perfekt arkitektur.
