// Add styles for client info block (theme compatible)
import './InvoiceHistory.css';
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllInvoices, updateInvoice, deleteInvoice as deleteInvoiceFromDB, clearAllInvoices } from '../../utils/database';
import Notification from '../../components/Notification/Notification';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';
import './InvoiceHistory.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateBarcodeDataUrl } from '../../utils/barcode';
import { renderDocHeader, renderInvoiceTemplate } from '../../utils/pdfTemplates/invoiceTemplate';

// Conditionally import ipcRenderer for Electron environment
let ipcRenderer = null;
try {
  const electron = window.require ? window.require('electron') : null;
  ipcRenderer = electron ? electron.ipcRenderer : null;
} catch (error) {
  console.warn('ipcRenderer not available:', error.message);
}

// Lazy-load pdf font utilities to enable dynamic chunking and reduce main bundle size
let pdfFontsModulePromise = null;
const getPdfFontsModule = () => {
  if (!pdfFontsModulePromise) pdfFontsModulePromise = import('../../utils/pdfFonts');
  return pdfFontsModulePromise;
};
// Safe synchronous fallbacks until the module is loaded
let setPdfFont = (doc, style = 'normal') => { try { doc.setFont(style === 'bold' ? 'helvetica' : 'helvetica'); } catch (e) {} };
let getAutoTableStyles = () => ({ font: 'helvetica' });
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

    const InvoiceHistory = () => {
      const { t, i18n } = useTranslation();
      const isRTL = i18n && ['ar','he','fa','ur'].includes(i18n.language);
      const { settings } = useSettings();
      
      // Document type filter options using translations
      const DOCUMENT_TYPE_OPTIONS = [
        { value: 'all', label: t('invoiceHistory.allTypes') },
        { value: 'facture', label: t('invoiceHistory.invoice') },
        { value: 'bon_commande', label: t('invoiceHistory.purchaseOrder') },
        { value: 'bon_livraison', label: t('invoiceHistory.deliveryNote') },
        { value: 'devis', label: t('invoiceHistory.quotation') },
        { value: 'proforma', label: t('invoiceHistory.proforma') },
        { value: 'garantie', label: t('invoiceHistory.warranty') },
        { value: 'ticket', label: t('invoiceHistory.ticket') },
      ];
                                                        const [confirmDialog, setConfirmDialog] = useState(null);
                                          const [notification, setNotification] = useState(null);
                            const [selectedInvoice, setSelectedInvoice] = useState(null);
              // State for invoices and filters
              const [invoices, setInvoices] = useState([]);
              const [filterDate, setFilterDate] = useState('all');
              const [docTypeFilter, setDocTypeFilter] = useState('all');
              const [debtFilter, setDebtFilter] = useState('all'); // all, has-debt, no-debt
              const [searchTerm, setSearchTerm] = useState('');
              const [startDate, setStartDate] = useState('');
              const [endDate, setEndDate] = useState('');
              const [showReceiptPreview, setShowReceiptPreview] = useState(false);
              const [receiptPreviewData, setReceiptPreviewData] = useState(null);
              const [showPdfPreview, setShowPdfPreview] = useState(false);
              const [pdfUrl, setPdfUrl] = useState(null);
              const [pdfName, setPdfName] = useState('');
              const [loading, setLoading] = useState(false);
              const [editingDebt, setEditingDebt] = useState(null); // { invoiceId, debt, paid }

              // Lazy-rendering / infinite scroll for invoice list
              const INITIAL_VISIBLE = 100;
              const BATCH_SIZE = 100;
              const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
              const listRef = useRef(null);

              // Helper function for notifications
              const showNotification = (message, type = 'info') => {
                setNotification({ message, type });
              };

  // Load invoices from DB (used on mount and after saves)
  const loadInvoices = async () => {
    try {
      const data = await getAllInvoices();
      console.log('DEBUG: loadInvoices() ->', data);
      if (Array.isArray(data)) setInvoices(data);
      else if (data && Array.isArray(data.data)) setInvoices(data.data);
      else setInvoices([]);
    } catch (err) {
      console.error('DEBUG: loadInvoices error', err);
      setInvoices([]);
    }
  };

  // Initial load
  useEffect(() => { loadInvoices(); }, []);

  // React to invoices saved elsewhere (SalesByInvoices) — reload and optionally select
  useEffect(() => {
    const onInvoiceSaved = async (ev) => {
      try {
        const detail = ev && ev.detail ? ev.detail : null;
        const data = await getAllInvoices();
        console.log('DEBUG: onInvoiceSaved -> detail=', detail, 'db=', data);
        if (Array.isArray(data)) setInvoices(data);
        else if (data && Array.isArray(data.data)) setInvoices(data.data);
        else setInvoices([]);

        if (detail) {
          const id = detail.id || detail.invoiceNumber || null;
          if (id) {
            const list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
            const found = list.find(inv => String(inv.id) === String(detail.id) || inv.invoiceNumber === detail.invoiceNumber || String(inv.invoiceNumber) === String(detail.invoiceNumber));
            if (found) setSelectedInvoice(found);
          }
        }
      } catch (e) {
        console.error('invoice-saved handler error', e);
      }
    };

    window.addEventListener('invoice-saved', onInvoiceSaved);
    return () => window.removeEventListener('invoice-saved', onInvoiceSaved);
  }, []);


              // Filtered invoices (search, type, date)
              // State for all filters and UI
              // ...existing code...
              const filteredInvoices = React.useMemo(() => {
                return invoices.filter(inv => {
                  // Filter by type
                  if (docTypeFilter !== 'all' && inv.type !== docTypeFilter) return false;
                  // Filter by debt status (only for tickets)
                  if (debtFilter !== 'all' && inv.type === 'ticket') {
                    const debt = inv.debt || 0;
                    if (debtFilter === 'has-debt' && debt <= 0) return false;
                    if (debtFilter === 'no-debt' && debt > 0) return false;
                  }
                  // Filter by search
                  if (searchTerm && !(
                    (inv.customerName && inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (inv.clientName && inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (inv.invoiceNumber && String(inv.invoiceNumber).includes(searchTerm)) ||
                    (inv.id && String(inv.id).includes(searchTerm))
                  )) return false;
                  // Filter by date
                  if (filterDate === 'today') {
                    const today = new Date();
                    const invDate = new Date(inv.date);
                    if (
                      invDate.getDate() !== today.getDate() ||
                      invDate.getMonth() !== today.getMonth() ||
                      invDate.getFullYear() !== today.getFullYear()
                    ) return false;
                  } else if (filterDate === 'week') {
                    const now = new Date();
                    const first = now.getDate() - now.getDay();
                    const last = first + 6;
                    const weekStart = new Date(now.setDate(first));
                    const weekEnd = new Date(now.setDate(last));
                    const invDate = new Date(inv.date);
                    if (invDate < weekStart || invDate > weekEnd) return false;
                  } else if (filterDate === 'month') {
                    const now = new Date();
                    const invDate = new Date(inv.date);
                    if (
                      invDate.getMonth() !== now.getMonth() ||
                      invDate.getFullYear() !== now.getFullYear()
                    ) return false;
                  } else if (filterDate === 'custom') {
                    if (startDate && new Date(inv.date) < new Date(startDate)) return false;
                    if (endDate && new Date(inv.date) > new Date(endDate)) return false;
                  }
                  return true;
                });
              }, [invoices, docTypeFilter, debtFilter, searchTerm, filterDate, startDate, endDate]);

  // Reset visibleCount when filtered list changes so we always show the first page
  React.useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    // If the list container exists, scroll to top so user sees newest items
    try { if (listRef?.current) listRef.current.scrollTop = 0; } catch(e){}
  }, [/* reset when filters/search change */ invoices, docTypeFilter, debtFilter, searchTerm, filterDate, startDate, endDate]);

  // Displayed slice used by the rendered list
  const displayedInvoices = React.useMemo(() => filteredInvoices.slice(0, visibleCount), [filteredInvoices, visibleCount]);

  // Scroll handler: when near bottom, increase visibleCount
  const handleListScroll = (e) => {
    const el = e.target;
    if (!el) return;
    const threshold = 160; // px from bottom
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredInvoices.length));
    }
  };

      const handleDebtUpdate = async (invoiceId, newPaid) => {
        try {
          console.log('Updating debt:', { invoiceId, newPaid });
          const invoice = invoices.find(inv => inv.id === invoiceId);
          if (!invoice) {
            console.error('Invoice not found:', invoiceId);
            return;
          }
          
          const newDebt = Math.max(0, invoice.total - newPaid);
          const newPaymentStatus = newDebt > 0 ? 'partial' : 'paid';
          
          console.log('Calling updateInvoice with:', { paid: newPaid, debt: newDebt, paymentStatus: newPaymentStatus });
          const result = await updateInvoice(invoiceId, {
            paid: newPaid,
            debt: newDebt,
            paymentStatus: newPaymentStatus
          });
          
          console.log('Update result:', result);
          
          if (result.success) {
            // Reload invoices
            const updatedInvoices = await getAllInvoices();
            let invoicesList = [];
            if (updatedInvoices.success) {
              invoicesList = updatedInvoices.data || [];
              setInvoices(invoicesList);
            } else if (Array.isArray(updatedInvoices)) {
              invoicesList = updatedInvoices;
              setInvoices(invoicesList);
            }
            
            // Update the selected invoice to show changes immediately
            const updatedSelectedInvoice = invoicesList.find(inv => inv.id === invoiceId);
            if (updatedSelectedInvoice) {
              setSelectedInvoice(updatedSelectedInvoice);
              console.log('Updated selected invoice:', updatedSelectedInvoice);
            }
            
            showNotification(t('invoiceHistory.debtUpdated') || 'Debt updated successfully!', 'success');
            setEditingDebt(null);
          } else {
            showNotification(t('invoiceHistory.debtUpdateFailed') || 'Failed to update debt', 'error');
          }
        } catch (error) {
          console.error('Error in handleDebtUpdate:', error);
          showNotification('Error: ' + error.message, 'error');
        }
      };

      const printInvoice = async (invoice) => {
        if (invoice.source === 'checkout') {
          setReceiptPreviewData(invoice);
          setShowReceiptPreview(true);
          return;
        }
        // --- PDF structure from SalesByInvoices ---
        const noir = [0, 0, 0];
        const beige = [245, 240, 230];
        const docType = invoice.type;
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
          setPdfFont(doc, 'normal');
        }
        // Ensure font is set for all text
        setPdfFont(doc, 'normal');

        // Mirror drawing/text coordinates and default alignment when RTL
        const _pageWidth = doc.internal.pageSize.getWidth();
        if (isRTL) {
          const _origText = doc.text.bind(doc);
          doc.text = function(text, x, y, options) {
            const opts = options || {};
            if (opts.align === 'center' || typeof x !== 'number') return _origText(text, x, y, opts);
            const mx = _pageWidth - x;
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
        
        // Standardized header
        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}-${month}-${year}`;
          }
          return dateStr;
        };
        let title = '';
        if (docType === 'facture') title = t('SalesByInvoices.invoice');
        else if (docType === 'bon_commande') title = t('SalesByInvoices.purchaseOrder');
        else if (docType === 'bon_livraison') title = t('SalesByInvoices.deliveryNote');
        else if (docType === 'devis') title = t('SalesByInvoices.quotation');
        else if (docType === 'proforma') title = t('SalesByInvoices.proforma');
        else if (docType === 'garantie') title = t('SalesByInvoices.garantie');
        else title = t('SalesByInvoices.document');

        renderDocHeader(doc, {
          title,
          docNumber: invoice.invoiceNumber || invoice.number || '',
          date: formatDate(invoice.date),
          company: invoice,
          logo: settings.posLogo || invoice.companyLogo || invoice.logo,
          isRTL,
          t
        });

        // Info: shop and client in bold with text wrapping
        doc.setFontSize(11);
        setPdfFont(doc, 'bold');
        
        let yPos = 48;
        // Wrap company name (only show when no logo to avoid duplication)
        if (!logo) {
          const companyName = `${t('SalesByInvoices.shop')}: ${invoice.companyName || settings.posName || ''}`;
          const companyNameLines = doc.splitTextToSize(companyName, 90);
          companyNameLines.forEach(line => {
            doc.text(line, 10, yPos);
            yPos += 6;
          });
        }
        
        // Wrap company address
        const companyAddr = `${t('SalesByInvoices.address')}: ${invoice.companyAddress || settings.shopAddress || ''}`;
        const companyAddrLines = doc.splitTextToSize(companyAddr, 90);
        companyAddrLines.forEach(line => {
          doc.text(line, 10, yPos);
          yPos += 6;
        });
        
        // Wrap company contact
        const companyContact = `${t('SalesByInvoices.contact')}: ${invoice.companyContact || settings.phone1 || settings.email || ''}`;
        const companyContactLines = doc.splitTextToSize(companyContact, 90);
        companyContactLines.forEach(line => {
          doc.text(line, 10, yPos);
          yPos += 6;
        });
        
        if (invoice.companyTaxId || settings.taxId) {
          doc.text(`${t('SalesByInvoices.taxId')}: ${invoice.companyTaxId || settings.taxId}`, 10, yPos);
          yPos += 6;
        }
        const _companyRC = invoice.companyRC || (settings && settings.rc) || '';
        const _companyAI = invoice.companyAI || (settings && settings.ai) || '';
        const _companyNIS = invoice.companyNIS || (settings && settings.nis) || '';
        if (_companyRC) { doc.text(`${t('settings.rcShort') || 'RC'}: ${_companyRC}`, 10, yPos); yPos += 6; }
        if (_companyAI) { doc.text(`${t('settings.aiShort') || 'AI'}: ${_companyAI}`, 10, yPos); yPos += 6; }
        if (_companyNIS) { doc.text(`${t('settings.nisShort') || 'NIS'}: ${_companyNIS}`, 10, yPos); yPos += 6; }
        if (invoice.paymentTerms) {
          const paymentTermsLines = doc.splitTextToSize(`${t('SalesByInvoices.paymentTerms')}: ${invoice.paymentTerms}`, 90);
          paymentTermsLines.forEach(line => {
            doc.text(line, 10, yPos);
            yPos += 6;
          });
        }

        // Client info on the right with text wrapping
        let clientYPos = 48;
        const clientLabel = `${t('SalesByInvoices.client')}: ${invoice.customerName || invoice.clientName || ''}`;
        const clientLabelLines = doc.splitTextToSize(clientLabel, 80);
        clientLabelLines.forEach(line => {
          doc.text(line, 120, clientYPos);
          clientYPos += 6;
        });
        
        if (invoice.clientAddress) {
          const clientAddrLines = doc.splitTextToSize(`${t('SalesByInvoices.address')}: ${invoice.clientAddress}`, 80);
          clientAddrLines.forEach(line => {
            doc.text(line, 120, clientYPos);
            clientYPos += 6;
          });
        }
        
        if (invoice.clientEmail) {
          const clientEmailLines = doc.splitTextToSize(`${t('SalesByInvoices.email')}: ${invoice.clientEmail}`, 80);
          clientEmailLines.forEach(line => {
            doc.text(line, 120, clientYPos);
            clientYPos += 6;
          });
        }
        
        if (invoice.clientPhone) {
          doc.text(`${t('SalesByInvoices.phone')}: ${invoice.clientPhone}`, 120, clientYPos);
          clientYPos += 6;
        }
        // client identifiers (show invoice-stored values if present)
        if (invoice.clientRC) { doc.text(`${t('settings.rcShort') || 'RC'}: ${invoice.clientRC}`, 120, clientYPos); clientYPos += 6; }
        if (invoice.clientAI) { doc.text(`${t('settings.aiShort') || 'AI'}: ${invoice.clientAI}`, 120, clientYPos); clientYPos += 6; }
        if (invoice.clientNIS) { doc.text(`${t('settings.nisShort') || 'NIS'}: ${invoice.clientNIS}`, 120, clientYPos); clientYPos += 6; }
        setPdfFont(doc, 'normal');

        // Calculate dynamic start position for table (after all text)
        const tableStartY = Math.max(yPos, clientYPos) + 10;

        // --- Document Type Specific Sections ---
        const items = invoice.items || [];
        const currency = settings.currency || '€';
        const subtotal = invoice.subtotal || 0;
        const discount = invoice.discount || 0;
        const tax = invoice.tax || 0;
        const total = invoice.total || 0;
        if (docType === 'devis') {
          renderInvoiceTemplate(doc, {
            items,
            company: invoice,
            client: { name: invoice.customerName || invoice.clientName || '', address: invoice.clientAddress || '' },
            title,
            docNumber: invoice.invoiceNumber || invoice.number || '',
            date: formatDate(invoice.date),
            totals: { subtotal, discount, tax, total },
            currency,
            t,
            isRTL,
            showPrices: true
          });
          const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
          doc.text(`${t('SalesByInvoices.validityDate')} : ${formatDate(invoice.date)}`, 15, finalY + 8);
          doc.text(t('SalesByInvoices.termsAndConditions') + ':', 15, finalY + 16);
          doc.text(t('SalesByInvoices.quotationNote'), 15, finalY + 24);
        } else if (docType === 'bon_commande') {
          renderInvoiceTemplate(doc, {
            items,
            company: invoice,
            client: { name: invoice.customerName || invoice.clientName || '', address: invoice.clientAddress || '' },
            title,
            docNumber: invoice.invoiceNumber || invoice.number || '',
            date: formatDate(invoice.date),
            totals: { subtotal, discount, tax, total },
            currency,
            t,
            isRTL,
            showPrices: true
          });
          const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
          if (invoice.linkedQuotation) doc.text(t('SalesByInvoices.linkedQuotation') + ': ' + invoice.linkedQuotation, 15, finalY + 8);
          doc.text(`${t('SalesByInvoices.orderDate')} : ${formatDate(invoice.date)}`, 15, finalY + 16);
          doc.text(`${t('SalesByInvoices.customerConfirmationStatus')} : ${t('SalesByInvoices.pending')}`, 15, finalY + 24);
          doc.text(t('SalesByInvoices.deliveryTerms') + ':', 15, finalY + 32);
          doc.text(t('SalesByInvoices.purchaseOrderNote'), 15, finalY + 40);
        } else if (docType === 'bon_livraison') {
          autoTable(doc, {
            startY: tableStartY,
            head: [[t('SalesByInvoices.description'), t('SalesByInvoices.quantity')]],
            body: items.map(item => [
              (item.productName && typeof item.productName === 'string' && item.productName.trim() !== '') ? item.productName : (item.name || '-'),
              `${item.quantity}${item.quantityType && item.quantityType !== 'unit' ? ' ' + item.quantityType : ''}`
            ]),
            headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
            bodyStyles: { halign: 'center' },
            columnStyles: {
              0: { cellWidth: 130, halign: isRTL ? 'right' : 'left' },
              1: { cellWidth: 40 }
            },
            styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles() }
          });
          const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
          if (invoice.linkedOrder) doc.text(t('SalesByInvoices.linkedPurchaseOrder') + ': ' + invoice.linkedOrder, 15, finalY);
          doc.text(`${t('SalesByInvoices.deliveryAddress')} : ${invoice.clientAddress}`, 15, finalY + 8);
          doc.text(`${t('SalesByInvoices.deliveryDate')} : ${formatDate(invoice.date)}`, 15, finalY + 16);
          doc.text(t('SalesByInvoices.customerSignature') + ':', 15, finalY + 24);
          doc.rect(15, finalY + 28, 60, 25);
          doc.text(t('SalesByInvoices.deliveryNoteInfo'), 15, finalY + 60);
        } else if (docType === 'facture') {
          renderInvoiceTemplate(doc, {
            items,
            company: invoice,
            client: { name: invoice.customerName || invoice.clientName || '', address: invoice.clientAddress || '' },
            title,
            docNumber: invoice.invoiceNumber || invoice.number || '',
            date: formatDate(invoice.date),
            totals: { subtotal, discount, tax, total },
            currency,
            t,
            isRTL,
            showPrices: true,
            paymentInfo: { paymentMethod: invoice.paymentMethod, dueDate: formatDate(invoice.date), paymentStatus: (settings.paymentStatusOptions && settings.paymentStatusOptions.find(opt => opt.value === invoice.paymentStatus)?.label) || invoice.paymentStatus }
          });
          const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
          if (invoice.linkedDelivery) doc.text(t('SalesByInvoices.linkedDeliveryNote') + ': ' + invoice.linkedDelivery, 15, finalY + 8);
          doc.text(t('SalesByInvoices.legalInfo'), 15, finalY + 16);
        } else if (docType === 'proforma') {
          renderInvoiceTemplate(doc, {
            items,
            company: invoice,
            client: { name: invoice.customerName || invoice.clientName || '', address: invoice.clientAddress || '' },
            title,
            docNumber: invoice.invoiceNumber || invoice.number || '',
            date: formatDate(invoice.date),
            totals: { subtotal, discount, tax, total },
            currency,
            t,
            isRTL,
            showPrices: true
          });
          const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : 100;
          doc.text(t('SalesByInvoices.proformainfo'), 15, finalY + 8);
        } else if (docType === 'garantie') {
          doc.setFontSize(12);
          doc.text(t('SalesByInvoices.productInformation'), 15, tableStartY);
          doc.setFontSize(10);
          let garantieYPos = tableStartY + 10;
          // Prefer product/serial from first item if available
          let productName = '';
          let serialNumber = '';
          if (Array.isArray(items) && items.length > 0) {
            productName = items[0].productName || items[0].name || '';
            serialNumber = items[0].serialNumber || items[0].serial || '';
          }
          if (!productName) productName = invoice.productName || '';
          if (!serialNumber) serialNumber = invoice.serialNumber || '';
          doc.text(t('SalesByInvoices.product') + ' :', 15, garantieYPos);
          // Wrap long product names
          const productNameLines = doc.splitTextToSize(productName, 130);
          productNameLines.forEach(line => {
            doc.text(line, 60, garantieYPos);
            garantieYPos += 6;
          });
          doc.text(t('SalesByInvoices.serialNumber') + ' :', 15, garantieYPos);
          doc.text(serialNumber, 60, garantieYPos);
          garantieYPos += 8;
          doc.text(t('SalesByInvoices.purchaseDate') + ' :', 15, garantieYPos);
          doc.text(formatDate(invoice.date) || '', 60, garantieYPos);
          garantieYPos += 8;
          doc.text(t('SalesByInvoices.warrantyDuration') + ' :', 15, garantieYPos);
          let durationStr = '';
          if (invoice.garantieDuration) durationStr = invoice.garantieDuration;
          doc.text(durationStr.trim(), 60, garantieYPos);
          garantieYPos += 8;
          doc.text(t('SalesByInvoices.warrantyEndDate') + ' :', 15, garantieYPos);
          doc.text(invoice.garantieEndDate || '', 60, garantieYPos);
          garantieYPos += 18;
          doc.setFontSize(11);
          doc.text(t('SalesByInvoices.warrantyConditions'), 15, garantieYPos);
          garantieYPos += 8;
          doc.setFontSize(9);
          const warrantyText = t('SalesByInvoices.warrantyText');
          const wrappedWarrantyText = doc.splitTextToSize(warrantyText, 180);
          doc.text(wrappedWarrantyText, 15, garantieYPos);
          garantieYPos += wrappedWarrantyText.length * 5 + 10;
          doc.setFontSize(10);
          doc.text(t('SalesByInvoices.signatureAndStamp') + ' :', 15, garantieYPos);
          garantieYPos += 5;
          doc.rect(15, garantieYPos, 60, 25);
          doc.text(t('SalesByInvoices.clientSignature') + ' :', 130, garantieYPos - 5);
          doc.rect(130, garantieYPos, 60, 25);
          doc.setFontSize(9);
          // ensure thank-you sits above barcode to prevent overlap
          const _pageHeight = doc.internal.pageSize.getHeight();
          const _barcodeH = 12; // mm
          const _marginBottom = 14; // mm
          const _barcodeTopY = _pageHeight - _marginBottom - _barcodeH;
          const _defaultThankYouY = 285;
          const thankYouY = Math.min(_defaultThankYouY, _barcodeTopY - 6);
          const _pageWidthCenter = doc.internal.pageSize.getWidth();
          doc.text((invoice.companyName || 'POS') + ' – ' + t('SalesByInvoices.thankYou'), _pageWidthCenter / 2, thankYouY, { align: 'center' });
        } else {
          autoTable(doc, {
            startY: tableStartY,
            head: [[t('SalesByInvoices.description'), t('SalesByInvoices.price'), t('SalesByInvoices.quantity'), t('SalesByInvoices.total')]],
            body: items.map(item => [item.name || item.productName || '-', item.price, `${item.quantity}${item.quantityType && item.quantityType !== 'unit' ? ' ' + item.quantityType : ''}`, `${(item.price * item.quantity).toFixed(2)} ${currency}`]),
            headStyles: { fillColor: noir, textColor: 255, halign: 'center' },
            bodyStyles: { halign: 'center' },
            columnStyles: {
              0: { cellWidth: 80, halign: isRTL ? 'right' : 'left' },
              1: { cellWidth: 35 },
              2: { cellWidth: 30 },
              3: { cellWidth: 35 }
            },
            styles: { fontSize: 10, overflow: 'linebreak', cellPadding: 2, ...getAutoTableStyles() }
          });
        }
        // Add small barcode at bottom center
        try {
          const idForBarcode = invoice.invoiceNumber || invoice.number || invoice.id || '';
          const barcodeDataUrl = generateBarcodeDataUrl(idForBarcode);
          if (barcodeDataUrl) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const barcodeW = 50; // mm
            const barcodeH = 12; // mm
            const marginBottom = 14; // mm
            const x = (pageWidth - barcodeW) / 2;
            const y = pageHeight - marginBottom - barcodeH;
            if (typeof doc.lastAutoTable !== 'undefined') {
              const contentEnd = doc.lastAutoTable.finalY || 0;
              if (contentEnd + 10 + barcodeH > y) {
                doc.addPage();
              }
            }
            doc.addImage(barcodeDataUrl, 'PNG', x, pageHeight - marginBottom - barcodeH, barcodeW, barcodeH, undefined, 'FAST');
          }
        } catch (e) {}

        // Aperçu PDF
        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
        setPdfName(`${invoice.type || 'facture'}_${invoice.customerName || invoice.clientName || 'document'}.pdf`);
        setShowPdfPreview(true);
      };

      // ...rest of the component code...

  // Modals will be rendered inside the return statement below
  const clearHistory = () => {
    setConfirmDialog({
      message: t('invoiceHistory.clearConfirm'),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const result = await clearAllInvoices();
          if (result.success) {
            setInvoices([]);
            setSelectedInvoice(null);
            setNotification({ message: t('invoiceHistory.clearSuccess') || 'History cleared successfully', type: 'success' });
          } else {
            setNotification({ message: result.error || 'Failed to clear history', type: 'error' });
          }
        } catch (error) {
          setNotification({ message: error.message || 'Failed to clear history', type: 'error' });
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };



  const deleteInvoice = (id) => {
    setConfirmDialog({
      message: t('invoiceHistory.deleteConfirm'),
      onConfirm: async () => {
        try {
          const result = await deleteInvoiceFromDB(id);
          if (result.success) {
            if (selectedInvoice?.id === id) {
              setSelectedInvoice(null);
            }
            await loadInvoices();
            setConfirmDialog(null);
            showNotification(t('invoiceHistory.deleteSuccess'), 'success');
          } else {
            setConfirmDialog(null);
            showNotification(t('invoiceHistory.deleteFailed') + ': ' + result.error, 'error');
          }
        } catch (error) {
          setConfirmDialog(null);
          showNotification(t('invoiceHistory.deleteError') + ': ' + error.message, 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // (Removed duplicate declarations)

  // Aperçu PDF comme SalesByInvoices
  // ...existing code...

  // Modals will be rendered inside the return statement below

  // Compute receipt preview totals with fallbacks to avoid inline complex expressions in JSX
  const rp = receiptPreviewData || {};
  const rpSubtotal = rp.subtotal ?? (rp.items ? rp.items.reduce((s, i) => s + (parseFloat(i.price || 0) * parseFloat(i.quantity || 0)), 0) : 0);
  const rpDiscount = rp.discount ?? (rpSubtotal * (settings.discountRate / 100));
  const rpTax = rp.tax ?? ((rpSubtotal - rpDiscount) * (settings.taxRate / 100));
  const rpTotal = rp.total ?? (rpSubtotal - rpDiscount + rpTax);

  return (
    <div className="invoice-history-page">
      {/* Receipt Preview Modal for checkout receipts */}
      {showReceiptPreview && receiptPreviewData && (
        <div className="modal-overlay" onClick={() => setShowReceiptPreview(false)}>
          <div className="modal-content receipt-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="receipt-preview-header">
              <h2>📄 {t('checkout.receiptPreview') || 'Receipt Preview'}</h2>
              <button className="close-btn" onClick={() => setShowReceiptPreview(false)}>✕</button>
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
                  <p className="receipt-date">{receiptPreviewData.date}</p>
                  <p className="receipt-invoice">{t('checkout.invoice') || 'Invoice'}: {receiptPreviewData.invoiceNumber || receiptPreviewData.id}</p>
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
                      {receiptPreviewData.items.map((item, index) => {
                        const unitType = item.quantityType || 'unit';
                        return (
                          <tr key={index}>
                            <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '150px' }}>{item.name || item.productName}</td>
                            <td>{item.quantity}{unitType && unitType !== 'unit' ? ' ' + unitType : ''}</td>
                            <td>{formatCurrency(item.price, settings.currency)}</td>
                            <td>{formatCurrency(item.price * item.quantity, settings.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Totals */}
                <div className="receipt-totals">
                  <div className="receipt-row">
                    <span>{t('checkout.subtotal') || 'Subtotal'}:</span>
                    <span>{formatCurrency(rpSubtotal, settings.currency)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>{t('checkout.discount') || 'Discount'} ({settings.discountRate}%):</span>
                    <span>-{formatCurrency(rpDiscount, settings.currency)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>{t('checkout.tax') || 'Tax'} ({settings.taxRate}%):</span>
                    <span>{formatCurrency(rpTax, settings.currency)}</span>
                  </div>
                  <div className="receipt-row total">
                    <span>{t('checkout.total') || 'Total'}:</span>
                    <span>{formatCurrency(rpTotal, settings.currency)}</span>
                  </div>
                  {Number(rp.debt) > 0 && (
                    <div className="receipt-row">
                      <span>{t('checkout.remainingDebt') || 'Remaining Debt'}:</span>
                      <span style={{ color: '#d6336c', fontWeight: '700' }}>{formatCurrency(Number(rp.debt), settings.currency)}</span>
                    </div>
                  )}
                </div>
                {/* Payment Method */}
                <div className="receipt-payment">
                  <p>{t('checkout.paymentMethod') || 'Payment Method'}: <strong>{(receiptPreviewData.paymentMethod || '').toUpperCase()}</strong></p>
                  {/* Barcode after payment method */}
                  {receiptPreviewData && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <img src={generateBarcodeDataUrl(receiptPreviewData.invoiceNumber || receiptPreviewData.id || receiptPreviewData.number)} alt="Barcode" style={{ maxWidth: 160 }} />
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
              <button className="cancel-btn" onClick={() => setShowReceiptPreview(false)}>
                {t('common.close') || 'Close'}
              </button>
              <button className="confirm-btn" onClick={() => {
                if (ipcRenderer && receiptPreviewData) {
                  const payload = {
                    items: receiptPreviewData.items,
                    subtotal: receiptPreviewData.subtotal,
                    tax: receiptPreviewData.tax,
                    discount: receiptPreviewData.discount,
                    total: receiptPreviewData.total,
                    date: receiptPreviewData.date,
                    debt: receiptPreviewData.debt || 0,
                    paid: receiptPreviewData.paid || 0,
                    paymentStatus: receiptPreviewData.paymentStatus || (receiptPreviewData.debt && receiptPreviewData.debt > 0 ? 'partial' : 'paid'),
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
              }}>
                🖨️ {t('checkout.printReceipt') || 'Print Receipt'}
              </button>
            </div>
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
                download={pdfName}
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
      <div className="page-header">
        <h1 className="page-title">{t('invoiceHistory.title')}</h1>
        {/* Document type/category filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <select
            value={docTypeFilter}
            onChange={e => setDocTypeFilter(e.target.value)}
            className="doc-type-select"
            style={{ 
              padding: '8px 16px', 
              borderRadius: 8, 
              border: '2px solid var(--primary-color, #ff6b35)', 
              fontSize: 15,
              fontWeight: 500,
              background: 'var(--card-bg)',
              color: 'var(--text-color)',
              cursor: 'pointer',
              minWidth: 180,
              outline: 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {DOCUMENT_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* Debt filter - only show when ticket filter is active */}
          {(docTypeFilter === 'all' || docTypeFilter === 'ticket') && (
            <select
              value={debtFilter}
              onChange={e => setDebtFilter(e.target.value)}
              className="debt-filter-select"
              style={{ 
                padding: '8px 16px', 
                borderRadius: 8, 
                border: '2px solid var(--primary-color, #ff6b35)', 
                fontSize: 15,
                fontWeight: 500,
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                cursor: 'pointer',
                minWidth: 150,
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
            >
              <option value="all">{t('invoiceHistory.allDebts')}</option>
              <option value="has-debt">{t('invoiceHistory.hasDebt')}</option>
              <option value="no-debt">{t('invoiceHistory.noDebt')}</option>
            </select>
          )}
          <button className="clear-btn danger-btn" onClick={clearHistory}>
            🗑️ {t('invoiceHistory.clearHistory')}
          </button>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder={t('invoiceHistory.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <div className="date-filter">
          <button 
            className={`filter-btn ${filterDate === 'all' ? 'active' : ''}`}
            onClick={() => setFilterDate('all')}
          >
            {t('invoiceHistory.all')}
          </button>
          <button 
            className={`filter-btn ${filterDate === 'today' ? 'active' : ''}`}
            onClick={() => setFilterDate('today')}
          >
            {t('invoiceHistory.today')}
          </button>
          <button 
            className={`filter-btn ${filterDate === 'week' ? 'active' : ''}`}
            onClick={() => setFilterDate('week')}
          >
            {t('invoiceHistory.thisWeek')}
          </button>
          <button 
            className={`filter-btn ${filterDate === 'month' ? 'active' : ''}`}
            onClick={() => setFilterDate('month')}
          >
            {t('invoiceHistory.thisMonth')}
          </button>
          <button 
            className={`filter-btn ${filterDate === 'custom' ? 'active' : ''}`}
            onClick={() => setFilterDate('custom')}
          >
            📅 {t('invoiceHistory.custom')}
          </button>
        </div>
      </div>

      {filterDate === 'custom' && (
        <div className="date-range-picker">
          <div className="date-input-group">
            <label>{t('invoiceHistory.from')}:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="date-input-group">
            <label>{t('invoiceHistory.to')}:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-input"
            />
          </div>
          <button 
            className="clear-dates-btn"
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
          >
            {t('invoiceHistory.clearDates')}
          </button>
        </div>
      )}

      <div className="stats-summary">
        <div className="stat-box">
          <span className="stat-label">{t('invoiceHistory.totalInvoices')}</span>
          <span className="stat-value">{filteredInvoices.length}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">{t('invoiceHistory.totalRevenue') || 'Revenu caisse'}</span>
          <span className="stat-value">
            {formatCurrency(
              filteredInvoices
                .filter(inv => inv.type === 'ticket')
                .reduce((sum, inv) => sum + (inv.total || 0), 0),
              settings.currency
            )}
          </span>
        </div>
      </div>

      <div className="invoice-content">
        {/* Invoice List */}
        <div className="invoice-list" ref={listRef} onScroll={handleListScroll}>
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <p>📄 {t('invoiceHistory.noInvoices')}</p>
            </div>
          ) : (
            displayedInvoices.map((invoice) => {
              const debt = invoice.debt || 0;
              const paid = invoice.paid || 0;
              return (
              <div 
                key={invoice.id} 
                className={`invoice-item ${selectedInvoice?.id === invoice.id ? 'selected' : ''}`}
                onClick={() => setSelectedInvoice(invoice)}
              >
                <div className="invoice-item-header">
                  <span className="invoice-id">{t('invoiceHistory.invoice')} #{invoice.id}</span>
                  <span className="invoice-total">{formatCurrency(invoice.total, settings.currency)}</span>
                </div>
                <div className="invoice-item-details">
                  <span className="invoice-date">📅 {formatDate(invoice.date)}</span>
                  <span className="invoice-time">🕐 {formatTime(invoice.date)}</span>
                  <span className="invoice-items">📦 {(invoice.items ? invoice.items.length : 0)} {t('invoiceHistory.items')}</span>
                  { (invoice.customerName || invoice.clientName) && (
                    <span className="invoice-customer">👤 {invoice.customerName || invoice.clientName}</span>
                  ) }
                </div>
                {/* Show debt info for tickets */}
                {invoice.type === 'ticket' && debt > 0 && (
                  <div className="invoice-debt-info" style={{ 
                    marginTop: '8px', 
                    padding: '6px 10px', 
                    background: '#ff6b6b20', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#ff6b6b',
                    fontWeight: 'bold'
                  }}>
                    💳 {t('invoiceHistory.debt')}: {formatCurrency(debt, settings.currency)}
                  </div>
                )}
              </div>
              );
            })
          )}

          {/* Load indicator / counts */}
          {filteredInvoices.length > 0 && (
            <div className="load-more-indicator">
              {displayedInvoices.length < filteredInvoices.length
                ? `${t('invoiceHistory.showing') || 'Showing'} ${displayedInvoices.length} / ${filteredInvoices.length}...`
                : `${t('invoiceHistory.showingAll') || 'Showing all'} ${filteredInvoices.length}`}
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="invoice-details">

          {selectedInvoice ? (
            <>
              <div className="details-header">
                <h2>{t('invoiceHistory.invoice')} #{selectedInvoice.id}</h2>
                <div className="details-actions">
                  <button
                    className="action-btn print-btn"
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Show receipt preview for tickets, PDF for documents
                      if (selectedInvoice.type === 'ticket') {
                        setReceiptPreviewData(selectedInvoice);
                        setShowReceiptPreview(true);
                      } else {
                        printInvoice(selectedInvoice);
                      }
                    }}
                  >
                    🖨️ {t('invoiceHistory.print')}
                  </button>
                  <button className="action-btn delete-btn" onClick={() => deleteInvoice(selectedInvoice.id)}>
                    🗑️ {t('invoiceHistory.delete')}
                  </button>
                </div>
              </div>

              {/* Show warning if client or SalesByInvoices info is missing */}

              {/* Date & Time */}
              <div className="details-info" style={{ marginTop: 8 }}>
                <div className="info-row">
                  <span className="info-label">{t('invoiceHistory.date')}:</span>
                  <span className="info-value">{formatDate(selectedInvoice.date)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{t('invoiceHistory.time')}:</span>
                  <span className="info-value">{formatTime(selectedInvoice.date)}</span>
                </div>
              </div>

              {/* Infos client ajoutées ici */}

              {/* Document Info Block: show all available info for each document type, grouped and labeled, like SalesByInvoices */}

              {/* Render full document content for each type, matching SalesByInvoices */}
              {(() => {
                const docType = selectedInvoice.type || '';
                const renderField = (label, value) => value ? (
                  <div className="client-info-row"><span className="client-info-label">{label}:</span><span className="client-info-value">{value}</span></div>
                ) : null;
                // Table for items (used in most types)
                const renderItemsTable = (showPrice = true) => (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>{t('SalesByInvoices.description')}</th>
                        <th>{t('SalesByInvoices.quantity')}</th>
                        {showPrice && <th>{t('SalesByInvoices.price')}</th>}
                        {showPrice && <th>{t('SalesByInvoices.total')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items && selectedInvoice.items.map((item, idx) => {
                        let productLabel = '-';
                        if (item.productName && typeof item.productName === 'string' && item.productName.trim() !== '') {
                          productLabel = item.productName;
                        } else if (item.name && typeof item.name === 'string' && item.name.trim() !== '') {
                          productLabel = item.name;
                        }
                        const unitType = item.quantityType || 'unit';
                        return (
                          <tr key={idx}>
                            <td>{productLabel}</td>
                            <td>{item.quantity}{unitType && unitType !== 'unit' ? ' ' + unitType : ''}</td>
                            {showPrice && <td>{formatCurrency(item.price, settings.currency)}</td>}
                            {showPrice && <td>{formatCurrency(item.price * item.quantity, settings.currency)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
                // Totals block
                const renderTotals = (showTax = true, showDiscount = true) => {
                  const debt = selectedInvoice.debt || 0;
                  const paid = selectedInvoice.paid || 0;
                  
                  return (
                  <div className="details-totals">
                    <div className="total-row">
                      <span>{t('invoiceHistory.subtotal')}:</span>
                      <span>{formatCurrency(selectedInvoice.subtotal, settings.currency)}</span>
                    </div>
                    {showDiscount && (
                      <div className="total-row discount-row">
                        <span>{t('invoiceHistory.discount')} ({settings.discountRate}%):</span>
                        <span>-{formatCurrency(selectedInvoice.discount, settings.currency)}</span>
                      </div>
                    )}
                    {showTax && (
                      <div className="total-row">
                        <span>{t('invoiceHistory.tax')}:</span>
                        <span>{formatCurrency(selectedInvoice.tax, settings.currency)}</span>
                      </div>
                    )}
                    <div className="total-row grand-total-row">
                      <span>{t('invoiceHistory.total')}:</span>
                      <span>{formatCurrency(selectedInvoice.total, settings.currency)}</span>
                    </div>
                    {/* Debt information - available for all invoice types */}
                    <div className="total-row" style={{ marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                          <span>{t('invoiceHistory.paid')}:</span>
                          {editingDebt?.invoiceId === selectedInvoice.id ? (
                            <input
                              type="number"
                              value={editingDebt.paid}
                              onChange={(e) => setEditingDebt({...editingDebt, paid: parseFloat(e.target.value) || 0})}
                              style={{ 
                                width: '120px', 
                                padding: '5px 10px', 
                                fontSize: '14px', 
                                borderRadius: '6px', 
                                border: '2px solid var(--primary-color)',
                                background: 'var(--input-bg, #fff)',
                                color: 'var(--text-color, #000)',
                                textAlign: 'right'
                              }}
                              step="0.01"
                              min="0"
                              max={selectedInvoice.total}
                              autoFocus
                            />
                          ) : (
                            <span style={{ color: '#51cf66', fontWeight: 'bold' }}>
                              {formatCurrency(paid, settings.currency)}
                            </span>
                          )}
                        </div>
                        <div className="total-row" style={{ color: debt > 0 ? '#ff6b6b' : '#51cf66', fontWeight: 'bold' }}>
                          <span>{t('invoiceHistory.remainingDebt')}:</span>
                          <span>
                            {formatCurrency(
                              editingDebt?.invoiceId === selectedInvoice.id 
                                ? Math.max(0, selectedInvoice.total - editingDebt.paid)
                                : debt, 
                              settings.currency
                            )}
                          </span>
                        </div>
                        {/* Edit/Save buttons */}
                        <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                          {editingDebt?.invoiceId === selectedInvoice.id ? (
                            <>
                              <button
                                className="confirm-btn"
                                style={{ flex: 1, padding: '8px' }}
                                onClick={() => {
                                  console.log('Save button clicked', { invoiceId: selectedInvoice.id, paid: editingDebt.paid });
                                  handleDebtUpdate(selectedInvoice.id, editingDebt.paid);
                                }}
                              >
                                💾 {t('common.save')}
                              </button>
                              <button
                                className="cancel-btn"
                                style={{ flex: 1, padding: '8px' }}
                                onClick={() => setEditingDebt(null)}
                              >
                                ✕ {t('common.cancel')}
                              </button>
                            </>
                          ) : (
                            <button
                              className="action-btn"
                              style={{ 
                                width: '100%', 
                                padding: '10px 8px', 
                                background: 'var(--primary-color, #ff6b35)', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => {
                                console.log('Edit Payment button clicked', { invoiceId: selectedInvoice.id, paid, debt });
                                setEditingDebt({ invoiceId: selectedInvoice.id, paid, debt });
                              }}
                              onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.target.style.opacity = '1'}
                            >
                              ✏️ {t('invoiceHistory.editPayment')}
                            </button>
                          )}
                        </div>
                        {/* Quick payment buttons */}
                        {!editingDebt && debt > 0 && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                            <button
                              className="confirm-btn"
                              style={{ 
                                flex: 1, 
                                padding: '10px 8px', 
                                fontSize: '14px',
                                fontWeight: 'bold',
                                background: '#51cf66',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => {
                                console.log('Mark as Paid button clicked', { invoiceId: selectedInvoice.id, total: selectedInvoice.total });
                                handleDebtUpdate(selectedInvoice.id, selectedInvoice.total);
                              }}
                              onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.target.style.opacity = '1'}
                            >
                              ✅ {t('invoiceHistory.markAsPaid')}
                            </button>
                          </div>
                        )}
                  </div>
                  );
                };
                // --- Facture ---
                if (docType === 'facture') {
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('SalesByInvoices.invoice')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.clientRC)}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.clientAI)}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.clientNIS)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                          {renderField(t('SalesByInvoices.taxId'), selectedInvoice.companyTaxId)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.companyRC || (settings && settings.rc))}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.companyAI || (settings && settings.ai))}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.companyNIS || (settings && settings.nis))}
                          {renderField(t('SalesByInvoices.paymentTerms'), selectedInvoice.paymentTerms)}
                          {renderField(t('SalesByInvoices.paymentStatus'), selectedInvoice.paymentStatus ? t('SalesByInvoices.' + selectedInvoice.paymentStatus) : '')}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(true)}
                      </div>
                      {renderTotals(true, true)}
                    </>
                  );
                }
                // --- Devis ---
                if (docType === 'devis') {
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('SalesByInvoices.quotation')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.clientRC)}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.clientAI)}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.clientNIS)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                          {renderField(t('SalesByInvoices.taxId'), selectedInvoice.companyTaxId)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.companyRC || (settings && settings.rc))}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.companyAI || (settings && settings.ai))}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.companyNIS || (settings && settings.nis))}
                          {renderField(t('SalesByInvoices.paymentTerms'), selectedInvoice.paymentTerms)}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(true)}
                      </div>
                      {renderTotals(true, true)}
                    </>
                  );
                }
                // --- Bon de commande ---
                if (docType === 'bon_commande') {
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('SalesByInvoices.purchaseOrder')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.clientRC)}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.clientAI)}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.clientNIS)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                          {renderField(t('SalesByInvoices.taxId'), selectedInvoice.companyTaxId)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.companyRC || (settings && settings.rc))}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.companyAI || (settings && settings.ai))}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.companyNIS || (settings && settings.nis))}
                          {renderField(t('SalesByInvoices.paymentTerms'), selectedInvoice.paymentTerms)}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(true)}
                      </div>
                      {renderTotals(true, true)}
                    </>
                  );
                }
                // --- Bon de livraison ---
                if (docType === 'bon_livraison') {
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('SalesByInvoices.deliveryNote')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.clientRC)}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.clientAI)}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.clientNIS)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                          {renderField(t('SalesByInvoices.taxId'), selectedInvoice.companyTaxId)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.companyRC || (settings && settings.rc))}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.companyAI || (settings && settings.ai))}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.companyNIS || (settings && settings.nis))}
                          {renderField(t('SalesByInvoices.paymentTerms'), selectedInvoice.paymentTerms)}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(true)}
                      </div>
                      {renderTotals(true, true)}
                    </>
                  );
                }
                // --- Proforma ---
                if (docType === 'proforma') {
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('SalesByInvoices.proforma')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.clientRC)}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.clientAI)}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.clientNIS)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                          {renderField(t('SalesByInvoices.taxId'), selectedInvoice.companyTaxId)}
                          {renderField(t('SalesByInvoices.rc') || 'RC', selectedInvoice.companyRC || (settings && settings.rc))}
                          {renderField(t('SalesByInvoices.ai') || 'AI', selectedInvoice.companyAI || (settings && settings.ai))}
                          {renderField(t('SalesByInvoices.nis') || 'NIS', selectedInvoice.companyNIS || (settings && settings.nis))}
                          {renderField(t('SalesByInvoices.paymentTerms'), selectedInvoice.paymentTerms)}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(true)}
                      </div>
                      {renderTotals(true, true)}
                    </>
                  );
                }
                // --- Garantie ---
                if (docType === 'garantie') {
                  // Debug: show all item fields for diagnosis
                  let serialNumber = '';
                  let productName = '';
                  let debugItemJson = '';
                  if (selectedInvoice.items && selectedInvoice.items.length > 0) {
                    const item = selectedInvoice.items[0];
                    serialNumber = item.serialNumber || item.serial || '';
                    productName = item.productName || item.name || '';
                    debugItemJson = JSON.stringify(item, null, 2);
                  }
                  if (!serialNumber) serialNumber = selectedInvoice.serialNumber || '';
                  if (!productName) productName = selectedInvoice.productName || '';
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('SalesByInvoices.garantie')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                          {renderField(t('SalesByInvoices.taxId'), selectedInvoice.companyTaxId)}
                          {renderField(t('SalesByInvoices.paymentTerms'), selectedInvoice.paymentTerms)}
                          {renderField(t('SalesByInvoices.product'), productName)}
                          {renderField(t('SalesByInvoices.serialNumber'), serialNumber)}
                          {renderField(t('SalesByInvoices.warrantyDuration'), selectedInvoice.garantieDuration ? `${selectedInvoice.garantieDuration.years || 0}y ${selectedInvoice.garantieDuration.months || 0}m ${selectedInvoice.garantieDuration.days || 0}d` : '')}
                          {renderField(t('SalesByInvoices.warrantyEndDate'), selectedInvoice.garantieEndDate)}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(false)}
                      </div>
                      {renderTotals(false, false)}
                    </>
                  );
                }
                // --- Ticket ---
                if (docType === 'ticket') {
                  return (
                    <>
                      <div className="client-info-block invoice-client-info-block">
                        <h3 className="client-info-title">{t('invoiceHistory.ticket')}</h3>
                        <div className="client-info-list">
                          {renderField(t('SalesByInvoices.clientName'), selectedInvoice.customerName || selectedInvoice.clientName)}
                          {renderField(t('SalesByInvoices.clientAddress'), selectedInvoice.clientAddress)}
                          {renderField(t('SalesByInvoices.clientEmail'), selectedInvoice.clientEmail)}
                          {renderField(t('SalesByInvoices.clientPhone'), selectedInvoice.clientPhone)}
                          {renderField(t('SalesByInvoices.date'), selectedInvoice.date && formatDate(selectedInvoice.date))}
                        </div>
                      </div>
                      <div className="details-items">
                        <h3>{t('invoiceHistory.items')}</h3>
                        {renderItemsTable(false)}
                      </div>
                      {renderTotals(false, false)}
                    </>
                  );
                }
                return null;
              })()}

              {/* Items are rendered inside the document-specific sections above to avoid duplicates */}

              {/* Totals are shown inside each document type section (removed duplicate totals here) */}
            </>
          ) : (
            <div className="no-selection">
              <p>📋 {t('invoiceHistory.selectInvoice')}</p>
            </div>
          )}
        </div>
      </div>
      
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


export default InvoiceHistory;

