#!/usr/bin/env node

/**
 * Get Machine ID (MAC Address) for License Binding
 * Run this on the target machine to get its unique identifier
 */

const os = require('os');

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

console.log('\n' + '='.repeat(60));
console.log('🔍 MACHINE ID DETECTOR');
console.log('='.repeat(60));

const machineId = getMacAddress();

if (machineId) {
  console.log('\n✅ Machine ID found:');
  console.log('\n   ' + machineId);
  console.log('\nFormatted with colons:');
  console.log('   ' + machineId.match(/.{2}/g).join(':'));
  
  console.log('\n📋 How to use:');
  console.log('   1. Copy this Machine ID');
  console.log('   2. Send it to your license administrator');
  console.log('   3. They will generate a license bound to this machine');
  
  console.log('\n💡 Command to generate license for this machine:');
  console.log('   node generate-offline-license-machine-bound.js 12 ' + machineId);
} else {
  console.log('\n❌ Could not detect machine ID');
  console.log('   No valid network interface found');
}

console.log('\n' + '='.repeat(60) + '\n');
