import { formatCurrency } from '../currency';

// Small utility to format money like "1 234,56 €"
function fmt(amount, currency = '€') {
  return formatCurrency(amount, currency);
}

export function renderDocHeader(doc, { title = 'FACTURE', docNumber = '', date = '', company = {}, logo = null, isRTL = false, t = (s) => s }) {
  const noir = [0, 0, 0];
  const beige = [245, 240, 230];

  // background stripe
  doc.setFillColor(...beige);
  doc.rect(0, 0, 210, 38, 'F');

  // logo (if provided)
  if (logo) {
    try {
      const maxDim = 48;
      doc.addImage(logo, 'PNG', 10, 6, maxDim, maxDim, undefined, 'FAST');
    } catch (e) { /* ignore */ }
  }

  // Title (right side)
  doc.setFontSize(20);
  doc.setTextColor(...noir);
  doc.text((title || t('SalesByInvoices.invoice')).toUpperCase(), 120, 20, { align: isRTL ? 'right' : 'left' });

  // meta: number / date
  doc.setFontSize(9);
  doc.text(`${t('SalesByInvoices.documentNo') || 'Document N°'}: ${docNumber || ''}`, 120, 28, { align: isRTL ? 'right' : 'left' });
  if (date) doc.text(`${t('Date') || 'Date'}: ${date}`, 14, 33);
}

export function renderInvoiceTemplate(doc, {
  items = [],
  company = {},
  client = {},
  title = 'FACTURE',
  docNumber = '',
  date = '',
  totals = { subtotal: 0, discount: 0, tax: 0, total: 0 },
  currency = '€',
  t = (s) => s,
  isRTL = false,
  showPrices = true,
  paymentInfo = {}
}) {
  // start Y after company/client blocks (caller should compute tableStartY and pass it if desired)
  const tableStartY = Math.max(80, 100);

  // Items table (spreadsheet-style)
  doc.autoTable({
    startY: tableStartY,
    head: [[showPrices ? 'DÉSIGNATION' : 'DÉSIGNATION', 'QUANTITÉ', ...(showPrices ? ['PRIX UNIT. (' + currency + ')', 'TOTAL (' + currency + ')'] : [])]],
    body: items.map(it => {
      const name = (it.productName || it.name || '-');
      const qty = (it.quantity || it.qty || 0) + (it.quantityType && it.quantityType !== 'unit' ? ` ${it.quantityType}` : '');
      if (!showPrices) return [name, qty];
      const price = (it.price != null) ? fmt(Number(it.price), currency) : fmt(0, currency);
      const total = (it.price != null && it.quantity != null) ? fmt(Number(it.price) * Number(it.quantity), currency) : fmt(0, currency);
      return [name, qty, price, total];
    }),
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3, lineColor: 220 },
    headStyles: { fillColor: [245,245,245], textColor: 0, fontStyle: 'bold' },
    columnStyles: showPrices ? { 0: { halign: isRTL ? 'right' : 'left', cellWidth: 95 }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } } : { 0: { halign: isRTL ? 'right' : 'left', cellWidth: 125 }, 1: { halign: 'center', cellWidth: 60 } },
    alternateRowStyles: { fillColor: [250,250,250] },
    styles: { overflow: 'linebreak' }
  });

  const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 8 : 120;

  // Totals box (only for documents with prices)
  if (showPrices) {
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.rect(110, finalY - 6, 90, 36);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text((t('SalesByInvoices.subtotal') || 'Sous-total'), 120, finalY + 2);
    doc.text(fmt(totals.subtotal || 0, currency), 195, finalY + 2, { align: 'right' });

    doc.text((t('SalesByInvoices.discount') || 'Remise'), 120, finalY + 10);
    doc.text(fmt(totals.discount || 0, currency), 195, finalY + 10, { align: 'right' });

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text((t('SalesByInvoices.total') || 'Total TTC'), 120, finalY + 24);
    doc.text(fmt(totals.total || 0, currency), 195, finalY + 24, { align: 'right' });
    doc.setFont(undefined, 'normal');
  }

  // Payment / legal block under totals
  let infoY = finalY + (showPrices ? 46 : 12);
  doc.setFontSize(9);
  if (paymentInfo && paymentInfo.paymentMethod) doc.text((t('SalesByInvoices.paymentMethod') || 'Moyen de paiement') + ' : ' + paymentInfo.paymentMethod, 15, infoY);
  if (paymentInfo && paymentInfo.dueDate) doc.text((t('SalesByInvoices.dueDate') || 'Échéance') + ' : ' + (paymentInfo.dueDate), 15, infoY + 8);
  if (paymentInfo && paymentInfo.paymentStatus) doc.text((t('SalesByInvoices.paymentStatus') || 'Statut paiement') + ' : ' + paymentInfo.paymentStatus, 15, infoY + 16);

  // Footer legal identifiers centered at the bottom
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  const footerText = `${company.companyName || '[NOM DE L\'ENTREPRISE]'} — SIRET : ${company.companyTaxId || '[SIRET]'} — TVA intracom. : ${company.companyNIS || '[FR...]'}`;
  doc.text(footerText, 15, pageHeight - 10);

  return finalY;
}
