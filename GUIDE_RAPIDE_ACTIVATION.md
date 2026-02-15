# 🚀 Guide Rapide - Activation Hybride Online/Offline

## ✅ Implémentation Terminée !

Votre logiciel POS dispose maintenant d'un **système de licence hybride** qui fonctionne :
- ✅ **En ligne** (avec Internet via cloud Amazon)
- ✅ **Hors ligne** (sans Internet avec vérification RSA locale)

## 🎯 Ce qui a été modifié

### Fichiers créés
- ✅ `electron/public_key.pem` - Clé publique RSA pour vérification offline
- ✅ `LICENCE_HYBRIDE_README.md` - Documentation complète du système

### Fichiers modifiés
- ✅ `electron/license.js` - Nouvelle logique hybride avec RSA
- ✅ `main.js` - Handler IPC mis à jour pour online/offline
- ✅ `src/components/License/License.jsx` - Interface d'activation améliorée
- ✅ `license-server/routes/license.js` - Serveur retourne payload + signature

## 📖 Comment ça marche ?

### Scénario 1 : Première activation (Internet requis)
```
1. L'utilisateur entre sa clé : XXXX-XXXX-XXXX-XXXX
2. Le logiciel contacte le serveur cloud (13.60.180.65:3000)
3. Le serveur valide et retourne :
   - ✅ payload (données de licence encodées)
   - ✅ signature (signature RSA pour vérification)
4. Le logiciel stocke tout dans "electron/license.json"
5. ✅ ACTIVÉ (mode online)
```

### Scénario 2 : Activations suivantes (Offline OK)
```
Avec Internet :
1. Vérification online normale
2. ✅ ACTIVÉ (mode online)

Sans Internet :
1. Tentative online échoue (pas d'internet)
2. Le logiciel lit les données locales stockées
3. Vérifie la signature RSA avec la clé publique locale
4. Vérifie la date d'expiration
5. ✅ ACTIVÉ (mode offline)
```

## 🔐 Sécurité

### Impossible de contourner car :
- La signature RSA ne peut être forgée sans la clé privée
- La clé privée est **uniquement** sur votre serveur de génération
- Le payload contient la date d'expiration et est signé
- Modifier le payload invalide la signature

### Vérifications automatiques :
- ✅ Signature RSA valide
- ✅ Date d'expiration non dépassée
- ✅ Machine_id correspond (liaison au PC)
- ✅ Clé non blacklistée (en mode online)

## 🧪 Test rapide

### Test 1 : Activation avec Internet ✅
```bash
1. npm run dev
2. Entrer une clé de licence valide
3. Observer : "✅ Activation en ligne réussie !"
```

### Test 2 : Activation sans Internet ✅
```bash
1. Activer une fois avec Internet (Test 1)
2. Fermer l'application
3. Activer le mode avion / déconnecter Internet
4. npm run dev
5. Entrer la même clé
6. Observer : "✅ Activation hors ligne réussie ✅ (mode offline)"
```

## 📋 Prochaines étapes

### Sur votre serveur de génération de licences :

**1. Installer le serveur (si pas déjà fait)**
```bash
cd license-server
npm install
node src/server.js
```

**2. Générer une clé de test**
```bash
node scripts/generate-license-key.js
```

**3. Insérer dans MongoDB**
```javascript
use licenses

db.licenses.insertOne({
  license_key: "A3F2-B8D1-C9E4-F7A2",  // Remplacer par clé générée
  payload: "base64_payload...",         // Copier du script
  signature: "base64_signature...",     // Copier du script
  status: "inactive",
  activation_count: 0,
  max_devices: 1,
  expire_at: new Date("2027-12-31"),
  created_at: new Date()
})
```

**4. Tester l'activation**
- Lancer votre application POS
- Entrer la clé générée
- Vérifier l'activation online puis offline

## 🎨 Messages utilisateur

L'interface affiche maintenant des messages clairs :

| Emoji | Message | Signification |
|-------|---------|---------------|
| 🌐 | Tentative d'activation en ligne... | Connexion au serveur |
| ✅ | Activation en ligne réussie ! | Activé via cloud |
| 🔌 | Pas d'internet, tentative en mode hors ligne... | Mode offline |
| ✅ | Activation hors ligne réussie ✅ (mode offline) | Activé sans Internet |
| ❌ | Pas de connexion Internet et aucune donnée... | Première activation impossible sans Internet |

## ⚙️ Configuration serveur

Votre serveur cloud est configuré sur :
```
IP : 13.60.180.65
Port : 3000
API : /api/license/activate
```

Si vous changez le serveur, modifier dans :
- `electron/license.js` (ligne ~45)
- `src/components/License/License.jsx` (ligne ~40)

## 📊 Fichiers de stockage

### license.json (après activation)
```json
{
  "key": "A3F2-B8D1-C9E4-F7A2",
  "machine_id": "AABBCCDDEEFF",
  "expire_at": "2027-12-31T23:59:59.000Z",
  "payload": "eyJsaWNlbnNlX2tleSI6IkEzRjIt...",
  "signature": "dGVzdHNpZ25hdHVyZXRlc3RzaWdu...",
  "activated_at": "2026-02-02T10:30:00.000Z",
  "mode": "online"
}
```

### Où se trouvent les fichiers ?
```
Stock/
├── electron/
│   ├── license.js          ← Logique hybride ✅
│   ├── license.json        ← Stockage activation
│   └── public_key.pem      ← Clé publique RSA ✅
└── src/
    └── components/
        └── License/
            └── License.jsx ← Interface activation ✅
```

## 🐛 Dépannage

### ❌ "Signature invalide" en offline
**Cause :** La clé publique ne correspond pas à la clé privée du serveur  
**Solution :** Copier la bonne `public_key.pem` depuis le serveur vers `electron/`

### ❌ "Pas de connexion Internet..."
**Cause :** Première activation sans Internet  
**Solution :** Connecter à Internet pour la première activation

### ❌ Timeout lors de l'activation online
**Cause :** Serveur cloud inaccessible (13.60.180.65:3000)  
**Solution :** 
- Vérifier que le serveur est démarré
- Vérifier le firewall
- Ping 13.60.180.65

### ❌ "Key already used on another device"
**Cause :** Clé déjà activée sur un autre PC  
**Solution :** 
- Générer une nouvelle clé
- Ou réinitialiser la clé existante dans MongoDB :
  ```javascript
  db.licenses.updateOne(
    { license_key: "XXXX-XXXX-XXXX-XXXX" },
    { $set: { machine_id: null, activation_count: 0 } }
  )
  ```

## 📚 Documentation complète

Pour plus de détails techniques, consulter :
- `LICENCE_HYBRIDE_README.md` - Documentation complète
- `electron/license.js` - Code source avec commentaires
- `license-server/routes/license.js` - API serveur

## ✅ Checklist finale

- ✅ Système hybride online/offline implémenté
- ✅ Signature RSA pour vérification offline
- ✅ Stockage local du payload et signature
- ✅ Interface utilisateur avec messages clairs
- ✅ Fallback automatique vers mode offline
- ✅ Documentation complète créée
- ✅ Compatible avec serveur cloud Amazon

## 🎉 Résultat

Votre logiciel POS peut maintenant être activé :
1. **Première fois** : Internet requis → télécharge les données
2. **Ensuite** : Fonctionne offline → vérifie localement avec RSA

**La même clé fonctionne dans les deux modes !**

---

**Prêt à tester ?**
```bash
npm run dev
```

Bonne chance ! 🚀
