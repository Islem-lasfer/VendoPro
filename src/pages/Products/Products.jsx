


import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllProducts, createProduct, updateProduct, deleteProduct } from '../../utils/database';
import Notification from '../../components/Notification/Notification';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';
import NumericInput from '../../components/NumericInput/NumericInput';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import './Products.css';

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);


const Products = () => {
  // Fix: Ensure openAddModal is defined INSIDE the component so it can access state
  const openAddModal = () => {
    setEditingProduct(null);
    // Initialize locationQuantities with all locations set to 0
    const initLocationQty = {};
    locations.forEach(loc => {
      initLocationQty[loc.id] = { quantity: 0, localization: '' };
    });
    setFormData({ 
      barcode: '', 
      name: '', 
      category: 'miscellaneous',
      price: '', 
      detailPrice: '', 
      wholesalePrice: '', 
      expirationDate: '', 
      quantity: '', 
      quantityType: 'unit', 
      image: '', 
      serialNumber: '',
      locationQuantities: initLocationQty
    });
    setShowModal(true);
  };

  // State declarations for modals, printing, notifications, and forms
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printProduct, setPrintProduct] = useState(null);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    category: 'miscellaneous',
    price: '',
    detailPrice: '',
    wholesalePrice: '',
    expirationDate: '',
    quantity: '',
    quantityType: 'unit',
    image: '',
    serialNumber: '', // Optional Serial Number
    reference: '',     // Optional product reference / SKU
    locationQuantities: {} // { locationId: { quantity, localization } }
  });

  const { t } = useTranslation();
  const { settings } = useSettings();
  const categories = settings.categories || [];

  // Display label for stored category keys (keep stored key invariant 'miscellaneous')
  const displayCategory = (cat) => {
    if (!cat) return '';
    if (String(cat).toLowerCase() === 'miscellaneous') return t('settings.products_category_miscellaneous', 'Miscellaneous');
    return cat;
  };

  // Quick "Montant" add (create product with only a price/name when barcode/price missing)
  const [showManualProductModal, setShowManualProductModal] = useState(false);
  const [manualProductData, setManualProductData] = useState({ name: '', price: '', quantity: '1', quantityType: 'unit' });

  const openManualProductModal = (prefill = {}) => {
    setManualProductData({ name: '', price: '', quantity: '1', quantityType: 'unit', ...prefill });
    setShowManualProductModal(true);
  };

  const closeManualProductModal = () => {
    setShowManualProductModal(false);
    setManualProductData({ name: '', price: '', quantity: '1', quantityType: 'unit' });
  };

  const handleManualProductSubmit = async (e) => {
    e && e.preventDefault();
    const price = parseFloat(manualProductData.price);
    const quantity = parseInt(manualProductData.quantity) || 0;
    if (isNaN(price) || price <= 0) {
      setNotification({ message: t('Please enter a valid price'), type: 'error' });
      return;
    }

    const productData = {
      barcode: null,
      name: manualProductData.name ? manualProductData.name.trim() : (t('products.montant') || 'Montant'),
      category: null,
      price: price,
      detailPrice: price,
      wholesalePrice: null,
      expirationDate: null,
      quantity: quantity,
      quantityType: manualProductData.quantityType || 'unit',
      purchasePrice: null,
      image: null,
      serialNumber: null,
      incomplete: 0
    };

    try {
      const result = await createProduct(productData);
      if (result && result.success) {
        showNotification(t('products.productCreated', 'Product created'), 'success');
        loadProducts();
        closeManualProductModal();
      } else {
        showNotification(t('products.createFailed', 'Failed to create product'), 'error');
      }
    } catch (err) {
      console.error('Manual product create error', err);
      showNotification(t('products.createFailed', 'Failed to create product'), 'error');
    }
  };

  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    productId: null,
    productName: '',
    fromLocationId: '',
    toLocationId: '',
    quantity: '',
    reason: ''
  });



  // Load locations from database
  const loadLocations = async () => {
    if (!ipcRenderer) return;
    try {
      const locs = await ipcRenderer.invoke('get-all-locations');
      // Remove duplicates based on id
      const uniqueLocs = locs.filter((loc, index, self) => 
        index === self.findIndex((l) => l.id === loc.id)
      );
      setLocations(uniqueLocs);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Notification logic for expired, out of stock, and low stock (total and per location)
  const today = new Date();
  const lowStockThreshold = 10;

  // Helper to compute a product's total quantity (summing per-location quantities if present)
  const getTotalQty = (p) => {
    try {
      if (p && p.locationQuantities && typeof p.locationQuantities === 'object' && Object.keys(p.locationQuantities).length > 0) {
        return Object.values(p.locationQuantities).reduce((s, obj) => s + (parseFloat(obj.quantity) || 0), 0);
      }
      return parseFloat(p.quantity || p.stock) || 0;
    } catch (e) {
      return parseFloat(p.quantity || p.stock) || 0;
    }
  };

  // Expired products
  const expiredProducts = products.filter(p => p.expirationDate && new Date(p.expirationDate) < today);

  // Out of stock and low stock (total quantity)
  const outOfStockProducts = products.filter(p => {
    if (p.locationQuantities && Object.keys(p.locationQuantities).length > 0) {
      // locationQuantities: { [locId]: { quantity, localization } }
      const total = Object.values(p.locationQuantities).reduce((sum, obj) => sum + (parseFloat(obj.quantity) || 0), 0);
      return total === 0;
    }
    return (parseFloat(p.quantity) || 0) === 0;
  });

  const lowStockProducts = products.filter(p => {
    if (p.locationQuantities && Object.keys(p.locationQuantities).length > 0) {
      const total = Object.values(p.locationQuantities).reduce((sum, obj) => sum + (parseFloat(obj.quantity) || 0), 0);
      return total > 0 && total <= lowStockThreshold;
    }
    const qty = parseFloat(p.quantity) || 0;
    return qty > 0 && qty <= lowStockThreshold;
  });

  // Per-location out of stock and low stock notifications
  const perLocationStockNotifications = [];
  products.forEach(p => {
    if (p.locationQuantities && locations && locations.length > 0) {
      locations.forEach(loc => {
        const locObj = p.locationQuantities[loc.id];
        const locQty = locObj ? parseFloat(locObj.quantity) || 0 : 0;
        if (locQty === 0) {
          perLocationStockNotifications.push({ product: p, location: loc, type: 'out', quantity: locQty });
        } else if (locQty > 0 && locQty <= lowStockThreshold) {
          perLocationStockNotifications.push({ product: p, location: loc, type: 'low', quantity: locQty });
        }
      });
    }
  });

  const notificationCount = expiredProducts.length + outOfStockProducts.length + lowStockProducts.length + perLocationStockNotifications.length;
    // --- Notification Dropdown UI (for debugging, place in your render/return) ---
    // <div className="notification-dropdown">
    //   {expiredProducts.map(p => (
    //     <div key={p.id} className="notif-item notif-expired">
    //       <span>Expired: {p.name}</span>
    //     </div>
    //   ))}
    //   {outOfStockProducts.map(p => (
    //     <div key={p.id + '-out'} className="notif-item notif-out">
    //       <span>Out of Stock: {p.name}</span>
    //     </div>
    //   ))}
    //   {lowStockProducts.map(p => (
    //     <div key={p.id + '-low'} className="notif-item notif-low">
    //       <span>Low Stock: {p.name}</span>
    //     </div>
    //   ))}
    //   {perLocationStockNotifications.map((notif, idx) => (
    //     <div key={notif.product.id + '-' + notif.location.id + '-' + notif.type} className={`notif-item notif-${notif.type}`}>
    //       <span>{notif.type === 'out' ? 'Out of Stock' : 'Low Stock'}: {notif.product.name} ({notif.location.name})</span>
    //     </div>
    //   ))}
    // </div>
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [showQuickUpdateModal, setShowQuickUpdateModal] = useState(false);
  const [quickUpdateData, setQuickUpdateData] = useState({ barcode: '', quantity: '', locationId: '' });
  const quickBarcodeInputRef = useRef(null);
  const productNameInputRef = useRef(null); // focus target when scanner sends Enter
  // Refs for notification dropdown and bell button to detect outside clicks
  const notifRef = useRef(null);
  const notifBtnRef = useRef(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!showNotifDropdown) return;
      const target = e.target;
      if (notifRef.current && !notifRef.current.contains(target) && notifBtnRef.current && !notifBtnRef.current.contains(target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifDropdown]);

  const [showStats, setShowStats] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [expandedProductLocations, setExpandedProductLocations] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30); // default page size (user chose 30)


  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  // Force re-render charts when theme changes
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [settings.theme]);

  // Load products from database
  const loadProducts = async () => {
    setLoading(true);
    const result = await getAllProducts();
    if (result.success) {
      const productsWithLocations = await Promise.all(
      result.data.map(async (product) => {
        try {
          // If server returned per-location quantities, use them
          if (product.locationQuantities && Object.keys(product.locationQuantities).length > 0) {
            const totalQty = Object.values(product.locationQuantities).reduce((s, obj) => s + (parseFloat(obj.quantity) || 0), 0);
            const locationData = {};
            Object.entries(product.locationQuantities).forEach(([locId, obj]) => {
              locationData[`loc_${locId}_qty`] = obj.quantity;
              locationData[`loc_${locId}_pos`] = obj.localization || '';
            });
            return { ...product, totalQuantity: totalQty, ...locationData };
          } else if (ipcRenderer) {
            // Fallback: query local DB for per-location quantities
            const locationQtys = await ipcRenderer.invoke('get-product-locations', product.id);
            const totalQty = locationQtys.reduce((sum, loc) => sum + (parseFloat(loc.quantity) || 0), 0);
            const locationQuantities = {};
            const locationData = {};
            locationQtys.forEach(loc => {
              locationQuantities[loc.locationId] = {
                quantity: loc.quantity,
                localization: loc.localization
              };
              locationData[`loc_${loc.locationId}_qty`] = loc.quantity;
              locationData[`loc_${loc.locationId}_pos`] = loc.localization;
            });
            return { ...product, totalQuantity: totalQty, locationQuantities, ...locationData };
          } else {
            return { ...product, locationQuantities: {} };
          }
        } catch (error) {
          console.error('Error loading locations for product', product.id, error);
          return product;
        }
      })
    );
    setProducts(productsWithLocations);
  } else {
    console.error('Failed to load products:', result.error);
  }
  setLoading(false);
  };

  useEffect(() => {
    loadProducts();
    
    // Auto-refresh every 5 seconds to catch updates
    const interval = setInterval(() => {
      loadProducts();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Count incomplete products
  const incompleteProducts = products.filter(p => p.incomplete === 1);

  // Filter products based on search and incomplete flag
  let filteredProducts = products;
  
  // First filter by incomplete if toggled
  if (showIncompleteOnly) {
    filteredProducts = filteredProducts.filter(p => p.incomplete === 1);
  }
  
  // Then apply search filter
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filteredProducts = filteredProducts.filter(product =>
      (product.name && product.name.toLowerCase().includes(q)) ||
      (product.barcode && String(product.barcode).includes(searchTerm)) ||
      (product.category && product.category.toLowerCase().includes(q)) ||
      (product.reference && product.reference.toLowerCase().includes(q))
    );
  }

  // Reset page when search or filter toggles (do NOT call setState during render)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showIncompleteOnly]);

  // Pagination: compute pages and slice the filtered list for display
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);


  // Conversion factors for supported units
  const unitConversion = {
    // mass
    kg: { g: 1000, mg: 1e6, tonne: 0.001 },
    g: { kg: 0.001, mg: 1000, tonne: 0.000001 },
    mg: { g: 0.001, kg: 0.000001, tonne: 1e-9 },
    tonne: { kg: 1000, g: 1e6, mg: 1e9 },
    // length
    m: { cm: 100, mm: 1000 },
    cm: { m: 0.01, mm: 10 },
    mm: { m: 0.001, cm: 0.1 },
    // volume
    l: { ml: 1000 },
    ml: { l: 0.001 },
    // generic (no conversion for unit, box, pack)
  };

  // Custom handler for quantityType change with conversion
  const handleQuantityTypeChange = (newType) => {
    const prevType = formData.quantityType || 'unit';
    const qty = parseFloat(formData.quantity);
    let newQty = formData.quantity;
    if (
      prevType !== newType &&
      qty > 0 &&
      unitConversion[prevType] &&
      unitConversion[prevType][newType]
    ) {
      newQty = qty * unitConversion[prevType][newType];
    }
    setFormData({ ...formData, quantityType: String(newType), quantity: newQty });
  };

  const openEditModal = async (product) => {
    setEditingProduct(product);
    
    // Load location quantities for this product (prefer server-provided data)
    let locationQty = {};
    if (product.locationQuantities && Object.keys(product.locationQuantities).length > 0) {
      Object.entries(product.locationQuantities).forEach(([locId, obj]) => {
        locationQty[locId] = { quantity: obj.quantity || 0, localization: obj.localization || '' };
      });
    } else if (ipcRenderer && product.id) {
      try {
        const prodLocations = await ipcRenderer.invoke('get-product-locations', product.id);
        prodLocations.forEach(pl => {
          locationQty[pl.locationId] = {
            quantity: pl.quantity || 0,
            localization: pl.localization || ''
          };
        });
      } catch (error) {
        console.error('Error loading product locations:', error);
      }
    }
    
    // Initialize missing locations with 0
    locations.forEach(loc => {
      if (!locationQty[loc.id]) {
        locationQty[loc.id] = { quantity: 0, localization: '' };
      }
    });
    
    setFormData({
      barcode: product.barcode || '',
      name: product.name || '',
      category: product.category || 'miscellaneous',
      price: product.price || '',
      detailPrice: product.detailPrice || '',
      wholesalePrice: product.wholesalePrice || '',
      expirationDate: product.expirationDate || '',
      quantity: product.quantity || '',
      quantityType: product.quantityType ? String(product.quantityType) : 'unit',
      image: product.image || '',
      serialNumber: product.serialNumber || '',
      reference: product.reference || '',
      locationQuantities: locationQty
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    const initLocationQty = {};
    locations.forEach(loc => {
      initLocationQty[loc.id] = { quantity: 0, localization: '' };
    });
    setFormData({ 
      barcode: '', 
      name: '', 
      category: 'miscellaneous', 
      price: '', 
      detailPrice: '', 
      wholesalePrice: '', 
      expirationDate: '', 
      quantity: '', 
      quantityType: 'unit', 
      image: '', 
      serialNumber: '',
      locationQuantities: initLocationQty
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const productData = {
      barcode: formData.barcode || null,
      name: formData.name,
      category: formData.category || null,
      price: parseFloat(formData.price) || 0,
      detailPrice: formData.detailPrice ? parseFloat(formData.detailPrice) : null,
      wholesalePrice: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : null,
      expirationDate: formData.expirationDate || null,
      quantity: parseInt(formData.quantity) || 0,
      quantityType: formData.quantityType ? String(formData.quantityType) : 'unit',
      purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
      image: formData.image || null,
      serialNumber: formData.serialNumber || null,
      reference: formData.reference || null,
      incomplete: 0,
      locationQuantities: formData.locationQuantities || {} 
};

    if (editingProduct) {
      const result = await updateProduct(editingProduct.id, productData);
      if (result.success) {
        // Update location quantities
        if (ipcRenderer && formData.locationQuantities) {
          for (const [locationId, data] of Object.entries(formData.locationQuantities)) {
            try {
              await ipcRenderer.invoke(
                'set-product-location-quantity',
                editingProduct.id,
                parseInt(locationId),
                parseFloat(data.quantity) || 0,
                data.localization || null
              );
            } catch (error) {
              console.error('Error updating location quantity:', error);
            }
          }
        }
        await loadProducts();
        closeModal();
        showNotification('Product updated successfully', 'success');
      } else {
        showNotification('Failed to update product: ' + result.error, 'error');
      }
    } else {
      const result = await createProduct(productData);
      if (result.success) {
        // Create location quantities for new product
        if (ipcRenderer && formData.locationQuantities && result.data && result.data.id) {
          for (const [locationId, data] of Object.entries(formData.locationQuantities)) {
            try {
              await ipcRenderer.invoke(
                'set-product-location-quantity',
                result.data.id,
                parseInt(locationId),
                parseFloat(data.quantity) || 0,
                data.localization || null
              );
            } catch (error) {
              console.error('Error setting location quantity:', error);
            }
          }
        }
        await loadProducts();
        closeModal();
        showNotification(t('products.productCreatedSuccess'), 'success');
      } else {
        showNotification('Failed to create product: ' + result.error, 'error');
      }
    }
  };

  const handleDeleteProduct = async (id) => {
    setConfirmDialog({
      message: t('products.confirmDelete'),
      onConfirm: async () => {
        // Optimistic UI: remove immediately for snappy feedback
        setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
        try {
          const result = await deleteProduct(id);
          if (result && result.success) {
            // ensure freshest state from DB
            await loadProducts();
            setConfirmDialog(null);
            showNotification(t('products.productDeletedSuccess'), 'success');
          } else {
            console.warn('Delete failed, reloading products', result && result.error);
            await loadProducts();
            setConfirmDialog(null);

            showNotification('Failed to delete product: ' + (result && result.error ? result.error : 'Unknown error'), 'error');
          }
        } catch (error) {
          console.error('Error during product delete:', error);
          await loadProducts();
          setConfirmDialog(null);

          const msg = error && error.message ? error.message.toString() : '';
          showNotification('Error deleting product: ' + msg, 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateBarcode = () => {
    const randomBarcode = Math.floor(Math.random() * 9000000000) + 1000000000;
    setFormData({ ...formData, barcode: randomBarcode.toString() });
  };

  const printBarcode = (product) => {
    setPrintProduct(product);
    setPrintQuantity(1);
    setShowPrintModal(true);
  };

  // Transfer functionality
  const openTransferModal = (product) => {
    setTransferData({
      productId: product.id,
      productName: product.name,
      fromLocationId: '',
      toLocationId: '',
      quantity: '',
      reason: ''
    });
    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setTransferData({
      productId: null,
      fromLocationId: '',
      toLocationId: '',
      quantity: '',
      reason: ''
    });
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    
    if (!transferData.fromLocationId || !transferData.toLocationId || !transferData.quantity) {
      showNotification('Please fill all required fields', 'error');
      return;
    }

    if (transferData.fromLocationId === transferData.toLocationId) {
      showNotification('Source and destination must be different', 'error');
      return;
    }

    if (!ipcRenderer) {
      showNotification('Electron IPC not available', 'error');
      return;
    }

    try {
      // Pre-check source quantity to give immediate feedback and avoid server error
      const qtyRequested = parseFloat(transferData.quantity);
      if (!isFinite(qtyRequested) || qtyRequested <= 0) {
        showNotification('Invalid quantity', 'error');
        return;
      }

      // Only check when a fromLocationId is provided
      if (transferData.fromLocationId) {
        const available = await ipcRenderer.invoke('get-product-location-quantity', transferData.productId, parseInt(transferData.fromLocationId));
        if ((available || 0) < qtyRequested) {
          showNotification(`Insufficient quantity in source location (available: ${available})`, 'error');
          return;
        }
      }

      await ipcRenderer.invoke('create-location-transfer', {
        productId: transferData.productId,
        fromLocationId: parseInt(transferData.fromLocationId),
        toLocationId: parseInt(transferData.toLocationId),
        quantity: qtyRequested,
        reason: transferData.reason || null
      });
      
      showNotification('Transfer completed successfully', 'success');
      closeTransferModal();
      await loadProducts();
    } catch (error) {
      // Surface the DB error message (already thrown by queries.createLocationTransfer)
      showNotification('Transfer failed: ' + (error && error.message ? error.message : String(error)), 'error');
    }
  };

  // Load blocking transfers for a product (used when deletion is blocked)


  // Quick Update Quantity
  const handleQuickUpdate = async (e) => {
    e.preventDefault();
    if (!quickUpdateData.barcode || !quickUpdateData.quantity || !quickUpdateData.locationId) {
      showNotification(t('products.fillAllFields') || 'Please fill all fields!', 'error');
      return;
    }

    // Find product by barcode
    const product = products.find(p => p.barcode === quickUpdateData.barcode.trim());
    if (!product) {
      showNotification(t('products.productNotFound') || 'Product not found!', 'error');
      return;
    }

    const quantityToAdd = parseFloat(quickUpdateData.quantity);
    if (isNaN(quantityToAdd) || quantityToAdd === 0) {
      showNotification(t('products.invalidQuantity') || 'Invalid quantity!', 'error');
      return;
    }

    if (!ipcRenderer) {
      showNotification('Electron IPC not available', 'error');
      return;
    }

    try {
      // Determine current quantity (prefer product.locationQuantities if available)
      let currentQty = 0;
      if (product.locationQuantities && product.locationQuantities[quickUpdateData.locationId]) {
        currentQty = parseFloat(product.locationQuantities[quickUpdateData.locationId].quantity) || 0;
      } else if (ipcRenderer) {
        const prodLocations = await ipcRenderer.invoke('get-product-locations', product.id);
        const loc = prodLocations.find(l => String(l.locationId) === String(quickUpdateData.locationId));
        currentQty = loc ? parseFloat(loc.quantity) || 0 : 0;
      }
      const newQty = currentQty + quantityToAdd;
      await ipcRenderer.invoke(
        'set-product-location-quantity',
        product.id,
        parseInt(quickUpdateData.locationId),
        newQty,
        (product.locationQuantities && product.locationQuantities[quickUpdateData.locationId] && product.locationQuantities[quickUpdateData.locationId].localization) || null
      );
      await loadProducts();
      showNotification(
        `✅ ${product.name} (${t('products.location')}: ${locations.find(l => String(l.id) === String(quickUpdateData.locationId))?.name || ''}): ${currentQty} → ${newQty} (${quantityToAdd > 0 ? '+' : ''}${quantityToAdd})`,
        'success'
      );
      setQuickUpdateData({ barcode: '', quantity: '', locationId: '' });
      if (quickBarcodeInputRef.current) {
        quickBarcodeInputRef.current.focus();
      }
    } catch (error) {
      showNotification(t('products.updateFailed') || 'Failed to update quantity: ' + error.message, 'error');
    }
  };

  const openQuickUpdateModal = () => {
    setQuickUpdateData({ barcode: '', quantity: '', locationId: '' });
    setShowQuickUpdateModal(true);
    // Focus on barcode input after modal opens
    setTimeout(() => {
      if (quickBarcodeInputRef.current) {
        quickBarcodeInputRef.current.focus();
      }
    }, 100);
  };

  const closeQuickUpdateModal = () => {
    setShowQuickUpdateModal(false);
    setQuickUpdateData({ barcode: '', quantity: '', locationId: '' });
  };

  // Export all products to Excel
  const exportProductsToExcel = () => {
    if (products.length === 0) {
      showNotification(t('products.noProductsToExport') || 'No products to export!', 'error');
      return;
    }

    // Gather all unique location names
    const locationNames = locations.map(loc => loc.name);

    // Prepare data for export, including per-location quantities
    const exportData = products.map(product => {
      const row = {
        'Barcode': product.barcode || '',
        'Product Name': product.name,
        'Category': product.category || '',
        'Detail Price': product.detailPrice || product.price || 0,
        'Wholesale Price': product.wholesalePrice || '',
        'Purchase Price': product.purchasePrice || '',
        'Quantity': product.quantity || 0,
        'Quantity Type': product.quantityType || 'unit',
        'Expiration Date': product.expirationDate || '',
        'Serial Number': product.serialNumber || ''
      };
      // Add per-location quantities
      locationNames.forEach(locName => {
        // Find location object by name
        const locObj = locations.find(l => l.name === locName);
        if (locObj) {
          row[`Location: ${locName}`] = product[`loc_${locObj.id}_qty`] || 0;
        }
      });
      return row;
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths (add extra for locations)
    ws['!cols'] = [
      { wch: 15 }, // Barcode
      { wch: 30 }, // Product Name
      { wch: 20 }, // Category
      { wch: 12 }, // Detail Price
      { wch: 15 }, // Wholesale Price
      { wch: 15 }, // Purchase Price
      { wch: 10 }, // Quantity
      { wch: 15 }, // Quantity Type
      { wch: 15 }, // Expiration Date
      { wch: 20 }, // Serial Number
      ...locationNames.map(() => ({ wch: 18 }))
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Generate filename with current date
    const filename = `Products_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    showNotification(
      (t('products.exportSuccess') || 'Successfully exported {{count}} product(s)!').replace('{{count}}', products.length),
      'success'
    );
  };

  // Import products from Excel
  const importProductsFromExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const isValidType = validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!isValidType) {
      showNotification(t('products.invalidFileType') || 'Please upload a valid Excel file (.xlsx or .xls)', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      showNotification(t('products.fileReadError') || 'Error reading file. Please try again.', 'error');
      event.target.value = '';
    };

    reader.onload = async (e) => {
      try {
        console.log('Reading Excel file...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          showNotification(t('products.noSheets') || 'No sheets found in Excel file!', 'error');
          return;
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log('Parsed rows:', jsonData.length);
        
        if (jsonData.length === 0) {
          showNotification(t('products.emptyFile') || 'Excel file is empty or has no data rows!', 'error');
          return;
        }

        let successCount = 0;
        let failCount = 0;
        let updatedCount = 0;
        const errors = [];
        const seenBarcodes = new Set();
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          try {
            // Extract and validate data
            let barcode = row['Barcode'] || row['barcode'] || null;
            const name = row['Product Name'] || row['product_name'] || row['name'] || row['Name'];
            if (!name || name.trim() === '') {
              console.warn(`Row ${i + 2}: Missing product name, skipping`);
              failCount++;
              errors.push(`Row ${i + 2}: Missing product name`);
              continue;
            }
            // Handle barcode: trim, convert to string, or set to null if empty
            if (barcode) {
              barcode = String(barcode).trim();
              if (barcode === '' || barcode === 'null' || barcode === 'undefined') {
                barcode = null;
              }
            }
            // If no barcode, generate one
            if (!barcode) {
              barcode = String(Math.floor(Math.random() * 9000000000) + 1000000000);
              console.log(`Row ${i + 2}: Generated barcode ${barcode} for "${name}"`);
            }
            // Check if product already exists in database
            const existingProduct = products.find(p => p.barcode === barcode);
            const importQuantity = parseInt(row['Quantity'] || row['quantity'] || 0) || 0;

            // Gather per-location quantities from columns like "Location: [LocationName]"
            const locationQtys = {};
            locations.forEach(loc => {
              const colName = `Location: ${loc.name}`;
              if (row.hasOwnProperty(colName)) {
                locationQtys[loc.id] = { quantity: parseFloat(row[colName]) || 0 };
              }
            });

            if (existingProduct) {
              // Update main quantity
              const newQuantity = parseInt(existingProduct.quantity || 0) + importQuantity;
              const result = await updateProduct(existingProduct.id, {
                ...existingProduct,
                quantity: newQuantity
              });
              // Update per-location quantities if present
              if (ipcRenderer && Object.keys(locationQtys).length > 0) {
                for (const [locId, data] of Object.entries(locationQtys)) {
                  try {
                    // Determine current location quantity (prefer server/client-provided data)
                    let currentQty = 0;
                    if (existingProduct.locationQuantities && existingProduct.locationQuantities[locId]) {
                      currentQty = parseFloat(existingProduct.locationQuantities[locId].quantity) || 0;
                    } else if (ipcRenderer) {
                      const prodLocations = await ipcRenderer.invoke('get-product-locations', existingProduct.id);
                      const loc = prodLocations.find(l => String(l.locationId) === String(locId));
                      currentQty = loc ? parseFloat(loc.quantity) || 0 : 0;
                    }
                    const newLocQty = currentQty + (parseFloat(data.quantity) || 0);
                    await ipcRenderer.invoke('set-product-location-quantity', existingProduct.id, parseInt(locId), newLocQty, existingProduct.locationQuantities && existingProduct.locationQuantities[locId] && existingProduct.locationQuantities[locId].localization ? existingProduct.locationQuantities[locId].localization : null);
                  } catch (err) {
                    console.error(`Row ${i + 2} location update failed:`, err);
                  }
                }
              }
              if (result.success) {
                updatedCount++;
              } else {
                console.error(`Row ${i + 2} update failed:`, result.error);
                failCount++;
                errors.push(`Row ${i + 2} (${existingProduct.name}): ${result.error}`);
              }
            } else {
              // Create new product
              const productData = {
                barcode: barcode,
                name: String(name).trim(),
                category: row['Category'] || row['category'] || null,
                price: parseFloat(row['Detail Price'] || row['detail_price'] || row['price'] || row['Price'] || 0),
                detailPrice: parseFloat(row['Detail Price'] || row['detail_price'] || row['price'] || row['Price'] || 0),
                wholesalePrice: (row['Wholesale Price'] || row['wholesale_price']) ? parseFloat(row['Wholesale Price'] || row['wholesale_price']) : null,
                purchasePrice: (row['Purchase Price'] || row['purchase_price']) ? parseFloat(row['Purchase Price'] || row['purchase_price']) : null,
                quantity: importQuantity,
                quantityType: String(row['Quantity Type'] || row['quantity_type'] || 'unit').trim(),
                expirationDate: row['Expiration Date'] || row['expiration_date'] || null,
                serialNumber: row['Serial Number'] || row['serial_number'] || null,
                image: null,
                incomplete: 0
              };
              const result = await createProduct(productData);
              // Set per-location quantities if present
              if (result.success && ipcRenderer && Object.keys(locationQtys).length > 0) {
                for (const [locId, data] of Object.entries(locationQtys)) {
                  try {
                    await ipcRenderer.invoke('set-product-location-quantity', result.data.id, parseInt(locId), parseFloat(data.quantity) || 0, null);
                  } catch (err) {
                    console.error(`Row ${i + 2} location set failed:`, err);
                  }
                }
              }
              if (result.success) {
                successCount++;
              } else {
                console.error(`Row ${i + 2} failed:`, result.error);
                failCount++;
                errors.push(`Row ${i + 2} (${productData.name}): ${result.error}`);
              }
            }
          } catch (rowError) {
            console.error(`Error processing row ${i + 2}:`, rowError);
            failCount++;
            errors.push(`Row ${i + 2}: ${rowError.message}`);
          }
        }

        await loadProducts();
        
        // Show detailed results
        const totalProcessed = successCount + updatedCount;
        if (totalProcessed > 0) {
          let message = '';
          if (successCount > 0) {
            message += `✅ ${successCount} new product(s) created`;
          }
          if (updatedCount > 0) {
            if (successCount > 0) message += ', ';
            message += `🔄 ${updatedCount} product(s) updated`;
          }
          if (failCount > 0) {
            message += ` ⚠️ ${failCount} failed`;
          }
          
          showNotification(message, failCount > 0 ? 'warning' : 'success');
          
          // Log errors to console for debugging
          if (errors.length > 0) {
            console.error('Import errors:', errors);
          }
        } else {
          const errorMsg = errors.length > 0 ? errors.slice(0, 3).join(', ') : 'Unknown error';
          showNotification(
            `❌ Failed to import products. ${errorMsg}`,
            'error'
          );
          console.error('All import errors:', errors);
        }
        
      } catch (error) {
        console.error('Import error:', error);
        showNotification(
          `❌ Error importing Excel file: ${error.message}`,
          'error'
        );
      }
    };

    reader.readAsArrayBuffer(file);
    
    // Reset file input
    event.target.value = '';
  };

  // Handle notification click to show product
  const handleNotificationClick = (product) => {
    // Close notification dropdown
    setShowNotifDropdown(false);
    
    // Scroll to product if visible
    const productElement = document.getElementById(`product-${product.id}`);
    if (productElement) {
      productElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight the product briefly
      productElement.classList.add('highlight-product');
      setTimeout(() => {
        productElement.classList.remove('highlight-product');
      }, 2000);
    }
    
    // Open edit modal for the product
    setTimeout(() => {
      openEditModal(product);
    }, 300);
  };

  const executePrint = () => {
    if (!printProduct || printQuantity < 1) return;

    // Create a hidden canvas to generate barcode
    const canvas = document.createElement('canvas');
    
    try {
      // Generate barcode on canvas - optimized for 30mm x 20mm thermal printer
      JsBarcode(canvas, printProduct.barcode, {
                                format: 'CODE128',
                                width: 2,
                                height: 40,
                                displayValue: false,
                                fontSize: 10,
                                margin: 0,
                                marginTop: 0,
                                marginBottom: 0
                              });

      // Generate multiple barcode copies (shop name above, price below)
      let barcodeHTML = '';
      for (let i = 0; i < printQuantity; i++) {
        barcodeHTML += `
          <div class="barcode-label">
            <div class="shop-name">${settings.posName || 'POS'}</div>
            <div class="barcode-image"><img src="${canvas.toDataURL()}" alt="Barcode"/></div>
            <div class="barcode-top-row">
              <div class="barcode-number">${printProduct.barcode}</div>
              <div class="product-price">${formatCurrency(printProduct.price, settings.currency)}</div>
            </div>
            <div class="barcode-ref-row"><div class="barcode-ref">${printProduct.reference ? String(printProduct.reference) : ''}</div></div>
          </div>
          ${i < printQuantity - 1 ? '<div class="page-break"></div>' : ''}
        `;
      }

      const fullHtml = `
        <html>
          <head>
            <title>Print Barcode - ${printProduct.name}</title>
            <style>
              @page { size: 30mm 20mm; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 0; margin: 0; background: white; }
              .barcode-label { width: 30mm; height: 20mm; padding: 0.3mm; background: white; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; page-break-after: always; overflow: hidden; gap: 0; }
              .shop-name { font-size: 6px; color: #000; text-align: center; margin-bottom: 1px; line-height: 1; font-weight: 600; }
              .barcode-top-row { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 2px; }
              .barcode-number { font-size: 9px; font-weight: 600; text-align: left; }
              .product-price { font-size: 9px; font-weight: 600; text-align: right; }
              .barcode-ref-row { width: 100%; text-align: center; margin-top: 1px; }
              .barcode-ref { font-size: 7px; font-weight: 500; color: #000; }
              .barcode-image { display: flex; justify-content: center; align-items: center; width: 100%; margin-top: 2px; }
              .barcode-image img { max-width: 28mm; max-height: 16mm; display: block; object-fit: contain; }
              img { max-width: 29mm; max-height: 16mm; display: block; object-fit: contain; }
              .page-break { page-break-after: always; height: 0; }
              @media print { body { padding: 0; margin: 0; } .barcode-label { border: none; page-break-after: always; } .page-break { display: none; } }
            </style>
          </head>
          <body>
            ${barcodeHTML}
          </body>
        </html>
      `;

      // If running inside Electron, send print job to main process (targets any installed printer)
      if (ipcRenderer) {
        ipcRenderer.once('print-result', (ev, result) => {
          if (result && result.success) showNotification('Barcode printed', 'success');
          else showNotification((result && result.error) || 'Print failed', 'error');
        });

        ipcRenderer.send('print-receipt', {
          html: fullHtml,
          // Prefer dedicated barcodePrinter, fall back to receiptPrinter or system default
          printerName: settings.barcodePrinter || settings.receiptPrinter || undefined,
          showDialog: !!settings.printDialogOnPrint,
          // Request multiple copies when user selected more than one barcode
          copies: Math.max(1, printQuantity),
          isLabel: true
        });

        setShowPrintModal(false);
        return;
      }

      // Fallback for web: open print window where the user chooses printer
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 200);
      setShowPrintModal(false);








    } catch (error) {
      showNotification('Error generating barcode: ' + error.message, 'error');
    }
  };

  // Calculate product statistics (use per-location totals)
  const getProductStats = () => {
    const totalProducts = products.length;

    // Calculate total value (use getTotalQty which sums per-location quantities)
    const totalValue = products.reduce((sum, p) => {
      const price = parseFloat(p.price) || 0;
      const quantity = getTotalQty(p) || 0;
      return sum + (price * quantity);
    }, 0);

    // Low stock items (between 1 and lowStockThreshold)
    const lowStock = products.filter(p => {
      const qty = getTotalQty(p) || 0;
      return qty > 0 && qty <= lowStockThreshold;
    }).length;

    const outOfStock = products.filter(p => {
      const qty = getTotalQty(p) || 0;
      return qty === 0;
    }).length;

    const expiringSoon = products.filter(p => {
      const qty = getTotalQty(p) || 0;
      if (qty <= 0) return false; // only consider items that exist in stock
      if (!p.expirationDate) return false;
      const daysUntilExpiry = Math.ceil((new Date(p.expirationDate) - today) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    }).length;

    // Category distribution
    const categoryCount = {};
    products.forEach(p => {
      if (p.category) {
        categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      }
    });

    // Stock value by category (use per-location totals)
    const categoryValue = {};
    products.forEach(p => {
      if (p.category) {
        const price = parseFloat(p.price) || 0;
        const quantity = getTotalQty(p) || 0;
        const value = price * quantity;
        categoryValue[p.category] = (categoryValue[p.category] || 0) + value;
      }
    });

    // Top products by value (use per-location totals)
    const topProducts = [...products]
      .map(p => {
        const price = parseFloat(p.price) || 0;
        const quantity = getTotalQty(p) || 0;
        return { name: p.name, value: price * quantity };
      })
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      totalProducts,
      totalValue,
      lowStock,
      outOfStock,
      expiringSoon,
      categoryCount,
      categoryValue,
      topProducts
    };
  };

  const stats = getProductStats();

  // Get theme colors
  const getThemeColors = () => {
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue('--text-primary').trim() || '#ffffff',
      grid: style.getPropertyValue('--border-color').trim() || '#1a1a1a',
      background: style.getPropertyValue('--card-bg').trim() || '#0f0f0f'
    };
  };

  const themeColors = getThemeColors();

  // Helper: generate N visually distinct colors (HSL wheel)
  const generateColors = (n, alpha = 0.85) => {
    if (!n || n <= 0) return ['rgba(200,200,200,0.6)'];
    return Array.from({ length: n }, (_, i) => {
      const hue = Math.round((i * 360) / Math.max(1, n));
      return `hsla(${hue}, 70%, 50%, ${alpha})`;
    });
  };

  // Chart data (use dynamic color arrays sized to data length)
  const categoryChartData = {
    labels: Object.keys(stats.categoryCount).map(k => displayCategory(k)),
    datasets: [{
      data: Object.values(stats.categoryCount),
      backgroundColor: generateColors(Object.keys(stats.categoryCount).length),
      borderColor: themeColors.background,
      borderWidth: 2
    }]
  };

  const categoryValueChartData = {
    labels: Object.keys(stats.categoryValue).map(k => displayCategory(k)),
    datasets: [{
      label: t('products.stockValue', 'Stock Value'),
      data: Object.values(stats.categoryValue),
      backgroundColor: generateColors(Object.keys(stats.categoryValue).length),
      borderColor: '#ff6600',
      borderWidth: 2
    }]
  };

  const topProductsChartData = {
    labels: stats.topProducts.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
    datasets: [{
      label: 'Stock Value',
      data: stats.topProducts.map(p => p.value),
      backgroundColor: generateColors(stats.topProducts.length),
      borderColor: '#ff6600',
      borderWidth: 2
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: themeColors.text,
          font: { size: 12 }
        }
      }
    },
    scales: {
      y: {
        ticks: { color: themeColors.text },
        grid: { color: themeColors.grid }
      },
      x: {
        ticks: { color: themeColors.text },
        grid: { color: themeColors.grid }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: themeColors.text,
          font: { size: 12 },
          padding: 15
        }
      }
    }
  };

  // Ensure openAddModal is defined (restore if missing)
  // ...existing code...
  return (
    <div className="products-page">
      <div className="page-header">
        <h1 className="page-title">{t('products.title')}</h1>
        <div className="header-actions">
          <button className="export-btn secondary-btn" onClick={exportProductsToExcel}>
            📤 {t('products.exportExcel')}
          </button>
          <label className="import-btn secondary-btn" style={{ cursor: 'pointer' }}>
            📥 {t('products.importExcel')}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={importProductsFromExcel}
              style={{ display: 'none' }}
            />
          </label>
          <button className="quick-update-btn secondary-btn" onClick={openQuickUpdateModal}>
            ⚡ {t('products.quickUpdate')}
          </button>
          <button className="add-btn primary-btn" onClick={openAddModal}>
            ➕ {t('products.addProduct')}
          </button>
        
          <div className="notif-bell-wrapper">
            <button
              className="notif-bell-btn"
              ref={notifBtnRef}
              onClick={() => setShowNotifDropdown((v) => !v)}
              title="Notifications"
            >
              <span className="notif-bell-icon">🔔</span>
              {notificationCount > 0 && (
                <span className="notif-badge">{notificationCount}</span>
              )}
            </button>
            {showNotifDropdown && (
              <div className="notif-dropdown" ref={notifRef}>
                <div className="notif-dropdown-header">{t('products.notifications', 'Notifications')}</div>
                {notificationCount === 0 && <div className="notif-empty">{t('products.notifNone')}</div>}
                {expiredProducts.length > 0 && (
                  <div className="notif-section">
                    <div className="notif-section-title">{t('products.notifExpired')}</div>
                    {expiredProducts.map((p) => (
                      <div 
                        className="notif-item notif-expired" 
                        key={p.id}
                        onClick={(e) => {
                          if (!e.target.classList.contains('notif-delete-btn')) {
                            handleNotificationClick(p);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        title={t('products.clickToView')}
                      >
                        <span className="notif-dot notif-dot-expired" />
                        {p.name} ({t('products.expirationDate')}: {p.expirationDate ? new Date(p.expirationDate).toLocaleDateString() : 'N/A'})
                        <button className="notif-delete-btn" title={t('products.notifDelete')} onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(p.id);
                        }}>
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {outOfStockProducts.length > 0 && (
                  <div className="notif-section">
                    <div className="notif-section-title">{t('products.notifOutOfStock', 'Out of Stock')}</div>
                    {outOfStockProducts.map((p) => (
                      <div 
                        className="notif-item notif-outofstock" 
                        key={p.id}
                        onClick={(e) => {
                          if (!e.target.classList.contains('notif-delete-btn')) {
                            handleNotificationClick(p);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        title={t('products.clickToView')}
                      >
                        <span className="notif-dot notif-dot-outofstock" />
                        {p.name}
                        <button className="notif-delete-btn" title={t('products.notifDelete')} onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(p.id);
                        }}>
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {lowStockProducts.length > 0 && (
                  <div className="notif-section">
                    <div className="notif-section-title">{t('products.notifLowStock')}</div>
                    {lowStockProducts.map((p) => (
                      <div 
                        className="notif-item notif-lowstock" 
                        key={p.id}
                        onClick={(e) => {
                          if (!e.target.classList.contains('notif-delete-btn')) {
                            handleNotificationClick(p);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        title={t('products.clickToView')}
                      >
                        <span className="notif-dot notif-dot-lowstock" />
                        {p.name} ({t('products.quantity')}: {Math.max(0, getTotalQty(p)).toFixed(0)}{p.expirationDate ? `, ${t('products.expirationDate')}: ${new Date(p.expirationDate).toLocaleDateString()}` : ''})
                        <button className="notif-delete-btn" title={t('products.notifDelete')} onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(p.id);
                        }}>
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {perLocationStockNotifications.length > 0 && (
                  <div className="notif-section">
                    <div className="notif-section-title">{t('products.notifPerLocationStock', 'Per Location Stock')}</div>
                    {perLocationStockNotifications.map((notif, idx) => (
                      <div
                        className={`notif-item notif-${notif.type}`}
                        key={notif.product.id + '-' + notif.location.id + '-' + notif.type}
                        onClick={() => handleNotificationClick(notif.product)}
                        style={{ cursor: 'pointer' }}
                        title={t('products.clickToView')}
                      >
                        <span className={`notif-dot notif-dot-${notif.type}`} />
                        {notif.type === 'out' ? t('products.outOfStock', 'Out of Stock') : t('products.lowStock', 'Low Stock')}: {notif.product.name} ({notif.location.name})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="products-content">
        {/* Statistics Dashboard */}
        {showStats && (
          <div className="products-stats-section">
            <div className="stats-header">
              <h2>📊 {t('products.inventoryAnalytics')}</h2>
              <button className="toggle-stats-btn" onClick={() => setShowStats(!showStats)}>
                {showStats ? `▼ ${t('products.hideStats')}` : `▶ ${t('products.showStats')}`}
              </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-cards-grid">
              <div className="stat-card-mini">
                <div className="stat-icon-mini">📦</div>
                <div className="stat-content-mini">
                  <p className="stat-label-mini">{t('products.totalProducts')}</p>
                  <h3 className="stat-value-mini">{stats.totalProducts}</h3>
                </div>
              </div>
              <div className="stat-card-mini">
                <div className="stat-icon-mini">💎</div>
                <div className="stat-content-mini">
                  <p className="stat-label-mini">{t('products.totalValue')}</p>
                  <h3 className="stat-value-mini">{formatCurrency(stats.totalValue, settings.currency)}</h3>
                </div>
              </div>
              <div className="stat-card-mini">
                <div className="stat-icon-mini">⚠️</div>
                <div className="stat-content-mini">
                  <p className="stat-label-mini">{t('products.lowStock')}</p>
                  <h3 className="stat-value-mini">{stats.lowStock}</h3>
                </div>
              </div>
              <div className="stat-card-mini">
                <div className="stat-icon-mini">🚫</div>
                <div className="stat-content-mini">
                  <p className="stat-label-mini">{t('products.outOfStock')}</p>
                  <h3 className="stat-value-mini">{stats.outOfStock}</h3>
                </div>
              </div>
              <div className="stat-card-mini">
                <div className="stat-icon-mini">⏰</div>
                <div className="stat-content-mini">
                  <p className="stat-label-mini">{t('products.expiringSoon')}</p>
                  <h3 className="stat-value-mini">{stats.expiringSoon}</h3>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="products-charts-grid">
              <div className="chart-card-mini">
                <h3 className="chart-title-mini">{t('products.productsByCategory')}</h3>
                <div className="chart-wrapper-mini">
                  {Object.keys(stats.categoryCount).length > 0 ? (
                    <Pie key={chartKey} data={categoryChartData} options={pieOptions} />
                  ) : (
                    <p style={{ textAlign: 'center', color: themeColors.text }}>{t('products.noDataAvailable')}</p>
                  )}
                </div>
              </div>

              <div className="chart-card-mini">
                <h3 className="chart-title-mini">{t('products.stockValueByCategory')}</h3>
                <div className="chart-wrapper-mini">
                  {Object.keys(stats.categoryValue).length > 0 ? (
                    <Bar key={chartKey} data={categoryValueChartData} options={chartOptions} />
                  ) : (
                    <p style={{ textAlign: 'center', color: themeColors.text }}>{t('products.noDataAvailable')}</p>
                  )}
                </div>
              </div>

              <div className="chart-card-mini large-chart">
                <h3 className="chart-title-mini">{t('products.topProductsByStockValue')}</h3>
                <div className="chart-wrapper-mini">
                  {stats.topProducts.length > 0 ? (
                    <Bar key={chartKey} data={topProductsChartData} options={chartOptions} />
                  ) : (
                    <p style={{ textAlign: 'center', color: themeColors.text }}>{t('products.noDataAvailable')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!showStats && (
          <div className="stats-header">
            <button className="toggle-stats-btn-collapsed" onClick={() => setShowStats(!showStats)}>
              ▶ {t('products.showInventoryAnalytics')}
            </button>
          </div>
        )}

        {/* Incomplete Products Notification */}
        {incompleteProducts.length > 0 && (
          <div className="incomplete-products-notification">
            <div className="notification-icon">⚠️</div>
            <div className="notification-content">
              <strong>{incompleteProducts.length} {t('products.notifIncompleteCount')}</strong>
              <p>{t('products.notifIncompleteMsg')}</p>
            </div>
            <button 
              className="view-incomplete-btn"
              onClick={() => {
                setShowIncompleteOnly(true);
                setSearchTerm('');
              }}
            >
              {t('products.notifViewIncomplete')}
            </button>
            <button 
              className="clear-filter-btn"
              onClick={() => {
                setShowIncompleteOnly(false);
                setSearchTerm('');
              }}
            >
              {t('products.notifShowAll')}
            </button>
          </div>
        )}

        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder={t('products.search')}
            value={searchTerm ?? ''}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="products-grid">
          {paginatedProducts.map((product) => (
            <div key={product.id} id={`product-${product.id}`} className={`product-card ${product.incomplete === 1 ? 'incomplete-product' : ''}`}>
              {product.incomplete === 1 && (
                <div className="incomplete-badge">⚠️ Needs Completion</div>
              )}
              <div className="product-image">
                {product.image ? (
                  <img src={product.image} alt={product.name} />
                ) : (
                  <div className="placeholder-image">📦</div>
                )}
              </div>
              <div className="product-details">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-category">{displayCategory(product.category)}</p>
                <p className="product-barcode">{t('products.barcode')}: {product.barcode}</p>
                <div className="product-info-row">
                  <span className="product-price">{formatCurrency(product.price, settings.currency)}</span>
                  <span className="product-quantity">{t('SalesByInvoices.qty')}: {product.totalQuantity || 0} {product.quantityType || ''}</span>
                </div>
                {locations.length > 0 && (
                  <div className="product-locations">
                    <div 
                      className="locations-header"
                      onClick={() => setExpandedProductLocations(prev => ({
                        ...prev,
                        [product.id]: !prev[product.id]
                      }))}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '4px',
                        marginBottom: expandedProductLocations[product.id] ? '8px' : '0'
                      }}
                    >
                      <small style={{fontWeight: 600, color: 'var(--text-secondary)'}}>
                        📍 {t('products.locationQuantities')}
                      </small>
                      <span style={{fontSize: '12px', color: 'var(--text-secondary)'}}>
                        {expandedProductLocations[product.id] ? '▼' : '▶'}
                      </span>
                    </div>
                    {expandedProductLocations[product.id] && (
                      <div className="locations-list">
                        {locations.map(loc => {
                          const qty = product[`loc_${loc.id}_qty`] || 0;
                          const pos = product[`loc_${loc.id}_pos`] || '';
                          return (
                            <div key={loc.id} className="location-detail">
                              <span className="loc-icon">{loc.type === 'shop' ? '🏪' : '📦'}</span>
                              <span className="loc-name">{loc.name}:</span>
                              <span className="loc-qty">{qty} {product.quantityType || ''}</span>
                              {pos && <span className="loc-pos" title={pos}>📍 {pos}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="product-actions">
                <button className="edit-btn" onClick={() => openEditModal(product)} title={t('products.edit')}>
                  ✏️
                </button>
                <button className="delete-btn" onClick={() => handleDeleteProduct(product.id)} title={t('products.delete')}>
                  🗑️
                </button>
                <button className="print-barcode-btn" onClick={() => printBarcode(product)} title={t('products.printBarcode')}>
                  🖨️
                </button>
                {locations.length > 1 && (
                  <button className="transfer-btn" onClick={() => openTransferModal(product)} title="Transfer">
                    🔄
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination controls (bottom) */}
        <div className="pagination-container">
          <div className="pagination-info">{t('Showing')} {startIndex + 1}-{Math.min(endIndex, totalItems)} / {totalItems}</div>
          <div className="pagination-controls">
            <button className="page-btn" onClick={() => setCurrentPage(1)} disabled={safePage === 1}>⟪</button>
            <button className="page-btn" onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>‹</button>

            {(() => {
              // show up to 7 page buttons with truncation
              const maxButtons = 7;
              const pages = [];
              let start = Math.max(1, safePage - Math.floor(maxButtons / 2));
              let end = start + maxButtons - 1;
              if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxButtons + 1); }
              for (let p = start; p <= end; p++) pages.push(p);
              return (
                <>
                  {start > 1 && <button className="page-btn" onClick={() => setCurrentPage(1)}>1</button>}
                  {start > 2 && <span className="ellipsis">…</span>}
                  {pages.map(p => (
                    <button key={p} className={`page-btn ${p === safePage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                  ))}
                  {end < totalPages - 1 && <span className="ellipsis">…</span>}
                  {end < totalPages && <button className="page-btn" onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>}
                </>
              );
            })()}

            <button className="page-btn" onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>›</button>
            <button className="page-btn" onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}>⟫</button>
          </div>

          <div className="page-size-select">
            <label>{t('Page size')}: </label>
            <select value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Update Quantity Modal */}
      {showQuickUpdateModal && (
        <div className="modal-overlay" onClick={closeQuickUpdateModal}>
          <div className="modal-content quick-update-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ {t('products.quickUpdateTitle')}</h2>
              <button className="close-btn" onClick={closeQuickUpdateModal}>✕</button>
            </div>
            
            <form onSubmit={handleQuickUpdate} className="quick-update-form">

              <div className="form-group">
                <label>{t('products.barcode')}:</label>
                <input
                  ref={quickBarcodeInputRef}
                  type="text"
                  value={quickUpdateData.barcode ?? ''}
                  onChange={(e) => setQuickUpdateData({ ...quickUpdateData, barcode: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('quick-update-quantity-input')?.focus();
                    }
                  }}
                  placeholder={t('products.scanOrEnterBarcode')}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('products.location') || 'Stock Location'}:</label>
                <select
                  value={quickUpdateData.locationId || ''}
                  onChange={e => setQuickUpdateData({ ...quickUpdateData, locationId: e.target.value })}
                  required
                >
                  
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.type === 'shop' ? '🏪' : '📦'} {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('products.quantityToAdd')}:</label>
                <NumericInput
                  id="quick-update-quantity-input"
                  value={quickUpdateData.quantity ?? ''}
                  onChange={(e) => setQuickUpdateData({ ...quickUpdateData, quantity: e.target.value })}
                  placeholder={t('products.enterQuantity')}
                  min="0"
                  step="0.01"
                />
                <small className="form-hint">{t('products.quantityHint')}</small>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeQuickUpdateModal}>
                  {t('products.cancel')}
                </button>
                <button type="submit" className="submit-btn primary-btn">
                  ✅ {t('products.updateQuantity')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingProduct ? t('products.edit') : t('products.addProduct')}</h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>
            <form className="product-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('products.barcode')}</label>
                <div className="barcode-input-group">
                  <input
                    type="text"
                    value={formData.barcode ?? ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Prevent barcode scanner's trailing Enter from submitting the form
                        e.preventDefault();
                        productNameInputRef.current?.focus();
                      }
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="generate-barcode-btn"
                    onClick={generateBarcode}
                  >
                    🔢 {t('products.generate')}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>{t('products.reference')}</label>
                <input
                  type="text"
                  value={formData.reference ?? ''}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder={t('products.referencePlaceholder')}
                />
              </div>

              <div className="form-group">
                <label>{t('products.name')}</label>
                <input
                  ref={productNameInputRef}
                  type="text"
                  value={formData.name ?? ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>{t('products.category')}</label>
                <select
                  value={formData.category ?? ''}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">{t('products.selectCategory', 'Select category')}</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat}>{displayCategory(cat)}</option>
                  ))}
                </select>
                <div className="form-group">
                  <label>{t('products.serialNumber')}</label>
                  <input
                    type="text"
                    value={formData.serialNumber ?? ''}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder={t('products.serialNumberPlaceholder')}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('products.detailPrice')}</label>
                  <NumericInput
                    value={formData.price ?? ''}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>{t('products.wholesalePrice')}</label>
                  <NumericInput
                    value={formData.wholesalePrice ?? ''}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>{t('products.expirationDate')}</label>
                  <input
                    type="date"
                    value={formData.expirationDate ?? ''}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t('products.unitType', 'Unit Type')}</label>
                  <select
                    value={formData.quantityType ?? 'unit'}
                    onChange={e => handleQuantityTypeChange(e.target.value)}
                    onBlur={e => handleQuantityTypeChange(e.target.value)}
                    style={{ width: '100%' }}
                  >
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
              </div>

              {/* Location Quantities Section */}
              {locations.length > 0 && (
                <div className="location-quantities-section">
                  <label className="section-label">📍 {t('products.locationQuantities')}</label>
                  <p className="section-hint">{t('products.locationQuantitiesHint')}</p>
                  
                  <div className="location-quantities-list">
                    {locations.map(location => (
                      <div key={location.id} className="location-quantity-item">
                        <div className="location-header">
                          <span className="location-icon">{location.type === 'shop' ? '🏪' : '📦'}</span>
                          <span className="location-name">{t('products.location')}: {location.name}</span>
                        </div>
                        <div className="location-inputs">
                          <div className="location-input-group">
                            <label>{t('products.quantity')}</label>
                            <input
                              type="number"
                              placeholder="Quantity"
                              min="0"
                              step="0.01"
                              value={formData.locationQuantities[location.id]?.quantity || 0}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  locationQuantities: {
                                    ...formData.locationQuantities,
                                    [location.id]: {
                                      ...formData.locationQuantities[location.id],
                                      quantity: e.target.value
                                    }
                                  }
                                });
                              }}
                            />
                          </div>
                          <div className="location-input-group">
                            <label>{t('products.location')}</label>
                            <input
                              type="text"
                              placeholder={t('products.locationPlaceholder', 'Position (e.g., Aisle 3, Shelf 2)')}
                              value={formData.locationQuantities[location.id]?.localization || ''}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  locationQuantities: {
                                    ...formData.locationQuantities,
                                    [location.id]: {
                                      ...formData.locationQuantities[location.id],
                                      localization: e.target.value
                                    }
                                  }
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="total-quantity-info">
                    {t('SalesByInvoices.qty')}: <strong>{Object.values(formData.locationQuantities).reduce((sum, loc) => sum + (parseFloat(loc.quantity) || 0), 0)}</strong> {formData.quantityType}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>{t('products.image')}</label>
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="product-image-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="product-image-upload" className="image-upload-label">
                    {formData.image ? (
                      <div className="image-preview">
                        <img src={formData.image} alt="Preview" />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => setFormData({ ...formData, image: '' })}
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <div className="image-upload-placeholder">
                        <span role="img" aria-label="Upload">📷</span>
                        <span className="upload-text">{t('products.addOrEditImage')}</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <button type="submit" className="submit-btn primary-btn">
                {t('products.save')}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Quick Montant Product Modal */}
      {showManualProductModal && (
        <div className="modal-overlay" onClick={closeManualProductModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>➕ {t('products.addAmount') || 'Add amount'}</h2>
              <button className="close-btn" onClick={closeManualProductModal}>✕</button>
            </div>
            <form className="manual-product-form" onSubmit={handleManualProductSubmit}>
              <div className="form-group">
                <label>{t('products.name') || 'Name (optional)'}</label>
                <input value={manualProductData.name ?? ''} onChange={e => setManualProductData({ ...manualProductData, name: e.target.value })} placeholder={t('products.namePlaceholder') || 'e.g., Service'} />
              </div>
              <div className="form-group">
                <label>{t('products.price') || 'Price'}</label>
                <NumericInput value={manualProductData.price ?? ''} onChange={e => setManualProductData({ ...manualProductData, price: e.target.value })} min="0" step="0.01" required />
              </div>
              <div className="form-group">
                <label>{t('products.quantity') || 'Quantity'}</label>
                <NumericInput value={manualProductData.quantity ?? ''} onChange={e => setManualProductData({ ...manualProductData, quantity: e.target.value })} min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label>{t('products.unitType', 'Unit Type')}</label>
                <select value={manualProductData.quantityType} onChange={e => setManualProductData({ ...manualProductData, quantityType: e.target.value })}>
                  <option value="unit">{t('products.unit', 'Unit')}</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="l">l</option>
                  <option value="box">{t('products.box', 'Box')}</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeManualProductModal}>{t('products.cancel') || 'Cancel'}</button>
                <button type="submit" className="submit-btn primary-btn">✅ {t('products.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Barcode Modal */}
      {showPrintModal && (
        <div className="modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowPrintModal(false)}>×</button>
            <h2>🖨️ {t('products.printBarcode')}</h2>
            <div className="print-modal-body">
              {printProduct && (
                <>
                  <div className="print-product-info">
                    <p><strong>{t('products.name')}:</strong> {printProduct.name}</p>
                    <p><strong>{t('products.barcode')}:</strong> {printProduct.barcode}</p>
                    <p><strong>{t('products.price')}:</strong> {formatCurrency(printProduct.price, settings.currency)}</p>
                  </div>
                  <div className="barcode-preview">
                    <h3>{t('products.barcode')} Preview:</h3>
                    <div className="preview-container">
                      <div className="preview-shopname" style={{fontSize: '6px', color: '#000', textAlign: 'center', marginBottom: '3px'}}>
                        {settings.posName || 'POS'}
                      </div>
                      <canvas 
                        ref={(canvas) => {
                          if (canvas && printProduct) {
                            try {
                              JsBarcode(canvas, printProduct.barcode, {
                                format: 'CODE128',
                                width: 2,
                                height: 50,
                                displayValue: false,
                                fontSize: 10,
                                margin: 0,
                                marginTop: 0,
                                marginBottom: 0
                              });
                            } catch (error) {
                              console.error('Error generating barcode preview:', error);
                            }
                          }
                        }}
                      />
                      <div className="preview-bottom-row" style={{display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px', marginTop: '3px'}}>
                        <div className="preview-barcode-number" style={{fontSize: '6px', fontWeight: 600, textAlign: 'left'}}>{printProduct.barcode}</div>
                        <div className="preview-price" style={{fontSize: '7px', fontWeight: 600, textAlign: 'right'}}>{formatCurrency(printProduct.price, settings.currency)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="form-group">
                <label>{t('products.printBarcode')} ×</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={printQuantity ?? 1}
                  onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="quantity-input"
                  autoFocus
                />
              </div>
              <div className="modal-buttons">
                <button className="cancel-btn" onClick={() => setShowPrintModal(false)}>
                  {t('products.cancel')}
                </button>
                <button className="submit-btn primary-btn" onClick={executePrint}>
                  🖨️ {t('products.printBarcode')} {printQuantity > 1 ? `×${printQuantity}` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferData.productId && (
        <div className="modal-overlay" onClick={closeTransferModal}>
          <div className="modal-content transfer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔄 {t('products.transferProduct')}</h2>
              <button className="close-btn" onClick={closeTransferModal}>✕</button>
            </div>
            
            <div className="transfer-info">
              <p><strong>{t('products.name')}:</strong> {transferData.productName}</p>
            </div>

            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label>{t('products.fromLocation')} *</label>
                <select
                  value={transferData.fromLocationId ?? ''}
                  onChange={(e) => setTransferData({ ...transferData, fromLocationId: e.target.value })}
                  required
                >
                  <option value="">{t('products.selectSourceLocation')}</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.type === 'shop' ? '🏪' : '📦'} {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('products.toLocation')} *</label>
                <select
                  value={transferData.toLocationId ?? ''}
                  onChange={(e) => setTransferData({ ...transferData, toLocationId: e.target.value })}
                  required
                >
                  <option value="">{t('products.selectDestinationLocation')}</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.type === 'shop' ? '🏪' : '📦'} {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('products.quantity')} *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={transferData.quantity ?? ''}
                  onChange={(e) => setTransferData({ ...transferData, quantity: e.target.value })}
                  placeholder={t('products.enterTransferQuantity')}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('products.transferReason')}</label>
                <textarea
                  value={transferData.reason ?? ''}
                  onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                  placeholder={t('products.enterTransferReason')}
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeTransferModal}>
                  {t('products.cancel')}
                </button>
                <button type="submit" className="submit-btn primary-btn">
                  🔄 {t('products.transferProduct')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocking transfers modal (shown when deletion is blocked by transfers) */}


      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
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

export default Products;
