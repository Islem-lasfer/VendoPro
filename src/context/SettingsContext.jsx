import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

const defaultSettings = {
  theme: 'dark',
  primaryColor: '#ff6600', // Default orange
  taxRate: 10,
  discountRate: 0,
  posName: 'POS',
  posLogo: '',
  shopAddress: '',
  taxId: '',
  currency: 'USD',
  categories: ['miscellaneous'], // Default includes invariant 'miscellaneous' category (localized in UI)
  enableNumericKeyboard: false // Default disabled
};

export const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'DZD', symbol: 'د.ج', name: 'Algerian Dinar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' },
  { code: 'TND', symbol: 'د.ت', name: 'Tunisian Dinar' }
];

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('posSettings');
    const initial = saved ? JSON.parse(saved) : defaultSettings;

    // Ensure 'miscellaneous' category is always present (invariant stored key)
    initial.categories = Array.isArray(initial.categories)
      ? Array.from(new Set(['miscellaneous', ...initial.categories]))
      : ['miscellaneous'];

    // Ensure new keys have safe defaults
    return {
      receiptPrinter: initial.receiptPrinter || null,
      barcodePrinter: initial.barcodePrinter || null,
      printDialogOnPrint: initial.printDialogOnPrint || false,
      ...initial
    };
  });

  // Apply theme and colors immediately on mount
  useEffect(() => {
    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
      } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      }
    };

    const applyColor = (color) => {
      if (color) {
        document.documentElement.style.setProperty('--primary-color', color);
        // Calculate hover color (lighter version)
        const rgb = hexToRgb(color);
        if (rgb) {
          const hoverColor = `rgb(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)})`;
          document.documentElement.style.setProperty('--primary-hover', hoverColor);
        }
      }
    };

    // Apply theme immediately
    applyTheme(settings.theme);
    applyColor(settings.primaryColor);
    
    // Save to localStorage
    localStorage.setItem('posSettings', JSON.stringify(settings));
  }, [settings]);

  // Helper function to convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Dispatch event to notify components about settings change
      setTimeout(() => {
        window.dispatchEvent(new Event('settingsUpdated'));
      }, 0);
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
