import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './License.css';
import licenseUtil from '../../utils/license';

const License = ({ onActivated, onClose, forceOpen = false }) => {
  const { t } = useTranslation();
  const [licenseKey, setLicenseKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);
  const [expiresIn, setExpiresIn] = useState(null);
  const [showFileImport, setShowFileImport] = useState(false);
  const [visible, setVisible] = useState(true);
  const [diskId, setDiskId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmailField, setClientEmailField] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const navigate = useNavigate();

  useEffect(() => {
    function online() { setIsOnline(true); }
    function offline() { setIsOnline(false); }
    window.addEventListener && window.addEventListener('online', online);
    window.addEventListener && window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener && window.removeEventListener('online', online);
      window.removeEventListener && window.removeEventListener('offline', offline);
    };
  }, []);

  const handleClose = () => {
    // If parent provided an onClose handler, prefer that (allows parent to control app flow)
    if (onClose) {
      onClose();
      return;
    }

    // Try to close via Electron IPC. Send both confirm-close and close-app to cover different handlers.
    try {
      let sent = false;
      if (window && window.require) {
        const { ipcRenderer } = window.require('electron');
        try { ipcRenderer.send('confirm-close'); sent = true; } catch (e) { /* ignore */ }
        try { ipcRenderer.send('close-app'); sent = true; } catch (e) { /* ignore */ }
      } else if (window.electron && window.electron.ipcRenderer) {
        try { window.electron.ipcRenderer.send('confirm-close'); sent = true; } catch (e) { /* ignore */ }
        try { window.electron.ipcRenderer.send('close-app'); sent = true; } catch (e) { /* ignore */ }
      }

      if (sent) {
        setStatus('🔒 Closing application...');
        // Hide modal while app quits (if it does)
        setVisible(false);
        // In case IPC doesn't do the job, fallback to window.close after short delay
        setTimeout(() => {
          try { window.close(); } catch (err) { /* ignore */ }
        }, 700);
        return;
      }
    } catch (err) {
      console.warn('Close IPC failed:', err.message);
    }

    // Non-Electron fallback: hide the modal and try window.close()
    setVisible(false);
    try { window.close(); } catch (err) { /* ignore */ }
  };

  useEffect(() => {
    // Check if license is already activated (offline) and bound to this machine
    const check = async () => {
      const machineId = licenseUtil.getMachineId();
      const theDiskId = licenseUtil.getDiskId ? licenseUtil.getDiskId() : machineId;
      setDiskId(theDiskId);
      const activation = await licenseUtil.loadActivation(machineId);
      if (
        activation &&
        activation.license_key &&
        activation.machine_id === machineId &&
        activation.expiry &&
        new Date(activation.expiry) > new Date()
      ) {
        setActivated(true);
        setExpiresIn(Math.ceil((new Date(activation.expiry) - new Date()) / (1000 * 60 * 60 * 24)));
      }
    };
    check();
  }, []);

  const handleActivate = async () => {
    setStatus('');
    setLoading(true);
    
    try {
      const key = licenseKey.toUpperCase();
      
      // Validate key format
      if (key.replace(/-/g, '').length < 20) {
        throw new Error('Clé de licence incomplète.');
      }

      // OFFLINE-ONLY activation - No online support
      setStatus('⚠️ This system uses OFFLINE-ONLY licenses. Please use the "📄 Use license file" button below to import your .lic file.');
      throw new Error('This system requires a license file (.lic) for activation. Please click "📄 Use license file" below.');
      
    } catch (e) {
      console.error('Activation error:', e);
      setStatus(e.message || 'Erreur d\'activation');
    }
    
    setLoading(false);
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setStatus('');
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const licenseData = JSON.parse(e.target.result);
          
          // Validate license file
          if (!licenseData.license_key || !licenseData.payload || !licenseData.signature) {
            throw new Error('Invalid license file (missing data)');
          }

          setStatus('📄 License file loaded, verifying offline...');

          // Pre-check machine/disk binding if present in file
          let fileMachineId = licenseData.machine_id;
          try {
            if (!fileMachineId && licenseData.payload) {
              const decoded = JSON.parse(Buffer.from(licenseData.payload, 'base64').toString('utf8'));
              if (decoded && decoded.machine_id) fileMachineId = decoded.machine_id;
            }
          } catch (err) {
            // ignore decoding errors
          }

          const currentDiskId = licenseUtil.getDiskId ? licenseUtil.getDiskId() : licenseUtil.getMachineId();
          const normalizedCurrent = licenseUtil.normalizeId ? licenseUtil.normalizeId(currentDiskId) : (currentDiskId ? currentDiskId.toString().replace(/[^A-Z0-9]/gi,'').toUpperCase() : '');
          const normalizedFileId = licenseUtil.normalizeId ? licenseUtil.normalizeId(fileMachineId) : (fileMachineId ? fileMachineId.toString().replace(/[^A-Z0-9]/gi,'').toUpperCase() : null);

          if (normalizedFileId && normalizedFileId !== normalizedCurrent) {
            // Do not reveal the file's bound ID to the UI. Show only current machine id.
            throw new Error('License file is bound to another machine. This machine is ' + normalizedCurrent + '.');
          }

          // Use Electron IPC for OFFLINE-ONLY activation
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            const currentDisk = licenseUtil.getDiskId ? licenseUtil.getDiskId() : licenseUtil.getMachineId();
            const result = await ipcRenderer.invoke(
              'activate-license',
              licenseData.license_key,
              licenseData.payload,
              licenseData.signature,
              currentDisk
            );

            if (result.success) {
              // Store activation locally
              const activation = {
                license_key: licenseData.license_key,
                machine_id: licenseUtil.getMachineId(),
                expiry: new Date(licenseData.expire_at),
                payload: licenseData.payload,
                signature: licenseData.signature,
                last_run: new Date()
              };
              
              activation.trial = false;
              licenseUtil.storeActivation(activation);
              // Notify other UI (Settings) that license changed
              try { window.dispatchEvent(new CustomEvent('license-updated', { detail: activation })); } catch (e) {}
              
              setStatus('✅ Offline activation successful! License bound to this machine.');
              setActivated(true);
              
              if (licenseData.expire_at) {
                const expiryDate = new Date(licenseData.expire_at);
                const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                setExpiresIn(daysLeft);
                
                if (expiryDate > new Date('2099-01-01')) {
                  setStatus(t('settings.unlimitedActivated'));
                }
              }
              
              if (onActivated) onActivated();
            } else {
              throw new Error(result.error || 'Activation failed - License may be bound to another machine');
            }
          }
        } catch (parseError) {
          setStatus('❌ Error: ' + parseError.message);
        }
        setLoading(false);
      };
      
      reader.readAsText(file);
    } catch (error) {
      setStatus('❌ File read error: ' + error.message);
      setLoading(false);
    }
  };



  // If user closed the modal, do not render. Allow forced open from Settings even when `activated`.
  if (!visible) return null;
  if (activated && !forceOpen) return null;

  return (
    <div className="license-modal">
      <button className="close-btn" aria-label="Close license modal" onClick={handleClose}>×</button>
      <h2>🔐 Offline License Activation</h2>
      <div style={{ textAlign: 'center', marginBottom: '12px', color: '#555', fontSize: '0.95rem' }}>
        💡 Send the code below to your deployer so they can generate a machine-bound .lic file.
      </div>
      <div style={{ marginBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#333', marginBottom: 8, fontWeight: 700 }}>Disk ID</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: '10px 18px', background: '#f7f7f7', borderRadius: 8, fontWeight: 700, color: '#111', fontFamily: 'monospace', fontSize: '0.96rem' }} title="Copy this code and send to deployer">
            {diskId || 'Loading...'}
          </div>
          <button
            onClick={async () => {
              try {
                if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(diskId || '');
                } else if (window.require) {
                  const { clipboard } = window.require('electron');
                  clipboard.writeText(diskId || '');
                }
                setStatus('✅ Disk ID copied to clipboard.');
              } catch (err) {
                setStatus('⚠️ Could not copy Disk ID to clipboard.');
              }
            }}
            style={{ padding: '8px 12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            📋 Copy Disk ID
          </button>
        </div>
      </div>
      
      {/* Collect client info for deployer */}
      <div style={{ maxWidth: 560, margin: '0 auto 8px', padding: 12, background: '#fafafa', borderRadius: 8 }}>
        <div style={{ marginBottom: 8, fontWeight: 700, color: '#222', fontSize: '1rem' }}>Client contact (send to vendor)</div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Full name</label>
          <input placeholder="Full name" value={clientName} onChange={e => setClientName(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Email</label>
          <input placeholder="Email" value={clientEmailField} onChange={e => setClientEmailField(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Phone (optional)</label>
          <input placeholder="Phone (optional)" value={clientPhone} onChange={e => setClientPhone(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            onClick={async () => {
              try {
                // Validate
                if (!clientName || !clientEmailField) {
                  setStatus('⚠️ Please enter client name and email before sending.');
                  return;
                }

                if (!isOnline) {
                  setStatus('⚠️ You are offline — if you have no internet, send this information to vendor by email: pos.sales.system@gmail.com or phone: +213 782073213');
                  return;
                }

                if (window.require) {
                  const { ipcRenderer } = window.require('electron');
                  setLoading(true);
                  const res = await ipcRenderer.invoke('send-license-request', {
                    diskId: diskId || licenseUtil.getDiskId(),
                    clientName,
                    clientEmail: clientEmailField,
                    clientPhone
                  });
                  setLoading(false);
                  if (res && res.success) {
                    setStatus('✅ Contact info sent to pos.sales.system@gmail.com.');
                  } else {
                    setStatus('❌ Could not send info: ' + (res && res.error ? res.error : 'Unknown error'));
                  }
                }
              } catch (err) {
                setStatus('❌ Error: ' + err.message);
                setLoading(false);
              }
            }}
            style={{ padding: '10px 14px', backgroundColor: '#2d86ff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            📤 Send to vendor
          </button>
        </div>

        <div style={{ marginTop: 12, color: '#b03', fontSize: 13 }}>
          {t('settings.licenseContact') || 'If you do not have internet, send this information to vendor by email: '}<strong>pos.sales.system@gmail.com</strong>{' '}{t('settings.orPhone') || 'or phone:'} <strong>+213 782073213</strong>
        </div>
      </div>

      {/* File import interface - Always shown */}
      <div style={{ textAlign: 'center', padding: '30px' }}>
          <input
            type="file"
            accept=".lic,.json"
            onChange={handleFileImport}
            style={{ display: 'none' }}
            id="license-file-input"
          />
          <label
            htmlFor="license-file-input"
            style={{
              display: 'inline-block',
              padding: '15px 30px',
              backgroundColor: '#ff6600',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            📁 Choose a .lic file
          </label>
          <p style={{ marginTop: '20px', color: '#666', fontSize: '0.9rem' }}>
            The license file was provided by your vendor
          </p>

          {/* Trial button */}
          <div style={{ marginTop: 18 }}>
            <button
              onClick={async () => {
                try {
                  setLoading(true);
                  setStatus(t('settings.startingTrial') || '🕒 Starting 7-day trial...');

                  // Electron path: ask main process to create & store a trial license
                  if (window && window.require) {
                    const { ipcRenderer } = window.require('electron');
                    const res = await ipcRenderer.invoke('start-trial', 7);
                    setLoading(false);

                    if (res && res.success) {
                      const activation = {
                        license_key: res.license_key,
                        machine_id: licenseUtil.getMachineId(),
                        expiry: res.expire_at,
                        last_run: new Date()
                      };
                      activation.trial = true;
                      licenseUtil.storeActivation(activation);
                      try { window.dispatchEvent(new CustomEvent('license-updated', { detail: activation })); } catch (e) {}
                      setActivated(true);
                      const daysLeft = Math.ceil((new Date(res.expire_at) - new Date()) / (1000 * 60 * 60 * 24));
                      setExpiresIn(daysLeft);
                      setStatus(`✅ ${t('settings.trialStarted', { days: daysLeft })}`);
                      if (onActivated) onActivated();
                      return;
                    }

                    setStatus('❌ Could not start trial: ' + (res && res.error ? res.error : 'Unknown error'));
                    return;
                  }

                  // Browser/dev fallback: store trial locally
                  const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                  const activation = {
                    license_key: 'TRIAL-LOCAL',
                    machine_id: licenseUtil.getMachineId(),
                    expiry: expireAt,
                    last_run: new Date(),
                    trial: true
                  };
                  licenseUtil.storeActivation(activation);
                  try { window.dispatchEvent(new CustomEvent('license-updated', { detail: activation })); } catch (e) {}
                  setActivated(true);
                  setExpiresIn(7);
                  setStatus(`✅ ${t('settings.trialStarted', { days: 7 })}`);
                } catch (err) {
                  setStatus('❌ Trial start failed: ' + (err && err.message ? err.message : err));
                  setLoading(false);
                }
              }}
              style={{ padding: '10px 14px', backgroundColor: '#2dbf2d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}
            >
              {t('settings.startTrial')}
            </button>
            <div style={{ marginTop: 8, color: '#666', fontSize: '0.9rem' }}>
              {t('settings.trialHint', { days: 7 })}
            </div>
          </div>
        </div>
    
    {status && <div className="license-status">{status}</div>}
  </div>
  );
};

export default License;
