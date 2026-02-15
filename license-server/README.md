# 🔐 Serveur de Licence - Guide Complet

## 📋 Vue d'ensemble

Ce serveur gère les licences pour le logiciel POS avec support **online** et **offline**.

## 🚀 Démarrage Rapide

### 1. Installation

```bash
cd license-server
npm install
```

### 2. Générer les clés RSA

```bash
cd config
./generate-keys-complete.sh
```

Ceci génère :
- `private_key.pem` - **À GARDER SECRET** (sur serveur uniquement)
- `public_key.pem` - À copier dans l'application client

### 3. Copier la clé publique vers le client

```bash
cp config/public_key.pem ../electron/
```

### 4. Démarrer le serveur

```bash
node src/server.js
```

Le serveur écoute sur le port **3000**.

## 🔑 Générer des Licences

### Méthode 1 : Script automatique (Recommandé)

```bash
node generate-test-license.js [mois_validité]
```

**Exemple :**
```bash
# Licence valide 12 mois
node generate-test-license.js 12

# Licence valide 24 mois
node generate-test-license.js 24
```

**Sortie :**
```
======================================================================
🔐 GÉNÉRATION DE LICENCE DE TEST
======================================================================

1️⃣  Clé de licence générée: A3F2-B8D1-C9E4-F7A2

2️⃣  Payload créé:
    Expire le: 02/02/2027
    Validité: 12 mois

3️⃣  Signature RSA générée
    Clé privée: private_key.pem

======================================================================
📋 INSTRUCTIONS D'INSERTION MONGODB
======================================================================

use licenses

db.licenses.insertOne({
  "license_key": "A3F2-B8D1-C9E4-F7A2",
  "payload": "eyJsaWNlbnNlX2tleSI6IkEzRjItQjhE...",
  "signature": "dGVzdHNpZ25hdHVyZXRlc3RzaWdu...",
  "expire_at": "2027-02-02T00:00:00.000Z",
  "max_devices": 1,
  "status": "inactive",
  "activation_count": 0,
  "created_at": "2026-02-02T10:30:00.000Z"
})
```

### Méthode 2 : Manuellement

Si vous préférez générer manuellement :

```bash
node scripts/generate-license-key.js
```

## 📊 Structure MongoDB

### Base de données : `licenses`

### Collection : `licenses`

**Schéma :**
```javascript
{
  license_key: String,      // Format: XXXX-XXXX-XXXX-XXXX
  payload: String,          // Base64 encoded payload
  signature: String,        // RSA signature (base64)
  expire_at: Date,          // Date d'expiration
  max_devices: Number,      // Nombre max d'activations (défaut: 1)
  status: String,           // 'inactive' | 'active' | 'blacklisted'
  activation_count: Number, // Compteur d'activations
  machine_id: String,       // ID de la machine activée (null avant activation)
  created_at: Date,         // Date de création
  updated_at: Date          // Date de dernière modification
}
```

**Exemple :**
```javascript
{
  license_key: "A3F2-B8D1-C9E4-F7A2",
  payload: "eyJsaWNlbnNlX2tleSI6IkEzRjItQjhEMS1DOUU0LUY3QTIiLCJleHBpcmVfYXQiOiIyMDI3LTAyLTAyVDAwOjAwOjAwLjAwMFoiLCJtYXhfZGV2aWNlcyI6MSwiY3JlYXRlZF9hdCI6IjIwMjYtMDItMDJUMTA6MzA6MDAuMDAwWiJ9",
  signature: "dGVzdHNpZ25hdHVyZXRlc3RzaWduYXR1cmV0ZXN0c2lnbmF0dXJl",
  expire_at: ISODate("2027-02-02T00:00:00.000Z"),
  max_devices: 1,
  status: "inactive",
  activation_count: 0,
  machine_id: null,
  created_at: ISODate("2026-02-02T10:30:00.000Z"),
  updated_at: ISODate("2026-02-02T10:30:00.000Z")
}
```

## 🌐 API Endpoints

### POST /api/license/activate

Active une licence et lie à une machine.

**Requête :**
```json
{
  "license_key": "A3F2-B8D1-C9E4-F7A2",
  "machine_id": "AABBCCDDEEFF"
}
```

**Réponse (succès) :**
```json
{
  "success": true,
  "expire_at": "2027-02-02T00:00:00.000Z",
  "payload": "eyJsaWNlbnNlX2tleSI6IkEzRjIt...",
  "signature": "dGVzdHNpZ25hdHVyZXRlc3Rz..."
}
```

**Erreurs possibles :**
- `404` : Clé invalide
- `400` : Signature invalide ou données manquantes
- `403` : Clé blacklistée
- `409` : Clé déjà utilisée sur un autre appareil
- `429` : Limite d'activations atteinte

### POST /api/license/validate

Valide une licence déjà activée.

**Requête :**
```json
{
  "license_key": "A3F2-B8D1-C9E4-F7A2",
  "machine_id": "AABBCCDDEEFF"
}
```

**Réponse (succès) :**
```json
{
  "valid": true,
  "expire_at": "2027-02-02T00:00:00.000Z"
}
```

### POST /api/license/blacklist

Blackliste une licence (administrateur uniquement).

**Requête :**
```json
{
  "license_key": "A3F2-B8D1-C9E4-F7A2"
}
```

**Réponse (succès) :**
```json
{
  "success": true
}
```

## 🔒 Sécurité

### Clé Privée RSA

**⚠️ CRITIQUE : NE JAMAIS PARTAGER `private_key.pem` !**

- Stockage : Serveur uniquement
- Permissions : `chmod 600 private_key.pem`
- Backup : Sécurisé et chiffré
- Git : Ajouté à `.gitignore`

### Clé Publique RSA

- Distribution : Embarquée dans l'application client
- Emplacement : `../electron/public_key.pem`
- Usage : Vérification offline des signatures

### Vérification Signature

Le serveur vérifie la signature RSA avant toute activation :

```javascript
const verify = crypto.createVerify('RSA-SHA256');
verify.update(Buffer.from(payload, 'base64'));
verify.end();
return verify.verify(PUBLIC_KEY, signature, 'base64');
```

## 🧪 Tests

### Tester le serveur

```bash
# Démarrer le serveur
node src/server.js

# Dans un autre terminal, tester l'activation
curl -X POST http://localhost:3000/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{"license_key":"A3F2-B8D1-C9E4-F7A2","machine_id":"TEST123"}'
```

### Vérifier MongoDB

```bash
mongo
use licenses
db.licenses.find().pretty()
```

## 📁 Structure des Fichiers

```
license-server/
├── config/
│   ├── generate-keys.sh              # Script simple génération clés
│   ├── generate-keys-complete.sh     # Script complet avec instructions
│   ├── private_key.pem               # Clé privée RSA (à générer)
│   └── public_key.pem                # Clé publique RSA (à générer)
│
├── models/
│   └── License.js                    # Modèle MongoDB
│
├── routes/
│   └── license.js                    # Routes API
│
├── scripts/
│   └── generate-license-key.js       # Générateur simple
│
├── src/
│   └── server.js                     # Serveur principal
│
├── generate-test-license.js          # Générateur complet avec instructions
├── package.json
└── README.md                          # Ce fichier
```

## 🛠️ Configuration

### MongoDB

**Par défaut :**
```
Host: localhost
Port: 27017
Database: licenses
Auth: lasferislem / 94d7239F2400
```

**Modifier dans `src/server.js` :**
```javascript
mongoose.connect('mongodb://username:password@host:port/database?authSource=database');
```

### Port du Serveur

**Par défaut : 3000**

**Modifier dans `src/server.js` :**
```javascript
app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
```

## 📋 Commandes Utiles

```bash
# Générer clés RSA
cd config && ./generate-keys-complete.sh

# Copier clé publique vers client
cp config/public_key.pem ../electron/

# Générer une licence (12 mois)
node generate-test-license.js 12

# Démarrer le serveur
node src/server.js

# Voir les licences dans MongoDB
mongo
use licenses
db.licenses.find()

# Réinitialiser une licence
db.licenses.updateOne(
  { license_key: "XXXX-XXXX-XXXX-XXXX" },
  { $set: { machine_id: null, activation_count: 0, status: "inactive" } }
)

# Blacklister une licence
db.licenses.updateOne(
  { license_key: "XXXX-XXXX-XXXX-XXXX" },
  { $set: { status: "blacklisted" } }
)
```

## 🐛 Dépannage

### Erreur : "Cannot find module 'mongoose'"

```bash
npm install
```

### Erreur : "connect ECONNREFUSED"

MongoDB n'est pas démarré :
```bash
# Linux/Mac
sudo systemctl start mongodb

# Windows
net start MongoDB
```

### Erreur : "Private key not found"

Générer les clés RSA :
```bash
cd config
./generate-keys-complete.sh
```

### Erreur : "Signature invalid"

Vérifier que la clé privée utilisée correspond à la clé publique du client.

## 📞 Support

Pour toute question :
- Documentation complète : `../LICENCE_HYBRIDE_README.md`
- Guide utilisateur : `../GUIDE_RAPIDE_ACTIVATION.md`

---

**Version :** 2.0  
**Date :** Février 2026  
**Licence :** MIT
