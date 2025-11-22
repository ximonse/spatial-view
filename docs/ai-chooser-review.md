# Uppdaterad genomgång av "Fråga AI"

## Vad som redan finns
- Gemini (Google `gemini-2.5-flash`) och ChatGPT (`gpt-4o`) stöds. Båda använder samma verktygsuppsättning och startar i ett tokensnålt läge med korta svar.
- Kontextöversikten från `buildAIContextSnapshot(...)` skickas i början av en ny konversation för båda modellerna.

## Nytt i ask/chooser-flödet
- `showAIChooser` bygger och visar en komprimerad kontextöversikt innan man väljer modell, så användaren ser vad som skickas vidare.
- Startintentioner (sammanfatta markerade, nästa steg, agenda, egen fråga) skickas automatiskt som första prompt för att spara klick och tokens.
- Efter kontextinjiceringen loggas tydliga systemmeddelanden om att läget är tokensnålt (korta svar, återanvänd kontext, använd verktyg i stället för långa resonemang).

## Modellval och lämplighet
- **Gemini 2.5 Flash**: Snabb och tokensnål för verktygsdrivna operationer och OCR-flöden. Passar bra när många kort ska analyseras snabbt.
- **gpt-4o**: Ger märkbart bättre resonemang och verktygsplanering än mini-varianten utan att kräva extrema promptar. Den är dyrare per token än `gpt-4o-mini`, men tokensparande-läget (kortare svar, återanvänd kontext, aggressiv verktygsanvändning) begränsar förbrukningen.
