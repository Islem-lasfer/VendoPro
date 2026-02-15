// UpdateNotification.jsx
// React component to handle update notifications in your renderer process
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './UpdateNotification.css';

const { ipcRenderer } = window.require('electron');

const UpdateNotification = () => {
  const { t } = useTranslation();
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [lastEvent, setLastEvent] = useState({ name: null, time: 0 });
  const HIDE_TIMEOUT_MS = 2500; // auto-hide short, non-critical notifications

  useEffect(() => {
    // Listen for update status from main process
    const handleUpdateStatus = (event, { event: updateEvent, data }) => {
      const now = Date.now();
      // simple dedupe: ignore same event repeated within short window
      if (updateEvent === lastEvent.name && now - lastEvent.time < 1000) return;
      setLastEvent({ name: updateEvent, time: now });

      console.log('Update event:', updateEvent, data);

      switch (updateEvent) {
        case 'checking':
          // show only for manual checks (renderer will pass source='manual')
          if (data && data.source === 'manual') {
            setUpdateStatus('checking');
            setShowNotification(true);
            // auto-hide if nothing follows
            setTimeout(() => setShowNotification(false), HIDE_TIMEOUT_MS);
          }
          break;

        case 'update-available':
          setUpdateStatus('available');
          setUpdateInfo(data);
          setShowNotification(true);
          break;

        case 'update-not-available':
          // ignore periodic "no update" to avoid spamming users; show only when manual
          if (data && data.source === 'periodic') {
            // do a short non-intrusive toast instead (no persistent card)
            return;
          }
          setUpdateStatus('not-available');
          setShowNotification(true);
          // auto-dismiss after short delay
          setTimeout(() => setShowNotification(false), HIDE_TIMEOUT_MS);
          break;

        case 'download-started':
          setUpdateStatus('downloading');
          setUpdateInfo(data);
          setShowNotification(true);
          break;

        case 'download-progress':
          setUpdateStatus('downloading');
          setDownloadProgress(data.percent);
          setShowNotification(true);
          break;

        case 'update-downloaded':
          setUpdateStatus('ready');
          setUpdateInfo(data);
          setShowNotification(true);
          break;

        case 'update-error':
          setUpdateStatus('error');
          setShowNotification(true);
          // auto-hide after a slightly longer delay
          setTimeout(() => setShowNotification(false), 4000);
          break;

        case 'update-postponed':
          setShowNotification(false);
          break;

        case 'prompt-download':
          // forward to same UI as 'available'
          setUpdateStatus('available');
          setUpdateInfo(data && data.info);
          setShowNotification(true);
          break;

        case 'prompt-install':
          setUpdateStatus('ready');
          setUpdateInfo(data && data.info);
          setShowNotification(true);
          break;

        default:
          break;
      }
    };

    ipcRenderer.on('update-status', handleUpdateStatus);

    return () => {
      ipcRenderer.removeListener('update-status', handleUpdateStatus);
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking');
    setShowNotification(true);
    await ipcRenderer.invoke('check-for-updates');
  };

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading');
    await ipcRenderer.invoke('download-update');
  };

  const handleInstallUpdate = async () => {
    await ipcRenderer.invoke('install-update');
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div className="update-notification">
      {updateStatus === 'checking' && (
        <div className="update-card checking">
          <div className="update-icon">🔄</div>
          <div className="update-content">
            <h3>{t('update.checkingTitle')}</h3>
            <p>{t('update.checkingDetail')}</p>
          </div>
        </div>
      )}

      {updateStatus === 'available' && (
        <div className="update-card available">
          <div className="update-icon">⬆️</div>
          <div className="update-content">
            <h3>{t('update.availableTitle')}</h3>
            <p>{t('update.availableDetail', { version: updateInfo?.version })}</p>
            <p className="release-notes">{updateInfo?.releaseNotes}</p>
          </div>
          <div className="update-actions">
            <button onClick={handleDownloadUpdate} className="btn-primary">
              {t('update.downloadUpdate')}
            </button>
            <button onClick={handleDismiss} className="btn-secondary">
              {t('update.later')}
            </button>
          </div>
        </div>
      )}

      {updateStatus === 'downloading' && (
        <div className="update-card downloading">
          <div className="update-icon">⬇️</div>
          <div className="update-content">
            <h3>{t('update.downloadingTitle')}</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p>{t('update.downloadingPercent', { percent: Math.round(downloadProgress) })}</p>
          </div>
        </div>
      )}

      {updateStatus === 'ready' && (
        <div className="update-card ready">
          <div className="update-icon">✅</div>
          <div className="update-content">
            <h3>{t('update.readyTitle')}</h3>
            <p>{t('update.readyDetail', { version: updateInfo?.version })}</p>
            <p>{t('update.restartPrompt')}</p>
          </div>
          <div className="update-actions">
            <button onClick={handleInstallUpdate} className="btn-primary">
              {t('update.restartNow')}
            </button>
            <button onClick={handleDismiss} className="btn-secondary">
              {t('update.later')}
            </button>
          </div>
        </div>
      )}

      {updateStatus === 'error' && (
        <div className="update-card error">
          <div className="update-icon">❌</div>
          <div className="update-content">
            <h3>{t('update.errorTitle')}</h3>
            <p>{t('update.errorDetail')}</p>
          </div>
          <div className="update-actions">
            <button onClick={handleDismiss} className="btn-secondary">
              {t('update.dismiss')}
            </button>
          </div>
        </div>
      )}

      {updateStatus === 'not-available' && (
        <div className="update-card not-available">
          <div className="update-icon">✅</div>
          <div className="update-content">
            <h3>{t('update.upToDateTitle')}</h3>
            <p>{t('update.upToDateDetail')}</p>
          </div>
          <div className="update-actions">
            <button onClick={handleDismiss} className="btn-secondary">
              {t('update.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateNotification;
