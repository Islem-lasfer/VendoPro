// electron-auto-updater.js
// Auto-update handler using electron-updater for GitHub releases
const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

class AutoUpdater {
  constructor() {
    this.updateCheckInterval = null;
    this.mainWindow = null;
    this.lastCheckSource = null; // 'manual' | 'periodic' | null

    // Configure auto-updater
    this.configure();
    this.setupEventHandlers();
  }

  configure() {
    // GitHub repository configuration
    // Format: owner/repo (e.g., 'yourname/vendopro')
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Islem-lasfer', // Replace with your GitHub username
      repo: 'VendoPro',        // Replace with your repository name
      private: true                   // Set to true for private repos, false for public repos
    });

    // 🔄 SILENT AUTO-UPDATE CONFIGURATION (No user prompts)
    autoUpdater.autoDownload = true;  // ✅ Automatically download updates
    autoUpdater.autoInstallOnAppQuit = true; // ✅ Automatically install when app closes
    
    // Allow downgrade (useful for testing)
    autoUpdater.allowDowngrade = false;
    
    // Check for pre-release versions (set to false for production)
    autoUpdater.allowPrerelease = false;
  }

  setupEventHandlers() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.sendStatusToWindow('update-available', info);
      
      // 🔄 SILENT UPDATE: Automatically download without asking user
      log.info('Automatically downloading update...');
      // No prompt - download starts automatically because autoDownload = true
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      // include the source (manual vs periodic) so renderer can decide whether to show a persistent notification
      this.sendStatusToWindow('update-not-available', { info, source: this.lastCheckSource });
    });

    // Update error
    autoUpdater.on('error', (err) => {
      log.error('Update error:', err);
      this.sendStatusToWindow('update-error', { error: err, source: this.lastCheckSource });
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
      logMessage += ` - Downloaded ${progressObj.percent}%`;
      logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
      log.info(logMessage);
      
      this.sendStatusToWindow('download-progress', progressObj);
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.sendStatusToWindow('update-downloaded', info);
      
      // 🔄 SILENT UPDATE: Will install automatically when user closes the app
      // No prompt needed - autoInstallOnAppQuit = true handles this
      log.info('Update will be installed automatically when you close the app');
    });
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  sendStatusToWindow(event, data) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', { event, data });
    }
  }

  async promptUserToDownload(info) {
    // Do not show native dialogs here. forward to renderer UI so the app can present a non-modal prompt.
    this.sendStatusToWindow('prompt-download', { info, source: this.lastCheckSource });
  }

  async promptUserToInstall(info) {
    // Forward install prompt to renderer UI (avoid native modal dialog)
    this.sendStatusToWindow('prompt-install', { info, source: this.lastCheckSource });
  }

  // Check for updates manually
  checkForUpdates() {
    log.info('Checking for updates...');
    autoUpdater.checkForUpdates();
  }

  // Check for updates silently (no user prompt if no updates)
  async checkForUpdatesQuietly() {
    try {
      this.lastCheckSource = 'periodic';
      const result = await autoUpdater.checkForUpdates();
      // reset source after the check
      this.lastCheckSource = null;
      return result;
    } catch (error) {
      log.error('Error checking for updates:', error);
      this.lastCheckSource = null;
      return null;
    }
  }

  // Start automatic update checks (every 4 hours)
  startPeriodicChecks(intervalHours = 4) {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    // Check immediately on start
    setTimeout(() => this.checkForUpdatesQuietly(), 10000); // Wait 10s after launch

    // Then check periodically
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdatesQuietly();
    }, intervalHours * 60 * 60 * 1000);

    log.info(`Automatic update checks started (every ${intervalHours} hours)`);
  }

  // Stop automatic update checks
  stopPeriodicChecks() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      log.info('Automatic update checks stopped');
    }
  }

  // Manual check with user notification
  async manualCheckForUpdates() {
    // Mark and notify that a manual check started
    this.lastCheckSource = 'manual';
    this.sendStatusToWindow('checking', { source: 'manual' });

    if (!this.mainWindow) {
      this.lastCheckSource = null;
      return;
    }

    try {
      // rely on autoUpdater events to notify result (update-available / update-not-available / error)
      await autoUpdater.checkForUpdates();
    } catch (error) {
      // forward error to renderer (avoid native dialogs)
      this.sendStatusToWindow('update-error', { error, source: 'manual' });
    } finally {
      this.lastCheckSource = null;
    }
  }
}

module.exports = new AutoUpdater();
