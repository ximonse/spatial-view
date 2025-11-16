# Spatial View - Funktioner

## Översikt
En digital **visuospatial sketchpad** för handskrivna anteckningar med Konva.js canvas-rendering.

### Vad är en visuospatial sketchpad?
I kognitiv psykologi refererar [visuospatial sketchpad](https://dictionary.apa.org/visuospatial-sketchpad) till arbetsminnets komponent som hanterar och manipulerar visuell och spatial information. Spatial View efterliknar denna kognitiva funktion digitalt - den låter dig:

- **Organisera visuellt**: Placera kort fritt i 2D-rummet baserat på relationer och samband
- **Spatial memory**: Kom ihåg var saker finns genom deras position
- **Manipulera fritt**: Dra, gruppera och arrangera information som på en fysisk whiteboard
- **Visuell association**: Se mönster och relationer genom spatial närhet

Precis som arbetsminnets visuospatiala komponent är Spatial View din digitala canvas för att tänka visuellt och spatialt.

## Nyligen tillagda funktioner (2025-11-09)

### ✅ K-tangent för vy-toggle
- Tryck `K` för att växla mellan brädvy och kolumnvy
- Fungerar i alla lägen

### ✅ E-ink tema optimering
- Inga gradienter, skuggor eller toningar
- Svarta 2px kanter på alla kort
- Inga rundade hörn (cornerRadius: 0)
- Vita bakgrunder på kort
- Perfekt för e-ink skärmar

### ✅ Tre UI-lägen
**Toggle-knapp:** 👁️ UI i toolbar

1. **Mode 1 (Full)**
   - Alla knappar synliga
   - Toolbar med alla funktioner
   - Floating buttons (⌘, +, 🔍)

2. **Mode 2 (Minimal)** - Standard för touch/e-ink
   - Endast kommandopalett-knapp (⌘)
   - UI toggle-knapp (👁️)
   - Toolbar synlig men enklare

3. **Mode 3 (Toggle-only)**
   - Endast toggle-knapp synlig
   - Maximal skärmyta för canvas
   - Använd kommandopaletten (Space) för allt

### ✅ SPATIAL VIEW floating header
- Alltid synlig längst upp till vänster
- Svart serif-font (Georgia)
- Tar inte från canvas-ytan
- Klickbar för att öppna info-overlay

### ✅ Info overlay
När du klickar på "SPATIAL VIEW":
- Beskrivning av appen
- Credits: ximonse och Claude
- Beta-varning: "Ladda ner regelbundet!"
- Snabbguide med ikoner:
  - ⌘ Kommandopalett (Space)
  - + Lägg till
  - 🎨 Tema (ljust/mörkt/e-ink)
  - 🔄 Vy (K för toggle)
  - 👁️ UI-läge
  - 🔍 Sök (Boolean search)
- Tips-sektion

### ✅ Backup-funktion
**Knapp:** 💾 Backup i toolbar
**Kommando:** B i kommandopaletten

Laddar ner zip-fil med:
- `cards.json`: All kort-data (position, text, tags, etc)
- `images/`: Alla bilder från korten
  - Format: `card_{id}.png`
  - Base64 PNG-data

Filnamn: `spatial-view-backup-YYYY-MM-DD.zip`

## Befintliga funktioner

### Canvas & Rendering
- Konva.js för smooth canvas-rendering
- Touch-optimerad
- Pinch-to-zoom på touch-enheter
- Dra kort, multi-select (Ctrl+klick)
- Ctrl+Drag för panorering

### Kort-typer
- Text-kort (gula post-it stil)
- Bild-kort (importera foton/skärmdumpar)
- Dubbelsidiga kort (text på baksidan av bilder)

### Editing
- Dubbelklicka för att redigera
- Inline editor med Markdown preview
- Bulk editor för flera kort samtidigt
- Touch bulk menu (mobil)

### Sök
- Boolean search: AND, OR, NOT
- Wildcards: `*` (flera tecken), `?` (ett tecken)
- Proximity search: `ord1 NEAR/5 ord2`
- Exempel: `(python OR javascript) AND NOT tutorial*`

### Arrangering
Arrangera markerade kort i mönster:
- Vertikal kolumn (V)
- Horisontell rad (H)
- Grid (G)
- Cirkel/Cluster (Q)
- Grid vertikal (G+V)
- Grid horisontell (G+H)
- Grid överlappande Kanban-stil (G+T)

### Copy/Paste
- Ctrl+C: Kopiera markerade kort
- Ctrl+V: Klistra in vid muspekare
- Kan kombineras med arrangering (Q, G+V etc)

### Undo/Redo
- Ctrl+Z: Ångra
- Ctrl+Y: Gör om
- Fungerar för:
  - Skapa/radera kort
  - Redigera text
  - Flytta kort
  - Bulk-ändringar

### Kort-actions
- Pinna kort (P): Låser position, kan inte flyttas
- Färglägg kort: Olika färger för kategorisering
- Flip: Vänd bild-kort för att se text på baksidan
- Lock/Unlock: Lås kort från redigering
- Ta bort: Delete-tangent eller kontextmeny

### Import/Export
- **Importera bilder**: Välj flera bilder samtidigt
- **Bildkvalitet**: Välj Normal, Hög eller Original
  - Normal: 800px, 80% kvalitet
  - Hög: 1200px, 90% kvalitet
  - Original: Ingen komprimering
- **Exportera JSON**: S i kommandopaletten
- **Importera JSON**: L i kommandopaletten
- **Backup (NY!)**: B i kommandopaletten - alla kort + bilder som zip

### Teman
Byt tema med 🎨-knappen eller kommandopaletten:
- ☀️ Ljust (standard)
- 🌙 Mörkt
- 📄 E-ink (optimerad för e-papper skärmar)

### Vyer
- 🗂️ Brädvy (canvas): Fri positionering, spatial view
- 📋 Kolumnvy: Scrollbar lista sorterad efter senast ändrad

### Kommandopalett
Öppna med **Space**:
- Visar alla tillgängliga kommandon
- Snabb åtkomst till funktioner
- Tangentbordsgenvägar listade
- Tips och beskrivningar

### Storage
- IndexedDB med Dexie.js
- Lokal lagring i webbläsaren
- Bilder sparas som base64
- Ingen server, all data lokalt

## Tangentbordsgenvägar

### Navigation & View
- `Space`: Kommandopalett
- `K`: Toggle brädvy/kolumnvy
- `Escape`: Avmarkera alla kort, rensa sök

### Editing
- `N`: Nytt text-kort
- `I`: Importera bild
- `F`: Fokusera sökfält
- `Double-click`: Redigera kort

### Copy/Paste/Undo
- `Ctrl+C`: Kopiera
- `Ctrl+V`: Klistra in
- `Ctrl+Z`: Ångra
- `Ctrl+Y`: Gör om
- `Ctrl+D`: Duplicera

### Arrangering
- `V`: Vertikal
- `H`: Horisontell
- `G`: Grid
- `Q`: Cirkel/Cluster
- `G+V`: Grid vertikal
- `G+H`: Grid horisontell
- `G+T`: Grid överlappande (Kanban)

### Actions
- `P`: Pinna/Avpinna kort
- `Delete`: Ta bort markerade kort
- `Ctrl+A`: Markera alla kort

### Import/Export/Backup
- `S`: Exportera JSON
- `L`: Importera JSON
- `B`: Ladda ner backup (NY!)

## Enhetsstöd

### Desktop
- Full funktionalitet
- Alla kortkommandon
- Mouse + keyboard workflow

### Tablet/Mobile
- Touch-optimerad
- Pinch-to-zoom
- Swipe för panorering
- Touch bulk menu (håll + välj flera kort)
- Standard UI-läge: Minimal

### E-ink (Viwoood AiPaper Mini, etc)
- Auto-detected
- E-ink tema aktiveras automatiskt
- Inga animationer
- Kolumnvy som standard
- Standard UI-läge: Minimal

## Teknisk stack
- **Konva.js**: Canvas rendering
- **Dexie.js**: IndexedDB wrapper
- **JSZip**: Backup zip-filer
- **Vite**: Build tool & dev server
- **browser-image-compression**: Bildkomprimering
- **marked**: Markdown rendering (editor preview)

## Beta-varning
Detta är en beta-version som kan vara ostabil.
**Ladda ner backup regelbundet om arbetet är viktigt!**

Använd 💾 Backup-knappen för att spara alla kort och bilder.
