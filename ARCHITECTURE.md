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

## Nuvarande status (2025-11-09)

### Fas 1: Organisering med sektioner ✅ KLART

**canvas.js** är nu organiserat i 13 tydliga sektioner:
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

**Hur du navigerar:**
- Använd Ctrl+F för att söka efter sektion markers: `// === SECTION X:`
- Varje sektion har en stor banner som är lätt att se
- Header-kommentaren listar alla sektioner

**Fördelar:**
- ✅ Lättare att hitta funktioner
- ✅ Tydlig struktur
- ✅ Ingen breaking changes
- ✅ Fungerar direkt

### Nästa steg

#### Fas 2: Flytta ut fristående helpers (Frivilligt)
När vi behöver lägga till funktionalitet kan vi överväga att flytta ut:
- Search helpers (matchWithWildcard, checkProximity, evaluateBooleanQuery)
- Color mapping utilities
- Små, isolerade funktioner utan dependencies

#### Fas 3: Full modularisering (Framtida arbete)
Om canvas.js växer ytterligare (>5000 rader), överväg:
- Skapa `CanvasManager` klass med state
- Dependency injection för stage, layer
- Dela upp i separata moduler

**Varför väntar vi?**
- Tight coupling mellan funktioner och global state
- Risk för buggar vid stor refactoring
- Nuvarande organisation är tillräckligt bra

## Riktlinjer framåt

1. **Innan du lägger till kod**: Kontrollera filstorlek med `wc -l`
2. **Om fil > 300 rader**: Lägg till ny sektion eller diskutera refactoring
3. **Följ sektionerna**: Lägg ny kod i rätt sektion
4. **Dokumentera**: Uppdatera header-kommentaren när du lägger till funktioner

---

**Kom ihåg**: När du lägger till en funktion, lägg den i rätt modul från början!
