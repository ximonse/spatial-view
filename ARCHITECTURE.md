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

**Kom ihåg**: Målbilden är fortfarande 300-raders-moduler, men vi prioriterar stabilitet och fungerade features över perfekt arkitektur.
