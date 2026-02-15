import React, { useState, useEffect } from 'react';
// Conditionally import ipcRenderer for Electron environment (like Products.jsx)
let ipcRenderer = null;
try {
  if (window.require) {
    const electron = window.require('electron');
    ipcRenderer = electron.ipcRenderer;
  }
} catch (error) {
  console.warn('ipcRenderer not available:', error.message);
}
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllInvoices, getProductById, updateProduct } from '../../utils/database';
import Notification from '../../components/Notification/Notification';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';
import './ProductReturn.css';

const ProductReturn = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  
  const [activeTab, setActiveTab] = useState('return'); // 'return' or 'history'
  const [invoiceId, setInvoiceId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('damaged');
  const [notes, setNotes] = useState('');
  const [notification, setNotification] = useState(null);
  const [locations, setLocations] = useState([]);
    // Load locations from database (like Products.jsx)
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
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [returnHistory, setReturnHistory] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  // Load return history
  useEffect(() => {
    loadReturnHistory();
  }, []);

  const loadReturnHistory = () => {
    const returns = JSON.parse(localStorage.getItem('productReturns') || '[]');
    // Sort by timestamp, newest first
    returns.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setReturnHistory(returns);
  };

  const searchInvoice = async () => {
    // Get invoices from database
    const result = await getAllInvoices();
    const invoices = result.success ? result.data : [];
    const searchInput = invoiceId.trim().toLowerCase();
    const found = invoices.find(inv => {
      // Normalize both id fields to string and lowercase
      const invIdStr = (inv.id || '').toString().toLowerCase();
      const invNumStr = (inv.invoiceNumber || '').toString().toLowerCase();
      // Check all possible matches for both fields
      return (
        invIdStr === searchInput ||
        ('inv-' + invIdStr) === searchInput ||
        invIdStr === searchInput.replace('inv-', '') ||
        invIdStr === ('inv-' + searchInput.replace('inv-', '')) ||
        invNumStr === searchInput ||
        ('inv-' + invNumStr) === searchInput ||
        invNumStr === searchInput.replace('inv-', '') ||
        invNumStr === ('inv-' + searchInput.replace('inv-', ''))
      );
    });
    if (found) {
      setSelectedInvoice(found);
      // Initialize return items with all items from invoice, quantity 0, and locationId (default to first location)
      setReturnItems(found.items.map(item => ({
        ...item,
        name: item.productName || item.name,
        returnQuantity: 0,
        locationId: locations.length > 0 ? locations[0].id : ''
      })));
    } else {
      showNotification(t('returns.invoiceNotFound'), 'error');
      setSelectedInvoice(null);
      setReturnItems([]);
    }
  };

  const updateReturnQuantity = (index, quantity) => {
    const updated = [...returnItems];
    const maxQty = updated[index].quantity;
    updated[index].returnQuantity = Math.min(Math.max(0, quantity), maxQty);
    setReturnItems(updated);
  };

  // New: update location for a return item
  const updateReturnLocation = (index, locationId) => {
    const updated = [...returnItems];
    updated[index].locationId = locationId;
    setReturnItems(updated);
  };

  const calculateRefund = () => {
    const subtotal = returnItems.reduce((sum, item) => 
      sum + (item.price * item.returnQuantity), 0
    );
    const discount = subtotal * (settings.discountRate / 100);
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * (settings.taxRate / 100);
    const total = afterDiscount + tax;

    return { subtotal, discount, tax, total };
  };

  const processReturn = () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    
    if (itemsToReturn.length === 0) {
      showNotification(t('returns.selectAtLeastOne'), 'warning');
      return;
    }

    const refund = calculateRefund();
    
    setConfirmDialog({
      message: `${t('returns.confirmReturn')} ${formatCurrency(refund.total, settings.currency)}?`,
      onConfirm: async () => {
        // Update product quantities - add returned items back to correct stock location
        for (const item of itemsToReturn) {
          if (item.productId && item.locationId && ipcRenderer) {
            try {
              // Get current location quantity
              const prodLocations = await ipcRenderer.invoke('get-product-locations', item.productId);
              const loc = prodLocations.find(l => String(l.locationId) === String(item.locationId));
              const currentQty = loc ? parseFloat(loc.quantity) || 0 : 0;
              const newLocQty = currentQty + item.returnQuantity;
              await ipcRenderer.invoke('set-product-location-quantity', item.productId, parseInt(item.locationId), newLocQty, loc && loc.localization ? loc.localization : null);
            } catch (error) {
              console.error('Error updating product location quantity:', error);
            }
          }
        }

        // Save return record
        const returnRecord = {
          id: Date.now(),
          invoiceId: selectedInvoice.id,
          timestamp: new Date().toISOString(),
          items: itemsToReturn.map(item => ({
            name: item.name,
            productId: item.productId,
            quantity: item.returnQuantity,
            price: item.price
          })),
          reason: returnReason,
          notes: notes,
          refund: refund.total,
          subtotal: refund.subtotal,
          discount: refund.discount,
          tax: refund.tax
        };

        const returns = JSON.parse(localStorage.getItem('productReturns') || '[]');
        returns.push(returnRecord);
        localStorage.setItem('productReturns', JSON.stringify(returns));

        setConfirmDialog(null);
        showNotification(t('returns.returnSuccess'), 'success');
        
        // Reload history
        loadReturnHistory();
        
        // Reset form
        setInvoiceId('');
        setSelectedInvoice(null);
        setReturnItems([]);
        setReturnReason('damaged');
        setNotes('');
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const deleteReturn = (returnId) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this return record?',
      onConfirm: async () => {
        const returns = returnHistory.filter(r => r.id !== returnId);
        localStorage.setItem('productReturns', JSON.stringify(returns));
        loadReturnHistory();
        if (selectedReturn?.id === returnId) {
          setSelectedReturn(null);
        }
        setConfirmDialog(null);
        showNotification('Return record deleted successfully', 'success');
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const refund = selectedInvoice ? calculateRefund() : { subtotal: 0, discount: 0, tax: 0, total: 0 };
  const hasItemsToReturn = returnItems.some(item => item.returnQuantity > 0);

  return (
    <div className="product-return-page">
      <div className="page-header">
        <h1 className="page-title">🔄 {t('returns.title')}</h1>
        <div className="header-tabs">
          <button 
            className={`tab-btn ${activeTab === 'return' ? 'active' : ''}`}
            onClick={() => setActiveTab('return')}
          >
            🔄 {t('returns.processReturnTab')}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📋 {t('returns.returnHistoryTab', { count: returnHistory.length })}
          </button>
        </div>
      </div>

      {/* Process Return Tab */}
      {activeTab === 'return' && (
        <div className="return-container">
          {/* Search Invoice Section */}
          <div className="search-section">
            <h3>{t('returns.findInvoice')}</h3>
            <div className="invoice-search">
              <input
                type="text"
                className="invoice-input"
                placeholder={t('returns.enterInvoiceId')}
                value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchInvoice()}
            />
            <button className="search-btn primary-btn" onClick={searchInvoice}>
              🔍 {t('returns.search')}
            </button>
          </div>
        </div>

        {/* Invoice Details & Return Items */}
        {selectedInvoice && (
          <div className="return-content">
            <div className="invoice-info-card">
              <h3>{t('returns.invoiceDetails')}</h3>
              <div className="info-row">
                <span>{t('returns.invoiceId')}:</span>
                <strong>#{selectedInvoice.id}</strong>
              </div>
              <div className="info-row">
                <span>{t('returns.date')}:</span>
                <strong>{new Date(selectedInvoice.timestamp).toLocaleString()}</strong>
              </div>
              <div className="info-row">
                <span>{t('returns.totalAmount')}:</span>
                <strong>{formatCurrency(selectedInvoice.total, settings.currency)}</strong>
              </div>
            </div>

            {/* Return Items Selection */}
            <div className="return-items-section">
              <h3>{t('returns.selectItems')}</h3>
              <div className="return-items-list">
                {returnItems.map((item, index) => (
                  <div key={index} className="return-item-card">
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p className="item-details">
                        {t('returns.originalQuantity')}: {item.quantity} | 
                        {t('returns.price')}: {formatCurrency(item.price, settings.currency)}
                      </p>
                    </div>
                    <div className="return-quantity-control">
                      <label>{t('returns.returnQty')}:</label>
                      <div className="quantity-input">
                        <button
                          className="qty-btn"
                          onClick={() => updateReturnQuantity(index, item.returnQuantity - 1)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={item.returnQuantity}
                          onChange={(e) => updateReturnQuantity(index, parseInt(e.target.value) || 0)}
                          className="qty-input"
                        />
                        <button
                          className="qty-btn"
                          onClick={() => updateReturnQuantity(index, item.returnQuantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className="item-subtotal">
                        {formatCurrency(item.price * item.returnQuantity, settings.currency)}
                      </span>
                    </div>
                    {/* Stock Location Selection */}
                    <div className="return-location-select">
                      <select
                        value={item.locationId || (locations.length > 0 ? locations[0].id : '')}
                        onChange={e => updateReturnLocation(index, e.target.value)}
                        className="location-select"
                        required
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.type === 'shop' ? '🏪' : '📦'} {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Reason & Notes */}
            <div className="return-details-section">
              <div className="form-group">
                <label>{t('returns.returnReason')}:</label>
                <select 
                  className="return-reason-select"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                >
                  <option value="damaged">{t('returns.damaged')}</option>
                  <option value="defective">{t('returns.defective')}</option>
                  <option value="wrong">{t('returns.wrong')}</option>
                  <option value="unsatisfied">{t('returns.unsatisfied')}</option>
                  <option value="other">{t('returns.other')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('returns.additionalNotes')}:</label>
                <textarea
                  className="return-notes"
                  placeholder={t('returns.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                />
              </div>
            </div>

            {/* Refund Summary */}
            {hasItemsToReturn && (
              <div className="refund-summary">
                <h3>{t('returns.refundSummary')}</h3>
                <div className="summary-row">
                  <span>{t('returns.subtotal')}:</span>
                  <span>{formatCurrency(refund.subtotal, settings.currency)}</span>
                </div>
                <div className="summary-row">
                  <span>{t('returns.discount')} ({settings.discountRate}%):</span>
                  <span className="discount-text">-{formatCurrency(refund.discount, settings.currency)}</span>
                </div>
                <div className="summary-row">
                  <span>{t('returns.tax')} ({settings.taxRate}%):</span>
                  <span>{formatCurrency(refund.tax, settings.currency)}</span>
                </div>
                <div className="summary-row total-row">
                  <span>{t('returns.totalRefund')}:</span>
                  <span className="refund-amount">{formatCurrency(refund.total, settings.currency)}</span>
                </div>
              </div>
            )}

            {/* Process Button */}
            <button 
              className="process-return-btn primary-btn"
              onClick={processReturn}
              disabled={!hasItemsToReturn}
            >
              🔄 {t('returns.processReturn')}
            </button>
          </div>
        )}

        {/* No Invoice Selected */}
        {!selectedInvoice && (
          <div className="no-invoice-selected">
            <p>🔍 {t('returns.noInvoice')}</p>
          </div>
        )}
      </div>
      )}

      {/* Return History Tab */}
      {activeTab === 'history' && (
        <div className="history-container">
          {returnHistory.length > 0 ? (
            <div className="history-layout">
              {/* History List */}
              <div className="history-list">
                <h3>📋 {t('returns.returnHistoryTab', { count: returnHistory.length })}</h3>
                {returnHistory.map((returnRecord) => (
                  <div 
                    key={returnRecord.id} 
                    className={`history-card ${selectedReturn?.id === returnRecord.id ? 'selected' : ''}`}
                    onClick={() => setSelectedReturn(returnRecord)}
                  >
                    <div className="history-card-header">
                        <span className="return-id">{t('returns.returnId', { id: returnRecord.id }) || `Return #${returnRecord.id}`}</span>
                        <span className="return-date">{formatDate(returnRecord.timestamp)}</span>
                    </div>
                    <div className="history-card-body">
                      <div className="history-info">
                        <span>📄 {t('returns.invoiceId')}: #{returnRecord.invoiceId}</span>
                        <span>📦 {t('returns.items')}: {(returnRecord.items ? returnRecord.items.length : 0)}</span>
                      </div>
                      <div className="history-refund">
                        <span className="refund-label">{t('returns.refund')}:</span>
                        <span className="refund-value">{formatCurrency(returnRecord.refund, settings.currency)}</span>
                      </div>
                    </div>
                    <div className="return-reason-badge">
                      {returnRecord.reason === 'damaged' && `⚠️ ${t('returns.damaged')}`}
                      {returnRecord.reason === 'defective' && `🔧 ${t('returns.defective')}`}
                      {returnRecord.reason === 'wrong-item' && `❌ ${t('returns.wrong')}`}
                      {returnRecord.reason === 'customer-request' && `👤 ${t('returns.unsatisfied')}`}
                      {returnRecord.reason === 'expired' && `⏰ ${t('returns.expired') || 'Expired'}`}
                      {returnRecord.reason === 'other' && `📝 ${t('returns.other')}`}
                    </div>
                  </div>
                ))}
              </div>

              {/* History Details */}
              <div className="history-details">
                {selectedReturn ? (
                  <>
                    <div className="details-header">
                      <h3>{t('returns.returnDetails') || 'Return Details'}</h3>
                      <button 
                        className="delete-btn"
                        onClick={() => deleteReturn(selectedReturn.id)}
                      >
                        🗑️ {t('returns.delete')}
                      </button>
                    </div>
                    
                    <div className="details-section">
                      <h4>📋 {t('returns.basicInfo') || 'Basic Information'}</h4>
                      <div className="detail-row">
                        <span>{t('returns.returnId') || 'Return ID'}:</span>
                        <strong>#{selectedReturn.id}</strong>
                      </div>
                      <div className="detail-row">
                        <span>{t('returns.invoiceId')}:</span>
                        <strong>#{selectedReturn.invoiceId}</strong>
                      </div>
                      <div className="detail-row">
                        <span>{t('returns.date')}:</span>
                        <strong>{formatDate(selectedReturn.timestamp)}</strong>
                      </div>
                      <div className="detail-row">
                        <span>{t('returns.returnReason')}:</span>
                        <strong>
                          {selectedReturn.reason === 'damaged' && t('returns.damaged')}
                          {selectedReturn.reason === 'defective' && t('returns.defective')}
                          {selectedReturn.reason === 'wrong-item' && t('returns.wrong')}
                          {selectedReturn.reason === 'customer-request' && t('returns.unsatisfied')}
                          {selectedReturn.reason === 'expired' && (t('returns.expired') || 'Expired')}
                          {selectedReturn.reason === 'other' && t('returns.other')}
                        </strong>
                      </div>
                      {selectedReturn.notes && (
                        <div className="detail-row">
                          <span>{t('returns.additionalNotes')}:</span>
                          <p className="notes-text">{selectedReturn.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="details-section">
                      <h4>📦 {t('returns.returnedItems') || 'Returned Items'}</h4>
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th>{t('returns.product') || 'Product'}</th>
                            <th>{t('returns.quantity') || 'Quantity'}</th>
                            <th>{t('returns.price') || 'Price'}</th>
                            <th>{t('returns.total') || 'Total'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReturn.items.map((item, index) => (
                            <tr key={index}>
                              <td>{item.name}</td>
                              <td>{item.quantity}</td>
                              <td>{formatCurrency(item.price, settings.currency)}</td>
                              <td>{formatCurrency(item.price * item.quantity, settings.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="details-section">
                      <h4>💰 {t('returns.refundSummary')}</h4>
                      <div className="summary-row">
                        <span>{t('returns.subtotal')}:</span>
                        <span>{formatCurrency(selectedReturn.subtotal, settings.currency)}</span>
                      </div>
                      <div className="summary-row">
                        <span>{t('returns.discount')}:</span>
                        <span className="discount-text">-{formatCurrency(selectedReturn.discount, settings.currency)}</span>
                      </div>
                      <div className="summary-row">
                        <span>{t('returns.tax')}:</span>
                        <span>{formatCurrency(selectedReturn.tax, settings.currency)}</span>
                      </div>
                      <div className="summary-row total-row">
                        <span>{t('returns.totalRefund')}:</span>
                        <span className="refund-amount">{formatCurrency(selectedReturn.refund, settings.currency)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-selection">
                    <p>📋 {t('returns.selectReturnRecord') || 'Select a return record to view details'}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-history">
              <p>📭 {t('returns.noReturnHistory') || 'No return history available'}</p>
            </div>
          )}
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

export default ProductReturn;
