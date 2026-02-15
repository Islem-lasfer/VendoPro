import React, { useEffect } from 'react';
import './NumericKeyboard.css';

const NumericKeyboard = ({ onKeyPress, onClose, currentValue = '' }) => {
  const handleKeyPress = (key) => {
    if (onKeyPress) {
      onKeyPress(key);
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onClose) {
      onClose();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('numeric-keyboard-overlay')) {
      handleClose(e);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const keys = [
    '7', '8', '9',
    '4', '5', '6',
    '1', '2', '3',
    '.', '0', '⌫'
  ];

  return (
    <div className="numeric-keyboard-overlay" onClick={handleOverlayClick}>
      <div className="numeric-keyboard" onClick={(e) => e.stopPropagation()}>
        <div className="keyboard-header">
          <div className="keyboard-display">{currentValue || '0'}</div>
          <button 
            type="button"
            className="keyboard-close" 
            onClick={handleClose}
            title="Close (ESC)"
          >
            ✕
          </button>
        </div>
        <div className="keyboard-grid">
          {keys.map((key, index) => (
            <button
              key={index}
              type="button"
              className={`keyboard-key ${key === '⌫' ? 'backspace' : ''} ${key === '.' ? 'decimal' : ''}`}
              onClick={() => handleKeyPress(key)}
              title={key === '⌫' ? 'Backspace' : key === '.' ? 'Decimal point' : key}
            >
              {key}
            </button>
          ))}
          <button 
            type="button" 
            className="keyboard-key clear" 
            onClick={() => handleKeyPress('C')}
            title="Clear all"
          >
            C
          </button>
          <button 
            type="button" 
            className="keyboard-key enter" 
            onClick={() => handleKeyPress('Enter')}
            title="Confirm and close"
          >
            ✓
          </button>
        </div>
        <div className="keyboard-hint">
          Click outside or press ESC to close
        </div>
      </div>
    </div>
  );
};

export default NumericKeyboard;
