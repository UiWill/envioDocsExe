const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Evitar múltiplas instâncias do aplicativo
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Em desenvolvimento, carrega do servidor local
  // Em produção, carrega do arquivo HTML
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, './dist/index.html')}`;
    
  mainWindow.loadURL(startUrl);

  // DevTools disponível via atalho Ctrl+Shift+I (comentado para produção)
  // mainWindow.webContents.openDevTools();

  // Adicionar atalho para abrir/fechar DevTools (Ctrl+Shift+I ou Cmd+Shift+I no Mac)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow.webContents.toggleDevTools();
  });
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Manipuladores IPC para comunicação entre processos
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled) {
    return [];
  }
  return filePaths;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      data: data.toString('base64')
    };
  } catch (error) {
    console.error('Erro ao ler arquivo:', error);
    return null;
  }
}); 