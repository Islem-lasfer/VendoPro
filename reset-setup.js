// Reset Setup Script
// Run this with: node reset-setup.js

const fs = require('fs');
const path = require('path');

console.log('🔄 Resetting POS to first-time setup...\n');

// Clear localStorage by removing Electron's data files
const appName = 'VendoPro'; // Adjust if your app has a different name
const userDataPaths = [
  path.join(process.env.APPDATA, appName, 'Local Storage'),
  path.join(process.env.APPDATA, appName, 'Session Storage'),
  path.join(process.env.LOCALAPPDATA, appName, 'Local Storage'),
  path.join(process.env.LOCALAPPDATA, appName, 'Session Storage'),
];

let cleared = false;

userDataPaths.forEach(dataPath => {
  if (fs.existsSync(dataPath)) {
    try {
      fs.rmSync(dataPath, { recursive: true, force: true });
      console.log(`✅ Cleared: ${dataPath}`);
      cleared = true;
    } catch (err) {
      console.log(`⚠️  Could not clear: ${dataPath}`);
    }
  }
});

if (!cleared) {
  console.log('ℹ️  No cached data found - app will show setup on next launch');
}

console.log('\n✨ Reset complete! Launch the app to see the first-time setup wizard.\n');
console.log('📝 Note: If setup still doesn\'t appear, open DevTools (F12) and run:');
console.log('   localStorage.clear()');
console.log('   Then refresh the app (Ctrl+R)\n');
