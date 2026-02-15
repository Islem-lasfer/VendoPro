# 🚀 Quick Start Guide - Auto-Start Server

## ✅ Good News: npm run dev DOES support auto-start!

Your `npm run dev` command actually runs **both** Vite and Electron together, so the auto-start feature **SHOULD WORK**.

---

## 🎯 How to Use Auto-Start (with npm run dev)

### **Option 1: Automatic (When Saving Settings)**

**On Server Computer:**
1. Make sure you're running: `npm run dev`
2. Go to **Network Settings** page
3. Enable "Network Mode"
4. Check **"This machine is the server"** ✅
5. Click **"Save Settings"**
6. ✅ Server starts automatically!

### **Option 2: Manual Button (Added Now!)**

I just added a **"Start Server Now"** button!

**On Server Computer:**
1. Go to **Network Settings** page
2. Enable "Network Mode" + Check "Server role"
3. You'll see a button: **"🚀 Start Server Now"**
4. Click it!
5. ✅ Server starts immediately!
6. Button changes to: **"🟢 Server Running"**

---

## 🔍 Troubleshooting "Not running in Electron"

If you see this error, it means Electron isn't loading properly.

### **Quick Fix:**

1. **Stop everything** (Ctrl+C in terminal)

2. **Clean start:**
   ```bash
   npm run dev
   ```

3. **Wait for both:**
   - ✅ `VITE v5.x.x ready at http://localhost:3000`
   - ✅ Electron window opens

4. **Check in app:**
   - If you see the "Start Server Now" button → ✅ Electron is working!
   - If button is missing → ❌ Running in browser only

---

## 📋 Two Ways to Run the App

### **Development Mode (npm run dev)**
- ✅ Runs Vite + Electron together
- ✅ Auto-start server works
- ✅ Hot reload for code changes
- ✅ Shows "Start Server Now" button

### **Production Mode (npm start)**
- ✅ Runs Electron only (packaged)
- ✅ Auto-start server works
- ✅ Faster startup
- ❌ No hot reload

**Both support auto-start!** Use whichever you prefer.

---

## 🎯 Complete Workflow

### **Server Computer (192.168.1.6):**

1. Run: `npm run dev`
2. Wait for app to open
3. Go to Network Settings
4. Set as server, enable network mode
5. **Either:**
   - Click "🚀 Start Server Now" button (instant)
   - OR click "Save Settings" (auto-starts)
6. You'll see "🟢 Server Running"

### **Client Computers:**

1. Run their POS app (any mode)
2. Go to Network Settings
3. Set URL: `http://192.168.1.6:3001`
4. Client mode (server unchecked)
5. Click "Save Settings"
6. ✅ Connected!

---

## 💡 Pro Tips

- **First Time**: Install dependencies in database-server folder:
  ```bash
  cd database-server
  npm install
  cd ..
  ```

- **Check Status**: Look for "🟢 Server running" indicator under server role option

- **Manual Server**: Can still use `START_DATABASE_SERVER.bat` if you prefer

- **MySQL Required**: Server needs MySQL installed and configured

---

## ⚡ New Feature Added

✅ **Manual "Start Server Now" button** - No need to wait for save, start server instantly!

**The button appears when:**
- ✅ Network mode is enabled
- ✅ Server role is selected
- ✅ Running in Electron (npm run dev or npm start)

**Try it now!** 🎉
