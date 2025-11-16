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
async function getGoogleAIAPIKey() {                                                                                                     
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

        const hashtagText = (parsedData.hashtags || []).map(tag => tag.startsWith('#') ? tag : '#' + tag).join(' ');
        const mainContent = parsedData.text || parsedData.description || '';
        const newBackText = (mainContent + '\n\n' + hashtagText).trim();

        const existingTags = card.tags || [];
        const newTags = (parsedData.hashtags || []).map(tag => tag.replace('#', ''));
        const mergedTags = [...new Set([...existingTags, ...newTags])];

        const updates = {
            backText: newBackText,
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
