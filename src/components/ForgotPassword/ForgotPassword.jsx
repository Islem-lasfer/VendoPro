import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getAuthData, 
  generateVerificationCode, 
  storeVerificationCode, 
  verifyCode, 
  updatePassword 
} from '../../utils/auth';
import { useTranslation } from 'react-i18next';
import './ForgotPassword.css';
import { notify } from '../../utils/notifications';

const { ipcRenderer } = window.require('electron');

const ForgotPassword = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: code verification, 2: new password
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  
  // Refs for manual focus control
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  // Get email from saved auth data
  const authData = getAuthData();
  const email = authData?.email || '';

  useEffect(() => {
    if (isOpen && !codeSent && email) {
      // Automatically send verification code when modal opens
      sendVerificationCode();
    }
  }, [isOpen, codeSent, email]);

  // Focus password input when step changes to 2
  useEffect(() => {
    if (step === 2 && newPasswordRef.current) {
      // Small delay to ensure rendering is complete
      setTimeout(() => {
        newPasswordRef.current?.focus();
      }, 100);
    }
  }, [step]);

  const sendVerificationCode = async () => {
    setLoading(true);
    setError('');
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    storeVerificationCode(verificationCode);

    // Try to send email automatically via backend
    try {
      const result = await ipcRenderer.invoke('send-verification-email', {
        email: email,
        code: verificationCode
      });
      
      if (result.success) {
        setLoading(false);
        setCodeSent(true);
        // Code sent successfully - message shown in UI
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to send email automatically:', error);
      
      // Fallback to manual email (open email client)
      const subject = 'Password Reset - Verification Code';
      const body = `Your verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;
      const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      try {
        await ipcRenderer.invoke('open-email', mailtoLink);
        setLoading(false);
        setCodeSent(true);
      } catch (error) {
        setLoading(false);
        setError(t('auth.emailSendFailed') || 'Failed to send verification code. Please check your internet connection.');
      }
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    setError('');

    if (!code) {
      setError(t('auth.codeRequired'));
      return;
    }

    if (!verifyCode(code)) {
      setError(t('auth.invalidCode'));
      return;
    }

    setStep(2);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError(t('auth.allFieldsRequired'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsNotMatch'));
      return;
    }

    updatePassword(newPassword);
    
    // Show success and close
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('show-message-box', {
        type: 'info',
        buttons: ['OK'],
        title: t('common.success') || 'Success',
        message: t('auth.passwordResetSuccess')
      });
    } else {
      notify(t('auth.passwordResetSuccess'), 'success');
    }
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setCodeSent(false);
    if (onClose) onClose();
  };

  const handleKeyDown = (e) => {
    // Don't interfere with input fields - let them work normally
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Only handle Escape for closing modal from input fields
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
      return;
    }
    
    // For non-input elements, only handle Escape key
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Check if email exists
  if (!email) {
    return (
      <div className="forgot-password-overlay">
        <div className="forgot-password-modal">
          <button className="close-btn" onClick={handleClose}>×</button>
          <div className="forgot-header">
            <div className="icon">⚠️</div>
            <h2>No Email Found</h2>
            <p>Please complete the setup first to register your email.</p>
          </div>
          <button className="submit-btn" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal">
        <button className="close-btn" onClick={handleClose}>×</button>
        
        <div className="forgot-header">
          <div className="icon">🔑</div>
          <h2>{t('auth.forgotPassword')}</h2>
          <p>
            {step === 1 
              ? `${t('auth.codeSentTo') || 'Verification code sent to'} ${email}`
              : t('auth.enterNewPassword') || 'Enter your new password'
            }
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleVerifyCode} className="forgot-form">
            <div className="form-group">
              <label htmlFor="code">{t('auth.verificationCode')}</label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('auth.enterCode')}
                autoFocus
                maxLength={6}
                className={error ? 'error' : ''}
              />
              {error && <span className="error-message">{error}</span>}
              <span className="hint">{t('auth.codeHint')}</span>
            </div>

            {loading && (
              <div style={{textAlign: 'center', color: 'var(--primary-color)', marginBottom: '16px'}}>
                ⏳ {t('auth.sending')}...
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {t('auth.verifyCode')}
            </button>
            
            <button 
              type="button" 
              className="back-btn"
              onClick={sendVerificationCode}
              disabled={loading}
            >
              🔄 {t('auth.resendCode') || 'Resend Code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="forgot-form">
            <div className="form-group">
              <label htmlFor="newPassword">{t('auth.newPassword')}</label>
              <input
                type="password"
                id="newPassword"
                ref={newPasswordRef}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('auth.enterNewPassword')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                id="confirmPassword"
                ref={confirmPasswordRef}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirmNewPassword')}
                className={error ? 'error' : ''}
              />
              {error && <span className="error-message">{error}</span>}
            </div>

            <button type="submit" className="submit-btn">
              {t('auth.resetPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
