# ADR 001: Bytte från Cytoscape.js till Konva.js

**Status:** Accepted  
**Datum:** 2025-11-08  
**Kontext:** spatial-notes-v2 använde Cytoscape.js för canvas-hantering

## Beslut
Vi byter från **Cytoscape.js** till **Konva.js** för canvas-hantering i Spatial View.

## Bakgrund
Cytoscape.js är byggt för:
- Graf-visualisering (nätverk, relationer, noder med edges)
- Force-directed layouts
- Graph algorithms

Vårt behov:
- Drag-and-drop canvas för kort
- Bilder och text-rendering
- Fri positionering (inte nätverksbaserad)

## Problem med Cytoscape
1. **Performance:** getMeasuredTextHeight kördes om och om igen
2. **Fel abstraktionsnivå:** Vi slogs MOT verktyget istället för att dra nytta av det
3. **Overhead:** Funktioner vi inte behöver (edges, graph algorithms)
4. **Komplexitet:** Svårt att anpassa för vårt use case

## Fördelar med Konva.js
1. **Canvas-first:** Byggt för drag-drop canvas med shapes
2. **Performance:** WebGL rendering, layer-baserad caching
3. **Events:** Robust event-system för touch och mouse
4. **Serialisering:** Inbyggt stöd för export/import av canvas state
5. **Community:** Aktivt underhållet, bra dokumentation
6. **Storlek:** Rimlig bundle size (~200KB vs Cytoscape ~500KB)

## Alternativ som övervägdes
- **Fabric.js:** Bra, men mindre community och sämre touch support
- **PixiJS:** Extreme performance men overkill för vårt behov
- **Ren Canvas API:** Full kontroll men måste bygga allt själv

## Konsekvenser
- ✅ Bättre performance för vårt use case
- ✅ Enklare kod och underhåll
- ✅ Touch-optimerat out of the box
- ❌ Måste migrera befintlig Cytoscape-kod
- ❌ Förlorar graph-baserade features (men vi använde dem inte)
