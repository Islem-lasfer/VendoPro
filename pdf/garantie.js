const { jsPDF } = window.jspdf;

function generateGarantie() {
  const doc = new jsPDF();

  /* ====== COULEURS ====== */
  const beige = [245, 240, 230];
  const noir = [0, 0, 0];

  /* ====== HEADER ====== */
  doc.setFillColor(...beige);
  doc.rect(0, 0, 210, 35, "F");

  doc.setFontSize(20);
  doc.setTextColor(...noir);
  doc.text("CERTIFICAT DE GARANTIE", 15, 22);

  doc.setFontSize(10);
  doc.text("N° Garantie : G-2025-001", 150, 15);
  doc.text("Date : 06/01/2025", 150, 22);

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

  /* ====== INFOS PRODUIT (boxed, spreadsheet-like) ====== */
  const prodBoxY = 76;
  const prodBoxH = 46;
  doc.setDrawColor(200);
  doc.rect(12, prodBoxY, 186, prodBoxH);

  doc.setFontSize(12);
  doc.text("Informations du produit", 15, 80);

  doc.setFontSize(10);
  doc.text("Produit :", 15, 90);
  doc.text("Création de logo", 80, 90);

  doc.text("Numéro de série :", 15, 98);
  doc.text("RG-LOGO-2025-8891", 80, 98);

  doc.text("Date d’achat :", 15, 106);
  doc.text("06/01/2025", 80, 106);

  doc.text("Durée de garantie :", 15, 114);
  doc.text("12 mois", 80, 114);

  /* ====== TEXTE GARANTIE (boxed paragraph) ====== */
  const warrantyY = 128;
  const warrantyH = 80;
  doc.setDrawColor(220);
  doc.setFillColor(250,250,250);
  doc.rect(14, warrantyY - 4, 182, warrantyH, 'F');
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Conditions générales de garantie", 15, warrantyY);

  doc.setFontSize(9);
  const warrantyText = "Objet de la garantie : la présente garantie commerciale couvre, pendant la période mentionnée, les défauts de fabrication constatés dans des conditions normales d'utilisation. Sont exclus : usure normale, dommages accidentels, modifications non autorisées, interventions tierces ou installations non conformes.\n\nModalités : toute demande doit être accompagnée du présent certificat et d'une preuve d'achat. La prise en charge peut donner lieu, au choix du fournisseur, à la réparation ou au remplacement du produit. Toute autre indemnisation est exclue.";
  const warrantyLines = doc.splitTextToSize(warrantyText, 182);
  doc.text(warrantyLines, 16, warrantyY + 8);


  /* ====== SIGNATURE ====== */
  doc.setFontSize(10);
  doc.text("Signature et cachet du vendeur :", 15, 200);
  doc.rect(15, 205, 60, 25);

  doc.text("Signature du client :", 130, 200);
  doc.rect(130, 205, 60, 25);

  /* ====== FOOTER ====== */
  doc.setFontSize(9);
  doc.text("[NOM DE L'ENTREPRISE] — SIRET : [SIRET] — TVA intracom. : [FR...] — contact@exemple.com", 15, 285);

  /* ====== SAVE ====== */
  doc.save("certificat_garantie_[NOM].pdf");
}
