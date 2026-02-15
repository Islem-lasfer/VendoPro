import JsBarcode from 'jsbarcode';

export const generateBarcodeDataUrl = (text, options = {}) => {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, String(text), { format: 'CODE128', displayValue: true, height: 40, margin: 0, ...options });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Barcode generation failed', e);
    return null;
  }
};
