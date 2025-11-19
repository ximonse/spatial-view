// Gemini AI Integration for Spatial View                                                                                                
                                                                                                                                         
import { updateCard, getAllCards } from './storage.js';                                                                                  
import { reloadCanvas } from './canvas.js';                                                                                              
                                                                                                                                         
/**                                                                                                                                      
 * Prompts the user for their Google AI API key and saves it to localStorage.                                                            
 * @returns {Promise<string|null>} The API key, or null if the user cancels.                                                             
 */                                                                                                                                      
function showGoogleAIAPIKeyDialog() {
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
            <h2 style="margin: 0 0 20px 0; color: var(--text-primary);">✨ Gemini AI Assistent</h2>                                       
            <p style="margin: 0 0 20px 0; color: var(--text-secondary); line-height: 1.6;">                                              
                För att använda bildigenkänning med Gemini behöver du en Google AI API-nyckel.                                           
            </p>                                                                                                                         
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); line-height: 1.6;">                                              
                <strong>Så här skaffar du en nyckel:</strong><br>                                                                        
                1. Gå till <a href="https://makersuite.google.com/app/apikey" target="_blank" style="color: var(--accent-color);">Google 
AI Studio</a><br>                                                                                                                        
                2. Skapa ett konto eller logga in<br>                                                                                    
                3. Klicka på "Create API key"<br>                                                                                        
                4. Klistra in nyckeln här nedan                                                                                          
            </p>                                                                                                                         
            <p style="margin: 0 0 15px 0; color: #e67e22; font-size: 13px;">                                                             
                ⚠️ Din API-nyckel sparas endast lokalt i din webbläsare.                                                                  
            </p>                                                                                                                         
            <input type="password" id="googleAiApiKeyInput" placeholder="Din Google AI API-nyckel..." style="                            
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
                                                                                                                                         
        const input = document.getElementById('googleAiApiKeyInput');                                                                    
        input.focus();                                                                                                                   
                                                                                                                                         
        const closeDialog = (key = null) => {                                                                                            
            overlay.remove();                                                                                                            
            resolve(key);                                                                                                                
        };                                                                                                                               
                                                                                                                                         
        document.getElementById('cancelApiKey').onclick = () => closeDialog();                                                           
                                                                                                                                         
        document.getElementById('saveApiKey').onclick = () => {                                                                          
            const apiKey = input.value.trim();                                                                                           
            if (apiKey) {                                                                                                                
                localStorage.setItem('googleAiApiKey', apiKey);                                                                          
                closeDialog(apiKey);                                                                                                     
            } else {                                                                                                                     
                alert('Vänligen ange en giltig API-nyckel.');                                                                            
            }                                                                                                                            
        };                                                                                                                               
                                                                                                                                         
        input.addEventListener('keydown', (e) => {                                                                                       
            if (e.key === 'Enter') {                                                                                                     
                document.getElementById('saveApiKey').click();                                                                           
            }                                                                                                                            
        });                                                                                                                              
                                                                                                                                         
        overlay.addEventListener('keydown', (e) => {                                                                                     
            if (e.key === 'Escape') {                                                                                                    
                closeDialog();                                                                                                           
            }                                                                                                                            
        });                                                                                                                              
    });                                                                                                                                  
}
                                                                                                                                         
/**                                                                                                                                      
 * Retrieves the Google AI API key from localStorage or prompts the user for it.                                                         
 * @returns {Promise<string|null>} The API key or null.                                                                                  
 */                                                                                                                                      
export async function getGoogleAIAPIKey() {                                                                                                     
    let apiKey = localStorage.getItem('googleAiApiKey');                                                                                 
    if (!apiKey) {                                                                                                                       
        apiKey = await showGoogleAIAPIKeyDialog();                                                                                       
    }                                                                                                                                    
    return apiKey;                                                                                                                       
}
                                                                                                                                         
/**                                                                                                                                      
 * Calls the Gemini API with the provided image data and a complex prompt.                                                               
 * @param {string} apiKey - The Google AI API key.                                                                                       
 * @param {string} imageData - The base64 encoded image data.                                                                            
 * @returns {Promise<Object>} The JSON response from the API.                                                                            
 */                                                                                                                                      
async function callGeminiAPI(apiKey, imageData) {                                                                                        
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;                
                                                                                                                                         
    const payload = {                                                                                                                    
        contents: [                                                                                                                      
            {                                                                                                                            
                parts: [                                                                                                                 
                    {                                                                                                                    
                        text: `Transkribera texten från bilden exakt som den är skriven och extrahera metadata.                          
                                                                                                                                         
OM BILDEN INTE HAR NÅGON TEXT: Beskriv kort vad bilden visar (1-2 meningar).                                                             
                                                                                                                                         
VIKTIGT: Svara ENDAST med en JSON-struktur enligt detta format:                                                                          
                                                                                                                                         
{                                                                                                                                        
  "text": "[transkriberad text här, eller tom sträng om ingen text]",                                                              
  "description": "[kort bildbeskrivning om ingen text finns, annars null]",                                                              
  "metadata": {                                                                                                                          
    "extractedDate": "YYYY-MM-DD eller null",                                                                                            
    "extractedTime": "HH:MM eller null",                                                                                                 
    "extractedDateTime": "YYYY-MM-DDTHH:MM eller null (kombinera datum+tid)",                                                            
    "extractedPeople": ["person1", "person2"] eller [],                                                                                  
    "extractedPlaces": ["plats1", "plats2"] eller []                                                                                     
  },                                                                                                                                     
  "hashtags": ["tag1", "tag2", "tag3"]                                                                                            
}                                                                                                                                        
                                                                                                                                         
HASHTAG-REGLER:                                                                                                                          
1. Datumtaggar: Om datum hittas, skapa #YYMMDD (ex: #250819 för 2025-08-19)                                                              
2. Veckotaggar: Om datum känt, skapa #YYvVV (ex: #25v44 för vecka 44, 2025)                                                              
3. Kategoritaggar: #möte #anteckning #todo #faktura #kontrakt #brev #kvitto #foto etc                                                    
4. Namntaggar: Personer som nämns, normaliserade (ex: #smith #jones)                                                                     
5. Platstaggar: Platser som nämns (ex: #stockholm #kontoret)                                                                             
                                                                                                                                         
METADATA-INSTRUKTIONER:                                                                                                                  
- extractedDate: Extrahera datum från SYNLIG text i bilden (YYYY-MM-DD format)                                                           
- extractedTime: Extrahera tid från SYNLIG text (HH:MM format)                                                                           
- extractedDateTime: Om både datum OCH tid finns, kombinera till ISO-format (YYYY-MM-DDTHH:MM)                                           
- extractedPeople: Lista alla personnamn som nämns i texten                                                                              
- extractedPlaces: Lista alla platser/adresser som nämns                                                                                 
                                                                                                                                         
BESKRIVNING-INSTRUKTIONER:                                                                                                               
- Om bilden INTE har någon läsbar text: Beskriv kort vad som visas (ex: "En solnedgång över havet", "En katt på en soffa")               
- Om bilden HAR text: Sätt description till null                                                                                         
- Håll beskrivningen kort och koncis (max 2 meningar)                                                                                    
                                                                                                                                         
OBS: Vi kommer senare även lägga till EXIF-metadata från filen (GPS, filskapare, originaldatum etc), så håll strukturen ren.`            
                    },
                    {
                        inline_data: {
                            mime_type: "image/jpeg", // Assuming JPEG, adjust if needed
                            data: imageData.split(',')[1]
                        }
                    }
                ]
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || `API request failed with status ${response.status}`);
    }

    return response.json();
}

/**
 * Main function to read an image card with Gemini, process the result, and update the card.
 * @param {number} cardId - The ID of the card to process.
 */
export async function readImageWithGemini(cardId) {
    const apiKey = await getGoogleAIAPIKey();
    if (!apiKey) {
        console.log('Gemini OCR cancelled: No API key provided.');
        return;
    }

    const allCards = await getAllCards();
    const card = allCards.find(c => c.id === cardId);

    if (!card || !card.image || !card.image.base64) {
        alert('Ingen bilddata hittades för detta kort.');
        return;
    }

    // Simple loading indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.textContent = '✨ Läser bild med Gemini...';
    statusIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10001;
        font-family: sans-serif;
    `;
    document.body.appendChild(statusIndicator);

    try {
        const response = await callGeminiAPI(apiKey, card.image.base64);

        if (!response || !response.candidates || !response.candidates[0].content || !response.candidates[0].content.parts) {
            throw new Error('Invalid response structure from Gemini API.');
        }

        const rawText = response.candidates[0].content.parts[0].text;

        let parsedData;
        try {
            const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
            const jsonText = jsonMatch ? jsonMatch[1] : rawText;
            parsedData = JSON.parse(jsonText.trim());
        } catch (parseError) {
            console.warn('Failed to parse JSON, falling back to raw text:', parseError);
            parsedData = { text: rawText, hashtags: [] };
        }

        const mainContent = parsedData.text || parsedData.description || '';

        const existingTags = card.tags || [];
        const newTags = (parsedData.hashtags || []).map(tag => tag.replace('#', ''));
        const mergedTags = [...new Set([...existingTags, ...newTags])];

        const updates = {
            text: mainContent,  // Put extracted text in main text field
            tags: mergedTags,
            geminiMetadata: parsedData.metadata || {} // Store metadata
        };

        await updateCard(cardId, updates);
        await reloadCanvas();

        statusIndicator.textContent = '✅ Bilden är analyserad!';
    } catch (error) {
        console.error('Error reading image with Gemini:', error);
        statusIndicator.textContent = `❌ Fel: ${error.message}`;
    } finally {
        setTimeout(() => {
            statusIndicator.remove();
        }, 3000);
    }
}

/**
 * Execute Gemini Agent with function calling capabilities
 * @param {string} query - User's query
 * @param {Array} tools - Array of tool definitions for Gemini
 * @param {Object} toolRegistry - Map of tool names to their implementation functions
 * @param {Array} chatHistory - Optional conversation history from chat UI [{role, text}, ...]
 * @returns {Promise<string>} - Gemini's response
 */
export async function executeGeminiAgent(query, tools, toolRegistry, chatHistory = []) {
    const apiKey = await getGoogleAIAPIKey();
    if (!apiKey) {
        throw new Error('No API key provided');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Build conversation history in Gemini API format
    // Transform chat UI format {role: 'user'|'assistant', text: '...'}
    // to Gemini format {role: 'user'|'model', parts: [{text: '...'}]}
    const conversationHistory = chatHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.text }]
    }));

    // Add current query if not already in history
    if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length - 1].parts[0].text !== query) {
        conversationHistory.push({
            role: 'user',
            parts: [{ text: query }]
        });
    }

    // System instruction explaining Gemini's purpose and capabilities
    const systemInstruction = `Du är en AI-assistent för Spatial View, en visuell digital arbetsyta för handskrivna anteckningar och idéer.

DITT SYFTE:
- Hjälpa användare att organisera, söka, och arrangera kort på en oändlig canvas
- Analysera kort baserat på innehåll, datum, tags och metadata
- Föreslå och utföra visuella arrangemang (mind maps, Kanban, tidslinjer, kluster, etc.)

SPATIAL VIEW GRUNDKONCEPT:
- Användaren skapar "kort" (cards) som kan innehålla text, bilder, eller båda
- Varje kort har: text, backText (transkriberad text från bilder), tags, färg, position, skapandedatum
- Kort kan ha Gemini-extraherad metadata: extractedDate, extractedDateTime, extractedPeople, extractedPlaces
- Användaren kan markera kort genom sökning eller manuellt

DINA VERKTYG:
Du har tillgång till flera verktyg för att hjälpa användaren:
- **listAllTags**: ANVÄND DETTA FÖRST när användaren frågar om tags eller vill organisera efter kategori
- Sökning och filtrering (searchCards, getAllCards, filterByTag, filterByDate, filterByMentionedDate)
- Visuella arrangemang (Grid, Timeline, Kanban, Mind Map, Cluster)
- Datum- och tidsbaserad organisering

VIKTIGT - Tag Discovery:
När användaren säger "visa kort med tagg X" eller "organisera efter kategori":
1. Använd FÖRST listAllTags för att se vilka tags som finns
2. Hitta närmaste matchning (t.ex. "zotero" om användaren säger "Zotero")
3. Använd sedan filterCardsByTag eller arrangeCardsKanban

VIKTIGT - Bildkort vs Textkort:
När användaren säger "visa bilder", "bildkort", "kort med bilder" etc:
- Använd filterImageCards (hasImage: true) - INTE filterCardsByTag("bild")
- Du kan AUTOMATISKT detektera om ett kort innehåller en bild
- När användaren säger "visa textkort" eller "kort utan bilder":
  - Använd filterImageCards (hasImage: false)

KOMMUNIKATIONSSTIL:
- **VAR PROAKTIV**: Använd verktyg DIREKT istället för att fråga om lov
- **AGERA, FRÅGA INTE**: Om användaren ber om något, GÖR det direkt
- Var koncis och handlingskraftig
- Förklara vad du GÖR (inte vad du "kan göra" eller "ska göra")
- Använd svenska (all UI och användare är svenskspråkiga)

VIKTIGT - PROAKTIVITET:
❌ FEL: "Ska jag lista alla taggar?"
✓ RÄTT: *Använder listAllTags direkt* "Jag hittar följande kategorier..."

❌ FEL: "Vill du att jag organiserar korten?"
✓ RÄTT: *Använder arrangeCardsGrid direkt* "Jag organiserar korten nu..."

EXEMPEL PÅ ANVÄNDNING:
- "Visa kort från vecka 46" → Använd filterCardsByDateRange
- "Organisera alla möten" → Använd listAllTags först, sedan filterCardsByTag + arrangeCardsGrid
- "Gör en tidslinje" → Använd arrangeCardsTimeline
- "Skapa en mindmap" → Använd arrangeCardsMindMap
- "Visa alla bilder" → Använd filterImageCards (hasImage: true)
- "Visa textkort" → Använd filterImageCards (hasImage: false)
- "Vilka taggar finns?" → Använd listAllTags`;

    // Initial request with tools, conversation history, and system instruction
    const payload = {
        contents: conversationHistory,
        tools: tools,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        }
    };

    let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    let data = await response.json();

    // Handle function calls in a loop (conversationHistory already initialized above)

    while (data.candidates?.[0]?.content?.parts) {
        const parts = data.candidates[0].content.parts;

        // Add assistant response to history
        conversationHistory.push({ role: 'model', parts: parts });

        // Check if there are function calls
        const functionCalls = parts.filter(part => part.functionCall);

        if (functionCalls.length === 0) {
            // No more function calls, return the text response
            const textPart = parts.find(part => part.text);
            return textPart?.text || 'Gemini svarade utan text.';
        }

        // Execute all function calls
        const functionResponses = [];
        for (const fc of functionCalls) {
            const funcName = fc.functionCall.name;
            const funcArgs = fc.functionCall.args || {};

            console.log(`Executing tool: ${funcName}`, funcArgs);

            if (toolRegistry[funcName]) {
                try {
                    const result = await toolRegistry[funcName](funcArgs);
                    functionResponses.push({
                        functionResponse: {
                            name: funcName,
                            response: { result: result }
                        }
                    });
                } catch (error) {
                    functionResponses.push({
                        functionResponse: {
                            name: funcName,
                            response: { error: error.message }
                        }
                    });
                }
            } else {
                functionResponses.push({
                    functionResponse: {
                        name: funcName,
                        response: { error: `Function ${funcName} not found` }
                    }
                });
            }
        }

        // Send function responses back to Gemini
        conversationHistory.push({ parts: functionResponses });

        const followUpPayload = {
            contents: conversationHistory,
            tools: tools,
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            }
        };

        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(followUpPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Follow-up request failed`);
        }

        data = await response.json();
    }

    return 'Gemini slutade svara oväntat.';
}

// ============================================================================
// OPENAI / CHATGPT INTEGRATION
// ============================================================================

/**
 * Prompts the user for their OpenAI API key and saves it to localStorage.
 * @returns {Promise<string|null>} The API key, or null if the user cancels.
 */
function showOpenAIAPIKeyDialog() {
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
            <h2 style="margin: 0 0 20px 0; color: var(--text-primary);">💬 ChatGPT AI Assistent</h2>
            <p style="margin: 0 0 20px 0; color: var(--text-secondary); line-height: 1.6;">
                För att använda ChatGPT behöver du en OpenAI API-nyckel.
            </p>
            <p style="margin: 0 0 15px 0; color: var(--text-secondary); line-height: 1.6;">
                <strong>Så här skaffar du en nyckel:</strong><br>
                1. Gå till <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--accent-color);">OpenAI Platform</a><br>
                2. Skapa ett konto eller logga in<br>
                3. Klicka på "Create new secret key"<br>
                4. Klistra in nyckeln här nedan
            </p>
            <p style="margin: 0 0 15px 0; color: #e67e22; font-size: 13px;">
                ⚠️ Din API-nyckel sparas endast lokalt i din webbläsare.
            </p>
            <input type="password" id="openaiApiKeyInput" placeholder="sk-..." style="
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
                <button id="cancelOpenAIKey" style="
                    padding: 10px 20px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                ">Avbryt</button>
                <button id="saveOpenAIKey" style="
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

        const input = document.getElementById('openaiApiKeyInput');
        input.focus();

        const closeDialog = (key = null) => {
            overlay.remove();
            resolve(key);
        };

        document.getElementById('cancelOpenAIKey').onclick = () => closeDialog();

        document.getElementById('saveOpenAIKey').onclick = () => {
            const apiKey = input.value.trim();
            if (apiKey) {
                localStorage.setItem('openaiApiKey', apiKey);
                closeDialog(apiKey);
            } else {
                alert('Vänligen ange en giltig API-nyckel.');
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('saveOpenAIKey').click();
            }
        });

        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeDialog();
            }
        });
    });
}

/**
 * Retrieves the OpenAI API key from localStorage or prompts the user for it.
 * @returns {Promise<string|null>} The API key or null.
 */
export async function getOpenAIAPIKey() {
    let apiKey = localStorage.getItem('openaiApiKey');
    if (!apiKey) {
        apiKey = await showOpenAIAPIKeyDialog();
    }
    return apiKey;
}

/**
 * Execute ChatGPT Agent with function calling capabilities
 * @param {string} query - User's query
 * @param {Array} tools - Array of tool definitions (Gemini format, will be converted)
 * @param {Object} toolRegistry - Map of tool names to their implementation functions
 * @param {Array} chatHistory - Optional conversation history [{role, text}, ...]
 * @returns {Promise<string>} - ChatGPT's response
 */
export async function executeChatGPTAgent(query, tools, toolRegistry, chatHistory = []) {
    const apiKey = await getOpenAIAPIKey();
    if (!apiKey) {
        throw new Error('No API key provided');
    }

    const url = 'https://api.openai.com/v1/chat/completions';

    // Convert Gemini tools format to OpenAI tools format
    const openaiTools = tools[0].functionDeclarations.map(func => ({
        type: 'function',
        function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters
        }
    }));

    // Build conversation history
    const messages = [
        {
            role: 'system',
            content: `Du är en AI-assistent för Spatial View, en visuell digital arbetsyta för handskrivna anteckningar och idéer.

DITT SYFTE:
- Hjälpa användare att organisera, söka, och arrangera kort på en oändlig canvas
- Analysera kort baserat på innehåll, datum, tags och metadata
- Föreslå och utföra visuella arrangemang (mind maps, Kanban, tidslinjer, kluster, etc.)

KOMMUNIKATIONSSTIL:
- **VAR PROAKTIV**: Använd verktyg DIREKT istället för att fråga om lov
- **AGERA, FRÅGA INTE**: Om användaren ber om något, GÖR det direkt
- Var koncis och handlingskraftig
- Förklara vad du GÖR (inte vad du "kan göra" eller "ska göra")
- Använd svenska (all UI och användare är svenskspråkiga)

VIKTIGT - PROAKTIVITET:
❌ FEL: "Ska jag lista alla taggar?"
✓ RÄTT: *Använder listAllTags direkt* "Jag hittar följande kategorier..."

VERKTYG:
Du har tillgång till flera verktyg för att söka, filtrera och arrangera kort. Använd dem direkt när användaren ber om det.`
        }
    ];

    // Add chat history
    chatHistory.forEach(msg => {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.text
        });
    });

    // Add current query
    if (messages[messages.length - 1]?.content !== query) {
        messages.push({ role: 'user', content: query });
    }

    // Initial request
    let response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: openaiTools,
            tool_choice: 'auto'
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    let data = await response.json();

    // Handle function calls in a loop
    let maxIterations = 10;
    let iterations = 0;

    while (iterations < maxIterations) {
        iterations++;

        const message = data.choices[0].message;
        messages.push(message);

        // Check if there are tool calls
        if (!message.tool_calls || message.tool_calls.length === 0) {
            // No more function calls, return the text response
            return message.content || 'ChatGPT svarade utan text.';
        }

        // Execute all tool calls
        for (const toolCall of message.tool_calls) {
            const funcName = toolCall.function.name;
            const funcArgs = JSON.parse(toolCall.function.arguments || '{}');

            console.log(`Executing tool: ${funcName}`, funcArgs);

            let result;
            if (toolRegistry[funcName]) {
                try {
                    result = await toolRegistry[funcName](funcArgs);
                } catch (error) {
                    result = { error: error.message };
                }
            } else {
                result = { error: `Function ${funcName} not found` };
            }

            // Add function response to messages
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
            });
        }

        // Send function responses back to ChatGPT
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                tools: openaiTools,
                tool_choice: 'auto'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Follow-up request failed`);
        }

        data = await response.json();
    }

    return 'ChatGPT slutade svara oväntat (för många iterationer).';
}
