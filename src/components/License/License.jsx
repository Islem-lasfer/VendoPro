import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './License.css';
import licenseUtil from '../../utils/license';

const License = ({ onActivated, onClose }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);
  const [expiresIn, setExpiresIn] = useState(null);
  const [showFileImport, setShowFileImport] = useState(false);
  const [visible, setVisible] = useState(true);
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setVisible(false);
    }
  };

  useEffect(() => {
    // Check if license is already activated (offline) and bound to this machine
    const check = async () => {
      const machineId = licenseUtil.getMachineId();
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

          // Use Electron IPC for OFFLINE-ONLY activation
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            const result = await ipcRenderer.invoke(
              'activate-license',
              licenseData.license_key,
              licenseData.payload,
              licenseData.signature
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
              
              licenseUtil.storeActivation(activation);
              
              setStatus('✅ Offline activation successful! License bound to this machine.');
              setActivated(true);
              
              if (licenseData.expire_at) {
                const expiryDate = new Date(licenseData.expire_at);
                const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                setExpiresIn(daysLeft);
                
                if (expiryDate > new Date('2099-01-01')) {
                  setStatus('✅ Unlimited license activated! Bound to this machine.');
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



  // If activated or user closed the modal, do not render
  if (activated || !visible) {
    return null;
  }

  return (
    <div className="license-modal">
      <button className="close-btn" aria-label="Close license modal" onClick={handleClose}>×</button>
      <h2>🔐 Offline License Activation</h2>
      <div style={{ textAlign: 'center', marginBottom: '30px', color: '#555', fontSize: '1rem' }}>
        📄 Import your license file (.lic) - No Internet Required
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
        </div>
    
    {status && <div className="license-status">{status}</div>}
  </div>
  );
};

export default License;
