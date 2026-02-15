import { jsPDF } from 'jspdf';

// Font loading utility for jsPDF to support Unicode characters (Chinese, Japanese, Russian, etc.)
let fontDataLoaded = false;
let fontLoadAttempted = false;
let cachedFontData = null;
let currentFontStyle = 'normal';

/**
 * Load and add fonts to jsPDF for Unicode support
 * This enables proper rendering of Chinese, Japanese, Russian, and other non-Latin characters
 */
export const loadPdfFonts = async (doc) => {
  // If font data already loaded, add to this doc's VFS
  if (fontDataLoaded && cachedFontData) {
    try {
      doc.addFileToVFS('NotoSansCJKsc-Regular.ttf', cachedFontData);
      doc.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJK', 'normal');
      doc.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJK', 'bold');
      doc.setFont('NotoSansCJK', currentFontStyle);
      return true;
    } catch (e) {
      console.error('Error setting loaded font:', e);
      doc.setFont('helvetica');
      return false;
    }
  }

  // Don't try multiple times if it failed before
  if (fontLoadAttempted && !fontDataLoaded) {
    doc.setFont('helvetica');
    return false;
  }

  fontLoadAttempted = true;

  try {
    // Use IPC to read font file from Electron main process
    const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
    
    if (!ipcRenderer) {
      console.warn('⚠️ ipcRenderer not available - running in browser mode');
      doc.setFont('helvetica');
      return false;
    }

    console.log('🔤 Loading NotoSansCJK font for Chinese/Japanese/Korean support...');
    const fontData = await ipcRenderer.invoke('read-font-file', '/font/Noto_Sans/static/NotoSansCJKsc-Regular.ttf');
    
    if (!fontData) {
      console.error('❌ Font data is null or empty');
      doc.setFont('helvetica');
      return false;
    }

    console.log('✅ CJK Font data received, length:', fontData.length);
    
    // Cache the font data
    cachedFontData = fontData;
    fontDataLoaded = true;
    
    // Add the font to this doc's VFS
    doc.addFileToVFS('NotoSansCJKsc-Regular.ttf', fontData);
    doc.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJK', 'normal');
    doc.addFont('NotoSansCJKsc-Regular.ttf', 'NotoSansCJK', 'bold'); // Use same font for bold
    
    // Set as default font immediately
    doc.setFont('NotoSansCJK', 'normal');
    
    // Override setFontSize to maintain font after size changes
    const originalSetFontSize = doc.setFontSize.bind(doc);
    doc.setFontSize = function(size) {
      originalSetFontSize(size);
      // Reapply CJK font after font size change
      try {
        this.setFont('NotoSansCJK', currentFontStyle);
      } catch (e) {
        // Ignore if font setting fails
      }
      return this;
    };
    
    // Override text method to ensure font is always set
    const originalText = doc.text.bind(doc);
    doc.text = function(...args) {
      try {
        this.setFont('NotoSansCJK', currentFontStyle);
      } catch (e) {
        // Ignore if font setting fails
      }
      return originalText(...args);
    };
    
    console.log('✅ NotoSansCJK font loaded successfully! Chinese/Japanese/Korean characters will now display correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Error loading CJK font:', error);
    doc.setFont('helvetica');
    return false;
  }
};

/**
 * Create a new jsPDF instance with Unicode font support
 */
export const createPdfWithFonts = async () => {
  const doc = new jsPDF();
  await loadPdfFonts(doc);
  return doc;
};

/**
 * Set font for jsPDF document with Unicode support
 * @param {jsPDF} doc - The jsPDF document instance
 * @param {string} style - Font style: 'normal' or 'bold'
 */
export const setPdfFont = (doc, style = 'normal') => {
  currentFontStyle = style; // Track current style
  try {
    if (fontDataLoaded) {
      // CJK font doesn't have separate bold variant, we use the same font for both
      // Bold will be simulated by the PDF viewer
      doc.setFont('NotoSansCJK', style === 'bold' ? 'bold' : 'normal');
    } else {
      // Fallback to helvetica
      doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
    }
  } catch (error) {
    console.error('Error setting font:', error);
    doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
  }
};

/**
 * Get autoTable styles with Unicode font support
 * @returns {Object} - Styles object for autoTable
 */
export const getAutoTableStyles = () => {
  if (fontDataLoaded) {
    return { 
      font: 'NotoSansCJK',
      fontStyle: 'normal'
    };
  }
  return { font: 'helvetica' };
};
