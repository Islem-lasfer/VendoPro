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

    // STRICT Machine binding check
    // If license was previously activated, machine_id MUST match
    if (decodedPayload.machine_id) {
      if (decodedPayload.machine_id !== machine_id) {
        return { 
          success: false, 
          error: `License is bound to another machine. This license can only be used on the machine where it was first activated.`
        };
      }
    }
    // If first activation and payload doesn't have machine_id, bind it now
    else if (isFirstActivation) {
      decodedPayload.machine_id = machine_id;
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
  generateLicenseKey,
  activateLicense,
  activateOffline,
  verifySignatureOffline
};
