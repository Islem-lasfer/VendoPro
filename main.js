const { app, BrowserWindow, ipcMain, globalShortcut, shell, dialog } = require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const license = require('./electron/license');

const LICENSE_STORE_PATH = path.join(__dirname, 'electron', 'license.json');

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
  const currentMachineId = license.getMacAddress() || 'UNKNOWN';
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
ipcMain.handle('activate-license', async (event, key, payload = null, signature = null) => {
  try {
    if (!validateLicenseKey(key)) {
      return { success: false, error: 'Clé de licence invalide.' };
    }

    const machineId = license.getMacAddress() || 'UNKNOWN';
    const storedLicense = getStoredLicense();
    
    // Check if this is first activation (no stored license)
    const isFirstActivation = !storedLicense || !storedLicense.machine_id;
    
    // Prepare license data for offline activation
    const licenseData = {
      license_key: key,
      payload: payload || (storedLicense && storedLicense.payload),
      signature: signature || (storedLicense && storedLicense.signature),
      machine_id: machineId
    };

    // OFFLINE-ONLY activation
    const result = await license.activateLicense(key, machineId, licenseData, isFirstActivation);

    if (result.success) {
      // Save license with machine binding
      const licenseToSave = {
        key: key,
        machine_id: machineId, // LOCKED to this machine
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

// Call checkLicense before anything else
try {
  checkLicense();
} catch (err) {
  console.error('❌ License error:', err.message);
}

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

  // ============= AUTO-UPDATER =============
  // configure logger
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true; // automatically download updates when found

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    if (mainWindow) mainWindow.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available: ' + info.version);
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No updates available');
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded: ' + info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
      const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Restart and install', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update ready',
        message: `Version ${info.version} has been downloaded. Restart to install?`
      });
      if (result === 0) {
        autoUpdater.quitAndInstall();
      }
    }
  });

  // Check for updates shortly after startup then periodically
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 6 * 60 * 60 * 1000); // every 6 hours

  // IPC channel to trigger an update check from renderer
  ipcMain.handle('app:check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:install-update', async () => {
    try {
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
ipcMain.on('print-receipt', (event, receiptData) => {
  // Receipt printing logic will be implemented here
  console.log('Print receipt:', receiptData);
  event.reply('print-result', { success: true });
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
let dbServerModule = null;
let dbHttpServer = null;

ipcMain.handle('start-database-server', async () => {
  try {
    if (dbHttpServer) {
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
    process.env.DB_FILE_PATH = dbFilePath;
    process.env.PORT = '3001';
    process.env.NODE_ENV = isDev ? 'development' : 'production';

    // ✅ IMPORTANT: Load ES module using dynamic import
    try {
      console.log('[DB Server] Loading server module from:', serverModulePath);
      
      // Use dynamic import for ES modules
      dbServerModule = await import(`file://${serverModulePath}`);
      
      // Get the server instance
      dbHttpServer = dbServerModule.server || dbServerModule.default;

      if (!dbHttpServer) {
        throw new Error('Server module did not export a server instance');
      }

      console.log('[DB Server] Server started successfully on port 3001');
      
      return { 
        success: true, 
        message: 'Database server started successfully'
      };

    } catch (requireError) {
      console.error('[DB Server] Failed to load server module:', requireError);
      return { 
        success: false, 
        error: `Failed to load server: ${requireError.message}` 
      };
    }

  } catch (error) {
    console.error('[DB Server] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-database-server', async () => {
  try {
    if (dbHttpServer) {
      return new Promise((resolve) => {
        dbHttpServer.close(() => {
          dbHttpServer = null;
          dbServerModule = null;
          console.log('[DB Server] Server stopped successfully');
          resolve({ success: true, message: 'Database server stopped' });
        });
      });
    }
    return { success: true, message: 'Server was not running' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-database-server-status', async () => {
  return {
    running: dbHttpServer !== null
  };
});

// Clean up server on app quit
app.on('before-quit', () => {
  if (dbHttpServer) {
    dbHttpServer.close();
    dbHttpServer = null;
    dbServerModule = null;
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
    throw error;
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

