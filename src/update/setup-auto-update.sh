#!/bin/bash
# setup-auto-update.sh
# Quick setup script for auto-updates

echo "🚀 VendoPro Auto-Update Setup"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install electron-updater electron-log --save
npm install electron-builder --save-dev

echo ""
echo "✅ Dependencies installed"
echo ""

# Get GitHub info
echo "🔧 GitHub Configuration"
echo "----------------------"
read -p "Enter your GitHub username: " github_username
read -p "Enter your repository name: " repo_name

# Update package.json
echo ""
echo "📝 Updating package.json..."

# Create backup
cp package.json package.json.backup

# Update using node
node -e "
const fs = require('fs');
const pkg = require('./package.json');

pkg.build = pkg.build || {};
pkg.build.publish = [
  {
    provider: 'github',
    owner: '$github_username',
    repo: '$repo_name'
  }
];

if (!pkg.scripts) pkg.scripts = {};
pkg.scripts.publish = 'electron-builder --publish always';
pkg.scripts['publish:win'] = 'electron-builder --win --publish always';
pkg.scripts['publish:mac'] = 'electron-builder --mac --publish always';
pkg.scripts['publish:linux'] = 'electron-builder --linux --publish always';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "✅ package.json updated"
echo ""

# Update electron-auto-updater.js
echo "📝 Updating electron-auto-updater.js..."
if [ -f "electron-auto-updater.js" ]; then
    sed -i.bak "s/YOUR_GITHUB_USERNAME/$github_username/g" electron-auto-updater.js
    sed -i.bak "s/YOUR_REPO_NAME/$repo_name/g" electron-auto-updater.js
    echo "✅ electron-auto-updater.js updated"
else
    echo "⚠️  electron-auto-updater.js not found. Please update manually."
fi

echo ""
echo "🔑 GitHub Token Setup"
echo "--------------------"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Generate a new token (classic)"
echo "3. Select 'repo' scope"
echo "4. Copy the token"
echo ""
read -p "Enter your GitHub token: " -s github_token
echo ""

# Set environment variable
export GH_TOKEN="$github_token"

# Save to shell profile
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "export GH_TOKEN=\"$github_token\"" >> ~/.zshrc
    echo "✅ Token saved to ~/.zshrc"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "export GH_TOKEN=\"$github_token\"" >> ~/.bashrc
    echo "✅ Token saved to ~/.bashrc"
fi

echo ""
echo "✨ Setup Complete!"
echo "================="
echo ""
echo "Next steps:"
echo "1. Review the changes in package.json"
echo "2. Test build: npm run build"
echo "3. Publish: npm run publish"
echo ""
echo "📚 Read AUTO-UPDATE-SETUP-GUIDE.md for detailed instructions"
echo ""
