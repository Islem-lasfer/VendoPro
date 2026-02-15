import { useState, useCallback, useEffect } from 'react';

export const useNumericKeyboard = (onValueChange) => {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardValue, setKeyboardValue] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if numeric keyboard is enabled in settings
  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('posSettings') || '{}');
    setIsEnabled(settings.enableNumericKeyboard === true);
  }, []);

  const openKeyboard = useCallback((initialValue = '') => {
    const settings = JSON.parse(localStorage.getItem('posSettings') || '{}');
    if (settings.enableNumericKeyboard === true) {
      setKeyboardValue(initialValue);
      setShowKeyboard(true);
    }
  }, []);

  const closeKeyboard = useCallback(() => {
    setShowKeyboard(false);
  }, []);

  const handleKeyPress = useCallback((key) => {
    setKeyboardValue(prev => {
      let newValue = prev;
      
      if (key === '⌫') {
        // Backspace
        newValue = prev.slice(0, -1);
      } else if (key === 'C') {
        // Clear
        newValue = '';
      } else if (key === 'Enter') {
        // Confirm
        if (onValueChange) {
          onValueChange(prev);
        }
        setShowKeyboard(false);
        return prev;
      } else if (key === '.') {
        // Only allow one decimal point
        if (!prev.includes('.')) {
          newValue = prev + key;
        }
      } else {
        // Number key
        newValue = prev + key;
      }
      
      if (onValueChange) {
        onValueChange(newValue);
      }
      
      return newValue;
    });
  }, [onValueChange]);

  return {
    showKeyboard,
    keyboardValue,
    isEnabled,
    openKeyboard,
    closeKeyboard,
    handleKeyPress
  };
};

export default useNumericKeyboard;
