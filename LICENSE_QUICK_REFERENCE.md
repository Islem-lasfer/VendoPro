# 🚀 QUICK REFERENCE - License Generation

## Generate Licenses (Commands)

### Standard Licenses (Bind on First Use)

```bash
# 12 months validity
node generate-offline-license-machine-bound.js 12

# 6 months
node generate-offline-license-machine-bound.js 6

# 24 months (2 years)
node generate-offline-license-machine-bound.js 24

# Unlimited (lifetime)
node generate-offline-license-machine-bound.js unlimited
# OR
node generate-offline-license-machine-bound.js 0
```

### Pre-Bound Licenses (Specific Machine Only)

```bash
# First, get customer's machine ID
node get-machine-id.js

# Then generate license for that machine
node generate-offline-license-machine-bound.js 12 AABBCCDDEEFF
node generate-offline-license-machine-bound.js unlimited AABBCCDDEEFF
```

---

## Output Example

```
================================================================================
🔐 OFFLINE-ONLY LICENSE GENERATOR (MACHINE BOUND)
================================================================================

1️⃣  License Key: ABC12-DEF34-GHI56-JKL78-MNO90

🔓 Machine Binding: DYNAMIC
   License will bind to the first machine it's activated on

2️⃣  Payload created:
    Expires: NEVER (unlimited) ♾️
    Validity: UNLIMITED
    Max Devices: 1 (machine locked)

3️⃣  RSA Signature generated

4️⃣  File created: license-ABC12-DEF34-GHI56-JKL78-MNO90.lic
    Location: license-server/licenses/license-ABC12-DEF34-GHI56-JKL78-MNO90.lic
```

---

## What to Send to Customer

1. **The .lic file**
   - Example: `license-ABC12-DEF34-GHI56-JKL78-MNO90.lic`
   - Located in: `license-server/licenses/`

2. **Instructions:**
   ```
   1. Launch the POS application
   2. Click "📄 Import License File (.lic)"
   3. Select the license file
   4. Click Activate
   5. Done! ✅
   ```

3. **Important Notes:**
   - Works completely offline
   - No internet needed
   - License locks to your machine on first use
   - Cannot be transferred to another computer

---

## Customer Support - Common Issues

### "License bound to another machine"
**Cause:** License already activated elsewhere  
**Solution:** Generate new license

### "Invalid signature"
**Cause:** Corrupted file or wrong public key  
**Solution:** Re-send license file

### "License expired"
**Cause:** Time-limited license expired  
**Solution:** Generate new license with new expiry

### Changed network card
**Cause:** MAC address changed  
**Solution:** Generate new license (hardware change)

---

## Track Your Licenses (Recommended)

Keep a spreadsheet:

| License Key | Customer | Machine ID | Generated | Expires | Type |
|-------------|----------|------------|-----------|---------|------|
| ABC12-... | John Doe | AABBCC... | 2026-02-02 | Never | Unlimited |
| DEF34-... | Jane Shop | DDEEFF... | 2026-02-02 | 2027-02-02 | 12 months |

---

## File Locations

```
license-server/
├── generate-offline-license-machine-bound.js  ← Main generator
├── get-machine-id.js                          ← Get machine ID
├── config/
│   ├── private_key.pem                        ← Keep secure!
│   └── generate-keys-complete.sh              ← First-time key generation
└── licenses/
    └── license-XXXXX-XXXXX-....lic            ← Generated licenses
```

---

## Security Checklist

- [ ] Private key is secure and backed up
- [ ] Public key is in `electron/public_key.pem`
- [ ] Only authorized personnel can generate licenses
- [ ] Track all issued licenses
- [ ] Communicate machine binding to customers

---

## Quick Test

```bash
# 1. Generate test license
cd license-server
node generate-offline-license-machine-bound.js unlimited

# 2. Run app
cd ..
npm run dev

# 3. Import the .lic file
# 4. Should activate successfully
```

---

## Emergency: Lost Private Key

If you lose `private_key.pem`:

1. **ALL existing licenses become invalid**
2. **Must regenerate keys:**
   ```bash
   cd license-server/config
   ./generate-keys-complete.sh
   ```
3. **Copy new public_key.pem to electron/ folder**
4. **Rebuild and redistribute app**
5. **Re-issue all licenses**

**⚠️ BACKUP YOUR PRIVATE KEY!**
