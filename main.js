const { app, BrowserWindow, ipcMain, globalShortcut, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const license = require('./electron/license');
const autoUpdater = require('./src/update/electron-auto-updater');

// Log any uncaught promise rejections to avoid silent crashes during printing/hardware operations
process.on('unhandledRejection', (reason, promise) => {
  console.error('UnhandledPromiseRejection:', reason && (reason.stack || reason));
});

// Store the license in the user's data directory (writable) instead of inside the app.asar
// e.g. Windows: C:\Users\<User>\AppData\Roaming\VendoPro\electron\license.json
const USER_DATA_PATH = (app && app.getPath) ? app.getPath('userData') : path.join(__dirname, 'electron');
const LICENSE_DIR = path.join(USER_DATA_PATH, 'electron');
try {
  if (!fs.existsSync(LICENSE_DIR)) fs.mkdirSync(LICENSE_DIR, { recursive: true });
} catch (err) {
  console.error('❌ Could not create license directory:', err.message);
}
const LICENSE_STORE_PATH = path.join(LICENSE_DIR, 'license.json');
console.log('ℹ️  License store path:', LICENSE_STORE_PATH);

// Get stored license data (including payload and signature for offline use)
function getStoredLicense() {
  if (!fs.existsSync(LICENSE_STORE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LICENSE_STORE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// Save license with all necessary data for offline verification
function saveLicense(licenseData) {
  fs.writeFileSync(LICENSE_STORE_PATH, JSON.stringify(licenseData, null, 2));
}

function validateLicenseKey(key) {
  // Accept keys in format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX (5 parts of 5 chars)
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(key);
}

function checkLicense() {
  const stored = getStoredLicense();
  if (!stored || !stored.key) {
    return false;
  }
  if (!validateLicenseKey(stored.key)) {
    return false;
  }
  
  // 🔒 MACHINE BINDING: Verify this is the same machine
  const currentMachineId = license.getMachineId() || 'UNKNOWN';
  if (stored.machine_id && stored.machine_id !== currentMachineId) {
    console.log('❌ License is bound to a different machine');
    console.log(`   Registered: ${stored.machine_id}`);
    console.log(`   Current:    ${currentMachineId}`);
    // Delete invalid license
    if (fs.existsSync(LICENSE_STORE_PATH)) {
      fs.unlinkSync(LICENSE_STORE_PATH);
    }
    return false;
  }
  
  // Check expiration
  if (stored.expire_at) {
    const expiryDate = new Date(stored.expire_at);
    if (expiryDate < new Date()) {
      console.log('❌ License expired');
      return false;
    }
  }
  return true;
}

// IPC handler for OFFLINE-ONLY license activation with machine binding
ipcMain.handle('activate-license', async (event, key, payload = null, signature = null, clientMachineId = null) => {
  try {
    if (!validateLicenseKey(key)) {
      return { success: false, error: 'Clé de licence invalide.' };
    }

    // Prefer client-provided machine id (from renderer) if present, else detect here
    const providedId = clientMachineId || license.getMachineId();
    const normalizedMachineId = license.normalizeId ? license.normalizeId(providedId) : providedId;
    const storedLicense = getStoredLicense();
    
    // If client provided a different id than we detect locally, log it
    const detected = license.getMachineId();
    if (detected && normalizedMachineId !== (license.normalizeId ? license.normalizeId(detected) : detected)) {
      console.log('⚠️ Notice: renderer provided machine id differs from local detection. Using provided id for activation.');
    }

    // Check if this is first activation (no stored license)
    const isFirstActivation = !storedLicense || !storedLicense.machine_id;
    
    // Prepare license data for offline activation
    const licenseData = {
      license_key: key,
      payload: payload || (storedLicense && storedLicense.payload),
      signature: signature || (storedLicense && storedLicense.signature),
      machine_id: normalizedMachineId
    };

    // OFFLINE-ONLY activation
    const result = await license.activateLicense(key, normalizedMachineId, licenseData, isFirstActivation);

    if (result.success) {
      // Save license with machine binding
      const licenseToSave = {
        key: key,
        machine_id: normalizedMachineId, // LOCKED to this machine (normalized)
        expire_at: result.data.expire_at,
        payload: payload || (storedLicense && storedLicense.payload),
        signature: signature || (storedLicense && storedLicense.signature),
        activated_at: new Date().toISOString(),
        mode: 'offline', // Always offline
        max_devices: 1 // Single device only
      };
      
      saveLicense(licenseToSave);
      
      return {
        success: true,
        mode: 'offline',
        message: isFirstActivation 
          ? '✅ License activated and bound to this machine' 
          : '✅ License re-activated successfully'
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: start a 7-day trial (creates a local, machine‑bound trial license)
ipcMain.handle('start-trial', async (event, days = 7) => {
  try {
    const trialDays = parseInt(days, 10) || 7;
    const machineId = license.getMachineId();
    const normalizedMachineId = license.normalizeId ? license.normalizeId(machineId) : machineId;
    const now = new Date();
    const expireAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    // Generate a 5x5 license key so it passes validateLicenseKey()
    function genKey() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const parts = [];
      for (let i = 0; i < 5; i++) {
        let part = '';
        for (let j = 0; j < 5; j++) {
          part += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        parts.push(part);
      }
      return parts.join('-');
    }

    const key = genKey();

    const licenseToSave = {
      key,
      machine_id: normalizedMachineId,
      expire_at: expireAt,
      payload: null,
      signature: null,
      activated_at: now.toISOString(),
      mode: 'trial',
      trial: true,
      max_devices: 1
    };

    saveLicense(licenseToSave);

    return { success: true, license_key: key, expire_at: expireAt, days: trialDays };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// OFFLINE-ONLY: No periodic validation needed
// License is verified only at startup through signature verification and machine binding

// Listen for close-app event from renderer to quit the app (deprecated - prefer 'confirm-close')
ipcMain.on('close-app', () => {
  app.quit();
});

// After renderer confirms via modal, proceed to close the window
ipcMain.on('confirm-close', () => {
  allowClose = true;
  if (mainWindow) {
    mainWindow.close();
  } else {
    app.quit();
  }
});
const nodemailer = require('nodemailer');
const { initDatabase, closeDatabase } = require('./electron/database/db');
const queries = require('./electron/database/queries');

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'pos.sales.system@gmail.com',
    pass: 'azao vbfg jdcw hhsz'
  }
};

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport(EMAIL_CONFIG);
};

let mainWindow;
let allowClose = false; // set to true when renderer confirms close

// Single instance lock - prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // This is the first instance, handle second-instance events
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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
     mainWindow.webContents.openDevTools(); // Disabled: Do not open DevTools automatically
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercept window close and ask renderer to confirm first
  mainWindow.on('close', (e) => {
    if (!allowClose) {
      e.preventDefault();
      mainWindow.webContents.send('request-close');
    }
  });

  // 🔄 ATTACH AUTO-UPDATER TO WINDOW (always)
  // Ensure renderer receives `update-status` events even in development so UI reflects errors/results.
  try {
    autoUpdater.setMainWindow(mainWindow);
  } catch (err) {
    console.warn('AutoUpdater: could not set main window -', err && err.message);
  }

  // Start periodic update checks only when packaged
  if (app.isPackaged) {
    autoUpdater.startPeriodicChecks(4);

    // On every application start, perform a silent update check if internet is available.
    // We use a DNS lookup to avoid adding extra dependencies.
    const dns = require('dns');
    dns.lookup('github.com', (err) => {
      if (!err) {
        console.log('AutoUpdater: network available on startup — checking for updates (silent)');
        // silent, non-intrusive check (renderer treats this as 'periodic')
        autoUpdater.checkForUpdatesQuietly();
      } else {
        console.log('AutoUpdater: no network on startup — skipping update check');
      }
    });
  }
}


app.whenReady().then(async () => {
  // Initialize database
  try {
    await initDatabase();
    console.log('✅ Database ready');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  }

  createWindow();

  // Register global shortcuts for cash drawer
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    mainWindow.webContents.send('open-cash-drawer');
  });

  // TESTING: Reset setup with Ctrl+Shift+R
globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow.webContents.executeJavaScript(`
      localStorage.removeItem('authData');
      localStorage.removeItem('verificationCode');
      sessionStorage.clear();
      // Dispatch an app-level notification instead of using alert
      window.dispatchEvent(new CustomEvent('app-notification', { detail: { message: '✅ Setup reset! The app will restart.', type: 'info' } }));
      setTimeout(() => window.location.reload(), 1000);
      `);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    globalShortcut.unregisterAll();
    closeDatabase();
    app.quit();
  }
});

// 🔄 ADD AUTO-UPDATER IPC HANDLERS
ipcMain.handle('check-for-updates', async () => {
  try {
    // Delegate to the AutoUpdater which will emit the appropriate 'checking' event with source info
    autoUpdater.manualCheckForUpdates();
    return { success: true };
  } catch (error) {
    // Forward error to renderer as well
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', { event: 'update-error', data: error });
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('download-update', async () => {
  try {
    const { autoUpdater: updater } = require('electron-updater');
    await updater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', async () => {
  const { autoUpdater: updater } = require('electron-updater');
  setImmediate(() => updater.quitAndInstall(false, true));
});

// ============= FONT FILE HANDLER =============
ipcMain.handle('read-font-file', async (event, fontPath) => {
  try {
    console.log('📂 Reading font file:', fontPath);
    
    // Remove leading slash if present
    const cleanPath = fontPath.startsWith('/') ? fontPath.substring(1) : fontPath;
    const fullPath = path.join(__dirname, cleanPath);
    
    console.log('📂 Full font path:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('❌ Font file not found at:', fullPath);
      return null;
    }
    
    const stats = fs.statSync(fullPath);
    console.log('📊 Font file size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    
    const fontBuffer = fs.readFileSync(fullPath);
    const base64Font = fontBuffer.toString('base64');
    
    console.log('✅ Font file converted to base64, length:', base64Font.length);
    return base64Font;
  } catch (error) {
    console.error('❌ Error reading font file:', error);
    return null;
  }
});

// IPC: return available system printers (renderer can use this to populate a select)
ipcMain.handle('printers:get', async () => {
  try {
    if (!mainWindow || !mainWindow.webContents) return [];
    const printers = mainWindow.webContents.getPrinters();
    // Return simplified objects: name and isDefault
    return printers.map(p => ({ name: p.name, isDefault: !!p.isDefault }));
  } catch (err) {
    console.error('Failed to get printers:', err && err.message);
    return [];
  }
});

// ============= DATABASE IPC HANDLERS =============

// Import snapshot (bulk import) - used by network sync to import server snapshot into local DB
ipcMain.handle('db:importSnapshot', async (event, snapshot) => {
  try {
    // queries.importSnapshot will perform a transactional replace of core tables
    if (!queries.importSnapshot) {
      throw new Error('importSnapshot not implemented in queries module');
    }
    await queries.importSnapshot(snapshot);
    return { success: true };
  } catch (error) {
    console.error('Error importing snapshot:', error);
    return { success: false, error: error.message };
  }
});

// PRODUCTS
ipcMain.handle('db:getAllProducts', async () => {
  try {
    return { success: true, data: queries.getAllProducts() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getProductById', async (event, id) => {
  try {
    return { success: true, data: queries.getProductById(id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getProductByBarcode', async (event, barcode) => {
  try {
    return { success: true, data: queries.getProductByBarcode(barcode) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createProduct', async (event, product) => {
  try {
    return { success: true, data: queries.createProduct(product) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateProduct', async (event, id, product) => {
  try {
    return { success: true, data: queries.updateProduct(id, product) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteProduct', async (event, id) => {
  try {
    queries.deleteProduct(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// INVOICES
ipcMain.handle('db:getAllInvoices', async () => {
  try {
    return { success: true, data: queries.getAllInvoices() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getInvoiceById', async (event, id) => {
  try {
    return { success: true, data: queries.getInvoiceById(id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createInvoice', async (event, invoice) => {
  try {
    return { success: true, data: queries.createInvoice(invoice) };
  } catch (error) {
    console.error('Invoice creation error:', error);
    let errorMsg = error && error.message ? error.message : JSON.stringify(error);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('db:updateInvoice', async (event, id, updates) => {
  try {
    return queries.updateInvoice(id, updates);
  } catch (error) {
    console.error('Invoice update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteInvoice', async (event, id) => {
  try {
    queries.deleteInvoice(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:clearAllInvoices', async () => {
  try {
    queries.clearAllInvoices();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// CLIENTS (CUSTOMERS) IPC
ipcMain.handle('db:getAllClients', async () => {
  try {
    return { success: true, data: queries.getAllClients() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:searchClients', async (event, term) => {
  try {
    return { success: true, data: queries.searchClients(term) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createClient', async (event, client) => {
  try {
    return { success: true, data: queries.createClient(client) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateClient', async (event, id, client) => {
  try {
    return { success: true, data: queries.updateClient(id, client) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// SUPPLIER INVOICES
ipcMain.handle('db:getAllSupplierInvoices', async () => {
  try {
    return { success: true, data: queries.getAllSupplierInvoices() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getSupplierInvoiceById', async (event, id) => {
  try {
    return { success: true, data: queries.getSupplierInvoiceById(id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createSupplierInvoice', async (event, invoice) => {
  try {
    return { success: true, data: queries.createSupplierInvoice(invoice) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateSupplierInvoice', async (event, id, updates) => {
  try {
    return { success: true, data: queries.updateSupplierInvoice(id, updates) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteSupplierInvoice', async (event, id) => {
  try {
    queries.deleteSupplierInvoice(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// EMPLOYEES
ipcMain.handle('db:getAllEmployees', async () => {
  try {
    return { success: true, data: queries.getAllEmployees() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getEmployeeById', async (event, id) => {
  try {
    return { success: true, data: queries.getEmployeeById(id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createEmployee', async (event, employee) => {
  try {
    return { success: true, data: queries.createEmployee(employee) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateEmployee', async (event, id, employee) => {
  try {
    return { success: true, data: queries.updateEmployee(id, employee) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteEmployee', async (event, id) => {
  try {
    queries.deleteEmployee(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// EMPLOYEE LEAVE
ipcMain.handle('db:getEmployeeLeave', async (event, employeeId) => {
  try {
    return { success: true, data: queries.getEmployeeLeave(employeeId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createLeave', async (event, leave) => {
  try {
    const result = queries.createLeave(leave);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateLeave', async (event, id, leave) => {
  try {
    queries.updateLeave(id, leave);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteLeave', async (event, id) => {
  try {
    queries.deleteLeave(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:calculateAccruedLeave', async (event, startDate, leavePerMonth) => {
  try {
    const result = queries.calculateAccruedLeave(startDate, leavePerMonth);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// EMPLOYEE BONUSES
ipcMain.handle('db:getEmployeeBonuses', async (event, employeeId) => {
  try {
    return { success: true, data: queries.getEmployeeBonuses(employeeId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:createBonus', async (event, bonus) => {
  try {
    const result = queries.createBonus(bonus);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:updateBonus', async (event, id, bonus) => {
  try {
    queries.updateBonus(id, bonus);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteBonus', async (event, id) => {
  try {
    queries.deleteBonus(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// SETTINGS
ipcMain.handle('db:getSetting', async (event, key) => {
  try {
    return { success: true, data: queries.getSetting(key) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:setSetting', async (event, key, value) => {
  try {
    queries.setSetting(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:getAllSettings', async () => {
  try {
    return { success: true, data: queries.getAllSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============= HARDWARE IPC HANDLERS =============

// IPC handlers for barcode scanner
ipcMain.on('barcode-scanned', (event, barcode) => {
  event.reply('barcode-result', barcode);
});

// IPC handler for printing
ipcMain.on('print-receipt', async (event, receiptData = {}) => {
  console.log('Print receipt request:', receiptData);

  // Build a minimal HTML receipt (renderer already sends structured receiptData)
  const buildReceiptHtml = (r) => {
    // If renderer already provided a pre-built HTML payload, use it directly
    if (r && r.html && typeof r.html === 'string') return r.html;

    const itemsHtml = (r.items || []).map(i => `
      <tr>
        <td style="padding:2px 0">${(i.name || '')}</td>
        <td style="text-align:right;padding:2px 0">${(i.quantity || 1)} x ${(i.price || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <div style="font-family: Arial, sans-serif; width:100%">
        <h2 style="margin:6px 0;text-align:center">${(r.storeName || '')}</h2>
        <div style="font-size:12px;margin-bottom:6px;text-align:center">${(r.storeAddress || '')}</div>
        <div style="margin:6px 0">${(r.date || new Date().toLocaleString())}</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          ${itemsHtml}
        </table>
        <hr/>
        <div style="display:flex;justify-content:space-between;font-weight:700">
          <div>Subtotal</div><div>${(r.subtotal || 0).toFixed(2)}</div>
        </div>
        <div style="display:flex;justify-content:space-between">
          <div>Tax</div><div>${(r.tax || 0).toFixed(2)}</div>
        </div>
        <div style="display:flex;justify-content:space-between">
          <div>Discount</div><div>${(r.discount || 0).toFixed(2)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;margin-top:6px">
          <div>Total</div><div>${(r.total || 0).toFixed(2)}</div>
        </div>
        <div style="text-align:center;margin-top:8px;font-size:12px">${(r.paymentMethod || '')}</div>
        <div style="text-align:center;margin-top:8px;font-size:11px">${(r.footer || '')}</div>
      </div>
    `;
  };

  const html = buildReceiptHtml(receiptData);
  const printerName = receiptData.printerName || undefined;
  const showDialog = receiptData.showDialog === true; // if true, open native print dialog

  try {
    // If user requested a dialog, skip POS library and use webContents.print with dialog
    if (showDialog) {
      mainWindow.webContents.print({ silent: false }, (success, failureReason) => {
        if (success) event.reply('print-result', { success: true });
        else event.reply('print-result', { success: false, error: failureReason || 'Print failed' });
      });
      return;
    }

    // Prefer electron-pos-printer (prints HTML/CSS to POS printers) when available
    const { PosPrinter } = require('electron-pos-printer');

    const options = {
      preview: false,
      width: '80mm',
      margin: '0 0 0 0',
      copies: receiptData.copies || 1,
      printerName: printerName,
      silent: true,
      timeOutPerLine: 100
    };

    // electron-pos-printer expects an array of "lines". use a single `text` line whose value is the HTML markup
    const posPrintData = [
      {
        type: 'text',
        value: html,
        style: { fontSize: '12px', textAlign: 'left' }
      }
    ];

    // Defensive normalization: if some caller accidentally passed a string/non-iterable, normalize to an array.
    const normalizedPosData = Array.isArray(posPrintData) ? posPrintData : [{ type: 'text', value: String(posPrintData) }];

    // Log printer attempt for easier debugging
    console.log('Attempting electron-pos-printer with data lines:', normalizedPosData.length, 'printerName:', options.printerName || '(system default)');

    // Correct call signature: PosPrinter.print(dataArray, options)
    await PosPrinter.print(normalizedPosData, options).catch(err => {
      // Ensure any rejection is handled here (prevents unhandled promise rejection coming from the module)
      console.warn('PosPrinter.print rejected:', err && err.message ? err.message : err);
      throw err; // rethrow so outer try/catch falls back to webContents.print
    });

    event.reply('print-result', { success: true });
    return;
  } catch (err) {
    console.warn('electron-pos-printer failed or not available, falling back to webContents.print —', err && err.message);
  }

  // Fallback: use Electron's webContents.print (works with system printers)
  try {
    // If a specific device name was provided, pass it; otherwise use silent default printer
    const printOptions = { silent: true };
    if (printerName) printOptions.deviceName = printerName;

    mainWindow.webContents.print(printOptions, (success, failureReason) => {
      if (success) {
        event.reply('print-result', { success: true });
      } else {
        event.reply('print-result', { success: false, error: failureReason || 'Unknown print error' });
      }
    });
  } catch (err) {
    console.error('Print failed:', err);
    event.reply('print-result', { success: false, error: err.message });
  }
});

// IPC handler for cash drawer
ipcMain.on('open-cash-drawer', (event) => {
  // Cash drawer open logic
  console.log('Opening cash drawer');
  event.reply('cash-drawer-result', { success: true });
});

// ==========================================
// TPE (Card Terminal) Integration Handlers
// ==========================================

// Serial port communication for TPE
ipcMain.on('tpe-payment-request', async (event, { amount, currency, transactionId, port, baudRate, command, terminator, approvedKeywords, declinedKeywords, debug }) => {
  if (debug) {
    console.log(`[TPE Serial] Payment request: ${amount/100} ${currency} on ${port}`);
    console.log(`[TPE Serial] Command: ${command}`);
  }
  
  try {
    const SerialPort = require('serialport');
    const serialPort = new SerialPort(port, {
      baudRate: baudRate || 9600,
      autoOpen: false
    });

    serialPort.open((err) => {
      if (err) {
        event.reply('tpe-payment-response', {
          success: false,
          error: 'SERIAL_ERROR',
          message: err.message
        });
        return;
      }

      // Send payment command (use provided custom command or default)
      const paymentCommand = command || `PAY:${amount}:${currency}:${transactionId}\r\n`;
      
      serialPort.write(paymentCommand, (writeErr) => {
        if (writeErr) {
          event.reply('tpe-payment-response', {
            success: false,
            error: 'WRITE_ERROR',
            message: writeErr.message
          });
          serialPort.close();
          return;
        }

        // Listen for response
        let responseBuffer = '';
        const responseTerminator = terminator || '\r\n';
        const timeout = setTimeout(() => {
          serialPort.close();
          event.reply('tpe-payment-response', {
            success: false,
            error: 'TIMEOUT',
            message: 'Payment timeout - no response from terminal'
          });
        }, 30000);

        serialPort.on('data', (data) => {
          responseBuffer += data.toString();
          
          if (debug) {
            console.log('[TPE Serial] Received:', data.toString());
          }
          
          // Check if response is complete
          if (responseBuffer.includes(responseTerminator) || 
              approvedKeywords.some(kw => responseBuffer.toUpperCase().includes(kw.toUpperCase())) ||
              declinedKeywords.some(kw => responseBuffer.toUpperCase().includes(kw.toUpperCase()))) {
            
            clearTimeout(timeout);
            serialPort.close();
            
            // Parse response with custom keywords
            const approved = approvedKeywords.some(kw => responseBuffer.toUpperCase().includes(kw.toUpperCase()));
            
            if (debug) {
              console.log('[TPE Serial] Final response:', responseBuffer);
              console.log('[TPE Serial] Approved:', approved);
            }
            
            event.reply('tpe-payment-response', {
              success: approved,
              status: approved ? 'APPROVED' : 'DECLINED',
              response: responseBuffer.trim(),
              transactionId: transactionId
            });
          }
        });
      });
    });
  } catch (error) {
    console.error('[TPE Serial] Error:', error);
    event.reply('tpe-payment-response', {
      success: false,
      error: 'EXCEPTION',
      message: error.message
    });
  }
});

// Test TPE connection
ipcMain.on('tpe-test-connection', async (event, { port, baudRate }) => {
  try {
    const SerialPort = require('serialport');
    const serialPort = new SerialPort(port, {
      baudRate: baudRate || 9600,
      autoOpen: false
    });

    serialPort.open((err) => {
      if (err) {
        event.reply('tpe-test-response', {
          success: false,
          message: `Cannot open ${port}: ${err.message}`
        });
        return;
      }

      // Send status/ping command
      serialPort.write('STATUS\r\n', (writeErr) => {
        if (writeErr) {
          serialPort.close();
          event.reply('tpe-test-response', {
            success: false,
            message: 'Cannot write to terminal'
          });
          return;
        }

        setTimeout(() => {
          serialPort.close();
          event.reply('tpe-test-response', {
            success: true,
            message: `Connected to ${port} at ${baudRate} baud`
          });
        }, 1000);
      });
    });
  } catch (error) {
    event.reply('tpe-test-response', {
      success: false,
      message: error.message
    });
  }
});

// Cancel ongoing TPE payment
ipcMain.on('tpe-cancel-payment', (event, { transactionId }) => {
  console.log(`[TPE] Cancelling payment: ${transactionId}`);
  // Implementation depends on terminal protocol
  // Usually send CANCEL command to serial port or HTTP endpoint
});

// ==========================================

// IPC handler for opening email
ipcMain.on('open-email', (event, mailtoLink) => {
  shell.openExternal(mailtoLink).catch(err => {
    console.error('Failed to open email client:', err);
  });
});

// IPC handler for opening email (with async/await support)
ipcMain.handle('open-email', async (event, mailtoLink) => {
  try {
    await shell.openExternal(mailtoLink);
    return { success: true };
  } catch (error) {
    console.error('Failed to open email client:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for sending verification code email
ipcMain.handle('send-verification-email', async (event, { email, code }) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: 'POS <pos.sales.system@gmail.com>',
      to: email,
      subject: 'Password Reset - Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #ff6600; margin-top: 0;">🔑 Password Reset Request</h2>
            <p style="color: #333; font-size: 16px;">You requested a password reset for your POS account.</p>
            <p style="color: #333; font-size: 16px;">Your verification code is:</p>
            <div style="background-color: #ff6600; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0; letter-spacing: 8px;">
              ${code}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">POS - Point of Sale Software</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-mac-address', async () => {
  try {
    return license.getMacAddress();
  } catch {
    return '';
  }
});

// Send license request (client contact info + disk id) to vendor email
ipcMain.handle('send-license-request', async (event, info) => {
  try {
    const { clientName, clientEmail, clientPhone, diskId } = info || {};
    if (!clientName || !clientEmail) {
      return { success: false, error: 'Client name and email are required.' };
    }

    const transporter = createTransporter();

    const body = `Offline license request\n\nClient name: ${clientName}\nClient email: ${clientEmail}\nClient phone: ${clientPhone || 'N/A'}\nDisk ID: ${diskId || 'N/A'}\nHost: ${require('os').hostname()}\nDate: ${new Date().toISOString()}`;

    const mailOptions = {
      from: EMAIL_CONFIG.auth.user,
      to: EMAIL_CONFIG.auth.user, // send to pos.sales.system@gmail.com
      subject: `Offline License Request from ${clientName}`,
      text: body
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ License request email sent.');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send license request:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('check-license-activated', async () => {
  try {
    const stored = getStoredLicense();
    return !!(stored && stored.key && validateLicenseKey(stored.key));
  } catch {
    return false;
  }
});

// Database Server Management
// Database Server Management
// Database Server Management
// Database Server Management
// Database Server Management - Using Child Process
let dbServerProcess = null;

ipcMain.handle('start-database-server', async () => {
  try {
    if (dbServerProcess) {
      return { 
        success: true, 
        message: 'Database server already running',
        alreadyRunning: true
      };
    }

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    let serverPath;
    
    if (isDev) {
      serverPath = path.join(__dirname, 'database-server');
    } else {
      serverPath = path.join(process.resourcesPath, 'database-server');
    }

    const serverModulePath = path.join(serverPath, 'server.js');

    if (!fs.existsSync(serverModulePath)) {
      return { 
        success: false, 
        error: `Server module not found at: ${serverModulePath}` 
      };
    }

    // Set database file path
    const dbFilePath = app.isPackaged 
      ? path.join(app.getPath('userData'), 'pos.db')
      : path.join(__dirname, 'electron', 'database', 'pos.db');
    
    console.log('[DB Server] Using database at:', dbFilePath);

    // ✅ Use child process to run the server
    const { spawn } = require('child_process');
    
    dbServerProcess = spawn('node', [serverModulePath], {
      env: {
        ...process.env,
        DB_FILE_PATH: dbFilePath,
        PORT: '3001',
        NODE_ENV: isDev ? 'development' : 'production'
      },
      cwd: serverPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Log server output
    dbServerProcess.stdout.on('data', (data) => {
      console.log('[DB Server]', data.toString().trim());
    });

    dbServerProcess.stderr.on('data', (data) => {
      console.error('[DB Server Error]', data.toString().trim());
    });

    dbServerProcess.on('close', (code) => {
      console.log('[DB Server] Process exited with code', code);
      dbServerProcess = null;
    });

    dbServerProcess.on('error', (error) => {
      console.error('[DB Server] Process error:', error);
      dbServerProcess = null;
    });

    // ✅ Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ✅ Verify server started by checking if process is still running
    if (dbServerProcess && dbServerProcess.exitCode === null) {
      console.log('[DB Server] Server started successfully on port 3001');
      return { 
        success: true, 
        message: 'Database server started successfully'
      };
    } else {
      return {
        success: false,
        error: 'Server process failed to start or exited immediately'
      };
    }

  } catch (error) {
    console.error('[DB Server] Error:', error);
    dbServerProcess = null;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-database-server', async () => {
  try {
    console.log('[DB Server] Stop requested');

    if (!dbServerProcess) {
      console.log('[DB Server] No server running');
      return { success: true, message: 'Server was not running' };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[DB Server] Force killing server (timeout)');
        try {
          dbServerProcess.kill('SIGKILL');
        } catch (e) {
          console.error('[DB Server] Error force killing:', e);
        }
        dbServerProcess = null;
        resolve({ success: true, message: 'Database server stopped (forced)' });
      }, 5000);

      dbServerProcess.on('close', () => {
        clearTimeout(timeout);
        dbServerProcess = null;
        console.log('[DB Server] Server stopped successfully');
        resolve({ success: true, message: 'Database server stopped' });
      });

      // ✅ Send SIGTERM to gracefully stop the server
      try {
        console.log('[DB Server] Sending SIGTERM to server process');
        dbServerProcess.kill('SIGTERM');
      } catch (killError) {
        clearTimeout(timeout);
        console.error('[DB Server] Error sending SIGTERM:', killError);
        dbServerProcess = null;
        resolve({ success: true, message: 'Database server stopped (error)' });
      }
    });
  } catch (error) {
    console.error('[DB Server] Error in stop handler:', error);
    dbServerProcess = null;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-database-server-status', async () => {
  const running = dbServerProcess !== null && dbServerProcess.exitCode === null;
  console.log('[DB Server] Status check:', { running, hasProcess: !!dbServerProcess });
  return { running };
});

// Clean up server on app quit
app.on('before-quit', () => {
  if (dbServerProcess) {
    try {
      console.log('[DB Server] Killing server on app quit');
      dbServerProcess.kill('SIGTERM');
    } catch (err) {
      console.error('[DB Server] Error killing on quit:', err);
    }
    dbServerProcess = null;
  }
});

// Dialog handlers for proper focus management
ipcMain.handle('show-message-box', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(win, options);
  return result;
});

ipcMain.handle('show-error-box', async (event, title, content) => {
  dialog.showErrorBox(title, content);
  return { success: true };
});

// ============= LOCATION HANDLERS =============

ipcMain.handle('get-all-locations', async () => {
  try {
    const queries = require('./electron/database/queries');
    const locations = queries.getAllLocations();
    // Ensure a plain serializable object is returned to renderer
    return JSON.parse(JSON.stringify(locations));
  } catch (error) {
    console.error('Error getting locations:', error);
    // If this error mentions stmt.step, it's likely a better-sqlite3 native mismatch. Suggest rebuild.
    if (error && error.message && error.message.includes('stmt.step')) {
      console.error('⚠️ Detected `stmt.step` error - try rebuilding `better-sqlite3` with `npm rebuild better-sqlite3` or reinstalling modules.');
    }
    throw error;
  }
});

// Backwards-compat handler used by some codepaths
ipcMain.handle('db:getAllLocations', async () => {
  try {
    const queries = require('./electron/database/queries');
    const locations = queries.getAllLocations();
    return JSON.parse(JSON.stringify(locations));
  } catch (error) {
    console.error('Error getting locations (db:getAllLocations):', error);
    return { success: false, error: error.message };
  }
});

// Local DB IPC for location transfers (used by renderer helpers in local mode)
ipcMain.handle('db:getLocationTransfers', async (event, productId) => {
  try {
    const queries = require('./electron/database/queries');
    return { success: true, data: queries.getLocationTransfers(productId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:deleteLocationTransfer', async (event, transferId) => {
  try {
    const queries = require('./electron/database/queries');
    const r = queries.deleteLocationTransfer(transferId);
    return r;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-location', async (event, location) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.createLocation(location);
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
});

ipcMain.handle('update-location', async (event, id, location) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.updateLocation(id, location);
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
});

ipcMain.handle('delete-location', async (event, id) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.deleteLocation(id);
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
});

// ============= PRODUCT LOCATION HANDLERS =============

ipcMain.handle('get-product-locations', async (event, productId) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.getProductLocations(productId);
  } catch (error) {
    console.error('Error getting product locations:', error);
    throw error;
  }
});

ipcMain.handle('get-product-location-quantity', async (event, productId, locationId) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.getProductLocationQuantity(productId, locationId);
  } catch (error) {
    console.error('Error getting product location quantity:', error);
    throw error;
  }
});

ipcMain.handle('set-product-location-quantity', async (event, productId, locationId, quantity, localization) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.setProductLocationQuantity(productId, locationId, quantity, localization);
  } catch (error) {
    console.error('Error setting product location quantity:', error);
    throw error;
  }
});

ipcMain.handle('update-product-localization', async (event, productId, locationId, localization) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.updateProductLocalization(productId, locationId, localization);
  } catch (error) {
    console.error('Error updating product localization:', error);
    throw error;
  }
});

ipcMain.handle('get-total-product-quantity', async (event, productId) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.getTotalProductQuantity(productId);
  } catch (error) {
    console.error('Error getting total product quantity:', error);
    throw error;
  }
});

// ============= LOCATION TRANSFER HANDLERS =============

ipcMain.handle('create-location-transfer', async (event, transfer) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.createLocationTransfer(transfer);
  } catch (error) {
    console.error('Error creating location transfer:', error);
    throw error;
  }
});

ipcMain.handle('get-location-transfers', async (event, productId) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.getLocationTransfers(productId);
  } catch (error) {
    console.error('Error getting location transfers:', error);
    throw error;
  }
});

ipcMain.handle('delete-location-transfer', async (event, transferId) => {
  try {
    const queries = require('./electron/database/queries');
    return queries.deleteLocationTransfer(transferId);
  } catch (error) {
    console.error('Error deleting location transfer:', error);
    throw error;
  }
});

