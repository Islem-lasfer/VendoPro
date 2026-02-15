# 🎯 GUIDE COMPLET: ACTIVATION OFFLINE (Première Fois)

## 📖 Problème Résolu
**Avant**: Première activation nécessitait Internet obligatoirement  
**Maintenant**: Première activation possible 100% OFFLINE avec fichier .lic  
**Solution**: Import de fichier de licence pré-signé

---

## 🔧 CONFIGURATION INITIALE (Une seule fois)

### Étape 1: Générer les clés RSA

```bash
cd license-server/config
./generate-keys.sh
```

**Résultat**:
- ✅ `private_key.pem` → Clé privée (GARDER SECRET sur le serveur)
- ✅ `public_key.pem` → Clé publique (copier dans `electron/public_key.pem`)

**IMPORTANT**: 
- 🔴 **NE JAMAIS** partager `private_key.pem`
- 🔴 **NE JAMAIS** commit `private_key.pem` dans Git
- 🟢 `public_key.pem` peut être distribué avec l'application

### Étape 2: Vérifier l'installation

```bash
# Doit exister:
ls -l license-server/config/private_key.pem
ls -l electron/public_key.pem

# Si public_key.pem manque dans electron/:
cp license-server/config/public_key.pem electron/
```

---

## 📦 GÉNÉRER UNE LICENCE OFFLINE

### Commande Rapide

```bash
cd license-server
node generate-offline-license.js [mois_validité]
```

**Exemples**:
```bash
node generate-offline-license.js      # 12 mois par défaut
node generate-offline-license.js 6    # 6 mois
node generate-offline-license.js 24   # 24 mois
```

### Résultat

Le script crée:
```
license-server/licenses/license-XXXX-XXXX-XXXX-XXXX.lic
```

**Contenu du fichier .lic**:
```json
{
  "license_key": "ABCD-1234-EFGH-5678",
  "payload": "eyJsaWNlbnNlX2tleSI6IkFCQ0QtMTIzNC...",
  "signature": "TGhJ8kR2VmP5...",
  "expire_at": "2025-12-31T23:59:59.000Z",
  "max_devices": 1,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Ce fichier contient**:
- ✅ Clé de licence
- ✅ Payload chiffré avec date d'expiration
- ✅ Signature RSA (preuve d'authenticité)
- ✅ Métadonnées (max devices, date de création)

---

## 👥 DONNER LA LICENCE AU CLIENT

### Option 1: Activation OFFLINE (Sans Internet) ⭐ NOUVEAU

**Pour les clients SANS Internet dans leur magasin**

1. **Envoyer le fichier au client**:
   - Email: Joindre `license-XXXX-XXXX-XXXX-XXXX.lic`
   - USB: Copier le fichier .lic sur clé USB
   - Cloud: Google Drive, Dropbox, etc.

2. **Instructions pour le client**:
   ```
   a) Lancer l'application POS
   b) Écran de licence apparaît
   c) Cliquer sur "📄 Ou utiliser un fichier de licence"
   d) Sélectionner le fichier .lic reçu
   e) ✅ Activation réussie sans Internet !
   ```

3. **Vérification**:
   - Message de succès: "✅ Activation offline réussie avec fichier de licence !"
   - Application démarre normalement
   - Licence valide jusqu'à la date d'expiration

### Option 2: Activation ONLINE (Avec Internet)

**Pour les clients AVEC Internet**

1. **Insérer dans MongoDB**:

```javascript
// Se connecter à MongoDB
use licenses

// Insérer la licence
db.licenses.insertOne({
  license_key: "ABCD-1234-EFGH-5678",  // La même clé !
  payload: "eyJsaWNlbnNlX2tleSI6...",
  signature: "TGhJ8kR2VmP5...",
  expire_at: ISODate("2025-12-31T23:59:59.000Z"),
  max_devices: 1,
  status: "inactive",
  activation_count: 0,
  created_at: ISODate("2024-01-15T10:30:00.000Z")
})
```

2. **Instructions pour le client**:
   ```
   a) Lancer l'application POS
   b) Écran de licence apparaît
   c) Entrer la clé: ABCD-1234-EFGH-5678
   d) Cliquer "Activer"
   e) ✅ Activation online réussie !
   ```

---

## 🔄 COMMENT ÇA FONCTIONNE ?

### Mode Offline (Fichier .lic)

```
┌─────────────────┐
│ Client importe  │
│  fichier .lic   │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Application lit:    │
│ - license_key       │
│ - payload (données) │
│ - signature (RSA)   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Vérification RSA    │
│ avec public_key.pem │
└────────┬────────────┘
         │
    ┌────┴────┐
    │ Valid ? │
    └────┬────┘
         │
    ┌────▼─────┐
    │ OUI │ NON│
    │  ✅  │ ❌ │
    └──────────┘
```

**Sécurité**:
- ✅ Signature RSA empêche la falsification
- ✅ Seules les licences signées avec `private_key.pem` sont valides
- ✅ Impossible de créer un fichier .lic sans la clé privée
- ✅ Date d'expiration vérifiée localement

### Mode Online (Clé manuelle)

```
┌─────────────────┐
│ Client entre    │
│ la clé manuellement │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Tentative Online:   │
│ POST /api/activate  │
└────────┬────────────┘
         │
    ┌────▼──────┐
    │ Internet? │
    └────┬──────┘
         │
    ┌────┴─────────────┐
    │                  │
   OUI                NON
    │                  │
    ▼                  ▼
┌──────────┐      ┌──────────┐
│ Serveur  │      │ Erreur:  │
│ valide   │      │ Pas de   │
│ + renvoie│      │ données  │
│ payload/ │      │ offline  │
│ signature│      │          │
└────┬─────┘      └──────────┘
     │
     ▼
  ✅ OK
```

---

## 📊 TABLEAU COMPARATIF

| Critère | Mode Offline (.lic) | Mode Online (Clé) |
|---------|---------------------|-------------------|
| **Internet requis** | ❌ Non | ✅ Oui |
| **Première activation** | ✅ Oui | ✅ Oui |
| **Fichier à envoyer** | Fichier .lic | Juste la clé |
| **Sécurité** | RSA Signature | Serveur + RSA |
| **Validité** | Même durée | Même durée |
| **Base de données** | Pas nécessaire | MongoDB requis |
| **Idéal pour** | Magasins sans Net | Magasins avec Net |

**Clé importante**: LA MÊME CLÉ fonctionne dans les deux modes !

---

## 🧪 TESTER LE SYSTÈME

### Test 1: Activation Offline

```bash
# 1. Générer une licence test
cd license-server
node generate-offline-license.js 1  # 1 mois de test

# 2. Réinitialiser l'application
cd ..
node reset-license.js

# 3. Lancer l'app
npm run dev

# 4. Dans l'interface:
# - Clic "📄 Ou utiliser un fichier de licence"
# - Sélectionner: license-server/licenses/license-XXXX-XXXX-XXXX-XXXX.lic
# - ✅ Devrait s'activer sans Internet
```

### Test 2: Activation Online

```bash
# 1. Utiliser la même clé générée au Test 1

# 2. Insérer dans MongoDB
# (Voir "Option 2: Activation ONLINE" ci-dessus)

# 3. Réinitialiser l'application
node reset-license.js

# 4. Lancer l'app
npm run dev

# 5. Dans l'interface:
# - Entrer la clé: XXXX-XXXX-XXXX-XXXX
# - Clic "Activer"
# - ✅ Devrait s'activer avec Internet
```

---

## ❓ FAQ

### Q: Combien de licences offline puis-je créer ?
**R**: Autant que vous voulez ! Chaque `node generate-offline-license.js` crée une nouvelle clé unique.

### Q: Le fichier .lic peut-il être copié/partagé ?
**R**: Oui mais attention ! Un fichier .lic = 1 licence valide. Si vous le partagez, plusieurs personnes peuvent l'utiliser. C'est comme une clé physique : protégez-la.

### Q: Puis-je révoquer une licence offline ?
**R**: Non, une fois le fichier .lic généré, il est valide jusqu'à sa date d'expiration. C'est le compromis pour fonctionner sans Internet.

### Q: Comment gérer les renouvellements ?
**R**: Générez un nouveau fichier .lic avec une nouvelle date d'expiration et envoyez-le au client. Il devra réimporter le nouveau fichier.

### Q: La clé publique doit-elle être secrète ?
**R**: Non ! `public_key.pem` peut être distribué dans l'application. Seule `private_key.pem` doit rester secrète.

### Q: Que se passe-t-il après expiration ?
**R**: L'application détecte l'expiration et demande une nouvelle activation. Envoyez un nouveau fichier .lic ou une nouvelle clé.

---

## 🚀 WORKFLOW COMPLET VENDEUR

### Configuration initiale (une fois)
```bash
# 1. Générer les clés RSA
cd license-server/config
./generate-keys.sh

# 2. Copier public_key.pem dans l'application
cp public_key.pem ../../electron/

# 3. Compiler l'application
cd ../..
npm run build

# ✅ Prêt à vendre !
```

### Pour chaque nouveau client

```bash
# 1. Générer licence offline
cd license-server
node generate-offline-license.js 12  # 12 mois

# 2. Récupérer les infos
# Fichier: licenses/license-XXXX-XXXX-XXXX-XXXX.lic
# Clé: XXXX-XXXX-XXXX-XXXX

# 3a. Client SANS Internet → Envoyer fichier .lic
# 3b. Client AVEC Internet → Envoyer clé + insérer dans MongoDB

# ✅ Client peut activer !
```

---

## 📝 FICHIERS IMPORTANTS

```
project/
├── license-server/
│   ├── config/
│   │   ├── private_key.pem      # 🔴 SECRET - Serveur seulement
│   │   ├── public_key.pem       # 🟢 Public
│   │   └── generate-keys.sh     # Script génération clés
│   ├── licenses/                # Dossier licences générées
│   │   ├── license-ABC1-2345-DEF6-7890.lic
│   │   └── license-XYZ9-8765-UVW4-3210.lic
│   └── generate-offline-license.js  # 🎯 Script principal
├── electron/
│   ├── public_key.pem          # 🟢 Copie de la clé publique
│   └── license.js              # Module vérification
└── src/
    └── components/
        └── License/
            └── License.jsx     # Interface utilisateur
```

---

## ✅ CHECKLIST AVANT DISTRIBUTION

- [ ] Clés RSA générées (`private_key.pem` et `public_key.pem`)
- [ ] `public_key.pem` copié dans `electron/`
- [ ] Licence offline générée pour le client
- [ ] Fichier .lic testé dans l'application
- [ ] Application compilée (`npm run build`)
- [ ] `private_key.pem` en sécurité (PAS dans Git!)
- [ ] Documentation client préparée

---

## 🎉 RÉSUMÉ

**Avant**: 
- ❌ Internet obligatoire pour première activation
- ❌ Impossible d'utiliser dans magasins sans connexion

**Maintenant**:
- ✅ Activation offline possible dès la première fois
- ✅ Fichier .lic pré-signé avec RSA
- ✅ Même clé fonctionne online ET offline
- ✅ Sécurisé avec signature cryptographique
- ✅ Parfait pour magasins sans Internet

**La solution parfaite pour vos clients !** 🎯
