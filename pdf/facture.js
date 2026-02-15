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

  /* ====== TABLEAU PRODUITS ====== */
  doc.autoTable({
    startY: 80,
    head: [[
      "DÉSIGNATION",
      "QUANTITÉ",
      "PRIX UNIT. (€)",
      "TOTAL (€)"
    ]],
    body: [
      ["Produit A — référence XXX", "1", "900.00", "900.00"],
      ["Service B — description", "2", "300.00", "600.00"]
    ],
    headStyles: {
      fillColor: noir,
      textColor: 255,
      halign: "center"
    },
    bodyStyles: {
      halign: "center"
    },
    styles: {
      fontSize: 10
    }
  });

  /* ====== TOTAUX ====== */
  const finalY = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.text("Montant hors taxes (HT) : 1 500,00 €", 140, finalY);
  doc.text("TVA (20%) : 300,00 €", 140, finalY + 7);

  doc.setFontSize(14);
  doc.text("Montant total (TTC) : 1 800,00 €", 140, finalY + 18);

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
