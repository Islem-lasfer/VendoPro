import React, { useState, useRef } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { currencies } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { saveAuthData, hashPassword } from '../../utils/auth';
import './Setup.css';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';

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

const Setup = ({ onComplete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateSettings } = useSettings();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    shopName: '',
    shopAddress: '',
    shopLogo: '',
    usePassword: false,
    password: '',
    taxId: '',
    taxRate: 10,
    discountRate: 0,
    currency: 'USD',
    phone1: '',
    phone2: '',
    categories: [],
    shops: [{ name: 'Shop 1' }],
    stocks: [{ name: 'Stock 1' }]
  });
  const [categoryInput, setCategoryInput] = useState('');
  const categoryInputRef = useRef(null);
  const [errors, setErrors] = useState({});

  const handlePasswordChoice = (usePassword) => {
    // Validate step 1 first
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.shopName) {
      newErrors.shopName = 'Shop name is required';
    }
    if (!formData.taxRate && formData.taxRate !== 0) {
      newErrors.taxRate = 'Tax rate is required';
    } else if (formData.taxRate < 0 || formData.taxRate > 100) {
      newErrors.taxRate = 'Tax rate must be between 0 and 100';
    }
    if (!formData.discountRate && formData.discountRate !== 0) {
      newErrors.discountRate = 'Discount rate is required';
    } else if (formData.discountRate < 0 || formData.discountRate > 100) {
      newErrors.discountRate = 'Discount rate must be between 0 and 100';
    }
    if (!formData.currency) {
      newErrors.currency = 'Currency is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setFormData({ ...formData, usePassword });
    if (!usePassword) {
      completeSetup(false);
    } else {
      setStep(2);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, shopLogo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const completeSetup = async (needsPassword) => {
    try {
      let passwordHash = null;
      if (needsPassword && formData.password) {
        passwordHash = await hashPassword(formData.password);
      }
      saveAuthData(formData.email, passwordHash);
      
      // Save shop settings to localStorage
      const shopSettings = {
        posName: formData.shopName || 'POS',
        posLogo: formData.shopLogo || '',
        email: formData.email,
        shopAddress: formData.shopAddress,
        taxId: formData.taxId,
        taxRate: formData.taxRate,
        discountRate: formData.discountRate,
        currency: formData.currency,
        phone1: formData.phone1,
        phone2: formData.phone2,
        categories: Array.isArray(formData.categories)
          ? formData.categories.filter(Boolean)
          : (typeof formData.categories === 'string' && formData.categories)
            ? formData.categories.split(',').map(c => c.trim()).filter(Boolean)
            : []
      };
      localStorage.setItem('shopSettings', JSON.stringify(shopSettings));
      
      // Create initial locations (shops and stocks)
      if (ipcRenderer) {
        // Get existing locations to avoid duplicates
        const existingLocations = await ipcRenderer.invoke('get-all-locations');
        const existingNames = existingLocations.map(loc => loc.name.toLowerCase());
        
        // Create shops
        for (const shop of formData.shops) {
          if (shop.name && shop.name.trim() && !existingNames.includes(shop.name.trim().toLowerCase())) {
            await ipcRenderer.invoke('create-location', {
              name: shop.name.trim(),
              type: 'shop'
            });
          }
        }
        
        // Create stocks
        for (const stock of formData.stocks) {
          if (stock.name && stock.name.trim() && !existingNames.includes(stock.name.trim().toLowerCase())) {
            await ipcRenderer.invoke('create-location', {
              name: stock.name.trim(),
              type: 'stock'
            });
          }
        }
      }
      
      // Update SettingsContext so currency and other info is reflected immediately
      updateSettings({
        posName: shopSettings.posName,
        posLogo: shopSettings.posLogo,
        shopAddress: shopSettings.shopAddress,
        taxId: shopSettings.taxId,
        taxRate: shopSettings.taxRate,
        discountRate: shopSettings.discountRate,
        currency: shopSettings.currency,
        phone1: shopSettings.phone1,
        phone2: shopSettings.phone2,
        email: shopSettings.email,
        categories: shopSettings.categories
      });
      
      if (onComplete) {
        onComplete();
      }
      navigate('/');
    } catch (error) {
      setErrors({ submit: 'Failed to save settings. Please try again.' });
    }
  };

  const validateStep2 = () => {
    const newErrors = {};
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFinish = async () => {
    if (!validateStep2()) {
      return;
    }
    
    await completeSetup(true);
  };

  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const requestCloseApp = () => {
    setShowConfirmClose(true);
  };

  const doCloseApp = () => {
    if (ipcRenderer) {
      ipcRenderer.send('confirm-close');
    } else {
      console.warn('Cannot close app: ipcRenderer not available');
    }
    setShowConfirmClose(false);
  };

  return (
    <div className="setup-page">
      <button 
        className="close-btn"
        onClick={requestCloseApp}
        type="button"
        title={"Close Application"}
      >
        ×
      </button>

      {showConfirmClose && (
        <ConfirmDialog
          message={t('common.confirmCloseApp') || 'Are you sure you want to close the application?'}
          confirmText={t('common.close') || 'Close'}
          cancelText={t('common.cancel') || 'Cancel'}
          onConfirm={doCloseApp}
          onCancel={() => setShowConfirmClose(false)}
        />
      )}

      <button 
        className="close-btn"
        onClick={requestCloseApp}
        type="button"
        title={"Close Application"}
      >
        ×
      </button>
      <div className="setup-container">
        <div className="setup-header">
          <h1>🚀 Welcome to POS</h1>
          <p>Let's set up your account</p>
        </div>

        <div className="setup-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <span>Security</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <span>Password</span>
          </div>
        </div>

        {step === 1 && (
          <div className="setup-step">
            <h2>Shop Information</h2>
            <p className="step-description">
              Enter your shop details and email address
            </p>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your-email@example.com"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label>Shop Name *</label>
              <input
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                placeholder="My Shop"
                className={errors.shopName ? 'error' : ''}
              />
              {errors.shopName && <span className="error-message">{errors.shopName}</span>}
            </div>
            <div className="form-group">
              <label>Shop Address (Optional)</label>
              <input
                type="text"
                value={formData.shopAddress}
                onChange={(e) => setFormData({ ...formData, shopAddress: e.target.value })}
                placeholder="Shop address"
                className={errors.shopAddress ? 'error' : ''}
              />
              {errors.shopAddress && <span className="error-message">{errors.shopAddress}</span>}
            </div>
            <div className="form-group">
              <label>Tax ID (Optional)</label>
              <input
                type="text"
                value={formData.taxId}
                onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="Company tax ID / VAT number"
              />
            </div>

            <div className="form-group">
              <label>Tax Rate (%) *</label>
              <input
                type="number"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.1"
                className={errors.taxRate ? 'error' : ''}
                placeholder="10"
              />
              {errors.taxRate && <span className="error-message">{errors.taxRate}</span>}
            </div>

            <div className="form-group">
              <label>Discount Rate (%) *</label>
              <input
                type="number"
                value={formData.discountRate}
                onChange={(e) => setFormData({ ...formData, discountRate: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.1"
                className={errors.discountRate ? 'error' : ''}
                placeholder="0"
              />
              {errors.discountRate && <span className="error-message">{errors.discountRate}</span>}
            </div>

            <div className="form-group">
              <label>Currency Type *</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className={errors.currency ? 'error' : ''}
              >
                {currencies.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.symbol} - {curr.name} ({curr.code})
                  </option>
                ))}
              </select>
              {errors.currency && <span className="error-message">{errors.currency}</span>}
            </div>


            <div className="form-group">
              <label>Product Categories</label>
              <div className="category-input-wrapper" style={{display:'flex',flexWrap:'wrap',gap:'8px',padding:'4px',border:'1px solid #cccccc1a',borderRadius:'6px',background:'transparent'}}>
                {(Array.isArray(formData.categories) ? formData.categories : (formData.categories ? formData.categories.split(',').map(c=>c.trim()).filter(Boolean) : [])).map((cat, idx) => (
                  <span key={idx} style={{background:'#ff9800',color:'#fff',borderRadius:'16px',padding:'2px 12px',display:'flex',alignItems:'center',margin:'6px 1px', fontSize:'0.85em'}}>
                    {cat}
                    <button type="button" style={{marginLeft:'6px',background:'none',border:'none',color:'#fff',fontWeight:'bold',cursor:'pointer', fontSize:'1em'}} onClick={() => {
                      const cats = Array.isArray(formData.categories) ? formData.categories : (formData.categories ? formData.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                      setFormData({ ...formData, categories: cats.filter((_, i) => i !== idx) });
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
                      const cats = Array.isArray(formData.categories) ? formData.categories : (formData.categories ? formData.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                      if (!cats.includes(categoryInput.trim())) {
                        setFormData({ ...formData, categories: [...cats, categoryInput.trim()] });
                      }
                      setCategoryInput('');
                    } else if (e.key === 'Backspace' && (!categoryInput || categoryInput === '') && (Array.isArray(formData.categories) ? formData.categories.length : (formData.categories ? formData.categories.split(',').map(c=>c.trim()).filter(Boolean).length : 0)) > 0) {
                      const cats = Array.isArray(formData.categories) ? formData.categories : (formData.categories ? formData.categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
                      setFormData({ ...formData, categories: cats.slice(0, -1) });
                    }
                  }}
                  placeholder="Type and press Enter..."
                />
              </div>
              <span className="form-hint">Press Enter after each category. You can edit these later in Settings.</span>
            </div>

            <div className="form-group">
              <label>Shop Locations</label>
              <div className="locations-list">
                {formData.shops.map((shop, idx) => (
                  <div key={idx} className="location-item">
                    <input
                      type="text"
                      value={shop.name}
                      onChange={(e) => {
                        const newShops = [...formData.shops];
                        newShops[idx].name = e.target.value;
                        setFormData({ ...formData, shops: newShops });
                      }}
                      placeholder={`Shop ${idx + 1}`}
                    />
                    {formData.shops.length > 1 && (
                      <button
                        type="button"
                        className="remove-location-btn"
                        onClick={() => {
                          const newShops = formData.shops.filter((_, i) => i !== idx);
                          setFormData({ ...formData, shops: newShops });
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="add-location-btn"
                onClick={() => {
                  setFormData({
                    ...formData,
                    shops: [...formData.shops, { name: `Shop ${formData.shops.length + 1}` }]
                  });
                }}
              >
                + Add Shop
              </button>
              <span className="form-hint">Create your shop locations where you sell products.</span>
            </div>

            <div className="form-group">
              <label>Stock Locations</label>
              <div className="locations-list">
                {formData.stocks.map((stock, idx) => (
                  <div key={idx} className="location-item">
                    <input
                      type="text"
                      value={stock.name}
                      onChange={(e) => {
                        const newStocks = [...formData.stocks];
                        newStocks[idx].name = e.target.value;
                        setFormData({ ...formData, stocks: newStocks });
                      }}
                      placeholder={`Stock ${idx + 1}`}
                    />
                    {formData.stocks.length > 1 && (
                      <button
                        type="button"
                        className="remove-location-btn"
                        onClick={() => {
                          const newStocks = formData.stocks.filter((_, i) => i !== idx);
                          setFormData({ ...formData, stocks: newStocks });
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="add-location-btn"
                onClick={() => {
                  setFormData({
                    ...formData,
                    stocks: [...formData.stocks, { name: `Stock ${formData.stocks.length + 1}` }]
                  });
                }}
              >
                + Add Stock
              </button>
              <span className="form-hint">Create your warehouse/stock locations for inventory.</span>
            </div>

            <div className="form-group">
              <label>Phone 1 (Optional)</label>
              <input
                type="tel"
                value={formData.phone1}
                onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                placeholder="Primary phone number"
                className={errors.phone1 ? 'error' : ''}
              />
              {errors.phone1 && <span className="error-message">{errors.phone1}</span>}
            </div>

            <div className="form-group">
              <label>Phone 2 (Optional)</label>
              <input
                type="tel"
                value={formData.phone2}
                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                placeholder="Secondary phone number"
              />
            </div>

            <div className="form-group">
              <label>Shop Logo (Optional)</label>
              {formData.shopLogo ? (
                <div className="logo-preview-container">
                  <div className="logo-preview">
                    <img src={formData.shopLogo} alt="Logo" />
                  </div>
                  <button 
                    className="remove-logo-btn" 
                    onClick={() => setFormData({ ...formData, shopLogo: '' })}
                    type="button"
                  >
                    🗑️ Remove Logo
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
                    📁 Upload Logo
                  </label>
                </div>
              )}
            </div>

            <h2 style={{ marginTop: '32px' }}>Password Protection</h2>
            <p className="step-description">
              Do you want to protect sensitive pages with a password?
            </p>

            <div className="password-choice">
              <button 
                className="choice-btn primary-choice"
                onClick={() => handlePasswordChoice(true)}
                type="button"
              >
                <div className="choice-icon">🔒</div>
                <h3>Use Password</h3>
                <p>Protect Products, Sales, Employees, and Supplier Invoices pages</p>
              </button>

              <button 
                className="choice-btn secondary-choice"
                onClick={() => handlePasswordChoice(false)}
                type="button"
              >
                <div className="choice-icon">🔓</div>
                <h3>No Password</h3>
                <p>Open all pages without password protection</p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="setup-step">
            <h2>Set Password</h2>
            <p className="step-description">
              Enter a password to protect your sensitive data
            </p>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password (min 6 characters)"
                className={errors.password ? 'error' : ''}
                autoFocus
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            {errors.submit && <div className="error-message">{errors.submit}</div>}

            <div className="setup-actions">
              <button 
                className="setup-btn secondary" 
                onClick={() => setStep(1)}
                type="button"
              >
                ← Back
              </button>
              <button 
                className="setup-btn primary" 
                onClick={handleFinish}
                type="button"
              >
                Complete Setup ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;
