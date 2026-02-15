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

  /* ====== INFOS PRODUIT ====== */
  doc.setFontSize(12);
  doc.text("Informations du produit", 15, 80);

  doc.setFontSize(10);
  doc.text("Produit :", 15, 90);
  doc.text("Création de logo", 60, 90);

  doc.text("Numéro de série :", 15, 98);
  doc.text("RG-LOGO-2025-8891", 60, 98);

  doc.text("Date d’achat :", 15, 106);
  doc.text("06/01/2025", 60, 106);

  doc.text("Durée de garantie :", 15, 114);
  doc.text("12 mois", 60, 114);

  /* ====== TEXTE GARANTIE ====== */
  doc.setFontSize(11);
  doc.text("Conditions de garantie", 15, 130);

  doc.setFontSize(9);
  doc.text(
    "Cette garantie couvre les défauts de fabrication et de conception dans des conditions normales d’utilisation.\n" +
    "La garantie ne couvre pas les dommages résultant d’une mauvaise utilisation, de modifications non autorisées\n" +
    "ou de causes externes.\n\n" +
    "Toute demande de prise en charge doit être accompagnée de ce certificat ainsi que de la preuve d’achat.",
    15,
    138
  );

  /* ====== SIGNATURE ====== */
  doc.setFontSize(10);
  doc.text("Signature et cachet :", 15, 200);
  doc.rect(15, 205, 60, 25);

  doc.text("Signature du client :", 130, 200);
  doc.rect(130, 205, 60, 25);

  /* ====== FOOTER ====== */
  doc.setFontSize(9);
  doc.text("RG COLLECTION – Merci de votre confiance", 60, 285);

  /* ====== SAVE ====== */
  doc.save("certificat_garantie_rg_collection.pdf");
}
