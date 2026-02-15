/**
 * Dialog Utility for Electron Apps
 * Provides proper focus management when showing message boxes
 */

/**
 * Show an information message box
 * @param {string} message - The message to display
 * @param {string} title - The dialog title (optional)
 * @returns {Promise<void>}
 */
export const showInfo = async (message, title = 'Information') => {
  if (window.electron?.ipcRenderer) {
    await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'info',
      buttons: ['OK'],
      title: title,
      message: message
    });
  } else {
    // Browser fallback: dispatch app-notification event
    try { window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type: 'info' } })); } catch (e) { console.log(message); }
  }
};

/**
 * Show a success message box
 * @param {string} message - The message to display
 * @param {string} title - The dialog title (optional)
 * @returns {Promise<void>}
 */
export const showSuccess = async (message, title = 'Success') => {
  if (window.electron?.ipcRenderer) {
    await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'info',
      buttons: ['OK'],
      title: title,
      message: message
    });
  } else {
    // Browser fallback: dispatch app-notification event (success)
    try { window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type: 'success' } })); } catch (e) { console.log(message); }
  }
};

/**
 * Show a warning message box
 * @param {string} message - The message to display
 * @param {string} title - The dialog title (optional)
 * @returns {Promise<void>}
 */
export const showWarning = async (message, title = 'Warning') => {
  if (window.electron?.ipcRenderer) {
    await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'warning',
      buttons: ['OK'],
      title: title,
      message: message
    });
  } else {
    // Browser fallback: dispatch app-notification event (warning)
    try { window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type: 'warning' } })); } catch (e) { console.log(message); }
  }
};

/**
 * Show an error message box
 * @param {string} message - The message to display
 * @param {string} title - The dialog title (optional)
 * @returns {Promise<void>}
 */
export const showError = async (message, title = 'Error') => {
  if (window.electron?.ipcRenderer) {
    await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'error',
      buttons: ['OK'],
      title: title,
      message: message
    });
  } else {
    // Browser fallback: dispatch app-notification event (error)
    try { window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type: 'error' } })); } catch (e) { console.log(message); }
  }
};

/**
 * Show a confirmation dialog
 * @param {string} message - The question to ask
 * @param {string} title - The dialog title (optional)
 * @param {Object} options - Additional options
 * @param {string[]} options.buttons - Custom button labels [yes, no] (optional)
 * @returns {Promise<boolean>} - true if user clicked Yes/OK, false otherwise
 */
export const showConfirm = async (message, title = 'Confirm', options = {}) => {
  const buttons = options.buttons || ['Yes', 'No'];
  
  if (window.electron?.ipcRenderer) {
    const result = await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'question',
      buttons: buttons,
      defaultId: 1,
      title: title,
      message: message
    });
    return result.response === 0; // First button (Yes) returns true
  } else {
    return window.confirm(message);
  }
};

/**
 * Show a question dialog with custom buttons
 * @param {string} message - The question to ask
 * @param {string} title - The dialog title
 * @param {string[]} buttons - Button labels
 * @returns {Promise<number>} - Index of the clicked button
 */
export const showQuestion = async (message, title = 'Question', buttons = ['OK', 'Cancel']) => {
  if (window.electron?.ipcRenderer) {
    const result = await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'question',
      buttons: buttons,
      defaultId: 1,
      title: title,
      message: message
    });
    return result.response;
  } else {
    // Fallback for browser - only supports confirm (2 buttons)
    const confirmed = window.confirm(message);
    return confirmed ? 0 : 1;
  }
};

export default {
  showInfo,
  showSuccess,
  showWarning,
  showError,
  showConfirm,
  showQuestion
};
