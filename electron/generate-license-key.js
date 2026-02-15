// Script to generate and save license key for current machine
const fs = require('fs');
const path = require('path');
const license = require('./license');

const id = license.getMachineId();
if (!id) {
  console.error('Machine ID not found.');
  process.exit(1);
}

const key = license.generateLicenseKey(id);
const licensePath = path.join(__dirname, 'license.key');
fs.writeFileSync(licensePath, key);
console.log('License key generated and saved to license.key:', key);
