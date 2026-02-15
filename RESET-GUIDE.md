# Reset Setup - Quick Guide

## 🚀 How to See the First-Time Setup Page

You have **3 easy methods** to reset and see the setup wizard:

### ✨ Method 1: Keyboard Shortcut (RECOMMENDED)
**Fastest way!**
1. Make sure the app is running
2. Press: **`Ctrl+Shift+R`**
3. An alert will appear confirming the reset
4. The app automatically reloads
5. You'll see the beautiful 2-step setup wizard! 🎉

### 📝 Method 2: Developer Console
1. Start the app: `npm run dev`
2. DevTools will open automatically
3. Go to the **Console** tab
4. Type: `localStorage.removeItem('posAuthData')`
5. Press **Enter**
6. Type: `location.reload()`
7. Press **Enter**
8. Setup wizard appears! ✅

### 🔧 Method 3: Reset Script
1. Close the app completely
2. Run: `node reset-setup.js`
3. Start the app: `npm run dev`
4. Setup wizard appears!

---

## 🎨 What You'll See

After resetting, you'll see the **First-Time Setup Wizard**:

### Step 1: Email Setup
- Enter your email address
- Confirm email
- Clean, modern interface with progress indicator

### Step 2: Security Setup
- Toggle password protection (optional)
- If enabled, create a password (min 6 characters)
- Confirm password

After completing setup, you'll be redirected to the checkout page!

---

## 🔑 Testing Authentication Features

After setup:

1. **Test Password Protection**:
   - Try accessing: Products, Sales, Employees, or Supplier Invoices
   - Login modal will appear if password was set

2. **Test Password Change**:
   - Go to Settings
   - Scroll to "Change Password" section
   - Change your password

3. **Test Forgot Password**:
   - Click "Forgot Password?" on login
   - Follow the verification code flow

---

## 💡 Tips

- **Keyboard Shortcut**: `Ctrl+Shift+R` is the fastest way to reset
- **DevTools**: Opens automatically in development mode
- **Testing**: Reset as many times as you want during development
- **Production**: Remove the reset shortcut before deployment

---

## 🛠️ Troubleshooting

**Setup doesn't appear?**
- Make sure you removed `posAuthData` from localStorage
- Clear browser cache: `Ctrl+Shift+Delete`
- Restart the app completely

**DevTools won't open?**
- Press **F12** manually
- Or right-click → "Inspect Element"

---

Enjoy testing your authentication system! 🎊
