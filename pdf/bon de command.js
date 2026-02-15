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
