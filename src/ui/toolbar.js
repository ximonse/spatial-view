import { importImage } from '../lib/canvas.js';
import { toggleView } from './view-switcher.js';

export function initToolbar(state) {
  const viewToggle = document.getElementById('btn-view-toggle');
  viewToggle?.addEventListener('click', toggleView);

  const themeBtn = document.getElementById('btn-theme-toggle');
  themeBtn?.addEventListener('click', () => toggleTheme(state));

  const uiModeToggle = document.getElementById('btn-ui-mode-toggle');
  uiModeToggle?.addEventListener('click', () => toggleUIMode(state));

  const importBtn = document.getElementById('btn-import');
  importBtn?.addEventListener('click', () => handleImport(state));

  const downloadBtn = document.getElementById('btn-download');
  downloadBtn?.addEventListener('click', handleDownloadBackup);

  window.addEventListener('toggleTheme', () => toggleTheme(state));

  applyUIMode(state);
}

export async function toggleTheme(state) {
  const body = document.body;

  // Get current theme from class
  let currentTheme = 'light';
  if (body.classList.contains('dark-theme')) currentTheme = 'dark';
  else if (body.classList.contains('eink-theme')) currentTheme = 'eink';

  const themes = ['light', 'dark', 'eink'];
  const currentIndex = themes.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themes.length;
  const nextTheme = themes[nextIndex];

  // Remove all theme classes
  body.classList.remove('dark-theme', 'eink-theme', 'sepia-theme');

  // Add new theme class (except for light which is default)
  if (nextTheme === 'dark') {
    body.classList.add('dark-theme');
  } else if (nextTheme === 'eink') {
    body.classList.add('eink-theme');
  }

  // Also set data attribute for consistency
  body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
  state.theme = nextTheme;

  // Update button text
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    // The text is now removed, but we could update a title/tooltip here
    const themeTitles = {
      'light': 'Byt till mörkt tema',
      'dark': 'Byt till e-ink tema',
      'eink': 'Byt till ljust tema'
    };
    themeBtn.title = themeTitles[nextTheme] || 'Byt tema';
  }

  // Update card appearances based on new theme
  const { updateCardShadows, updateCardFills, updateCardStrokes } = await import('../lib/canvas.js');
  updateCardShadows();
  await updateCardFills(); // Use await since it's an async function
  updateCardStrokes();

  console.log(`Theme changed to: ${nextTheme}`);
}

export function toggleUIMode(state) {
  const modes = ['full', 'minimal', 'toggle-only'];
  const currentIndex = modes.indexOf(state.uiMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  state.uiMode = modes[nextIndex];

  // Save to localStorage
  localStorage.setItem('uiMode', state.uiMode);

  // Apply the new mode
  applyUIMode(state);

  console.log(`UI mode changed to: ${state.uiMode}`);
}

export function applyUIMode(state) {
  const toolbar = document.getElementById('toolbar');
  const toolbarActions = document.getElementById('toolbar-actions');
  const commandPaletteBtn = document.getElementById('command-palette-button');
  const addBtn = document.getElementById('add-button');
  const fitAllBtn = document.getElementById('fit-all-button');
  const uiToggleBtn = document.getElementById('btn-ui-mode-toggle');

  if (!toolbar) return;

  // Reset toggle button to default position first
  if (uiToggleBtn) {
    uiToggleBtn.style.position = '';
    uiToggleBtn.style.top = '';
    uiToggleBtn.style.right = '';
    uiToggleBtn.style.zIndex = '';
  }

  // Mode 1: Full - show everything
  if (state.uiMode === 'full') {
    toolbar.style.display = 'flex';
    if (toolbarActions) {
      toolbarActions.style.display = 'flex';
      // Show all buttons in toolbar
      Array.from(toolbarActions.children).forEach(child => {
        child.style.display = '';
      });
    }
    if (commandPaletteBtn) commandPaletteBtn.style.display = 'flex';
    if (addBtn) addBtn.style.display = 'flex';
    if (fitAllBtn) fitAllBtn.style.display = 'flex';
    if (uiToggleBtn) uiToggleBtn.title = 'Byt till minimalt UI';
  }

  // Mode 2: Minimal - hide toolbar buttons EXCEPT toggle, show floating command palette
  else if (state.uiMode === 'minimal') {
    // Hide toolbar buttons except toggle
    if (toolbarActions) {
      Array.from(toolbarActions.children).forEach(child => {
        if (child.id === 'btn-ui-mode-toggle') {
          child.style.display = '';
        } else {
          child.style.display = 'none';
        }
      });
      toolbarActions.style.display = 'flex';
    }
    // Show floating command palette button
    if (commandPaletteBtn) commandPaletteBtn.style.display = 'flex';
    if (addBtn) addBtn.style.display = 'none';
    if (fitAllBtn) fitAllBtn.style.display = 'none';
    toolbar.style.display = 'flex';
    if (uiToggleBtn) uiToggleBtn.title = 'Byt till endast UI-knapp';
  }

  // Mode 3: Toggle-only - show ONLY toggle button
  else if (state.uiMode === 'toggle-only') {
    // Hide toolbar buttons except toggle
    if (toolbarActions) {
      Array.from(toolbarActions.children).forEach(child => {
        if (child.id === 'btn-ui-mode-toggle') {
          child.style.display = '';
        } else {
          child.style.display = 'none';
        }
      });
      toolbarActions.style.display = 'flex';
    }
    // Hide floating buttons
    if (commandPaletteBtn) commandPaletteBtn.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    if (fitAllBtn) fitAllBtn.style.display = 'none';
    toolbar.style.display = 'flex';
    if (uiToggleBtn) uiToggleBtn.title = 'Byt till fullt UI';
  }

  console.log(`Applied UI mode: ${state.uiMode}`);
}

export async function handleImport(state) {
  if (state.currentView !== 'board') {
    alert('Byt till Board-vy för att lägga till bilder');
    return;
  }

  // Open file picker directly (quality dialog shows after)
  try {
    await importImage();
  } catch (error) {
    console.error('Import failed:', error);
    alert('Misslyckades att importera bild: ' + error.message);
  }
}

export async function handleDownloadBackup() {
  try {
    const JSZip = (await import('jszip')).default;
    const { getAllCards } = await import('../lib/storage.js');

    console.log('Creating backup...');
    const zip = new JSZip();

    // Get all cards
    const cards = await getAllCards();

    // Create JSON export
    const jsonData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      cards: cards
    };

    zip.file('cards.json', JSON.stringify(jsonData, null, 2));

    // Add images folder
    const imagesFolder = zip.folder('images');
    let imageCount = 0;

    // Extract and save images
    for (const card of cards) {
      if (card.image) {
        try {
          // Handle both direct base64 string and object format
          const imageSrc = typeof card.image === 'string' ? card.image : card.image.base64;

          // Extract base64 data (remove data:image/png;base64, prefix)
          const base64Data = imageSrc.split(',')[1];

          if (base64Data) {
            // Use card ID as filename
            const filename = `card_${card.id}.png`;
            imagesFolder.file(filename, base64Data, { base64: true });
            imageCount++;
          }
        } catch (error) {
          console.error(`Failed to export image for card ${card.id}:`, error);
        }
      }
    }

    console.log(`Exporting ${cards.length} cards and ${imageCount} images...`);

    // Generate zip file
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Create filename with date and time
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    a.download = `spatial-view-backup-${date}_${time}.zip`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Backup created successfully: ${cards.length} cards, ${imageCount} images`);
    alert(`Backup skapad!\n\n${cards.length} kort och ${imageCount} bilder exporterade.`);

  } catch (error) {
    console.error('Backup failed:', error);
    alert('Misslyckades att skapa backup: ' + error.message);
  }
}

export async function handleRestoreFromBlob(blob) {
  try {
    const JSZip = (await import('jszip')).default;
    const { createCard } = await import('../lib/storage.js');
    const { reloadCanvas } = await import('../lib/canvas.js');

    console.log('Reading backup zip...');

    // Read zip file
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Extract cards.json
    const cardsJsonFile = zip.file('cards.json');
    if (!cardsJsonFile) {
      throw new Error('Kunde inte hitta cards.json i backup-filen');
    }

    const cardsJsonText = await cardsJsonFile.async('text');
    const jsonData = JSON.parse(cardsJsonText);

    if (!jsonData.cards || !Array.isArray(jsonData.cards)) {
      throw new Error('Ogiltig backup-fil: cards saknas');
    }

    // Extract images
    const imagesFolder = zip.folder('images');
    const imageFiles = {};

    if (imagesFolder) {
      const files = Object.keys(zip.files).filter(name => name.startsWith('images/'));
      for (const filename of files) {
        const file = zip.file(filename);
        if (file) {
          const base64Data = await file.async('base64');
          const cardId = filename.match(/card_(\d+)\.png/)?.[1];
          if (cardId) {
            imageFiles[cardId] = `data:image/png;base64,${base64Data}`;
          }
        }
      }
    }

    // Import all cards
    let importedCount = 0;
    for (const cardData of jsonData.cards) {
      if (cardData.id && imageFiles[cardData.id]) {
        cardData.image = { base64: imageFiles[cardData.id] };
      }

      const { id, ...cardWithoutId } = cardData;
      await createCard(cardWithoutId);
      importedCount++;
    }

    // Reload canvas
    await reloadCanvas();

    console.log(`Restored ${importedCount} cards from blob`);
    return importedCount;

  } catch (error) {
    console.error('Restore from blob failed:', error);
    throw error;
  }
}

export async function handleRestoreBackup() {
  try {
    // Create file input for zip
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const JSZip = (await import('jszip')).default;
        const { createCard } = await import('../lib/storage.js');
        const { reloadCanvas } = await import('../lib/canvas.js');

        console.log('Reading backup zip...');

        // Read zip file
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Extract cards.json
        const cardsJsonFile = zip.file('cards.json');
        if (!cardsJsonFile) {
          throw new Error('Kunde inte hitta cards.json i backup-filen');
        }

        const cardsJsonText = await cardsJsonFile.async('text');
        const jsonData = JSON.parse(cardsJsonText);

        if (!jsonData.cards || !Array.isArray(jsonData.cards)) {
          throw new Error('Ogiltig backup-fil: cards saknas');
        }

        console.log(`Restoring ${jsonData.cards.length} cards...`);

        // Extract images
        const imagesFolder = zip.folder('images');
        const imageFiles = {};

        if (imagesFolder) {
          const files = Object.keys(zip.files).filter(name => name.startsWith('images/'));
          for (const filename of files) {
            const file = zip.file(filename);
            if (file) {
              const base64Data = await file.async('base64');
              const cardId = filename.match(/card_(\d+)\.png/)?.[1];
              if (cardId) {
                imageFiles[cardId] = `data:image/png;base64,${base64Data}`;
              }
            }
          }
          console.log(`Extracted ${Object.keys(imageFiles).length} images`);
        }

        // Confirm before importing
        const confirmed = confirm(
          `Återställa backup från ${jsonData.exportDate || 'okänt datum'}?\n\n` +
          `${jsonData.cards.length} kort kommer att importeras. Eventuella befintliga kort lämnas kvar.\n\n` +
          `Importera nu?`
        );

        if (!confirmed) {
          console.log('Restore cancelled by user');
          return;
        }

        // Import cards
        let importedCount = 0;
        for (const cardData of jsonData.cards) {
          // If an image exists in the images folder, attach it to the card
          if (cardData.id && imageFiles[cardData.id]) {
            cardData.image = {
              base64: imageFiles[cardData.id]
            };
          }

          // Remove the old ID so a new one is generated
          const { id, ...cardWithoutId } = cardData;

          await createCard(cardWithoutId);
          importedCount++;
        }

        console.log(`Restored ${importedCount} cards`);

        // Reload canvas
        await reloadCanvas();

        alert(`✅ Backup återställd!\n\n${importedCount} kort importerade.`);

      } catch (error) {
        console.error('Restore failed:', error);
        alert('Misslyckades att återställa backup: ' + error.message);
      }
    };

    input.click();

  } catch (error) {
    console.error('Failed to initiate restore:', error);
    alert('Misslyckades att starta återställning: ' + error.message);
  }
}

export async function handleDriveSync() {
  try {
    const { syncWithDrive } = await import('../lib/drive-sync.js');

    const statusDiv = document.createElement('div');
    statusDiv.textContent = '☁️ Synkar med Google Drive...';
    statusDiv.style.cssText = `
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
    document.body.appendChild(statusDiv);

    const result = await syncWithDrive();

    if (result.success) {
      statusDiv.textContent = '✅ ' + result.message;
      statusDiv.style.background = '#27ae60';
    } else {
      statusDiv.textContent = '❌ ' + result.message;
      statusDiv.style.background = '#c0392b';
    }

    setTimeout(() => {
      statusDiv.remove();
    }, 3000);

  } catch (error) {
    console.error('Drive sync failed:', error);
    alert('Synk misslyckades: ' + error.message);
  }
}
