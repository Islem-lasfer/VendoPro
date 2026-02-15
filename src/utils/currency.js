import { currencies } from '../context/SettingsContext';

/**
 * Format a number as currency based on the selected currency code
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - Currency code (USD, EUR, DZD, etc.)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode = 'USD') => {
  const currency = currencies.find(c => c.code === currencyCode);
  if (!currency) {
    return `${amount.toFixed(2)}`;
  }
  const formattedAmount = amount.toFixed(2);
  // Always show price first, then symbol
  return `${formattedAmount} ${currency.symbol}`;
};

/**
 * Get currency symbol for a given currency code
 * @param {string} currencyCode - Currency code (USD, EUR, DZD, etc.)
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (currencyCode = 'USD') => {
  const currency = currencies.find(c => c.code === currencyCode);
  return currency ? currency.symbol : '$';
};
