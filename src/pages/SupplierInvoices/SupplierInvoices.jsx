import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllSupplierInvoices, createSupplierInvoice, updateSupplierInvoice, deleteSupplierInvoice, getProductByBarcode, getSupplierInvoiceById } from '../../utils/database';
import Notification from '../../components/Notification/Notification';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';
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
import './SupplierInvoices.css';

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

const SupplierInvoices = () => {
  const productNameRefs = useRef([]); // refs for product name inputs (prevent scanner Enter from submitting)
  const { t } = useTranslation();
  const { settings } = useSettings();
  const navigate = useNavigate();
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadInvoices();
  }, []);

  // Normalize numeric invoice fields to numbers (handle weird separators like ',' or ';')
  const normalizeNumber = (v) => {
    if (v === null || typeof v === 'undefined') return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const cleaned = v.replace(/[,;\s]/g, '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return Number(v) || 0;
  };

  const loadInvoices = async () => {
    setLoading(true);
    const result = await getAllSupplierInvoices();
    if (result.success) {
      // Normalize fields
      const normalized = result.data.map(inv => ({
        ...inv,
        total: normalizeNumber(inv.total),
        paid: normalizeNumber(inv.paid),
        debt: normalizeNumber(inv.debt),
        status: inv.status || (normalizeNumber(inv.debt) > 0 ? 'pending' : 'paid')
      }));
      console.debug('Loaded supplier invoices (normalized):', normalized.map(i => ({ id: i.id, total: i.total, paid: i.paid, debt: i.debt, status: i.status })));
      // Log the computed total debt
      const computedTotalDebt = normalized.reduce((s, it) => s + getInvoiceDebt(it), 0);
      console.debug('Computed total debt (normalized):', computedTotalDebt);
      setInvoices(normalized);
    }
    setLoading(false);
  };
  
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [formData, setFormData] = useState({
    supplierName: '',
    supplierPhone: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [{ productName: '', quantity: 0, quantityType: 'unit', purchasePrice: 0, barcode: '', existingProduct: null }],
    autoUpdateQuantity: true,
    paidAmount: 0,
    receivingLocationId: null
  });

  const [locations, setLocations] = useState([]);

  // Load locations
  const loadLocations = async () => {
    if (!ipcRenderer) return;
    try {
      const locs = await ipcRenderer.invoke('get-all-locations');
      setLocations(locs);
      // Auto-select first location if none selected
      if (!formData.receivingLocationId && locs.length > 0) {
        setFormData(prev => ({ ...prev, receivingLocationId: locs[0].id }));
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productName: '', quantity: 0, quantityType: 'unit', purchasePrice: 0, barcode: '', existingProduct: null }]
    });
  };

  const removeItem = (index) => {
    const items = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items });
  };

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

  // Helper: get existing product by barcode or name
  const getExistingProduct = (productName, barcode) => {
    for (const inv of invoices) {
      for (const item of inv.items) {
        if (
          (barcode && item.barcode && item.barcode === barcode) ||
          (!barcode && item.productName.trim().toLowerCase() === productName.trim().toLowerCase())
        ) {
          return item;
        }
      }
    }
    return null;
  };

  const updateItem = async (index, field, value) => {
    const items = [...formData.items];
    if (field === 'barcode') {
      // Check if product exists in database by barcode
      items[index][field] = value;
      if (value && value.trim() !== '') {
        const result = await getProductByBarcode(value.trim());
        if (result.success && result.data) {
          // Product exists - set unit and mark as existing
          items[index].existingProduct = result.data;
          items[index].quantityType = result.data.quantityType || 'unit';
          items[index].productName = result.data.name || items[index].productName;
        } else {
          // Product doesn't exist - clear existing product marker
          items[index].existingProduct = null;
        }
      } else {
        items[index].existingProduct = null;
      }
      setFormData({ ...formData, items });
      return;
    }
    if (field === 'quantityType') {
      // If product exists (found by barcode), prevent changing unit
      if (items[index].existingProduct) {
        showNotification(t('supplier.cannotChangeUnit') || 'Cannot change unit for an existing product.', 'error');
        return;
      }
      const prevType = items[index].quantityType || 'unit';
      const newType = value;
      const qty = parseFloat(items[index].quantity);
      if (
        prevType !== newType &&
        qty > 0 &&
        unitConversion[prevType] &&
        unitConversion[prevType][newType]
      ) {
        // Convert quantity
        items[index].quantity = (qty * unitConversion[prevType][newType]);
      }
      items[index][field] = value;
    } else {
      items[index][field] = value;
    }
    setFormData({ ...formData, items });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => 
      sum + (parseFloat(item.purchasePrice) || 0) * (parseInt(item.quantity) || 0), 0
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = calculateTotal();
    const paidAmount = parseFloat(formData.paidAmount) || 0;
    const debt = total - paidAmount;
    const invoiceData = {
      invoiceNumber: `SUP-${Date.now()}`,
      supplierName: formData.supplierName,
      supplierPhone: formData.supplierPhone || '',
      date: formData.invoiceDate,
      total: total,
      paid: paidAmount,
      debt: debt,
      status: debt > 0 ? 'pending' : 'paid',
      notes: '',
      autoUpdateQuantity: formData.autoUpdateQuantity,
      items: formData.items.filter(item => item.productName && item.quantity > 0).map(item => {
        return {
          productName: item.productName,
          quantity: parseInt(item.quantity),
          quantityType: item.quantityType || 'unit',
          price: parseFloat(item.purchasePrice),
          barcode: item.barcode
        };
      })
    };

    const result = await createSupplierInvoice(invoiceData);
    
    if (result.success) {
      // Update location quantities if auto-update is enabled and location is selected
      if (formData.autoUpdateQuantity && formData.receivingLocationId && ipcRenderer) {
        try {
          for (const item of formData.items.filter(item => item.productName && item.quantity > 0)) {
            // Get product ID from result (either existing or newly created)
            const productId = item.existingProduct?.id || result.data?.newProducts?.find(p => p.name === item.productName)?.id;
            
            if (productId) {
              // Get current quantity at this location
              const currentQty = await ipcRenderer.invoke('get-product-location-quantity', productId, formData.receivingLocationId);
              const newQty = currentQty + parseInt(item.quantity);
              
              // Update location quantity
              await ipcRenderer.invoke('set-product-location-quantity', productId, formData.receivingLocationId, newQty, null);
            }
          }
        } catch (error) {
          console.error('Error updating location quantities:', error);
          showNotification('Warning: Products added but location quantities not updated: ' + error.message, 'warning');
        }
      }
      
      await loadInvoices();
      
      // Check if new products were created
      const newProducts = result.data?.newProducts || [];
      
      if (newProducts.length > 0) {
        const productNames = newProducts.map(p => `- ${p.name} ${p.barcode ? '(' + p.barcode + ')' : ''}`).join('\n');
        showNotification(
          '✅ ' + (t('supplier.invoiceAdded') || 'Supplier invoice added successfully!') + 
          '\n\n⚠️ ' + (newProducts.length) + ' new product(s) created!'+
          '\n\nPlease complete their information in the Products page:\n' + 
          productNames,
          'success'
        );
        
        closeModal();
        // Navigate to Products page to show new products
        navigate('/products');
      } else {
        const message = formData.autoUpdateQuantity 
          ? '✅ ' + (t('supplier.invoiceAdded') || 'Supplier invoice added successfully! Product quantities updated.')
          : '✅ ' + (t('supplier.invoiceAdded') || 'Supplier invoice added successfully! (Quantities not updated)');
        showNotification(message, 'success');
        closeModal();
      }
    } else {
      showNotification('Failed to create supplier invoice: ' + result.error, 'error');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    const defaultLocationId = locations.length > 0 ? locations[0].id : null;
    setFormData({
      supplierName: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      items: [{ productName: '', quantity: 0, quantityType: 'unit', purchasePrice: 0, barcode: '', existingProduct: null }],
      autoUpdateQuantity: true,
      paidAmount: 0,
      receivingLocationId: defaultLocationId
    });
  };

  const deleteInvoice = async (id) => {
    // Close detail modal if open
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(null);
    }
    
    setConfirmDialog({
      message: t('supplier.confirmDelete'),
      onConfirm: async () => {
        try {
          const result = await deleteSupplierInvoice(id);
          if (result.success) {
            await loadInvoices();
            setConfirmDialog(null);
            showNotification('Supplier invoice deleted successfully', 'success');
          } else {
            setConfirmDialog(null);
            showNotification('Failed to delete invoice: ' + result.error, 'error');
          }
        } catch (error) {
          console.error('Delete error:', error);
          setConfirmDialog(null);
          showNotification('Error deleting invoice: ' + error.message, 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = (searchTerm || '').trim().toLowerCase();
    const matchesSearch = !q || (inv.supplierName && inv.supplierName.toLowerCase().includes(q)) || String(inv.invoiceNumber).includes(searchTerm);

    // Status filter
    const debt = getInvoiceDebt(inv);
    let matchesStatus = true;
    if (statusFilter === 'paid') {
      matchesStatus = (inv.status === 'paid') || (debt === 0);
    } else if (statusFilter === 'unpaid') {
      matchesStatus = (inv.status !== 'paid') && debt > 0;
    }

    // Date range filter (inclusive)
    let matchesDate = true;
    const invDate = inv.date ? new Date(inv.date) : null;
    if (filterFrom) {
      const from = new Date(filterFrom + 'T00:00:00');
      matchesDate = invDate && invDate >= from;
    }
    if (matchesDate && filterTo) {
      const to = new Date(filterTo + 'T23:59:59');
      matchesDate = invDate && invDate <= to;
    }

    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper: get currency symbol from current settings (falls back to currency code)
  const getCurrencySymbol = () => {
    try {
      const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: settings.currency }).formatToParts(0);
      const sym = parts.find(p => p.type === 'currency');
      return sym ? sym.value : settings.currency || '';
    } catch (e) {
      return settings.currency || '';
    }
  };

  // Helper: reliably compute debt for an invoice (normalizes values)
  function getInvoiceDebt(inv) {
    const total = normalizeNumber(inv.total);
    const paid = normalizeNumber(inv.paid);
    const debtFromField = typeof inv.debt !== 'undefined' ? normalizeNumber(inv.debt) : null;
    let debt = debtFromField !== null ? debtFromField : Math.max(0, +(total - paid).toFixed(2));
    // Treat very small values as zero to avoid showing 0.00 due to rounding issues
    if (Math.abs(debt) < 0.005) debt = 0;
    return Math.max(0, +debt.toFixed(2));
  }

  // Export single invoice to Excel
  const exportInvoiceToExcel = (invoice) => {
    if (!invoice || !invoice.items || invoice.items.length === 0) {
      showNotification(t('supplier.noItemsToExport') || 'No items to export!', 'error');
      return;
    }

    // Prepare data for export
    const exportData = invoice.items.map(item => ({
      'Product Name': item.productName,
      'Barcode': item.barcode || '',
      'Quantity': item.quantity,
      'Quantity Type': item.quantityType || 'unit',
      'Purchase Price': item.price,
      'Item Total': item.quantity * item.price
    }));

    // Add summary row
    exportData.push({
      'Product Name': '',
      'Barcode': '',
      'Quantity': '',
      'Quantity Type': '',
      'Purchase Price': 'TOTAL:',
      'Item Total': invoice.total
    });

    exportData.push({
      'Product Name': '',
      'Barcode': '',
      'Quantity': '',
      'Quantity Type': '',
      'Purchase Price': 'PAID:',
      'Item Total': invoice.paid || 0
    });

    exportData.push({
      'Product Name': '',
      'Barcode': '',
      'Quantity': '',
      'Quantity Type': '',
      'Purchase Price': 'DEBT:',
      'Item Total': invoice.debt || (invoice.total - (invoice.paid || 0))
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Product Name
      { wch: 15 }, // Barcode
      { wch: 10 }, // Quantity
      { wch: 15 }, // Quantity Type
      { wch: 15 }, // Purchase Price
      { wch: 15 }  // Item Total
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice Items');

    // Generate filename
    const filename = `Invoice_${invoice.supplierName}_${invoice.id}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, filename);
    
    showNotification(t('supplier.exportSuccess') || 'Invoice exported successfully!', 'success');
  };

  // Import invoice from Excel to populate form
  const importFromExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          showNotification(t('supplier.emptyFile') || 'Excel file is empty!', 'error');
          return;
        }

        // Parse items from Excel
        const items = [];
        
        for (const row of jsonData) {
          const productName = row['Product Name'] || row['product_name'] || row['product'];
          const barcode = row['Barcode'] || row['barcode'] || '';
          const quantity = parseFloat(row['Quantity'] || row['quantity'] || 0);
          const quantityType = row['Quantity Type'] || row['quantity_type'] || 'unit';
          const purchasePrice = parseFloat(row['Purchase Price'] || row['purchase_price'] || row['price'] || 0);

          // Skip rows without product name or invalid data
          if (!productName || productName === '' || quantity <= 0 || purchasePrice < 0) {
            continue;
          }

          // Skip summary rows
          if (purchasePrice === 'TOTAL:' || purchasePrice === 'PAID:' || purchasePrice === 'DEBT:') {
            continue;
          }

          // Check if product exists by barcode
          let existingProduct = null;
          if (barcode) {
            const result = await getProductByBarcode(barcode);
            if (result.success && result.data) {
              existingProduct = result.data;
            }
          }

          items.push({
            productName,
            barcode,
            quantity,
            quantityType: existingProduct ? (existingProduct.quantityType || 'unit') : quantityType,
            purchasePrice,
            existingProduct
          });
        }

        if (items.length === 0) {
          showNotification(t('supplier.noValidItems') || 'No valid items found in Excel file!', 'error');
          return;
        }

        // Update form data with imported items
        setFormData(prev => ({
          ...prev,
          items: items
        }));

        showNotification(
          (t('supplier.itemsImported') || 'Successfully imported {{count}} item(s)!').replace('{{count}}', items.length),
          'success'
        );
        
      } catch (error) {
        console.error('Import error:', error);
        showNotification(t('supplier.importError') || 'Error importing Excel file: ' + error.message, 'error');
      }
    };

    reader.readAsArrayBuffer(file);
    
    // Reset file input
    event.target.value = '';
  };

  return (
    <div className="supplier-invoices-page">
      <div className="page-header">
          <h1 className="page-title">📋 {t('supplier.title')}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="add-btn primary-btn" onClick={() => setShowModal(true)}>
              ➕ {t('supplier.addInvoice')}
            </button>
            

          </div>
      </div>

      {/* Search Bar + Filters */}
      <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder={t('supplier.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        <span className="search-icon">🔍</span>

        <div className="filters-row">
          <div className="filter-item">
            <label className="filter-label">{t('supplier.filterStatus') || t('supplier.status')}</label>
            <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('supplier.filterAll') || 'All'}</option>
              <option value="paid">{t('supplier.paid') || 'Paid'}</option>
              <option value="unpaid">{t('supplier.filterUnpaid') || t('supplier.pending') || 'Unpaid'}</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">{t('supplier.from') || t('invoiceHistory.from') || 'From'}</label>
            <input type="date" className="filter-date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>

          <div className="filter-item">
            <label className="filter-label">{t('supplier.to') || t('invoiceHistory.to') || 'To'}</label>
            <input type="date" className="filter-date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>

          <div className="filter-item">
            <label className="filter-label"><br/></label>
            <button type="button" className="clear-filters-btn" onClick={() => { setStatusFilter('all'); setFilterFrom(''); setFilterTo(''); }}>
              {t('supplier.clearFilters') || 'Clear filters'}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="stats-summary">
        <div className="stat-box">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
              <p className="stat-label">{t('supplier.totalInvoices')}</p>
            <h3 className="stat-value">{invoices.length}</h3>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
              <p className="stat-label">{t('supplier.totalPurchases')}</p>
            <h3 className="stat-value">
              {formatCurrency(invoices.reduce((sum, inv) => sum + inv.total, 0), settings.currency)}
            </h3>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
              <p className="stat-label">{t('supplier.totalPaid')}</p>
            <h3 className="stat-value">
              {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.paid || 0), 0), settings.currency)}
            </h3>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
              <p className="stat-label">{t('supplier.totalDebt')}</p>
            <h3 className="stat-value" style={{ color: 'var(--danger-color, #dc3545)' }}>
              {formatCurrency(invoices.reduce((sum, inv) => sum + getInvoiceDebt(inv), 0), settings.currency)}
            </h3>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
              <p className="stat-label">{t('supplier.totalSuppliers')}</p>
            <h3 className="stat-value">
              {new Set(invoices.map(inv => inv.supplierName)).size}
            </h3>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="invoices-list">
          {filteredInvoices.length === 0 ? (
            <div className="no-invoices">
              <p>📋 {t('supplier.noInvoices')}</p>
            </div>
          ) : (
          filteredInvoices.map((invoice) => {
            const debt = getInvoiceDebt(invoice);
            // Prefer server-authoritative status when available
            const isPaid = invoice.status === 'paid' ? true : (debt <= 0);
            return (
            <div
              key={invoice.id}
              className="invoice-card"
              onClick={async () => {
                // Fetch fresh invoice from DB to ensure modal shows authoritative values
                try {
                  const res = await getSupplierInvoiceById(invoice.id);
                  if (res && res.success && res.data) {
                    const inv = res.data;
                    const normalizedInv = {
                      ...inv,
                      total: normalizeNumber(inv.total),
                      paid: normalizeNumber(inv.paid),
                      debt: normalizeNumber(inv.debt),
                      status: inv.status || (normalizeNumber(inv.debt) > 0 ? 'pending' : 'paid')
                    };
                    // Compute debt based on total - paid to avoid stale/mismatched debt field
                    const computedDebt = Math.max(0, +(normalizeNumber(normalizedInv.total) - normalizeNumber(normalizedInv.paid)).toFixed(2));
                    setSelectedInvoice({
                      ...normalizedInv,
                      _paid: typeof normalizedInv.paid !== 'undefined' ? Number(normalizedInv.paid).toFixed(2) : '',
                      _debt: Number(computedDebt).toFixed(2)
                    });
                    return;
                  }
                } catch (e) {
                  console.error('Error fetching invoice by id for modal:', e);
                }
                // Fallback to using existing invoice object
                setSelectedInvoice(invoice);
              }}
            >
              <div className="invoice-header">
                <div>
                  <h4>#{invoice.id}</h4>
                  <p className="supplier-name">{invoice.supplierName}</p>
                  {invoice.supplierPhone && (
                    <p className="supplier-phone">📞 {invoice.supplierPhone}</p>
                  )}
                  <span className={`invoice-status ${isPaid ? 'paid' : 'pending'}`}>
                    {isPaid ? '✓ ' + (t('supplier.paid') || 'Paid') : '⚠ ' + (t('supplier.pending') || 'Pending')}
                  </span>
                </div>
                <div className="invoice-meta">
                  <span className="invoice-date">{formatDate(invoice.date)}</span>
                  <span className="invoice-total">{formatCurrency(invoice.total, settings.currency)}</span>
                  {debt > 0 && (
                    <span className="invoice-debt" style={{ color: 'var(--danger-color, #dc3545)', fontWeight: 'bold' }}>
                      {t('supplier.debt')}: {formatCurrency(debt, settings.currency)}
                    </span>
                  )}
                </div>
              </div>
              <div className="invoice-items-count">
                  {(invoice.items ? invoice.items.length : 0)} {t('supplier.items')}
              </div>
              <div className="invoice-actions">
                <button 
                  className="export-invoice-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportInvoiceToExcel(invoice);
                  }}
                  title={t('supplier.exportExcel')}
                >
                  📤
                </button>
                <button 
                  className="delete-invoice-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteInvoice(invoice.id);
                  }}
                  title={t('supplier.delete')}
                >
                  🗑️
                </button>
              </div>
            </div>
          );})
        )}
      </div>

      {/* Add Invoice Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <h2>{t('supplier.addInvoice')}</h2>
              <div className="modal-header-actions">
                <label className="import-btn-modal" style={{ cursor: 'pointer', marginRight: '15px' }}>
                  📥 {t('supplier.importExcel')}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={importFromExcel}
                    style={{ display: 'none' }}
                  />
                </label>
                <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="invoice-form">
              <div className="form-row">
                <div className="form-group">
                    <label>{t('supplier.supplierName')}:</label>
                  <input
                    type="text"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('phone') || 'Phone'}:</label>
                  <input
                    type="text"
                    value={formData.supplierPhone}
                    onChange={(e) => setFormData({ ...formData, supplierPhone: e.target.value })}
                    placeholder={t('enterPhone') || 'Enter phone number'}
                  />
                </div>
                <div className="form-group">
                    <label>{t('supplier.invoiceDate')}:</label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="items-section">
                  <h3>{t('supplier.invoiceItems')}</h3>
                {formData.items.map((item, index) => (
                  <div key={index} className="item-row">
                    <input
                      type="text"
                      placeholder={t('supplier.barcode')}
                      value={item.barcode}
                      onChange={(e) => updateItem(index, 'barcode', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Prevent barcode scanner's trailing Enter from submitting the invoice form
                          e.preventDefault();
                          productNameRefs.current[index]?.focus();
                        }
                      }}
                      className="barcode-input"
                    />
                    <input
                      ref={el => productNameRefs.current[index] = el}
                      type="text"
                      placeholder={t('supplier.productName')}
                      value={item.productName}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      placeholder={t('supplier.quantity')}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      min="0"
                      required
                    />
                    {item.existingProduct ? (
                      <select
                        value={item.existingProduct.quantityType || 'unit'}
                        className="quantity-type-select"
                        disabled
                        style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed', color: '#000', opacity: 1, fontWeight: '600' }}
                      >
                        <option value={item.existingProduct.quantityType || 'unit'}>
                          {item.existingProduct.quantityType || 'unit'}
                        </option>
                      </select>
                    ) : (
                      <select
                        value={item.quantityType || 'unit'}
                        onChange={e => updateItem(index, 'quantityType', e.target.value)}
                        className="quantity-type-select"
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
                    )}
                    <input
                      type="number"
                      step="0.01"
                      placeholder={t('supplier.purchasePrice')}
                      value={item.purchasePrice}
                      onChange={(e) => updateItem(index, 'purchasePrice', e.target.value)}
                      min="0"
                      required
                    />
                    <span className="item-total">
                      {formatCurrency(item.quantity * item.purchasePrice, settings.currency)}
                    </span>
                    {(formData.items && formData.items.length > 1) && (
                      <button
                        type="button"
                        className="remove-item-btn"
                        onClick={() => removeItem(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-item-btn secondary-btn" onClick={addItem}>
                    ➕ {t('supplier.addItem')}
                </button>
              </div>

              <div className="invoice-total-section">
                  <h3>{t('supplier.totalAmount')}: {formatCurrency(calculateTotal(), settings.currency)}</h3>
              </div>

              <div className="form-row" style={{ marginTop: '20px' }}>
                <div className="form-group">
                    <label>{t('supplier.paidAmount')}:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={calculateTotal()}
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                    <label>{t('supplier.debtAmount')}:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={(calculateTotal() - (parseFloat(formData.paidAmount) || 0)).toFixed(2)}
                    disabled
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--danger-color, #dc3545)', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              <div className="form-group checkbox-group" style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '16px' }}>
                  <input
                    type="checkbox"
                    checked={formData.autoUpdateQuantity}
                    onChange={(e) => setFormData({ ...formData, autoUpdateQuantity: e.target.checked })}
                    style={{ marginRight: '10px', cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <span>🔄 {t('supplier.autoUpdateQuantity') || 'Automatically update product quantities'}</span>
                </label>
              </div>

              {formData.autoUpdateQuantity && locations.length > 0 && (
                <div className="form-group">
                  <label>📍 Receiving Location *</label>
                  <select
                    value={formData.receivingLocationId || ''}
                    onChange={(e) => setFormData({ ...formData, receivingLocationId: parseInt(e.target.value) })}
                    required={formData.autoUpdateQuantity}
                  >
                    <option value="">Select location to receive stock...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.type === 'shop' ? '🏪' : '📦'} {loc.name}
                      </option>
                    ))}
                  </select>
                  <small className="form-hint">Select which shop/stock will receive this inventory</small>
                </div>
              )}

              <button type="submit" className="submit-btn primary-btn">
                  {t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <h2>{t('supplier.invoiceDetails')} #{selectedInvoice.id}</h2>
              <div className="modal-header-actions">
                <button 
                  className="export-btn-modal" 
                  onClick={() => exportInvoiceToExcel(selectedInvoice)}
                  style={{ marginRight: '15px' }}
                >
                  📤 {t('supplier.exportExcel')}
                </button>
                <button className="close-btn" onClick={() => setSelectedInvoice(null)}>✕</button>
              </div>
            </div>
            
            <div className="invoice-details">
              <div className="detail-row">
                  <span>{t('supplier.supplier')}:</span>
                <strong>{selectedInvoice.supplierName}</strong>
              </div>
              {selectedInvoice.supplierPhone && (
                <div className="detail-row">
                    <span>{t('phone') || 'Phone'}:</span>
                  <strong>{selectedInvoice.supplierPhone}</strong>
                </div>
              )}
              <div className="detail-row">
                  <span>{t('supplier.date')}:</span>
                <strong>{formatDate(selectedInvoice.date)}</strong>
              </div>
              <div className="detail-row">
                  <span>{t('supplier.created')}:</span>
                <strong>{new Date(selectedInvoice.date).toLocaleString()}</strong>
              </div>
              <div className="detail-row">
                  <span>{t('supplier.status')}:</span>
                <strong className={selectedInvoice.status === 'paid' ? 'text-success' : 'text-danger'}>
                  {selectedInvoice.status === 'paid' ? t('supplier.paid') : t('supplier.pending')}
                </strong>
              </div>
              {/* Editable Paid & Debt inputs with Save button (stacked vertically) + currency prefix */}
              <div className="detail-row payment-edit-column" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
                <div className="payment-row">
                  <label className="payment-label">{t('supplier.paidAmount')}:</label>
                  <div className="payment-input-wrapper">
                    <span className="currency-prefix">{getCurrencySymbol()}</span>
                    <input
                      className="payment-input"
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedInvoice.total}
                      value={typeof selectedInvoice._paid !== 'undefined' ? selectedInvoice._paid : (selectedInvoice.paid || 0)}
                      onChange={(e) => {
                        const total = parseFloat(selectedInvoice.total) || 0;
                        const raw = e.target.value;
                        if (raw === '') {
                          setSelectedInvoice(prev => ({ ...prev, _paid: '', _debt: '' }));
                          return;
                        }
                        const parsed = parseFloat(raw);
                        let paidNum = isNaN(parsed) ? 0 : parsed;
                        paidNum = Math.max(0, Math.min(paidNum, total));
                        const debtNum = +(total - paidNum).toFixed(2);
                        // Keep the typed/raw string for _paid so user can continue typing (avoids cursor reset)
                        setSelectedInvoice(prev => ({ ...prev, _paid: raw, _debt: debtNum.toFixed(2) }));
                      }}
                    />
                  </div>
                </div>

                <div className="payment-row">
                  <label className="payment-label">{t('supplier.debtAmount')}:</label>
                  <div className="payment-input-wrapper">
                    <span className="currency-prefix">{getCurrencySymbol()}</span>
                    <input
                      className="payment-input"
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedInvoice.total}
                      value={typeof selectedInvoice._debt !== 'undefined' ? selectedInvoice._debt : (selectedInvoice.debt || (selectedInvoice.total - (selectedInvoice.paid || 0)))}
                      onChange={(e) => {
                        const total = parseFloat(selectedInvoice.total) || 0;
                        const raw = e.target.value;
                        if (raw === '') {
                          setSelectedInvoice(prev => ({ ...prev, _paid: '', _debt: '' }));
                          return;
                        }
                        const parsed = parseFloat(raw);
                        let debtNum = isNaN(parsed) ? 0 : parsed;
                        debtNum = Math.max(0, Math.min(debtNum, total));
                        const paidNum = +(total - debtNum).toFixed(2);
                        // Keep the typed/raw string for _debt so user can continue typing
                        setSelectedInvoice(prev => ({ ...prev, _debt: raw, _paid: paidNum.toFixed(2) }));
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="save-payment-btn primary-btn"
                    onClick={async () => {
                      const total = parseFloat(selectedInvoice.total) || 0;
                      // Determine new paid amount from inputs, prioritizing _paid if provided
                      let paid = parseFloat(selectedInvoice.paid || 0);
                      if (typeof selectedInvoice._paid !== 'undefined' && selectedInvoice._paid !== '') {
                        paid = Math.min(Math.max(parseFloat(selectedInvoice._paid) || 0, 0), total);
                      } else if (typeof selectedInvoice._debt !== 'undefined' && selectedInvoice._debt !== '') {
                        const debtVal = Math.min(Math.max(parseFloat(selectedInvoice._debt) || 0, 0), total);
                        paid = Math.min(Math.max(total - debtVal, 0), total);
                      }

                      const status = paid >= total ? 'paid' : 'pending';

                      const res = await updateSupplierInvoice(selectedInvoice.id, { paid, status });
                      if (res.success) {
                        console.debug('Update response (raw):', res);
                        // Normalize returned invoice fields before updating state
                        const normalizedRes = {
                          ...res.data,
                          total: normalizeNumber(res.data.total),
                          paid: normalizeNumber(res.data.paid),
                          debt: normalizeNumber(res.data.debt),
                          status: res.data.status || (normalizeNumber(res.data.debt) > 0 ? 'pending' : 'paid')
                        };
                        // Client-side safeguard: if paid reaches or exceeds total (within rounding tolerance), clear debt and mark paid
                        if (normalizedRes.paid >= normalizedRes.total - 0.005) {
                          normalizedRes.debt = 0;
                          normalizedRes.status = 'paid';
                        }
                        console.debug('Update response (normalized):', { id: normalizedRes.id, total: normalizedRes.total, paid: normalizedRes.paid, debt: normalizedRes.debt, status: normalizedRes.status });

                        // Optimistically update invoices list so status/debt reflect immediately
                        setInvoices(prev => prev.map(inv => String(inv.id) === String(normalizedRes.id) ? normalizedRes : inv));

                        // Fetch the invoice directly to verify stored DB values
                        try {
                          const fresh = await getSupplierInvoiceById(normalizedRes.id);
                          console.debug('getSupplierInvoiceById after update:', fresh);
                        } catch (e) {
                          console.error('getSupplierInvoiceById error:', e);
                        }

                        // Notify other pages that supplier invoices changed (so stats can refresh)
                        try {
                          window.dispatchEvent(new CustomEvent('supplierInvoices:updated', { detail: normalizedRes }));
                        } catch (e) {
                          console.warn('Event dispatch failed:', e);
                        }

                        await loadInvoices();
                        // Ensure selectedInvoice shows formatted paid/debt values (compute debt as total - paid to avoid stale field)
                        const computedDebt = Math.max(0, +(normalizeNumber(normalizedRes.total) - normalizeNumber(normalizedRes.paid)).toFixed(2));
                        setSelectedInvoice(prev => ({
                          ...(normalizedRes || prev),
                          _paid: (typeof normalizedRes.paid !== 'undefined') ? Number(normalizedRes.paid).toFixed(2) : '',
                          _debt: Number(computedDebt).toFixed(2)
                        }));
                        // Show specific message when fully paid
                        if (normalizedRes && normalizedRes.status === 'paid') {
                          showNotification(t('supplier.invoiceFullyPaid') || 'Invoice fully paid', 'success');
                        } else {
                          showNotification(t('supplier.paymentUpdated') || 'Payment updated', 'success');
                        }
                      } else {
                        showNotification(t('supplier.updateFailed') || ('Failed to update invoice: ' + res.error), 'error');
                      }
                    }}
                  >
                    💾 {t('common.save') || 'Save'}
                  </button>
                </div>
              </div>

                 <h3>{t('supplier.items')}:</h3>
              <table className="items-table">
                <thead>
                  <tr>
                      <th>{t('supplier.barcode')}</th>
                      <th>{t('supplier.product')}</th>
                      <th>{t('supplier.quantity')}</th>
                      <th>{t('supplier.price')}</th>
                      <th>{t('supplier.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                    selectedInvoice.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.barcode || '-'}</td>
                        <td>{item.productName || '-'}</td>
                        <td>{item.quantity || 0}{['g','kg','mg','tonne','l','ml','m','cm','mm','box','pack'].includes(item.quantityType) && item.quantityType !== 'unit' ? ' ' + item.quantityType : ''}</td>
                        <td>{formatCurrency(parseFloat(item.price) || 0, settings.currency)}</td>
                        <td>{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0), settings.currency)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                        <td colSpan="5" style={{textAlign: 'center', padding: '20px', color: 'var(--text-secondary)'}}>No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="invoice-total">
                  <strong>{t('supplier.totalAmount')}:</strong>
                <strong className="total-value">{formatCurrency(selectedInvoice.total, settings.currency)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
      
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

export default SupplierInvoices;
