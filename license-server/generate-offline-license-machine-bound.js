#!/usr/bin/env node

/**
 * OFFLINE-ONLY License Generator with Machine Binding
 * Generates .lic files that work only on the machine where first activated
 * 
 * Usage: 
 *   node generate-offline-license-machine-bound.js [months] [machine_id]
 *   
 * Examples:
 *   node generate-offline-license-machine-bound.js 12                    # 12 months, any machine
 *   node generate-offline-license-machine-bound.js 0                     # Unlimited, any machine
 *   node generate-offline-license-machine-bound.js unlimited             # Unlimited, any machine
 *   node generate-offline-license-machine-bound.js 12 AABBCCDDEEFF       # 12 months, specific machine
 *   
 * Machine Binding:
 *   - If machine_id NOT provided: License can be activated on ANY machine
 *     BUT once activated, it's LOCKED to that machine forever
 *   - If machine_id provided: License can ONLY be activated on that specific machine
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bright: '\x1b[1m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

// Generate license key
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const parts = [];
  
  for (let i = 0; i < 5; i++) {
    let part = '';
    for (let j = 0; j < 5; j++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(part);
  }
  
  return parts.join('-');
}

// Sign payload with RSA private key
function signPayload(payload, privateKeyPath) {
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Private key not found: ${privateKeyPath}`);
  }
  
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(Buffer.from(payload, 'utf8'));
  sign.end();
  
  return sign.sign(privateKey, 'base64');
}

// Generate offline license
function generateOfflineLicense(validityMonths = 12, machineId = null) {
  console.log('\n' + '='.repeat(80));
  log('🔐 OFFLINE-ONLY LICENSE GENERATOR (MACHINE BOUND)', colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
  
  // 1. Generate license key
  const licenseKey = generateLicenseKey();
  log(`1️⃣  License Key: ${licenseKey}`, colors.green);
  
  // 2. Create payload
  const isUnlimited = validityMonths === 0 || validityMonths === 'unlimited';
  const expiryDate = isUnlimited ? new Date('2099-12-31T23:59:59.999Z') : new Date();
  
  if (!isUnlimited) {
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths);
  }
  
  const payload = {
    license_key: licenseKey,
    expire_at: expiryDate.toISOString(),
    max_devices: 1, // Always 1 device
    created_at: new Date().toISOString(),
    unlimited: isUnlimited,
    offline_only: true // Mark as offline-only license
  };
  
  // Add machine binding if specified
  function normalizeId(id) {
    if (!id) return null;
    return id.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  if (machineId) {
    payload.machine_id = normalizeId(machineId);
    log(`\n🔒 Machine Binding: ${payload.machine_id}`, colors.yellow);
    log(`   This license will ONLY work on this specific machine`, colors.yellow);
  } else {
    log(`\n🔓 Machine Binding: DYNAMIC`, colors.cyan);
    log(`   License will bind to the first machine it's activated on`, colors.cyan);
  }
  
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  
  log(`\n2️⃣  Payload created:`, colors.cyan);
  if (isUnlimited) {
    log(`    Expires: NEVER (unlimited) ♾️`, colors.green);
    log(`    Validity: UNLIMITED`, colors.green);
  } else {
    log(`    Expires: ${expiryDate.toLocaleDateString('en-US')}`, colors.cyan);
    log(`    Validity: ${validityMonths} months`, colors.cyan);
  }
  log(`    Max Devices: 1 (machine locked)`, colors.cyan);
  
  // 3. Find private key
  const privateKeyPaths = [
    path.join(__dirname, 'config', 'private_key.pem'),
    path.join(__dirname, '..', 'electron', 'private_key.pem'),
    path.join(__dirname, '..', 'config', 'private_key.pem'),
    'private_key.pem'
  ];
  
  let privateKeyPath = null;
  for (const keyPath of privateKeyPaths) {
    if (fs.existsSync(keyPath)) {
      privateKeyPath = keyPath;
      break;
    }
  }
  
  if (!privateKeyPath) {
    log(`\n⚠️  PRIVATE KEY NOT FOUND`, colors.red);
    log(`\nGenerate it first:`, colors.yellow);
    log(`  cd config`, colors.cyan);
    log(`  ./generate-keys-complete.sh\n`, colors.cyan);
    process.exit(1);
  }
  
  // 4. Sign the payload
  let signature;
  try {
    signature = signPayload(JSON.stringify(payload), privateKeyPath);
    log(`\n3️⃣  RSA Signature generated`, colors.green);
    log(`    Private key: ${path.basename(privateKeyPath)}`, colors.cyan);
  } catch (error) {
    log(`\n❌ Signature error: ${error.message}`, colors.red);
    process.exit(1);
  }
  
  // 5. Create .lic file
  const licenseFile = {
    license_key: licenseKey,
    payload: payloadBase64,
    signature: signature,
    expire_at: expiryDate.toISOString(),
    max_devices: 1,
    offline_only: true,
    created_at: new Date().toISOString()
  };
  
  // Add machine_id to file if pre-bound
  if (machineId) {
    licenseFile.machine_id = payload.machine_id;
  }
  
  const filename = `license-${licenseKey}.lic`;
  const filepath = path.join(__dirname, 'licenses', filename);
  
  // Create directory if needed
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(licenseFile, null, 2));
  
  log(`\n4️⃣  File created: ${filename}`, colors.green);
  log(`    Location: ${filepath}`, colors.cyan);
  
  // 6. Instructions
  console.log('\n' + '='.repeat(80));
  log('📋 CLIENT INSTRUCTIONS', colors.bright + colors.cyan);
  console.log('='.repeat(80));
  
  console.log('\n🔌 OFFLINE ACTIVATION (No Internet Required):');
  log('   1. Send this file to client: ' + filename, colors.cyan);
  log('   2. Client opens the application', colors.cyan);
  log('   3. Click "📄 Use license file"', colors.cyan);
  log('   4. Select the .lic file', colors.cyan);
  log('   5. ✅ Activation successful - OFFLINE!', colors.green);
  
  if (machineId) {
    console.log('\n🔒 PRE-BOUND LICENSE:');
    log(`   ⚠️  This license ONLY works on machine: ${payload.machine_id}`, colors.yellow);
    log('   ⚠️  Cannot be transferred to another machine', colors.yellow);
  } else {
    console.log('\n🔓 DYNAMIC BINDING:');
    log('   • First activation: Works on ANY machine', colors.cyan);
    log('   • After activation: LOCKED to that machine forever', colors.cyan);
    log('   • Cannot be copied or moved to another machine', colors.cyan);
  }
  
  console.log('\n' + '='.repeat(80));
  log('✅ SUMMARY', colors.bright + colors.green);
  console.log('='.repeat(80));
  
  log(`\nLicense Key: ${licenseKey}`, colors.green);
  log(`Offline File: ${filename}`, colors.cyan);
  if (isUnlimited) {
    log(`Expires: NEVER (unlimited) ♾️`, colors.green);
  } else {
    log(`Expires: ${expiryDate.toLocaleDateString('en-US')}`, colors.cyan);
  }
  log(`Machine Binding: ${machineId ? payload.machine_id + ' (PRE-BOUND)' : 'DYNAMIC (binds on first use)'}`, colors.cyan);
  log(`Max Devices: 1`, colors.cyan);
  log(`Offline Only: YES ✅`, colors.green);
  
  console.log('\n🔐 SECURITY FEATURES:');
  log('   ✅ RSA-2048 signature verification', colors.green);
  log('   ✅ Machine binding (cannot be copied)', colors.green);
  log('   ✅ Single device limit enforced', colors.green);
  log('   ✅ Works completely offline', colors.green);
  log('   ✅ No internet validation needed', colors.green);
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
let validityMonths = 12;
let machineId = null;

if (args.length >= 1) {
  const arg1 = args[0];
  if (arg1 === 'unlimited' || arg1 === '0') {
    validityMonths = 0;
  } else if (!isNaN(parseInt(arg1))) {
    validityMonths = parseInt(arg1);
  }
}

if (args.length >= 2) {
  machineId = args[1];
}

generateOfflineLicense(validityMonths, machineId);
