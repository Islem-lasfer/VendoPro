import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllProducts, getProductByBarcode, createInvoice } from '../../utils/database';
import tpeIntegration from '../../utils/tpeIntegration';
import NumericInput from '../../components/NumericInput/NumericInput';
import Notification from '../../components/Notification/Notification';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';
import JsBarcode from 'jsbarcode';
import './Checkout.css';

// Conditionally import ipcRenderer for Electron environment
let ipcRenderer = null;
try {
  if (window.require) {
    const electron = window.require('electron');
    ipcRenderer = electron.ipcRenderer;
  }
} catch (error) {
  console.warn('ipcRenderer not available:', error.message); 
}

const generateBarcodeDataUrl = (text, options = {}) => {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, String(text), { format: 'CODE128', displayValue: true, height: 40, margin: 0, ...options });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Barcode generation failed', e);
    return null;
  }
};

const Checkout = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [barcode, setBarcode] = useState('');

  // Manual Montant (amount) modal for quick manual add when barcode/product missing or has no price
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemData, setManualItemData] = useState({ name: '', price: '', quantity: '1', quantityType: 'unit', _linkedProductId: null });

  const openManualItemModal = (prefill = {}) => {
    setManualItemData({ name: '', price: '', quantity: '1', quantityType: 'unit', _linkedProductId: null, ...prefill });
    setShowManualItemModal(true);
    setTimeout(() => {
      barcodeInputRef.current?.blur();
      // Focus the amount input after modal is rendered
      setTimeout(() => document.getElementById('manual-amount-input')?.focus(), 150);
    }, 50);
  };

  const closeManualItemModal = () => {
    setShowManualItemModal(false);
    setManualItemData({ name: '', price: '', quantity: '1', quantityType: 'unit', _linkedProductId: null });
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleManualItemSubmit = (e) => {
    e && e.preventDefault();
    const price = parseFloat(manualItemData.price);
    const quantity = parseFloat(manualItemData.quantity) || 1;
    if (isNaN(price) || price <= 0) {
      showNotification(t('common.invalidAmount'), 'error');
      return;
    }

    let item = null;
    if (manualItemData._linkedProductId) {
      item = {
        id: `linked-${manualItemData._linkedProductId}-${Date.now()}`,
        productId: manualItemData._linkedProductId,
        name: manualItemData.name && manualItemData.name.trim() ? manualItemData.name.trim() : (manualItemData.productName || t('SalesByInvoices.manualItem') || 'Manual Item'),
        barcode: null,
        price,
        quantity,
        quantityType: manualItemData.quantityType || 'unit'
      };
    } else {
      item = {
        id: `manual-${Date.now()}`,
        name: manualItemData.name && manualItemData.name.trim() ? manualItemData.name.trim() : (t('SalesByInvoices.manualItem') || 'Manual Item'),
        barcode: null,
        price,
        quantity,
        quantityType: manualItemData.quantityType || 'unit'
      };
    }

    setTabs(tabs.map(tab => tab.id === activeTabId ? { ...tab, cart: [...tab.cart, item] } : tab));
    playBeepSound();
    showNotification(t('SalesByInvoices.itemAdded'), 'success');
    setShowManualItemModal(false);
    setManualItemData({ name: '', price: '', quantity: '1', quantityType: 'unit', _linkedProductId: null });
    setBarcode('');
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  }; 
  
  // Load tabs from localStorage or use default
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem('checkoutTabs');
    if (savedTabs) {
      try {
        // Remove any static name fields from tabs loaded from storage
        const parsedTabs = JSON.parse(savedTabs);
        return parsedTabs.map(({ name, ...tab }) => ({ ...tab }));
      } catch (e) {
        return [{
          id: 1,
          cart: [],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0
        }];
      }
    }
    return [{
      id: 1,
      cart: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0
    }];
  });
  
  const [activeTabId, setActiveTabId] = useState(() => {
    const savedActiveTabId = localStorage.getItem('checkoutActiveTabId');
    return savedActiveTabId ? parseInt(savedActiveTabId) : 1;
  });
  
  const [nextTabId, setNextTabId] = useState(() => {
    const savedNextTabId = localStorage.getItem('checkoutNextTabId');
    return savedNextTabId ? parseInt(savedNextTabId) : 2;
  });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const paymentMethods = ['cash', 'visa', 'mastercard', 'amex', 'debit', 'other'];
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [debtAmount, setDebtAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const barcodeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  
  // Locations state
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    const saved = localStorage.getItem('checkoutSelectedLocationId');
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
        localStorage.setItem('checkoutSelectedLocationId', selectedLoc.id.toString());
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Save selected location
  useEffect(() => {
    if (selectedLocationId) {
      localStorage.setItem('checkoutSelectedLocationId', selectedLocationId.toString());
    }
  }, [selectedLocationId]);

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

  // Create beep sound using Web Audio API
  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Frequency in Hz (beep sound)
      oscillator.type = 'square'; // Square wave for sharp beep
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1); // Beep duration 100ms
    } catch (error) {
      console.log('Beep sound not available:', error);
    }
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  const cart = activeTab.cart;
  const subtotal = activeTab.subtotal;
  const tax = activeTab.tax;
  const discount = activeTab.discount;
  const total = activeTab.total;

  // Load products from database
  const [products, setProducts] = useState([]);
  
  // Save tabs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('checkoutTabs', JSON.stringify(tabs));
  }, [tabs]);
  
  // Save activeTabId to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('checkoutActiveTabId', activeTabId.toString());
  }, [activeTabId]);
  
  // Save nextTabId to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('checkoutNextTabId', nextTabId.toString());
  }, [nextTabId]);
  
  useEffect(() => {
    const loadProducts = async () => {
      const result = await getAllProducts();
      if (result.success) {
        setProducts(result.data);
      }
    };
    loadProducts();
    
    // Refresh products every 5 seconds
    const interval = setInterval(loadProducts, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Calculate totals for active tab
    const sub = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = sub * (settings.discountRate / 100);
    const afterDiscount = sub - discountAmount;
    const taxAmount = afterDiscount * (settings.taxRate / 100);
    
    setTabs(tabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, subtotal: sub, discount: discountAmount, tax: taxAmount, total: afterDiscount + taxAmount }
        : tab
    ));
    
    // Reset selection if cart is empty or selected index is out of bounds
    if (cart.length === 0) {
      setSelectedItemIndex(-1);
    } else if (selectedItemIndex >= cart.length) {
      setSelectedItemIndex(cart.length - 1);
    }
  }, [cart, settings.taxRate, settings.discountRate, activeTabId]);

  useEffect(() => {
    // Listen for barcode scanner input
    if (ipcRenderer) {
      ipcRenderer.on('barcode-result', (event, data) => {
        handleBarcodeSubmit(data);
      });

      ipcRenderer.on('open-cash-drawer', () => {
        openCashDrawer();
      });
    }

    return () => {
      if (ipcRenderer) {
        ipcRenderer.removeAllListeners('barcode-result');
        ipcRenderer.removeAllListeners('open-cash-drawer');
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't handle shortcuts if notification or modal is open
      if (notification || showPaymentModal || showReceiptPreview || confirmDialog || showManualItemModal) {
        return;
      }
      
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const currentCart = activeTab?.cart || [];

      // Allow Tab key even when in input fields
      if (e.key === 'Tab') {
        e.preventDefault();
        if (currentCart.length > 0) {
          setSelectedItemIndex(prev => {
            // If nothing is selected yet, start from the first item
            if (prev < 0) return 0;
            // Tab moves forward, Shift+Tab moves backward
            if (e.shiftKey) {
              const newIndex = prev <= 0 ? currentCart.length - 1 : prev - 1;
              return newIndex;
            } else {
              const newIndex = prev >= currentCart.length - 1 ? 0 : prev + 1;
              return newIndex;
            }
          });
        }
        return; // Exit early after handling Tab
      }

      // Don't trigger other shortcuts if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        // Trigger payment if cart is not empty
        if (currentCart.length > 0) {
          const payBtn = document.querySelector('.pay-btn');
          if (payBtn) payBtn.click();
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        const printBtn = document.querySelector('.print-btn');
        if (printBtn) printBtn.click();
      } else if (e.key === 'F11') {
        e.preventDefault();
        const drawerBtn = document.querySelector('.drawer-btn');
        if (drawerBtn) drawerBtn.click();
      } else if (e.key === 'F12') {
        e.preventDefault();
        const clearBtn = document.querySelector('.clear-btn');
        if (clearBtn) clearBtn.click();
      } else if (e.key === 'F2') {
        e.preventDefault();
        const addTabBtn = document.querySelector('.add-tab-btn');
        if (addTabBtn) addTabBtn.click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Switch to next tab
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTabId(tabs[nextIndex].id);
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Switch to previous tab
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTabId(tabs[prevIndex].id);
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      } else if (e.key === '+' || e.key === 'Add') {
        // Open manual amount modal via + key
        e.preventDefault();
        openManualItemModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Delete selected product or focus barcode if nothing selected
        if (selectedItemIndex >= 0 && currentCart.length > 0) {
          const selectedItem = currentCart[selectedItemIndex];
          setTabs(tabs.map(tab =>
            tab.id === activeTabId
              ? { ...tab, cart: tab.cart.filter(item => item.id !== selectedItem.id) }
              : tab
          ));
          // Reset selection
          setSelectedItemIndex(-1);
        } else {
          // If nothing selected, focus barcode input
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        if (currentCart.length > 0) {
          const lastItem = currentCart[currentCart.length - 1];
          setTabs(tabs.map(tab =>
            tab.id === activeTabId
              ? { ...tab, cart: tab.cart.filter(item => item.id !== lastItem.id) }
              : tab
          ));
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentCart.length > 0) {
          const itemIndex = selectedItemIndex >= 0 ? selectedItemIndex : currentCart.length - 1;
          const selectedItem = currentCart[itemIndex];
          if (selectedItem) {
            setEditingItemId(selectedItem.id);
            setEditingQuantity(selectedItem.quantity.toString());
            setTimeout(() => quantityInputRef.current?.focus(), 100);
          }
        }
      } else if (e.key === 'ArrowUp' && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (currentCart.length > 0) {
          setSelectedItemIndex(prev => {
            // If nothing is selected yet, start from the last item
            if (prev < 0) return currentCart.length - 1;
            const newIndex = prev <= 0 ? currentCart.length - 1 : prev - 1;
            return newIndex;
          });
        }
      } else if (e.key === 'ArrowDown' && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (currentCart.length > 0) {
          setSelectedItemIndex(prev => {
            // If nothing is selected yet, start from the first item
            if (prev < 0) return 0;
            const newIndex = prev >= currentCart.length - 1 ? 0 : prev + 1;
            return newIndex;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tabs, activeTabId, selectedItemIndex, notification, showPaymentModal, showReceiptPreview, confirmDialog]);

  // Keyboard navigation for payment modal
  useEffect(() => {
    if (!showPaymentModal) return;

    const handlePaymentKeyPress = (e) => {
      const currentIndex = paymentMethods.indexOf(selectedPaymentMethod);
      const gridColumns = 3; // 3 columns in the grid

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

  const handleBarcodeSubmit = (code = barcode) => {
    if (!code) return;

    const codeStr = String(code).trim();

    const product = products.find(p => String(p.barcode || '').trim() === codeStr);
    if (product) {
      addToCart(product);
      playBeepSound(); // Play success beep sound
      setBarcode('');
    } else {
      // If product not found, open manual montant dialog prefilled when numeric
      const isNumeric = /^\d+(?:\.\d+)?$/.test(codeStr);
      openManualItemModal({ price: isNumeric ? codeStr : '', name: !isNumeric ? codeStr : '' });
      setBarcode('');
    }
  };

  const addToCart = (product) => {
    // If product has no price, open manual montant dialog to enter price for this instance
    if (!product.price || Number(product.price) === 0) {
      openManualItemModal({ name: product.name || '', _linkedProductId: product.id });
      return;
    }

    setTabs(tabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      
      const existingItem = tab.cart.find(item => item.id === product.id);
      
      if (existingItem) {
        return {
          ...tab,
          cart: tab.cart.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        };
      } else {
        return {
          ...tab,
          cart: [...tab.cart, {
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            quantity: 1,
            quantityType: product.quantityType || 'unit'
          }]
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
          ? { ...tab, cart: tab.cart.map(item =>
              item.id === itemId ? { ...item, quantity: newQuantity } : item
            )}
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
    setTabs(tabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, cart: [] }
        : tab
    ));
    setBarcode('');
  };

  const addNewTab = () => {
    const newTab = {
      id: nextTabId,
      cart: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(nextTabId);
    setNextTabId(nextTabId + 1);
  };

  const closeTab = (tabId) => {
    if (tabs.length === 1) {
      showNotification('Cannot close the last tab!', 'warning');
      return;
    }
    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose.cart.length > 0) {
      setConfirmDialog({
        message: 'This checkout has items. Are you sure you want to close it?',
        onConfirm: async () => {
          const newTabs = tabs.filter(t => t.id !== tabId);
          setTabs(newTabs);
          if (activeTabId === tabId) {
            setActiveTabId(newTabs[0].id);
          }
          setConfirmDialog(null);
        },
        onCancel: () => setConfirmDialog(null)
      });
      return;
    }
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const switchTab = (tabId) => {
    setActiveTabId(tabId);
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const showReceiptPreviewModal = () => {
    // If receipt data already exists (after payment), show it
    if (receiptData) {
      setShowReceiptPreview(true);
      return;
    }
    
    // Otherwise, check if cart has items to create new receipt
    if (cart.length === 0) {
      showNotification(t('checkout.cartEmpty') || 'Cart is empty!', 'warning');
      return;
    }
    
    // Prepare receipt data for preview
    const receipt = {
      invoiceNumber: `INV-${Date.now()}`,
      items: cart.map(item => ({...item, quantityType: item.quantityType || 'unit'})),
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: selectedPaymentMethod,
      date: new Date().toLocaleString()
    };
    
    setReceiptData(receipt);
    setShowReceiptPreview(true);
  };

  const handlePrint = () => {
    if (ipcRenderer && receiptData) {
      ipcRenderer.send('print-receipt', {
        items: receiptData.items,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax,
        total: receiptData.total,
        date: receiptData.date
      });
      showNotification(t('checkout.receiptPrinted') || 'Receipt printed!', 'success');
    }
    setShowReceiptPreview(false);
    setReceiptData(null); // Clear receipt data after printing
    refocusBarcodeInput();
  };

  const openCashDrawer = () => {
    if (ipcRenderer) {
      ipcRenderer.send('open-cash-drawer');
    }
    showNotification(t('checkout.cashDrawerOpened'), 'success');
    refocusBarcodeInput();
  };

  // Update paid amount when payment modal opens or total changes
  useEffect(() => {
    if (showPaymentModal) {
      const validTotal = total || 0;
      setPaidAmount(validTotal);
      setDebtAmount(0);
    }
  }, [showPaymentModal, total]);

  const handlePayment = () => {
    if (cart.length === 0) {
      showNotification('Cart is empty!', 'warning');
      refocusBarcodeInput();
      return;
    }
    
    if (locations.length > 0 && !selectedLocationId) {
      showNotification('Please select a sale location', 'error');
      return;
    }
    
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    setShowPaymentModal(false);

    // --- Payment hardware integration ---
    if (selectedPaymentMethod === 'cash') {
      // Open cash drawer
      if (window.ipcRenderer) {
        window.ipcRenderer.send('open-cash-drawer');
      }
    } else if (["visa", "mastercard", "amex", "debit"].includes(selectedPaymentMethod)) {
      // Card payment: send amount to card terminal
      showNotification(t('checkout.processingPayment') || 'Processing card payment...', 'info');
      
      try {
        // Convert total to cents (e.g., 15.50 € => 1550 cents)
        const amountInCents = Math.round(total * 100);
        const currency = settings.currency || 'EUR';
        const transactionId = `TXN-${Date.now()}`;
        
        console.log(`[TPE] Requesting payment: ${amountInCents/100} ${currency}`);
        
        // Send payment request to TPE terminal
        const tpeResult = await tpeIntegration.requestPayment(
          amountInCents,
          currency,
          transactionId
        );
        
        console.log('[TPE] Result:', tpeResult);
        
        if (!tpeResult.success) {
          // Payment declined or failed
          showNotification(
            t('checkout.paymentDeclined') || `Payment declined: ${tpeResult.message || tpeResult.error}`,
            'error'
          );
          setShowPaymentModal(true); // Reopen modal to retry
          return; // Don't create invoice if payment failed
        }
        
        // Payment approved
        showNotification(
          t('checkout.paymentApproved') || 'Card payment approved!',
          'success'
        );
        
      } catch (error) {
        console.error('[TPE] Payment error:', error);
        showNotification(
          t('checkout.paymentError') || `Payment error: ${error.message}`,
          'error'
        );
        setShowPaymentModal(true); // Reopen modal to retry
        return; // Don't create invoice if error occurred
      }
      
    } else if (selectedPaymentMethod === 'mobile' || selectedPaymentMethod === 'other') {
      // Mobile/Other: show QR code or handle NFC (stub)
      console.log(`Handle mobile/other payment for amount ${total}`);
    }

    // Prepare invoice data
    const invoiceNumber = `INV-${Date.now()}`;
    const invoiceData = {
      invoiceNumber,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: selectedPaymentMethod,
      debt: debtAmount,
      paid: paidAmount,
      locationId: selectedLocationId, // Track which location this sale is from
      items: cart.map(item => ({
        // Use real product id when available (e.g., linked manual items define productId). For pure manual items set productId to null.
        productId: item.productId || (typeof item.id === 'string' && item.id.startsWith('manual-') ? null : item.id),
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        quantityType: item.quantityType || 'unit'
      })),
      type: 'ticket',
      source: 'checkout'
    };
    
    // Validate and deduct from selected location for items linked to real products only
    if (ipcRenderer && selectedLocationId) {
      try {
        for (const item of cart) {
          // Determine the actual product id (if this was a linked manual item use item.productId)
          const productId = item.productId || (typeof item.id === 'string' && item.id.startsWith('manual-') ? null : item.id);

          // Skip inventory update for pure manual items without a product id
          if (!productId) continue;

          // Check if sufficient quantity exists at this location
          const locationQty = await ipcRenderer.invoke('get-product-location-quantity', productId, selectedLocationId);
          if (locationQty < item.quantity) {
            showNotification(`Insufficient quantity for ${item.name} at this location. Available: ${locationQty}, Required: ${item.quantity}`, 'error');
            setShowPaymentModal(true);
            return;
          }
          
          // Deduct from location inventory
          const newQty = locationQty - item.quantity;
          await ipcRenderer.invoke('set-product-location-quantity', productId, selectedLocationId, newQty, null);
        }
      } catch (error) {
        console.error('Error updating location inventory:', error);
        showNotification('Error updating inventory: ' + error.message, 'error');
        setShowPaymentModal(true);
        return;
      }
    }
    
    // Save invoice to database
    const result = await createInvoice(invoiceData);
    
    if (result.success) {
      // Check which products are now out of stock
      const outOfStockProducts = [];
      for (const item of cart) {
        const productResult = await getAllProducts();
        if (productResult.success) {
          const product = productResult.data.find(p => p.id === item.id);
          if (product && product.quantity === 0) {
            outOfStockProducts.push(product.name);
          }
        }
      }
      
      // Reload products
      const productsResult = await getAllProducts();
      if (productsResult.success) {
        setProducts(productsResult.data);
      }
    
      // Prepare receipt data for later printing
      const receipt = {
        invoiceNumber,
        items: cart.map(item => ({...item})),
        subtotal,
        discount,
        tax,
        total,
        paymentMethod: selectedPaymentMethod,
        date: new Date().toLocaleString()
      };
      
      setReceiptData(receipt);
      clearCart();
      
      // Auto-open cash drawer for cash payments
      if (selectedPaymentMethod === 'cash') {
        openCashDrawer();
      }
      
      // Show success message
      let message = t('checkout.paymentSuccess') || 'Payment completed! Invoice saved. Product quantities updated.';
      
      // Alert if any products are out of stock
      if (outOfStockProducts.length > 0) {
        message += '\n\n⚠️ ' + (t('checkout.outOfStockAlert') || 'OUT OF STOCK ALERT') + ':\n' + 
                   outOfStockProducts.map(name => `- ${name}`).join('\n') +
                   '\n\n' + (t('checkout.pleaseRestock') || 'Please restock these products!');
      }
      
      showNotification(message, 'success');
    } else {
      showNotification((t('checkout.paymentFailed') || 'Failed to process payment') + ': ' + result.error, 'error');
    }
  };

  return (
    <div className="checkout-page">
      <div className="page-header">
        <h1 className="page-title">{t('checkout.title')}</h1>
      </div>

      {/* Checkout Tabs */}
      <div className="checkout-tabs">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={`checkout-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            <span className="tab-name">{t('checkout.tabName', { num: idx + 1 })}</span>
            <span className="tab-items-count">({tab.cart.length})</span>
            {tabs.length > 1 && (
              <button
                className="tab-close-btn"
                onClick={(e) => {
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
          ➕ {t('checkout.addTab')}
        </button>
      </div>

      <div className="checkout-container">
        {/* Left Side - Cart */}
        <div className="cart-section">
          <div className="barcode-scanner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={barcodeInputRef}
              type="text"
              className="barcode-input"
              placeholder={t('checkout.scanProduct')}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSubmit()}
              autoFocus
            />
            <button className="scan-btn" onClick={() => handleBarcodeSubmit()}>
              📷
            </button>
            <button className="add-montant-btn secondary-btn" onClick={() => openManualItemModal()} title={t('SalesByInvoices.addAmount') || t('checkout.addAmount') || 'Add amount'}>
              ➕
            </button>
          </div> 

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <p>🛒 {t('checkout.cartEmpty')}</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`cart-item ${selectedItemIndex === index ? 'selected' : ''}`}
                  onClick={() => setSelectedItemIndex(index)}
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
                            e.preventDefault();
                            const newQty = parseInt(editingQuantity) || 1;
                            updateQuantity(item.id, newQty);
                            setEditingItemId(null);
                            setEditingQuantity('');
                            setTimeout(() => barcodeInputRef.current?.focus(), 100);
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

        {/* Right Side - Totals & Actions */}
        <div className="summary-section">
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

          <div className="totals-card">
            <div className="total-row">
              <span>{t('checkout.subtotal')}</span>
              <span className="total-value">{formatCurrency(subtotal, settings.currency)}</span>
            </div>
            <div className="total-row discount-row">
              <span>{t('checkout.discount')} ({settings.discountRate}%)</span>
              <span className="total-value discount-editable">
                <NumericInput
                  id="checkout-discount-input"
                  className="discount-input"
                  value={discount.toFixed(2)}
                  onChange={(e) => {
                    let newDiscount = parseFloat(e.target.value) || 0;
                    if (newDiscount > subtotal) newDiscount = subtotal;
                    if (newDiscount < 0) newDiscount = 0;
                    setTabs(tabs.map(tab =>
                      tab.id === activeTabId
                        ? { 
                            ...tab, 
                            discount: newDiscount,
                            total: Math.max(0, tab.subtotal - newDiscount + tab.tax)
                          }
                        : tab
                    ));
                  }}
                  onFocus={e => e.target.select()}
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
              <span>{t('checkout.tax')} ({settings.taxRate}%)</span>
              <span className="total-value">{formatCurrency(tax, settings.currency)}</span>
            </div>
            <div className="total-row grand-total">
              <span>{t('checkout.grandTotal')}</span>
              <span className="total-value">{formatCurrency(total, settings.currency)}</span>
            </div>
          </div>

          <div className="action-buttons">
            <button className="pay-btn primary-btn" onClick={handlePayment}>
              💳 {t('checkout.pay')} <kbd className="kbd-shortcut">F9</kbd>
            </button>
            <button className="print-btn secondary-btn" onClick={showReceiptPreviewModal}>
              🖨️ {t('checkout.print')} <kbd className="kbd-shortcut">F10</kbd>
            </button>
            <button className="drawer-btn secondary-btn" onClick={openCashDrawer}>
              💰 {t('checkout.openDrawer')} <kbd className="kbd-shortcut">F11</kbd>
            </button>
            <button className="clear-btn danger-btn" onClick={clearCart}>
              🗑️ {t('checkout.clear')} <kbd className="kbd-shortcut">F12</kbd>
            </button>
          </div>

          <div className="keyboard-shortcuts-help">
            <p className="help-title">⌨️ {t('checkout.keyboardShortcuts')}</p>
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
        </div>
      </div>

      {/* Payment Method Modal */}
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
                    {t('checkout.paidAmount')}:
                  </label>
                  <input
                    type="number"
                    className="debt-input"
                    style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '2px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                    value={paidAmount || 0}
                    onChange={(e) => {
                      const paid = parseFloat(e.target.value) || 0;
                      setPaidAmount(paid);
                      setDebtAmount(Math.max(0, (total || 0) - paid));
                    }}
                    step="0.01"
                    min="0"
                    max={total || 0}
                  />
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
            <form className="manual-item-form" onSubmit={handleManualItemSubmit}>
              <div className="form-group">
                <label>{t('SalesByInvoices.manualItemName') || 'Item name (optional)'}</label>
                <input value={manualItemData.name} onChange={e => setManualItemData({ ...manualItemData, name: e.target.value })} placeholder={t('SalesByInvoices.manualItemNamePlaceholder') || 'e.g., Service, Tip'} />
              </div>
              <div className="form-group">
                <label>{t('SalesByInvoices.amount') || 'Amount'}</label>
                <NumericInput id="manual-amount-input" value={manualItemData.price} onChange={e => setManualItemData({ ...manualItemData, price: e.target.value })} min="0" step="0.01" required />
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
                  <option value="l">l</option>
                  <option value="box">{t('products.box', 'Box')}</option>
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

      {/* Receipt Preview Modal */}
      {showReceiptPreview && receiptData && (
        <div className="modal-overlay" onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handlePrint();
          } else if (e.key === 'Escape') {
            e.preventDefault();
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
                          <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '150px' }}>{item.name}</td>
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
                </div>

                {/* Payment Method */}
                <div className="receipt-payment">
                  <p>{t('checkout.paymentMethod') || 'Payment Method'}: <strong>{receiptData.paymentMethod.toUpperCase()}</strong></p>
                  {/* Barcode after payment method */}
                  {receiptData && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <img src={generateBarcodeDataUrl(receiptData.invoiceNumber)} alt="Barcode" style={{ maxWidth: 160 }} />
                    </div>
                  )}
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
              <button className="confirm-btn" onClick={handlePrint}>
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
            refocusBarcodeInput();
          }}
        />
      )}
      
      {confirmDialog && (
        <ConfirmDialog 
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
    </div>
  );
};

export default Checkout;
