  import Notification from '../../components/Notification/Notification';
  // Beep sound (copied from Checkout)
  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Beep sound not available:', error);
    }
  };

import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllProducts, getAllSettings, getAllInvoices, createInvoice, createSupplierInvoice, searchClients, createClient } from '../../utils/database';
// Lazy-load pdf font utilities to enable dynamic chunking and reduce main bundle size
let pdfFontsModulePromise = null;
const getPdfFontsModule = () => {
  if (!pdfFontsModulePromise) pdfFontsModulePromise = import('../../utils/pdfFonts');
  return pdfFontsModulePromise;
};
// Safe synchronous fallbacks until the module is loaded
let setPdfFont = (doc, style = 'normal') => { try { doc.setFont(style === 'bold' ? 'helvetica' : 'helvetica'); } catch (e) {} };
let getAutoTableStyles = () => ({ font: 'helvetica' });
import NumericInput from '../../components/NumericInput/NumericInput';
import '../../pages/Checkout/Checkout.css';
import 'jspdf-autotable';
import { generateBarcodeDataUrl } from '../../utils/barcode';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };


const DOCUMENT_TYPES = [
  { value: 'devis', label: 'SalesByInvoices.quotation' },
  { value: 'bon_commande', label: 'SalesByInvoices.purchaseOrder' },
  { value: 'bon_livraison', label: 'SalesByInvoices.deliveryNote' },
  { value: 'facture', label: 'SalesByInvoices.invoice' },
  { value: 'proforma', label: 'SalesByInvoices.proforma' },
  { value: 'garantie', label: 'SalesByInvoices.garantie' },
];

const initialFormData = {
  clientName: '',
  clientAddress: '',
  clientEmail: '',
  clientPhone: '',
  clientRC: '',
  clientAI: '',
  clientNIS: '',
  date: new Date().toISOString().slice(0, 10),
  productName: '',
  serialNumber: '',
  paymentTerms: '',
  paymentStatus: 'unpaid',
  taxId: '',
  companyName: '',
  companyAddress: '',
  companyContact: '',
  companyTaxId: '',
  companyRC: '',
  companyAI: '',
  companyNIS: '',
  linkedDocId: '', // for workflow
};

const SalesByInvoices = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n && ['ar','he','fa','ur'].includes(i18n.language);
  // Payment status options
  const paymentStatusOptions = [
    { value: 'unpaid', label: t('SalesByInvoices.unpaid') },
    { value: 'paid', label: t('SalesByInvoices.paid') },
    { value: 'partial', label: t('SalesByInvoices.partial') },
    { value: 'overdue', label: t('SalesByInvoices.overdue') },
  ];
  const { settings } = useSettings();
  // Restore docType and formData from localStorage if available
  const [docType, setDocType] = useState(() => {
    const saved = localStorage.getItem('docGenDocType');
    return saved || 'devis';
  });
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('docGenFormData');
    if (saved) {
      try {
        // Always update date to today, even when loading from localStorage
        return { ...initialFormData, ...JSON.parse(saved), date: new Date().toISOString().slice(0, 10) };
      } catch {
        return initialFormData;
      }
    }
    return initialFormData;
  });
  // Workflow state: track linked docs (simulate with local state for now)
  const [linkedQuotation, setLinkedQuotation] = useState(null);
  const [linkedOrder, setLinkedOrder] = useState(null);
  const [linkedDelivery, setLinkedDelivery] = useState(null);

  // Issuer/company info (auto-populate from settings)
  useEffect(() => {
    setFormData(fd => ({
      ...fd,
      companyName: settings.posName || '',
      companyAddress: settings.shopAddress || '',
      companyContact: settings.phone1 || settings.email || '',
      companyTaxId: settings.taxId || '',
      companyRC: settings.rc || '',
      companyAI: settings.ai || '',
      companyNIS: settings.nis || '',
      paymentTerms: settings.paymentTerms || '',
    }));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('docGenFormData', JSON.stringify(formData));
  }, [formData]);

  // Customer info: could be loaded from a customer DB, here we add a client search and optional persistence
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(formData.clientId || '');

  // Normalize various shapes of client search responses to an array
  const normalizeClientResponse = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.data && Array.isArray(res.data)) return res.data;
    if (res.success && res.data && Array.isArray(res.data.results)) return res.data.results;
    if (res.items && Array.isArray(res.items)) return res.items;
    // Unexpected shape — log for debugging
    console.warn('normalizeClientResponse: unexpected response shape', res);
    return [];
  };

  // Debounced search for clients
  useEffect(() => {
    const q = clientSearchQuery.trim();
    // If query too short, clear results and ensure loading is false
    if (q.length < 2) {
      setClientSearchResults([]);
      setClientSearchLoading(false);
      return;
    }
    setClientSearchLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await searchClients(q);
        const list = normalizeClientResponse(res);
        setClientSearchResults(list);
      } catch (e) {
        console.error('Client search error', e);
        setClientSearchResults([]);
      } finally {
        setClientSearchLoading(false);
      }
    }, 300);
    // When the effect is cleaned up (new query/typing faster), clear timeout and reset loading
    return () => { clearTimeout(handler); setClientSearchLoading(false); };
  }, [clientSearchQuery]);

  const selectClient = (client) => {
    // Debug: log client object to help troubleshoot missing address
    console.debug('selectClient: selected client', client);

    const address = client.address || client.clientAddress || client.client_address || client.address1 || '';

    // Update global form and also the active tab so selection persists per-checkout
    setFormData(fd => ({ ...fd, clientName: client.name || '', clientAddress: address, clientEmail: client.email || '', clientPhone: client.phone || '', clientId: client.id }));
    setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, clientName: client.name || '', clientAddress: address, clientEmail: client.email || '', clientPhone: client.phone || '', clientId: client.id } : tab));
    setSelectedClientId(client.id);
    setClientSearchQuery(client.name || '');
    setClientSearchResults([]);
  };

  // Manual client creation removed - clients are created automatically when saving/printing an invoice or processing payment.

  // Ensure client exists in DB before saving invoices (returns client id or null)
  const ensureClientExists = async () => {
    try {
      if (formData.clientId) return formData.clientId;

      const byEmail = formData.clientEmail && formData.clientEmail.trim();
      const byPhone = formData.clientPhone && formData.clientPhone.trim();
      const byName = formData.clientName && formData.clientName.trim();

      let found = null;
      if (byEmail) {
        const res = await searchClients(byEmail);
        const list = res && (res.data || res) ? (res.data || res) : [];
        found = list.find(c => c.email && c.email.toLowerCase() === byEmail.toLowerCase());
        if (!found && list.length > 0) found = list[0];
      }
      if (!found && byPhone) {
        const res = await searchClients(byPhone);
        const list = res && (res.data || res) ? (res.data || res) : [];
        found = list.find(c => c.phone && c.phone === byPhone) || list[0];
      }
      if (!found && byName) {
        const res = await searchClients(byName);
        const list = res && (res.data || res) ? (res.data || res) : [];
        found = list.find(c => c.name && c.name.toLowerCase() === byName.toLowerCase()) || list[0];
      }

      if (found && found.id) {
        setFormData(fd => ({ ...fd, clientId: found.id, clientName: found.name || fd.clientName, clientEmail: found.email || fd.clientEmail, clientPhone: found.phone || fd.clientPhone, clientAddress: found.address || fd.clientAddress }));
        return found.id;
      }

      if (byName || byEmail || byPhone) {
        const newClient = { name: byName || (byEmail ? byEmail : 'Client'), phone: byPhone || null, email: byEmail || null, address: formData.clientAddress || null };
        const cr = await createClient(newClient);
        const created = cr && (cr.data || cr) ? (cr.data || cr) : null;
        if (created && created.id) {
          setFormData(fd => ({ ...fd, clientId: created.id }));
          return created.id;
        }
      }

      return null;
    } catch (err) {
      console.error('ensureClientExists error', err);
      return null;
    }
  };

  const [garantieDuration, setGarantieDuration] = useState(() => {
    const saved = localStorage.getItem('docGenGarantieDuration');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { years: '', months: '', days: '' };
      }
    }
    return { years: '', months: '', days: '' };
  });
  useEffect(() => {
    localStorage.setItem('docGenGarantieDuration', JSON.stringify(garantieDuration));
  }, [garantieDuration]);
  const [garantieEndDate, setGarantieEndDate] = useState('');
  const [products, setProducts] = useState([]);
  const [barcode, setBarcode] = useState(''); 

  // Manual Montant (amount) item modal for barcodes without product or quick manual add
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemData, setManualItemData] = useState({ name: '', price: '', quantity: '1', quantityType: 'unit' });
  // Quick product search inside the manual-add modal (match by name or `reference`/SKU)
  const [manualProductQuery, setManualProductQuery] = useState('');
  const manualProductResults = manualProductQuery.trim().length > 0
    ? products.filter(p => ((p.name || '').toLowerCase().includes(manualProductQuery.toLowerCase()) || (p.reference || '').toLowerCase().includes(manualProductQuery.toLowerCase()))).slice(0, 8)
    : [];
  const selectManualProduct = (p) => {
    setManualItemData(fd => ({ ...fd, name: p.name || fd.name, price: (p.price || p.detailPrice || p.wholesalePrice || 0), _linkedProductId: p.id, productName: p.name }));
    setManualProductQuery(p.name || '');
    setTimeout(() => document.getElementById('sales-manual-amount-input')?.focus(), 50);
  };

  const openManualItemModal = (prefill = {}) => {
    setManualItemData({ name: '', price: '', quantity: '1', quantityType: 'unit', ...prefill });
    // if opening with a linked product, prefill the search box so user sees the selection
    setManualProductQuery(prefill.productName || prefill.name || '');
    setShowManualItemModal(true);
    setTimeout(() => {
      barcodeInputRef.current?.blur();
      setTimeout(() => document.getElementById('sales-manual-amount-input')?.focus(), 150);
    }, 50);
  };
  const closeManualItemModal = () => {
    setShowManualItemModal(false);
    setManualItemData({ name: '', price: '', quantity: '1', quantityType: 'unit' });
    setManualProductQuery('');
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleManualItemSubmit = (e) => {
    e && e.preventDefault();
    const price = parseFloat(manualItemData.price);
    const quantity = parseFloat(manualItemData.quantity) || 1;
    if (isNaN(price) || price <= 0) {
      setNotification({ message: t('common.invalidAmount'), type: 'error' });
      return;
    }

    let item = null;

    if (manualItemData._linkedProductId) {
      // Create a unique id for this manual-priced instance so it doesn't merge with the product's default cart entry
      item = {
        id: `linked-${manualItemData._linkedProductId}-${Date.now()}`,
        productId: manualItemData._linkedProductId,
        name: manualItemData.name && manualItemData.name.trim() ? manualItemData.name.trim() : (manualItemData.productName || t('SalesByInvoices.manualItem') || 'Manual Item'),
        barcode: null,
        price: price,
        quantity: quantity,
        quantityType: manualItemData.quantityType || 'unit',
        serialNumber: ''
      };
    } else {
      item = {
        id: `manual-${Date.now()}`,
        name: manualItemData.name && manualItemData.name.trim() ? manualItemData.name.trim() : `${t('SalesByInvoices.manualItem') || 'Manual Item'}`,
        barcode: null,
        price: price,
        quantity: quantity,
        quantityType: manualItemData.quantityType || 'unit',
        serialNumber: ''
      };
    }

    // Add item to active tab's cart
    setTabs(tabs.map(tab => tab.id === activeTabId ? { ...tab, cart: [...tab.cart, item] } : tab));
    playBeepSound();
    setNotification({ message: t('SalesByInvoices.itemAdded'), type: 'success' });
    setShowManualItemModal(false);
    setManualItemData({ name: '', price: '', quantity: '1', quantityType: 'unit' });
    setBarcode('');
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };
  // Multi-checkout tabs (like Checkout)
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem('docGenTabs');
    if (savedTabs) {
      try {
        const parsed = JSON.parse(savedTabs);
        // Ensure older saved tabs get the client fields we now support
        return parsed.map(t => ({
          id: t.id,
          cart: t.cart || [],
          subtotal: t.subtotal || 0,
          tax: t.tax || 0,
          discount: t.discount || 0,
          total: t.total || 0,
          clientName: t.clientName || formData.clientName || '',
          clientAddress: t.clientAddress || formData.clientAddress || '',
          clientEmail: t.clientEmail || formData.clientEmail || '',
          clientPhone: t.clientPhone || formData.clientPhone || '',
          clientId: t.clientId || formData.clientId || '',
          clientRC: t.clientRC || formData.clientRC || '',
          clientAI: t.clientAI || formData.clientAI || '',
          clientNIS: t.clientNIS || formData.clientNIS || '',
          taxId: t.taxId || formData.taxId || ''
        }));
      } catch {
        // fallback
      }
    }
    return [{
      id: 1,
      cart: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      clientName: formData.clientName || '',
      clientAddress: formData.clientAddress || '',
      clientEmail: formData.clientEmail || '',
      clientPhone: formData.clientPhone || '',
      clientId: formData.clientId || '',
      clientRC: formData.clientRC || '',
      clientAI: formData.clientAI || '',
      clientNIS: formData.clientNIS || '',
      taxId: formData.taxId || ''
    }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const savedActiveTabId = localStorage.getItem('docGenActiveTabId');
    return savedActiveTabId ? parseInt(savedActiveTabId) : 1;
  });
  const [nextTabId, setNextTabId] = useState(() => {
    const savedNextTabId = localStorage.getItem('docGenNextTabId');
    return savedNextTabId ? parseInt(savedNextTabId) : 2;
  });
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('docGenTabs', JSON.stringify(tabs));
  }, [tabs]);
  useEffect(() => {
    localStorage.setItem('docGenActiveTabId', activeTabId.toString());
  }, [activeTabId]);
  useEffect(() => {
    localStorage.setItem('docGenNextTabId', nextTabId.toString());
  }, [nextTabId]);

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  const cart = activeTab.cart;
  const barcodeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState('');

  // Keep formData client fields in sync with the active tab
  useEffect(() => {
    if (activeTab) {
      setFormData(fd => ({
        ...fd,
        clientName: activeTab.clientName || '',
        clientAddress: activeTab.clientAddress || '',
        clientEmail: activeTab.clientEmail || '',
        clientPhone: activeTab.clientPhone || '',
        clientId: activeTab.clientId || ''
      }));
    }
  }, [activeTabId, tabs]);
  const [notification, setNotification] = useState(null);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const paymentMethods = ['cash', 'visa', 'mastercard', 'amex', 'debit', 'other'];
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [debtAmount, setDebtAmount] = useState(0);
  // paidAmount is optional (string) so user may leave it blank; parsed where needed
  const [paidAmount, setPaidAmount] = useState('');

  // Location state
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    const saved = localStorage.getItem('salesByInvoicesLocationId');
    return saved ? parseInt(saved) : null;
  });

  // Load locations from database
  const loadLocations = async () => {
    if (!ipcRenderer) return;
    try {
      const locs = await ipcRenderer.invoke('get-all-locations');
      setLocations(locs);
      // Auto-select Shop 1 or first shop
      if (!selectedLocationId && locs.length > 0) {
        const shop1 = locs.find(loc => loc.type === 'shop' && loc.name.toLowerCase().includes('shop 1'));
        const fallbackShop = locs.find(loc => loc.type === 'shop');
        const selectedLoc = shop1 || fallbackShop || locs[0];
        setSelectedLocationId(selectedLoc.id);
        localStorage.setItem('salesByInvoicesLocationId', selectedLoc.id.toString());
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  // Save selected location to localStorage
  useEffect(() => {
    if (selectedLocationId) {
      localStorage.setItem('salesByInvoicesLocationId', selectedLocationId.toString());
    }
  }, [selectedLocationId]);

  // Load locations on mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Selector for price type (detail/wholesale)
  const [priceType, setPriceType] = useState('detail'); // 'detail' or 'wholesale'

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  const refocusBarcodeInput = () => {
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 100);
  };

  // Update all cart item prices when priceType changes
  useEffect(() => {
    setTabs(tabs => tabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      return {
        ...tab,
        cart: tab.cart.map(item => {
          const prod = products.find(p => p.id === item.id);
          if (!prod) return item;
          let newPrice = prod.price;
          if (priceType === 'detail' && prod.detailPrice) newPrice = prod.detailPrice;
          if (priceType === 'wholesale' && prod.wholesalePrice) newPrice = prod.wholesalePrice;
          return { ...item, price: Number(newPrice) };
        })
      };
    }));
  }, [priceType, activeTabId, products]);

  // Garantie duration calculation
  useEffect(() => {
    if (docType === 'garantie') {
      const { years, months, days } = garantieDuration;
      const start = new Date(formData.date);
      if (!isNaN(start.getTime())) {
        let end = new Date(start);
        if (years) end.setFullYear(end.getFullYear() + parseInt(years || 0));
        if (months) end.setMonth(end.getMonth() + parseInt(months || 0));
        if (days) end.setDate(end.getDate() + parseInt(days || 0));
        setGarantieEndDate(end.toISOString().slice(0, 10));
      } else {
        setGarantieEndDate('');
      }
    } else {
      setGarantieEndDate('');
    }
  }, [garantieDuration, formData.date, docType]);

  useEffect(() => {
    const loadProducts = async () => {
      const result = await getAllProducts();
      if (result.success) setProducts(result.data);
    };
    loadProducts();
  }, []);

  // Workflow enforcement: only allow valid transitions
  const handleTypeChange = (e) => {
    const nextType = e.target.value;
    setDocType(nextType);
    setFormData(fd => ({ ...fd }));
    setGeneratedDoc(null);
  };


  // Enhanced input change: auto-fill serial number when selecting product for garantie
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If editing a client-related field, update both formData and the active tab so each checkout keeps its own client
    const clientFields = ['clientName', 'clientAddress', 'clientEmail', 'clientPhone', 'clientId', 'clientRC', 'clientAI', 'clientNIS', 'taxId'];
    if (clientFields.includes(name)) {
      setFormData(fd => ({ ...fd, [name]: value }));
      setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, [name]: value } : tab));
      return;
    }

    if (docType === 'garantie' && name === 'productName') {
      setFormData(fd => ({ ...fd, productName: value }));
      return;
    }

    setFormData(fd => ({ ...fd, [name]: value }));
    if (name === 'paymentStatus') {
      setFormData(fd => ({ ...fd, paymentStatus: value }));
    }
  };

  // On blur, always try to fill serial number if product matches
  const handleProductBlur = (e) => {
    if (docType !== 'garantie') return;
    const value = e.target.value;
    const prod = products.find(p => p.name === value);
    if (prod) {
      setFormData(fd => ({
        ...fd,
        productName: prod.name,
        serialNumber: prod.serialNumber || prod.barcode || ''
      }));
    }
  };

  const handleBarcodeSubmit = (code = barcode) => {
    if (!code) return;
    const codeStr = String(code).trim();
    const product = products.find(p => String(p.barcode || '').trim() === codeStr);
    if (product) {
      addToCart(product);
      // Auto-fill for garantie
      if (docType === 'garantie') {
        setFormData(fd => ({
          ...fd,
          productName: product.name || '',
          serialNumber: product.serialNumber || product.barcode || ''
        }));
      }
      playBeepSound();
      setBarcode('');
    } else {
      // If product not found, open manual montant dialog so user can enter an amount or a manual item
      const isNumeric = /^\d+(?:\.\d+)?$/.test(codeStr);
      openManualItemModal({
        price: isNumeric ? code : '',
        name: !isNumeric ? code : ''
      });
      setBarcode('');
    }
  };

  // When Enter is pressed while barcode input has focus:
  // - if barcode field has text => submit barcode (existing behavior)
  // - if barcode field is empty => open qty editor for the last product added
  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const code = (barcode || '').trim();

    if (code) {
      e.preventDefault();
      handleBarcodeSubmit(code);
      return;
    }

    // No barcode typed — open quantity editor for last item
    const currentCart = activeTab?.cart || [];
    if (!currentCart || currentCart.length === 0) return; // nothing to edit

    e.preventDefault();
    const lastIndex = currentCart.length - 1;
    const lastItem = currentCart[lastIndex];

    setSelectedItemIndex(lastIndex);
    setEditingItemId(lastItem.id);
    setEditingQuantity(String(lastItem.quantity || 1));

    // focus the quantity input when it renders
    setTimeout(() => {
      if (quantityInputRef.current) {
        try { quantityInputRef.current.focus(); quantityInputRef.current.select && quantityInputRef.current.select(); } catch (err) {}
      }
    }, 50);
  };

  // Keyboard shortcuts (Checkout parity: Enter to edit qty, show unit)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (notification || showPdfPreview || showPaymentModal) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (cart.length > 0) {
          setSelectedItemIndex(prev => (prev + 1) % cart.length);
        }
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) handlePay(e);
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) generateAndPreviewPDF();
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (window.require) {
          const { ipcRenderer } = window.require('electron');
          if (ipcRenderer) ipcRenderer.send('open-cash-drawer');
        }
        setNotification({ message: t('checkout.cashDrawerOpened'), type: 'success' });
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      } else if (e.key === 'F12') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedItemIndex >= 0 && cart.length > 0) {
          setSelectedItemIndex(-1);
        } else {
          if (barcodeInputRef.current) barcodeInputRef.current.focus();
        }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        if (cart.length > 0) removeFromCart(cart[cart.length - 1].id);
      } else if (e.key === '+' || e.key === 'Add') {
        // Open manual amount modal via + key or numpad Add
        e.preventDefault();
        openManualItemModal();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cart.length > 0) setSelectedItemIndex(prev => (prev - 1 + cart.length) % cart.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (cart.length > 0) setSelectedItemIndex(prev => (prev + 1) % cart.length);
      } else if (e.key === 'Enter' && selectedItemIndex >= 0) {
        e.preventDefault();
        setEditingItemId(cart[selectedItemIndex].id);
        setEditingQuantity(cart[selectedItemIndex].quantity.toString());
        setTimeout(() => {
          const el = quantityInputRef.current;
          if (el) { el.focus(); if (el.select) el.select(); }
        }, 100);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart, selectedItemIndex, notification, showPdfPreview, showPaymentModal]);


  // Tabbed cart operations
  const addToCart = (product) => {
    // If product has no price, open manual montant dialog so user can enter amount
    if (!product.price || Number(product.price) === 0) {
      openManualItemModal({ name: product.name || '', price: '', _linkedProductId: product.id });
      return;
    }

    setTabs(tabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const existing = tab.cart.find(item => item.id === product.id);
      // For warranty, always attach serialNumber from formData (even if empty)
      let productToAdd = { ...product };
      if (docType === 'garantie') {
        productToAdd.serialNumber = formData.serialNumber || '';
      }
      if (existing) {
        return {
          ...tab,
          cart: tab.cart.map(item =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  ...(docType === 'garantie' ? { serialNumber: formData.serialNumber || '' } : {})
                }
              : item
          )
        };
      } else {
        return {
          ...tab,
          cart: [...tab.cart, { ...productToAdd, quantity: 1 }]
        };
      }
    }));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
    } else {
      setTabs(tabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, cart: tab.cart.map(item => item.id === itemId ? { ...item, quantity: newQuantity } : item) }
          : tab
      ));
    }
  };

  const removeFromCart = (itemId) => {
    setTabs(tabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, cart: tab.cart.filter(item => item.id !== itemId) }
        : tab
    ));
  };

  const clearCart = () => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, cart: [], clientName: '', clientAddress: '', clientEmail: '', clientPhone: '', clientId: '', clientRC: '', clientAI: '', clientNIS: '', taxId: '' }
        : tab
    ));
    setBarcode('');
    // Clear client info fields for the active tab in the visible form
    setFormData(fd => ({
      ...fd,
      clientName: '',
      clientAddress: '',
      clientEmail: '',
      clientPhone: '',
      clientId: '',
      clientRC: '',
      clientAI: '',
      clientNIS: '',
      taxId: ''
    }));
  };


  const addNewTab = () => {
    const newTab = {
      id: nextTabId,
      cart: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      // New tabs start with empty client info so each checkout can have its own client
      clientName: '',
      clientAddress: '',
      clientEmail: '',
      clientPhone: '',
      clientId: '',
      clientRC: '',
      clientAI: '',
      clientNIS: '',
      taxId: ''
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextTabId);
    setNextTabId(nextTabId + 1);
    // Reset visible form fields for the new tab
    setFormData(fd => ({ ...fd, clientName: '', clientAddress: '', clientEmail: '', clientPhone: '', clientId: '', clientRC: '', clientAI: '', clientNIS: '', taxId: '' }));
  };

  const closeTab = (tabId) => {
    if (tabs.length === 1) return; // Always keep at least one tab
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
      // Update form to the now-active tab's client info
      const next = newTabs[0];
      setFormData(fd => ({ ...fd, clientName: next.clientName || '', clientAddress: next.clientAddress || '', clientEmail: next.clientEmail || '', clientPhone: next.clientPhone || '', clientId: next.clientId || '' }));
    }
  };

  const switchTab = (tabId) => {
    setActiveTabId(tabId);
    // Load the tab-specific client info into the form immediately
    const target = tabs.find(t => t.id === tabId);
    if (target) {
      setFormData(fd => ({ ...fd, clientName: target.clientName || '', clientAddress: target.clientAddress || '', clientEmail: target.clientEmail || '', clientPhone: target.clientPhone || '', clientId: target.clientId || '', clientRC: target.clientRC || '', clientAI: target.clientAI || '', clientNIS: target.clientNIS || '', taxId: target.taxId || '' }));
    }
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };


  // Totals for active tab
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // `discount` remains numeric for calculations; `discountInput` keeps the raw text while the user types
  const [discount, setDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState(() => (0).toFixed(2));

  // Keep numeric discount in sync with default rate changes
  useEffect(() => {
    setDiscount(subtotal * (settings.discountRate / 100));
  }, [subtotal, settings.discountRate]);

  // Mirror numeric discount to the edit buffer unless the user is currently editing the field
  useEffect(() => {
    try {
      const activeIsDiscount = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('discount-input');
      if (!activeIsDiscount) setDiscountInput((discount || 0).toFixed(2));
    } catch (e) {
      setDiscountInput((discount || 0).toFixed(2));
    }
  }, [discount]);

  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (settings.taxRate / 100);
  const total = afterDiscount + tax;


  // Generate PDF and show preview modal
  const generateAndPreviewPDF = async () => {
    // Validation per document type
    if (!formData.clientName) {
      setNotification({ message: t('SalesByInvoices.clientNameRequired'), type: 'error' });
      return;
    }
    // --- Document Number Generation ---
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const randomNum = Math.floor(Math.random() * 9000 + 1000);
    let docNumber = '';
    if (docType === 'devis') docNumber = `Q-${dateStr}-${randomNum}`;
    if (docType === 'bon_commande') docNumber = `PO-${dateStr}-${randomNum}`;
    if (docType === 'bon_livraison') docNumber = `DN-${dateStr}-${randomNum}`;
    if (docType === 'facture') docNumber = `INV-${dateStr}-${randomNum}`;
    if (docType === 'proforma') docNumber = `PF-${dateStr}-${randomNum}`;
    if (docType === 'garantie') docNumber = `GAR-${dateStr}-${randomNum}`;
    

    const doc = new jsPDF();
    
    // Load Unicode fonts for multi-language support (dynamically import the font utilities)
    const pdfFontsModule = await getPdfFontsModule();
    if (pdfFontsModule && pdfFontsModule.loadPdfFonts) {
      await pdfFontsModule.loadPdfFonts(doc, i18n.language);
      // Replace local helpers with real implementations for synchronous use later
      setPdfFont = pdfFontsModule.setPdfFont || setPdfFont;
      // Wrap getAutoTableStyles so it defaults to the current document direction (isRTL)
      getAutoTableStyles = (rtl = isRTL) => (pdfFontsModule.getAutoTableStyles ? pdfFontsModule.getAutoTableStyles(rtl) : { font: 'helvetica', halign: rtl ? 'right' : 'left' });
    } else {
      // Fallback to basic font if import fails
      setPdfFont(doc, 'normal');
    }
    // Ensure font is set for all text
    setPdfFont(doc, 'normal');

    // Mirror drawing/text coordinates and default alignment when RTL
    const _pageWidth = doc.internal.pageSize.getWidth();
    if (isRTL) {
      const _origText = doc.text.bind(doc);
      doc.text = function(text, x, y, options) {
        // keep center alignment unchanged
        const opts = options || {};
        if (opts.align === 'center' || typeof x !== 'number') return _origText(text, x, y, opts);
        // flip x coordinate
        const mx = _pageWidth - x;
        // if explicit align provided, flip left<->right; otherwise default to right for RTL
        if (opts.align === 'left') opts.align = 'right';
        else if (opts.align === 'right') opts.align = 'left';
        else if (!opts.align) opts.align = 'right';
        return _origText(text, mx, y, opts);
      };

      const _origRect = doc.rect.bind(doc);
      doc.rect = function(x, y, w, h, style) {
        if (typeof x === 'number' && x !== 0) return _origRect(_pageWidth - x - w, y, w, h, style);
        return _origRect(x, y, w, h, style);
      };
    }
    
    const noir = [0, 0, 0];
    const beige = [245, 240, 230];
    // Header: left logo/date, right title/number, then line
    doc.setFillColor(...beige);
    doc.rect(0, 0, 210, 38, 'F');
    let logo = settings.posLogo || formData.logo;
    if (logo) {
      try {
        // Increased default logo size and preserve aspect ratio
        let maxDim = 48; // mm
        let width = maxDim;
        let height = maxDim;
        if (logo.startsWith('data:image')) {
          const img = document.createElement('img');
          img.src = logo;
          if (img.complete && img.naturalWidth && img.naturalHeight) {
            const aspect = img.naturalWidth / img.naturalHeight;
            if (aspect >= 1) {
              width = Math.min(maxDim, maxDim);
              height = Math.round(width / aspect);
            } else {
              height = Math.min(maxDim, maxDim);
              width = Math.round(height * aspect);
            }
          }
        }
        doc.addImage(logo, 'PNG', 10, 6, width, height, undefined, 'FAST');
      } catch (e) {}
    }
    doc.setFontSize(10);
    doc.setTextColor(...noir);
    // Format date as DD-MM-YYYY
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}-${month}-${year}`;
    };
    doc.text(`${t('Date')}: ${formatDate(formData.date)}`, 14, 33);
    let title = '';
    if (docType === 'facture') title = t('SalesByInvoices.invoice');
    else if (docType === 'bon_commande') title = t('SalesByInvoices.purchaseOrder');
    else if (docType === 'bon_livraison') title = t('SalesByInvoices.deliveryNote');
    else if (docType === 'devis') title = t('SalesByInvoices.quotation');
    else if (docType === 'proforma') title = t('SalesByInvoices.proforma');
    else if (docType === 'garantie') title = t('SalesByInvoices.garantie');
    else title = t('SalesByInvoices.document');
    // Dynamically adjust font size for long titles
    let titleFontSize = 28;
    const maxTitleWidth = 80; // mm, max width allowed for title
    doc.setFontSize(titleFontSize);
    setPdfFont(doc, 'bold');
    let titleWidth = doc.getTextWidth(title.toUpperCase());
    while (titleWidth > maxTitleWidth && titleFontSize > 12) {
      titleFontSize -= 2;
      doc.setFontSize(titleFontSize);
      titleWidth = doc.getTextWidth(title.toUpperCase());
    }
    doc.text(title.toUpperCase(), 120, 20, { align: isRTL ? 'right' : 'left' });
    doc.setFontSize(9);
    setPdfFont(doc, 'normal');
    doc.text(`${t('SalesByInvoices.documentNo')}: ${docNumber}`, 120, 28, { align: isRTL ? 'right' : 'left' });
    // Draw line below header
  

    // Info: shop and client in bold with text wrapping
    doc.setFontSize(11);
    setPdfFont(doc, 'bold');
    
    let yPos = 48;
    // Wrap company name (only show store name when no logo to avoid duplication)
    if (!logo) {
      const companyName = `${t('SalesByInvoices.shop')}: ${formData.companyName || ''}`;
      const companyNameLines = doc.splitTextToSize(companyName, 90);
      companyNameLines.forEach(line => {
        doc.text(line, 10, yPos);
        yPos += 6;
      });
    }
    
    // Wrap company address
    const companyAddr = `${t('SalesByInvoices.address')}: ${formData.companyAddress || ''}`;
    const companyAddrLines = doc.splitTextToSize(companyAddr, 90);
    companyAddrLines.forEach(line => {
      doc.text(line, 10, yPos);
      yPos += 6;
    });
    
    // Wrap company contact
    const companyContact = `${t('SalesByInvoices.contact')}: ${formData.companyContact || ''}`;
    const companyContactLines = doc.splitTextToSize(companyContact, 90);
    companyContactLines.forEach(line => {
      doc.text(line, 10, yPos);
      yPos += 6;
    });
    
    if (formData.companyTaxId) {
      doc.text(`${t('settings.taxId')}: ${formData.companyTaxId}`, 10, yPos);
      yPos += 6;
    }
    if (formData.companyRC) { doc.text(`${t('settings.rcShort') || 'RC'}: ${formData.companyRC}`, 10, yPos); yPos += 6; }
    if (formData.companyAI) { doc.text(`${t('settings.aiShort') || 'AI'}: ${formData.companyAI}`, 10, yPos); yPos += 6; }
    if (formData.companyNIS) { doc.text(`${t('settings.nisShort') || 'NIS'}: ${formData.companyNIS}`, 10, yPos); yPos += 6; }
    if (formData.paymentTerms) {
      const paymentTermsLines = doc.splitTextToSize(`${t('SalesByInvoices.paymentTerms')}: ${formData.paymentTerms}`, 90);
      paymentTermsLines.forEach(line => {
        doc.text(line, 10, yPos);
        yPos += 6;
      });
    }

    // Client info on the right with text wrapping
    let clientYPos = 48;
    const clientLabel = `${t('SalesByInvoices.client')}: ${formData.clientName || ''}`;
    const clientLabelLines = doc.splitTextToSize(clientLabel, 80);
    clientLabelLines.forEach(line => {
      doc.text(line, 120, clientYPos);
      clientYPos += 6;
    });
    
    if (formData.clientAddress) {
      const clientAddrLines = doc.splitTextToSize(`${t('SalesByInvoices.address')}: ${formData.clientAddress}`, 80);
      clientAddrLines.forEach(line => {
        doc.text(line, 120, clientYPos);
        clientYPos += 6;
      });
    }
    
    if (formData.clientEmail) {
      const clientEmailLines = doc.splitTextToSize(`${t('SalesByInvoices.email')}: ${formData.clientEmail}`, 80);
      clientEmailLines.forEach(line => {
        doc.text(line, 120, clientYPos);
        clientYPos += 6;
      });
    }

    if (formData.taxId) { doc.text(`${t('settings.taxId')}: ${formData.taxId}`, 120, clientYPos); clientYPos += 6; }
    
    if (formData.clientPhone) {
      doc.text(`${t('SalesByInvoices.phone')}: ${formData.clientPhone}`, 120, clientYPos);
      clientYPos += 6;
    }
    if (formData.clientRC) { doc.text(`${t('settings.rcShort') || 'RC'}: ${formData.clientRC}`, 120, clientYPos); clientYPos += 6; }
    if (formData.clientAI) { doc.text(`${t('settings.aiShort') || 'AI'}: ${formData.clientAI}`, 120, clientYPos); clientYPos += 6; }
    if (formData.clientNIS) { doc.text(`${t('settings.nisShort') || 'NIS'}: ${formData.clientNIS}`, 120, clientYPos); clientYPos += 6; }
    setPdfFont(doc, 'normal');

    // Calculate dynamic start position for table (after all text)
    const tableStartY = Math.max(yPos, clientYPos) + 10;

    // --- Document Type Specific Sections ---
    if (docType === 'devis') {
      // Quotation: details, validity, terms
      autoTable(doc, {
        startY: tableStartY,
        head: [[t('SalesByInvoices.description'), t('SalesByInvoices.quantity'), t('SalesByInvoices.price'), t('SalesByInvoices.total')]],
        body: cart.map(item => {
          const prod = products.find(p => p.id === item.id);
          const unit = prod?.quantityType || 'unit';
          const quantityWithUnit = unit && unit !== 'unit' ? `${item.quantity} ${unit}` : `${item.quantity}`;
          const priceWithType = `${item.price} ${settings.currency || '€'}`;
          return [
            item.name,
            quantityWithUnit,
            priceWithType,
            `${(item.price * item.quantity).toFixed(2)} ${settings.currency || '€'}`
          ];
        }),
        headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 80, halign: isRTL ? 'right' : 'left' },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 }
        },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles(isRTL) }
      });
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
      doc.setFontSize(10);
      doc.text(`${t('SalesByInvoices.subtotal')} : ${subtotal.toFixed(2)} ${settings.currency || '€'}`, 140, finalY);
      doc.text(`${t('SalesByInvoices.discount')} : ${discount.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 8);
      doc.text(`${t('invoiceHistory.tax')} : ${tax.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 16);
      setPdfFont(doc, 'bold');
      doc.text(`${t('SalesByInvoices.total')} : ${total.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 24);
      setPdfFont(doc, 'normal');
      // Show remaining debt on the invoice when applicable
      if (debtAmount && debtAmount > 0) {
        doc.setTextColor(210, 51, 108);
        doc.text(`${t('checkout.remainingDebt') || 'Remaining Debt'} : ${debtAmount.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 36);
        doc.setTextColor(0, 0, 0);
      }
      doc.text(`${t('SalesByInvoices.validityDate')} : ${formatDate(formData.date)}`, 15, finalY + 32);
      doc.text(t('SalesByInvoices.termsAndConditions') + ':', 15, finalY + 40);
      doc.text(t('SalesByInvoices.quotationNote'), 15, finalY + 48);
    } else if (docType === 'bon_commande') {
      // Purchase Order: details, link to quotation, confirmation
      autoTable(doc, {
        startY: tableStartY,
        head: [[t('SalesByInvoices.description'), t('SalesByInvoices.quantity'), t('SalesByInvoices.price'), t('SalesByInvoices.total')]],
        body: cart.map(item => {
          const prod = products.find(p => p.id === item.id);
          const unit = prod?.quantityType || 'unit';
          const quantityWithUnit = unit && unit !== 'unit' ? `${item.quantity} ${unit}` : `${item.quantity}`;
          const priceWithType = `${item.price} ${settings.currency || '€'}`;
          return [
            item.name,
            quantityWithUnit,
            priceWithType,
            `${(item.price * item.quantity).toFixed(2)} ${settings.currency || '€'}`
          ];
        }),
        headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 80, halign: isRTL ? 'right' : 'left' },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 }
        },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles(isRTL) }
      });
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
      doc.setFontSize(10);
      doc.text(`${t('SalesByInvoices.subtotal')} : ${subtotal.toFixed(2)} ${settings.currency || '€'}`, 140, finalY);
      doc.text(`${t('SalesByInvoices.discount')} : ${discount.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 8);
      doc.text(`${t('invoiceHistory.tax')} : ${tax.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 16);
      setPdfFont(doc, 'bold');
      doc.text(`${t('SalesByInvoices.total')} : ${total.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 24);
      setPdfFont(doc, 'normal');
      if (linkedQuotation) doc.text(t('SalesByInvoices.linkedQuotation') + ': ' + linkedQuotation, 15, finalY + 32);
      doc.text(`${t('SalesByInvoices.orderDate')} : ${formatDate(formData.date)}`, 15, finalY + 40);
      doc.text(`${t('SalesByInvoices.customerConfirmationStatus')} : ${t('SalesByInvoices.pending')}`, 15, finalY + 48);
      doc.text(t('SalesByInvoices.deliveryTerms') + ':', 15, finalY + 56);
      doc.text(t('SalesByInvoices.purchaseOrderNote'), 15, finalY + 64);
    } else if (docType === 'bon_livraison') {
      // Delivery Note: no prices, link to PO, delivery address, signature
      autoTable(doc, {
        startY: tableStartY,
        head: [[t('SalesByInvoices.description'), t('SalesByInvoices.quantity')]],
        body: cart.map(item => [item.name, item.quantity]),
        headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 130, halign: isRTL ? 'right' : 'left' },
          1: { cellWidth: 40 }
        },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles() }
      });
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
      if (linkedOrder) doc.text(t('SalesByInvoices.linkedPurchaseOrder') + ': ' + linkedOrder, 15, finalY);
      doc.text(`${t('SalesByInvoices.deliveryAddress')} : ${formData.clientAddress}`, 15, finalY + 8);
      doc.text(`${t('SalesByInvoices.deliveryDate')} : ${formatDate(formData.date)}`, 15, finalY + 16);
      doc.text(t('SalesByInvoices.customerSignature') + ':', 15, finalY + 24);
      doc.rect(15, finalY + 28, 60, 25);
      doc.text(t('SalesByInvoices.deliveryNoteInfo'), 15, finalY + 60);
    } else if (docType === 'facture') {
      // Invoice: all details, reference, payment, legal info
      autoTable(doc, {
        startY: tableStartY,
        head: [[t('SalesByInvoices.description'), t('SalesByInvoices.quantity'), t('SalesByInvoices.price'), t('SalesByInvoices.total')]],
        body: cart.map(item => {
          const prod = products.find(p => p.id === item.id);
          const unit = prod?.quantityType || 'unit';
          const quantityWithUnit = unit && unit !== 'unit' ? `${item.quantity} ${unit}` : `${item.quantity}`;
          const priceWithType = `${item.price} ${settings.currency || '€'}`;
          return [
            item.name,
            quantityWithUnit,
            priceWithType,
            `${(item.price * item.quantity).toFixed(2)} ${settings.currency || '€'}`
          ];
        }),
        headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 80, halign: isRTL ? 'right' : 'left' },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 }
        },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles(isRTL) }
      });
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
      doc.setFontSize(10);
      doc.text(`${t('SalesByInvoices.subtotal')} : ${subtotal.toFixed(2)} ${settings.currency || '€'}`, 140, finalY);
      doc.text(`${t('SalesByInvoices.discount')} : ${discount.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 8);
      doc.text(`${t('invoiceHistory.tax')} (${settings.taxRate || 0}%) : ${tax.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 16);
      setPdfFont(doc, 'bold');
      doc.text(`${t('SalesByInvoices.total')} : ${total.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 24);
      setPdfFont(doc, 'normal');
      if (linkedDelivery) doc.text(t('SalesByInvoices.linkedDeliveryNote') + ': ' + linkedDelivery, 15, finalY + 32);
      doc.text(`${t('SalesByInvoices.paymentMethod')} : ${selectedPaymentMethod}`, 15, finalY + 40);
      doc.text(`${t('SalesByInvoices.dueDate')} : ${formatDate(formData.date)}`, 15, finalY + 48);
      // Fix: define statusLabel before using
      let statusLabel = (typeof paymentStatusOptions !== 'undefined' && paymentStatusOptions.find(opt => opt.value === formData.paymentStatus)?.label) || formData.paymentStatus;
      doc.text(`${t('SalesByInvoices.paymentStatus')} : ${statusLabel}`, 15, finalY + 56);
      doc.text(t('SalesByInvoices.legalInfo'), 15, finalY + 64);
    } else if (docType === 'proforma') {
      // Proforma Invoice: like invoice, but marked and not for accounting
      autoTable(doc, {
        startY: tableStartY,
        head: [[t('SalesByInvoices.description'), t('SalesByInvoices.quantity'), t('SalesByInvoices.price'), t('SalesByInvoices.total')]],
        body: cart.map(item => {
          const prod = products.find(p => p.id === item.id);
          const unit = prod?.quantityType || 'unit';
          const quantityWithUnit = unit && unit !== 'unit' ? `${item.quantity} ${unit}` : `${item.quantity}`;
          const priceWithType = `${item.price} ${settings.currency || '€'}`;
          return [
            item.name,
            quantityWithUnit,
            priceWithType,
            `${(item.price * item.quantity).toFixed(2)} ${settings.currency || '€'}`
          ];
        }),
        headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 80, halign: isRTL ? 'right' : 'left' },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 }
        },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles(isRTL) }
      });
      const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
      doc.setFontSize(10);
      doc.text(`${t('SalesByInvoices.subtotal')} : ${subtotal.toFixed(2)} ${settings.currency || '€'}`, 140, finalY);
      doc.text(`${t('SalesByInvoices.discount')} : ${discount.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 8);
      doc.text(`${t('invoiceHistory.tax')} : ${tax.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 16);
      setPdfFont(doc, 'bold');
      doc.text(`${t('SalesByInvoices.total')} : ${total.toFixed(2)} ${settings.currency || '€'}`, 140, finalY + 24);
      setPdfFont(doc, 'normal');
      doc.text(t('SalesByInvoices.proformainfo'), 15, finalY + 42);
    } else if (docType === 'garantie') {
      // Garantie: special layout
      doc.setFontSize(12);
      doc.text(t('SalesByInvoices.productInformation'), 15, tableStartY);
      doc.setFontSize(10);
      let garantieYPos = tableStartY + 10;
      doc.text(t('SalesByInvoices.product') + ' :', 15, garantieYPos);
      // Wrap long product names
      const productNameLines = doc.splitTextToSize(formData.productName || '', 130);
      productNameLines.forEach(line => {
        doc.text(line, 60, garantieYPos);
        garantieYPos += 6;
      });
      doc.text(t('SalesByInvoices.serialNumber') + ' :', 15, garantieYPos);
      doc.text(formData.serialNumber || '', 60, garantieYPos);
      garantieYPos += 8;
      doc.text(t('SalesByInvoices.purchaseDate') + ' :', 15, garantieYPos);
      doc.text(formatDate(formData.date) || '', 60, garantieYPos);
      garantieYPos += 8;
      doc.text(t('SalesByInvoices.warrantyDuration') + ' :', 15, garantieYPos);
      let durationStr = '';
      if (garantieDuration.years) durationStr += `${garantieDuration.years} ${t('SalesByInvoices.years')} `;
      if (garantieDuration.months) durationStr += `${garantieDuration.months} ${t('SalesByInvoices.months')} `;
      if (garantieDuration.days) durationStr += `${garantieDuration.days} ${t('SalesByInvoices.days')}`;
      doc.text(durationStr.trim(), 60, garantieYPos);
      garantieYPos += 8;
      doc.text(t('SalesByInvoices.warrantyEndDate') + ' :', 15, garantieYPos);
      doc.text(garantieEndDate || '', 60, garantieYPos);
      garantieYPos += 18;
      doc.setFontSize(11);
      doc.text(t('SalesByInvoices.warrantyConditions'), 15, garantieYPos);
      garantieYPos += 8;
      doc.setFontSize(9);
      const warrantyText = t('SalesByInvoices.warrantyText');
      const wrappedWarrantyText = doc.splitTextToSize(warrantyText, 180); // 180mm width for wrapping
      doc.text(wrappedWarrantyText, 15, garantieYPos);
      garantieYPos += wrappedWarrantyText.length * 5 + 10;
      doc.setFontSize(10);
      doc.text(t('SalesByInvoices.signatureAndStamp') + ' :', 15, garantieYPos);
      garantieYPos += 5;
      doc.rect(15, garantieYPos, 60, 25);
      doc.text(t('SalesByInvoices.clientSignature') + ' :', 130, garantieYPos - 5);
      doc.rect(130, garantieYPos, 60, 25);
      doc.setFontSize(9);
      // position thank-you above the bottom barcode to avoid overlap on small/letter pages
      const _pageHeight = doc.internal.pageSize.getHeight();
      const _barcodeH = 12; // mm (matches barcode below)
      const _marginBottom = 14; // mm
      const _barcodeTopY = _pageHeight - _marginBottom - _barcodeH;
      const _defaultThankYouY = 285;
      const thankYouY = Math.min(_defaultThankYouY, _barcodeTopY - 6);
      const _pageWidthCenter = doc.internal.pageSize.getWidth();
      doc.text((formData.companyName || 'POS') + ' – ' + t('SalesByInvoices.thankYou'), _pageWidthCenter / 2, thankYouY, { align: 'center' });
    } else {
      // Fallback: generic table
      autoTable(doc, {
        startY: tableStartY,
        head: [[t('SalesByInvoices.description'), t('SalesByInvoices.price'), t('SalesByInvoices.quantity'), t('SalesByInvoices.total')]],
        body: cart.map(item => [item.name, item.price, item.quantity, `${(item.price * item.quantity).toFixed(2)} ${settings.currency || '€'}`]),
        headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 80, halign: isRTL ? 'right' : 'left' },
          1: { cellWidth: 35 },
          2: { cellWidth: 30 },
          3: { cellWidth: 35 }
        },
        styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles(isRTL) }
      });
    }
    // Add small barcode at bottom center of page (avoid overlap)
    try {
      const barcodeId = docNumber;
      const barcodeDataUrl = generateBarcodeDataUrl(barcodeId);
      if (barcodeDataUrl) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const barcodeW = 50; // mm
        const barcodeH = 12; // mm
        const marginBottom = 14; // mm
        const x = (pageWidth - barcodeW) / 2;
        const y = pageHeight - marginBottom - barcodeH;
        // If there's not enough space, add a new page before drawing barcode
        const safeY = y;
        if (typeof doc.lastAutoTable !== 'undefined') {
          const contentEnd = doc.lastAutoTable.finalY || 0;
          if (contentEnd + 10 + barcodeH > safeY) {
            doc.addPage();
          }
        }
        doc.addImage(barcodeDataUrl, 'PNG', x, pageHeight - marginBottom - barcodeH, barcodeW, barcodeH, undefined, 'FAST');
      }
    } catch (e) {}

    // Show PDF preview instead of saving immediately
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    setShowPdfPreview(true);
    setGeneratedDoc({ ...formData, cart, type: docType });

    // Save document to database after print (or preview)
    // Save as invoice or supplier invoice depending on docType
    // Générer un identifiant client simple basé sur l'email ou le téléphone (ou nom si rien d'autre)
    let clientId = formData.clientId ? formData.clientId : '';
    if (!clientId) {
      if (formData.clientEmail) clientId = formData.clientEmail.trim().toLowerCase();
      else if (formData.clientPhone) clientId = formData.clientPhone.trim();
      else clientId = formData.clientName.trim().toLowerCase().replace(/\s+/g, '_');
    }

    // Always save garantie with all required fields, like other documents
    const items = cart.map(item => ({
      id: item.id,
      productId: item.id,
      name: item.name,
      productName: item.name,
      quantity: item.quantity,
      quantityType: item.quantityType || 'unit',
      price: item.price,
      serialNumber: item.serialNumber || ''
    }));
    // Prevent saving if no items (for all types)
    if (items.length === 0) {
      setNotification({ message: t('SalesByInvoices.noProductsAdded'), type: 'error' });
      return;
    }
    // Always set type to 'garantie' for warranty certificate
    const docToSave = {
      invoiceNumber: docNumber,
      customerName: formData.clientName,
      clientId: clientId,
      clientAddress: formData.clientAddress,
      clientEmail: formData.clientEmail,
      clientPhone: formData.clientPhone,
      clientRC: formData.clientRC || '',
      clientAI: formData.clientAI || '',
      clientNIS: formData.clientNIS || '',
      clientTaxId: formData.taxId || '',
      // If the form holds a date-only string (YYYY-MM-DD) we combine it with the current time so
      // the stored invoice `date` contains a full timestamp (prevents showing 01:00 AM due to UTC-only date parsing).
      date: (formData.date && /^\d{4}-\d{2}-\d{2}$/.test(formData.date))
        ? new Date(`${formData.date}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`).toISOString()
        : (formData.date || new Date().toISOString()),
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: selectedPaymentMethod,
      notes: formData.notes || '',
      items,
      type: docType === 'garantie' ? 'garantie' : docType, // Force type for warranty
      source: 'salesByInvoices',
      garantieDuration: docType === 'garantie' ? (
        typeof garantieDuration === 'object' && garantieDuration !== null
          ? `${garantieDuration.years || 0}y ${garantieDuration.months || 0}m ${garantieDuration.days || 0}d`
          : garantieDuration
      ) : undefined,
      garantieEndDate: docType === 'garantie' ? garantieEndDate : undefined,
      paymentStatus: formData.paymentStatus,
      companyName: formData.companyName,
      companyAddress: formData.companyAddress,
      companyContact: formData.companyContact,
      companyTaxId: formData.companyTaxId,
      companyRC: formData.companyRC || '',
      companyAI: formData.companyAI || '',
      companyNIS: formData.companyNIS || '',
    };
    // Helper: ensure client exists in 'clients' table and return client id
    const ensureClientExists = async () => {
      try {
        // If we already have a client id, trust it
        if (formData.clientId) return formData.clientId;

        // Try to find by email (preferred), then phone, then name
        const byEmail = formData.clientEmail && formData.clientEmail.trim();
        const byPhone = formData.clientPhone && formData.clientPhone.trim();
        const byName = formData.clientName && formData.clientName.trim();

        let found = null;

        // Search by email
        if (byEmail) {
          const res = await searchClients(byEmail);
          const list = normalizeClientResponse(res);
          if (Array.isArray(list) && list.length > 0) {
            found = list.find(c => c.email && c.email.toLowerCase() === byEmail.toLowerCase()) || list[0];
          }
        }

        // Search by phone
        if (!found && byPhone) {
          const res = await searchClients(byPhone);
          const list = normalizeClientResponse(res);
          if (Array.isArray(list) && list.length > 0) {
            found = list.find(c => c.phone && c.phone === byPhone) || list[0];
          }
        }

        // Search by name
        if (!found && byName) {
          const res = await searchClients(byName);
          const list = normalizeClientResponse(res);
          if (Array.isArray(list) && list.length > 0) {
            found = list.find(c => c.name && c.name.toLowerCase() === byName.toLowerCase()) || list[0];
          }
        }

        // If we found an existing client, link and return id
        if (found && found.id) {
          setFormData(fd => ({ ...fd, clientId: found.id, clientName: found.name || fd.clientName, clientEmail: found.email || fd.clientEmail, clientPhone: found.phone || fd.clientPhone, clientAddress: found.address || fd.clientAddress }));
          return found.id;
        }

        // No existing client found — create one if we have minimal info
        if (byName || byEmail || byPhone) {
          const newClient = {
            name: byName || (byEmail ? byEmail : 'Client'),
            phone: byPhone || null,
            email: byEmail || null,
            address: formData.clientAddress || null,
            taxId: formData.taxId || null,
            rc: formData.clientRC || null,
            ai: formData.clientAI || null,
            nis: formData.clientNIS || null
          };
          const cr = await createClient(newClient);
          const created = cr && (cr.data || cr) ? (cr.data || cr) : null;
          if (created && created.id) {
            setFormData(fd => ({ ...fd, clientId: created.id }));
            return created.id;
          }
        }

        return null;
      } catch (err) {
        console.error('ensureClientExists error', err);
        return null;
      }
    };

    (async () => {
      let result;
      // Validate invoiceNumber for garantie
      if ((docType === 'garantie' || docToSave.type === 'garantie') && !docToSave.invoiceNumber) {
        docToSave.invoiceNumber = `GAR-${Date.now()}`;
      }
      // Always save garantie as invoice
      // Always save 'garantie' as invoice
      if (
        docType === 'facture' ||
        docType === 'devis' ||
        docType === 'bon_commande' ||
        docType === 'bon_livraison' ||
        docType === 'proforma' ||
        docType === 'garantie' ||
        docToSave.type === 'garantie'
      ) {
        // Ensure warranty info is present for garantie documents
        if (docType === 'garantie' || docToSave.type === 'garantie') {
          docToSave.type = 'garantie';
          // Add warranty info if missing
          if (!docToSave.garantieDuration && formData.garantieDuration) {
            docToSave.garantieDuration = formData.garantieDuration;
          }
          if (!docToSave.garantieEndDate && formData.garantieEndDate) {
            docToSave.garantieEndDate = formData.garantieEndDate;
          }
          if (!docToSave.serialNumber && formData.serialNumber) {
            docToSave.serialNumber = formData.serialNumber;
          }
        }

        // Ensure client exists and link before saving invoice
        try {
          const cid = await ensureClientExists();
          if (cid) docToSave.clientId = cid;
        } catch (e) {
          console.warn('Could not ensure client before invoice save', e);
        }

        result = await createInvoice(docToSave);
      } else if (docType === 'supplier_invoice') {
        result = await createSupplierInvoice(docToSave);
      }
      // Notify InvoiceHistory to refresh (custom event)
      const savedOk = !!(result && (result.success || result.id || (result.data && (result.data.id || result.data.invoiceNumber))));
      if (savedOk) {
        // attempt to normalize saved invoice object
        const savedInvoice = (result && result.data) ? result.data : (result && result.id) ? result : null;
        window.dispatchEvent(new Event('invoice-history-refresh'));
        // also broadcast the saved invoice so InvoiceHistory can select it automatically
        try { window.dispatchEvent(new CustomEvent('invoice-saved', { detail: savedInvoice })); } catch(e) { /* ignore */ }
        setNotification({ message: t('SalesByInvoices.saveSuccess'), type: 'success' });
        // DEBUG: log saved invoice and refresh DB snapshot for troubleshooting
        try {
          const dbg = await getAllInvoices();
          console.log('DEBUG: getAllInvoices() after save ->', dbg);
        } catch (e) {
          console.warn('DEBUG: failed to fetch all invoices after save', e);
        }
      } else {
        // Log error and show notification for all failures
        console.error('Failed to save warranty certificate/invoice:', result);
        setNotification({
          message: t('SalesByInvoices.saveError') + (result && result.error ? ': ' + result.error : ': Unknown error (no details returned)'),
          type: 'error'
        });
      }
    })();
  };
 
  // Update paid amount when payment modal opens or total changes
  useEffect(() => {
    if (showPaymentModal) {
      const validTotal = total || 0;
      setPaidAmount(String(validTotal)); // prefill but allow user to clear (optional)
      setDebtAmount(0);
    }
  }, [showPaymentModal, total]);

  // Pay handler: show payment modal (like Checkout)
  const handlePay = (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setNotification({ message: t('SalesByInvoices.noProductsAdded'), type: 'warning' });
      barcodeInputRef.current?.focus();
      return;
    }
    if (!formData.clientName || !formData.clientName.trim()) {
      setNotification({ message: t('SalesByInvoices.clientNameRequired'), type: 'warning' });
      return;
    }
    setShowPaymentModal(true);
  };

  // Handle print receipt (like Checkout)
  const handlePrintReceipt = () => {
    if (ipcRenderer && receiptData) {
      const payload = {
        items: receiptData.items,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax,
        discount: receiptData.discount,
        total: receiptData.total,
        date: receiptData.date,
        debt: receiptData.debt || 0,
        paid: receiptData.paid || 0,
        paymentStatus: receiptData.paymentStatus || 'paid',
        printerName: settings.receiptPrinter || undefined,
        showDialog: !!settings.printDialogOnPrint
      };

      ipcRenderer.once('print-result', (ev, result) => {
        if (result && result.success) showNotification(t('checkout.receiptPrinted') || 'Receipt printed!', 'success');
        else showNotification((result && result.error) || t('checkout.printFailed') || 'Print failed', 'error');
      });

      ipcRenderer.send('print-receipt', payload);
    }
    setShowReceiptPreview(false);
    setReceiptData(null);
    refocusBarcodeInput();
  };

  // Confirm payment: close modal, create invoice, then show PDF preview
  const processPayment = async () => {
    setShowPaymentModal(false);

    // --- Payment hardware integration ---
    if (selectedPaymentMethod === 'cash') {
      // Open cash drawer
      if (ipcRenderer) {
        ipcRenderer.send('open-cash-drawer');
      }
    } else if (["visa", "mastercard", "amex", "debit"].includes(selectedPaymentMethod)) {
      // Card payment processing could happen here
      console.log('Processing card payment:', selectedPaymentMethod);
    }

    // Prepare ticket/receipt invoice data (like Checkout)
    const invoiceNumber = `INV-${Date.now()}`;
    const invoiceData = {
      invoiceNumber,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: selectedPaymentMethod,
      debt: debtAmount,
      paid: parseFloat(paidAmount) || 0,
      items: cart.map(item => ({
        // Use real product id when available (linked manual items set item.productId); pure manual items have null productId
        productId: item.productId || (typeof item.id === 'string' && item.id.startsWith('manual-') ? null : item.id),
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        quantityType: item.quantityType || 'unit'
      })),
      type: 'ticket', // Create a ticket/receipt, not the selected document type
      source: 'salesByInvoices',
      customerName: formData.clientName,
      clientAddress: formData.clientAddress,
      clientEmail: formData.clientEmail,
      clientPhone: formData.clientPhone,
      clientRC: formData.clientRC || '',
      clientAI: formData.clientAI || '',
      clientNIS: formData.clientNIS || '',
      clientTaxId: formData.taxId || '',
      paymentStatus: debtAmount > 0 ? 'partial' : 'paid'
    };
    
    // Ensure client exists and link before saving invoice
    try {
      const cid = await ensureClientExists();
      if (cid) invoiceData.clientId = cid;
    } catch (e) {
      console.warn('Could not ensure client before ticket save', e);
    }

    // Save invoice to database (this also updates product quantities automatically)
    const result = await createInvoice(invoiceData);
    const savedOk = !!(result && (result.success || result.id || (result.data && (result.data.id || result.data.invoiceNumber))));
    
    // Update location quantities for items linked to real products only
    if (savedOk && ipcRenderer && selectedLocationId) {
      try {
        for (const item of cart) {
          const productId = item.productId || (typeof item.id === 'string' && item.id.startsWith('manual-') ? null : item.id);
          // Skip pure manual items
          if (!productId) continue;

          // Get current quantity at location
          const locationQty = await ipcRenderer.invoke('get-product-location-quantity', productId, selectedLocationId);
          
          // Decrease quantity
          const newQty = Math.max(0, locationQty - item.quantity);
          
          // Update in database
          await ipcRenderer.invoke('set-product-location-quantity', productId, selectedLocationId, newQty, null);
        }
      } catch (error) {
        console.error('Error updating location quantities:', error);
      }
    }
    
    if (savedOk) {
      // Check which products are now out of stock (skip manual items)
      const outOfStockProducts = [];
      for (const item of cart) {
        const pid = item.productId || (typeof item.id === 'string' && item.id.startsWith('manual-') ? null : item.id);
        if (!pid) continue;
        const product = products.find(p => p.id === pid);
        if (product) {
          const newQuantity = product.quantity - item.quantity;
          if (newQuantity <= 0) {
            outOfStockProducts.push(item.name);
          }
        }
      }
      
      // Reload products
      const productsResult = await getAllProducts();
      if (productsResult.success) {
        setProducts(productsResult.data);
      }
    
      // Recompute totals from cart to ensure values are accurate for the receipt
      const computedSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const computedDiscount = computedSubtotal * (settings.discountRate / 100);
      const computedAfterDiscount = computedSubtotal - computedDiscount;
      const computedTax = computedAfterDiscount * (settings.taxRate / 100);
      const computedTotal = computedAfterDiscount + computedTax;

      // Prepare receipt data for preview (like Checkout)
      const receipt = {
        invoiceNumber,
        items: cart.map(item => ({...item})),
        subtotal: computedSubtotal,
        discount: computedDiscount,
        tax: computedTax,
        total: computedTotal,
        paymentMethod: selectedPaymentMethod,
        date: new Date().toLocaleString(),
        debt: debtAmount || 0,
        paid: parseFloat(paidAmount) || 0,
        paymentStatus: debtAmount > 0 ? 'partial' : 'paid'
      };

      setReceiptData(receipt);
      
      // Clear cart after successful payment
      setTabs(tabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, cart: [] }
          : tab
      ));
      setBarcode('');
      
      // Show success notification
      let message = t('SalesByInvoices.paymentSuccess') || 'Payment successful!';
      if (outOfStockProducts.length > 0) {
        message += ' ' + (t('checkout.outOfStock') || 'Out of stock') + ': ' + outOfStockProducts.join(', ');
      }
      showNotification(message, 'success');
      
      // Automatically print receipt (skip preview modal)
      if (ipcRenderer) {
        const payload = {
          items: receipt.items,
          subtotal: receipt.subtotal,
          tax: receipt.tax,
          discount: receipt.discount,
          total: receipt.total,
          date: receipt.date,
          debt: receipt.debt || 0,
          paid: receipt.paid || 0,
          paymentStatus: receipt.paymentStatus || (receipt.debt && receipt.debt > 0 ? 'partial' : 'paid'),
          printerName: settings.receiptPrinter || undefined,
          showDialog: !!settings.printDialogOnPrint
        };

        ipcRenderer.once('print-result', (ev, result) => {
          if (result && result.success) showNotification(t('checkout.receiptPrinted') || 'Receipt printed!', 'success');
          else showNotification((result && result.error) || t('checkout.printFailed') || 'Print failed', 'error');
        });

        ipcRenderer.send('print-receipt', payload);
      }
    } else {
      showNotification(t('SalesByInvoices.paymentFailed') || 'Payment failed! Please try again.', 'error');
    }
    
    refocusBarcodeInput();
  };
  // Keyboard navigation for payment modal (like Checkout)
  useEffect(() => {
    if (!showPaymentModal) return;
    const handlePaymentKeyPress = (e) => {
      const currentIndex = paymentMethods.indexOf(selectedPaymentMethod);
      const gridColumns = 3;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = currentIndex > 0 ? currentIndex - 1 : paymentMethods.length - 1;
        setSelectedPaymentMethod(paymentMethods[newIndex]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = currentIndex < paymentMethods.length - 1 ? currentIndex + 1 : 0;
        setSelectedPaymentMethod(paymentMethods[newIndex]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = currentIndex - gridColumns >= 0 
          ? currentIndex - gridColumns 
          : currentIndex + gridColumns * Math.floor((paymentMethods.length - 1 - currentIndex) / gridColumns);
        setSelectedPaymentMethod(paymentMethods[newIndex]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = currentIndex + gridColumns < paymentMethods.length
          ? currentIndex + gridColumns
          : currentIndex % gridColumns;
        setSelectedPaymentMethod(paymentMethods[newIndex]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        processPayment();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowPaymentModal(false);
      }
    };
    window.addEventListener('keydown', handlePaymentKeyPress);
    return () => window.removeEventListener('keydown', handlePaymentKeyPress);
  }, [showPaymentModal, selectedPaymentMethod]);

  return (
    <div className="checkout-page">
      <div className="page-header">
        <h1 className="page-title">{t('nav.salesByInvoices')}</h1>
      </div>

      {/* Multi-checkout Tabs UI (like Checkout) */}
      <div className="checkout-tabs">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={`checkout-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            <span className="tab-name">{t('SalesByInvoices.tabName', { num: idx + 1 }) || `Tab ${idx + 1}`}</span>
            <span className="tab-items-count">({tab.cart.length})</span>
            {tabs.length > 1 && (
              <button
                className="tab-close-btn"
                onClick={e => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="add-tab-btn" onClick={addNewTab}>
          ➕ {t('SalesByInvoices.addTab') || 'Add Tab'}
        </button>
      </div>

      <div className="checkout-container">
        {/* Left Side - Cart */}
          <div className="cart-section">
            {/* Price type selector - moved before barcode input */}
            <div className="barcode-scanner" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={barcodeInputRef}
                type="text"
                className="barcode-input"
                placeholder={t('SalesByInvoices.scanOrEnterBarcode')}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                autoFocus
                style={{ width: '100%' }}
              />
              <button className="scan-btn" onClick={() => handleBarcodeSubmit()}>
                📷
              </button>
              <button className="add-montant-btn secondary-btn" onClick={() => openManualItemModal()} title={t('SalesByInvoices.addAmount') || 'Add amount'}>
                ➕
              </button>
            </div>
            {/* barcode-scanner moved inline above */}

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <p>🛒 {t('SalesByInvoices.noProductsAdded')}</p>
              </div>
            ) : (
              
              cart.map((item, index) => (
                <div
                  key={item.id}
                  className={`cart-item ${selectedItemIndex === index ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedItemIndex(index);
                    if (docType === 'garantie') {
                      setFormData(fd => ({
                        ...fd,
                        productName: item.name,
                        serialNumber: item.serialNumber || item.barcode || ''
                      }));
                    }
                  }}
                  onDoubleClick={() => {
                    setSelectedItemIndex(index);
                    setEditingItemId(item.id);
                    setEditingQuantity(item.quantity.toString());
                    setTimeout(() => {
                      const el = quantityInputRef.current;
                      if (el) { el.focus(); if (el.select) el.select(); }
                    }, 100);
                  }}
                >

                  <div className="item-info">
                    <h3 className="item-name">
                      {item.name}
                      {item.quantityType && item.quantityType !== 'unit' && (
                        <span style={{
                          marginLeft: 30,
                          fontSize: 10,
                          fontWeight: 500,
                          background: '#2ecc40',
                          color: '#fff',
                          borderRadius: 6,
                          padding: '2px 8px',
                          display: 'inline-block'
                        }}>
                          ({item.quantityType})
                        </span>
                      )}
                    </h3>
                    <p className="item-price">{formatCurrency(item.price, settings.currency)}</p>
                  </div>
                  <div className="item-controls">
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      -
                    </button>
                    {editingItemId === item.id ? (
                      <input
                        ref={quantityInputRef}
                        type="number"
                        className="item-quantity-input"
                        value={editingQuantity}
                        onChange={(e) => setEditingQuantity(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const newQty = parseInt(editingQuantity) || 1;
                            updateQuantity(item.id, newQty);
                            setEditingItemId(null);
                            setEditingQuantity('');
                          }
                        }}
                        onBlur={() => {
                          const newQty = parseInt(editingQuantity) || 1;
                          updateQuantity(item.id, newQty);
                          setEditingItemId(null);
                          setEditingQuantity('');
                        }}
                      />
                    ) : (
                      <span className="item-quantity">{item.quantity}</span>
                    )}
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="item-total">
                    {formatCurrency(item.price * item.quantity, settings.currency)}
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => removeFromCart(item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Document Fields & Actions */}
        <div className="summary-section">
          <form className="document-form" onSubmit={e => { e.preventDefault(); generateAndPreviewPDF(); }}>
            {/* Price type selector - now above Document Type */}
            <div style={{ margin: '0 0 18px 0', display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 8, 
                flexWrap: 'nowrap', 
                minWidth: 0,
                border: '1.5px solid var(--border-color, #e0e0e0)',
                borderRadius: 8,
                background: 'var(--card-bg, #fafbfc)',
                padding: '10px 16px',
                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.03)',
              }}>
                <input
                  type="checkbox"
                  checked={priceType === 'wholesale'}
                  onChange={e => setPriceType(e.target.checked ? 'wholesale' : 'detail')}
                  style={{
                    width: 20,
                    height: 20,
                    accentColor: 'var(--accent-color, #ff6600)',
                    marginRight: 7,
                    marginTop: 10,
                    background: 'var(--input-bg, #fff)',
                    border: '1.5px solid var(--border-color, #e0e0e0)',
                    borderRadius: 5,
                    transition: 'background 0.2s, border 0.2s',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <label style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #222)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', margin: 0 }}>
                    {t('SalesByInvoices.wholesalePrice')}
                  </label>

                  {/* Use translation key and avoid duplication; direction adapts for RTL languages */}
                  <div
                    className="price-type-note"
                    style={{
                      marginTop: 8,
                      maxWidth: '420px',
                      direction: isRTL ? 'rtl' : 'ltr',
                      textAlign: isRTL ? 'right' : 'left'
                    }}
                  >
                    {t('SalesByInvoices.currentPriceType', { priceType: priceType === 'wholesale' ? t('SalesByInvoices.wholesalePrice') : t('SalesByInvoices.detailPrice') })}
                  </div>
                </div>
              </div>
            </div>
            <label>
              {/* Location Selector */}
              {locations.length > 0 && (
                <div className="location-selector-card">
                  <label className="location-label">📍 {t('checkout.saleLocation')}:</label>
                  <select
                    className="location-select"
                    value={selectedLocationId || ''}
                    onChange={(e) => setSelectedLocationId(parseInt(e.target.value))}
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.type === 'shop' ? '🏪' : '📦'} {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Totals Card (like Checkout) */}
            <div className="totals-card">
              <div className="total-row">
                <span>{t('SalesByInvoices.subtotal')}</span>
                <span className="total-value">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
              <div className="total-row discount-row">
                <span>{t('SalesByInvoices.discount')} ({settings.discountRate || 0}%)</span>
                <span className="total-value discount-editable">
                  <NumericInput
                    className="discount-input"
                    value={discountInput}
                    onChange={e => {
                      const raw = String(e.target.value);
                      // keep raw text so user can type partial decimals like "0." or use comma
                      setDiscountInput(raw);
                      const normalized = raw.replace(',', '.');
                      const parsed = parseFloat(normalized);
                      if (!Number.isNaN(parsed)) {
                        let newDiscount = parsed;
                        if (newDiscount > subtotal) newDiscount = subtotal;
                        if (newDiscount < 0) newDiscount = 0;
                        setDiscount(newDiscount);
                      } else if (raw.trim() === '') {
                        // empty input should be treated as zero
                        setDiscount(0);
                      }
                    }}
                    onFocus={e => e.target.select()}
                    onBlur={() => setDiscountInput((discount || 0).toFixed(2))}
                    step="0.01"
                    min="0"
                    max={subtotal}
                  />
                  <span className="currency-suffix">
                    {formatCurrency(0, settings.currency).replace('0.00', '').trim()}
                  </span>
                </span>
              </div>
              <div className="total-row">
                <span>{t('SalesByInvoices.tax')} ({settings.taxRate || 0}%)</span>
                <span className="total-value">{formatCurrency(tax, settings.currency)}</span>
              </div>
              <div className="total-row grand-total">
                <span>{t('SalesByInvoices.grandTotal')}</span>
                <span className="total-value">{formatCurrency(total, settings.currency)}</span>
              </div>
            </div>

              <label style={{ display: 'block', marginBottom: 8 }}>
                {t('SalesByInvoices.searchClient') || 'Search Client'}
                <input
                  value={clientSearchQuery}
                  onChange={e => setClientSearchQuery(e.target.value)}
                  placeholder={t('SalesByInvoices.searchClientPlaceholder') || 'Search by name, phone, or email'}
                  style={{ width: '100%', padding: '8px 10px', marginTop: 6 }}
                />
                {clientSearchLoading && <div style={{ marginTop: 6, fontSize: 12 }}>{t('common.loading') || 'Loading...'}</div>}
                {!clientSearchLoading && clientSearchQuery.trim().length >= 2 && clientSearchResults.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{t('SalesByInvoices.noClientsFound') || 'No clients found'}</div>
                )}
                {clientSearchResults.length > 0 && (
                  <div className="client-search-results" style={{ marginTop: 6, maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-color, #eee)', borderRadius: 6, background: 'var(--card-bg, #fff)' }}>
                    {clientSearchResults.map(c => (
                      <div key={c.id} className="client-result" onClick={() => selectClient(c)} style={{ padding: 8, borderBottom: '1px solid #fafafa', cursor: 'pointer' }}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>{c.phone || ''} {c.email ? ` • ${c.email}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}

              </label>

              {t('SalesByInvoices.documentType')}
              <select value={docType} onChange={handleTypeChange}>
                {DOCUMENT_TYPES.map(dt => (
                  <option key={dt.value} value={dt.value}>{t(dt.label)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('SalesByInvoices.clientName')}
              <input name="clientName" value={formData.clientName} onChange={handleInputChange} required />
            </label>
            <label>
              {t('SalesByInvoices.clientAddress')}
              <input name="clientAddress" value={formData.clientAddress} onChange={handleInputChange} />
            </label>
            <label>
              {t('SalesByInvoices.clientEmail')}
              <input name="clientEmail" value={formData.clientEmail} onChange={handleInputChange} />
            </label>
            <label>
              {t('SalesByInvoices.clientPhone')}
              <input name="clientPhone" value={formData.clientPhone} onChange={handleInputChange} />
            </label>
            <label>
              {t('SalesByInvoices.date')}
              <input name="date" type="date" value={formData.date} onChange={handleInputChange} />
            </label>
            {/* Issuer/company info (read-only) */}
            {/* Company Name, Address, and Contact are hidden on Sales by invoices page as requested */}
            {/* Company Tax ID is managed in Settings and not shown here */}
            <label>
              {t('settings.taxId')}
              <input name="taxId" value={formData.taxId || ''} onChange={handleInputChange} placeholder={t('settings.taxIdPlaceholder') || ''} />
            </label>
            <label>
              {'RC'}
              <input name="clientRC" value={formData.clientRC || ''} onChange={handleInputChange} placeholder={t('settings.rcPlaceholder') || 'RC (optional)'} />
            </label>
            <label>
              {t('settings.ai') || 'AI'}
              <input name="clientAI" value={formData.clientAI || ''} onChange={handleInputChange} placeholder={t('settings.aiPlaceholder') || 'AI (optional)'} />
            </label>
            <label>
              {t('settings.nis') || 'NIS'}
              <input name="clientNIS" value={formData.clientNIS || ''} onChange={handleInputChange} placeholder={t('settings.nisPlaceholder') || 'NIS (optional)'} />
            </label>
            <label>
              {t('SalesByInvoices.paymentTerms')}
              <input name="paymentTerms" value={formData.paymentTerms} onChange={handleInputChange} />
            </label>
            {docType === 'facture' && (
              <label>
                {t('SalesByInvoices.paymentStatus')}
                <select
                  name="paymentStatus"
                  value={formData.paymentStatus}
                  onChange={handleInputChange}
                  style={{ marginLeft: 8 }}
                >
                  {paymentStatusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            )}
            {docType === 'garantie' && (
              <>
                <label>
                  {t('SalesByInvoices.product')}
                  <input
                    name="productName"
                    value={formData.productName || ''}
                    onChange={handleInputChange}
                    onBlur={handleProductBlur}
                    list="product-list"
                    autoComplete="off"
                  />
                  <datalist id="product-list">
                    {products.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </label>
                <label>
                  {t('SalesByInvoices.serialNumber')}
                  <input name="serialNumber" value={formData.serialNumber || ''} onChange={handleInputChange} />
                </label>
                <div style={{ marginBottom: 12 }}>
                  <b>{t('SalesByInvoices.warrantyDuration')}</b>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 90px)',
                    gap: '12px',
                    marginTop: 8,
                    alignItems: 'center',
                    maxWidth: 300
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <NumericInput
                        min="0"
                        placeholder={t('SalesByInvoices.years')}
                        value={garantieDuration.years}
                        onChange={e => setGarantieDuration({ ...garantieDuration, years: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1.2px solid #ccc', fontSize: 15 }}
                      />
                      <span style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{t('SalesByInvoices.years')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <NumericInput
                        min="0"
                        placeholder={t('SalesByInvoices.months')}
                        value={garantieDuration.months}
                        onChange={e => setGarantieDuration({ ...garantieDuration, months: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1.2px solid #ccc', fontSize: 15 }}
                      />
                      <span style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{t('SalesByInvoices.months')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <NumericInput
                        min="0"
                        placeholder={t('SalesByInvoices.days')}
                        value={garantieDuration.days}
                        onChange={e => setGarantieDuration({ ...garantieDuration, days: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1.2px solid #ccc', fontSize: 15 }}
                      />
                      <span style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{t('SalesByInvoices.days')}</span>
                    </div>
                  </div>
                  {garantieEndDate && (
                    <div style={{ marginTop: 8, color: '#1a8917', fontWeight: 500 }}>
                      {t('SalesByInvoices.warrantyEndDate')}: <b>{garantieEndDate}</b>
                    </div>
                  )}
                </div>
              </>
            )}

            

            {/* ...existing code... */}



          <div className="action-buttons">
            {/* Pay button works for all document types */}
            <button
              type="button"
              className="pay-btn primary-btn"
              onClick={handlePay}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              💳 {t('SalesByInvoices.pay')} <kbd className="kbd-shortcut">F9</kbd>
            </button>
            
            <button type="submit" className="print-btn secondary-btn">
              🖨️ {t('SalesByInvoices.generatePdf')} <kbd className="kbd-shortcut">F10</kbd>
            </button>
            <button
              type="button"
              className="drawer-btn secondary-btn"
              onClick={() => {
                if (window.require) {
                  const { ipcRenderer } = window.require('electron');
                  if (ipcRenderer) ipcRenderer.send('open-cash-drawer');
                }
                setNotification({ message: t('checkout.cashDrawerOpened'), type: 'success' });
                barcodeInputRef.current?.focus();
              }}
            >
              💰 {t('SalesByInvoices.openDrawer')} <kbd className="kbd-shortcut">F11</kbd>
            </button>
            <button type="button" className="clear-btn danger-btn" onClick={clearCart}>
              🗑️ {t('SalesByInvoices.clearInvoice')} <kbd className="kbd-shortcut">F12</kbd>
            </button>
          </div>

          <div className="keyboard-shortcuts-help">
            <p className="help-title">⌨️ {t('SalesByInvoices.keyboardShortcuts')}</p>
            <div className="shortcuts-list">
              <div className="shortcut-row"><kbd>F9</kbd> <span>{t('checkout.shortcutProcessPayment')}</span></div>
              <div className="shortcut-row"><kbd>F10</kbd> <span>{t('checkout.shortcutPrintReceipt')}</span></div>
              <div className="shortcut-row"><kbd>F11</kbd> <span>{t('checkout.shortcutOpenDrawer')}</span></div>
              <div className="shortcut-row"><kbd>F12</kbd> <span>{t('checkout.shortcutClearCart')}</span></div>
              <div className="shortcut-row"><kbd>F2</kbd> <span>{t('checkout.shortcutNewTab')}</span></div>
              <div className="shortcut-row"><kbd>←</kbd> <kbd>→</kbd> <span>{t('checkout.shortcutSwitchTab')}</span></div>
              <div className="shortcut-row"><kbd>ESC</kbd> <span>{t('checkout.shortcutFocusBarcode')}</span></div>
              <div className="shortcut-row"><kbd>Del</kbd> <span>{t('checkout.shortcutRemoveLast')}</span></div>
            </div>
          </div>
        </form>
           {showPaymentModal && (
                  <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <h2>{t('checkout.selectPaymentMethod')}</h2>
                        <button className="modal-close" onClick={() => setShowPaymentModal(false)}>✕</button>
                      </div>
                      <div className="modal-body">
                        <div className="payment-methods">
                          <button
                            className={`payment-method-btn ${selectedPaymentMethod === 'cash' ? 'selected' : ''}`}
                            onClick={() => setSelectedPaymentMethod('cash')}
                          >
                            <span className="payment-icon">💵</span>
                            <span className="payment-label">{t('checkout.cash')}</span>
                          </button>
                          <button
                            className={`payment-method-btn ${selectedPaymentMethod === 'visa' ? 'selected' : ''}`}
                            onClick={() => setSelectedPaymentMethod('visa')}
                          >
                            <span className="payment-icon">💳</span>
                            <span className="payment-label">{t('checkout.visa')}</span>
                          </button>
                          <button
                            className={`payment-method-btn ${selectedPaymentMethod === 'mastercard' ? 'selected' : ''}`}
                            onClick={() => setSelectedPaymentMethod('mastercard')}
                          >
                            <span className="payment-icon">💳</span>
                            <span className="payment-label">{t('checkout.mastercard')}</span>
                          </button>
                          <button
                            className={`payment-method-btn ${selectedPaymentMethod === 'amex' ? 'selected' : ''}`}
                            onClick={() => setSelectedPaymentMethod('amex')}
                          >
                            <span className="payment-icon">💳</span>
                            <span className="payment-label">{t('checkout.amex')}</span>
                          </button>
                          <button
                            className={`payment-method-btn ${selectedPaymentMethod === 'debit' ? 'selected' : ''}`}
                            onClick={() => setSelectedPaymentMethod('debit')}
                          >
                            <span className="payment-icon">💳</span>
                            <span className="payment-label">{t('checkout.debit')}</span>
                          </button>
                          <button
                            className={`payment-method-btn ${selectedPaymentMethod === 'other' ? 'selected' : ''}`}
                            onClick={() => setSelectedPaymentMethod('other')}
                          >
                            <span className="payment-icon">📱</span>
                            <span className="payment-label">{t('checkout.other')}</span>
                          </button>
                        </div>
                        <div className="payment-total">
                          <span>{t('checkout.totalAmount')}:</span>
                          <span className="amount">{formatCurrency(total, settings.currency)}</span>
                        </div>
                        
                        <div className="debt-section" style={{ marginTop: '20px', padding: '15px', background: 'var(--card-bg)', borderRadius: '8px' }}>
                          <div className="debt-input-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-color)' }}>
                              {t('checkout.paidAmount')} (optional):
                            </label>
                            <input
                              type="text"
                              className="debt-input"
                              style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '2px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                              value={paidAmount}
                              onChange={(e) => {
                                const str = e.target.value;
                                // allow empty string (optional field)
                                setPaidAmount(str);
                                const paid = parseFloat(str) || 0;
                                setDebtAmount(Math.max(0, (total || 0) - paid));
                              }}
                              inputMode="decimal"
                              placeholder={String(total || 0)}
                            />
          
                            <div style={{ marginTop: '8px' }}>
                              <label style={{ display: 'block', marginBottom: '6px' }}>{t('SalesByInvoices.clientNameOptional')}</label>
                              <input name="clientName" type="text" value={formData.clientName} onChange={handleInputChange} placeholder={t('SalesByInvoices.clientNameOptional')} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                            </div>
                          </div>
                          
                          <div className="debt-display" style={{ padding: '10px', background: debtAmount > 0 ? '#ff6b6b20' : '#51cf6620', borderRadius: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '14px', opacity: 0.8 }}>{t('checkout.remainingDebt')}:</span>
                            <span style={{ fontSize: '20px', fontWeight: 'bold', marginLeft: '10px', color: debtAmount > 0 ? '#ff6b6b' : '#51cf66' }}>
                              {formatCurrency(debtAmount, settings.currency)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="payment-keyboard-hints">
                          <div className="hint-item">
                            <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <span>{t('checkout.shortcutNavigate')}</span>
                          </div>
                          <div className="hint-item">
                            <kbd>Enter</kbd> <span>{t('checkout.shortcutConfirm')}</span>
                          </div>
                          <div className="hint-item">
                            <kbd>ESC</kbd> <span>{t('checkout.shortcutCancel')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button className="cancel-btn" onClick={() => setShowPaymentModal(false)}>
                          {t('checkout.shortcutCancel')} <kbd className="kbd-hint">ESC</kbd>
                        </button>
                        <button className="confirm-btn" onClick={processPayment}>
                          {t('checkout.confirmPayment')} <kbd className="kbd-hint">Enter</kbd>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

          {/* Manual Montant Modal */}
          {showManualItemModal && (
            <div className="modal-overlay" onClick={closeManualItemModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header">
                  <h2>➕ {t('SalesByInvoices.addAmount') || 'Add amount'}</h2>
                  <button className="close-btn" onClick={closeManualItemModal}>✕</button>
                </div>
                <form className="manual-item-form" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualItemSubmit(); } }} onSubmit={handleManualItemSubmit}>
                  <div className="form-group">
                    <label>{t('SalesByInvoices.searchProduct') || 'Search product (name or reference)'}</label>
                    <input
                      value={manualProductQuery}
                      onChange={e => setManualProductQuery(e.target.value)}
                      placeholder={t('SalesByInvoices.searchProductPlaceholder') || 'Type name or reference'}
                      style={{ width: '100%', padding: '8px 10px', marginTop: 6 }}
                    />
                    {manualProductQuery.trim().length > 0 && (
                      <div className="product-search-results" style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color, #eee)', borderRadius: 6, background: 'var(--card-bg, #fff)' }}>
                        {manualProductResults.length === 0 ? (
                          <div style={{ padding: 8, fontSize: 12, color: '#666' }}>{t('SalesByInvoices.noProductsFound') || 'No products found'}</div>
                        ) : (
                          manualProductResults.map(p => (
                            <div key={p.id} className="product-result" onClick={() => selectManualProduct(p)} style={{ padding: 8, borderBottom: '1px solid #fafafa', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div style={{ fontSize: 12, color: '#666' }}>{p.reference || p.barcode || ''}</div>
                              </div>
                              <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{formatCurrency(p.price || p.detailPrice || 0, settings.currency)}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <label style={{ marginTop: 8 }}>{t('SalesByInvoices.manualItemName') || 'Item name (optional)'}</label>
                    <input value={manualItemData.name} onChange={e => setManualItemData({ ...manualItemData, name: e.target.value, _linkedProductId: manualItemData._linkedProductId })} placeholder={t('SalesByInvoices.manualItemNamePlaceholder') || 'e.g., Service, Tip'} />
                  </div>
                  <div className="form-group">
                    <label>{t('SalesByInvoices.amount') || 'Amount'}</label>
                    <NumericInput id="sales-manual-amount-input" value={manualItemData.price} onChange={e => setManualItemData({ ...manualItemData, price: e.target.value })} min="0" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label>{t('checkout.quantity') || 'Quantity'}</label>
                    <NumericInput value={manualItemData.quantity} onChange={e => setManualItemData({ ...manualItemData, quantity: e.target.value })} min="0.01" step="0.01" />
                  </div>
                  <div className="form-group">
                    <label>{t('products.unitType') || 'Unit'}</label>
                    <select value={manualItemData.quantityType} onChange={e => setManualItemData({ ...manualItemData, quantityType: e.target.value })}>
                      <option value="unit">{t('products.unit', 'Unit')}</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="tonne">tonne</option>
                      <option value="mg">mg</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="m">m</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                      <option value="box">{t('products.box', 'Box')}</option>
                      <option value="pack">{t('products.pack', 'Pack')}</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={closeManualItemModal}>{t('SalesByInvoices.shortcutCancel') || 'Cancel'}</button>
                    <button type="submit" className="submit-btn primary-btn">✅ {t('SalesByInvoices.add')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* PDF Preview Modal */}
          {showPdfPreview && pdfUrl && (
            <div className="modal-overlay" onClick={() => setShowPdfPreview(false)}>
              <div className="modal-content receipt-preview-modal" onClick={e => e.stopPropagation()}>
                <div className="receipt-preview-header">
                  <h2>📄 {t('SalesByInvoices.documentPreview')}</h2>
                  <button className="close-btn" onClick={() => setShowPdfPreview(false)}>✕</button>
                </div>
                <div className="receipt-preview-content" style={{height: '70vh', overflow: 'auto'}}>
                  <iframe
                    src={pdfUrl}
                    title="PDF Preview"
                    width="100%"
                    height="100%"
                    style={{ minHeight: 500, border: 'none', background: 'white', borderRadius: 8 }}
                  />
                </div>
                <div className="receipt-preview-actions">
                  <button className="cancel-btn" onClick={() => setShowPdfPreview(false)}>
                    {t('common.close')}
                  </button>
                  <a
                    href={pdfUrl}
                    download={`${docType}_${formData.clientName || 'document'}.pdf`}
                    className="confirm-btn"
                    style={{ textAlign: 'center', textDecoration: 'none' }}
                    onClick={() => setShowPdfPreview(false)}
                  >
                    🖨️ {t('SalesByInvoices.downloadPdf')}
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Receipt Preview Modal (like Checkout) */}
      {showReceiptPreview && receiptData && (
        <div className="modal-overlay" onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handlePrintReceipt();
          } else if (e.key === 'Escape') {
            setShowReceiptPreview(false);
            refocusBarcodeInput();
          }
        }}>
          <div className="receipt-preview-modal">
            <div className="receipt-preview-header">
              <h2>📄 {t('checkout.receiptPreview') || 'Receipt Preview'}</h2>
              <button className="close-btn" onClick={() => {
                setShowReceiptPreview(false);
                refocusBarcodeInput();
              }}>✕</button>
            </div>
            <div className="receipt-preview-content">
              <div className="receipt-paper">
                {/* Store Header */}
                <div className="receipt-header">
                  {settings.posLogo ? (
                    <img src={settings.posLogo} alt="Logo" className="receipt-logo" style={{ maxWidth: 120, maxHeight: 120 }} />
                  ) : (
                    <h1>{settings.posName || 'POS'}</h1>
                  )}
                  <p className="receipt-date">{receiptData.date}</p>
                  <p className="receipt-invoice">{t('checkout.invoice') || 'Invoice'}: {receiptData.invoiceNumber}</p>
                </div>

                {/* Items */}
                <div className="receipt-items">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('checkout.item') || 'Item'}</th>
                        <th>{t('checkout.qty') || 'Qty'}</th>
                        <th>{t('checkout.price') || 'Price'}</th>
                        <th>{t('checkout.total') || 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptData.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.quantity}{item.quantityType && item.quantityType !== 'unit' ? ' ' + item.quantityType : ''}</td>
                          <td>{formatCurrency(item.price, settings.currency)}</td>
                          <td>{formatCurrency(item.price * item.quantity, settings.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="receipt-totals">
                  <div className="receipt-row">
                    <span>{t('checkout.subtotal') || 'Subtotal'}:</span>
                    <span>{formatCurrency(receiptData.subtotal, settings.currency)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>{t('checkout.discount') || 'Discount'} ({settings.discountRate}%):</span>
                    <span>-{formatCurrency(receiptData.discount, settings.currency)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>{t('checkout.tax') || 'Tax'} ({settings.taxRate}%):</span>
                    <span>{formatCurrency(receiptData.tax, settings.currency)}</span>
                  </div>
                  <div className="receipt-row total">
                    <span>{t('checkout.total') || 'Total'}:</span>
                    <span>{formatCurrency(receiptData.total, settings.currency)}</span>
                  </div>
                  {Number(receiptData.debt) > 0 && (
                    <div className="receipt-row">
                      <span>{t('checkout.remainingDebt') || 'Remaining Debt'}:</span>
                      <span style={{ color: '#d6336c', fontWeight: '700' }}>{formatCurrency(Number(receiptData.debt), settings.currency)}</span>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div className="receipt-payment">
                  <p>{t('checkout.paymentMethod') || 'Payment Method'}: <strong>{receiptData.paymentMethod.toUpperCase()}</strong></p>
                </div>

                {/* Footer */}
                <div className="receipt-footer">
                  <p>{t('checkout.thankYou') || 'Thank you for your purchase!'}</p>
                  <p>{t('checkout.comeAgain') || 'Please come again'}</p>
                </div>
              </div>
            </div>
            <div className="receipt-preview-actions">
              <button className="cancel-btn" onClick={() => {
                setShowReceiptPreview(false);
                refocusBarcodeInput();
              }}>
                {t('common.close') || 'Close'}
              </button>
              <button className="confirm-btn" onClick={handlePrintReceipt}>
                🖨️ {t('checkout.printReceipt') || 'Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => {
            setNotification(null);
            barcodeInputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};

export default SalesByInvoices;

