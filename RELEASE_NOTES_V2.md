# 🎉 VERSION 2.0 - SYSTÈME DE LICENCE HYBRIDE ONLINE/OFFLINE

## 📅 Date de Release
**2 Février 2026**

## 🚀 Nouveautés Majeures

### Système de Licence Hybride
Le logiciel POS peut maintenant être activé **avec ou sans connexion Internet** en utilisant **la même clé de licence**.

#### ✅ Mode Online (Prioritaire)
- Vérification via serveur cloud Amazon (13.60.180.65:3000)
- Validation de la signature RSA
- Téléchargement du payload et signature pour utilisation offline
- Liaison à la machine (machine_id)
- Vérification anti-blacklist et limite d'activations

#### ✅ Mode Offline (Fallback Automatique)
- Fonctionne **sans Internet** après première activation online
- Vérification de la signature RSA en local avec clé publique
- Validation de la date d'expiration
- Pas besoin de connexion pour réactiver

## 📦 Nouveaux Fichiers

### Configuration
- `electron/public_key.pem` - Clé publique RSA pour vérification offline

### Documentation
- `LICENCE_HYBRIDE_README.md` - Documentation technique complète (60+ pages)
- `GUIDE_RAPIDE_ACTIVATION.md` - Guide utilisateur simplifié
- `IMPLEMENTATION_COMPLETE.md` - Récapitulatif de l'implémentation
- `RELEASE_NOTES_V2.md` - Ce fichier (notes de version)

### Tests
- `test-license-hybrid.js` - Suite de tests automatisés

### Serveur
- `license-server/config/generate-keys-complete.sh` - Script de génération de clés RSA
- `license-server/generate-test-license.js` - Générateur de licences de test

## 🔧 Fichiers Modifiés

### Core Application
- **electron/license.js**
  - Nouvelle fonction `activateLicense()` - Logique hybride
  - Nouvelle fonction `activateOnline()` - Activation via cloud
  - Nouvelle fonction `activateOffline()` - Activation locale
  - Nouvelle fonction `verifySignatureOffline()` - Vérification RSA

- **main.js**
  - Handler IPC `activate-license` mis à jour
  - Support du payload et signature pour mode offline
  - Stockage enrichi dans license.json

- **src/components/License/License.jsx**
  - Interface d'activation repensée
  - Messages utilisateur clairs (🌐 online, 🔌 offline, ✅ succès, ❌ erreur)
  - Fallback automatique vers mode offline si pas d'internet
  - Gestion des données locales pour activation offline

### Serveur Cloud
- **license-server/routes/license.js**
  - Endpoint `/activate` retourne maintenant `payload` et `signature`
  - Support complet pour activation hybride

## 🔐 Améliorations de Sécurité

### Vérifications Renforcées
- ✅ Signature RSA-SHA256 pour chaque licence
- ✅ Vérification locale possible sans serveur (mode offline)
- ✅ Payload signé contenant la date d'expiration
- ✅ Impossible de forger une signature sans clé privée
- ✅ Clé privée reste uniquement sur le serveur de génération

### Protections Anti-Piratage
- ❌ Impossible de modifier la date d'expiration (contenue dans payload signé)
- ❌ Impossible de copier sur un autre PC (machine_id vérifié)
- ❌ Impossible de contourner la vérification offline (signature RSA)

## 📊 Format de Données

### Clé de Licence
```
Format : XXXX-XXXX-XXXX-XXXX
Exemple : A3F2-B8D1-C9E4-F7A2
```

### Stockage Local (license.json)
```json
{
  "key": "A3F2-B8D1-C9E4-F7A2",
  "machine_id": "AABBCCDDEEFF",
  "expire_at": "2027-12-31T23:59:59.000Z",
  "payload": "eyJsaWNlbnNlX2tleSI6IkEzRjIt...",
  "signature": "dGVzdHNpZ25hdHVyZXRlc3Rz...",
  "activated_at": "2026-02-02T10:30:00.000Z",
  "mode": "online"
}
```

## 🎯 Scénarios d'Utilisation

### Scénario 1 : Première Installation (Internet requis)
```
1. L'utilisateur reçoit une clé : A3F2-B8D1-C9E4-F7A2
2. Lance l'application POS
3. Entre la clé de licence
4. L'application contacte le serveur cloud ✅
5. Télécharge payload et signature
6. Stocke tout localement
7. ✅ ACTIVÉ (mode online)
```

### Scénario 2 : Réactivation avec Internet
```
1. L'utilisateur relance l'application
2. Entre la clé de licence
3. Vérification online réussie ✅
4. ✅ ACTIVÉ (mode online)
```

### Scénario 3 : Réactivation sans Internet
```
1. L'utilisateur est sans connexion (mode avion)
2. Relance l'application
3. Entre la clé de licence
4. Tentative online échoue (timeout)
5. Fallback automatique vers mode offline
6. Vérification RSA locale réussie ✅
7. ✅ ACTIVÉ (mode offline)
```

## 🧪 Tests Effectués

### Tests Automatisés
- ✅ Récupération du Machine ID
- ✅ Vérification de la clé publique RSA
- ✅ Test du stockage de licence
- ✅ Activation offline
- ✅ Activation online
- ✅ Activation hybride (online → offline fallback)

### Tests Manuels
- ✅ Activation avec Internet fonctionnelle
- ✅ Activation sans Internet fonctionnelle (après première activation)
- ✅ Fallback automatique vérifié
- ✅ Messages utilisateur clairs
- ✅ Signature RSA validée
- ✅ Expiration vérifiée

## 📋 Checklist de Migration

### Pour les Utilisateurs Existants
- ⚠️ Une réactivation sera requise lors du premier lancement de v2.0
- ⚠️ Connexion Internet nécessaire pour la migration
- ✅ Après migration : fonctionne offline indéfiniment

### Pour les Nouvelles Installations
- ✅ Connexion Internet requise pour première activation uniquement
- ✅ Ensuite : fonctionne avec ou sans Internet

## 🚀 Mise à Jour

### Installation de la v2.0
```bash
# 1. Récupérer la dernière version
git pull origin main

# 2. Installer les dépendances
npm install

# 3. Lancer l'application
npm run dev
```

### Configuration du Serveur Cloud
```bash
# 1. Mettre à jour le serveur de licences
cd license-server
npm install

# 2. Redémarrer le serveur
node src/server.js

# 3. Générer une clé de test
node generate-test-license.js
```

## 🐛 Bugs Corrigés

### Version 1.0
- ❌ Activation impossible sans Internet
- ❌ Réactivation requise à chaque lancement
- ❌ Pas de vérification offline

### Version 2.0
- ✅ Activation possible offline après première activation online
- ✅ Stockage persistant de l'activation
- ✅ Vérification offline avec signature RSA

## 📞 Support

### Documentation
- **Technique** : [LICENCE_HYBRIDE_README.md](LICENCE_HYBRIDE_README.md)
- **Utilisateur** : [GUIDE_RAPIDE_ACTIVATION.md](GUIDE_RAPIDE_ACTIVATION.md)
- **Implémentation** : [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)

### Code Source
- **Client** : `electron/license.js`, `src/components/License/License.jsx`
- **Serveur** : `license-server/routes/license.js`
- **Tests** : `test-license-hybrid.js`

## ⚠️ Notes Importantes

### Limitations Mode Offline
- ❌ Ne peut pas vérifier les blacklists (nécessite connexion online)
- ❌ Ne peut pas synchroniser avec le serveur
- ✅ Fonctionne indéfiniment si licence non expirée

### Recommandations
- 🔄 Connexion online recommandée au moins une fois par mois
- 📊 Monitorer les activations offline sur le serveur
- ⚡ Tester le mode offline avant déploiement

## 🎉 Résultat

**La même clé de licence fonctionne maintenant en mode online ET offline !**

### Avantages de la v2.0
- ✅ Flexibilité maximale pour l'utilisateur
- ✅ Pas de dépendance Internet constante
- ✅ Sécurité renforcée avec RSA
- ✅ Activation plus rapide (pas d'attente réseau en offline)
- ✅ Meilleure expérience utilisateur

## 🏆 Conclusion

**Version 2.0 : Production Ready**

Le système de licence hybride est maintenant pleinement fonctionnel et prêt pour la production.

---

**Équipe de développement** : POS  
**Date de release** : 2 Février 2026  
**Version** : 2.0.0  
**Statut** : ✅ Stable

**Questions ?** Consultez la documentation complète dans [LICENCE_HYBRIDE_README.md](LICENCE_HYBRIDE_README.md)
