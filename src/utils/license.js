// Provide a default export for ES module compatibility
// --- License utility for frontend (browser/Electron) ---
// This logic matches the backend: generateLicenseKey(mac) and validateLicenseKey(key, mac)

function getMachineId() {
  // Prefer disk ID when available, otherwise fall back to node-machine-id
  if (typeof window !== 'undefined' && window.require) {
    try {
      // Use node-machine-id as a safe fallback
      const { machineIdSync } = window.require('node-machine-id');
      return machineIdSync({ original: true });
    } catch {
      return 'UNKNOWN-ELECTRON-ID';
    }
  }
  // In browser/dev: use a static string for testing only
  return 'BROWSER-MOCK-ID';
}

function normalizeId(id) {
  if (!id) return null;
  return id.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function getDiskId() {
  // Try to read a disk/machine serial on the client (Windows-first implementation)
  if (typeof window !== 'undefined' && window.require) {
    try {
      const child = window.require('child_process');
      const os = window.require('os');
      if (os.platform() === 'win32') {
        // Try common WMIC commands to get a consistent serial
        try {
          const out = child.execSync('wmic diskdrive get SerialNumber').toString();
          const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            // Take the first non-empty serial
            const serial = lines[1].replace(/\s+/g, '');
            if (serial) return normalizeId(serial);
          }
        } catch (e) {
          // ignore and try BIOS serial
        }
        try {
          const out2 = child.execSync('wmic bios get serialnumber').toString();
          const lines2 = out2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines2.length >= 2) {
            const serial = lines2[1].replace(/\s+/g, '');
            if (serial) return normalizeId(serial);
          }
        } catch (e) {
          // fallback
        }
      } else {
        // Try Linux / Mac heuristics (lsblk or ioreg)
        try {
          const out = child.execSync("lsblk -o SERIAL -dn | head -n1").toString().trim();
          if (out) return normalizeId(out);
        } catch {}
        try {
          const out = child.execSync("ioreg -l | grep IOPlatformSerialNumber | awk '{print $4}'").toString().trim();
          if (out) return normalizeId(out.replace(/\"/g, '').trim());
        } catch {}
      }
    } catch (err) {
      // ignore and fallback
    }
  }
  // Fallback to machineId if disk id not available
  return normalizeId(getMachineId());
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
  getDiskId,
  normalizeId,
  verifyLicenseKey,
  storeActivation,
  loadActivation
};

export default licenseUtil;
  