# Claude API Proxy Setup

## Problem
Anthropic API tillåter inte direkta anrop från webbläsare på grund av CORS-restriktioner. Detta är för att skydda API-nycklar från att exponeras i klientkod.

## Lösning
Vi använder en enkel proxy-server som körs lokalt och vidarebefordrar requests till Anthropic API.

## Starta applikationen

Du behöver nu köra **två** servrar samtidigt:

### Terminal 1: Vite Dev Server
```bash
npm run dev
```
Detta startar din huvudapplikation på `http://localhost:3003`

### Terminal 2: Claude API Proxy
```bash
npm run proxy
```
Detta startar proxy-servern på `http://localhost:3100`

## Hur det fungerar

1. **Din app** (`localhost:3003`) skickar request till **proxy** (`localhost:3100`)
2. **Proxy** vidarebefordrar request till **Anthropic API** (`api.anthropic.com`)
3. **Proxy** returnerar svaret till **din app**

```
Browser → Proxy → Anthropic API
  ↑         ↓
  └─────────┘
```

## Säkerhet

- API-nyckeln skickas via headers (inte i URL)
- Proxy körs lokalt på din dator
- Endast localhost-origins tillåts
- API-nyckeln sparas endast i localStorage i din webbläsare

## Filer

- `proxy-server.js` - Proxy-serverns kod
- `src/lib/claude.js` - Claude-integration (använder proxy)

## Deploying till Vercel

För produktion på Vercel behöver du **INTE** köra proxy-servern manuellt! 🎉

Vercel kör automatiskt serverless function i `api/claude.js`.

### Deploy till Vercel:

```bash
# Första gången
vercel

# För production deploy
vercel --prod
```

### Hur det fungerar:

Koden i `claude.js` detekterar automatiskt om den körs lokalt eller på Vercel:

- **Lokalt:** Använder `http://localhost:3100/api/anthropic/messages` (proxy-server)
- **Vercel:** Använder `/api/claude` (serverless function)

**Ingen konfiguration behövs!** Den växlar automatiskt. ✨

## Troubleshooting

### Lokalt: Proxy kör inte
```bash
# Kolla om port 3100 är upptagen
netstat -ano | findstr :3100

# Stoppa processen om den finns
taskkill /PID <process-id> /F
```

### Lokalt: CORS-fel
- Säkerställ att proxy körs (`npm run proxy`)
- Kolla att `localhost:3100` är tillgänglig
- Verifiera att `cors` paketet är installerat

### Vercel: API-fel
- Kolla Vercel Functions logs: `vercel logs`
- Verifiera att `api/claude.js` deployades korrekt
- Testa endpoint: `curl https://your-domain.vercel.app/api/claude`

### Generellt: API-fel
- Kolla att din Anthropic API-nyckel är giltig
- Se loggarna för felmeddelanden
