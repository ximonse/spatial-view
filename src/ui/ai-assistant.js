// Unified AI Assistant UI for Spatial View
// Supports Gemini, Claude, and ChatGPT

import { sendClaudePrompt } from '../lib/claude.js';

/**
 * Creates a unified AI assistant panel that works with any provider
 * @param {Object} options - Configuration options
 * @param {string} options.provider - 'gemini', 'claude', or 'chatgpt'
 * @param {Function} options.sendMessage - Function to send messages to the AI
 * @param {Array} options.tools - Tool definitions for function calling
 * @param {Object} options.toolRegistry - Tool implementations
 * @param {string} options.systemInstruction - System prompt
 * @param {Function} options.loadHistory - Function to load conversation history
 * @param {Function} options.saveHistory - Function to save conversation history
 */
export function createAIAssistantPanel(options) {
  const {
    provider,
    sendMessage,
    tools,
    toolRegistry,
    systemInstruction,
    loadHistory,
    saveHistory
  } = options;

  // Provider-specific config
  const config = {
    gemini: { icon: '✨', title: 'Gemini Chat', color: '#4285f4' },
    claude: { icon: '🤖', title: 'Claude Chat', color: '#10a37f' },
    chatgpt: { icon: '💬', title: 'ChatGPT Chat', color: '#10a37f' }
  };

  const { icon, title } = config[provider] || config.gemini;

  // Conversation history
  const conversationHistory = loadHistory(provider);
  const persistHistory = () => saveHistory(provider, conversationHistory);

  // Create side panel
  const panel = document.createElement('div');
  panel.id = `${provider}Panel`;
  panel.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    width: 400px;
    max-width: 90vw;
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease;
  `;

  // Mobile: bottom panel
  if (window.innerWidth < 768 || (window.innerWidth < 1024 && window.innerHeight > window.innerWidth)) {
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60vh;
      max-height: 80vh;
      width: 100%;
      background: var(--bg-primary);
      color: var(--text-primary);
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.3);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      transition: transform 0.3s ease;
      border-radius: 16px 16px 0 0;
    `;
  }

  panel.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
        ${icon} ${title}
      </h3>
      <div style="display: flex; gap: 12px;">
        <button id="${provider}SwitchModel" title="Byt AI-modell" style="background: none; border: 1px solid var(--border-color); font-size: 13px; cursor: pointer; color: var(--text-secondary); padding: 6px 10px; border-radius: 8px;">Byt</button>
        <button id="${provider}Minimize" title="Minimera (sparar konversationen)" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">−</button>
        <button id="${provider}Close" title="Stäng (raderar konversationen)" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">&times;</button>
      </div>
    </div>
    <div id="chatMessages" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    "></div>
    <div id="inputArea" style="padding: 16px; border-top: 1px solid var(--border-color); display: flex; gap: 8px; align-items: center;">
      <input type="text" id="${provider}Query" placeholder="Skriv din fråga..."
        style="flex: 1; padding: 12px; font-size: 14px;
               border: 2px solid var(--border-color); border-radius: 8px;
               background: var(--bg-secondary); color: var(--text-primary);
               font-family: sans-serif; box-sizing: border-box;" />
      <button id="${provider}Ask" style="padding: 12px 20px; background: var(--accent-color);
              color: white; border: none; border-radius: 8px; cursor: pointer;
              font-size: 14px; white-space: nowrap;">Skicka</button>
    </div>
  `;

  document.body.appendChild(panel);

  const queryInput = document.getElementById(`${provider}Query`);
  const chatMessages = document.getElementById('chatMessages');
  const askBtn = document.getElementById(`${provider}Ask`);
  const closeBtn = document.getElementById(`${provider}Close`);
  const switchModelBtn = document.getElementById(`${provider}SwitchModel`);
  const minimizeBtn = document.getElementById(`${provider}Minimize`);

  // Create floating button
  const floatingBtn = document.createElement('button');
  floatingBtn.id = `${provider}FloatingBtn`;
  floatingBtn.innerHTML = icon;
  floatingBtn.title = `Expandera ${title}`;
  floatingBtn.style.cssText = `
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-color);
    color: white;
    border: none;
    font-size: 28px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 9998;
    display: none;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  `;
  floatingBtn.addEventListener('mouseenter', () => {
    floatingBtn.style.transform = 'scale(1.1)';
  });
  floatingBtn.addEventListener('mouseleave', () => {
    floatingBtn.style.transform = 'scale(1)';
  });
  document.body.appendChild(floatingBtn);

  // Minimize/expand functions
  const minimize = () => {
    persistHistory();
    panel.style.display = 'none';
    floatingBtn.style.display = 'flex';
  };

  const expand = () => {
    panel.style.display = 'flex';
    floatingBtn.style.display = 'none';
    queryInput.focus();
  };

  const cleanup = () => {
    panel.remove();
    floatingBtn.remove();
  };

  // Render stored conversation
  const renderStoredConversation = () => {
    conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        addUserMessage(msg.text);
      } else if (msg.role === 'assistant' || msg.role === 'model') {
        addAssistantMessage(msg.text);
      }
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // Add message functions
  const addUserMessage = (text) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      background: var(--accent-color);
      color: white;
      padding: 12px;
      border-radius: 12px;
      align-self: flex-end;
      max-width: 80%;
      word-wrap: break-word;
      white-space: pre-wrap;
    `;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const addAssistantMessage = (text) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 12px;
      border-radius: 12px;
      align-self: flex-start;
      max-width: 80%;
      word-wrap: break-word;
      white-space: pre-wrap;
      line-height: 1.5;
    `;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const addSystemMessage = (text) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      background: rgba(var(--accent-color-rgb, 100, 163, 127), 0.1);
      color: var(--text-secondary);
      padding: 8px 12px;
      border-radius: 8px;
      align-self: center;
      max-width: 90%;
      font-size: 13px;
      font-style: italic;
      text-align: center;
    `;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
  };

  // Send prompt handler
  const sendPrompt = async (promptText = null) => {
    const query = (promptText ?? queryInput.value).trim();
    if (!query) return;

    queryInput.value = '';
    queryInput.disabled = true;
    askBtn.disabled = true;

    addUserMessage(query);
    conversationHistory.push({ role: 'user', text: query });
    persistHistory();

    try {
      const response = await sendMessage(query, conversationHistory, tools, toolRegistry, systemInstruction);

      addAssistantMessage(response);
      conversationHistory.push({ role: 'assistant', text: response });
      persistHistory();
    } catch (error) {
      console.error(`${provider} error:`, error);
      addSystemMessage(`❌ Fel: ${error.message}`);
    } finally {
      queryInput.disabled = false;
      askBtn.disabled = false;
      queryInput.focus();
    }
  };

  // Event listeners
  closeBtn.addEventListener('click', cleanup);
  minimizeBtn.addEventListener('click', minimize);
  floatingBtn.addEventListener('click', expand);
  askBtn.addEventListener('click', () => sendPrompt());
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  // Switch model handler (will be connected by core.js)
  switchModelBtn.addEventListener('click', async () => {
    cleanup();
    if (window.handleAIChooserCommand) {
      await window.handleAIChooserCommand(true);
    }
  });

  // Render existing conversation
  renderStoredConversation();
  queryInput.focus();

  return {
    panel,
    cleanup,
    minimize,
    expand
  };
}

/**
 * Show Claude assistant
 * @param {Object} options - Tool definitions and registry
 */
export async function showClaudeAssistant(options = {}) {
  const { tools, toolRegistry, systemInstruction, loadHistory, saveHistory } = options;

  const sendMessage = async (query, conversationHistory, tools, toolRegistry, systemInstruction) => {
    return await sendClaudePrompt(query, tools, toolRegistry, conversationHistory, systemInstruction);
  };

  return createAIAssistantPanel({
    provider: 'claude',
    sendMessage,
    tools,
    toolRegistry,
    systemInstruction,
    loadHistory,
    saveHistory
  });
}
