#!/usr/bin/env node
// scripts/check-gh-token.js
// Fail fast if GH_TOKEN/GITHUB_TOKEN is missing to avoid accidental publish attempts.
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token || !String(token).trim()) {
  console.error('\nERROR: GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN in your environment and try again.\n');
  process.exit(1);
}
console.log('GH token detected — proceeding.');
process.exit(0);
