// Provide a default export for ES module compatibility
// --- License utility for frontend (browser/Electron) ---
// This logic matches the backend: generateLicenseKey(mac) and validateLicenseKey(key, mac)

function getMachineId() {
  // In Electron, use node-machine-id or MAC address automatically
  if (typeof window !== 'undefined' && window.require) {
    try {
      const { machineIdSync } = window.require('node-machine-id');
      return machineIdSync({ original: true });
    } catch {
      return 'UNKNOWN-ELECTRON-ID';
    }
  }
  // In browser/dev: use a static string for testing only
  return 'BROWSER-MOCK-ID';
}

function generateLicenseKey(mac) {
  // Same as backend: sha256(mac), format XXXX-XXXX-XXXX-XXXX
  if (window.require) {
    const crypto = window.require('crypto');
    const hash = crypto.createHash('sha256').update(mac).digest('hex').toUpperCase();
    return (
      hash.slice(0, 4) + '-' + hash.slice(4, 8) + '-' + hash.slice(8, 12) + '-' + hash.slice(12, 16)
    );
  }
  // Browser: use a simple hash (not secure, but matches backend for dev)
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0').toUpperCase();
  }
  const hash = simpleHash(mac).repeat(4).slice(0, 16);
  return (
    hash.slice(0, 4) + '-' + hash.slice(4, 8) + '-' + hash.slice(8, 12) + '-' + hash.slice(12, 16)
  );
}

function verifyLicenseKey(key, mac) {
  return key === generateLicenseKey(mac);
}

function storeActivation(data) {
  localStorage.setItem('mockActivation', JSON.stringify(data));
}

async function loadActivation(machine_id) {
  const data = localStorage.getItem('mockActivation');
  return data ? JSON.parse(data) : null;
}

// Online validation: POST to your real API, expects { valid: true/false, used: true/false }
async function validateLicenseOnline(key, mac) {
  try {
    const res = await fetch('http://localhost:3000/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key, machine_id: mac })
    });
    const data = await res.json();
    return data;
  } catch {
    return { valid: false, error: 'Online validation failed' };
  }
}
const licenseUtil = {
  generateLicenseKey,
  validateLicenseOnline,
  getMachineId,
  verifyLicenseKey,
  storeActivation,
  loadActivation
};

export default licenseUtil;
  