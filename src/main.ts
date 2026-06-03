import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Store = require('electron-store');
import { initDb, closeDb } from './main/db/database';
import { autoLinkPdfs } from './main/pdf/linker';
import { registerHandlers, setStore } from './main/ipc/handlers';

if (started) app.quit();

const store = new Store({
  encryptionKey: 'axiontic-local-2024',
  schema: {
    smartbillUsername: { type: 'string', default: '' },
    smartbillToken:    { type: 'string', default: '' },
    companyCif:        { type: 'string', default: '' },
    seriesName:        { type: 'string', default: 'AX' },
    pdfFolderPath:     { type: 'string', default: '' },
  },
});

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  await initDb();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  setStore(store);
  registerHandlers(mainWindow);

  const folderPath = store.get('pdfFolderPath') as string;
  if (folderPath) autoLinkPdfs(folderPath);
}

app.on('ready', () => createWindow());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => closeDb());
