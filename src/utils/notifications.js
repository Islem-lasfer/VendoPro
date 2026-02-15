// Simple notification bridge for non-React code to trigger app-level toasts
export const notify = (message, type = 'info') => {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const ev = new CustomEvent('app-notification', { detail: { message, type } });
      window.dispatchEvent(ev);
      return;
    }
  } catch (e) {
    // ignore
  }
  // Fallback: log to console
  console.log(`[NOTIFY ${type}] ${message}`);
};

export default { notify };
