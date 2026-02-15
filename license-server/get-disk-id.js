#!/usr/bin/env node

/**
 * Get Disk Serial / Machine Disk ID (Windows focused)
 * Prints a clean identifier that can be used to generate a pre-bound .lic file.
 */

const child = require('child_process');
const os = require('os');

function getDiskIdWin() {
  try {
    // Try diskdrive serial
    const out = child.execSync('wmic diskdrive get SerialNumber').toString();
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const serial = lines[1].replace(/\s+/g, '').toUpperCase();
      if (serial) return serial;
    }
  } catch (e) {}
  try {
    const out2 = child.execSync('wmic bios get serialnumber').toString();
    const lines2 = out2.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines2.length >= 2) {
      const serial = lines2[1].replace(/\s+/g, '').toUpperCase();
      if (serial) return serial;
    }
  } catch (e) {}
  return null;
}

function getDiskId() {
  if (os.platform() === 'win32') return getDiskIdWin();
  try {
    const out = child.execSync("lsblk -o SERIAL -dn | head -n1").toString().trim();
    if (out) return out.replace(/\s+/g, '').toUpperCase();
  } catch (e) {}
  try {
    const out = child.execSync("ioreg -l | grep IOPlatformSerialNumber | awk '{print $4}'").toString().trim();
    if (out) return out.replace(/\"/g, '').replace(/\s+/g, '').toUpperCase();
  } catch (e) {}
  return null;
}

console.log('\n' + '='.repeat(60));
console.log('🔍 DISK ID DETECTOR');
console.log('='.repeat(60));

const id = getDiskId();
if (id) {
  console.log('\n✅ Disk ID found:');
  console.log('\n   ' + id);
  console.log('\n📋 How to use:');
  console.log('   1. Copy this ID and send it to your license administrator');
  console.log('   2. Administrator runs: node generate-offline-license-machine-bound.js 12 ' + id);
  console.log('   3. They send the produced .lic file to you for offline activation.');
} else {
  console.log('\n❌ Could not detect Disk ID on this machine');
}

console.log('\n' + '='.repeat(60) + '\n');
