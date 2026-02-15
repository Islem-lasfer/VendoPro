import React, { useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import Login from '../Login/Login';
import ForgotPassword from '../ForgotPassword/ForgotPassword';
import ConfirmDialog from '../Notification/ConfirmDialog';
import './LoginChoice.css';

const LoginChoice = ({ onLoginSuccess, onSkipLogin }) => {
  const { t } = useTranslation();
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const requestCloseApp = () => setShowConfirmClose(true);
  const doCloseApp = () => {
    if (ipcRenderer) {
      ipcRenderer.send('confirm-close');
    } else {
      console.warn('Cannot close app: ipcRenderer not available');
    }
    setShowConfirmClose(false);
  };

  const handleWithPassword = () => {
    setShowLogin(true);
  };

  const handleWithoutPassword = () => {
    sessionStorage.setItem('loginMode', 'guest');
    onSkipLogin();
  };

  const handleLoginSuccess = () => {
    sessionStorage.setItem('loginMode', 'authenticated');
    sessionStorage.setItem('authenticated', 'true');
    onLoginSuccess();
  };

  return (
    <>
      {!showLogin && !showForgotPassword && (
        <div className="login-choice-page">
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
          <div className="login-choice-container">
            <div className="login-choice-header">
              <h1>🔐 {t('auth.welcomeBack')}</h1>
              <p>{t('auth.howAccessSystem')}</p>
            </div>

            <div className="login-choice-buttons">
              <button 
                className="choice-btn primary-choice"
                onClick={handleWithPassword}
                type="button"
              >
                <div className="choice-icon">🔒</div>
                <h3>{t('auth.loginWithPassword')}</h3>
                <p>{t('auth.fullAccess')}</p>
              </button>

              <button 
                className="choice-btn secondary-choice"
                onClick={handleWithoutPassword}
                type="button"
              >
                <div className="choice-icon">👤</div>
                <h3>{t('auth.continueAsGuest')}</h3>
                <p>{t('auth.limitedAccess')}</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogin && (
        <Login 
          isOpen={showLogin} 
          onClose={() => {
            setShowLogin(false);
          }}
          onSuccess={handleLoginSuccess}
          showForgotPassword={() => {
            setShowLogin(false);
            setShowForgotPassword(true);
          }}
        />
      )}

      {showForgotPassword && (
        <ForgotPassword
          isOpen={showForgotPassword}
          onClose={() => {
            setShowForgotPassword(false);
            setShowLogin(true);
          }}
        />
      )}
    </>
  );
};

export default LoginChoice;
