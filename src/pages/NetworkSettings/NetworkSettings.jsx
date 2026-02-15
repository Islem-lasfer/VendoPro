import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import syncManager from '../../utils/syncManager';
import QRCode from 'qrcode';
import './NetworkSettings.css';
import dbAPI from '../../utils/dbAPI';
import realtimeSync from '../../utils/realtimeSync';
import { notify } from '../../utils/notifications';

function NetworkSettings() {
  const { t } = useTranslation();
  const qrCanvasRef = useRef(null);
  const [serverURL, setServerURL] = useState('http://localhost:3001');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [serverHealth, setServerHealth] = useState(null);
  const [isLocalMode, setIsLocalMode] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isServer, setIsServer] = useState(false);
  const [localIP, setLocalIP] = useState('');
  const [hostname, setHostname] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrCodeData, setQRCodeData] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [serverRunning, setServerRunning] = useState(false);
  const [startingServer, setStartingServer] = useState(false);
  // Track if the user manually edited the server URL to avoid overwriting with auto-detected IP
  const [hasEditedServerURL, setHasEditedServerURL] = useState(false);

  useEffect(() => {
    // Check if database server is running
    checkServerStatus();
  }, []);

  useEffect(() => {
    // Charger la configuration depuis localStorage
    const savedURL = localStorage.getItem('db_server_url');
    const savedMode = localStorage.getItem('db_mode');
    const savedSync = localStorage.getItem('realtime_sync');
    const savedIsServer = localStorage.getItem('is_server');
    
    if (savedURL) {
      // If client mode but URL is localhost, clear it to force user to enter proper server address
      if (savedMode === 'network' && savedIsServer === 'false' && savedURL === 'http://localhost:3001') {
        setServerURL('');
      } else {
        setServerURL(savedURL);
      }
    }
    if (savedMode) setIsLocalMode(savedMode === 'local');
    if (savedSync) setSyncEnabled(savedSync === 'true');
    if (savedIsServer) setIsServer(savedIsServer === 'true');

    // Détecter l'adresse IP locale
    detectLocalIP();
    detectHostname();

    // Vérifier la connexion si en mode réseau ET URL configurée
    // Only check if server URL is properly configured (not default localhost)
    // Also check if this machine is the server (may use localhost URL)
    if ((savedMode === 'network' && savedURL && savedURL !== 'http://localhost:3001') || (savedIsServer === 'true')) {
      // Delay check slightly to avoid immediate errors on page load
      setTimeout(() => {
        checkConnection();
      }, 1000);
    }

    // Écouter les événements de connexion
    realtimeSync.on('connected', () => setConnectionStatus('connected'));
    realtimeSync.on('disconnected', () => setConnectionStatus('disconnected'));
    realtimeSync.on('connection-failed', () => setConnectionStatus('failed'));

    return () => {
      realtimeSync.off('connected');
      realtimeSync.off('disconnected');
      realtimeSync.off('connection-failed');
    };
  }, []);

  // If this machine is configured as the server and the server process is running,
  // force the app into network mode and start realtime synchronization so the
  // client uses the server database immediately (avoids dual active DB files).
  useEffect(() => {
    if (isServer && serverRunning) {
      // Force network mode and enable sync
      if (isLocalMode) {
        setIsLocalMode(false);
        localStorage.setItem('db_mode', 'network');
      }
      if (!syncEnabled) {
        setSyncEnabled(true);
        localStorage.setItem('realtime_sync', 'true');
      }

      // Ensure serverURL is set to localhost if empty
      const url = serverURL && serverURL.trim() !== '' ? serverURL : 'http://localhost:3001';
      if (!serverURL || serverURL.trim() === '') {
        setServerURL(url);
        localStorage.setItem('db_server_url', url);
      }

      dbAPI.setServerURL(url);
      realtimeSync.connect(url);
      try { syncManager.startSync(url); } catch (e) { console.warn('Failed to auto-start sync on server machine', e); }
      setConnectionStatus('connected');
    }
  }, [isServer, serverRunning]);

  // If the local IP becomes available and this machine is set as server,
  // autofill the serverURL ONLY if the user hasn't already manually edited it.
  useEffect(() => {
    if (isServer && localIP && localIP !== 'Non détectée' && !hasEditedServerURL) {
      setServerURL(`http://${localIP}:3001`);
    }
  }, [localIP, isServer, hasEditedServerURL]);

  const detectLocalIP = async () => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const ipMatch = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/.exec(ice.candidate.candidate);
        if (ipMatch) {
          setLocalIP(ipMatch[1]);
          pc.close();
        }
      };
    } catch (error) {
      console.error('Erreur détection IP:', error);
      setLocalIP('Non détectée');
    }
  };

  const detectHostname = () => {
    try {
      const name = window.location.hostname || 'localhost';
      setHostname(name);
    } catch (error) {
      console.error('Erreur détection hostname:', error);
      setHostname('localhost');
    }
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    
    try {
      const health = await dbAPI.checkHealth();
      setServerHealth(health);
      
      if (health.status === 'OK') {
        setConnectionStatus('connected');
        // Activer automatiquement la synchronisation si connexion réussie
        if (!isLocalMode) {
          setSyncEnabled(true);
        }
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      // Serveur non accessible - état déconnecté (silencieux)
      setConnectionStatus('disconnected');
      setServerHealth({ 
        status: 'DISCONNECTED', 
        message: t('network.serverNotReachable') || 'Serveur non accessible. Assurez-vous qu\'il est démarré.'
      });
    }
  };

  const isElectron = () => {
    // Check if running in Electron environment
    return typeof window !== 'undefined' && 
           typeof window.require !== 'undefined';
  };

  const checkServerStatus = async () => {
    if (!isElectron()) return;
    
    try {
      const { ipcRenderer } = window.require('electron');
      const status = await ipcRenderer.invoke('get-database-server-status');
      setServerRunning(status.running);
    } catch (error) {
      console.error('Error checking server status:', error);
    }
  };

  const startDatabaseServer = async () => {
    if (!isElectron()) {
      console.log('Not running in Electron - server auto-start not available');
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('show-message-box', {
          type: 'warning',
          buttons: ['OK'],
          title: 'Warning',
          message: 'Server auto-start only works in the desktop app.\n\nPlease run START_DATABASE_SERVER.bat manually, or use the desktop app (npm start).'
        });
      } else {
        notify('⚠️ Server auto-start only works in the desktop app.\n\nPlease run START_DATABASE_SERVER.bat manually, or use the desktop app (npm start).', 'warning');
      }
      return false;
    }

    setStartingServer(true);
    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('start-database-server');
      
      if (result.success) {
        setServerRunning(true);
        // If this machine is server, force network mode and enable sync immediately
        setIsLocalMode(false);
        localStorage.setItem('db_mode', 'network');
        setSyncEnabled(true);
        localStorage.setItem('realtime_sync', 'true');
        if (!serverURL || serverURL.trim() === '') {
          setServerURL('http://localhost:3001');
          localStorage.setItem('db_server_url', 'http://localhost:3001');
        }
        dbAPI.setServerURL(serverURL || 'http://localhost:3001');
        realtimeSync.connect(serverURL || 'http://localhost:3001');
        try { syncManager.startSync(serverURL || 'http://localhost:3001'); } catch(e) { console.warn('Failed to start sync after starting server', e); }
        if (window.electron?.ipcRenderer) {
          await window.electron.ipcRenderer.invoke('show-message-box', {
            type: 'info',
            buttons: ['OK'],
            title: t('common.success') || 'Success',
            message: t('network.serverStarted') || 'Database server started successfully!'
          });
        } else {
          notify('✅ ' + (t('network.serverStarted') || 'Database server started successfully!'), 'success');
        }
        
        // Wait a moment for server to be ready, then test connection
        setTimeout(() => {
          checkConnection();
        }, 1500);
        
        return true;
      } else {
        if (result.needsInstall) {
          if (window.electron?.ipcRenderer) {
            await window.electron.ipcRenderer.invoke('show-message-box', {
              type: 'warning',
              buttons: ['OK'],
              title: 'Warning',
              message: t('network.needsInstall') || 'Server dependencies not installed.\n\nPlease double-click START_DATABASE_SERVER.bat first to install dependencies.'
            });
          } else {
            notify('⚠️ ' + (t('network.needsInstall') || 'Server dependencies not installed.\n\nPlease double-click START_DATABASE_SERVER.bat first to install dependencies.'), 'warning');
          }
        } else {
          if (window.electron?.ipcRenderer) {
            await window.electron.ipcRenderer.invoke('show-message-box', {
              type: 'error',
              buttons: ['OK'],
              title: 'Error',
              message: (t('network.serverStartFailed') || 'Failed to start server') + ':\n' + result.error
            });
          } else {
            notify('❌ ' + (t('network.serverStartFailed') || 'Failed to start server') + ':\n' + result.error, 'error');
          }
        }
        return false;
      }
    } catch (error) {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('show-message-box', {
          type: 'error',
          buttons: ['OK'],
          title: 'Error',
          message: error.message
        });
      } else {
        notify('❌ Error: ' + error.message, 'error');
      }
      return false;
    } finally {
      setStartingServer(false);
    }
  };

  const stopDatabaseServer = async () => {
    if (!isElectron()) {
      return false;
    }

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('stop-database-server');
      
      if (result.success) {
        setServerRunning(false);
        setConnectionStatus('disconnected');
        if (window.electron?.ipcRenderer) {
          await window.electron.ipcRenderer.invoke('show-message-box', {
            type: 'info',
            buttons: ['OK'],
            title: t('common.success') || 'Success',
            message: t('network.serverStopped') || 'Database server stopped successfully!'
          });
        } else {
          notify('✅ ' + (t('network.serverStopped') || 'Database server stopped successfully!'), 'success');
        }
        return true;
      } else {
        if (window.electron?.ipcRenderer) {
          await window.electron.ipcRenderer.invoke('show-message-box', {
            type: 'error',
            buttons: ['OK'],
            title: 'Error',
            message: 'Failed to stop server: ' + result.error
          });
        } else {
          notify('❌ Failed to stop server: ' + result.error, 'error');
        }
        return false;
      }
    } catch (error) {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('show-message-box', {
          type: 'error',
          buttons: ['OK'],
          title: 'Error',
          message: error.message
        });
      } else {
        notify('❌ Error: ' + error.message, 'error');
      }
      return false;
    }
  };

  const handleSaveSettings = async () => {
    // Validation
    if (!isLocalMode && !isServer && (!serverURL || serverURL.trim() === '')) {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('show-message-box', {
          type: 'warning',
          buttons: ['OK'],
          title: 'Configuration requise',
          message: 'Veuillez entrer l\'adresse du serveur pour le mode client.'
        });
      } else {
        notify('⚠️ Veuillez entrer l\'adresse du serveur pour le mode client.', 'warning');
      }
      return;
    }

    // Validate and save configuration
    const setOk = dbAPI.setServerURL(serverURL);
    if (!setOk) {
      // Warn the user about invalid server URL (likely link-local/169.254)
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('show-message-box', {
          type: 'warning',
          buttons: ['OK'],
          title: t('network.invalidServer') || 'Invalid server address',
          message: t('network.invalidServerMessage') || 'The server address appears to be a link-local or invalid address. Please provide a valid server hostname or IP.'
        });
      } else {
        notify(t('network.invalidServerMessage') || 'The server address appears to be a link-local or invalid address. Please provide a valid server hostname or IP.', 'warning');
      }
      return;
    }

    // Sauvegarder la configuration
    localStorage.setItem('db_server_url', serverURL);
    localStorage.setItem('db_mode', isLocalMode ? 'local' : 'network');
    localStorage.setItem('realtime_sync', syncEnabled.toString());
    localStorage.setItem('is_server', isServer.toString());

    if (!isLocalMode) {
      // If this machine is set as server and server is not running, start it
      if (isServer && !serverRunning) {
        const started = await startDatabaseServer();
        if (!started) {
          return; // Don't proceed if server failed to start
        }
      }
      
      // Mode réseau - tester la connexion
      checkConnection();
      
      if (syncEnabled) {
        // Activer la synchronisation temps réel
        realtimeSync.connect(serverURL);
        // Start full sync (process queued ops and import snapshot)
        try { syncManager.startSync(serverURL); } catch(e) { console.warn('Failed to start sync manager', e); }
      } else {
        realtimeSync.disconnect();
        try { syncManager.stopSync(); } catch(e) { console.warn('Failed to stop sync manager', e); }
      }
    } else {
      // Mode local - déconnecter
      realtimeSync.disconnect();
      try { syncManager.stopSync(); } catch(e) { console.warn('Failed to stop sync manager', e); }
      setConnectionStatus('local');
    }

    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('show-message-box', {
        type: 'info',
        buttons: ['OK'],
        title: t('common.success') || 'Success',
        message: t('settings.saved') || 'Paramètres sauvegardés avec succès!'
      });
    } else {
      notify(t('settings.saved') || 'Paramètres sauvegardés avec succès!', 'success');
    }
  };

  const generateQRCode = () => {
    const config = {
      serverURL: serverURL,
      hostname: hostname,
      localIP: localIP,
      timestamp: new Date().toISOString()
    };
    const qrData = JSON.stringify(config);
    setQRCodeData(qrData);
    setShowQR(true);
    
    // Générer le QR code sur le canvas
    setTimeout(() => {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        }, (error) => {
          if (error) console.error('Erreur génération QR:', error);
        });
      }
    }, 100);
  };

  const importFromQR = () => {
    setShowImportModal(true);
  };

  const handleImportConfig = async () => {
    if (importText) {
      try {
        const config = JSON.parse(importText);
        if (config.serverURL) {
          setServerURL(config.serverURL);
          setShowImportModal(false);
          setImportText('');
          if (window.electron?.ipcRenderer) {
            await window.electron.ipcRenderer.invoke('show-message-box', {
              type: 'info',
              buttons: ['OK'],
              title: t('common.success') || 'Success',
              message: t('network.configImported') || 'Configuration importée avec succès!'
            });
          } else {
            notify(t('network.configImported') || 'Configuration importée avec succès!', 'success');
          }
        } else {
          if (window.electron?.ipcRenderer) {
            await window.electron.ipcRenderer.invoke('show-message-box', {
              type: 'error',
              buttons: ['OK'],
              title: 'Error',
              message: t('network.invalidQRData') || 'Données QR invalides!'
            });
          } else {
            notify(t('network.invalidQRData') || 'Données QR invalides!', 'error');
          }
        }
      } catch (error) {
        if (window.electron?.ipcRenderer) {
          await window.electron.ipcRenderer.invoke('show-message-box', {
            type: 'error',
            buttons: ['OK'],
            title: 'Error',
            message: t('network.invalidQRData') || 'Données QR invalides!'
          });
        } else {
          notify(t('network.invalidQRData') || 'Données QR invalides!', 'error');
        }
      }
    }
  };

  // Générateur de QR Code visuel
  const generateQRCanvas = (data) => {
    return (
      <div className="qr-display">
        <div className="qr-placeholder">
          <div className="qr-icon">📱</div>
          <p>{t('network.qrCodeTitle') || 'Configuration Serveur'}</p>
        </div>
        
        {/* Canvas pour le QR Code */}
        <div className="qr-canvas-container">
          <canvas ref={qrCanvasRef} />
        </div>
        
        {/* Données texte copiables */}
        <div className="qr-data">
          <small>{t('network.orCopyText') || 'Ou copiez le texte ci-dessous :'}</small>
          <textarea 
            readOnly 
            value={data}
            onClick={(e) => {
              e.target.select();
              navigator.clipboard.writeText(data);
              notify(t('network.copiedToClipboard') || 'Copié dans le presse-papiers!', 'success');
            }}
          />
          <small>{t('network.clickToCopy') || 'Cliquez pour copier'}</small>
        </div>
      </div>
    );
  };

  const handleTestConnection = () => {
    if (isLocalMode) {
      notify('Mode local actif - aucune connexion réseau nécessaire', 'info');
      return;
    }
    
    if (!serverURL || serverURL.trim() === '') {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('show-message-box', {
          type: 'warning',
          buttons: ['OK'],
          title: 'URL requise',
          message: 'Veuillez entrer l\'adresse du serveur avant de tester la connexion.'
        });
      } else {
        notify('⚠️ Veuillez entrer l\'adresse du serveur avant de tester la connexion.', 'warning');
      }
      return;
    }
    
    dbAPI.setServerURL(serverURL);
    checkConnection();
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'error':
      case 'failed':
        return '🔴';
      case 'checking':
        return '🟡';
      case 'local':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return t('network.connected') || 'Connecté au serveur';
      case 'error':
      case 'failed':
        return t('network.error') || 'Erreur de connexion';
      case 'checking':
        return t('network.checking') || 'Vérification...';
      case 'local':
        return t('network.local') || 'Mode local actif';
      default:
        return t('network.disconnected') || 'Non connecté';
    }
  };

  return (
    <div className="network-settings">
      <div className="network-settings-header">
        <h1>{t('network.title') || 'Configuration Réseau'}</h1>
        <p>{t('network.description') || 'Configurez la connexion à la base de données réseau pour le mode multi-postes'}</p>
      </div>

      <div className="network-settings-content">
        {/* Mode de fonctionnement */}
        <div className="settings-section">
          <h2>{t('network.mode') || 'Mode de fonctionnement'}</h2>
          
          <div className="mode-selector">
            <label className={`mode-option ${isLocalMode ? 'active' : ''}`}>
              <input
                type="radio"
                name="mode"
                checked={isLocalMode}
                onChange={() => {
                  setIsLocalMode(true);
                  setSyncEnabled(false); // Désactiver la synchronisation en mode local
                }}
              />
              <div className="mode-content">
                <div className="mode-icon">💻</div>
                <div className="mode-info">
                  <strong>{t('network.localMode') || 'Mode Local'}</strong>
                  <p>{t('network.localDescription') || 'Base de données SQLite locale (un seul poste)'}</p>
                </div>
              </div>
            </label>

            <label className={`mode-option ${!isLocalMode ? 'active' : ''}`}>
              <input
                type="radio"
                name="mode"
                checked={!isLocalMode}
                onChange={() => {
                  setIsLocalMode(false);
                  setSyncEnabled(true); // Auto-activer la synchronisation en mode réseau
                }}
              />
              <div className="mode-content">
                <div className="mode-icon">🌐</div>
                <div className="mode-info">
                  <strong>{t('network.networkMode') || 'Mode Réseau'}</strong>
                  <p>{t('network.networkDescription') || 'Base de données MySQL partagée (multi-postes)'}</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Sélection du rôle (Serveur ou Client) */}
        {!isLocalMode && (
          <>
            <div className="settings-section">
              <h2>🖥️ {t('network.role') || 'Rôle de cette machine'}</h2>
              
              <div className="mode-selector">
                <label className={`mode-option ${isServer ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    checked={isServer}
                    onChange={() => {
                      setIsServer(true);
                      // Only autofill with detected IP if the user hasn't manually edited the URL
                      if (localIP && localIP !== 'Non détectée' && !hasEditedServerURL) {
                        setServerURL(`http://${localIP}:3001`);
                      }
                    }}
                  />
                  <div className="mode-content">
                    <div className="mode-icon">🖥️</div>
                    <div className="mode-info">
                      <strong>{t('network.serverRole') || 'Serveur (Machine principale)'}</strong>
                      <p>{t('network.serverRoleDesc') || 'Cette machine héberge la base de données MySQL'}</p>
                      {localIP && localIP !== 'Non détectée' && (
                        <small style={{color: 'var(--primary-color)'}}>📍 IP: {localIP}</small>
                      )}
                      {isElectron() && isServer && (
                        <small style={{color: serverRunning ? '#4CAF50' : '#999', marginTop: '5px', display: 'block'}}>
                          {serverRunning ? '🟢 Server running' : '⚪ Server stopped'}
                        </small>
                      )}
                    </div>
                  </div>
                </label>

                <label className={`mode-option ${!isServer ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    checked={!isServer}
                    onChange={() => {
                      setIsServer(false);
                      // Clear server URL when switching to client mode to force user to enter server address
                      setServerURL('');
                    }}
                  />
                  <div className="mode-content">
                    <div className="mode-icon">💻</div>
                    <div className="mode-info">
                      <strong>{t('network.clientRole') || 'Client (Poste de travail)'}</strong>
                      <p>{t('network.clientRoleDesc') || 'Cette machine se connecte au serveur'}</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Boutons de configuration rapide pour serveur */}
            {isServer && (
              <div className="settings-section">
                <h2>⚡ {t('network.quickConfig') || 'Configuration rapide'}</h2>
                <div className="quick-config-buttons">
                  <button onClick={generateQRCode} className="btn-qr">
                    📱 {t('network.generateQR') || 'Générer config pour clients'}
                  </button>
                  <div className="config-info">
                    <p><strong>💡 {t('network.hostname') || 'Nom réseau'}:</strong> {hostname}</p>
                    <p><strong>📍 {t('network.ipAddress') || 'Adresse IP'}:</strong> {localIP}</p>
                    <small>⚠️ {t('network.staticIPWarning') || 'Recommandé: Configurez une IP statique sur votre routeur pour éviter les changements d\'adresse'}</small>
                  </div>
                </div>
              </div>
            )}

            {/* Bouton d'import pour clients */}
            {!isServer && (
              <div className="settings-section">
                <h2>📥 {t('network.importConfig') || 'Importer la configuration'}</h2>
                <div className="import-buttons">
                  <button onClick={importFromQR} className="btn-import">
                    📋 {t('network.pasteConfig') || 'Coller la configuration du serveur'}
                  </button>
                  <small>{t('network.importHelp') || 'Copiez la configuration depuis la machine serveur'}</small>
                </div>
                {!serverURL && (
                  <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px'}}>
                    <strong>⚠️ Configuration requise:</strong> Entrez l'adresse du serveur ci-dessous avant de sauvegarder.
                  </div>
                )}
              </div>
            )}

            {/* Modal QR Code */}
            {showQR && (
              <div className="qr-modal" onClick={() => setShowQR(false)}>
                <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="qr-close" onClick={() => setShowQR(false)}>✕</button>
                  {generateQRCanvas(qrCodeData)}
                </div>
              </div>
            )}

            {/* Modal Import Config */}
            {showImportModal && (
              <div className="qr-modal" onClick={() => setShowImportModal(false)}>
                <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="qr-close" onClick={() => setShowImportModal(false)}>✕</button>
                  <div className="import-modal">
                    <h3>📥 {t('network.pasteQRData') || 'Collez les données de configuration'}</h3>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder={t('network.pasteHere') || 'Collez la configuration copiée depuis le serveur...'}
                      className="import-textarea"
                    />
                    <div className="modal-buttons">
                      <button onClick={handleImportConfig} className="btn-confirm">
                        ✓ {t('network.import') || 'Importer'}
                      </button>
                      <button onClick={() => setShowImportModal(false)} className="btn-cancel">
                        ✕ {t('settings.cancel') || 'Annuler'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="settings-section">
              <h2>{t('network.serverConfig') || 'Configuration du serveur'}</h2>
              
              <div className="form-group">
                <label>{t('network.serverURL') || 'URL du serveur'}</label>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  <input
                    type="text"
                    value={serverURL}
                    onChange={(e) => { setServerURL(e.target.value); setHasEditedServerURL(true); }}
                    placeholder={isServer ? "http://localhost:3001" : "http://192.168.1.100:3001"}
                    className="network-input"
                    required={!isServer}
                    style={{flex: 1}}
                  />
                  {/* Button to let user quickly apply detected IP without forcing it on them */}
                  <button
                    type="button"
                    onClick={() => {
                      if (localIP && localIP !== 'Non détectée') {
                        setServerURL(`http://${localIP}:3001`);
                        setHasEditedServerURL(false);
                      }
                    }}
                    className="btn-test"
                    style={{padding: '8px 12px', height: '40px'}}
                  >
                    {t('network.useDetectedIP') || 'Use detected IP'}
                  </button>
                </div>
                <small>
                  {isServer 
                    ? t('network.serverUrlHelp', { defaultValue: 'URL locale du serveur (généralement http://localhost:3001)' })
                    : t('network.clientUrlHelp', { defaultValue: 'Adresse IP ou nom du serveur (ex: http://192.168.1.100:3001)' })
                  }
                </small>
              </div>

              <button onClick={handleTestConnection} className="btn-test" disabled={!serverURL || serverURL.trim() === ''}>
                {t('network.testConnection') || 'Tester la connexion'}
              </button>

              {/* Manual server start/stop buttons for server machines */}
              {isServer && isElectron() && (
                <div style={{display: 'inline-block', marginLeft: '10px'}}>
                  {!serverRunning ? (
                    <button 
                      onClick={startDatabaseServer} 
                      className="btn-test"
                      disabled={startingServer}
                      style={{backgroundColor: '#ff6b35'}}
                    >
                      {startingServer ? '⏳ Starting...' : '🚀 Start Server Now'}
                    </button>
                  ) : (
                    <button 
                      onClick={stopDatabaseServer} 
                      className="btn-test"
                      style={{backgroundColor: '#f44336'}}
                    >
                      🛑 Stop Server
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* État de la connexion */}
            <div className="settings-section">
              <h2>{t('network.connectionStatus') || 'État de la connexion'}</h2>
              
              <div className="connection-status">
                <div className="status-indicator">
                  <span className="status-icon">{getStatusIcon()}</span>
                  <span className="status-text">{getStatusText()}</span>
                </div>

                {serverHealth && (
                  <div className="server-info">
                    <p><strong>Status:</strong> {serverHealth.status}</p>
                    <p><strong>Message:</strong> {serverHealth.message}</p>
                    {serverHealth.timestamp && (
                      <p><strong>Timestamp:</strong> {new Date(serverHealth.timestamp).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Synchronisation en temps réel */}
            <div className="settings-section">
              <h2>{t('network.realtimeSync') || 'Synchronisation en temps réel'}</h2>
              
              <label className="sync-toggle">
                <input
                  type="checkbox"
                  checked={syncEnabled}
                  onChange={(e) => setSyncEnabled(e.target.checked)}
                />
                <span>{t('network.enableSync') || 'Activer la synchronisation en temps réel (WebSocket)'}</span>
              </label>
              
              <p className="sync-description">
                {t('network.syncDescription') || 
                 'La synchronisation en temps réel permet de voir instantanément les modifications effectuées sur d\'autres postes (ajout/modification de produits, ventes, etc.)'}
              </p>
            </div>
          </>
        )}

        {/* Bouton de sauvegarde */}
        <div className="settings-actions">
          <button 
            onClick={handleSaveSettings} 
            className="btn-save"
            disabled={startingServer}
          >
            {startingServer 
              ? (t('network.startingServer') || 'Starting server...') 
              : (t('settings.save') || 'Enregistrer les paramètres')
            }
          </button>
        </div>

        {/* Informations supplémentaires */}
        <div className="settings-section info-section">
          <h2>ℹ️ {t('network.info') || 'Informations importantes'}</h2>
          <ul>
            <li>{t('network.info1') || 'En mode réseau, toutes les machines doivent pointer vers le même serveur'}</li>
            <li>{t('network.info2') || 'Assurez-vous que le serveur de base de données est démarré avant de passer en mode réseau'}</li>
            <li>{t('network.info3') || 'Le serveur doit être accessible depuis toutes les machines du réseau (WiFi ou câble)'}</li>
            <li>{t('network.info4') || 'La synchronisation temps réel nécessite une connexion stable'}</li>
            <li>{t('network.info5') || 'Consultez la documentation pour les instructions d\'installation du serveur'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default NetworkSettings;
