# Color Customization Feature

## Overview
Added a comprehensive color customization feature that allows users to change the primary color scheme of the POS software from the Settings page.

## What Was Added

### 1. **Settings Context Enhancement** (`SettingsContext.jsx`)
- Added `primaryColor` field to default settings (default: `#ff6600` - orange)
- Implemented dynamic CSS variable application using `document.documentElement.style.setProperty()`
- Added automatic hover color calculation (lighter shade of selected color)
- RGB conversion utility for color manipulation

### 2. **Settings UI** (`Settings.jsx`)
- Added "Primary Color" section under Appearance settings
- **Preset Colors**: 8 popular color options with visual buttons
  - Orange (#ff6600) - Default
  - Blue (#0066ff)
  - Green (#00cc66)
  - Red (#ff3333)
  - Purple (#9933ff)
  - Pink (#ff3399)
  - Yellow (#ffcc00)
  - Teal (#00cccc)
- **Custom Color Picker**: HTML5 color input for unlimited color choices
- Real-time color preview with hex code display
- Active color indication with checkmark and border highlight

### 3. **Styling** (`Settings.css`)
- `.color-picker-container`: Flex layout for color options
- `.preset-colors`: Grid layout for preset color buttons (auto-fit)
- `.color-preset`: Circular color buttons with hover effects
  - 50x50px size
  - Scale animation on hover (1.1x)
  - Active state with border and shadow
- `.custom-color-picker`: Custom color input section with styled components
- `.color-input`: Styled native color picker (60x40px)
- `.color-value`: Monospace font for hex code display

### 4. **Translations** (`i18n.js`)
Added color customization translations for all 10 supported languages:
- **English**: "Primary Color", "Customize the main accent color of the interface", "Custom Color:"
- **French**: "Couleur Principale", "Personnalisez la couleur d'accentuation principale de l'interface", "Couleur Personnalisée:"
- **Arabic**: "اللون الأساسي", "قم بتخصيص لون التمييز الرئيسي للواجهة", "لون مخصص:"
- **Spanish**: "Color Principal", "Personaliza el color de acento principal de la interfaz", "Color Personalizado:"
- **German**: "Primärfarbe", "Passen Sie die Hauptakzentfarbe der Benutzeroberfläche an", "Benutzerdefinierte Farbe:"
- **Italian**: "Colore Primario", "Personalizza il colore principale dell'interfaccia", "Colore Personalizzato:"
- **Portuguese**: "Cor Principal", "Personalize a cor de destaque principal da interface", "Cor Personalizada:"
- **Russian**: "Основной Цвет", "Настройте основной акцентный цвет интерфейса", "Пользовательский Цвет:"
- **Chinese**: "主色调", "自定义界面的主要强调色", "自定义颜色："
- **Japanese**: "プライマリカラー", "インターフェースのメインアクセントカラーをカスタマイズ", "カスタムカラー："

## How It Works

### Color Application Flow
1. User selects a color (preset or custom)
2. `handleChange('primaryColor', value)` updates local settings
3. `updateSettings()` called on save
4. SettingsContext updates and saves to localStorage
5. `useEffect` in SettingsContext applies color to CSS variables:
   - `--primary-color`: Main accent color
   - `--primary-hover`: Calculated lighter shade for hover states
6. All UI elements using these variables update instantly

### Technical Implementation
```javascript
// Color Application
document.documentElement.style.setProperty('--primary-color', color);

// Hover Color Calculation
const rgb = hexToRgb(color);
const hoverColor = `rgb(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)})`;
document.documentElement.style.setProperty('--primary-hover', hoverColor);
```

### CSS Variables Usage
The entire application uses CSS variables throughout:
- Buttons: `background-color: var(--primary-color)`
- Links: `color: var(--primary-color)`
- Borders: `border-color: var(--primary-color)`
- Shadows: `box-shadow: 0 0 0 2px var(--primary-color)`
- Hover states: `background-color: var(--primary-hover)`

## User Experience

### Features
✅ **8 Preset Colors**: Quick selection of popular colors  
✅ **Custom Color Picker**: Unlimited color possibilities  
✅ **Real-time Preview**: See changes instantly  
✅ **Persistent Settings**: Colors saved to localStorage  
✅ **Hover Calculations**: Automatic lighter shade generation  
✅ **Visual Feedback**: Active state indicators  
✅ **Multilingual**: Fully translated in 10 languages  
✅ **Responsive**: Works on all screen sizes  

### Accessibility
- Large clickable areas (50x50px for presets)
- Clear visual indicators for active state
- Hex code display for precise color selection
- Native color picker integration

## Files Modified
1. `src/context/SettingsContext.jsx` - Added color state and application logic
2. `src/pages/Settings/Settings.jsx` - Added color picker UI
3. `src/pages/Settings/Settings.css` - Added color picker styles
4. `src/i18n.js` - Added translations for all 10 languages

## Future Enhancements
- Color schemes (save multiple color combinations)
- Secondary color customization
- Background color options
- Color accessibility checker (contrast ratios)
- Import/export color themes
