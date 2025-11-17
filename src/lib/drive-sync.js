// Google Drive Sync for Spatial View

const DRIVE_FOLDER_NAME = 'Spatial View Backups';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

/**
 * Get Google OAuth Client ID from localStorage or prompt user
 */
async function getGoogleClientId() {
  let clientId = localStorage.getItem('googleDriveClientId');

  if (!clientId) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
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

    dialog.innerHTML = `
      <div style="
        background: var(--bg-primary);
        color: var(--text-primary);
        border-radius: 12px;
        padding: 30px;
        width: 90%;
        max-width: 600px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <h2 style="margin: 0 0 20px 0;">☁️ Google Drive Synk</h2>
        <p style="margin: 0 0 15px 0; line-height: 1.6;">
          För att synka med Google Drive behöver du ett OAuth Client ID.
        </p>
        <p style="margin: 0 0 15px 0; line-height: 1.6;">
          <strong>Så här skaffar du ett:</strong><br>
          1. Gå till <a href="https://console.cloud.google.com" target="_blank" style="color: var(--accent-color);">Google Cloud Console</a><br>
          2. Skapa ett projekt<br>
          3. Aktivera "Google Drive API"<br>
          4. Skapa "OAuth 2.0 Client ID" (Web application)<br>
          5. Lägg till din Vercel-URL i "Authorized JavaScript origins"<br>
          6. Kopiera Client ID och klistra in här
        </p>
        <input type="text" id="clientIdInput" placeholder="Din Google OAuth Client ID..." style="
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-family: monospace;
          font-size: 13px;
          box-sizing: border-box;
          margin-bottom: 20px;
          background: var(--bg-secondary);
          color: var(--text-primary);
        ">
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelClientId" style="
            padding: 10px 20px;
            border: 1px solid var(--border-color);
            background: var(--bg-secondary);
            color: var(--text-primary);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Avbryt</button>
          <button id="saveClientId" style="
            padding: 10px 20px;
            border: none;
            background: var(--accent-color);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Spara</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    return new Promise((resolve) => {
      const input = document.getElementById('clientIdInput');
      input.focus();

      document.getElementById('cancelClientId').onclick = () => {
        dialog.remove();
        resolve(null);
      };

      document.getElementById('saveClientId').onclick = () => {
        const id = input.value.trim();
        if (id) {
          localStorage.setItem('googleDriveClientId', id);
          dialog.remove();
          resolve(id);
        } else {
          alert('Vänligen ange ett Client ID');
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('saveClientId').click();
        }
      });
    });
  }

  return clientId;
}

/**
 * Initialize Google API client and authenticate with new GIS
 */
async function initGoogleDrive() {
  const clientId = await getGoogleClientId();
  if (!clientId) return null;

  // Load Google API client and GIS
  if (!window.gapi) {
    await loadGoogleAPI();
  }
  if (!window.google?.accounts) {
    await loadGoogleGIS();
  }

  return new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
        });

        // Get access token using new GIS
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              reject(response);
            } else {
              // Set the access token
              gapi.client.setToken({access_token: response.access_token});
              resolve(gapi.client);
            }
          }
        });

        // Request access token
        tokenClient.requestAccessToken({prompt: ''});

      } catch (error) {
        console.error('Failed to initialize Google Drive:', error);
        reject(error);
      }
    });
  });
}

/**
 * Load Google API script
 */
function loadGoogleAPI() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Load Google Identity Services script
 */
function loadGoogleGIS() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Get or create the Spatial View Backups folder in Drive
 */
async function getOrCreateFolder(client) {
  try {
    // Search for existing folder
    const response = await client.drive.files.list({
      q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.result.files.length > 0) {
      return response.result.files[0].id;
    }

    // Create folder if it doesn't exist
    const folderMetadata = {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const folder = await client.drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });

    return folder.result.id;
  } catch (error) {
    console.error('Failed to get/create folder:', error);
    throw error;
  }
}

/**
 * Upload backup to Google Drive using multipart upload
 */
export async function uploadBackupToDrive(zipBlob) {
  try {
    const client = await initGoogleDrive();
    if (!client) return null;

    const folderId = await getOrCreateFolder(client);

    // Generate filename with date and time
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const fileName = `spatial-view-backup-${date}_${time}.zip`;

    // Get access token
    const token = gapi.client.getToken();
    if (!token) {
      throw new Error('No access token available');
    }

    // Create metadata
    const metadata = {
      name: fileName,
      mimeType: 'application/zip',
      parents: [folderId]
    };

    // Create multipart request body
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/zip';

    // Read blob as array buffer
    const fileContent = await zipBlob.arrayBuffer();
    const base64File = btoa(
      new Uint8Array(fileContent)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + contentType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' +
      base64File +
      close_delim;

    // Upload with fetch
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token.access_token,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    const result = await response.json();
    console.log('Uploaded to Drive:', result);

    // Store file ID and timestamp
    localStorage.setItem('lastDriveBackupId', result.id);
    localStorage.setItem('lastDriveBackupTime', new Date().toISOString());

    return result;
  } catch (error) {
    console.error('Failed to upload to Drive:', error);
    throw error;
  }
}

/**
 * Get latest backup from Google Drive
 */
export async function getLatestBackupFromDrive() {
  try {
    const client = await initGoogleDrive();
    if (!client) return null;

    const folderId = await getOrCreateFolder(client);

    // List all backup files, sorted by modification time
    const response = await client.drive.files.list({
      q: `'${folderId}' in parents and name contains 'spatial-view-backup' and trashed=false`,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name, modifiedTime, size)',
      pageSize: 1
    });

    if (response.result.files.length === 0) {
      return null;
    }

    return response.result.files[0];
  } catch (error) {
    console.error('Failed to get latest backup:', error);
    throw error;
  }
}

/**
 * Download backup from Google Drive using direct fetch
 */
export async function downloadBackupFromDrive(fileId) {
  try {
    const client = await initGoogleDrive();
    if (!client) return null;

    // Get access token
    const token = gapi.client.getToken();
    if (!token) {
      throw new Error('No access token available');
    }

    // Download file with direct fetch
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token.access_token
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Download failed');
    }

    // Get blob directly from response
    const blob = await response.blob();
    console.log('Downloaded from Drive:', fileId, 'Size:', blob.size, 'bytes');

    return blob;
  } catch (error) {
    console.error('Failed to download from Drive:', error);
    throw error;
  }
}

/**
 * Check if there's a newer backup in Drive
 */
export async function checkForNewerBackup() {
  try {
    const latestDrive = await getLatestBackupFromDrive();
    if (!latestDrive) return null;

    const lastLocalSync = localStorage.getItem('lastDriveBackupTime');
    if (!lastLocalSync) return latestDrive; // No local sync yet

    const driveTime = new Date(latestDrive.modifiedTime);
    const localTime = new Date(lastLocalSync);

    if (driveTime > localTime) {
      return latestDrive;
    }

    return null;
  } catch (error) {
    console.error('Failed to check for newer backup:', error);
    return null;
  }
}

/**
 * Check on app open and offer to restore if newer backup exists
 */
export async function checkAndOfferRestore() {
  try {
    const newerBackup = await checkForNewerBackup();
    if (!newerBackup) return;

    // Show dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
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

    const backupDate = new Date(newerBackup.modifiedTime).toLocaleString('sv-SE');

    dialog.innerHTML = `
      <div style="
        background: var(--bg-primary);
        color: var(--text-primary);
        border-radius: 12px;
        padding: 30px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <h2 style="margin: 0 0 20px 0;">☁️ Nyare backup i Google Drive</h2>
        <p style="margin: 0 0 15px 0; line-height: 1.6;">
          Det finns en nyare backup i Google Drive:
        </p>
        <p style="margin: 0 0 20px 0; font-weight: bold; color: var(--accent-color);">
          ${newerBackup.name}<br>
          ${backupDate}
        </p>
        <p style="margin: 0 0 20px 0; line-height: 1.6;">
          Vill du återställa denna backup?
        </p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelRestore" style="
            padding: 10px 20px;
            border: 1px solid var(--border-color);
            background: var(--bg-secondary);
            color: var(--text-primary);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Nej, behåll lokala data</button>
          <button id="confirmRestore" style="
            padding: 10px 20px;
            border: none;
            background: var(--accent-color);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Ja, återställ</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    return new Promise((resolve) => {
      document.getElementById('cancelRestore').onclick = () => {
        dialog.remove();
        resolve(false);
      };

      document.getElementById('confirmRestore').onclick = async () => {
        dialog.remove();

        // Download and restore
        const statusDiv = document.createElement('div');
        statusDiv.textContent = '☁️ Laddar ner backup från Drive...';
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

        try {
          const blob = await downloadBackupFromDrive(newerBackup.id);

          if (blob && window.handleRestoreFromBlob) {
            await window.handleRestoreFromBlob(blob);
            statusDiv.textContent = '✅ Backup återställd från Drive!';
            statusDiv.style.background = '#27ae60';
          } else {
            throw new Error('Kunde inte återställa backup');
          }
        } catch (error) {
          console.error('Failed to restore from Drive:', error);
          statusDiv.textContent = '❌ Misslyckades: ' + error.message;
          statusDiv.style.background = '#c0392b';
        }

        setTimeout(() => {
          statusDiv.remove();
        }, 3000);

        resolve(true);
      };
    });

  } catch (error) {
    console.error('Failed to check for newer backup:', error);
    return false;
  }
}

/**
 * Main sync function
 */
export async function syncWithDrive() {
  try {
    // Create and upload backup
    const { getAllCards } = await import('./storage.js');
    const JSZip = (await import('jszip')).default;

    console.log('Creating backup for Drive sync...');
    const zip = new JSZip();

    const cards = await getAllCards();
    const jsonData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      cards: cards
    };

    zip.file('cards.json', JSON.stringify(jsonData, null, 2));

    // Add images
    const imagesFolder = zip.folder('images');
    for (const card of cards) {
      if (card.image) {
        const imageSrc = typeof card.image === 'string' ? card.image : card.image.base64;
        const base64Data = imageSrc.split(',')[1];
        if (base64Data) {
          imagesFolder.file(`card_${card.id}.png`, base64Data, { base64: true });
        }
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });

    // Upload to Drive
    const result = await uploadBackupToDrive(blob);

    if (result) {
      return {
        success: true,
        message: `Synkat till Google Drive: ${result.name}`,
        file: result
      };
    }

    return {
      success: false,
      message: 'Synk avbröts'
    };

  } catch (error) {
    console.error('Sync failed:', error);
    return {
      success: false,
      message: 'Synk misslyckades: ' + error.message
    };
  }
}
