# 🔐 Système de Licence Hybride Online/Offline

## 📋 Vue d'ensemble

Ce système de licence permet l'activation du logiciel **en ligne** (via serveur cloud Amazon) ET **hors ligne** (sans internet) avec la **même clé de licence**.

## 🌟 Fonctionnalités

### ✅ Mode Online (Prioritaire)
- Vérification via serveur cloud (13.60.180.65:3000)
- Validation RSA de la signature
- Liaison à la machine (machine_id)
- Vérification de la date d'expiration
- Téléchargement du payload et signature pour utilisation offline future

### ✅ Mode Offline (Fallback automatique)
- Fonctionne **sans connexion Internet**
- Utilise la signature RSA locale pour vérifier l'authenticité
- Vérifie l'expiration localement
- Nécessite une activation online réussie au moins une fois

## 🔄 Flux d'activation

```
┌─────────────────────────────────────────────┐
│  Utilisateur entre la clé de licence       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  1. Tentative d'activation ONLINE           │
│     - Envoi au serveur cloud                │
│     - Vérification signature RSA            │
│     - Vérification expiration               │
│     - Liaison machine_id                    │
└──────────────┬──────────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
    ✅ Succès    ❌ Échec
         │           │
         │           ▼
         │     ┌──────────────────────────────┐
         │     │  2. Tentative OFFLINE        │
         │     │     - Lecture données locales│
         │     │     - Vérif. signature RSA   │
         │     │     - Vérif. expiration      │
         │     └─────┬────────────────────────┘
         │           │
         │     ┌─────┴─────┐
         │     │           │
         │  ✅ Succès   ❌ Échec
         │     │           │
         ▼     ▼           ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ ✅ ACTIVÉ       │   │ ❌ REJETÉ       │
    │ (online/offline)│   │ Message d'erreur│
    └─────────────────┘   └─────────────────┘
```

## 🔧 Architecture Technique

### Fichiers modifiés

#### 1. **electron/license.js**
```javascript
// Fonctions principales :
- activateLicense(key, machineId, licenseData)    // Hybride online/offline
- activateOnline(key, machineId)                  // Activation online
- activateOffline(licenseData)                    // Activation offline
- verifySignatureOffline(payload, signature)      // Vérification RSA locale
```

#### 2. **electron/public_key.pem**
- Clé publique RSA pour vérification offline
- Correspond à la clé privée du serveur de génération

#### 3. **main.js**
```javascript
// Handler IPC pour activation hybride
ipcMain.handle('activate-license', async (event, key, payload, signature) => {
  // Appelle activateLicense() avec données online/offline
  // Sauvegarde payload et signature pour usage offline futur
})
```

#### 4. **src/components/License/License.jsx**
```javascript
// Logique d'activation frontend
1. Essaie activation online via API REST
2. Si succès : stocke payload + signature pour offline
3. Si échec : tente activation offline avec données stockées
4. Affiche le statut (online/offline/erreur)
```

#### 5. **license-server/routes/license.js**
```javascript
// Serveur cloud retourne maintenant :
{
  success: true,
  expire_at: "2027-02-02",
  payload: "base64...",      // ← NOUVEAU
  signature: "base64..."     // ← NOUVEAU
}
```

## 📦 Format de la clé de licence

```
Format : XXXX-XXXX-XXXX-XXXX
Exemple : A3F2-B8D1-C9E4-F7A2

Composants :
- 20 caractères alphanumériques (sans tirets)
- 4 groupes de 4 caractères
- Insensible à la casse (converti en majuscules)
```

## 💾 Stockage local (electron/license.json)

```json
{
  "key": "A3F2-B8D1-C9E4-F7A2",
  "machine_id": "AABBCCDDEEFF",
  "expire_at": "2027-02-02T12:00:00.000Z",
  "payload": "eyJsaWNlbnNlX2tleSI6IkEzRjItQjhEMS1DOUU0LUY3QTIi...",
  "signature": "ZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQ...",
  "activated_at": "2026-02-02T10:30:00.000Z",
  "mode": "online"
}
```

### Champs importants :
- **payload** : Données de licence encodées en base64 (contient expire_at, machine_id, etc.)
- **signature** : Signature RSA du payload (vérifiable avec public_key.pem)

## 🚀 Utilisation

### Première activation (ONLINE requise)
```
1. L'utilisateur reçoit une clé : A3F2-B8D1-C9E4-F7A2
2. Entre la clé dans le logiciel
3. Le logiciel contacte le serveur cloud
4. Le serveur vérifie et active la clé
5. Le serveur retourne payload + signature
6. Le logiciel stocke tout localement
7. ✅ Activé (mode online)
```

### Activations suivantes (OFFLINE possible)
```
Scénario 1 : Internet disponible
1. Activation online normale
2. ✅ Activé (mode online)

Scénario 2 : Pas d'internet
1. Tentative online échoue (timeout)
2. Lecture des données locales (payload + signature)
3. Vérification RSA locale avec public_key.pem
4. Vérification de l'expiration
5. ✅ Activé (mode offline)
```

## 🔒 Sécurité

### Vérifications Online
1. ✅ Signature RSA valide
2. ✅ Clé non blacklistée
3. ✅ Machine non déjà utilisée
4. ✅ Limite d'activations non atteinte
5. ✅ Date d'expiration valide

### Vérifications Offline
1. ✅ Signature RSA valide (avec clé publique locale)
2. ✅ Date d'expiration valide
3. ✅ Machine_id correspond (optionnel)

### Impossible de contourner car :
- La signature RSA ne peut être forgée sans clé privée
- La clé privée est uniquement sur le serveur de génération
- Le payload est signé et ne peut être modifié
- La date d'expiration est dans le payload signé

## 🛠️ Génération de clés (Serveur)

Sur votre serveur de génération de licences :

```bash
# 1. Installer le script de génération
cd license-server
node scripts/generate-license-key.js

# 2. Exemple de sortie :
# License Key: A3F2-B8D1-C9E4-F7A2
# Payload: eyJsaWNlbnNlX2tleSI6IkEzRjItQjhEMS1DOUU0LUY3QTIiLCJleHBpcmVfYXQiOiIyMDI3LTAyLTAyIn0=
# Signature: ZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQ=
```

### Insérer dans MongoDB :
```javascript
db.licenses.insertOne({
  license_key: "A3F2-B8D1-C9E4-F7A2",
  payload: "eyJsaWNlbnNlX2tleSI6IkEzRjItQjhEMS1DOUU0LUY3QTIi...",
  signature: "ZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQ...",
  status: "inactive",
  activation_count: 0,
  max_devices: 1,
  expire_at: new Date("2027-02-02"),
  created_at: new Date()
})
```

## 📊 Messages d'état

| Message | Signification |
|---------|--------------|
| 🌐 Tentative d'activation en ligne... | Connexion au serveur cloud |
| ✅ Activation en ligne réussie ! | Activé via serveur |
| ⚠️ Activation en ligne échouée, tentative hors ligne... | Basculement vers offline |
| 🔌 Pas d'internet, tentative en mode hors ligne... | Mode offline direct |
| ✅ Activation hors ligne réussie ✅ (mode offline) | Activé sans internet |
| ❌ Pas de connexion Internet et aucune donnée de licence hors ligne disponible | Première activation requise |

## ⚠️ Limitations

### Mode Offline
- ❌ Ne peut pas vérifier si la clé a été blacklistée
- ❌ Ne peut pas mettre à jour l'expiration
- ❌ Ne peut pas synchroniser avec le serveur
- ✅ Fonctionne tant que la date d'expiration n'est pas dépassée
- ✅ Nécessite une activation online au moins une fois

### Recommandations
- Forcer une vérification online tous les 30 jours (optionnel)
- Afficher un avertissement si mode offline prolongé
- Logger les activations offline pour audit

## 🧪 Tests

### Test 1 : Activation online
```
1. Avoir une connexion Internet
2. Entrer une clé valide
3. Vérifier : "✅ Activation en ligne réussie !"
```

### Test 2 : Activation offline
```
1. Activer une fois en ligne (Test 1)
2. Fermer le logiciel
3. Désactiver Internet (mode avion)
4. Relancer le logiciel
5. Entrer la même clé
6. Vérifier : "✅ Activation hors ligne réussie ✅"
```

### Test 3 : Première activation sans Internet
```
1. Désactiver Internet
2. Entrer une clé (jamais utilisée)
3. Vérifier : "❌ Pas de connexion Internet et aucune donnée..."
```

### Test 4 : Clé expirée
```
1. Créer une clé avec expire_at passé
2. Tenter activation
3. Vérifier : "❌ License expired"
```

## 🔧 Dépannage

### Problème : "Signature invalide" en mode offline
**Solution :** Vérifier que `electron/public_key.pem` correspond à la clé privée du serveur

### Problème : "Pas de connexion Internet..."
**Solution :** Effectuer une première activation online pour télécharger payload + signature

### Problème : Timeout lors de l'activation online
**Solution :** Vérifier que le serveur cloud est accessible (13.60.180.65:3000)

### Problème : "Key already used on another device"
**Solution :** Utiliser une nouvelle clé ou réinitialiser la clé sur le serveur

## 📝 Logs de débogage

Les logs sont affichés dans la console Electron :

```
🔑 Starting hybrid license activation...
🌐 Attempting online activation...
✅ Online activation successful
```

ou

```
🔑 Starting hybrid license activation...
🔌 Online activation failed, attempting offline verification...
✅ Offline activation successful
```

## 📞 Support

Pour toute question sur le système de licence :
- Documentation : Ce fichier
- Code source : `electron/license.js`
- Serveur : `license-server/routes/license.js`

---

**Version :** 2.0 (Hybride Online/Offline)  
**Date :** Février 2026  
**Auteur :** POS Development Team
