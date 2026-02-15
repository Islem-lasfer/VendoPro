# 🔐 OFFLINE-ONLY LICENSE SYSTEM

## Overview

This POS now uses an **OFFLINE-ONLY** license system with **STRICT MACHINE BINDING**. No internet connection is required for activation or validation.

## 🎯 Key Features

### ✅ Completely Offline
- **No internet required** for activation
- **No online validation** at any time
- Works in completely air-gapped environments
- Perfect for shops without reliable internet

### 🔒 Machine Binding
- Each license is **locked to ONE machine** forever
- License binds to the machine on **first activation**
- **Cannot be copied** or transferred to another machine
- Uses hardware MAC address for binding

### 🔐 Security
- **RSA-2048 signature verification**
- License files cannot be tampered with
- Invalid signatures are rejected
- Cryptographic verification at startup

---

## 📋 How It Works

### For End Users (POS Installation)

#### 1. **Receive License File**
You will receive a `.lic` file from the vendor:
```
license-ABC12-DEF34-GHI56-JKL78-MNO90.lic
```

#### 2. **Install and Launch Application**
- Install the POS application
- Launch it for the first time

#### 3. **Activate License**
- Click **"📄 Use license file"** button
- Select your `.lic` file
- Click **"Activate"**

#### 4. **Done! ✅**
- License is activated **OFFLINE**
- License is now **LOCKED** to this machine
- Application will work forever on this machine (until expiration)
- No internet needed ever again

#### ⚠️ Important Notes
- **First activation locks the license** to that machine
- You **cannot move** the license to another computer
- You **cannot copy** the license file to use on another machine
- If you change computers, you need a **NEW license**

---

## 👨‍💼 For License Administrators

### Generating Offline Licenses

#### Option 1: Any Machine (Dynamic Binding)
Generate a license that can be activated on ANY machine, but locks on first use:

```bash
# 12 months validity
node generate-offline-license-machine-bound.js 12

# Unlimited validity
node generate-offline-license-machine-bound.js unlimited

# Or with 0
node generate-offline-license-machine-bound.js 0
```

**Result:**
- ✅ Customer can activate on any machine
- ✅ License locks to that machine on first activation
- ❌ Cannot be transferred after activation

#### Option 2: Specific Machine (Pre-Bound)
Generate a license for a specific machine only:

```bash
# Get customer's MAC address first
# (They can find it in: Settings → About → Machine ID)

# Generate license for that specific machine
node generate-offline-license-machine-bound.js 12 AABBCCDDEEFF

# Or unlimited for specific machine
node generate-offline-license-machine-bound.js unlimited AABBCCDDEEFF
```

**Result:**
- ✅ License will ONLY work on that specific machine
- ❌ Cannot be activated on any other machine
- ❌ Cannot be transferred

### Example Output

```
================================================================================
🔐 OFFLINE-ONLY LICENSE GENERATOR (MACHINE BOUND)
================================================================================

1️⃣  License Key: ABC12-DEF34-GHI56-JKL78-MNO90

🔓 Machine Binding: DYNAMIC
   License will bind to the first machine it's activated on

2️⃣  Payload created:
    Expires: 12/31/2099 (unlimited) ♾️
    Validity: UNLIMITED
    Max Devices: 1 (machine locked)

3️⃣  RSA Signature generated
    Private key: private_key.pem

4️⃣  File created: license-ABC12-DEF34-GHI56-JKL78-MNO90.lic
    Location: /path/to/licenses/license-ABC12-DEF34-GHI56-JKL78-MNO90.lic

================================================================================
📋 CLIENT INSTRUCTIONS
================================================================================

🔌 OFFLINE ACTIVATION (No Internet Required):
   1. Send this file to client: license-ABC12-DEF34-GHI56-JKL78-MNO90.lic
   2. Client opens the application
   3. Click "📄 Use license file"
   4. Select the .lic file
   5. ✅ Activation successful - OFFLINE!

🔓 DYNAMIC BINDING:
   • First activation: Works on ANY machine
   • After activation: LOCKED to that machine forever
   • Cannot be copied or moved to another machine

================================================================================
✅ SUMMARY
================================================================================

License Key: ABC12-DEF34-GHI56-JKL78-MNO90
Offline File: license-ABC12-DEF34-GHI56-JKL78-MNO90.lic
Expires: NEVER (unlimited) ♾️
Machine Binding: DYNAMIC (binds on first use)
Max Devices: 1
Offline Only: YES ✅

🔐 SECURITY FEATURES:
   ✅ RSA-2048 signature verification
   ✅ Machine binding (cannot be copied)
   ✅ Single device limit enforced
   ✅ Works completely offline
   ✅ No internet validation needed
```

---

## 🔧 Technical Details

### File Structure

#### License File (.lic)
```json
{
  "license_key": "ABC12-DEF34-GHI56-JKL78-MNO90",
  "payload": "eyJsaWNlbnNlX2tleS...",
  "signature": "iVBORw0KGgoAAAANSUh...",
  "expire_at": "2099-12-31T23:59:59.999Z",
  "max_devices": 1,
  "offline_only": true,
  "created_at": "2026-02-02T10:00:00.000Z"
}
```

#### Stored License (license.json)
After activation, stored locally:
```json
{
  "key": "ABC12-DEF34-GHI56-JKL78-MNO90",
  "machine_id": "AABBCCDDEEFF",
  "expire_at": "2099-12-31T23:59:59.999Z",
  "payload": "eyJsaWNlbnNlX2tleS...",
  "signature": "iVBORw0KGgoAAAANSUh...",
  "activated_at": "2026-02-02T10:05:00.000Z",
  "mode": "offline",
  "max_devices": 1
}
```

### Verification Flow

```
1. User imports .lic file
   ↓
2. Application reads file content
   ↓
3. Verify RSA signature
   ├─ Valid → Continue
   └─ Invalid → Reject (tampered file)
   ↓
4. Check expiration date
   ├─ Not expired → Continue
   └─ Expired → Reject
   ↓
5. Check machine binding
   ├─ First activation → Bind to this machine
   ├─ Same machine → Allow
   └─ Different machine → Reject
   ↓
6. Save license locally
   ↓
7. ✅ Activation successful
```

### Startup Validation

```
1. Application starts
   ↓
2. Check if license.json exists
   ├─ No → Show license screen
   └─ Yes → Continue
   ↓
3. Read stored license
   ↓
4. Get current machine ID
   ↓
5. Compare with stored machine_id
   ├─ Match → Continue
   └─ Mismatch → Delete license, show license screen
   ↓
6. Check expiration
   ├─ Valid → Continue
   └─ Expired → Show license screen
   ↓
7. Verify signature (offline)
   ├─ Valid → Continue
   └─ Invalid → Delete license, show license screen
   ↓
8. ✅ Launch application
```

---

## 🛡️ Security Mechanisms

### 1. **RSA Signature Verification**
- Each license is signed with RSA-2048 private key
- Public key is embedded in the application
- Tampering invalidates the signature
- Prevents license file modification

### 2. **Machine Binding**
- Uses network interface MAC address
- Stored in hashed format
- Checked at every startup
- Cannot be spoofed easily

### 3. **Local Storage**
- License stored in `electron/license.json`
- Contains machine binding information
- Checked against hardware on every launch
- Auto-deleted if machine mismatch detected

### 4. **No Network Dependencies**
- No internet validation at any time
- No phone-home functionality
- No telemetry
- Complete privacy

---

## 🚨 Anti-Piracy Measures

### What Happens If...

#### Copying License File to Another Machine?
❌ **BLOCKED**
- License activates on new machine
- But stored `machine_id` doesn't match
- License is automatically deleted
- User must re-import and activate
- System detects machine_id mismatch
- Activation rejected: "License is bound to another machine"

#### Copying Both .lic and license.json?
❌ **BLOCKED**
- `license.json` contains original machine_id
- Current machine_id is different
- Validation fails at startup
- Files are auto-deleted
- License screen shown

#### Modifying License File?
❌ **BLOCKED**
- RSA signature becomes invalid
- Signature verification fails
- License rejected immediately

#### Changing Hardware?
⚠️ **DEPENDS**
- Changing most hardware: Works fine
- Changing network card: License invalidated
- MAC address changed = different machine
- User needs new license

---

## 📱 Getting Machine ID

Users can find their machine ID in the application:

1. Open POS application
2. Go to **Settings**
3. Scroll to **About** section
4. Find **Machine ID** (MAC address)
5. Example: `AA:BB:CC:DD:EE:FF`

This is needed if you want to generate a pre-bound license.

---

## 🔄 Migration from Old System

### If You Had Online Licenses

The old online/hybrid system is **completely removed**. 

**Action Required:**
1. Generate new `.lic` files for all customers
2. Send them the new offline license files
3. Customers re-activate using the new files
4. Old online validation code is removed

### Benefits of Migration
- ✅ No server costs
- ✅ No internet requirements
- ✅ No database maintenance
- ✅ Simpler architecture
- ✅ Better privacy
- ✅ Same strong security

---

## 📝 Common Questions

### Q: Can customers use the same license on multiple machines?
**A:** No. Each license is locked to ONE machine only.

### Q: What if customer changes computers?
**A:** They need a new license. The old license cannot be transferred.

### Q: Does it require internet?
**A:** No. Works 100% offline. No internet ever needed.

### Q: How secure is this?
**A:** Very secure. Uses RSA-2048 signatures and hardware binding. Equivalent to commercial DRM systems.

### Q: Can customers share license files?
**A:** They can try, but it won't work. The license locks to the first machine it's activated on.

### Q: What happens if MAC address changes?
**A:** License becomes invalid. Customer needs a new license (hardware change policy).

### Q: Can I revoke licenses remotely?
**A:** No. This is an offline system. Licenses cannot be revoked remotely. This is a trade-off for offline functionality.

### Q: How do I generate unlimited licenses?
**A:** Use `node generate-offline-license-machine-bound.js unlimited`

---

## 🎯 Best Practices

### For License Administrators

1. **Keep private key secure** - Anyone with access can generate unlimited licenses
2. **Track issued licenses** - Maintain a database/spreadsheet of issued licenses
3. **Use pre-binding** for enterprise customers to prevent sharing
4. **Set appropriate expiration** - Use unlimited for one-time purchases, timed for subscriptions

### For End Users

1. **Backup license file** - Store `.lic` file safely
2. **Note your machine ID** - Helpful if you need support
3. **Don't change hardware** (especially network card) - May invalidate license
4. **Contact support** if machine changes are necessary

---

## 📂 File Locations

### Generated Licenses
```
license-server/licenses/license-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.lic
```

### Private Key
```
license-server/config/private_key.pem
```

### Public Key (in app)
```
electron/public_key.pem
```

### Stored License
```
electron/license.json
```

---

## 🚀 Quick Start

### For Developers

1. Generate RSA key pair (if not exists):
```bash
cd license-server/config
./generate-keys-complete.sh
```

2. Generate a license:
```bash
cd license-server
node generate-offline-license-machine-bound.js unlimited
```

3. Test it:
- Launch the POS app
- Import the generated `.lic` file
- Activate

### For End Users

1. Receive `.lic` file from vendor
2. Launch POS application
3. Click "📄 Use license file"
4. Select `.lic` file
5. Click "Activate"
6. Done! ✅

---

## 📞 Support

For technical issues:
- Check machine ID in Settings → About
- Verify `.lic` file is not corrupted
- Ensure you're on the correct machine
- Contact vendor for new license if machine changed

---

## ✅ Summary

| Feature | Status |
|---------|--------|
| Offline Activation | ✅ Yes |
| Machine Binding | ✅ Yes (Single Device) |
| Internet Required | ❌ Never |
| License Transfer | ❌ Not Possible |
| RSA Signature | ✅ 2048-bit |
| Expiration Support | ✅ Yes |
| Unlimited Licenses | ✅ Supported |
| Pre-Binding | ✅ Optional |
| Remote Revocation | ❌ Not Possible (Offline) |
| Privacy | ✅ Complete (No Telemetry) |

---

**System Version:** Offline-Only v2.0  
**Last Updated:** February 2, 2026  
**License Type:** Offline with Machine Binding
