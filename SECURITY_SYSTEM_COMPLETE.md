# 🔒 SYSTÈME DE SÉCURITÉ COMPLET - ANTI-PIRATAGE

## ✅ IMPLÉMENTÉ : Sécurité Multi-Niveaux

### 🛡️ 5 Niveaux de Protection

#### 1️⃣ **Vérification Machine ID (Local + Serveur)**
- Chaque licence est liée à une adresse MAC unique
- Vérification locale à chaque démarrage
- Vérification serveur si Internet disponible

#### 2️⃣ **Détection de Piratage en Temps Réel**
- Vérification toutes les 30 minutes si connecté
- Détecte l'utilisation simultanée sur plusieurs machines
- Fermeture automatique de l'application si piratage détecté

#### 3️⃣ **Blacklist Automatique**
- Après 3 tentatives de piratage → blacklist automatique
- Blacklist manuelle possible (admin)
- Une fois blacklistée, impossible d'activer

#### 4️⃣ **Signature RSA**
- Empêche la modification des fichiers .lic
- Seules les licences signées par votre clé privée fonctionnent
- Impossible de créer de fausses licences

#### 5️⃣ **Tracking Complet**
- Enregistrement de chaque activation
- Tracking des validations périodiques
- Historique des tentatives de piratage
- Adresse IP du dernier accès

---

## 🔐 Comment Ça Fonctionne

### Scénario Normal (Client Légitime)

```
Jour 1 - Première Activation:
┌─────────────────────────────┐
│ Client importe fichier .lic │
│ Machine ID: AABBCCDDEEFF    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Vérification serveur:       │
│ ✅ Licence valide           │
│ ✅ Pas encore activée       │
│ ✅ Enregistrer machine_id   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Sauvegarde locale:          │
│ - license.json créé         │
│ - machine_id: AABBCCDDEEFF  │
│ - payload + signature       │
└──────────┬──────────────────┘
           │
           ▼
      ✅ ACTIVÉ

Jour 2-365 - Utilisation Normale:
┌─────────────────────────────┐
│ Démarrage application       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Vérification locale:        │
│ ✅ license.json existe      │
│ ✅ machine_id correspond    │
│ ✅ Pas expiré               │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Toutes les 30 minutes:      │
│ SI Internet disponible:     │
│   → Validation serveur      │
│   ✅ Licence toujours OK    │
│   ✅ Pas de piratage        │
└──────────┬──────────────────┘
           │
           ▼
      ✅ FONCTIONNE
```

### Scénario Piratage (Tentative de Copie)

```
Pirate copie le fichier .lic sur Machine B:

Machine B - Tentative d'Activation:
┌─────────────────────────────┐
│ Import fichier .lic copié   │
│ Machine ID: 112233445566    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Vérification serveur:       │
│ ❌ Machine ID différent !   │
│ Enregistré: AABBCCDDEEFF    │
│ Tentative: 112233445566     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Serveur enregistre:         │
│ - piracy_attempts += 1      │
│ - last_piracy_attempt       │
│ - timestamp                 │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Réponse au client:          │
│ ❌ 409 CONFLICT             │
│ "Clé déjà utilisée sur      │
│  un autre ordinateur"       │
└──────────┬──────────────────┘
           │
           ▼
      ❌ BLOQUÉ

Si 3 tentatives:
┌─────────────────────────────┐
│ Auto-blacklist:             │
│ status = 'blacklisted'      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Machine A (client légitime) │
│ Au prochain démarrage:      │
│ ❌ Licence blacklistée      │
│ ❌ Application fermée       │
└─────────────────────────────┘
```

---

## 📊 Base de Données Complète

### Champs Enregistrés

```javascript
{
  // Identification
  license_key: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
  machine_id: "AABBCCDDEEFF",
  
  // Sécurité
  payload: "eyJsaWNlbnNl...",
  signature: "WZOaqQ8GSrhq...",
  status: "active", // unused, active, inactive, blacklisted
  
  // Expiration
  expire_at: "2027-02-02T17:14:19.727Z",
  max_devices: 1,
  
  // Compteurs
  activation_count: 1,
  validation_count: 145,
  
  // Anti-piratage
  piracy_attempts: 0,
  last_piracy_attempt: {
    machine_id: "112233445566",
    timestamp: "2026-02-02T18:30:00.000Z"
  },
  
  // Tracking
  first_activated_at: "2026-02-02T17:15:00.000Z",
  last_validation: "2026-02-03T14:22:00.000Z",
  last_ip: "192.168.1.100",
  
  // Blacklist
  blacklist_reason: "Piracy detected",
  blacklisted_at: "2026-02-03T15:00:00.000Z",
  
  // Métadonnées
  created_at: "2026-02-02T17:00:00.000Z",
  updated_at: "2026-02-03T14:22:00.000Z"
}
```

---

## 🚨 Détection de Piratage

### Cas Détectés

1. **Utilisation sur machine différente**
   - Machine A : AABBCCDDEEFF (enregistrée)
   - Machine B : 112233445566 (tentative)
   - → Bloqué immédiatement

2. **Utilisation simultanée**
   - Machine A connectée à 10h00
   - Machine B tentative à 10h05
   - → Détecté lors de la validation périodique
   - → Machine B bloquée

3. **Modification du fichier .lic**
   - Signature RSA invalide
   - → Rejeté dès la lecture

4. **Tentatives répétées**
   - 1ère tentative : bloquée + compteur = 1
   - 2ème tentative : bloquée + compteur = 2
   - 3ème tentative : bloquée + **BLACKLIST AUTO**

---

## 🛠️ API Serveur

### POST /api/license/activate
**Activation initiale avec sécurité**

```bash
curl -X POST http://13.60.180.65:3000/api/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "machine_id": "AABBCCDDEEFF"
  }'
```

**Réponses:**

✅ **Succès (200):**
```json
{
  "success": true,
  "expire_at": "2027-02-02T17:14:19.727Z",
  "payload": "eyJsaWNlbnNl...",
  "signature": "WZOaqQ8GSrhq...",
  "machine_id": "AABBCCDDEEFF",
  "first_activation": true
}
```

❌ **Piratage Détecté (409):**
```json
{
  "error": "Cette clé est déjà utilisée sur un autre ordinateur",
  "piracy_detected": true,
  "registered_machine": "AABBCCDD..."
}
```

❌ **Blacklistée (403):**
```json
{
  "error": "Cette licence a été désactivée",
  "blacklisted": true
}
```

### POST /api/license/validate
**Vérification périodique anti-piratage**

```bash
curl -X POST http://13.60.180.65:3000/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "machine_id": "AABBCCDDEEFF"
  }'
```

**Réponses:**

✅ **Valide (200):**
```json
{
  "valid": true,
  "expire_at": "2027-02-02T17:14:19.727Z",
  "status": "active",
  "unlimited": false
}
```

❌ **Machine Non Autorisée (409):**
```json
{
  "error": "Machine non autorisée",
  "valid": false,
  "piracy_detected": true
}
```

### POST /api/license/blacklist
**Blacklist manuelle (admin)**

```bash
curl -X POST http://13.60.180.65:3000/api/license/blacklist \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    "reason": "Violation terms of service"
  }'
```

### GET /api/license/stats/:license_key
**Statistiques de licence (admin)**

```bash
curl http://13.60.180.65:3000/api/license/stats/XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
```

**Réponse:**
```json
{
  "license_key": "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
  "status": "active",
  "machine_id": "AABBCCDDEEFF",
  "activation_count": 1,
  "validation_count": 145,
  "piracy_attempts": 2,
  "first_activated_at": "2026-02-02T17:15:00.000Z",
  "last_validation": "2026-02-03T14:22:00.000Z",
  "last_ip": "192.168.1.100",
  "expire_at": "2027-02-02T17:14:19.727Z",
  "created_at": "2026-02-02T17:00:00.000Z"
}
```

---

## ⚙️ Configuration Client

### Validation Périodique

**Fréquence:** Toutes les 30 minutes (configurable dans main.js)

```javascript
// Ligne 125 dans main.js
}, 30 * 60 * 1000); // 30 minutes

// Pour changer (ex: 1 heure):
}, 60 * 60 * 1000); // 60 minutes
```

### Actions Automatiques

**Si piratage détecté:**
1. Suppression de `license.json`
2. Affichage popup d'erreur
3. Fermeture automatique de l'application

**Si blacklist détectée:**
1. Suppression de `license.json`
2. Message : "Licence désactivée - Contactez le support"
3. Fermeture automatique

---

## 🧪 Tests de Sécurité

### Test 1: Activation Normale

```bash
# 1. Générer licence
cd license-server
node generate-offline-license.js unlimited

# 2. Démarrer serveur MongoDB + Express
npm start

# 3. Insérer dans MongoDB
use licenses
db.licenses.insertOne({
  license_key: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
  payload: "...",
  signature: "...",
  status: "unused",
  max_devices: 1
})

# 4. Activer dans l'application
npm run dev
# → Import .lic ou entrer clé
# → Vérifier console serveur: "✅ First activation successful"
```

### Test 2: Détection Piratage

```bash
# 1. Sur Machine A - Activer normalement
# 2. Copier license.json vers Machine B
# 3. Sur Machine B - Lancer l'application

# Résultat attendu:
# Console Machine B:
# "❌ License is bound to a different machine"
# "   Registered: AABBCCDDEEFF"
# "   Current:    112233445566"
# → license.json supprimé
# → Retour écran activation
```

### Test 3: Blacklist Automatique

```bash
# 1. Tenter activation depuis 3 machines différentes
# Machine A → Succès
# Machine B → Échec (piracy_attempts = 1)
# Machine C → Échec (piracy_attempts = 2)
# Machine D → Échec (piracy_attempts = 3 → BLACKLIST)

# 2. Sur Machine A (légitime):
# Au prochain démarrage ou validation:
# → Popup: "Licence désactivée"
# → Application fermée
```

### Test 4: Validation Périodique

```bash
# 1. Machine A activée normalement
# 2. Attendre 30 minutes
# 3. Vérifier console:
# "✅ Periodic validation successful"

# 4. Activer sur Machine B pendant ce temps
# 5. Après 30 min sur Machine A:
# "🚨 PIRACY DETECTED!"
# → Application fermée
```

---

## 📈 Dashboard Admin (Recommandé)

### Script pour Voir Toutes les Licences

Créer `license-server/admin-dashboard.js`:

```javascript
const mongoose = require('mongoose');
const License = require('./models/License');

mongoose.connect('mongodb://localhost:27017/licenses');

async function showAllLicenses() {
  const licenses = await License.find({});
  
  console.log('\n📊 LICENCES ACTIVES:\n');
  
  licenses.forEach(lic => {
    console.log(`Clé: ${lic.license_key}`);
    console.log(`Status: ${lic.status}`);
    console.log(`Machine: ${lic.machine_id || 'Non activée'}`);
    console.log(`Activations: ${lic.activation_count}`);
    console.log(`Validations: ${lic.validation_count || 0}`);
    console.log(`Tentatives piratage: ${lic.piracy_attempts || 0}`);
    console.log(`Dernière validation: ${lic.last_validation || 'Jamais'}`);
    console.log('---');
  });
  
  process.exit(0);
}

showAllLicenses();
```

**Usage:**
```bash
node license-server/admin-dashboard.js
```

---

## ✅ Checklist Sécurité

- [x] Machine ID vérifié localement
- [x] Machine ID vérifié serveur
- [x] Validation périodique (30 min)
- [x] Détection piratage en temps réel
- [x] Blacklist automatique (3 tentatives)
- [x] Blacklist manuelle (admin)
- [x] Signature RSA (anti-modification)
- [x] Tracking complet (IP, dates, compteurs)
- [x] Auto-fermeture si piratage
- [x] Auto-fermeture si blacklist
- [x] API statistiques admin
- [x] Enregistrement tentatives piratage

---

## 🎯 Résumé

**Protections Actives:**
1. ✅ Une licence = Une machine (MAC address)
2. ✅ Détection piratage temps réel (30 min)
3. ✅ Blacklist auto après 3 tentatives
4. ✅ Impossible de modifier .lic (RSA)
5. ✅ Tracking complet des activations
6. ✅ Désactivation à distance possible

**Comportement Client:**
- Sans Internet : Fonctionne en offline
- Avec Internet : Vérifie serveur toutes les 30 min
- Si piratage : Fermeture immédiate

**Niveau de Sécurité:** 🔒🔒🔒🔒🔒 (5/5)

**TOUT EST PRÊT POUR LA PRODUCTION !** ✅
