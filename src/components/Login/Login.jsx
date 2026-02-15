import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPassword } from '../../utils/auth';
import { useTranslation } from 'react-i18next';
import './Login.css';

const Login = ({ isOpen, onClose, onSuccess, showForgotPassword }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      
      // Check for lockout
      const lockout = localStorage.getItem('loginLockout');
      if (lockout) {
        const lockoutEnd = parseInt(lockout);
        const now = Date.now();
        if (now < lockoutEnd) {
          setLockoutTime(lockoutEnd);
          const timer = setInterval(() => {
            const remaining = lockoutEnd - Date.now();
            if (remaining <= 0) {
              setLockoutTime(null);
              localStorage.removeItem('loginLockout');
              setAttempts(0);
              clearInterval(timer);
            }
          }, 1000);
          return () => clearInterval(timer);
        } else {
          localStorage.removeItem('loginLockout');
          setLockoutTime(null);
        }
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (lockoutTime) {
      return;
    }

    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }

    const isValid = await verifyPassword(password);
    
    if (isValid) {
      setAttempts(0);
      setPassword('');
      setError('');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        // Lock for 5 minutes
        const lockout = Date.now() + (5 * 60 * 1000);
        localStorage.setItem('loginLockout', lockout.toString());
        setLockoutTime(lockout);
        setError(t('auth.tooManyAttempts'));
      } else {
        setError(t('auth.incorrectPassword', { remaining: 5 - newAttempts }));
      }
      
      setPassword('');
    }
  };

  const handleForgotPassword = () => {
    if (onClose) onClose();
    if (showForgotPassword) showForgotPassword();
  };

  const getRemainingTime = () => {
    if (!lockoutTime) return '';
    const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e) => {
    // Don't interfere with input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Allow Enter to submit form naturally, only handle Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        navigate('/');
      }
      return;
    }
    
    // For non-input elements
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      navigate('/');
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, password, lockoutTime]);

  if (!isOpen) return null;

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <button className="close-btn" onClick={() => {
          if (onClose) onClose();
          navigate('/');
        }}>×</button>
        
        <div className="login-header">
          <div className="lock-icon">🔒</div>
          <h2>{t('auth.passwordRequired')}</h2>
          <p>{t('auth.protectedPage')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.enterPassword')}
              autoFocus
              disabled={!!lockoutTime}
              className={error ? 'error' : ''}
            />
            {error && <span className="error-message">{error}</span>}
            {lockoutTime && (
              <span className="lockout-message">
                {t('auth.lockedOut')} {getRemainingTime()}
              </span>
            )}
          </div>

          <button type="submit" className="login-btn" disabled={!!lockoutTime}>
            {t('auth.unlock')}
          </button>
        </form>

        <div className="login-footer">
          <button 
            type="button" 
            className="forgot-link"
            onClick={handleForgotPassword}
          >
            {t('auth.forgotPassword')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
