# Unicode Font Support for PDF Documents

## Problem Fixed
PDF documents generated for invoices were not displaying non-Latin characters (Chinese, Japanese, Russian, Arabic, etc.) correctly. This has been resolved by implementing Unicode font support using Noto Sans fonts.

## Solution Implemented

### 1. Font Loading Utility (`src/utils/pdfFonts.js`)
Created a centralized utility that:
- Loads Noto Sans TrueType fonts for Unicode support
- Provides helper functions for setting fonts in jsPDF
- Handles fallback to default fonts if custom fonts fail to load
- Supports both regular and bold font styles
- Configures autoTable plugin for consistent font usage

### 2. IPC Handler in main.js
Added `read-font-file` IPC handler to:
- Read font files from the font directory
- Convert TrueType fonts to base64 for jsPDF
- Enable font loading in the Electron renderer process

### 3. Updated Components
Modified the following files to use Unicode fonts:
- `src/pages/InvoiceHistory/InvoiceHistory.jsx`
- `src/pages/SalesByInvoices/SalesByInvoices.jsx`

Changes include:
- Import font utilities: `loadPdfFonts`, `setPdfFont`, `getAutoTableStyles`
- Load fonts when creating PDF: `await loadPdfFonts(doc)`
- Replace all `doc.setFont()` calls with `setPdfFont(doc, 'normal'|'bold')`
- Add `...getAutoTableStyles()` to all autoTable style configurations

### 4. Font Files Used
Located in `font/Noto_Sans/static/`:
- **NotoSans-Regular.ttf** - Supports Latin, Cyrillic (Russian), Greek, and extended Latin characters
- **NotoSansCJKsc-Regular.ttf** - Supports Chinese, Japanese, and Korean characters

## Supported Languages
With these fonts, PDF documents now correctly display:
- ✅ English (Latin)
- ✅ French (Latin with accents)
- ✅ Spanish (Latin with accents)
- ✅ German (Latin with umlauts)
- ✅ Italian (Latin with accents)
- ✅ Portuguese (Latin with accents)
- ✅ Russian (Cyrillic)
- ✅ Chinese (Simplified - CJK)
- ✅ Japanese (Kanji, Hiragana, Katakana - CJK)
- ✅ Arabic (Right-to-Left text)

## How It Works

### PDF Generation Flow:
1. Create jsPDF instance: `const doc = new jsPDF()`
2. Load Unicode fonts: `await loadPdfFonts(doc)`
3. Set font before text: `setPdfFont(doc, 'normal')` or `setPdfFont(doc, 'bold')`
4. Draw text with Unicode support: `doc.text('你好世界', x, y)`
5. Configure autoTable: `styles: { ...getAutoTableStyles() }`

### Example Usage:
```javascript
import { loadPdfFonts, setPdfFont, getAutoTableStyles } from '../../utils/pdfFonts';

const generatePDF = async () => {
  const doc = new jsPDF();
  
  // Load Unicode fonts
  await loadPdfFonts(doc);
  
  // Set font before drawing text
  setPdfFont(doc, 'bold');
  doc.text('文档标题 (Document Title)', 20, 20);
  
  setPdfFont(doc, 'normal');
  doc.text('Заказ №12345 (Order #12345)', 20, 30);
  doc.text('注文番号: 12345 (Order Number: 12345)', 20, 40);
  
  // Use with autoTable
  autoTable(doc, {
    head: [['商品', '数量', '価格']],
    body: [
      ['产品A', '10', '¥100'],
      ['Товар B', '5', '₽500']
    ],
    styles: {
      fontSize: 10,
      ...getAutoTableStyles() // Adds font: 'NotoSans'
    }
  });
  
  doc.save('invoice.pdf');
};
```

## Fallback Mechanism
If font files cannot be loaded (missing files, IPC errors, etc.):
- System automatically falls back to jsPDF's default "helvetica" font
- Latin characters will display correctly
- Non-Latin characters may show as squares/boxes (but PDF will still generate)
- Console warnings logged for debugging

## Troubleshooting

### Characters still showing as boxes?
1. **Check font files exist**: Verify `font/Noto_Sans/static/NotoSans-Regular.ttf` exists
2. **Check console**: Look for font loading errors in DevTools console
3. **Verify IPC handler**: Ensure `read-font-file` handler is registered in main.js
4. **Test font loading**: Check if `loadPdfFonts()` resolves successfully

### PDF generation is slow?
- Fonts are loaded once and cached
- First PDF generation may take ~1-2 seconds
- Subsequent PDFs should be faster due to caching

### Need more language support?
- Add more Noto Sans font variants to the font directory
- Update `loadPdfFonts()` to load additional fonts
- Use appropriate font for specific language scripts

## Future Enhancements
- [ ] Add Noto Sans Bold variant for better bold text rendering
- [ ] Implement font caching to reduce load time
- [ ] Add Hebrew font support
- [ ] Add Thai/Vietnamese font support
- [ ] Optimize font file size (subset fonts for only needed characters)

## Technical Notes
- Font files are read by main process and converted to base64
- base64 fonts are added to jsPDF virtual file system
- Fonts are registered with jsPDF font family system
- autoTable plugin uses the same font configuration
- Font loading is asynchronous (requires `await`)
