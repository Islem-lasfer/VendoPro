#!/usr/bin/env node

/**
 * Verify a .lic file is bound to a given Disk ID (normalized comparison)
 * Usage:
 *   node verify-license-for-disk.js <path/to/license-file.lic> <diskId>
 * Example:
 *   node verify-license-for-disk.js licenses/license-ABC12.lic 9213481f-c01a-488f-9f09-c09d995856d4
 */

const fs = require('fs');
const path = require('path');

function normalizeId(id) {
  if (!id) return null;
  return id.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function usage() {
  console.log('Usage: node verify-license-for-disk.js <license-file> <disk-id>');
  process.exit(1);
}

const [,, licPath, diskIdArg] = process.argv;
if (!licPath || !diskIdArg) usage();

const absPath = path.isAbsolute(licPath) ? licPath : path.join(__dirname, licPath);
if (!fs.existsSync(absPath)) {
  console.error('❌ License file not found:', absPath);
  process.exit(2);
}

let lic;
try {
  lic = JSON.parse(fs.readFileSync(absPath, 'utf8'));
} catch (err) {
  console.error('❌ Failed to parse license file:', err.message);
  process.exit(2);
}

const payloadBase64 = lic.payload || lic.payload || null;
if (!payloadBase64) {
  console.error('❌ No payload found in license file');
  process.exit(2);
}

let decoded;
try {
  decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
} catch (err) {
  console.error('❌ Failed to decode payload:', err.message);
  process.exit(2);
}

const fileMachine = decoded.machine_id || lic.machine_id || null;
const normalizedFile = normalizeId(fileMachine);
const normalizedInput = normalizeId(diskIdArg);

console.log('\nLicense file: ', absPath);
console.log('  license_key: ', lic.license_key || lic.key || '(none)');
console.log('  expire_at:   ', lic.expire_at || decoded.expire_at || '(none)');
console.log('\nDetected machine in file (normalized):', normalizedFile);
console.log('Provided machine id (normalized):      ', normalizedInput);

if (!normalizedFile) {
  console.log('\n⚠️  License file is not pre-bound to a machine (dynamic binding). It will bind on first activation.');
  process.exit(0);
}

if (normalizedFile === normalizedInput) {
  console.log('\n✅ MATCH — This license is bound to the provided Disk ID.');
  process.exit(0);
} else {
  console.log('\n❌ MISMATCH — License bound to a different machine.');
  process.exit(3);
}
