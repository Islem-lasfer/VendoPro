import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings, currencies } from '../../context/SettingsContext';
import Notification from '../../components/Notification/Notification';
import NumericInput from '../../components/NumericInput/NumericInput';
import { isPasswordRequired, verifyPassword, updatePassword } from '../../utils/auth';
import './Settings.css';
import License from '../../components/License/License';
import licenseUtil from '../../utils/license';

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

  // Locations management
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ name: '', type: 'shop' });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState([]);

  // License/trial UI state
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseActionLoading, setLicenseActionLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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

  // Load available printers for receipt selection
  const loadPrinters = async () => {
    if (!ipcRenderer) return;
    try {
      const list = await ipcRenderer.invoke('printers:get');
      setAvailablePrinters(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Could not fetch printers:', err && err.message);
      setAvailablePrinters([]);
    }
  };

  useEffect(() => {
    loadLocations();
    loadPrinters();

    // Load license/trial info from local activation store
    const loadLicenseInfo = async () => {
      try {
        const machineId = licenseUtil.getMachineId();
        const act = await licenseUtil.loadActivation(machineId);
        setLicenseInfo(act);
      } catch (err) {
        setLicenseInfo(null);
      }
    };

    loadLicenseInfo();

    // Listen for license updates (triggered by License.jsx)
    const onUpdated = () => loadLicenseInfo();
    window.addEventListener('license-updated', onUpdated);
    return () => window.removeEventListener('license-updated', onUpdated);
  }, []);

  // Get packaged app version (desktop only)
  useEffect(() => {
    if (!ipcRenderer) return;
    ipcRenderer.invoke('get-app-version').then((v) => setAppVersion(v)).catch(() => {});
  }, []);

  // Sync localSettings with settings from context
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

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
        taxId: shop.taxId || prev.taxId || '',        rc: shop.rc || prev.rc || '',
        ai: shop.ai || prev.ai || '',
        nis: shop.nis || prev.nis || '',        taxRate: shop.taxRate ?? prev.taxRate,
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
      rc: newSettings.rc || '',
      ai: newSettings.ai || '',
      nis: newSettings.nis || '',
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
              <label className="setting-label">{t('settings.rc') || 'RC'}</label>
              <p className="setting-description">{t('settings.rcDesc') || 'Optional company registration number (RC).'}</p>
            </div>
            <input
              type="text"
              className="setting-input"
              value={localSettings.rc || ''}
              onChange={e => handleChange('rc', e.target.value)}
              placeholder={t('settings.rcPlaceholder') || 'Enter RC (optional)'}
            />
          </div>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.ai') || 'AI'}</label>
              <p className="setting-description">{t('settings.aiDesc') || 'Optional tax office code (AI).'}</p>
            </div>
            <input
              type="text"
              className="setting-input"
              value={localSettings.ai || ''}
              onChange={e => handleChange('ai', e.target.value)}
              placeholder={t('settings.aiPlaceholder') || 'Enter AI (optional)'}
            />
          </div>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.nis') || 'NIS'}</label>
              <p className="setting-description">{t('settings.nisDesc') || 'Optional statistical identifier (NIS).'}</p>
            </div>
            <input
              type="text"
              className="setting-input"
              value={localSettings.nis || ''}
              onChange={e => handleChange('nis', e.target.value)}
              placeholder={t('settings.nisPlaceholder') || 'Enter NIS (optional)'}
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

          {/* Receipt printer selection */}
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.receiptPrinter') || 'Receipt printer'}</label>
              <p className="setting-description">{t('settings.receiptPrinterDesc') || 'Select default printer for receipts (leave empty to use system default).'} </p>
            </div>

            <select
              className="setting-input"
              value={localSettings.receiptPrinter || ''}
              onChange={(e) => handleChange('receiptPrinter', e.target.value || null)}
            >
              <option value="">{t('settings.useSystemDefault') || 'Use system default'}</option>
              {availablePrinters.map(p => (
                <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' — default' : ''}</option>
              ))}
            </select>

            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center' }}>
              <label className="toggle-switch" style={{ marginRight: 8 }}>
                <input
                  type="checkbox"
                  checked={!!localSettings.printDialogOnPrint}
                  onChange={(e) => handleChange('printDialogOnPrint', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span>{t('settings.printDialog') || 'Show system print dialog'}</span>
            </div>
          </div>

          {/* Barcode printer (dedicated) */}
          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.barcodePrinter') || 'Barcode printer'}</label>
              <p className="setting-description">{t('settings.barcodePrinterDesc') || 'Select default printer for product barcode labels.'}</p>
            </div>

            <select
              className="setting-input"
              value={localSettings.barcodePrinter || ''}
              onChange={(e) => handleChange('barcodePrinter', e.target.value || null)}
            >
              <option value="">{t('settings.useSystemDefault') || 'Use system default'}</option>
              {availablePrinters.map(p => (
                <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' — default' : ''}</option>
              ))}
            </select>

            <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
              {t('settings.barcodePrinterNote') || 'If a barcode printer is selected, barcode labels will print there by default.'}
            </div>
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
                  {String(cat).toLowerCase() === 'miscellaneous' ? t('settings.products_category_miscellaneous', 'Miscellaneous') : cat}
                  {String(cat).toLowerCase() !== 'miscellaneous' && (
                    <button type="button" style={{marginLeft:'6px',background:'none',border:'none',color:'#fff',fontWeight:'bold',cursor:'pointer', fontSize:'1em'}} onClick={() => {
                      const cats = Array.isArray(localSettings.categories) ? localSettings.categories : (localSettings.categories ? localSettings.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                      setLocalSettings({ ...localSettings, categories: cats.filter((_, i) => i !== idx) });
                    }}>×</button>
                  )}
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

        {/* Software Updates */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🔄</span>
            {t('settings.softwareUpdatesTitle')}
          </h2>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.appVersionLabel')}</label>
              <p className="setting-description">{t('settings.appVersionDesc')}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><code>{appVersion || '—'}</code></div>
              <div>
                <button className="save-settings-btn" onClick={async () => {
                  if (!ipcRenderer) {
                    showNotification(t('update.desktopOnly'), 'info');
                    return;
                  }
                  setIsCheckingUpdate(true);
                  try {
                    await ipcRenderer.invoke('check-for-updates');
                    // update UI handled by UpdateNotification component
                  } catch (err) {
                    showNotification(t('update.checkFailed', { error: err && err.message ? err.message : err }), 'error');
                  } finally {
                    setTimeout(() => setIsCheckingUpdate(false), 1200);
                  }
                }} disabled={isCheckingUpdate}>
                  {isCheckingUpdate ? t('settings.checking') : t('settings.checkForUpdates')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* License & Trial Section */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🔐</span>
            {t('settings.licenseSectionTitle')}
          </h2>

          <div className="setting-card">
            <div className="setting-header">
              <label className="setting-label">{t('settings.licenseStatusLabel')}</label>
              <p className="setting-description">{t('settings.licenseStatusDesc')}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {licenseInfo && licenseInfo.expiry && new Date(licenseInfo.expiry) > new Date() ? (
                (() => {
                  const expiryDate = new Date(licenseInfo.expiry);
                  const isUnlimited = expiryDate > new Date('2099-01-01');
                  const daysLeft = Math.max(0, Math.ceil((expiryDate - new Date()) / (1000*60*60*24)));
                  return (
                    <>
                      <div style={{ fontWeight: 700, color: '#2d6a4f' }}>
                        🟢 {isUnlimited ? t('settings.licenseActiveUnlimited') : t('settings.licenseActive', { days: daysLeft })}
                      </div>

                      {!isUnlimited && (
                        <div style={{ color: '#666' }}>{t('settings.licenseExpires', { date: expiryDate.toLocaleDateString() })}</div>
                      )}

                      <div>
                        <button className="save-settings-btn" onClick={() => setShowLicenseModal(true)}>🔑 {t('settings.openActivationPage')}</button>
                      </div>
                    </>
                  );
                })()
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: '#b03' }}>
                    ⚠️ {t('settings.trialExpired')}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="save-settings-btn" onClick={() => setShowLicenseModal(true)}>🔑 {t('settings.activateEnterLicense')}</button>
                    <button className="reset-settings-btn" onClick={async () => {
                      if (!ipcRenderer) {
                        // Browser fallback
                        const expireAt = new Date(Date.now() + 7*24*60*60*1000).toISOString();
                        const act = { license_key: 'TRIAL-LOCAL', machine_id: licenseUtil.getMachineId(), expiry: expireAt, last_run: new Date(), trial: true };
                        licenseUtil.storeActivation(act);
                        setLicenseInfo(act);
                        window.dispatchEvent(new CustomEvent('license-updated', { detail: act }));
                        showNotification(t('settings.trialStarted', { days: 7 }), 'success');
                        return;
                      }

                      try {
                        setLicenseActionLoading(true);
                        const res = await ipcRenderer.invoke('start-trial', 7);
                        setLicenseActionLoading(false);
                        if (res && res.success) {
                          const act = { license_key: res.license_key, machine_id: licenseUtil.getMachineId(), expiry: res.expire_at, last_run: new Date(), trial: true };
                          licenseUtil.storeActivation(act);
                          setLicenseInfo(act);
                          window.dispatchEvent(new CustomEvent('license-updated', { detail: act }));
                          showNotification(t('settings.trialStarted', { days: 7 }), 'success');
                        } else {
                          showNotification('Could not start trial: ' + (res && res.error ? res.error : 'Unknown'), 'error');
                        }
                      } catch (err) {
                        setLicenseActionLoading(false);
                        showNotification('Error starting trial: ' + (err && err.message ? err.message : err), 'error');
                      }
                    }} disabled={licenseActionLoading}>
                      {t('settings.startTrial')}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: 12, color: '#777', fontSize: '0.9rem' }}>
              {t('settings.trialExpiryNote') }
            </div>
          </div>
        </div>
  
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

        {/* Render License modal from Settings when requested */}
        {showLicenseModal && (
          <License forceOpen={true} onActivated={() => {
            // Refresh local license info and close modal
            (async () => {
              const act = await licenseUtil.loadActivation(licenseUtil.getMachineId());
              setLicenseInfo(act);
              window.dispatchEvent(new CustomEvent('license-updated', { detail: act }));
            })();
            setShowLicenseModal(false);
          }} onClose={() => setShowLicenseModal(false)} />
        )}
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
