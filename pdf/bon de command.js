const { jsPDF } = window.jspdf;

function generateBonCommande() {
  const doc = new jsPDF();

  /* ====== COULEURS ====== */
  const beige = [245, 240, 230];
  const noir = [0, 0, 0];

  /* ====== HEADER ====== */
  doc.setFillColor(...beige);
  doc.rect(0, 0, 210, 35, "F");

  doc.setFontSize(20);
  doc.setTextColor(...noir);
  doc.text("BON DE COMMANDE", 15, 22);

  doc.setFontSize(10);
  doc.text("Commande N° : BC-2025-001", 145, 15);
  doc.text("Date : 06/01/2025", 145, 22);

  /* ====== INFOS ENTREPRISE ====== */
  doc.setFontSize(11);
  doc.text("[NOM DE L'ENTREPRISE] (À REMPLACER)", 15, 45);
  doc.setFontSize(9);
  doc.text("[Adresse complète]", 15, 52);
  doc.text("SIRET : [SIRET/N°] — TVA intracom. : [FR...]", 15, 58);
  doc.text("Tél : [Téléphone] — Email : [contact@exemple.com]", 15, 64);

  /* ====== INFOS CLIENT ====== */
  doc.setFontSize(11);
  doc.text("Client :", 130, 45);
  doc.setFontSize(10);
  doc.text("[NOM CLIENT]", 130, 52);
  doc.text("[Adresse client complète]", 130, 58);

  /* ====== TABLEAU PRODUITS (spreadsheet-style) ====== */
  doc.autoTable({
    startY: 75,
    head: [["DESCRIPTION", "QUANTITÉ", "PRIX (€)", "TOTAL (€)"]],
    body: [
      ["Création de logo", 1, "900,00", "900,00"],
      ["Conception d’un flyer", 1, "300,00", "300,00"],
      ["Carte de visite", 1, "300,00", "300,00"],
      ["Illustration personnalisée", 4, "200,00", "800,00"]
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3, lineColor: 220 },
    headStyles: { fillColor: [245,245,245], textColor: 0, halign: 'center', fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 95 }, 1: { halign: 'center', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
    alternateRowStyles: { fillColor: [250,250,250] }
  });

  /* ====== TOTAUX (boxed, right-aligned) ====== */
  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.rect(110, finalY - 6, 90, 34);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Sous-total', 120, finalY + 2);
  doc.text('2 300,00 €', 195, finalY + 2, { align: 'right' });

  doc.text('TVA (20%)', 120, finalY + 10);
  doc.text('460,00 €', 195, finalY + 10, { align: 'right' });

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL À PAYER', 120, finalY + 24);
  doc.text('2 760,00 €', 195, finalY + 24, { align: 'right' });

  /* ====== CONDITIONS ====== */
  doc.setFontSize(10);
  doc.text("Conditions générales de commande :", 15, finalY + 10);
  doc.setFontSize(9);
  doc.text(
    "• Commande ferme après confirmation écrite. Un acompte de 25 % est exigible à la commande.\n" +
    "• Solde payable à réception de facture, sauf accord contraire écrit.\n" +
    "• Livraison et transfert des risques selon conditions contractuelles.",
    15,
    finalY + 17
  );

  /* ====== SIGNATURE ====== */
  doc.setFontSize(10);
  doc.text("Signature et cachet :", 15, finalY + 45);
  doc.rect(15, finalY + 50, 60, 25);

  doc.text("Signature du client :", 130, finalY + 45);
  doc.rect(130, finalY + 50, 60, 25);

  /* ====== FOOTER ====== */
  doc.setFontSize(9);
  doc.text("[NOM DE L'ENTREPRISE] — SIRET : [SIRET] — TVA intracom. : [FR...]", 15, 285);

  /* ====== SAVE ====== */
  doc.save("bon_de_commande_[NOM].pdf");
}
