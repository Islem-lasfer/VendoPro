// SettingsPage.jsx
// Example settings page with update check functionality
import React, { useState } from 'react';
import './SettingsPage.css';

const { ipcRenderer } = window.require('electron');

const SettingsPage = () => {
  const [currentVersion, setCurrentVersion] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useState(() => {
    // Get current app version
    ipcRenderer.invoke('get-app-version').then(version => {
      setCurrentVersion(version);
    });
  }, []);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      await ipcRenderer.invoke('check-for-updates');
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setTimeout(() => setIsCheckingUpdate(false), 2000);
    }
  };

  return (
    <div className="settings-page">
      <h1>⚙️ Settings</h1>
      
      <div className="settings-section">
        <h2>About</h2>
        <div className="settings-card">
          <div className="setting-item">
            <div className="setting-label">
              <span className="setting-icon">📦</span>
              Application Version
            </div>
            <div className="setting-value">
              <code>{currentVersion}</code>
            </div>
          </div>
          
          <div className="setting-item">
            <div className="setting-label">
              <span className="setting-icon">🔄</span>
              Software Updates
            </div>
            <div className="setting-value">
              <button 
                className="btn-check-update"
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdate}
              >
                {isCheckingUpdate ? (
                  <>
                    <span className="spinner"></span>
                    Checking...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Check for Updates
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="setting-info">
            <p>
              <strong>Auto-updates enabled:</strong> The application will automatically 
              check for updates every 4 hours. You'll be notified when an update is available.
            </p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>System Information</h2>
        <div className="settings-card">
          <div className="setting-item">
            <div className="setting-label">
              <span className="setting-icon">💻</span>
              Platform
            </div>
            <div className="setting-value">
              {process.platform === 'win32' ? 'Windows' : 
               process.platform === 'darwin' ? 'macOS' : 
               'Linux'}
            </div>
          </div>
          
          <div className="setting-item">
            <div className="setting-label">
              <span className="setting-icon">🏗️</span>
              Architecture
            </div>
            <div className="setting-value">
              {process.arch}
            </div>
          </div>
          
          <div className="setting-item">
            <div className="setting-label">
              <span className="setting-icon">⚡</span>
              Node Version
            </div>
            <div className="setting-value">
              {process.versions.node}
            </div>
          </div>
          
          <div className="setting-item">
            <div className="setting-label">
              <span className="setting-icon">🖥️</span>
              Electron Version
            </div>
            <div className="setting-value">
              {process.versions.electron}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>License Information</h2>
        <div className="settings-card">
          <div className="setting-info">
            <p>
              © 2024 VendoPro. All rights reserved.
            </p>
            <p>
              Licensed under the MIT License.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
