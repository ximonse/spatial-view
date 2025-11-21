const commandDefinitions = new Map([
  ['open-command-palette', {
    id: 'open-command-palette',
    name: 'Öppna kommandopalett',
    description: 'Visa alla kommandon och genvägar',
    keyBinding: 'Space',
    category: 'Navigation',
    icon: '⌘'
  }],
  ['focus-search', {
    id: 'focus-search',
    name: 'Fokusera sök',
    description: 'Fokusera sökfältet och markera texten',
    keyBinding: 'F',
    category: 'Navigation',
    icon: '🔍',
    contexts: ['board', 'column', 'global']
  }],
  ['clear-selection', {
    id: 'clear-selection',
    name: 'Rensa markering och sök',
    description: 'Töm urklipp, avmarkera kort och nollställ sökfält',
    keyBinding: 'Escape',
    category: 'Navigation',
    icon: '☐',
    contexts: ['global'],
    priority: 10
  }],
  ['toggle-view', {
    id: 'toggle-view',
    name: 'Byt vy',
    description: 'Växla mellan bräd- och kolumnvy',
    keyBinding: 'K',
    category: 'Navigation',
    icon: '🔄',
    contexts: ['global']
  }],
  ['toggle-theme', {
    id: 'toggle-theme',
    name: 'Byt tema',
    description: 'Växla mellan ljust/mörkt/e-ink tema',
    keyBinding: null,
    category: 'Navigation',
    icon: '🎨',
    contexts: ['global']
  }],
  ['fit-all-cards', {
    id: 'fit-all-cards',
    name: 'Passa alla kort',
    description: 'Zooma så att alla kort syns',
    keyBinding: null,
    category: 'Navigation',
    icon: '⛶',
    contexts: ['board']
  }],
  ['new-text-card', {
    id: 'new-text-card',
    name: 'Nytt text-kort',
    description: 'Skapa nytt textkort vid muspekaren',
    keyBinding: 'N',
    category: 'Skapa',
    icon: '📝',
    contexts: ['board']
  }],
  ['import-image', {
    id: 'import-image',
    name: 'Importera bild',
    description: 'Öppna filväljare för att importera bilder',
    keyBinding: 'I',
    category: 'Skapa',
    icon: '🖼️',
    contexts: ['board']
  }],
  ['paste-image-clipboard', {
    id: 'paste-image-clipboard',
    name: 'Klistra in bild',
    description: 'Klistra in bild från clipboard',
    keyBinding: 'Ctrl+Shift+V',
    category: 'Skapa',
    icon: '📋🖼️',
    contexts: ['board']
  }],
  ['read-with-ai', {
    id: 'read-with-ai',
    name: 'Läs med AI',
    description: 'OCR-läs markerade bildkort med Gemini AI',
    keyBinding: 'R',
    category: 'AI',
    icon: '✨',
    contexts: ['board']
  }],
  ['ask-ai', {
    id: 'ask-ai',
    name: 'Fråga AI',
    description: 'Öppna AI-assistent (Gemini eller ChatGPT)',
    keyBinding: 'A',
    category: 'AI',
    icon: '🤖💬',
    contexts: ['board']
  }],
  ['export-canvas', {
    id: 'export-canvas',
    name: 'Exportera',
    description: 'Exportera canvas till JSON',
    keyBinding: 'S',
    category: 'Filer',
    icon: '💾',
    contexts: ['board']
  }],
  ['export-readable', {
    id: 'export-readable',
    name: 'Exportera till text',
    description: 'Exportera till HTML/Markdown/TXT',
    keyBinding: 'E',
    category: 'Filer',
    icon: '📄',
    contexts: ['board']
  }],
  ['import-canvas', {
    id: 'import-canvas',
    name: 'Importera',
    description: 'Importera kort från JSON',
    keyBinding: 'L',
    category: 'Filer',
    icon: '📂',
    contexts: ['board']
  }],
  ['download-backup', {
    id: 'download-backup',
    name: 'Ladda ner backup',
    description: 'Ladda ner alla kort och bilder som zip',
    keyBinding: 'B',
    category: 'Filer',
    icon: '💾',
    contexts: ['board']
  }],
  ['restore-backup', {
    id: 'restore-backup',
    name: 'Återställ från backup',
    description: 'Återställ kort och bilder från zip-backup',
    keyBinding: null,
    category: 'Filer',
    icon: '📥',
    contexts: ['board']
  }],
  ['drive-sync', {
    id: 'drive-sync',
    name: 'Synka Google Drive',
    description: 'Ladda upp backup till Google Drive',
    keyBinding: 'Y',
    category: 'Filer',
    icon: '☁️',
    contexts: ['global']
  }],
  ['drive-reset', {
    id: 'drive-reset',
    name: 'Återställ Drive-inställningar',
    description: 'Rensa sparade Google Drive-inställningar',
    keyBinding: null,
    category: 'Filer',
    icon: '🔄',
    contexts: ['global']
  }],
  ['import-zotero-html', {
    id: 'import-zotero-html',
    name: 'Importera Zotero HTML',
    description: 'Importera anteckningar från Zotero-export',
    keyBinding: 'Z',
    category: 'Skapa',
    icon: '📚',
    contexts: ['board']
  }],
  ['create-multiple-cards', {
    id: 'create-multiple-cards',
    name: 'Skapa flera kort',
    description: 'Klistra in text och skapa flera kort',
    keyBinding: 'M',
    category: 'Skapa',
    icon: '📝📝',
    contexts: ['board']
  }],
  ['delete-selected', {
    id: 'delete-selected',
    name: 'Ta bort markerade',
    description: 'Ta bort markerade kort',
    keyBinding: ['Delete', 'Backspace'],
    category: 'Redigera',
    icon: '🗑️',
    contexts: ['board']
  }],
  ['undo', {
    id: 'undo',
    name: 'Ångra',
    description: 'Ångra senaste ändring',
    keyBinding: 'Ctrl+Z',
    category: 'Redigera',
    icon: '↶',
    contexts: ['board']
  }],
  ['redo', {
    id: 'redo',
    name: 'Gör om',
    description: 'Gör om ångrad ändring',
    keyBinding: 'Ctrl+Y',
    category: 'Redigera',
    icon: '↷',
    contexts: ['board']
  }],
  ['copy-selected', {
    id: 'copy-selected',
    name: 'Kopiera kort',
    description: 'Kopiera markerade kort',
    keyBinding: 'Ctrl+C',
    category: 'Redigera',
    icon: '📋',
    contexts: ['board']
  }],
  ['paste-cards', {
    id: 'paste-cards',
    name: 'Klistra in kort',
    description: 'Klistra in kopierade kort',
    keyBinding: 'Ctrl+V',
    category: 'Redigera',
    icon: '📄',
    contexts: ['board']
  }],
  ['toggle-pin', {
    id: 'toggle-pin',
    name: 'Pinna/Avpinna',
    description: 'Pinna eller avpinna markerade kort',
    keyBinding: 'P',
    category: 'Redigera',
    icon: '📌',
    contexts: ['board']
  }],
  ['select-all', {
    id: 'select-all',
    name: 'Markera alla',
    description: 'Markera alla kort på canvas',
    keyBinding: 'Ctrl+A',
    category: 'Redigera',
    icon: '☑',
    contexts: ['board']
  }],
  ['arrange-vertical', {
    id: 'arrange-vertical',
    name: 'Arrangera vertikalt',
    description: 'Arrangera markerade kort vertikalt',
    keyBinding: 'V',
    category: 'Layout',
    icon: '↕️',
    contexts: ['board']
  }],
  ['arrange-horizontal', {
    id: 'arrange-horizontal',
    name: 'Arrangera horisontellt',
    description: 'Arrangera markerade kort horisontellt',
    keyBinding: 'H',
    category: 'Layout',
    icon: '↔️',
    contexts: ['board']
  }],
  ['arrange-cluster', {
    id: 'arrange-cluster',
    name: 'Arrangera cirkel',
    description: 'Arrangera markerade eller inklistrade kort i kluster',
    keyBinding: 'Q',
    category: 'Layout',
    icon: '◉',
    contexts: ['board']
  }],
  ['arrange-grid-vertical', {
    id: 'arrange-grid-vertical',
    name: 'Arrangera grid vertikalt',
    description: 'Arrangera i vertikalt rutnät (G hålls)',
    keyBinding: 'G+V',
    category: 'Layout',
    icon: '⊞↕',
    contexts: ['board']
  }],
  ['arrange-grid-horizontal', {
    id: 'arrange-grid-horizontal',
    name: 'Arrangera grid horisontellt',
    description: 'Arrangera i horisontellt rutnät (G hålls)',
    keyBinding: 'G+H',
    category: 'Layout',
    icon: '⊞↔',
    contexts: ['board']
  }],
  ['arrange-grid-top', {
    id: 'arrange-grid-top',
    name: 'Arrangera grid överlappande',
    description: 'Arrangera kort överlappande (G hålls)',
    keyBinding: 'G+T',
    category: 'Layout',
    icon: '⊞⤓',
    contexts: ['board']
  }],
  ['open-quality-dialog', {
    id: 'open-quality-dialog',
    name: 'Välj bildkvalitet',
    description: 'Välj kvalitet för importerade bilder',
    keyBinding: null,
    category: 'Skapa',
    icon: '⭐',
    contexts: ['board'],
    showInPalette: false
  }]
]);

const registeredCommands = new Map();
const bindingIndex = new Map();
let contextResolver = () => ['global'];

function normalizeKey(key) {
  if (!key) return '';
  const lower = key.trim();
  if (lower.toLowerCase() === 'spacebar' || lower.toLowerCase() === 'space') return ' ';
  return lower.length === 1 ? lower.toLowerCase() : lower;
}

function parseBinding(binding) {
  if (!binding) return null;
  if (typeof binding === 'object' && !Array.isArray(binding)) {
    const normalizedKey = normalizeKey(binding.key);
    return {
      key: normalizedKey,
      chord: binding.chord ? normalizeKey(binding.chord) : undefined,
      ctrl: Boolean(binding.ctrl),
      shift: Boolean(binding.shift),
      alt: Boolean(binding.alt),
      meta: Boolean(binding.meta)
    };
  }

  const parts = String(binding).split('+').map(p => p.trim()).filter(Boolean);
  const bindingObj = { key: '', chord: undefined, ctrl: false, shift: false, alt: false, meta: false };
  const nonModifierParts = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control' || lower === 'cmd') {
      bindingObj.ctrl = true;
    } else if (lower === 'shift') {
      bindingObj.shift = true;
    } else if (lower === 'alt' || lower === 'option') {
      bindingObj.alt = true;
    } else if (lower === 'meta') {
      bindingObj.meta = true;
    } else {
      nonModifierParts.push(part);
    }
  }

  if (nonModifierParts.length > 0) {
    bindingObj.key = normalizeKey(nonModifierParts.pop());
    if (nonModifierParts.length > 0) {
      bindingObj.chord = normalizeKey(nonModifierParts[0]);
    }
  }

  if (!bindingObj.key) return null;
  return bindingObj;
}

function normalizeBindingInput(binding) {
  if (Array.isArray(binding)) {
    return binding.map(parseBinding).filter(Boolean);
  }
  const parsed = parseBinding(binding);
  return parsed ? [parsed] : [];
}

function bindingSignature(binding) {
  const parts = [];
  if (binding.ctrl) parts.push('ctrl');
  if (binding.shift) parts.push('shift');
  if (binding.alt) parts.push('alt');
  if (binding.meta) parts.push('meta');
  if (binding.chord) parts.push(`chord:${binding.chord}`);
  parts.push(`key:${binding.key}`);
  return parts.join('+');
}

function contextsOverlap(a, b) {
  if (!a || !b) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  return Array.from(setA).some(ctx => setB.has(ctx) || ctx === 'global' || setB.has('global'));
}

function formatKey(binding) {
  if (!binding) return '';
  const parts = [];
  if (binding.chord) parts.push(binding.chord.toUpperCase());
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.meta) parts.push('Meta');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  const keyLabel = binding.key === ' ' ? 'Space' : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
  parts.push(keyLabel);
  return parts.join('+');
}

function addToBindingIndex(cmdId, bindings, contexts) {
  for (const binding of bindings) {
    const signature = bindingSignature(binding);
    const list = bindingIndex.get(signature) || [];
    list.push({ id: cmdId, contexts });
    bindingIndex.set(signature, list);

    if (list.length > 1) {
      const conflicts = list.filter(entry => contextsOverlap(contexts, entry.contexts)).map(entry => entry.id);
      if (conflicts.length > 1) {
        console.warn(`[command-registry] Conflict for ${signature}: ${conflicts.join(', ')}`);
      }
    }
  }
}

function removeFromBindingIndex(cmdId) {
  for (const [signature, entries] of bindingIndex.entries()) {
    const filtered = entries.filter(entry => entry.id !== cmdId);
    if (filtered.length === 0) {
      bindingIndex.delete(signature);
    } else {
      bindingIndex.set(signature, filtered);
    }
  }
}

function resolveContexts(context) {
  if (!context) {
    const resolved = contextResolver();
    if (Array.isArray(resolved)) return [...new Set([...resolved, 'global'])];
    return [resolved, 'global'];
  }
  if (Array.isArray(context)) return [...new Set([...context, 'global'])];
  return [context, 'global'];
}

export function setContextResolver(resolver) {
  contextResolver = resolver;
}

export function getCommandDefinition(id) {
  return commandDefinitions.get(id) || null;
}

export function getCommandDefinitions() {
  return Array.from(commandDefinitions.values());
}

export function registerCommand(command) {
  const definition = getCommandDefinition(command.id) || {};
  const merged = {
    ...definition,
    ...command,
  };

  const bindings = normalizeBindingInput(merged.keyBinding || definition.keyBinding);
  merged.bindings = bindings;
  merged.contexts = merged.contexts || definition.contexts || ['global'];
  merged.priority = merged.priority ?? definition.priority ?? 0;
  merged.showInPalette = merged.showInPalette ?? definition.showInPalette ?? true;
  merged.icon = merged.icon || definition.icon;

  registeredCommands.set(merged.id, merged);
  if (bindings.length) {
    addToBindingIndex(merged.id, bindings, merged.contexts);
  }
  return merged;
}

export function unregisterCommand(id) {
  if (!registeredCommands.has(id)) return;
  removeFromBindingIndex(id);
  registeredCommands.delete(id);
}

export function getCommands({ context, includeHidden = false } = {}) {
  const activeContexts = resolveContexts(context);
  return Array.from(registeredCommands.values())
    .filter(cmd => contextsOverlap(cmd.contexts, activeContexts))
    .filter(cmd => includeHidden || cmd.showInPalette !== false)
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

function matchesBinding(event, binding, heldChords) {
  if (!binding) return false;
  if (binding.chord && !heldChords?.has(binding.chord)) {
    return false;
  }

  const eventKey = normalizeKey(event.key === 'Spacebar' ? ' ' : event.key);
  if (binding.key !== eventKey) return false;
  if (binding.ctrl !== event.ctrlKey) return false;
  if (binding.shift !== event.shiftKey) return false;
  if (binding.alt !== event.altKey) return false;
  if (binding.meta !== event.metaKey) return false;
  return true;
}

export function executeCommandFromEvent(event, { context, data, allowInInputs = false } = {}) {
  if (event.defaultPrevented) return false;
  const target = event.target;
  const targetIsInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
  const activeContexts = resolveContexts(context);
  const heldChords = data?.heldChords || new Set();
  const candidates = [];

  for (const command of registeredCommands.values()) {
    if (!command.bindings || command.bindings.length === 0) continue;
    if (!contextsOverlap(command.contexts, activeContexts)) continue;
    if (targetIsInput && !(allowInInputs || command.allowInInputs)) continue;

    const matches = command.bindings.some(binding => matchesBinding(event, binding, heldChords));
    if (!matches) continue;
    if (typeof command.when === 'function' && !command.when({ event, data, contexts: activeContexts })) continue;
    candidates.push(command);
  }

  if (candidates.length === 0) return false;

  const selected = candidates.sort((a, b) => b.priority - a.priority)[0];
  if (selected.preventDefault !== false) {
    event.preventDefault();
  }
  selected.handler?.({ event, data, contexts: activeContexts });
  return true;
}

export function formatKeyBindings(command) {
  if (!command || !command.bindings) return '';
  return command.bindings.map(formatKey).join(' / ');
}
