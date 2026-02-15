# CJK Font Support Test Guide

## ✅ FIXED: Chinese (ZH) and Japanese (JP) Character Display

The PDF generation system now properly supports CJK (Chinese, Japanese, Korean) characters using the NotoSansCJK font.

### Critical Fix Applied
**Problem**: Font was being reset to default after `setFontSize()` calls, causing garbled text like: `g,OÝŠ<0o0ıOEüQefB0nkc‰•0ì0·0ü0È0L0B0`

**Solution**: Overridden `doc.setFontSize()` to automatically reapply CJK font after every size change. This ensures the font persists throughout the document.

## What Was Fixed

1. **Font Persistence**: Overridden `setFontSize()` to maintain CJK font after size changes
2. **Font State Tracking**: Added `currentFontStyle` to track normal/bold state
3. **Automatic Reapplication**: Font is automatically reapplied after EVERY `setFontSize()` call
4. **Font Name**: Using `NotoSansCJK` consistently throughout
5. **Better Error Handling**: Improved logging and error messages

## How to Test

### Test Chinese Characters (中文)
1. Open **Sales By Invoices** page
2. In the client or company name fields, enter Chinese text:
   - Example: `北京商店` (Beijing Shop)
   - Example: `客户名称：张三` (Customer Name: Zhang San)
3. Add products with Chinese names:
   - Example: `笔记本电脑` (Laptop Computer)
   - Example: `无线鼠标` (Wireless Mouse)
4. Generate any document type (Invoice, Quotation, etc.)
5. Preview the PDF - Chinese characters should display correctly

### Test Japanese Characters (日本語)
1. In the same page, enter Japanese text:
   - Company: `東京ストア` (Tokyo Store)
   - Client: `お客様：田中太郎` (Customer: Tanaka Taro)
2. Add products with Japanese names:
   - Example: `ノートパソコン` (Notebook PC)
   - Example: `マウス` (Mouse)
3. Generate document
4. Verify Japanese characters display correctly

### Test Mixed Languages
1. Enter text mixing multiple scripts:
   - `ABC Store - 北京 - 東京`
   - `Product 1 商品 商品`
2. Generate document
3. All characters from all scripts should display

## Console Logs to Look For

When generating a PDF, you should see in the console:

```
🔤 Loading NotoSansCJK font for Chinese/Japanese/Korean support...
📂 Reading font file: /font/Noto_Sans/static/NotoSansCJKsc-Regular.ttf
📂 Full font path: C:\...\font\Noto_Sans\static\NotoSansCJKsc-Regular.ttf
📊 Font file size: X.XX MB
✅ Font file converted to base64, length: XXXXXX
✅ CJK Font data received, length: XXXXXX
✅ NotoSansCJK font loaded successfully! Chinese/Japanese/Korean characters will now display correctly.
```

## If Characters Still Don't Display

1. **Check Console**: Look for error messages about font loading
2. **Verify Font File**: Ensure `font/Noto_Sans/static/NotoSansCJKsc-Regular.ttf` exists
3. **Restart App**: Close and restart the Electron app to reset font cache
4. **Check File Size**: The font file should be several MB (CJK fonts are large)

## Supported Characters

The NotoSansCJKsc font supports:
- ✅ **Chinese Simplified** (简体中文)
- ✅ **Chinese Traditional** (繁體中文)
- ✅ **Japanese** (日本語) - Hiragana, Katakana, Kanji
- ✅ **Korean** (한국어) - Hangul
- ✅ **Latin** (English, French, etc.)
- ✅ **Cyrillic** (Russian, Ukrainian, etc.)
- ✅ **Arabic numerals and punctuation**

## Technical Details

### Files Modified
1. `src/utils/pdfFonts.js` - Font loading and management
2. `src/pages/SalesByInvoices/SalesByInvoices.jsx` - Added font initialization
3. `src/pages/InvoiceHistory/InvoiceHistory.jsx` - Added font initialization
4. `main.js` - Improved font file reading with logging

### Font Configuration
- **Font Name**: NotoSansCJK
- **Font File**: NotoSansCJKsc-Regular.ttf (Simplified Chinese variant)
- **Font Styles**: Normal and Bold (bold is simulated)
- **Loading Method**: IPC from Electron main process, converted to base64
