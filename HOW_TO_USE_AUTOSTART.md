# 🚀 How to Use Auto-Start Server Feature

## ⚠️ IMPORTANT: You Must Use the Desktop App

The **auto-start server feature only works in the desktop (Electron) app**, not in the browser development mode.

---

## ✅ Quick Start (Recommended)

### Method 1: Use the Startup Script
**Double-click this file:** `START_POS_APP.bat`

This will:
- ✅ Install dependencies (first time only)
- ✅ Start the desktop app with full features
- ✅ Enable auto-start server functionality

---

### Method 2: Manual Start
Open terminal and run:
```bash
npm start
```

This starts the **packaged Electron app** (not the browser dev server).

---

## ❌ What NOT to Do

**DON'T use `npm run dev`** - This starts the browser version which:
- ❌ Cannot auto-start the server
- ❌ Shows "Not running in Electron environment" error
- ⚠️ You'll have to start server manually with `START_DATABASE_SERVER.bat`

---

## 📝 How to Use Auto-Start Feature

Once the desktop app is running:

### **On Server Computer:**
1. Go to **Network Settings**
2. Enable "Network Mode"
3. Check **"This machine is the server"** ✅
4. Set URL: `http://192.168.1.6:3001` (or your IP)
5. Click **"Save Settings"**
6. **Server starts automatically!** 🎉
7. You'll see: "🟢 Server running" under the server role option

### **On Client Computers:**
1. Go to **Network Settings**
2. Enable "Network Mode"
3. Leave "server" **unchecked** (client mode)
4. Set URL: `http://192.168.1.6:3001` (server's IP)
5. Click **"Save Settings"**
6. Connection established! ✅

---

## 🔍 Current Error Explained

The error you're seeing:
```
GET http://192.168.1.6:3001/health net::ERR_CONNECTION_REFUSED
Not running in Electron environment
```

This happens because:
1. ❌ You're using `npm run dev` (browser mode)
2. ❌ The database server is not running
3. ❌ Auto-start feature cannot work in browser mode

---

## ✅ Solution

**Use the desktop app instead:**

1. **Stop the current dev server** (Ctrl+C in terminal)

2. **Start the desktop app:**
   - Double-click `START_POS_APP.bat`
   - OR run `npm start` in terminal

3. **In the desktop app**, go to Network Settings and save your settings

4. **Server will auto-start!** 🚀

---

## 📊 Feature Comparison

| Feature | Browser Mode<br>(`npm run dev`) | Desktop App<br>(`npm start`) |
|---------|:-------------------------------:|:----------------------------:|
| Auto-start server | ❌ No | ✅ Yes |
| Server management | ❌ Manual only | ✅ Integrated |
| Full functionality | ⚠️ Limited | ✅ Complete |
| Best for | Development only | Production use |

---

## 💡 Pro Tips

- **First time setup**: Run `START_POS_APP.bat` - it installs everything automatically
- **Daily use**: Just double-click `START_POS_APP.bat` to start working
- **Multi-computer**: Only server needs desktop app, clients can also use it or browser
- **Development**: Use `npm run dev` for coding, but test features in `npm start`

---

## 🛠️ Still Having Issues?

### Dependencies Not Installed
Run in terminal:
```bash
cd database-server
npm install
cd ..
npm install
```

### MySQL Not Configured
1. Check `database-server\.env` file
2. Update `DB_PASSWORD` with your MySQL password
3. Make sure MySQL is running

### Need Manual Server Start
If auto-start fails, you can always use:
- Double-click `START_DATABASE_SERVER.bat`
- This works regardless of desktop/browser mode

---

**Remember: For auto-start to work, use the desktop app!** 🎯

**Quick command:** `npm start` or double-click `START_POS_APP.bat`
