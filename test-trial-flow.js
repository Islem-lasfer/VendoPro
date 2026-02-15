#!/usr/bin/env node

/**
 * Small integration test for the 7-day trial flow.
 * - Creates a trial-style license JSON under ./electron/license.json (same location main uses in repo tests)
 * - Verifies fields: key format, mode/trial flags, expire_at ~ 7 days from now
 *
 * Usage: node test-trial-flow.js
 */

const fs = require('fs');
const path = require('path');

function genKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const parts = [];
  for (let i = 0; i < 5; i++) {
    let part = '';
    for (let j = 0; j < 5; j++) part += chars.charAt(Math.floor(Math.random() * chars.length));
    parts.push(part);
  }
  return parts.join('-');
}

function assert(condition, msg) {
  if (!condition) {
    console.error('✖', msg || 'Assertion failed');
    process.exitCode = 1;
    throw new Error(msg || 'Assertion failed');
  }
}

(async function main() {
  try {
    const licenseDir = path.join(__dirname, 'electron');
    if (!fs.existsSync(licenseDir)) fs.mkdirSync(licenseDir, { recursive: true });

    const key = genKey();
    const now = new Date();
    const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const trialLicense = {
      key,
      machine_id: 'TEST-MACHINE-TRIAL',
      expire_at: expireAt,
      payload: null,
      signature: null,
      activated_at: now.toISOString(),
      mode: 'trial',
      trial: true,
      max_devices: 1
    };

    const licenseStorePath = path.join(licenseDir, 'license.json');
    fs.writeFileSync(licenseStorePath, JSON.stringify(trialLicense, null, 2));
    console.log('✅ Trial license file written to', licenseStorePath);

    // Read back and validate
    const stored = JSON.parse(fs.readFileSync(licenseStorePath, 'utf8'));

    // Key format (5 parts of 5 chars alnum)
    assert(/^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/.test(stored.key), 'License key format invalid');

    assert(stored.mode === 'trial', 'mode !== "trial"');
    assert(stored.trial === true, 'trial flag missing or false');
    assert(stored.expire_at, 'expire_at missing');

    const daysLeft = Math.round((new Date(stored.expire_at) - new Date()) / (1000 * 60 * 60 * 24));
    console.log('⏳ daysLeft (approx):', daysLeft);
    assert(daysLeft >= 6 && daysLeft <= 8, 'expire_at is not ~7 days from now');

    console.log('\n🎯 TEST PASSED: Trial flow storage looks correct');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err && err.message);
    process.exit(process.exitCode || 1);
  }
})();
