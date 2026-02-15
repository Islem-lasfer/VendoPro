import { jsPDF } from 'jspdf';

// Minimal, backward-compatible multi-font loader for jsPDF
// - Adds Arabic (NotoNaskhArabic) support when requested
// - Keeps existing CJK behaviour as a fallback
// - Exposes getAutoTableStyles(isRTL) and accepts loadPdfFonts(doc, language)

let cachedFontData = {};
let loadedFamilies = {};
let currentFontFamily = 'helvetica';
let currentFontStyle = 'normal';

const isLanguageRTL = (lang) => {
  if (!lang) return false;
  const code = lang.split('-')[0];
  return ['ar', 'he', 'fa', 'ur'].includes(code);
};

const safeIpcRenderer = () => (window.require ? window.require('electron').ipcRenderer : null);

/**
 * Load fonts required for the requested language (returns true if at least one font loaded)
 * - language: optional BCP-47 language tag (e.g. 'ar', 'fr', 'zh-CN')
 */
export const loadPdfFonts = async (doc, language = '') => {
  if (!doc) return false;
  const ipcRenderer = safeIpcRenderer();
  if (!ipcRenderer) {
    // not running inside electron renderer (fallback)
    doc.setFont('helvetica');
    return false;
  }

  const wantRTL = isLanguageRTL(language);

  try {
    // Arabic requested -> load Noto Naskh Arabic
    if (wantRTL) {
      if (!loadedFamilies.NotoArabic) {
        const path = '/font/Noto_Arabic/static/NotoNaskhArabic-Regular.ttf';
        const fontData = await ipcRenderer.invoke('read-font-file', path);
        if (!fontData) throw new Error('Arabic font not found: ' + path);
        cachedFontData.NotoNaskhArabic = fontData;
        loadedFamilies.NotoArabic = true;
      }

      // Add to this doc's VFS and set as current
      try {
        doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', cachedFontData.NotoNaskhArabic);
        doc.addFont('NotoNaskhArabic-Regular.ttf', 'NotoArabic', 'normal');
        doc.addFont('NotoNaskhArabic-Regular.ttf', 'NotoArabic', 'bold');
        currentFontFamily = 'NotoArabic';
        doc.setFont(currentFontFamily, 'normal');
      } catch (e) {
        console.warn('Could not register Arabic font in jsPDF:', e);
      }

      // ensure setFontSize/text keep the font
      const originalSetFontSize = doc.setFontSize.bind(doc);
      doc.setFontSize = function (size) {
        originalSetFontSize(size);
        try { this.setFont(currentFontFamily, currentFontStyle); } catch (e) {}
        return this;
      };
      const originalText = doc.text.bind(doc);
      doc.text = function (...args) {
        try { this.setFont(currentFontFamily, currentFontStyle); } catch (e) {}
        return originalText(...args);
      };

      return true;
    }

    // Default behaviour (keep previous CJK support)
    if (!loadedFamilies.NotoSansCJK) {
      const path = '/font/Noto_Sans/static/NotoSansCJKsc-Regular.ttf';
      const fontData = await ipcRenderer.invoke('read-font-file', path);
      if (fontData) {
        cachedFontData.NotoSansCJK = fontData;
        loadedFamilies.NotoSansCJK = true;
      }
    }

    if (loadedFamilies.NotoSansCJK && cachedFontData.NotoSansCJK) {
      try {
        doc.addFileToVFS('NotoSansCJKsc-Regular.ttf', cachedFontData.NotoSansCJK);
        doc.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJK', 'normal');
        doc.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJK', 'bold');
        currentFontFamily = 'NotoSansCJK';
        doc.setFont(currentFontFamily, 'normal');

        // ensure setFontSize/text keep the font
        const originalSetFontSize = doc.setFontSize.bind(doc);
        doc.setFontSize = function (size) {
          originalSetFontSize(size);
          try { this.setFont(currentFontFamily, currentFontStyle); } catch (e) {}
          return this;
        };
        const originalText = doc.text.bind(doc);
        doc.text = function (...args) {
          try { this.setFont(currentFontFamily, currentFontStyle); } catch (e) {}
          return originalText(...args);
        };

        return true;
      } catch (e) {
        console.warn('Could not register CJK font in jsPDF:', e);
      }
    }

    // If nothing loaded, fallback
    doc.setFont('helvetica');
    currentFontFamily = 'helvetica';
    return false;
  } catch (err) {
    console.error('Error loading fonts for PDF:', err);
    doc.setFont('helvetica');
    currentFontFamily = 'helvetica';
    return false;
  }
};

/**
 * Create a new jsPDF instance with Unicode font support
 */
export const createPdfWithFonts = async (language = '') => {
  const doc = new jsPDF();
  await loadPdfFonts(doc, language);
  return doc;
};

/**
 * Set font for jsPDF document with Unicode support
 * @param {jsPDF} doc
 * @param {string} style - 'normal'|'bold'
 * @param {string} [family] - optional explicit family name
 */
export const setPdfFont = (doc, style = 'normal', family) => {
  currentFontStyle = style;
  if (family) currentFontFamily = family;
  try {
    if (currentFontFamily && currentFontFamily !== 'helvetica') {
      doc.setFont(currentFontFamily, style === 'bold' ? 'bold' : 'normal');
    } else {
      doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
    }
  } catch (e) {
    console.error('Error setting font:', e);
    doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
  }
};

/**
 * Return autoTable styles (font + default halign based on direction)
 * - Pass isRTL=true when generating RTL documents
 */
export const getAutoTableStyles = (isRTL = false) => {
  const font = currentFontFamily === 'NotoArabic' ? 'NotoArabic' : (currentFontFamily === 'NotoSansCJK' ? 'NotoSansCJK' : 'helvetica');
  return {
    font,
    fontStyle: 'normal',
    halign: isRTL ? 'right' : 'left'
  };
};

export { isLanguageRTL };
