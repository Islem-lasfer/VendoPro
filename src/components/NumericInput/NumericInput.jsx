import React, { useState, useEffect } from 'react';
import NumericKeyboard from '../NumericKeyboard/NumericKeyboard';
import './NumericInput.css';

const NumericInput = ({ 
  value, 
  onChange, 
  placeholder = '',
  className = '',
  min,
  max,
  step,
  disabled = false,
  readOnly = false,
  id,
  name,
  onBlur,
  onFocus,
  style
}) => {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardValue, setKeyboardValue] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if keyboard is enabled on mount and when settings change
  useEffect(() => {
    const checkSettings = () => {
      const settings = JSON.parse(localStorage.getItem('posSettings') || '{}');
      setIsEnabled(settings.enableNumericKeyboard === true);
    };
    
    checkSettings();
    
    // Listen for storage changes
    window.addEventListener('storage', checkSettings);
    
    // Also create a custom event listener for same-window updates
    const handleSettingsUpdate = () => {
      checkSettings();
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('storage', checkSettings);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  const handleInputClick = (e) => {
    if (isEnabled && !disabled && !readOnly) {
      // allow native focus so typing replaces the selected value; still show the on-screen keyboard
      setKeyboardValue(''); // Start with empty value
      setShowKeyboard(true);
      if (onFocus) onFocus(e);
    }
  };

  const handleKeyPress = (key) => {
    setKeyboardValue(prev => {
      let newValue = prev;
      
      if (key === '⌫') {
        newValue = prev.slice(0, -1);
      } else if (key === 'C') {
        newValue = '';
      } else if (key === 'Enter') {
        // Validate and apply
        const numValue = parseFloat(newValue) || 0;
        
        // Check min/max constraints
        let finalValue = numValue;
        if (min !== undefined && finalValue < min) finalValue = min;
        if (max !== undefined && finalValue > max) finalValue = max;
        
        if (onChange) {
          onChange({ target: { value: finalValue, name } });
        }
        setShowKeyboard(false);
        return prev;
      } else if (key === '.') {
        if (!prev.includes('.')) {
          newValue = prev + key;
        }
      } else {
        newValue = prev + key;
      }
      
      return newValue;
    });
  };

  const handleClose = () => {
    setShowKeyboard(false);
    setKeyboardValue(''); // Clear keyboard value on close
    if (onBlur) {
      onBlur({ target: { value, name } });
    }
  };

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        value={value}
        onChange={onChange}
        onClick={handleInputClick}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`numeric-input ${className}`}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        readOnly={readOnly}
        id={id}
        name={name}
        style={style}
      />
      
      {showKeyboard && isEnabled && (
        <NumericKeyboard
          currentValue={keyboardValue}
          onKeyPress={handleKeyPress}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default NumericInput;
