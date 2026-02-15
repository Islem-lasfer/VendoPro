const { jsPDF } = window.jspdf;

function generateFacture() {
  const doc = new jsPDF();

  /* ====== COULEURS ====== */
  const beige = [245, 240, 230];
  const noir = [0, 0, 0];

  /* ====== HEADER ====== */
  doc.setFillColor(...beige);
  doc.rect(0, 0, 210, 35, "F");

  doc.setFontSize(20);
  doc.setTextColor(...noir);
  doc.text("FACTURE", 15, 22);

  doc.setFontSize(10);
  doc.text("Facture N° : INV-2025-001", 150, 15);
  doc.text("Date d\'émission : 06/01/2025", 150, 22);

  /* ====== INFOS ENTREPRISE ====== */
  doc.setFontSize(11);
  doc.text("[NOM DE L'ENTREPRISE] (À REMPLACER)", 15, 45);
  doc.setFontSize(9);
  doc.text("[Adresse complète]", 15, 52);
  doc.text("SIRET : [SIRET/N°] — TVA intracom. : [FR...]", 15, 58);
  doc.text("Tél : [Téléphone] — Email : [contact@exemple.com]", 15, 64);

  /* ====== INFOS CLIENT ====== */
  doc.setFontSize(11);
  doc.text("Facturé à :", 130, 45);
  doc.setFontSize(10);
  doc.text("[NOM CLIENT]", 130, 52);
  doc.text("[Adresse client complète]", 130, 58);
  doc.text("SIRET / ID : [..]", 130, 64);

  /* ====== TABLEAU PRODUITS (style: grid, right-aligned currency) ====== */
  doc.autoTable({
    startY: 80,
    head: [[
      "DÉSIGNATION",
      "QUANTITÉ",
      "PRIX UNIT. (€)",
      "TOTAL (€)"
    ]],
    body: [
      ["Produit A — référence XXX", 1, "900.00", "900.00"],
      ["Service B — description", 2, "300.00", "600.00"]
    ],
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 3,
      lineColor: 220,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [245,245,245],
      textColor: 0,
      halign: 'center',
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 95 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 }
    },
    alternateRowStyles: { fillColor: [250,250,250] }
  });

  /* ====== TOTAUX (visually emphasised, right-aligned) ====== */
  const finalY = doc.lastAutoTable.finalY + 8;

  // boxed totals on the right
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.rect(110, finalY - 6, 90, 34);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Montant hors taxes (HT)', 120, finalY + 2);
  doc.text('1 500,00 €', 195, finalY + 2, { align: 'right' });

  doc.text('TVA (20%)', 120, finalY + 10);
  doc.text('300,00 €', 195, finalY + 10, { align: 'right' });

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Montant total (TTC)', 120, finalY + 24);
  doc.text('1 800,00 €', 195, finalY + 24, { align: 'right' });

  /* ====== CONDITIONS DE PAIEMENT ====== */
  doc.setFontSize(10);
  doc.text("Conditions de paiement :", 15, finalY + 10);
  doc.setFontSize(9);
  doc.text(
    "Paiement à réception — Net à 30 jours. En cas de retard, des pénalités pourront être appliquées conformément\n" +
    "à la législation en vigueur.",
    15,
    finalY + 17
  );

  /* ====== INFORMATIONS LÉGALES ====== */
  doc.setFontSize(9);
  doc.text("TVA intracom. : [FR...] — SIRET : [SIRET] — RCS : [Ville] — IBAN : [FR...]", 15, finalY + 45);

  /* ====== SIGNATURE ====== */
  doc.setFontSize(10);
  doc.text("Signature et cachet :", 15, finalY + 55);
  doc.rect(15, finalY + 60, 60, 25);

  /* ====== FOOTER ====== */
  doc.setFontSize(9);
  doc.text("[NOM DE L'ENTREPRISE] — Contact : contact@exemple.com — SIRET : [SIRET]", 15, 285);

  /* ====== SAVE ====== */
  doc.save("facture_[NOM].pdf");
}
