#!/usr/bin/env node
// scripts/check-gh-access.js
// Verifies GH token is present and has access to the repository configured in package.json -> build.publish

const fs = require('fs');
const https = require('https');

function fail(msg) {
  console.error('\nERROR: ' + msg + '\n');
  process.exit(1);
}

// read token
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token || !String(token).trim()) {
  fail('GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN in your environment and try again.');
}

// read package.json publish config
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
} catch (err) {
  fail('Could not read package.json: ' + err.message);
}

const publish = pkg.build && pkg.build.publish && Array.isArray(pkg.build.publish) && pkg.build.publish[0];
if (!publish || !publish.owner || !publish.repo) {
  fail('Missing build.publish.owner/repo in package.json. electron-builder needs owner and repo set for GitHub publishing.');
}

const owner = publish.owner;
const repo = publish.repo;

console.log(`Checking access to GitHub repository: ${owner}/${repo} ...`);

const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}`,
  method: 'GET',
  headers: {
    'User-Agent': 'VendoPro-Publish-Check',
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${token}`
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('OK — token has access to the repository.');
      process.exit(0);
    }

    if (res.statusCode === 404) {
      // 404 commonly means repo not found or token lacks permission for private repo
      fail(`Repository not found or token does not have access (HTTP 404). Double-check owner/repo and token scopes.`);
    }

    if (res.statusCode === 401 || res.statusCode === 403) {
      fail(`Authentication failed (HTTP ${res.statusCode}). Ensure token is correct and has the required scopes (repo, write:packages).`);
    }

    fail(`Unexpected response from GitHub API (HTTP ${res.statusCode}). Response: ${body}`);
  });
});

req.on('error', (err) => {
  fail('Network error while checking GitHub repository: ' + err.message);
});

req.end();
