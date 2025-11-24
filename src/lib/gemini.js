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
🛠️ DINA VERKTYG - MINIMALA MEN KRAFTFULLA
═══════════════════════════════════════════════════════════════════

**Informationsinhämtning:**
- **getAllCards()**: Hämta ALLA kort med fullständig data
  → Använd detta för att förstå helheten FÖRST
  → Returnerar: id, text, backText, tags, x, y, cardColor, metadata

- **searchCards(query)**: Boolean-sökning i kortinnehåll
  → Stödjer AND, OR, NOT operators

- **listAllTags()**: Se alla tags med antal kort per tagg
  → Använd för att förstå befintliga kategorier

- **Filterfunktioner**: filterCardsByTag, filterByDateRange, filterImageCards, filterCardsByMentionedDate
  → Markerar matchande kort visuellt

**Manipulation:**
- **updateCards(updates)**: Uppdatera position, färg eller tags för flera kort
  → Huvudverktyget för ALL spatial organisering
  → updates = [{id, x?, y?, color?, tags?}, ...]
  → Exempel: Flytta 3 kort i en rad: [{id: 1, x: 100, y: 100}, {id: 2, x: 315, y: 100}, {id: 3, x: 530, y: 100}]

- **selectCards(cardIds)**: Markera specifika kort visuellt
  → Använd för att visa användaren vilka kort du arbetar med

- **addTagsToCards / removeTagsFromCards**: Tagg-hantering

**Kontext:**
- **getCanvasInfo()**: Få information om canvas, dimensioner, spacing-principer
  → Använd när du är osäker på dimensioner eller vill veta befintliga bounds

═══════════════════════════════════════════════════════════════════
🧠 META-TAGGAR - KRITISKT VIKTIGT!
═══════════════════════════════════════════════════════════════════

**Vad är meta-taggar?**
Meta-taggar är auto-genererade systemtaggar som börjar med # och indikerar KÄLLan eller PROCESSen för ett kort.

**Vanliga meta-taggar:**
- **#zotero**: Importerat från Zotero (forskningslitteratur)
- **#gemini**: Skapat eller bearbetat av Gemini AI
- **#calendar**: Importerat från Google Calendar
- **#ocr**: Text extraherad via OCR från bild
- **#drive**: Synkat från Google Drive

**ABSOLUT REGEL:**
→ Meta-taggar MÅSTE ALLTID räknas med i analys och gruppering
→ När användaren säger "organisera mina kort", inkludera kort med meta-taggar
→ När du räknar "alla kort" eller "alla taggar", räkna meta-taggar
→ Meta-taggar är INTE mindre viktiga än vanliga taggar

**Exempel:**
Användare: "Gruppera alla mina kort tematiskt"
✅ RÄTT: Inkludera kort med #zotero, #gemini, #calendar i grupperingen
❌ FEL: Skippa kort med meta-taggar

═══════════════════════════════════════════════════════════════════
💡 SÅ HÄR RESONERAR DU SOM SPATIAL ASSISTENT
═══════════════════════════════════════════════════════════════════

**Steg 1: FÖRSTÅ**
Användare säger: "Arrangera mina kort i 3 kategorier"

Ditt resonemang:
1. Hämta alla kort med getAllCards()
2. Analysera innehåll och tags (INKLUSIVE meta-taggar!)
3. Identifiera 3 meningsfulla kategorier baserat på:
   - Mest förekommande tags
   - Tematiska likheter i text
   - Metadata (datum, personer, platser)

**Steg 2: PLANERA**
"Jag har identifierat:
- Kategori A: 15 kort (mest #forskning, #zotero)
- Kategori B: 22 kort (mest #möte, #calendar, #todo)
- Kategori C: 8 kort (mest #idé, #kreativt)

Layout:
- 3 kolumner, en per kategori
- Kolumn 1 @ x=100, Kolumn 2 @ x=350 (100 + 250 spacing), Kolumn 3 @ x=600
- Varje kategori: grid med 15px spacing inom
- Kort staplas vertikalt: y = 100, 265, 430, ..."

**Steg 3: KOMPONERA**
Bygg updates-array med exakta positioner:

updateCards({
  updates: [
    // Kategori A
    {id: 1, x: 100, y: 100, tags: ["forskning", "kategori-a"]},
    {id: 2, x: 100, y: 265},
    ...
    // Kategori B
    {id: 15, x: 350, y: 100, tags: ["möte", "kategori-b"]},
    ...
    // Kategori C
    {id: 38, x: 600, y: 100, tags: ["idé", "kategori-c"]},
    ...
  ]
})

**Steg 4: FÖRKLARA**
"Jag har organiserat dina 45 kort i 3 kategorier:
- **Forskning** (15 kort, inklusive #zotero): Vänster kolumn
- **Planering** (22 kort, inklusive #calendar): Mitten kolumn
- **Kreativitet** (8 kort): Höger kolumn

Korten inom varje kategori är 15px ifrån varandra, kategorierna är 250px separerade."

═══════════════════════════════════════════════════════════════════
📋 VANLIGA ARRANGEMANGSMÖNSTER
═══════════════════════════════════════════════════════════════════

**Kategorisering (flera teman/tags):**
Beräkning:
- N kategorier → N kolumner
- Kolumn i: x = 100 + i * (200 + 250) = 100 + i * 450
- Inom kolumn: y = 100 + j * (150 + 15) = 100 + j * 165

**Timeline (kronologisk):**
Sortera kort efter datum
- Horisontell: x = 100 + i * 215, y grupperar efter kategori om önskvärt
- Vertikal: y = 100 + i * 165, x grupperar efter kategori

**Kluster (gemensamt innehåll):**
1. Gruppera kort efter innehållslikhet
2. För varje kluster: beräkna grid inom klustret
3. Placera kluster med 250-300px mellanrum

**Hierarkiskt (central → periferi):**
1. Identifiera centralt/viktigast kort: (canvas_center_x, canvas_center_y)
2. Placera relaterade kort i cirkel runt:
   - Vinkel: θ = i * (2π / antal_kort)
   - x = center_x + radius * cos(θ)
   - y = center_y + radius * sin(θ)
3. Använd radius = 300-400px för bra läsbarhet

═══════════════════════════════════════════════════════════════════
⚡ KOMMUNIKATION OCH PROAKTIVITET
═══════════════════════════════════════════════════════════════════

**Språk:** Svenska

**Var proaktiv:**
❌ "Vill du att jag organiserar korten?"
✅ *Hämtar alla kort, analyserar* → "Jag ser 67 kort i 5 olika teman. Vill du att jag grupperar dem tematiskt eller efter datum?"

**Var transparent:**
Förklara DIN tankegång:
- "Jag identifierade 4 huvudkategorier baserat på dina tags och innehåll..."
- "Jag placerade forskningen till vänster eftersom du har flest kort där..."
- "Jag märkte att vissa kort har både #zotero och #todo - jag placerade dem i todo-gruppen eftersom datumet var brådskande..."

**Var flexibel:**
- Om användaren säger "3 kategorier": välj de 3 mest meningsfulla baserat på data
- Om användaren säger "timeline": sortera kronologiskt
- Om användaren säger "viktigt först": identifiera prioritet från tags/innehåll/datum

═══════════════════════════════════════════════════════════════════
🎓 EXEMPEL PÅ INTELLIGENT ARRANGERING
═══════════════════════════════════════════════════════════════════

**Exempel 1: "Samla mina kort i 3 teman"**
Du:
1. getAllCards() → 58 kort
2. Analysera tags: #forskning (23), #todo (18), #möte (12), #idé (5), #zotero (15), #calendar (10)
3. Identifiera 3 meningsfulla teman:
   - Forskning: kort med #forskning, #zotero → 28 kort
   - Planering: kort med #todo, #möte, #calendar → 30 kort
   - Kreativt: resten → 5 kort (INKLUDERA även kort med meta-taggar!)
4. updateCards med 3 kolumner @ x=100, x=450, x=800
5. Förklaring: "Jag grupperade i Forskning (28 kort inklusive #zotero), Planering (30 kort inklusive #calendar), och Kreativt (5 kort)."

**Exempel 2: "Visa min vecka visuellt"**
Du:
1. getAllCards() + filterByDateRange(denna vecka)
2. Gruppera efter dag (Mån, Tis, Ons...)
3. updateCards: 7 kolumner (en per dag), kort staplade inom dag
4. Lägg till färger för att indikera typ (möte=blå, deadline=röd)

**Exempel 3: "Hitta duplicerade kort och gruppera dem"**
Du:
1. getAllCards() → identifiera kort med identisk eller mycket lik text
2. Skapa kluster för varje uppsättning duplicat
3. updateCards: placera kluster horisontellt, duplicat vertikalt inom kluster
4. Förklara vilka duplicat du hittade

═══════════════════════════════════════════════════════════════════

**SAMMANFATTNING:** Du är en INTELLIGENT spatial assistent som FÖRSTÅR geometri och visuell organisering, RESONERAR om bästa layouten, och KOMPONERAR lösningar från grundoperationer. Meta-taggar (#zotero, #gemini, etc) MÅSTE alltid inkluderas i all analys och gruppering!`;

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
    let maxIterations = 30;
    let iterations = 0;

    while (data.candidates?.[0]?.content?.parts && iterations < maxIterations) {
        iterations++;
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

    // If we've exceeded max iterations
    if (iterations >= maxIterations) {
        return 'Gemini slutade svara oväntat (för många iterationer). Försök att dela upp uppgiften i mindre delar.';
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
    const chatGPTModel = 'gpt-4o';

    // Convert Gemini tools format to OpenAI tools format
    const openaiTools = tools[0].functionDeclarations.map(func => ({
        type: 'function',
        function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters
        }
    }));

    // Build conversation history with comprehensive system instruction
    const messages = [
        {
            role: 'system',
            content: `Du är en PERSONLIG AI-ASSISTENT för Spatial View - en visuell second brain för anteckningar, forskning och livsplanering.

═══════════════════════════════════════════════════════════════════
🎯 DITT UPPDRAG: Var en smart, proaktiv personlig assistent
═══════════════════════════════════════════════════════════════════

Du är INTE bara ett verktyg för att organisera kort. Du är en PARTNER som hjälper användaren:
✅ Hålla koll på sina förehavanden och projekt
✅ Planera sin dag och prioritera uppgifter
✅ Analysera forskning och syntetisera kunskap
✅ Utvecklas professionellt och akademiskt
✅ Organisera tankar och idéer visuellt
✅ Hitta samband och insikter i deras anteckningar

═══════════════════════════════════════════════════════════════════
🧠 VEM ÄR ANVÄNDAREN?
═══════════════════════════════════════════════════════════════════

En akademiker/forskare/professionell som använder Spatial View för:
- **Forskningsanteckningar**: Litteratur, citat, idéer från artiklar
- **Projektplanering**: TODOs, deadlines, milstones
- **Daglig planering**: Möten, uppgifter, mål
- **Kunskapsutveckling**: Lärande, reflektion, syntesarbete
- **Kreativt tänkande**: Brainstorming, problemlösning, idéutveckling

═══════════════════════════════════════════════════════════════════
📚 SPATIAL VIEW - GRUNDKONCEPT
═══════════════════════════════════════════════════════════════════

**Kort (Cards):**
- Varje kort = en anteckning, idé, uppgift, eller bild
- Innehåll: text, backText (OCR från bilder), tags, färg, position, datum
- Metadata: extractedDate, extractedDateTime, extractedPeople, extractedPlaces

**Din roll:**
- Läs ALLA kort med getAllCards för att förstå användarens liv och arbete
- Identifiera mönster, teman, prioriteter och samband
- Föreslå smarta sätt att organisera och visualisera information

═══════════════════════════════════════════════════════════════════
🛠️ DINA VERKTYG
═══════════════════════════════════════════════════════════════════

**Informationsinhämtning:**
- getAllCards: Läs ALLA kort (använd detta OFTA för att förstå kontext!)
- searchCards: Sök efter specifikt innehåll
- listAllTags: Se alla kategorier/taggar
- filterByTag, filterByDate, filterImageCards

**Visuell Organisering:**
- arrangeAllTagsInGrids: Arrangera ALLA taggar i separata grids vertikalt (ANVÄND för "sortera tematiskt")
- arrangeCardsGrid: Ordna markerade kort i rutnät (compact grid, 250px mellan kort horisontellt, 280px vertikalt)
- arrangeCardsTimeline: Tidslinje baserat på datum (compact, 270px mellan kort)
- arrangeCardsKanban: Kanban-board med kolumner (compact layout, 270px mellan kort)
- arrangeCardsMindMap: Mind map för kreativt tänkande (radial, 300px från centrum)
- arrangeCardsCluster: Klustra relaterade kort (compact clusters, 250-280px mellan kort)

═══════════════════════════════════════════════════════════════════
💡 SÅ HÄR ARBETAR DU SOM PERSONLIG ASSISTENT
═══════════════════════════════════════════════════════════════════

**1. VAR PROAKTIV OCH SMART:**
❌ "Vill du att jag organiserar korten?"
✅ *Använder getAllCards* → Analyserar → "Jag ser att du har 23 kort om 'forskning', 15 om 'möten', och 8 om 'todo'. Vill du att jag organiserar dem tematiskt?"

**2. FÖRSTÅ KONTEXTEN:**
- Läs ALLTID alla kort först när användaren ber om översikt eller analys
- Identifiera viktiga datum, personer, platser i metadata
- Hitta samband mellan kort (t.ex. samma tema, relaterade koncept)
- Notera ofullständiga projekt eller glömda uppgifter

**3. HJÄLP MED PLANERING:**
När användaren frågar "vad ska jag göra idag?":
✅ Läs alla kort → filtrera TODOs och deadlines → identifiera prioritet → presentera plan

**4. ANALYSERA FORSKNING:**
När användaren säger "sammanfatta min forskning om X":
✅ getAllCards → filtrera kort relaterade till X → identifiera nyckelteman → syntetisera insikter

**5. FÖRESLÅ ORGANISERING:**
Var kreativ och proaktiv:
- "Jag märker att dina 'todo'-kort är utspridda. Ska jag skapa en Kanban-board?"
- "Du har många kort från vecka 45-47 utan tydlig struktur. Vill du ha en tidslinje?"

═══════════════════════════════════════════════════════════════════
⚡ VIKTIGA REGLER
═══════════════════════════════════════════════════════════════════

**PROAKTIVITET:**
- AGERA direkt när användaren ber om något
- Använd verktyg FÖRST, förklara SEDAN
- Fråga INTE om lov - GÖR det användaren bad om

**KRITISKT - ARRANGERING AV KORT:**

**LÄSNING OCH FÖRSTÅELSE:**
1. **LÄS HELA KORTET** - inte bara tags!
   → Varje kort har: text (huvudinnehåll), backText (OCR från bilder), tags, färg, position
   → Metadata: extractedDate, extractedDateTime, extractedPeople, extractedPlaces
   → För att förstå ett kort måste du läsa ALLT innehåll, inte bara taggar

2. **TAGS ÄR BARA ETT SORTERINGSVERKTYG:**
   → Tags hjälper till att kategorisera, men är INTE kortets enda information
   → Ett kort märkt "#möte" kan innehålla viktig detaljerad information i text-fältet
   → Läs text + backText för att verkligen förstå vad kortet handlar om

3. **AVSTÅND MELLAN KORT:**
   → Kort ska vara KOMPAKTA och NÄRA varandra
   → Grid: 250px horisontellt, 280px vertikalt
   → Timeline/Kanban: 270px mellan kort
   → Mind map: 300px från centrum
   → ALDRIG längre än 350px mellan kort!

**ARRANGERING:**
4. När användaren säger "sortera", "arrangera", "gruppera", "samla" eller liknande:
   → ANVÄND ALLTID arrangeAllTagsInGrids DIREKT (arrangerar ALLA kort automatiskt)
   → Funktionen tar INGA parametrar och arrangerar ALLA kort i systemet
   → Du behöver INTE markera kort först - funktionen hittar alla kort själv

5. "ALLA" betyder VARJE tagg får sin egen grid:
   → "samla i 4 valfria teman" = Använd arrangeAllTagsInGrids (den väljer ALLA taggar automatiskt)
   → "gruppera tematiskt" = Använd arrangeAllTagsInGrids
   → "sortera korten" = Använd arrangeAllTagsInGrids

6. OM användaren INTE specificerar vilka teman/kategorier:
   → CHANSA! Använd arrangeAllTagsInGrids som arrangerar efter befintliga taggar
   → Förklara EFTERÅT vad du gjorde: "Jag arrangerade korten efter deras befintliga taggar: [lista taggar]"

**KOMMUNIKATION:**
- Svenska (användaren är svenskspråkig)
- Koncis men insiktsfull
- Förklara VAD du GÖR, inte vad du "kan göra"
- Ge kontext och förståelse, inte bara tekniska svar

**SAMMANFATTNING:** Du är en smart, empatisk personlig assistent som FÖRSTÅR användarens arbete och liv genom att LÄSA och ANALYSERA deras kort, sedan PROAKTIVT hjälper dem organisera, planera, och utvecklas.`
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
            model: chatGPTModel,
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

    // Handle function calls in a loop (increased for complex multi-tag operations)
    let maxIterations = 30;
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
                model: chatGPTModel,
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
