# Clavier Numérique Tactile - Documentation

## Vue d'ensemble
Un clavier numérique tactile a été ajouté au système POS pour faciliter la saisie sur les appareils tactiles. Le clavier s'active **automatiquement** pour tous les champs de type number lorsque l'option est activée dans les paramètres.

## ✨ Fonctionnement automatique

### Activation globale
Lorsque le clavier numérique est activé dans les paramètres :
- **Tous les inputs de type number** affichent automatiquement le clavier au clic
- Les inputs deviennent en lecture seule (pour éviter le clavier système)
- Le clavier remplace complètement la saisie au clavier physique

### Composant NumericInput
Un composant wrapper intelligent qui :
- Détecte si le clavier numérique est activé dans les paramètres
- S'il est activé : affiche le clavier tactile au clic
- S'il est désactivé : fonctionne comme un input number normal
- Gère automatiquement les validations (min, max, step)

## Fonctionnalités

### Paramètre d'activation
- **Chemin** : Paramètres → Langue → Clavier Numérique
- **Option** : Activer/Désactiver le clavier numérique
- **Par défaut** : Désactivé

### Composant NumericKeyboard
Un composant de clavier numérique réutilisable a été créé :

**Emplacement** : `src/components/NumericKeyboard/NumericKeyboard.jsx`

**Fonctionnalités** :
- Touches numériques (0-9)
- Point décimal (.)
- Backspace (⌫)
- Clear (C) - Efface tout
- Enter (✓) - Confirme la saisie
- Affichage en temps réel de la valeur
- Design responsive (mobile-friendly)
- Support des thèmes clair/sombre
- Support RTL pour l'arabe

### Hook personnalisé
**Fichier** : `src/hooks/useNumericKeyboard.js`

**Utilisation** :
```javascript
import useNumericKeyboard from '../../hooks/useNumericKeyboard';

const MyComponent = () => {
  const [value, setValue] = useState('');
  
  const {
    showKeyboard,
    keyboardValue,
    isEnabled,
    openKeyboard,
    closeKeyboard,
    handleKeyPress
  } = useNumericKeyboard((newValue) => {
    setValue(newValue);
  });

  return (
    <>
      <input
        type="text"
        value={value}
        onClick={() => openKeyboard(value)}
        readOnly={isEnabled}
      />
      
      {showKeyboard && (
        <NumericKeyboard
          currentValue={keyboardValue}
          onKeyPress={handleKeyPress}
          onClose={closeKeyboard}
        />
      )}
    </>
  );
};
```

## Traductions
Le clavier numérique est traduit dans les 10 langues :

- **Anglais** : Numeric Keyboard / Enabled / Disabled
- **Français** : Clavier Numérique / Activé / Désactivé
- **Arabe** : لوحة المفاتيح الرقمية / مفعّل / معطّل
- **Espagnol** : Teclado Numérico / Activado / Desactivado
- **Allemand** : Numerische Tastatur / Aktiviert / Deaktiviert
- **Italien** : Tastiera Numerica / Attivato / Disattivato
- **Portugais** : Teclado Numérico / Ativado / Desativado
- **Russe** : Цифровая Клавиатура / Включено / Отключено
- **Chinois** : 数字键盘 / 已启用 / 已禁用
- **Japonais** : 数字キーボード / 有効 / 無効

## Intégration dans les pages

### Exemple simple
```javascript
import NumericKeyboard from '../../components/NumericKeyboard/NumericKeyboard';
import useNumericKeyboard from '../../hooks/useNumericKeyboard';

const CheckoutPage = () => {
  const [quantity, setQuantity] = useState('1');
  
  const keyboard = useNumericKeyboard((value) => setQuantity(value));

  return (
    <div>
      <input
        type="text"
        value={quantity}
        onClick={() => keyboard.openKeyboard(quantity)}
        readOnly={keyboard.isEnabled}
      />
      
      {keyboard.showKeyboard && (
        <NumericKeyboard
          currentValue={keyboard.keyboardValue}
          onKeyPress={keyboard.handleKeyPress}
          onClose={keyboard.closeKeyboard}
        />
      )}
    </div>
  );
};
```

## Style et apparence

### Design
- **Overlay** : Fond semi-transparent noir
- **Popup** : Carte arrondie avec shadow
- **Touches** : Grandes et espacées pour faciliter le toucher
- **Couleurs** :
  - Touches normales : Couleur de carte
  - Backspace : Orange
  - Clear : Rouge
  - Enter : Vert
  - Point décimal : Bleu

### Animations
- Fade-in pour l'overlay
- Slide-up pour le popup du clavier
- Scale animation sur les touches au clic
- Transitions fluides

## Pages avec clavier numérique intégré

### ✅ Pages déjà mises à jour

1. **Products / Produits** ✅
   - Quantité à ajouter (Quick Update)
   - Prix détail
   - Prix gros
   - Quantité en stock

2. **SalesByInvoices / Caisse** ✅
   - Remise personnalisée
   - Garantie (années, mois, jours)

3. **Employees / Employés** ✅
   - Salaire
   - Absences
   - Déductions

### Comment utiliser NumericInput

Au lieu d'utiliser `<input type="number">`, utilisez `<NumericInput>` :

```javascript
import NumericInput from '../../components/NumericInput/NumericInput';

// Avant
<input
  type="number"
  value={price}
  onChange={(e) => setPrice(e.target.value)}
  min="0"
  step="0.01"
/>

// Après
<NumericInput
  value={price}
  onChange={(e) => setPrice(e.target.value)}
  min="0"
  step="0.01"
/>
```

Le composant NumericInput accepte les mêmes props qu'un input normal :
- `value` - Valeur actuelle
- `onChange` - Callback de changement
- `min` - Valeur minimale
- `max` - Valeur maximale
- `step` - Incrément
- `placeholder` - Texte d'indication
- `disabled` - Désactiver l'input
- `className` - Classes CSS
- `style` - Styles inline

## Pages suggérées pour intégration future

1. **Checkout / Caisse** : 
   - Quantité de produits
   - Montant reçu
   - Remise personnalisée

2. **Products / Produits** :
   - Prix d'achat
   - Prix de vente
   - Quantité en stock

3. **Employees / Employés** :
   - Salaire
   - Heures travaillées

4. **Supplier Invoices / Factures Fournisseurs** :
   - Montant de la facture
   - Quantités

## Fichiers créés

1. `src/components/NumericKeyboard/NumericKeyboard.jsx` - Composant de clavier
2. `src/components/NumericKeyboard/NumericKeyboard.css` - Styles du clavier
3. `src/components/NumericInput/NumericInput.jsx` - **Wrapper intelligent pour inputs**
4. `src/components/NumericInput/NumericInput.css` - Styles du wrapper
5. `src/hooks/useNumericKeyboard.js` - Hook personnalisé (usage avancé)
6. `src/pages/Settings/Settings.jsx` - Toggle d'activation
7. `src/pages/Settings/Settings.css` - Styles du toggle
8. `src/i18n.js` - Traductions (toutes les langues)
9. `src/context/SettingsContext.jsx` - Paramètre par défaut

## Fichiers modifiés pour intégration

1. `src/pages/Products/Products.jsx` - NumericInput ajouté ✅
2. `src/pages/SalesByInvoices/SalesByInvoices.jsx` - NumericInput ajouté ✅
3. `src/pages/Employees/Employees.jsx` - NumericInput ajouté ✅

## Notes techniques

- Le clavier se ferme automatiquement quand on clique en dehors
- La touche "Enter" confirme et ferme le clavier
- Le paramètre est sauvegardé dans localStorage
- Compatible avec les thèmes clair et sombre
- Support RTL pour l'arabe
- Responsive pour mobile et tablette
