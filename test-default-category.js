#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('✖', msg);
  process.exit(1);
}

const ctxPath = path.join(__dirname, 'src', 'context', 'SettingsContext.jsx');
if (!fs.existsSync(ctxPath)) fail('SettingsContext.jsx not found');
const src = fs.readFileSync(ctxPath, 'utf8');

if (!/categories:\s*\['miscellaneous'\]/.test(src)) {
  fail("defaultSettings.categories does not include 'miscellaneous'");
}

if (!/Array\.from\(new Set\(\['miscellaneous',\s*\.\.\.initial\.categories\]\)\)/.test(src)) {
  fail("SettingsContext initializer does not ensure 'miscellaneous' is always present");
}

console.log('✅ Default category `miscellaneous` present and enforced in SettingsContext.jsx');
process.exit(0);
