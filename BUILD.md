# Build Instructions för Spatial View

## Development

Kör lokalt med Vite dev server:
```bash
npm run dev
```

Detta använder `index.html.dev` (om du har bytt tillbaka) eller kan peka direkt på src-filerna.

## Production Build

När du gör ändringar som ska till GitHub Pages:

### 1. Bygg projektet
```bash
npm run build
```

Detta skapar en `dist/` mapp med:
- Minifierad och bundlad JavaScript
- Optimerad CSS
- Production-ready index.html

### 2. Kopiera till root
```bash
# Spara dev-version (om du vill)
mv index.html index.html.dev

# Kopiera production build
cp dist/index.html index.html
cp -r dist/assets assets
```

### 3. Commit och push
```bash
git add -A
git commit -m "Build production version"
git push origin master
```

## Viktigt att komma ihåg

- **GitHub Pages kan INTE hantera ES modules från node_modules**
- Du måste bygga med Vite först innan du pushar
- `index.html` i root ska vara production-versionen
- `src/` behålls för development
- `dist/` och `index.html.dev` är gitignored

## Automatisk deploy (framtida förbättring)

Du kan lägga till GitHub Actions för att bygga automatiskt:
1. Commit endast src-ändringar
2. GitHub Actions kör `npm run build` automatiskt
3. Deployer till GitHub Pages

Men för nu: bygg manuellt innan push!
