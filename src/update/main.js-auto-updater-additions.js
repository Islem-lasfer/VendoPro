// Add this near the top of your main.js, after other requires
const autoUpdater = require('./electron-auto-updater');

// ... existing code ...

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true
    },
    icon: path.join(__dirname, 'img', 'icon.png'),
    frame: true,
    backgroundColor: '#000000',
    fullscreen: true,
    autoHideMenuBar: true
  });

  // Remove the menu bar completely
  mainWindow.setMenu(null);

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
     mainWindow.loadURL('http://localhost:3000');
     mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (e) => {
    if (!allowClose) {
      e.preventDefault();
      mainWindow.webContents.send('request-close');
    }
  });

  // 🔄 SET UP AUTO-UPDATER (only in production)
  if (app.isPackaged) {
    autoUpdater.setMainWindow(mainWindow);
    
    // Start periodic update checks (every 4 hours)
    autoUpdater.startPeriodicChecks(4);
  }
}

// 🔄 ADD AUTO-UPDATER IPC HANDLERS
// Manual update check (triggered by user)
ipcMain.handle('check-for-updates', async () => {
  try {
    autoUpdater.manualCheckForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get current app version
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

// Download update (if available)
ipcMain.handle('download-update', async () => {
  try {
    const { autoUpdater: updater } = require('electron-updater');
    await updater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Install update and restart
ipcMain.handle('install-update', async () => {
  const { autoUpdater: updater } = require('electron-updater');
  setImmediate(() => updater.quitAndInstall(false, true));
});

// ... rest of your existing code ...
