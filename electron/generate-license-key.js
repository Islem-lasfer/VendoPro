// Script to generate and save license key for current machine
const fs = require('fs');
const path = require('path');
const license = require('./license');

const mac = license.getMacAddress();
if (!mac) {
  console.error('MAC address not found. Make sure you are connected to a network.');
  process.exit(1);
}

const key = license.generateLicenseKey(mac);
const licensePath = path.join(__dirname, 'license.key');
fs.writeFileSync(licensePath, key);
console.log('License key generated and saved to license.key:', key);
