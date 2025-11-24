// Claude AI Integration for Spatial View

import { updateCard, getAllCards } from './storage.js';
import { reloadCanvas } from './canvas.js';

/**
 * Prompts the user for their Anthropic API key and saves it to localStorage.
 * @returns {Promise<string|null>} The API key, or null if the user cancels.
 */
function showClaudeAPIKeyDialog() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--bg-primary);
            color: var(--text-primary);
            border-radius: 12px;
            padding: 30px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        dialog.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: var(--text-primary);">🤖 Claude AI Assistent</h2>
            <p style="margin: 0 0 20px 0; color: var(--text-secondary); line-height: 1.6;">
                För att använda Claude AI behöver du en Anthropic API-nyckel.
            </p>
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); line-height: 1.6;">
                <strong>Så här skaffar du en nyckel:</strong><br>
                1. Gå till <a href="https://console.anthropic.com/settings/keys" target="_blank" style="color: var(--accent-color);">Anthropic Console</a><br>
                2. Skapa ett konto eller logga in<br>
                3. Klicka på "Create Key"<br>
                4. Klistra in nyckeln här nedan
            </p>
            <p style="margin: 0 0 15px 0; color: #e67e22; font-size: 13px;">
                ⚠️ Din API-nyckel sparas endast lokalt i din webbläsare.
            </p>
            <input type="password" id="claudeApiKeyInput" placeholder="sk-ant-..." style="
                width: 100%;
                padding: 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                font-family: monospace;
                font-size: 14px;
                box-sizing: border-box;
                margin-bottom: 20px;
                background: var(--bg-secondary);
                color: var(--text-primary);
            ">
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelApiKey" style="
                    padding: 10px 20px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">Avbryt</button>
                <button id="saveApiKey" style="
                    padding: 10px 20px;
                    border: none;
                    background: var(--accent-color);
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">Spara och fortsätt</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const input = document.getElementById('claudeApiKeyInput');
        input.focus();

        const closeDialog = (key = null) => {
            overlay.remove();
            resolve(key);
        };

        document.getElementById('cancelApiKey').onclick = () => closeDialog();

        document.getElementById('saveApiKey').onclick = () => {
            const key = input.value.trim();
            if (key) {
                localStorage.setItem('anthropicApiKey', key);
                closeDialog(key);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const key = input.value.trim();
                if (key) {
                    localStorage.setItem('anthropicApiKey', key);
                    closeDialog(key);
                }
            } else if (e.key === 'Escape') {
                closeDialog();
            }
        });
    });
}

/**
 * Gets the Anthropic API key from localStorage or prompts the user for it.
 * @returns {Promise<string|null>}
 */
async function getAnthropicAPIKey() {
    let apiKey = localStorage.getItem('anthropicApiKey');
    if (!apiKey) {
        apiKey = await showClaudeAPIKeyDialog();
    }
    return apiKey;
}

/**
 * Converts Gemini tool format to Claude tool format
 * @param {Array} geminiTools - Tools in Gemini format [{functionDeclarations: [...]}]
 * @returns {Array} Tools in Claude format
 */
function convertGeminiToolsToClaude(geminiTools) {
    if (!geminiTools || geminiTools.length === 0) return [];

    const declarations = geminiTools[0]?.functionDeclarations || [];

    return declarations.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
            type: 'object',
            properties: tool.parameters?.properties || {},
            required: tool.parameters?.required || []
        }
    }));
}

/**
 * Sends a prompt to Claude AI with function calling support
 * @param {string} userMessage - The user's message
 * @param {Array} tools - Array of tool definitions (Gemini format [{functionDeclarations: [...]}])
 * @param {Object} toolRegistry - Object with tool implementations
 * @param {Array} conversationHistory - Array of previous messages
 * @param {string} systemInstruction - System prompt
 * @returns {Promise<string>} Claude's response
 */
export async function sendClaudePrompt(userMessage, tools, toolRegistry, conversationHistory, systemInstruction) {
    const apiKey = await getAnthropicAPIKey();
    if (!apiKey) {
        throw new Error('No API key provided');
    }

    // Convert tools from Gemini format to Claude format
    const claudeTools = convertGeminiToolsToClaude(tools);

    // Build messages array
    const messages = [
        ...conversationHistory.map(msg => ({
            role: msg.role === 'system' ? 'assistant' : msg.role,
            content: msg.text || msg.content
        })),
        {
            role: 'user',
            content: userMessage
        }
    ];

    let response;
    let continueLoop = true;
    const maxIterations = 10;
    let iteration = 0;

    while (continueLoop && iteration < maxIterations) {
        iteration++;

        const payload = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemInstruction,
            messages: messages,
            tools: claudeTools
        };

        console.log('🤖 Sending to Claude:', payload);

        // Use proxy server to avoid CORS issues
        // Auto-detect: localhost proxy for dev, Vercel function for production
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiUrl = isLocalhost
            ? 'http://localhost:3100/api/anthropic/messages'
            : '/api/claude';

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('Claude API error:', errorText);
            throw new Error(`Claude API error: ${apiResponse.status} ${errorText}`);
        }

        response = await apiResponse.json();
        console.log('🤖 Claude response:', response);

        // Check if Claude wants to use tools
        const toolUseBlock = response.content.find(block => block.type === 'tool_use');

        if (toolUseBlock) {
            console.log('🔧 Claude wants to use tool:', toolUseBlock.name);

            // Execute the tool
            const toolFunction = toolRegistry[toolUseBlock.name];
            if (!toolFunction) {
                throw new Error(`Tool ${toolUseBlock.name} not found in registry`);
            }

            let toolResult;
            try {
                toolResult = await toolFunction(toolUseBlock.input);
                console.log('✅ Tool result:', toolResult);
            } catch (error) {
                console.error('❌ Tool execution error:', error);
                toolResult = `Error: ${error.message}`;
            }

            // Add assistant message with tool use
            messages.push({
                role: 'assistant',
                content: response.content
            });

            // Add tool result
            messages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: toolUseBlock.id,
                    content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
                }]
            });

            // Continue the loop to get Claude's response
            continue;
        }

        // No more tool calls, we're done
        continueLoop = false;
    }

    // Extract text response
    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'Inget svar från Claude.';
}

/**
 * Initialize Claude assistant UI
 * @param {Object} toolRegistry - Object with tool implementations
 * @returns {Object} UI controls
 */
export function initClaudeAssistant(toolRegistry) {
    // System instruction - same as Gemini but adapted for Claude
    const systemInstruction = `Du är en INTELLIGENT AI-ASSISTENT för Spatial View - en visuell second brain med djup spatial förståelse.

═══════════════════════════════════════════════════════════════════
🎯 FILOSOFI: Förstå - Resonera - Komponera
═══════════════════════════════════════════════════════════════════

Du är INTE en robot som följer fördefinierade arrangemang. Du är en INTELLIGENT assistent som:
✅ Förstår spatial organisation och visuell kommunikation
✅ Komponerar lösningar från grundläggande operationer
✅ Resonerar om rumsliga relationer och hierarkier
✅ Anpassar organisering efter innehåll och kontext

**Nyckelprincip:** "En duktig hantverkare med hammare och såg kommer längre än en nybörjare med 30 specialverktyg."

═══════════════════════════════════════════════════════════════════
📐 SPATIAL FÖRSTÅELSE - GRUNDLÄGGANDE KUNSKAP
═══════════════════════════════════════════════════════════════════

**Kort-dimensioner:**
- Varje kort är exakt 200px × 150px
- Detta är FAST - använd dessa mått i ALLA beräkningar
- Tänk på kort som fysiska objekt med dessa dimensioner

**Spacing och semantik:**
- **13-20px mellanrum** = samma grupp/kategori/tema
  → Använd 15px som standard inom grupp
  → Visuell signatur: "dessa hör ihop"

- **200-300px mellanrum** = olika grupper/kategorier/teman
  → Använd 250px som standard mellan grupper
  → Visuell signatur: "dessa är separata koncept"

**Canvas-geometri:**
- Oändligt 2D-koordinatsystem (x, y)
- Börja organisering från (100, 100) för margin
- Positiva värden (x ökar åt höger, y ökar nedåt)

**Visuella mönster:**
- **Grid (rutnät):** Regelbunden struktur, lika viktighet
  → Kolumner: x += 215px (200 + 15px spacing)
  → Rader: y += 165px (150 + 15px spacing)

- **Kluster:** Relaterade kort nära varandra, tydligt separerade från andra kluster
  → Inom kluster: 15px spacing
  → Mellan kluster: 250px+ spacing

- **Timeline (tidslinje):** Visar progression eller kronologi
  → Horisontell: x ökar med tiden, y grupperar kategorier
  → Vertikal: y ökar med tiden, x grupperar kategorier

- **Hierarki:** Central → omgivande, eller topp → botten
  → Viktigt i centrum eller överst
  → Detaljer runt eller nedåt

═══════════════════════════════════════════════════════════════════
🧠 META-TAGGAR - KRITISKT VIKTIGT!
═══════════════════════════════════════════════════════════════════

**Vad är meta-taggar?**
Meta-taggar är auto-genererade systemtaggar som börjar med # och indikerar KÄLLan eller PROCESSen för ett kort.

**Vanliga meta-taggar:**
- **#zotero**: Importerat från Zotero (forskningslitteratur)
- **#gemini**: Skapat eller bearbetat av Gemini AI
- **#claude**: Skapat eller bearbetat av Claude AI
- **#calendar**: Importerat från Google Calendar
- **#ocr**: Text extraherad via OCR från bild
- **#drive**: Synkat från Google Drive

**ABSOLUT REGEL:**
→ Meta-taggar MÅSTE ALLTID räknas med i analys och gruppering
→ När användaren säger "organisera mina kort", inkludera kort med meta-taggar
→ När du räknar "alla kort" eller "alla taggar", räkna meta-taggar
→ Meta-taggar är INTE mindre viktiga än vanliga taggar

═══════════════════════════════════════════════════════════════════
💡 SÅ HÄR RESONERAR DU SOM SPATIAL ASSISTENT
═══════════════════════════════════════════════════════════════════

**Steg 1: FÖRSTÅ**
1. Hämta alla kort med getAllCards()
2. Analysera innehåll och tags (INKLUSIVE meta-taggar!)
3. Identifiera meningsfulla teman/kategorier

**Steg 2: PLANERA**
Designa layouten baserat på innehållet

**Steg 3: KOMPONERA**
Använd updateCards() för att flytta kort till rätt positioner

**Steg 4: FÖRKLARA**
Berätta för användaren vad du gjorde och varför

═══════════════════════════════════════════════════════════════════
📋 VANLIGA ARRANGEMANGSMÖNSTER
═══════════════════════════════════════════════════════════════════

**Kategorisering (flera teman/tags):**
- N kategorier → N kolumner
- Kolumn i: x = 100 + i * 450
- Inom kolumn: y = 100 + j * 165

**Timeline (kronologisk):**
- Sortera kort efter datum
- Horisontell eller vertikal layout

**Kluster (gemensamt innehåll):**
- Gruppera relaterade kort
- 15px inom kluster, 250px mellan kluster

═══════════════════════════════════════════════════════════════════
**SPRÅK:** Svenska
**SAMMANFATTNING:** Du är en INTELLIGENT spatial assistent som förstår geometri, resonerar om layout, och komponerar lösningar. Meta-taggar MÅSTE alltid inkluderas!`;

    const conversationHistory = [];

    return {
        sendPrompt: async (userMessage) => {
            // Convert toolRegistry functions to tool definitions
            const tools = Object.keys(toolRegistry).map(name => {
                // This is a simplified conversion - in production you'd want proper schemas
                return {
                    name: name,
                    description: `Tool: ${name}`,
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                };
            });

            const response = await sendClaudePrompt(
                userMessage,
                tools,
                toolRegistry,
                conversationHistory,
                systemInstruction
            );

            // Add to history
            conversationHistory.push({ role: 'user', text: userMessage });
            conversationHistory.push({ role: 'assistant', text: response });

            return response;
        },
        clearHistory: () => {
            conversationHistory.length = 0;
        }
    };
}
