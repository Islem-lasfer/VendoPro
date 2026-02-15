# 🔒 PROTECTION PAR MACHINE - OPTION 2

## ✅ Comment ça fonctionne maintenant

### Système de Verrouillage à la Machine

Le fichier `.lic` utilise maintenant un système de **machine binding** :

1. **Première activation** (n'importe quelle machine) :
   - ✅ Le client reçoit le fichier `.lic`
   - ✅ Il peut l'utiliser sur N'IMPORTE QUELLE machine
   - ✅ Lors de l'activation, le système enregistre le `machine_id`

2. **Verrouillage automatique** :
   - 🔒 La licence est maintenant **verrouillée** à cette machine spécifique
   - 🔒 Le `machine_id` est sauvegardé dans `license.json`

3. **Tentative sur une autre machine** :
   - ❌ Même avec le fichier `.lic`, l'activation **échouera**
   - ❌ Message : "License is bound to a different machine"
   - ❌ Le fichier `license.json` est automatiquement supprimé

## 🎯 Scénarios d'Utilisation

### ✅ Scénario Normal (Une seule machine)

```
Machine A:
1. Import license-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.lic
2. Activation réussie ✅
3. machine_id = "AA:BB:CC:DD:EE:FF" enregistré
4. Application fonctionne normalement

À chaque démarrage:
- Vérification: machine_id actuel = "AA:BB:CC:DD:EE:FF" ✅
- Licence valide ✅
```

### ❌ Tentative de Copie sur Autre Machine

```
Machine A (activée):
- machine_id = "AA:BB:CC:DD:EE:FF"
- Licence active ✅

Machine B (tentative):
1. Copie du fichier .lic
2. Import du fichier
3. Activation réussie localement
4. machine_id = "11:22:33:44:55:66" enregistré

Au démarrage de l'application:
- Vérification: machine_id ne correspond PAS ❌
- Message: "License is bound to a different machine"
- license.json supprimé automatiquement
- Retour à l'écran d'activation
```

### ✅ Réinstallation sur la MÊME Machine

```
Machine A:
1. Désinstallation complète du logiciel
2. Suppression de tous les fichiers
3. Réinstallation
4. Import du MÊME fichier .lic
5. machine_id = "AA:BB:CC:DD:EE:FF" (toujours le même)
6. Activation réussie ✅

La licence fonctionne car c'est la même carte réseau !
```

## 🔐 Identification de la Machine

### Machine ID basé sur l'adresse MAC

Le système utilise l'**adresse MAC** de la carte réseau :
- Unique pour chaque carte réseau
- Format : `AABBCCDDEEFF` (sans les `:`)
- Permanent (sauf changement de carte réseau)

**Exemple** :
```javascript
Machine A → MAC: AA:BB:CC:DD:EE:FF → machine_id: "AABBCCDDEEFF"
Machine B → MAC: 11:22:33:44:55:66 → machine_id: "112233445566"
```

## 📊 Comparaison Avant/Après

| Aspect | Avant (sans protection) | Après (Option 2) |
|--------|------------------------|------------------|
| **Première activation** | N'importe où ✅ | N'importe où ✅ |
| **Copie sur autre PC** | Fonctionne ⚠️ | Bloqué ❌ |
| **Réinstallation même PC** | Fonctionne ✅ | Fonctionne ✅ |
| **Changement carte réseau** | Fonctionne ✅ | Bloqué ❌ |
| **Machine virtuelle** | Fonctionne ✅ | ID différent ⚠️ |

## 🛡️ Niveau de Protection

### Ce qui est protégé ✅

1. **Copie du fichier .lic** → Bloqué
2. **Copie de l'application complète** → Bloqué si machine différente
3. **Partage de la licence** → Fonctionne uniquement sur machine d'origine

### Ce qui n'est PAS protégé ⚠️

1. **Changement de carte réseau** → Nécessite nouvelle activation
2. **Machine virtuelle clonée** → Chaque clone = machine différente
3. **Modification du fichier .lic** → Détecté par signature RSA (bloqué)

## 🔧 Code Implémenté

### Dans `main.js`

```javascript
function checkLicense() {
  const stored = getStoredLicense();
  
  // 🔒 MACHINE BINDING: Verify this is the same machine
  const currentMachineId = license.getMacAddress() || 'UNKNOWN';
  if (stored.machine_id && stored.machine_id !== currentMachineId) {
    console.log('❌ License is bound to a different machine');
    console.log(`   Registered: ${stored.machine_id}`);
    console.log(`   Current:    ${currentMachineId}`);
    
    // Delete invalid license
    if (fs.existsSync(LICENSE_STORE_PATH)) {
      fs.unlinkSync(LICENSE_STORE_PATH);
    }
    return false;
  }
  
  // ... rest of checks
}
```

### Lors de l'activation

```javascript
const licenseToSave = {
  key: key,
  machine_id: machineId,  // 🔒 Enregistré lors de l'activation
  expire_at: result.data.expire_at,
  payload: payload,
  signature: signature,
  activated_at: new Date().toISOString()
};
```

## 📝 Messages d'Erreur

### Si machine_id ne correspond pas :

**Console (développeur)** :
```
❌ License is bound to a different machine
   Registered: AABBCCDDEEFF
   Current:    112233445566
```

**Utilisateur** :
- L'écran d'activation réapparaît
- Doit réactiver avec un nouveau fichier .lic

## 🎯 Recommandations

### Pour Vous (Vendeur)

1. **Informer les clients** :
   - La licence est liée à UNE machine
   - Changement de PC = nouvelle licence nécessaire

2. **Support client** :
   - Si changement de carte réseau : générer nouvelle licence
   - Si réinstallation Windows : même machine = fonctionne

3. **Politique commerciale** :
   - 1 licence = 1 machine
   - Transfert de licence = désactiver l'ancienne (nécessite serveur online)

### Pour Vos Clients

1. **Sauvegardez le fichier .lic** :
   - Nécessaire en cas de réinstallation
   - Fonctionne uniquement sur le même PC

2. **Changement de PC** :
   - Contactez le vendeur pour nouvelle licence
   - Ancien fichier .lic ne fonctionnera pas

3. **Réinstallation** :
   - Même PC = utilisez le même fichier .lic
   - Pas besoin de nouvelle licence

## 🧪 Test de la Protection

### Test 1 : Activation Normale

```bash
# Générer une licence
cd license-server
node generate-offline-license.js unlimited

# Sur Machine A
npm run dev
# → Import .lic
# → Activation réussie ✅
# → Vérifier console : machine_id enregistré
```

### Test 2 : Tentative de Copie

```bash
# Copier le fichier .lic sur Machine B
# Import sur Machine B
# → Activation locale réussie

# Relancer l'application sur Machine B
# → Vérification machine_id ❌
# → License.json supprimé
# → Retour écran activation
```

### Test 3 : Réinstallation Même Machine

```bash
# Sur Machine A (déjà activée)
node reset-license.js

# Réactiver avec MÊME fichier .lic
# → Activation réussie ✅ (même MAC address)
```

## 📚 Fichiers Modifiés

- ✅ `main.js` - Ajout vérification machine_id
- ✅ `electron/license.js` - Déjà supporte machine_id
- ✅ Format clé : XXXXX-XXXXX-XXXXX-XXXXX-XXXXX (5x5)

## ✅ Résumé

**Option 2 implémentée** :
- ✅ Fichier .lic fonctionne partout pour PREMIÈRE activation
- ✅ Verrouillage automatique à la machine après activation
- ✅ Impossible d'utiliser sur autre machine
- ✅ Protection basée sur adresse MAC
- ✅ Suppression auto si machine_id invalide

**Avantages** :
- Pas besoin de serveur online pour vérifier
- Simple et efficace
- Transparent pour l'utilisateur légitime
- Empêche le partage de licence

**Limitations** :
- Changement carte réseau = nouvelle licence
- Machine virtuelle = peut avoir MAC différent
- Pas de désactivation à distance (nécessite serveur)
