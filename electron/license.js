// License utility for Electron (Node.js)
// Hybrid Online/Offline License Verification with RSA Signature

const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Load RSA public key for offline verification
const PUBLIC_KEY_PATH = path.join(__dirname, 'public_key.pem');
let PUBLIC_KEY = null;

try {
  if (fs.existsSync(PUBLIC_KEY_PATH)) {
    PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
  }
} catch (error) {
  console.error('❌ Failed to load public key:', error);
}

function getMacAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac.replace(/:/g, '').toUpperCase();
      }
    }
  }
  return null;
}

function normalizeId(id) {
  if (!id) return null;
  return id.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function getDiskId() {
  try {
    if (process.platform === 'win32') {
      try {
        const out = child_process_exec('wmic diskdrive get SerialNumber');
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length >= 2) return normalizeId(lines[1]);
      } catch (e) {}
      try {
        const out2 = child_process_exec('wmic bios get serialnumber');
        const lines2 = out2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines2.length >= 2) return normalizeId(lines2[1]);
      } catch (e) {}
    } else {
      try {
        const out = child_process_exec("lsblk -o SERIAL -dn | head -n1");
        if (out) return normalizeId(out.trim());
      } catch (e) {}
      try {
        const out = child_process_exec("ioreg -l | grep IOPlatformSerialNumber | awk '{print $4}'");
        if (out) return normalizeId(out.replace(/\"/g, '').trim());
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

function child_process_exec(cmd) {
  const child = require('child_process');
  return child.execSync(cmd).toString();
}

function getMachineId() {
  // Prefer disk id when available, fallback to MAC
  const disk = getDiskId();
  if (disk) return disk;
  return normalizeId(getMacAddress());
}

// Generate a simple license key format (for backward compatibility)
function generateLicenseKey(mac) {
  const hash = crypto.createHash('sha256').update(mac).digest('hex').toUpperCase();
  return hash.slice(0, 4) + '-' + hash.slice(4, 8) + '-' + hash.slice(8, 12) + '-' + hash.slice(12, 16);
}

// Verify RSA signature (offline mode)
function verifySignatureOffline(payload, signature) {
  if (!PUBLIC_KEY) {
    console.error('❌ Public key not loaded');
    return false;
  }
  
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(Buffer.from(payload, 'base64'));
    verify.end();
    return verify.verify(PUBLIC_KEY, signature, 'base64');
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// OFFLINE ONLY - No online activation

// OFFLINE-ONLY activation with STRICT machine binding
function activateOffline(licenseData, isFirstActivation = false) {
  try {
    const { license_key, payload, signature, machine_id, expire_at } = licenseData;
    
    if (!payload || !signature) {
      return { success: false, error: 'License data incomplete (missing payload or signature)' };
    }

    // Verify RSA signature
    const signatureValid = verifySignatureOffline(payload, signature);
    
    if (!signatureValid) {
      return { success: false, error: 'Invalid license signature - License file may be corrupted or tampered' };
    }

    // Decode payload to check expiration and machine binding
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    
    // Check expiration
    if (decodedPayload.expire_at) {
      const expiryDate = new Date(decodedPayload.expire_at);
      if (expiryDate < new Date()) {
        return { success: false, error: 'License expired' };
      }
    }

    // STRICT Machine binding check (normalize both sides)
    const normalizedPassedId = normalizeId(machine_id);
    const normalizedPayloadId = decodedPayload.machine_id ? normalizeId(decodedPayload.machine_id) : null;

    // If license was previously activated, machine_id MUST match
    if (normalizedPayloadId) {
      if (normalizedPayloadId !== normalizedPassedId) {
        // Log only the current machine id to avoid revealing the bound machine id in logs/UI
        console.log('❌ Machine ID mismatch — current:', normalizedPassedId);
        return { 
          success: false, 
          error: `License is bound to another machine. This license can only be used on the machine where it was first activated.`
        };
      }
    }
    // If first activation and payload doesn't have machine_id, bind it now
    else if (isFirstActivation) {
      decodedPayload.machine_id = normalizedPassedId;
    }

    return {
      success: true,
      mode: 'offline',
      data: {
        license_key,
        expire_at: decodedPayload.expire_at || expire_at,
        machine_id,
        max_devices: 1 // Enforce single device
      }
    };
  } catch (error) {
    return { success: false, error: `Offline activation error: ${error.message}` };
  }
}

// OFFLINE-ONLY activation - No internet required
async function activateLicense(licenseKey, machineId, licenseData = null, isFirstActivation = false) {
  console.log('🔑 Starting OFFLINE-ONLY license activation...');
  console.log('📍 Machine ID:', machineId);
  
  if (!licenseData || !licenseData.payload || !licenseData.signature) {
    return {
      success: false,
      error: 'License file (.lic) required for activation. Please import a valid .lic file.',
      mode: 'offline_failed'
    };
  }
  
  const offlineResult = activateOffline({ ...licenseData, machine_id: machineId }, isFirstActivation);
  
  if (offlineResult.success) {
    console.log('✅ Offline activation successful');
    console.log('🔒 License bound to this machine');
  } else {
    console.log('❌ Offline activation failed:', offlineResult.error);
  }
  
  return offlineResult;
}

// OFFLINE-ONLY: No periodic online validation
// License is validated only at startup using local signature verification

module.exports = {
  getMacAddress,
  getDiskId,
  getMachineId,
  normalizeId,
  generateLicenseKey,
  activateLicense,
  activateOffline,
  verifySignatureOffline
};
