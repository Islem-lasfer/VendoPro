# 🚀 Auto-Update Setup Guide for VendoPro

This guide will help you set up automatic updates for your Electron app using GitHub releases.

## 📋 Prerequisites

1. GitHub account
2. GitHub repository (public or private)
3. Node.js and npm installed
4. GitHub Personal Access Token (for publishing)

---

## 🔧 Step 1: Install Dependencies

```bash
npm install electron-updater electron-log --save
npm install electron-builder --save-dev
```

---

## 📝 Step 2: Update package.json

Add the following configuration to your `package.json`:

```json
{
  "name": "vendopro",
  "version": "1.0.0",
  "build": {
    "appId": "com.yourcompany.vendopro",
    "productName": "VendoPro",
    "publish": [
      {
        "provider": "github",
        "owner": "YOUR_GITHUB_USERNAME",
        "repo": "YOUR_REPO_NAME"
      }
    ]
  }
}
```

**Replace:**
- `YOUR_GITHUB_USERNAME` with your GitHub username
- `YOUR_REPO_NAME` with your repository name

---

## 🔑 Step 3: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Name it: "VendoPro Release Token"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:packages` (Upload packages)
5. Generate token and **copy it immediately** (you won't see it again)

---

## 💻 Step 4: Set Environment Variable

### Windows:
```cmd
setx GH_TOKEN "your_github_token_here"
```

### macOS/Linux:
```bash
export GH_TOKEN="your_github_token_here"
```

**For permanent setup**, add to your `.bashrc`, `.zshrc`, or system environment variables.

---

## 📦 Step 5: Configure electron-auto-updater.js

Edit `electron-auto-updater.js` and update:

```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'YOUR_GITHUB_USERNAME',    // ← Change this
  repo: 'YOUR_REPO_NAME',           // ← Change this
  private: false                    // Set to true if private repo
});
```

---

## 🏗️ Step 6: Build and Publish

### Build Only (Local):
```bash
npm run build              # All platforms
npm run build:win          # Windows only
npm run build:mac          # macOS only
npm run build:linux        # Linux only
```

### Build and Publish to GitHub:
```bash
npm run publish            # All platforms
npm run publish:win        # Windows only
npm run publish:mac        # macOS only
npm run publish:linux      # Linux only
```

This will:
1. Build your app
2. Create installers
3. Create a GitHub release
4. Upload installers to the release

---

## 🌐 Step 7: Version Management

### Updating Version Number:

Update version in `package.json`:
```json
{
  "version": "1.0.1"  // Increment version
}
```

### Publishing a New Version:

```bash
# 1. Update version in package.json
# 2. Commit changes
git add .
git commit -m "Version 1.0.1"
git push

# 3. Build and publish
npm run publish
```

---

## ✅ Step 8: Test Auto-Updates

### Testing Locally:

1. **Install v1.0.0** on a test machine
2. **Publish v1.0.1** to GitHub
3. **Open the app** - it should detect the update
4. **Download and install** the update

### Manual Update Check:

Add a button in your app:
```javascript
ipcRenderer.invoke('check-for-updates');
```

---

## 🎨 Step 9: Add Update UI to Your App

Add the `UpdateNotification` component to your main app:

```jsx
import UpdateNotification from './UpdateNotification';

function App() {
  return (
    <div className="app">
      <UpdateNotification />
      {/* Your other components */}
    </div>
  );
}
```

---

## 🔍 Monitoring Updates

### Check Logs:

**Development:**
```bash
# View console output
npm run dev
```

**Production:**
- Windows: `%APPDATA%\vendopro\logs\main.log`
- macOS: `~/Library/Logs/vendopro/main.log`
- Linux: `~/.config/vendopro/logs/main.log`

---

## 🚨 Troubleshooting

### Issue 1: "Update not found"
**Solution:** Ensure:
- GitHub release exists
- Release has draft=false
- Installer files are attached
- Version in release > installed version

### Issue 2: "GH_TOKEN not set"
**Solution:** 
```bash
# Verify token is set
echo $GH_TOKEN  # macOS/Linux
echo %GH_TOKEN%  # Windows
```

### Issue 3: "Code signing required" (macOS)
**Solution:** Add code signing:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

### Issue 4: "Updates work on dev machine but not production"
**Solution:** Ensure you're not running from source:
- Build and install the actual installer
- Updates only work in packaged apps

---

## 🌍 Multi-Region Deployment

### CDN Setup (Optional):
For faster downloads worldwide, consider:
1. **GitHub Releases** (Free, built-in)
2. **AWS CloudFront**
3. **Azure CDN**
4. **Cloudflare R2**

### Configuration:
```javascript
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://your-cdn.com/updates'
});
```

---

## 📱 Update Strategies

### Strategy 1: Silent Updates
```javascript
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
```

### Strategy 2: User Confirmation (Recommended)
```javascript
autoUpdater.autoDownload = false; // Ask before download
// Prompt user → download → prompt to install
```

### Strategy 3: Mandatory Updates
```javascript
// Force update if critical
if (criticalUpdate) {
  autoUpdater.downloadUpdate();
  // Don't allow app use until updated
}
```

---

## 🔐 Security Best Practices

1. **Code Signing:** Always sign your releases
   - Windows: Use a Code Signing Certificate
   - macOS: Use Apple Developer ID
   - Linux: Use GPG signatures

2. **HTTPS Only:** Ensure all update URLs use HTTPS

3. **Version Validation:** Verify semantic versioning

4. **Rollback Plan:** Keep previous versions available

---

## 📊 Release Checklist

Before publishing a new version:

- [ ] Version number incremented
- [ ] Changelog updated
- [ ] Tests passing
- [ ] Build successful locally
- [ ] Code signed (if applicable)
- [ ] Release notes written
- [ ] Backward compatibility checked
- [ ] Database migrations tested

---

## 🎯 Release Notes Template

```markdown
## 🎉 VendoPro v1.0.1

### ✨ New Features
- Added inventory management
- Multi-location support

### 🐛 Bug Fixes
- Fixed receipt printing issue
- Corrected tax calculation

### 🔧 Improvements
- Faster database queries
- Better error handling

### ⚠️ Breaking Changes
- None

### 📦 Dependencies
- Updated electron to 28.0.0
```

---

## 🤝 Support

For issues:
1. Check logs first
2. Review GitHub Issues
3. Contact: your.email@example.com

---

## 📚 Additional Resources

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Code Signing Guide](https://www.electron.build/code-signing)

---

## 🎉 You're All Set!

Your app now has professional auto-update functionality that works worldwide!

**Next steps:**
1. Test on all platforms
2. Set up CI/CD (GitHub Actions)
3. Monitor update metrics
4. Celebrate! 🎊
