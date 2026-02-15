import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { logout, isPasswordRequired } from '../../utils/auth';
import './Layout.css';
import ConfirmDialog from '../Notification/ConfirmDialog';
import Notification from '../Notification/Notification';
import defaultLogo from '../../../img/Vendopro.png';

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

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  // Add local state for logo and shop name to auto-update from localStorage
  const [shopInfo, setShopInfo] = useState({
    posLogo: settings.posLogo,
    posName: settings.posName
  });

  useEffect(() => {
    // Initial load from localStorage
    const shopSettings = localStorage.getItem('shopSettings');
    if (shopSettings) {
      const shop = JSON.parse(shopSettings);
      setShopInfo({
        posLogo: shop.posLogo || settings.posLogo,
        posName: shop.posName || settings.posName
      });
    }
  }, [settings.posLogo, settings.posName]);

  useEffect(() => {
    // Listen for changes to localStorage (from Setup/Settings)
    const handleStorage = (e) => {
      if (e.key === 'shopSettings') {
        const shop = JSON.parse(e.newValue);
        setShopInfo({
          posLogo: shop.posLogo || settings.posLogo,
          posName: shop.posName || settings.posName
        });
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [settings.posLogo, settings.posName]);
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('appLanguage');
    return saved || i18n.language || 'en';
  });

  // Listen for language changes and update direction/class
  useEffect(() => {
    const updateDir = (lang) => {
      document.dir = lang === 'ar' ? 'rtl' : 'ltr';
      setLanguage(lang);
    };
    updateDir(i18n.language);
    const handleLangChange = (lng) => {
      updateDir(lng);
    };
    i18n.on('languageChanged', handleLangChange);

    return () => i18n.off('languageChanged', handleLangChange);
  }, [i18n]);

  // Listen for main process close requests (from native window close)
  useEffect(() => {
    if (!ipcRenderer) return;
    const onRequestClose = () => {
      setShowConfirmClose(true);
    };
    ipcRenderer.on('request-close', onRequestClose);
    return () => ipcRenderer.removeListener('request-close', onRequestClose);
  }, []);

  const menuItems = [
    { path: '/', icon: '🛒', label: t('nav.checkout') },
    { path: '/document-generator', icon: '📝', label: t('nav.salesByInvoices') },
    { path: '/products', icon: '📦', label: t('nav.products') },
    { path: '/sales', icon: '📊', label: t('nav.sales') },
    { path: '/employees', icon: '👥', label: t('nav.employees') },
    { path: '/dashboard', icon: '📈', label: t('nav.dashboard') },
    { path: '/invoices', icon: '📄', label: t('nav.invoices') },
    { path: '/returns', icon: '🔄', label: t('nav.returns') },
    { path: '/supplier-invoices', icon: '📋', label: t('nav.supplierInvoices') },
    { path: '/settings', icon: '⚙️', label: t('nav.settings') },
    { path: '/network', icon: '🌐', label: t('nav.network') || 'Réseau' },
    { path: '/tpe', icon: '💳', label: t('nav.tpe') || 'TPE' },
    { path: '/contact', icon: '📧', label: t('nav.contact') }
  ];

  // Keyboard navigation between pages
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only handle if Ctrl is pressed
      if (!e.ctrlKey) {
        return;
      }

      // Don't trigger if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Check if any modal, notification, or confirm dialog is open
      if (document.querySelector('.modal-overlay') || 
          document.querySelector('.notification-overlay') || 
          document.querySelector('.confirm-overlay')) {
        return;
      }

      const currentIndex = menuItems.findIndex(item => item.path === location.pathname);
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
        navigate(menuItems[prevIndex].path);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
        navigate(menuItems[nextIndex].path);
      }
    };

    window.addEventListener('keydown', handleKeyPress, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyPress, true);
  }, [location.pathname, navigate, menuItems]);

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('appLanguage', lang);
  };

  const [notification, setNotification] = useState(null);

  const handleLogout = async () => {
    // Perform logout immediately and show a non-blocking notification
    logout();

    // Show in-app success notification (auto-closes for success)
    setNotification({ message: t('auth.loggedOut') || 'Logged out successfully', type: 'success' });

    // Reload the app shortly after to complete logout flow (give time for notification to appear)
    setTimeout(() => {
      window.location.reload();
    }, 900);
  };

  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const handleClose = async () => {
    // Use in-app confirmation modal instead of native dialog
    setShowConfirmClose(true);
  };

  const doCloseApp = () => {
    if (ipcRenderer) {
      ipcRenderer.send('confirm-close');
    } else if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('confirm-close');
    } else {
      window.close();
    }
    setShowConfirmClose(false);
  };

  return (
    <div className={`layout ${i18n.language === 'ar' ? 'rtl' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {shopInfo.posLogo ? (
            <img src={shopInfo.posLogo} alt={shopInfo.posName} className="logo-image" />
          ) : (
            <img src={defaultLogo} alt="VendoPro" className="logo-image default-logo" />
          )}
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
          {isPasswordRequired() && (
            <button className="nav-item logout-btn-nav" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span className="nav-label">{t('auth.logout')}</span>
            </button>
          )}

          <button className="nav-item close-app-btn" onClick={handleClose}>
            <span className="nav-icon">❌</span>
            <span className="nav-label">{t('common.close') || 'Close Application'}</span>
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

          {notification && (
            <Notification
              message={notification.message}
              type={notification.type}
              onClose={() => {
                setNotification(null);
                // Ensure reload if user manually closes notification before timeout
                setTimeout(() => window.location.reload(), 250);
              }}
            />
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="copyright">
            <p>© {new Date().getFullYear()} All Rights Reserved</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
