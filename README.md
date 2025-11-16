# Spatial View

> En digital visuospatial sketchpad för dina handskrivna anteckningar

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://ximonse.github.io/spatial-view/)
[![Status](https://img.shields.io/badge/status-beta-orange)]()
[![Built with Vite](https://img.shields.io/badge/built%20with-Vite-646CFF)]()

## Vad är Spatial View?

Spatial View är en digital implementering av arbetsminnets [visuospatiala sketchpad](https://dictionary.apa.org/visuospatial-sketchpad) - den kognitiva komponent som hanterar visuell och spatial information.

### Varför spatial organisering?

I kognitiv psykologi vet vi att:
- **Spatial memory** är starkare än linjär minne
- **Visuell association** genom närhet skapar naturliga samband
- **Fri manipulation** i 2D-rum speglar hur vi tänker

Spatial View tar dessa principer och skapar en digital arbetsyta där du kan:

✨ **Organisera visuellt**: Placera kort fritt baserat på relationer
🧠 **Tänka spatialt**: Hitta information genom position, inte sök
🎨 **Skapa mönster**: Se samband genom spatial gruppering
📸 **Integrera bilder**: Importera foton av handskrivna anteckningar

## Snabbstart

### Online (rekommenderat)
Öppna direkt i webbläsaren: **[ximonse.github.io/spatial-view](https://ximonse.github.io/spatial-view/)**

Ingen installation krävs. All data sparas lokalt i din webbläsare.

### Lokalt (development)

```bash
# Klona repo
git clone https://github.com/ximonse/ximonse.github.io.git
cd ximonse.github.io/spatial-view

# Installera dependencies
npm install

# Starta dev server
npm run dev
```

## Nyckel-funktioner

### 🎯 Spatial Canvas
- Fri positionering av kort på 2D-canvas
- Touch-optimerad (pinch-to-zoom, swipe)
- Smooth Konva.js rendering

### 📝 Kort-typer
- **Text-kort**: Snabba anteckningar (Markdown-stöd)
- **Bild-kort**: Importera foton av handskrivet
- **Dubbelsidiga**: Text på baksidan av bilder

### 🔍 Boolean Search
```
(python OR javascript) AND NOT tutorial*
ord1 NEAR/5 ord2
```

### 🎨 Arrangering
- Vertikal/Horisontell
- Grid (flera varianter)
- Cirkel/Cluster
- Kanban-stil (överlappande)

### 💾 Backup
Ladda ner komplett backup:
- Alla kort som JSON
- Alla bilder som PNG
- Packade i zip-fil

### 🌓 Teman
- ☀️ Ljust
- 🌙 Mörkt
- 📄 E-ink (optimerat för e-papper)

### ⚙️ UI-lägen
1. **Full**: Alla knappar synliga
2. **Minimal**: Endast kommandopalett + toggle
3. **Micro**: Endast toggle-knapp

## Tangentbordsgenvägar

### Essentiella
- `Space` - Kommandopalett (visar alla kommandon)
- `K` - Toggle brädvy/kolumnvy
- `N` - Nytt kort
- `I` - Importera bild

### Editing
- `Dubbelklick` - Redigera kort
- `Ctrl+C/V` - Kopiera/Klistra in
- `Ctrl+Z/Y` - Ångra/Gör om

### Arrangering
- `V/H/G` - Vertikal/Horisontell/Grid
- `Q` - Cirkel
- `P` - Pinna kort (lås position)

### Data
- `B` - Backup (ladda ner zip)
- `S` - Exportera JSON
- `L` - Importera JSON

## Teknisk stack

- **[Konva.js](https://konvajs.org/)** - Canvas rendering
- **[Dexie.js](https://dexie.org/)** - IndexedDB wrapper
- **[Vite](https://vitejs.dev/)** - Build tool
- **[JSZip](https://stuk.github.io/jszip/)** - Backup zip-filer
- **[browser-image-compression](https://github.com/Donaldcwl/browser-image-compression)** - Bildkomprimering

## Byggning för production

```bash
# Bygg
npm run build

# Kopiera till root för GitHub Pages
cp dist/index.html index.html
cp -r dist/assets assets

# Commit och push
git add -A
git commit -m "Build production version"
git push origin master
```

Se [BUILD.md](BUILD.md) för detaljerad guide.

## Vetenskaplig bakgrund

### Visuospatial Sketchpad (Baddeley & Hitch, 1974)

I Alan Baddeleys klassiska modell av arbetsminne är den visuospatiala sketchpaden ansvarig för:

1. **Visuell cache**: Tillfällig lagring av visuell information
2. **Inner scribe**: Spatial och movement-planering
3. **Spatial manipulation**: Rotation och transformation av objekt

Spatial View digitaliserar dessa funktioner:
- **Visual cache** → Kort med text/bilder
- **Inner scribe** → Dra, arrangera, gruppera
- **Spatial manipulation** → Arrangerings-algoritmer

### Varför det fungerar

**Spatial memory** (O'Keefe & Nadel, 1978):
> "Platsceller i hippocampus skapar kognitiva kartor som är starkare än sekventiella minnen"

**Dual Coding Theory** (Paivio, 1971):
> "Information kodad både visuellt och verbalt ger starkare minnesförmåga"

Spatial View kombinerar dessa principer för optimalt lärande och minne.

## Status: Beta

⚠️ Detta är en beta-version. **Ladda ner backup regelbundet** om arbetet är viktigt.

Använd 💾 Backup-knappen för att exportera alla kort och bilder.

## Dokumentation

- [FEATURES.md](FEATURES.md) - Komplett funktionslista
- [BUILD.md](BUILD.md) - Build-instruktioner
- [ARCHITECTURE.md](ARCHITECTURE.md) - Kod-organisation

## Licens

MIT License - skapad av ximonse och Claude

## Referenser

- [Visuospatial Sketchpad (APA Dictionary)](https://dictionary.apa.org/visuospatial-sketchpad)
- Baddeley, A. D., & Hitch, G. (1974). Working Memory. *Psychology of Learning and Motivation*, 8, 47-89.
- O'Keefe, J., & Nadel, L. (1978). *The Hippocampus as a Cognitive Map*. Oxford University Press.
- Paivio, A. (1971). *Imagery and Verbal Processes*. Holt, Rinehart and Winston.

---

**[Live Demo →](https://ximonse.github.io/spatial-view/)**
