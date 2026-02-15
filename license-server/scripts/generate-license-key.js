// License Key Generator Script (Node.js)
// Usage: node generate-license-key.js <product_code> <expiry_days>
// Generates a license key and signature using RSA/ECDSA

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load private key (PEM format)
const PRIVATE_KEY_PATH = path.join(__dirname, '../config/private_key.pem');
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

function base32encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function generateLicenseKey(productCode, expiryDays) {
  const random = crypto.randomBytes(8);
  let expiry;
  if (expiryDays === 0 || expiryDays === 'unlimited' || expiryDays === undefined || expiryDays === null) {
    expiry = 0xFFFFFFFF; // Use max 32-bit unsigned int for unlimited
  } else {
    expiry = Math.floor(Date.now() / 1000) + expiryDays * 86400;
  }
  const payload = Buffer.concat([
    Buffer.from(productCode, 'utf8'),
    Buffer.alloc(4, 0), // reserved
    Buffer.from(random),
    Buffer.from(expiry.toString(16).padStart(8, '0'), 'hex')
  ]);
  const key = base32encode(payload).slice(0, 25).replace(/(.{5})/g, '$1-').slice(0, 29);
  return { key, payload };
}

function signLicense(payload) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(payload);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

if (require.main === module) {
  (async () => {
    const [,, productCode, expiryDays] = process.argv;
    if (!productCode) {
      console.error('Usage: node generate-license-key.js <product_code> <expiry_days|unlimited>');
      process.exit(1);
    }
    let days = expiryDays;
    if (expiryDays === 'unlimited') days = 0;
    const { key, payload } = generateLicenseKey(productCode, days ? parseInt(days, 10) : 0);
    const signature = signLicense(payload);
    console.log('License Key:', key);
    console.log('Signature:', signature);

    // Insert into MongoDB
    const uri = 'mongodb://lasferislem:94d7239F2400@localhost:27017/licenses?authSource=licenses';
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db('licenses');
      const licenses = db.collection('licenses');
      await licenses.insertOne({
        license_key: key,
        payload: payload.toString('base64'),
        signature: signature,
        status: 'unused',
        max_devices: 1,
        activation_count: 0
      });
      console.log('Inserted into MongoDB.');
    } catch (err) {
      console.error('MongoDB insert error:', err.message);
    } finally {
      await client.close();
    }
  })();
}

module.exports = { generateLicenseKey, signLicense };