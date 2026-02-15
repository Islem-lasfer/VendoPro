import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, currencies } from '../../context/SettingsContext';
import Notification from '../../components/Notification/Notification';
import NumericInput from '../../components/NumericInput/NumericInput';
import { isPasswordRequired, verifyPassword, updatePassword } from '../../utils/auth';
import './Settings.css';

// Conditionally import ipcRenderer for Electron environment
let ipcRenderer = null;
try {
  if (window.require) {
    const electron = window.require('electron');
    ipcRenderer = electron.ipcRenderer;
  }
} catch (error) {
  console.warn('ipcRenderer not available:', error.message);
}

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings, resetSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  // Keep the text input blank by default; existing categories are shown as chips
  const [categoryInput, setCategoryInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notification, setNotification] = useState(null);
  const [testValue, setTestValue] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  // Auto-update UI state
  const [updateStatus, setUpdateStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'none' | 'error'
  const [updateProgress, setUpdateProgress] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);

  // Locations management
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ name: '', type: 'shop' });
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Load locations from database
  const loadLocations = async () => {
    if (!ipcRenderer) return;
    try {
      const locs = await ipcRenderer.invoke('get-all-locations');
      setLocations(locs);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Sync localSettings with settings from context
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Auto-updater event listeners
  useEffect(() => {
    if (!ipcRenderer) return;

    const onChecking = () => setUpdateStatus('checking');
    const onAvailable = (event, info) => {
      setUpdateStatus('available');
      setUpdateInfo(info);
    };
    const onNotAvailable = () => setUpdateStatus('none');
    const onProgress = (event, progress) => {
      setUpdateStatus('downloading');
      setUpdateProgress(progress);
    };
    const onDownloaded = (event, info) => {
      setUpdateStatus('downloaded');
      setUpdateInfo(info);
    };

    ipcRenderer.on('update-checking', onChecking);
    ipcRenderer.on('update-available', onAvailable);
    ipcRenderer.on('update-not-available', onNotAvailable);
    ipcRenderer.on('update-download-progress', onProgress);
    ipcRenderer.on('update-downloaded', onDownloaded);

    return () => {
      ipcRenderer.removeListener('update-checking', onChecking);
      ipcRenderer.removeListener('update-available', onAvailable);
      ipcRenderer.removeListener('update-not-available', onNotAvailable);
      ipcRenderer.removeListener('update-download-progress', onProgress);
      ipcRenderer.removeListener('update-downloaded', onDownloaded);
    };
  }, [ipcRenderer]);

  // Load shop settings from setup
  useEffect(() => {
    const shopSettings = localStorage.getItem('shopSettings');
    if (shopSettings) {
      const shop = JSON.parse(shopSettings);
      setLocalSettings(prev => ({
        ...prev,
        posName: shop.posName || prev.posName,
        posLogo: shop.posLogo || prev.posLogo,
        shopAddress: shop.shopAddress || prev.shopAddress || '',
        taxId: shop.taxId || prev.taxId || '',
        taxRate: shop.taxRate ?? prev.taxRate,
        discountRate: shop.discountRate ?? prev.discountRate,
        currency: shop.currency ?? prev.currency,
        phone1: shop.phone1 ?? prev.phone1,
        phone2: shop.phone2 ?? prev.phone2,
        primaryColor: shop.primaryColor || prev.primaryColor
      }));
    }
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' }
  ];

  const handleChange = (key, value) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    
    // Apply theme immediately for preview
    if (key === 'theme') {
      updateSettings({ theme: value });
    }
    // Apply color immediately for preview
    if (key === 'primaryColor') {
      updateSettings({ primaryColor: value });
    }
  };

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
    document.dir = langCode === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('appLanguage', langCode);
  };

  const handleSave = () => {
    // Merge categories: combine any typed input with existing categories
    const typedCats = (categoryInput || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const existingCats = Array.isArray(localSettings.categories)
      ? localSettings.categories
      : (localSettings.categories ? localSettings.categories.split(',').map(c => c.trim()).filter(Boolean) : []);

    // Merge and dedupe
    const categories = Array.from(new Set([...existingCats, ...typedCats]));

    const newSettings = { ...localSettings, categories };

    // Update global settings (which persists to localStorage via SettingsContext)
    updateSettings(newSettings);

    // Save to localStorage for shop info fields as well
    const shopSettings = {
      posName: newSettings.posName,
      posLogo: newSettings.posLogo,
      shopAddress: newSettings.shopAddress,
      taxId: newSettings.taxId,
      taxRate: newSettings.taxRate,
      discountRate: newSettings.discountRate,
      currency: newSettings.currency,
      phone1: newSettings.phone1,
      phone2: newSettings.phone2,
      email: newSettings.email,
      categories: newSettings.categories,
      primaryColor: newSettings.primaryColor
    };
    localStorage.setItem('shopSettings', JSON.stringify(shopSettings));

    // Clear the input field after saving
    setCategoryInput('');

    // Dispatch custom event to notify NumericInput components (and others)
    window.dispatchEvent(new Event('settingsUpdated'));

    showNotification(t('settings.saveSuccess') || 'Settings saved successfully!', 'success');
  };

  const handleReset = () => {
    resetSettings();
    setLocalSettings({
      theme: 'dark',
      taxRate: 10,
      discountRate: 0,
      posName: 'POS',
      posLogo: ''
    });
    setShowResetConfirm(false);
    showNotification(t('settings.resetSuccess') || 'Settings reset to defaults!', 'success');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('posLogo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    handleChange('posLogo', '');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    // Validate old password
    if (!passwordForm.oldPassword) {
      setPasswordError(t('auth.oldPasswordRequired') || 'Old password is required');
      return;
    }

    const isOldPasswordValid = await verifyPassword(passwordForm.oldPassword);
    if (!isOldPasswordValid) {
      setPasswordError(t('auth.oldPasswordIncorrect') || 'Old password is incorrect');
      return;
    }

    // Validate new password
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError(t('auth.allFieldsRequired') || 'All fields are required');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t('auth.passwordMinLength') || 'Password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('auth.passwordsNotMatch') || 'Passwords do not match');
      return;
    }

    // Update password
    await updatePassword(passwordForm.newPassword);
    setPasswordForm({
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    showNotification(t('auth.passwordChanged'), 'success');
  };

  // Location management functions
  const handleAddLocation = async () => {
    if (!ipcRenderer) return;
    if (!newLocation.name || !newLocation.name.trim()) {
      showNotification('Please enter a location name', 'error');
      return;
    }
    
    try {
      await ipcRenderer.invoke('create-location', {
        name: newLocation.name.trim(),
        type: newLocation.type
      });
      showNotification(`${newLocation.type === 'shop' ? 'Shop' : 'Stock'} added successfully`, 'success');
      setNewLocation({ name: '', type: 'shop' });
      setShowLocationModal(false);
      loadLocations();
    } catch (error) {
      showNotification('Error adding location: ' + error.message, 'error');
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (!ipcRenderer) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete "${name}"? This will fail if any products exist in this location.`);
    if (!confirmDelete) return;
    
    try {
      await ipcRenderer.invoke('delete-location', id);
      showNotification('Location deleted successfully', 'success');
      loadLocations();
    } catch (error) {
      showNotification('Cannot delete location: ' + error.message, 'error');
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">{t('settings.title')}</h1>
      </div>

      <div className="settings-container">
        
        
        {/* Appearance Section */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🎨</span>
            {t('settings.appearance')}
          </h2>
          
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.theme')}</label>
              <p className="setting-description">{t('settings.themeDesc')}</p>
            </div>
            <div className="theme-switcher">
              <button
                className={`theme-option ${localSettings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => handleChange('theme', 'dark')}
              >
                <span className="theme-icon">🌙</span>
                <span className="theme-label">{t('settings.darkMode')}</span>
              </button>
              <button
                className={`theme-option ${localSettings.theme === 'light' ? 'active' : ''}`}
                onClick={() => handleChange('theme', 'light')}
              >
                <span className="theme-icon">☀️</span>
                <span className="theme-label">{t('settings.lightMode')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Language Settings */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🌍</span>
            {t('settings.language')}
          </h2>
          
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.selectLanguage')}</label>
              <p className="setting-description">{t('settings.languageDesc')}</p>
            </div>
            <div className="language-grid">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`language-option ${i18n.language === lang.code ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <span className="language-flag">{lang.flag}</span>
                  <span className="language-name">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Application Updates */}
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.updates') || 'Application Updates'}</label>
              <p className="setting-description">{t('settings.updatesDesc') || 'Check for updates and install the latest version from the internet.'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="btn"
                onClick={async () => {
                  if (!ipcRenderer) return showNotification('Auto-update not available in this environment', 'error');
                  setUpdateStatus('checking');
                  try {
                    await ipcRenderer.invoke('app:check-for-updates');
                  } catch (err) {
                    setUpdateStatus('error');
                    showNotification('Update check failed: ' + err.message, 'error');
                  }
                }}
              >
                {updateStatus === 'checking' ? (t('settings.updating') || 'Checking...') : (t('settings.checkForUpdates') || 'Check for updates')}
              </button>

              {updateStatus === 'available' && (
                <span style={{ color: 'var(--accent-color)' }}>{t('settings.updateAvailable') || `Update available: ${updateInfo?.version || ''}`}</span>
              )}

              {updateStatus === 'downloading' && (
                <span style={{ color: 'var(--accent-color)' }}>{t('settings.downloading') || 'Downloading update...'} {updateProgress ? `${Math.round(updateProgress.percent || 0)}%` : ''}</span>
              )}

              {updateStatus === 'downloaded' && (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    if (!ipcRenderer) return;
                    try {
                      await ipcRenderer.invoke('app:install-update');
                    } catch (err) {
                      showNotification('Install failed: ' + err.message, 'error');
                    }
                  }}
                >{t('settings.installAndRestart') || 'Install and restart'}</button>
              )}

            </div>
          </div>

          {/* Numeric Keyboard Toggle */}
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.numericKeyboard')}</label>
              <p className="setting-description">{t('settings.numericKeyboardDesc')}</p>
            </div>
            <div className="toggle-switch-container">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={localSettings.enableNumericKeyboard || false}
                  onChange={(e) => handleChange('enableNumericKeyboard', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {localSettings.enableNumericKeyboard ? t('settings.enabled') : t('settings.disabled')}
              </span>
            </div>
            
            {/* Test Input */}
            {localSettings.enableNumericKeyboard && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  🧪 Test the numeric keyboard (click on the field below):
                </label>
                <NumericInput
                  value={testValue}
                  onChange={(e) => setTestValue(e.target.value)}
                  placeholder="Click here to test the keyboard"
                  style={{ fontSize: '16px' }}
                />
                {testValue && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--success-color)' }}>
                    ✓ Value entered: {testValue}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.primaryColor')}</label>
              <p className="setting-description">{t('settings.primaryColorDesc')}</p>
            </div>
            <div className="color-picker-container">
              <div className="preset-colors">
                {[
                  { name: 'Orange', value: '#ff6600' },
                  { name: 'Blue', value: '#0066ff' },
                  { name: 'Green', value: '#00cc66' },
                  { name: 'Red', value: '#ff3333' },
                  { name: 'Purple', value: '#9933ff' },
                  { name: 'Pink', value: '#ff3399' },
                  { name: 'Yellow', value: '#ffcc00' },
                  { name: 'Teal', value: '#00cccc' }
                ].map((color) => (
                  <button
                    key={color.value}
                    className={`color-preset ${localSettings.primaryColor === color.value ? 'active' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleChange('primaryColor', color.value)}
                    title={color.name}
                  >
                    {localSettings.primaryColor === color.value && '✓'}
                  </button>
                ))}
              </div>
              <div className="custom-color-picker">
                <label htmlFor="color-picker" className="color-picker-label">
                  {t('settings.customColor')}
                </label>
                <input
                  type="color"
                  id="color-picker"
                  className="color-input"
                  value={localSettings.primaryColor || '#ff6600'}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                />
                <span className="color-value">{localSettings.primaryColor || '#ff6600'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Business Settings */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">💼</span>
            {t('settings.business')}
          </h2>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.posName')}</label>
              <p className="setting-description">{t('settings.posNameDesc')}</p>
            </div>
            <input
              type="text"
              className="setting-input"
              value={localSettings.posName}
              onChange={(e) => handleChange('posName', e.target.value)}
              placeholder="Enter POS name"
            />
          </div>

          {/* Email Field */}
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.email')}</label>
              <p className="setting-description">{t('settings.emailDesc') || 'Business contact email (used for password recovery and notifications).'} </p>
            </div>
            <input
              type="email"
              className="setting-input"
              value={localSettings.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder={t('settings.emailPlaceholder') || 'Enter business email'}
            />
          </div>
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.shopAddress')}</label>
              <p className="setting-description">{t('settings.shopAddressDesc')}</p>
            </div>
            <input
              type="text"
              className="setting-input"
              value={localSettings.shopAddress || ''}
              onChange={(e) => handleChange('shopAddress', e.target.value)}
              placeholder={t('settings.shopAddressPlaceholder')}
            />
          </div>
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.taxId') || 'Tax ID'}</label>
              <p className="setting-description">{t('settings.taxIdDesc') || 'Company tax ID or VAT number.'}</p>
            </div>
            <input
              type="text"
              className="setting-input"
              value={localSettings.taxId || ''}
              onChange={e => handleChange('taxId', e.target.value)}
              placeholder={t('settings.taxIdPlaceholder') || 'Enter company tax ID'}
            />
          </div>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.logo')}</label>
              <p className="setting-description">{t('settings.logoDesc')}</p>
            </div>
            {localSettings.posLogo ? (
              <div className="logo-preview-container">
                <div className="logo-preview">
                  <img src={localSettings.posLogo} alt="Logo" />
                </div>
                <button className="remove-logo-btn" onClick={removeLogo}>
                  🗑️ {t('settings.removeLogo')}
                </button>
              </div>
            ) : (
              <div className="logo-upload">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="logo-upload" className="upload-btn">
                  📁 {t('settings.uploadLogo')}
                </label>
              </div>
            )}
          </div>
          {/* Product Categories Section (moved here) */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🏷️</span>
            Product Categories
          </h2>
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.categories')}</label>
              <p className="setting-description">{t('settings.categoriesDesc')}</p>
            </div>
            <div className="category-input-wrapper" style={{display:'flex',flexWrap:'wrap',gap:'8px',padding:'6px',border:'1px solid #ccc',borderRadius:'6px',background:'transparent'}}>
              {(Array.isArray(localSettings.categories) ? localSettings.categories : (localSettings.categories ? localSettings.categories.split(',').map(c=>c.trim()).filter(Boolean) : [])).map((cat, idx) => (
                <span key={idx} style={{background:'#ff9800',color:'#fff',borderRadius:'16px',padding:'4px 12px',display:'flex',alignItems:'center',margin:'2px', fontSize:'0.85em'}}>
                  {cat}
                  <button type="button" style={{marginLeft:'6px',background:'none',border:'none',color:'#fff',fontWeight:'bold',cursor:'pointer', fontSize:'1em'}} onClick={() => {
                    const cats = Array.isArray(localSettings.categories) ? localSettings.categories : (localSettings.categories ? localSettings.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                    setLocalSettings({ ...localSettings, categories: cats.filter((_, i) => i !== idx) });
                  }}>×</button>
                </span>
              ))}
              <input
                type="text"
                className="category-input"
                value={categoryInput}
                onChange={e => setCategoryInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && categoryInput && categoryInput.trim()) {
                    e.preventDefault();
                    const cats = Array.isArray(localSettings.categories) ? localSettings.categories : (localSettings.categories ? localSettings.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                    if (!cats.includes(categoryInput.trim())) {
                      setLocalSettings({ ...localSettings, categories: [...cats, categoryInput.trim()] });
                    }
                    setCategoryInput('');
                  } else if (e.key === 'Backspace' && (!categoryInput || categoryInput === '') && (Array.isArray(localSettings.categories) ? localSettings.categories.length : (localSettings.categories ? localSettings.categories.split(',').map(c=>c.trim()).filter(Boolean).length : 0)) > 0) {
                    const cats = Array.isArray(localSettings.categories) ? localSettings.categories : (localSettings.categories ? localSettings.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                    setLocalSettings({ ...localSettings, categories: cats.slice(0, -1) });
                  }
                }}
              />
            </div>
            
          </div>
        </div>



          {/* Remove duplicate currency field. Use only the currency from SettingsContext below. */}

          <div className="setting-card">
              <div className="setting-header">
                <label className="setting-label">{t('settings.phone1')} (Optional)</label>
                <p className="setting-description">{t('settings.phone1Desc')} (optional)</p>
              </div>
              <input
                type="tel"
                className="setting-input"
                value={localSettings.phone1 || ''}
                onChange={(e) => handleChange('phone1', e.target.value)}
                placeholder={t('settings.phone1Placeholder')}
              />
          </div>

          <div className="setting-card">
              <div className="setting-header">
                <label className="setting-label">{t('settings.phone2')}</label>
                <p className="setting-description">{t('settings.phone2Desc')}</p>
              </div>
              <input
                type="tel"
                className="setting-input"
                value={localSettings.phone2 || ''}
                onChange={(e) => handleChange('phone2', e.target.value)}
                placeholder={t('settings.phone2Placeholder')}
              />
          </div>
        </div>

        {/* Financial Settings */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">💰</span>
            {t('settings.financial')}
          </h2>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.currency')}</label>
              <p className="setting-description">{t('settings.currencyDesc')}</p>
            </div>
            <select
              className="setting-input"
              value={localSettings.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              {currencies.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.symbol} - {curr.name} ({curr.code})
                </option>
              ))}
            </select>
            <div className="setting-preview">
              Current: {currencies.find(c => c.code === localSettings.currency)?.symbol} {currencies.find(c => c.code === localSettings.currency)?.name}
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.taxRate')}</label>
              <p className="setting-description">{t('settings.taxRateDesc')}</p>
            </div>
            <div className="input-with-suffix">
              <input
                type="number"
                className="setting-input"
                value={localSettings.taxRate}
                onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.1"
              />
              <span className="input-suffix">%</span>
            </div>
            <div className="setting-preview">
              Current: {localSettings.taxRate}% tax
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.discountRate')}</label>
              <p className="setting-description">{t('settings.discountRateDesc')}</p>
            </div>
            <div className="input-with-suffix">
              <input
                type="number"
                className="setting-input"
                value={localSettings.discountRate}
                onChange={(e) => handleChange('discountRate', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.1"
              />
              <span className="input-suffix">%</span>
            </div>
            <div className="setting-preview">
              Current: {localSettings.discountRate}% discount
            </div>
          </div>
        </div>
        
        {/* Locations Management */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">📍</span>
            {t('settings.locationsManagement')}
          </h2>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.shopsAndStocks')}</label>
              <p className="setting-description">{t('settings.shopsAndStocksDesc')}</p>
            </div>

            <div className="locations-container">
              <div className="locations-section">
                <h3 className="locations-subtitle">🏪 {t('settings.shops', { count: locations.filter(l => l.type === 'shop').length })} ({locations.filter(l => l.type === 'shop').length})</h3>
                <div className="locations-grid">
                  {locations.filter(l => l.type === 'shop').map(loc => (
                    <div key={loc.id} className="location-card">
                      <div className="location-info">
                        <div className="location-name">{loc.name}</div>
                        <div className="location-type">{t('settings.shop')}</div>
                      </div>
                      <button 
                        className="delete-location-btn"
                        onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        title={t('settings.deleteLocation')}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="locations-section">
                <h3 className="locations-subtitle">📦 {t('settings.stocks', { count: locations.filter(l => l.type === 'stock').length })} ({locations.filter(l => l.type === 'stock').length})</h3>
                <div className="locations-grid">
                  {locations.filter(l => l.type === 'stock').map(loc => (
                    <div key={loc.id} className="location-card">
                      <div className="location-info">
                        <div className="location-name">{loc.name}</div>
                        <div className="location-type">{t('settings.stock')}</div>
                      </div>
                      <button 
                        className="delete-location-btn"
                        onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        title={t('settings.deleteLocation')}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              className="add-location-btn-main"
              onClick={() => setShowLocationModal(true)}
            >
              ➕ {t('settings.addNewLocation')}
            </button>
          </div>
        </div>

        {/* Security Section */}
        {isPasswordRequired() && (
          <div className="settings-section">
            <h2 className="section-title">
              <span className="section-icon">🔒</span>
              {t('auth.changePassword')}
            </h2>
            
            <div className="setting-card">
              <div className="setting-header">
                <p className="setting-description">{t('auth.changePasswordDesc')}</p>
              </div>
              <form onSubmit={handlePasswordChange} className="password-form">
                <div className="form-group">
                  <label>{t('auth.oldPassword')}</label>
                  <input
                    type="password"
                    className="setting-input"
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                    placeholder={t('auth.enterOldPassword')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('auth.newPassword')}</label>
                  <input
                    type="password"
                    className="setting-input"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    placeholder={t('auth.enterNewPassword')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('auth.confirmPassword')}</label>
                  <input
                    type="password"
                    className="setting-input"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    placeholder={t('auth.confirmNewPassword')}
                  />
                </div>
                {passwordError && (
                  <div className="error-message" style={{marginBottom: '16px'}}>
                    {passwordError}
                  </div>
                )}
                <button type="submit" className="save-settings-btn">
                  🔑 {t('auth.changePassword')}
                </button>
              </form>
            </div>
          </div>
        )}
  
        {/* Action Buttons */}
        <div className="settings-actions">
          <button className="save-settings-btn" onClick={handleSave}>
            💾 {t('settings.saveChanges')}
          </button>
          <button 
            className="reset-settings-btn"
            onClick={() => setShowResetConfirm(true)}
          >
            🔄 {t('settings.resetToDefaults')}
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('settings.confirmReset')}</h3>
            <p>{t('settings.confirmResetDesc')}</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowResetConfirm(false)}>
                {t('settings.cancel')}
              </button>
              <button className="confirm-btn" onClick={handleReset}>
                {t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showLocationModal && (
        <div className="modal-overlay" onClick={() => setShowLocationModal(false)}>
          <div className="modal-content location-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Location</h3>
            <div className="form-group">
              <label>Location Type</label>
              <select
                className="setting-input"
                value={newLocation.type}
                onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
              >
                <option value="shop">🏪 Shop</option>
                <option value="stock">📦 Stock</option>
              </select>
            </div>
            <div className="form-group">
              <label>Location Name</label>
              <input
                type="text"
                className="setting-input"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder={`Enter ${newLocation.type} name...`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddLocation();
                  }
                }}
              />
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => {
                setShowLocationModal(false);
                setNewLocation({ name: '', type: 'shop' });
              }}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleAddLocation}>
                Add Location
              </button>
            </div>
          </div>
        </div>
      )}
      
      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default Settings;
