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
  doc.text("RG COLLECTION", 15, 45);
  doc.setFontSize(9);
  doc.text("123 Anywhere St, Any City", 15, 52);
  doc.text("Tél : 123-456-7890", 15, 58);
  doc.text("Email : hello@reallygreatsite.com", 15, 64);

  /* ====== INFOS CLIENT ====== */
  doc.setFontSize(11);
  doc.text("Client :", 130, 45);
  doc.setFontSize(10);
  doc.text("CÉLIA NAUDIN", 130, 52);
  doc.text("Anywhere St, Any City", 130, 58);

  /* ====== TABLEAU PRODUITS ====== */
  doc.autoTable({
    startY: 75,
    head: [[
      "DESCRIPTION",
      "PRIX (€)",
      "QUANTITÉ",
      "TOTAL (€)"
    ]],
    body: [
      ["Création de logo", "900", "1", "900"],
      ["Conception d’un flyer", "300", "1", "300"],
      ["Carte de visite", "300", "1", "300"],
      ["Illustration personnalisée", "200", "4", "800"],
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
  doc.text("Sous-total : 2 300 €", 140, finalY);
  doc.text("TVA (20%) : 460 €", 140, finalY + 7);

  doc.setFontSize(14);
  doc.text("TOTAL À PAYER : 2 760 €", 140, finalY + 18);

  /* ====== CONDITIONS ====== */
  doc.setFontSize(10);
  doc.text("Conditions de commande :", 15, finalY + 10);
  doc.setFontSize(9);
  doc.text(
    "- Cette commande est ferme et définitive après signature.\n" +
    "- Un acompte de 25% est requis à la commande.\n" +
    "- Le solde sera réglé à la livraison.",
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
  doc.text("RG COLLECTION – Bon de commande", 70, 285);

  /* ====== SAVE ====== */
  doc.save("bon_de_commande_rg_collection.pdf");
}
