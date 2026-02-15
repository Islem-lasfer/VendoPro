# Guide de Débogage - Clavier Numérique

## Si le clavier ne s'affiche pas :

### 1️⃣ Activer le clavier numérique

1. Allez dans **Paramètres** (Settings)
2. Trouvez la section **🌍 Langue**
3. Activez le toggle **"Clavier Numérique"** / **"Numeric Keyboard"**
4. Cliquez sur **💾 Enregistrer les modifications** (Save Changes)

### 2️⃣ Tester immédiatement

Un champ de test apparaît automatiquement dans les paramètres :
- Cliquez sur le champ "Click here to test the keyboard"
- Le clavier devrait s'afficher immédiatement

### 3️⃣ Vérifier dans la console

Ouvrez la console du navigateur (F12) et vérifiez :

**Au chargement de la page :**
```
NumericInput - Settings from localStorage: {...}
NumericInput - enableNumericKeyboard: true/false
```

**Quand vous cliquez sur un champ :**
```
NumericInput clicked - isEnabled: true/false, disabled: false, readOnly: false
```

**Si le clavier devrait s'afficher :**
```
Keyboard should show now
```

**Si le clavier ne s'affiche pas :**
```
Keyboard not shown because: { isEnabled: false, ... }
```

### 4️⃣ Vérifier localStorage

Dans la console, exécutez :
```javascript
JSON.parse(localStorage.getItem('posSettings'))
```

Vous devriez voir :
```javascript
{
  enableNumericKeyboard: true,
  theme: "dark",
  ...
}
```

### 5️⃣ Forcer le rechargement

Si le toggle est activé mais le clavier ne fonctionne pas :

1. Rafraîchissez la page (F5)
2. Ou allez sur une autre page et revenez

### 6️⃣ Réinitialiser si nécessaire

Dans la console :
```javascript
// Forcer l'activation
let settings = JSON.parse(localStorage.getItem('posSettings') || '{}');
settings.enableNumericKeyboard = true;
localStorage.setItem('posSettings', JSON.stringify(settings));
window.dispatchEvent(new Event('settingsUpdated'));
```

## Pages avec clavier intégré

Une fois activé, le clavier fonctionne sur :

✅ **Products** - Prix, quantités
✅ **SalesByInvoices (Caisse)** - Remise, garantie
✅ **Employees** - Salaire, absences, déductions
✅ **Settings** - Champ de test

## Comportement attendu

- **Clavier ACTIVÉ** : Clic sur input → Clavier s'affiche
- **Clavier DÉSACTIVÉ** : Comportement normal (clavier système)

## Notes importantes

- Le paramètre est sauvegardé dans `localStorage.posSettings`
- Les changements sont appliqués immédiatement après sauvegarde
- Un événement `settingsUpdated` est émis pour notifier tous les composants
