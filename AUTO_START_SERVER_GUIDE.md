# 🚀 Auto-Start Database Server Guide

## ✅ New Feature: Auto-Start Server

The database server now **starts automatically** when you save network settings!

---

## 📋 How It Works

### **On the Server Computer (192.168.1.6):**

1. **Open POS Application**
2. **Go to Network Settings**
3. **Configure as follows:**
   - ✅ Enable "Network Mode"
   - ✅ Check "This machine is the server"
   - Set Server URL: `http://192.168.1.6:3001`
   - ✅ Enable Real-time Sync (optional)

4. **Click "Save Settings"**
   - The server will **automatically start**!
   - You'll see: "✅ Database server started successfully!"
   - Connection will be tested automatically

5. **That's it!** Keep the POS app open

---

### **On Client Computers:**

1. **Open POS Application**
2. **Go to Network Settings**
3. **Configure as follows:**
   - ✅ Enable "Network Mode"
   - ⬜ Uncheck "This machine is the server" (client mode)
   - Set Server URL: `http://192.168.1.6:3001` (server's IP)
   - ✅ Enable Real-time Sync (optional)

4. **Click "Save Settings"**
   - It will test connection
   - You'll see: "🟢 Connected to server"

---

## ⚠️ First-Time Setup

**IMPORTANT:** Before using auto-start, you need to install server dependencies **ONE TIME ONLY**:

### Option 1: Automatic Install
1. Double-click `START_DATABASE_SERVER.bat` (just once)
2. It will install dependencies automatically
3. After installation completes, you can close it
4. Now use auto-start from Network Settings!

### Option 2: Manual Install
Open terminal in `database-server` folder:
```bash
cd database-server
npm install
```

---

## 🔧 How It Works Internally

When you click "Save Settings" in Network Mode with "Server" role:
1. ✅ Saves your configuration
2. ✅ Checks if server is already running
3. ✅ If not running, starts the database server automatically
4. ✅ Tests connection
5. ✅ Enables real-time sync (if enabled)

**No more command line needed!** 🎉

---

## 💡 Tips

- **Server Status**: Look for the "🟢 Connected" indicator
- **Auto-Restart**: Server restarts automatically when you save settings
- **Background Running**: Server runs in background while POS app is open
- **Clean Shutdown**: Server stops automatically when you close the POS app

---

## 🐛 Troubleshooting

### "Dependencies not installed" Error
- Run `START_DATABASE_SERVER.bat` once to install dependencies
- Or manually run `npm install` in `database-server` folder

### "Failed to start server" Error
- Check if MySQL is installed and running
- Verify `.env` file in `database-server` folder has correct MySQL password
- Make sure port 3001 is not already in use

### Still Can't Connect
- Verify server computer IP address (use `ipconfig` in cmd)
- Check Windows Firewall allows port 3001
- Make sure both computers are on same network

---

## ✨ Benefits

✅ **No separate server window** - all integrated  
✅ **No command line** - just click save  
✅ **Auto-restart** - updates apply instantly  
✅ **Clean shutdown** - no orphan processes  
✅ **Error detection** - clear error messages  

---

**Enjoy your simplified multi-workstation POS!** 🎊
